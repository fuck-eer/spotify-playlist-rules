package com.rulemix.app.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put

object OfflineStrings {
    const val NO_CACHE = "You're offline. Connect to load your mixes."
    const val BANNER = "You're offline. Showing what was saved on this phone."
}

/** Mixes and Mix states, cached for read-only offline use. */
class MixRepository(
    private val api: Api,
    private val cache: Cache,
    private val connectivity: Connectivity,
) {
    fun mixes(): Flow<CachedResult<List<Mix>>> =
        cached("mixes", ListSerializer(Mix.serializer())) { api.get("/api/mixes")!!.jsonObject["mixes"]!! }

    fun state(id: String): Flow<CachedResult<MixState>> =
        cached("state-$id", MixState.serializer()) { api.get("/api/mixes/$id/state")!! }

    /** Writes a state already in hand (after an edit) so offline shows the latest. */
    fun remember(state: MixState) =
        cache.write("state-${state.mix.id}", RmJson.encodeToString(MixState.serializer(), state))

    suspend fun sources(): SourcesResponse =
        RmJson.decodeFromJsonElement(SourcesResponse.serializer(), api.get("/api/sources")!!)

    suspend fun createMix(name: String, source: SourceOption): Mix {
        val res = api.post(
            "/api/mixes",
            buildJsonObject {
                put("name", name)
                put(
                    "source",
                    buildJsonObject {
                        put("type", source.type)
                        if (source.type == "playlist") put("id", source.id) else put("id", JsonNull)
                    },
                )
            },
        )!!
        return RmJson.decodeFromJsonElement(Mix.serializer(), res.jsonObject["mix"]!!)
    }

    private fun <T> cached(key: String, ser: KSerializer<T>, fetch: suspend () -> JsonElement): Flow<CachedResult<T>> = flow {
        val cachedValue = cache.read(key)?.let { runCatching { RmJson.decodeFromString(ser, it) }.getOrNull() }
        if (!connectivity.online.value) {
            emit(CachedResult(cachedValue, stale = true, offline = true, error = if (cachedValue == null) OfflineStrings.NO_CACHE else null))
            return@flow
        }
        if (cachedValue != null) emit(CachedResult(cachedValue, stale = true))
        try {
            val json = fetch()
            val fresh = RmJson.decodeFromJsonElement(ser, json)
            cache.write(key, RmJson.encodeToString(ser, fresh))
            emit(CachedResult(fresh, stale = false))
        } catch (e: ApiException.Offline) {
            emit(CachedResult(cachedValue, stale = true, offline = true, error = if (cachedValue == null) OfflineStrings.NO_CACHE else null))
        } catch (e: ApiException.Http) {
            emit(CachedResult(cachedValue, stale = cachedValue != null, error = e.message))
        }
    }
}
