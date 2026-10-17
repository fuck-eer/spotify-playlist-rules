package com.rulemix.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.lifecycleScope
import com.rulemix.app.auth.SpotifyLogin
import com.rulemix.app.data.ApiException
import com.rulemix.app.ui.RulemixApp
import com.rulemix.app.ui.signin.SignInStrings
import com.rulemix.app.ui.theme.RulemixTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val container by lazy { (application as RulemixApplication).container }
    private var busy by mutableStateOf(false)
    private var error by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val token by container.tokens.token.collectAsState()
            RulemixTheme {
                RulemixApp(
                    container = container,
                    signedIn = token != null,
                    spotifyInstalled = SpotifyLogin.isSpotifyInstalled(packageManager),
                    signInBusy = busy,
                    signInError = error,
                    onSignIn = {
                        error = null
                        SpotifyLogin.open(this)
                    },
                )
            }
        }
    }

    override fun onStart() {
        super.onStart()
        if (container.tokens.token.value != null && SpotifyLogin.isSpotifyInstalled(packageManager)) {
            lifecycleScope.launch { runCatching { container.remote.connect() } }
        }
    }

    override fun onStop() {
        container.remote.disconnect()
        super.onStop()
    }

    @Deprecated("AuthorizationClient delivers its result here")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != SpotifyLogin.REQUEST_CODE) return
        when (val r = SpotifyLogin.parse(resultCode, data)) {
            is SpotifyLogin.Result.Code -> {
                busy = true
                lifecycleScope.launch {
                    try {
                        container.auth.signIn(r.code)
                    } catch (e: ApiException) {
                        error = SignInStrings.ERROR
                    } finally {
                        busy = false
                    }
                }
            }
            is SpotifyLogin.Result.Failed -> error = SignInStrings.ERROR
            SpotifyLogin.Result.Cancelled -> Unit
        }
    }
}
