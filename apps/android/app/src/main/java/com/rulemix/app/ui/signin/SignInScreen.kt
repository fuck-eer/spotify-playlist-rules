package com.rulemix.app.ui.signin

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rulemix.app.ui.theme.RmColor
import com.rulemix.app.ui.theme.RmType

object SignInStrings {
    const val WORDMARK = "rulemix"
    const val TAGLINE = "Your playlist, your order. Spotify just plays it."
    const val CTA = "Continue with Spotify"
    const val DEV_NOTE = "Dev mode: access is limited to the owner and 4 friends."
    const val ERROR = "Sign-in didn't finish. Try again."
}

@Composable
fun SignInScreen(
    onSignIn: () -> Unit,
    busy: Boolean = false,
    error: String? = null,
) {
    Box(
        Modifier
            .fillMaxSize()
            .background(RmColor.bg)
            .background(
                Brush.radialGradient(
                    colors = listOf(Color(0x331DB954), Color.Transparent),
                    center = Offset(200f, 120f),
                    radius = 900f,
                ),
            ),
    ) {
        Column(
            Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(SignInStrings.WORDMARK, style = RmType.display.copy(color = RmColor.text))
            Spacer(Modifier.height(8.dp))
            Text(
                SignInStrings.TAGLINE,
                style = RmType.body.copy(color = RmColor.textMuted),
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(32.dp))
            Button(
                onClick = onSignIn,
                enabled = !busy,
                modifier = Modifier.fillMaxWidth().height(48.dp).testTag("signin"),
                shape = RoundedCornerShape(999.dp),
                colors = ButtonDefaults.buttonColors(containerColor = RmColor.text, contentColor = RmColor.bg),
            ) {
                if (busy) CircularProgressIndicator(Modifier.height(20.dp), color = RmColor.bg, strokeWidth = 2.dp)
                else Text(SignInStrings.CTA, style = RmType.rowTitle)
            }
            if (error != null) {
                Spacer(Modifier.height(12.dp))
                Text(error, style = RmType.hint.copy(color = RmColor.error), textAlign = TextAlign.Center)
            }
            Spacer(Modifier.height(16.dp))
            Text(
                SignInStrings.DEV_NOTE,
                style = RmType.hint.copy(color = RmColor.textDim),
                textAlign = TextAlign.Center,
            )
        }
    }
}
