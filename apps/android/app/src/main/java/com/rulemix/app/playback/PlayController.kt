package com.rulemix.app.playback

import com.rulemix.app.data.Api
import com.rulemix.app.data.ApiException
import kotlinx.coroutines.delay
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

sealed interface PlayResult {
    /** Started in Spotify via App Remote, from track 1 with shuffle off. */
    data class Playing(val playlistId: String) : PlayResult
    /** App Remote failed; the playlist was opened in Spotify (or the browser) instead. */
    data class OpenedInSpotify(val playlistId: String) : PlayResult
    data class Failed(val message: String) : PlayResult
}

/** Opens a URI outside the app (Intent ACTION_VIEW); returns false when nothing handles it. */
fun interface UriOpener { fun open(uri: String): Boolean }

class PlayController(
    private val api: Api,
    private val remote: RemotePlayer,
    private val opener: UriOpener,
    private val pollMs: Long = 1000,
    private val maxPolls: Int = 120,
) {
    suspend fun play(mixId: String): PlayResult {
        val runId = try {
            api.post("/api/mixes/$mixId/play")!!.jsonObject["runId"]!!.jsonPrimitive.content
        } catch (e: ApiException.Http) {
            e.body?.jsonObject?.get("runId")?.jsonPrimitive?.contentOrNull ?: return PlayResult.Failed(e.message ?: FAILED)
        } catch (e: ApiException) {
            return PlayResult.Failed(e.message ?: FAILED)
        }
        var playlistId: String? = null
        for (i in 0 until maxPolls) {
            val run = try {
                api.get("/api/mixes/$mixId/save/$runId")!!.jsonObject["run"]!!.jsonObject
            } catch (e: ApiException) {
                return PlayResult.Failed(e.message ?: FAILED)
            }
            when ((run["status"] as? JsonPrimitive)?.contentOrNull) {
                "succeeded" -> { playlistId = (run["playlistId"] as? JsonPrimitive)?.contentOrNull; break }
                "failed" -> return PlayResult.Failed((run["error"] as? JsonPrimitive)?.contentOrNull ?: FAILED)
            }
            delay(pollMs)
        }
        val id = playlistId ?: return PlayResult.Failed(FAILED)
        return try {
            remote.setShuffle(false)
            remote.play("spotify:playlist:$id")
            PlayResult.Playing(id)
        } catch (e: Exception) {
            if (e is kotlinx.coroutines.CancellationException && e !is kotlinx.coroutines.TimeoutCancellationException) throw e
            if (opener.open("spotify:playlist:$id") || opener.open("https://open.spotify.com/playlist/$id")) PlayResult.OpenedInSpotify(id)
            else PlayResult.Failed(OPEN_FAILED)
        }
    }

    companion object {
        const val FAILED = "Couldn't update your Spotify playlist. Try again."
        const val OPEN_FAILED = "Couldn't open Spotify."
    }
}
