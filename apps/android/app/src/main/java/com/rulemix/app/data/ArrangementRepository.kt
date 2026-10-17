package com.rulemix.app.data

import com.rulemix.app.domain.ArrangementDraft
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

sealed interface ArrangementSave {
    data class Saved(val version: Int) : ArrangementSave
    /** 409: another device saved first; [state] is the server's. */
    data class Stale(val state: MixState) : ArrangementSave
}

class ArrangementRepository(private val api: Api) {
    suspend fun put(mixId: String, version: Int, d: ArrangementDraft): ArrangementSave {
        // explicitNulls=false would drop manualOrder: null, which the server requires present.
        val body = JsonObject(
            RmJson.encodeToJsonElement(d).jsonObject +
                mapOf("version" to JsonPrimitive(version), "manualOrder" to (d.manualOrder?.let { RmJson.encodeToJsonElement(it) } ?: JsonNull)),
        )
        return try {
            val r = api.put("/api/mixes/$mixId/arrangement", body)
            ArrangementSave.Saved(r!!.jsonObject["version"]!!.jsonPrimitive.int)
        } catch (e: ApiException.Http) {
            val st = e.body?.jsonObject?.get("state")
            if (e.status == 409 && st != null) ArrangementSave.Stale(RmJson.decodeFromJsonElement(MixState.serializer(), st)) else throw e
        }
    }

    companion object {
        const val STALE = "Updated from another device."
    }
}
