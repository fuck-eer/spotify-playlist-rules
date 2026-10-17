package com.rulemix.app.playback

import android.content.Context
import com.spotify.android.appremote.api.ConnectionParams
import com.spotify.android.appremote.api.Connector
import com.spotify.android.appremote.api.SpotifyAppRemote
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/** What PlayController needs from Spotify on the phone (fake in tests). */
interface RemotePlayer {
    suspend fun setShuffle(on: Boolean)
    suspend fun play(uri: String)
}

/** App Remote: connect on onStart (no auth view; sign-in already happened), disconnect on onStop. */
class AppRemote(private val context: Context, private val clientId: String, private val redirectUri: String) : RemotePlayer {
    private var remote: SpotifyAppRemote? = null

    suspend fun connect(): SpotifyAppRemote {
        remote?.takeIf { it.isConnected }?.let { return it }
        return withTimeout(TIMEOUT_MS) {
            suspendCancellableCoroutine { cont ->
                val params = ConnectionParams.Builder(clientId).setRedirectUri(redirectUri).showAuthView(false).build()
                SpotifyAppRemote.connect(context, params, object : Connector.ConnectionListener {
                    override fun onConnected(r: SpotifyAppRemote) {
                        remote = r
                        if (cont.isActive) cont.resume(r)
                    }
                    override fun onFailure(t: Throwable) {
                        if (cont.isActive) cont.resumeWithException(t)
                    }
                })
            }
        }
    }

    fun disconnect() {
        remote?.let(SpotifyAppRemote::disconnect)
        remote = null
    }

    override suspend fun setShuffle(on: Boolean) {
        val r = connect()
        suspendCancellableCoroutine { c ->
            r.playerApi.setShuffle(on).setResultCallback { c.resume(Unit) }.setErrorCallback { c.resumeWithException(it) }
        }
    }

    override suspend fun play(uri: String) {
        val r = connect()
        suspendCancellableCoroutine { c ->
            r.playerApi.play(uri).setResultCallback { c.resume(Unit) }.setErrorCallback { c.resumeWithException(it) }
        }
    }

    companion object { const val TIMEOUT_MS = 20_000L }
}
