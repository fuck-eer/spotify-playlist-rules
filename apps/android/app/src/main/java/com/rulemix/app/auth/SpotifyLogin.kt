package com.rulemix.app.auth

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import com.rulemix.app.BuildConfig
import com.spotify.sdk.android.auth.AuthorizationClient
import com.spotify.sdk.android.auth.AuthorizationRequest
import com.spotify.sdk.android.auth.AuthorizationResponse

/** Sign-in through the Spotify app (ADR-0032): authorization code → rulemix session. */
object SpotifyLogin {
    const val REQUEST_CODE = 1337
    const val SPOTIFY_PACKAGE = "com.spotify.music"

    /** Web scopes plus App Remote. */
    val SCOPES = arrayOf(
        "playlist-read-private",
        "playlist-read-collaborative",
        "playlist-modify-private",
        "user-library-read",
        "user-read-playback-state",
        "user-modify-playback-state",
        "app-remote-control",
    )

    fun request(): AuthorizationRequest =
        AuthorizationRequest.Builder(
            BuildConfig.SPOTIFY_CLIENT_ID,
            AuthorizationResponse.Type.CODE,
            BuildConfig.REDIRECT_URI,
        ).setScopes(SCOPES).build()

    fun open(activity: Activity) =
        AuthorizationClient.openLoginActivity(activity, REQUEST_CODE, request())

    sealed interface Result {
        data class Code(val code: String) : Result
        data class Failed(val message: String?) : Result
        data object Cancelled : Result
    }

    fun parse(resultCode: Int, data: Intent?): Result {
        val r = AuthorizationClient.getResponse(resultCode, data)
        return when (r.type) {
            AuthorizationResponse.Type.CODE -> Result.Code(r.code)
            AuthorizationResponse.Type.ERROR -> Result.Failed(r.error)
            else -> Result.Cancelled
        }
    }

    fun isSpotifyInstalled(pm: PackageManager): Boolean = try {
        pm.getPackageInfo(SPOTIFY_PACKAGE, 0)
        true
    } catch (_: PackageManager.NameNotFoundException) {
        false
    }
}
