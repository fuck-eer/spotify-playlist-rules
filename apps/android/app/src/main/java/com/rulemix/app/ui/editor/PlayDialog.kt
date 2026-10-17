package com.rulemix.app.ui.editor

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import com.rulemix.app.playback.PlayResult

object PlayStrings {
    const val WRITING = "Updating your Rulemix playlist…"
    const val PLAYING = "Playing in Spotify"
    const val PLAYING_BODY = "Your mix is playing from the first song, shuffle off."
    const val OPENED = "Opened in Spotify"
    const val OPENED_BODY = "Your mix is in your Rulemix playlist. Press play there, with shuffle off."
    const val OK = "OK"
    const val RETRY = "Retry"
}

/** Playback outcome: progress while the run writes, then Playing / Opened. Failures use a snackbar with Retry. */
@Composable
fun PlayDialog(busy: Boolean, result: PlayResult?, onDismiss: () -> Unit) {
    val (title, body) = when {
        busy -> PlayStrings.WRITING to ""
        result is PlayResult.Playing -> PlayStrings.PLAYING to PlayStrings.PLAYING_BODY
        result is PlayResult.OpenedInSpotify -> PlayStrings.OPENED to PlayStrings.OPENED_BODY
        else -> return
    }
    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        modifier = Modifier.testTag("play-dialog"),
        title = { Text(title) },
        text = { if (body.isNotEmpty()) Text(body) },
        confirmButton = { if (!busy) TextButton(onClick = onDismiss) { Text(PlayStrings.OK) } },
    )
}
