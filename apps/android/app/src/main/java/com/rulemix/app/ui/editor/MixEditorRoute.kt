package com.rulemix.app.ui.editor

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.material3.SnackbarHostState
import com.rulemix.app.AppContainer
import com.rulemix.engine.GraphNode

@Composable
fun MixEditorRoute(container: AppContainer, mixId: String, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    val c = remember(mixId) { EditorController(mixId, container.mixes, container.api, scope) }
    val snackbar = remember { SnackbarHostState() }
    var tapped by remember { mutableStateOf<GraphNode?>(null) }
    LaunchedEffect(mixId) { c.load() }
    LaunchedEffect(c.error) {
        c.error?.let {
            snackbar.showSnackbar(it)
            c.error = null
        }
    }
    BackHandler(onBack = onBack)
    MixEditorScreen(
        state = c.state,
        result = c.result,
        offline = c.offline,
        onBack = onBack,
        snackbar = snackbar,
        onTap = { if (!c.offline) tapped = it },
        onRemoveRule = c::removeRule,
        onKeepSourceOrder = c::setKeepSourceOrder,
        onReshuffle = c::reshuffle,
    )
    val node = tapped
    val s = c.state
    if (node != null && s != null) {
        SongSheet(
            uri = node.uri,
            track = s.tracks[node.uri],
            songRules = s.rules.mapIndexed { i, r -> i to r }.filter { it.second.trackUri == node.uri },
            ruleCount = s.rules.size,
            maxRules = c.maxRules,
            onAdd = { k, n -> c.addRule(k, n, node.uri) },
            onChange = c::changeRule,
            onRemove = c::removeRule,
            onDismiss = { tapped = null },
        )
    }
}
