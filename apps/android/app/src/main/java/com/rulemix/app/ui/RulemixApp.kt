package com.rulemix.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import com.rulemix.app.ui.editor.MixEditorRoute
import com.rulemix.app.ui.mixes.MixListRoute
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.rulemix.app.AppContainer
import com.rulemix.app.ui.common.SpotifyMissing
import com.rulemix.app.ui.common.openSpotifyStore
import com.rulemix.app.ui.signin.SignInScreen
import com.rulemix.app.ui.theme.RmColor

/** Root: sign-in (or Spotify missing) until there is a session, then the Mix list. */
@Composable
fun RulemixApp(
    container: AppContainer,
    signedIn: Boolean,
    spotifyInstalled: Boolean,
    signInBusy: Boolean,
    signInError: String?,
    onSignIn: () -> Unit,
) {
    val ctx = LocalContext.current
    when {
        !signedIn && !spotifyInstalled -> SpotifyMissing(onGetSpotify = { openSpotifyStore(ctx) })
        !signedIn -> SignInScreen(onSignIn = onSignIn, busy = signInBusy, error = signInError)
        else -> SignedInHome(container)
    }
}

@Composable
internal fun SignedInHome(container: AppContainer) {
    var open by rememberSaveable { mutableStateOf<String?>(null) }
    val id = open
    if (id == null) {
        MixListRoute(container, onOpen = { open = it })
    } else {
        MixEditorRoute(container, id, onBack = { open = null })
    }
}
