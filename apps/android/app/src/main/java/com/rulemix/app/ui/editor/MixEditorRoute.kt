package com.rulemix.app.ui.editor

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import com.rulemix.app.AppContainer

@Composable
fun MixEditorRoute(container: AppContainer, mixId: String, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    val c = remember(mixId) { EditorController(mixId, container.mixes, container.api, scope) }
    LaunchedEffect(mixId) { c.load() }
    BackHandler(onBack = onBack)
    MixEditorScreen(
        state = c.state,
        result = c.result,
        offline = c.offline,
        onBack = onBack,
        onKeepSourceOrder = c::setKeepSourceOrder,
        onReshuffle = c::reshuffle,
    )
}
