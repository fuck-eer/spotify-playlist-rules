package com.rulemix.app.ui.mixes

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rulemix.app.data.CachedResult
import com.rulemix.app.data.Mix
import com.rulemix.app.data.OfflineStrings
import com.rulemix.app.ui.theme.RmColor
import com.rulemix.app.ui.theme.RmType

object MixListStrings {
    const val TITLE = "Your mixes"
    const val NEW_MIX = "New mix"
    const val EMPTY_TITLE = "No mixes yet"
    const val EMPTY_BODY = "Pick a playlist, add a rule or two, and play it in Spotify."
    const val SIGN_OUT = "Sign out"
    const val LOADING = "Loading your mixes…"
    fun meta(m: Mix) = "${m.source.name} · ${m.ruleCount} ${if (m.ruleCount == 1) "rule" else "rules"}"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MixListScreen(
    result: CachedResult<List<Mix>>?,
    online: Boolean,
    onOpen: (Mix) -> Unit,
    onNewMix: () -> Unit,
    onSignOut: () -> Unit,
) {
    Scaffold(
        containerColor = RmColor.bg,
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { if (online) onNewMix() },
                containerColor = if (online) RmColor.play else RmColor.surface3,
                contentColor = if (online) RmColor.onPlay else RmColor.textDim,
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                text = { Text(MixListStrings.NEW_MIX) },
                modifier = Modifier.testTag("new-mix").semantics { if (!online) disabled() },
            )
        },
    ) { pad ->
        Column(Modifier.fillMaxSize().padding(pad)) {
            Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(MixListStrings.TITLE, style = RmType.display.copy(color = RmColor.text), modifier = Modifier.weight(1f))
                TextButton(onClick = onSignOut) { Text(MixListStrings.SIGN_OUT, color = RmColor.textMuted) }
            }
            if (!online || result?.offline == true) OfflineBanner()
            val mixes = result?.data
            when {
                result == null -> Centered(MixListStrings.LOADING)
                mixes == null -> Centered(result.error ?: OfflineStrings.NO_CACHE)
                mixes.isEmpty() -> Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(MixListStrings.EMPTY_TITLE, style = RmType.rowTitle.copy(color = RmColor.text))
                    Spacer(Modifier.height(6.dp))
                    Text(MixListStrings.EMPTY_BODY, style = RmType.body.copy(color = RmColor.textMuted), textAlign = TextAlign.Center)
                }
                else -> LazyColumn(Modifier.fillMaxSize()) {
                    items(mixes, key = { it.id }) { m ->
                        Column(
                            Modifier.fillMaxWidth().clickable { onOpen(m) }.padding(horizontal = 16.dp, vertical = 12.dp).testTag("mix-row"),
                        ) {
                            Text(m.name, style = RmType.rowTitle.copy(color = RmColor.text))
                            Text(MixListStrings.meta(m), style = RmType.hint.copy(color = RmColor.textMuted))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun OfflineBanner() {
    Box(Modifier.fillMaxWidth().background(RmColor.surface2).padding(horizontal = 16.dp, vertical = 8.dp).testTag("offline-banner")) {
        Text(OfflineStrings.BANNER, style = RmType.hint.copy(color = RmColor.warning))
    }
}

@Composable
private fun Centered(text: String) {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Text(text, style = RmType.body.copy(color = RmColor.textMuted), textAlign = TextAlign.Center)
    }
}
