package com.rulemix.app.ui.common

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rulemix.app.ui.theme.RmColor
import com.rulemix.app.ui.theme.RmType

object SpotifyMissingStrings {
    const val TITLE = "rulemix needs the Spotify app"
    const val BODY = "Install Spotify and sign in there, then come back to rulemix."
    const val CTA = "Get Spotify"
    const val MARKET = "market://details?id=com.spotify.music"
    const val WEB = "https://play.google.com/store/apps/details?id=com.spotify.music"
}

fun openSpotifyStore(context: Context) {
    val market = Intent(Intent.ACTION_VIEW, Uri.parse(SpotifyMissingStrings.MARKET))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
        context.startActivity(market)
    } catch (_: ActivityNotFoundException) {
        context.startActivity(
            Intent(Intent.ACTION_VIEW, Uri.parse(SpotifyMissingStrings.WEB)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }
}

@Composable
fun SpotifyMissing(onGetSpotify: () -> Unit) {
    Column(
        Modifier.fillMaxSize().background(RmColor.bg).padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(SpotifyMissingStrings.TITLE, style = RmType.rowTitle.copy(color = RmColor.text), textAlign = TextAlign.Center)
        Spacer(Modifier.height(8.dp))
        Text(SpotifyMissingStrings.BODY, style = RmType.body.copy(color = RmColor.textMuted), textAlign = TextAlign.Center)
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = onGetSpotify,
            shape = RoundedCornerShape(999.dp),
            colors = ButtonDefaults.buttonColors(containerColor = RmColor.text, contentColor = RmColor.bg),
        ) { Text(SpotifyMissingStrings.CTA) }
    }
}
