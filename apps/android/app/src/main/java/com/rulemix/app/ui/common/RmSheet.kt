package com.rulemix.app.ui.common

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.SemanticsPropertyReceiver
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.rulemix.app.ui.editor.clickableNoRipple
import com.rulemix.app.ui.motion.Motion
import com.rulemix.app.ui.motion.reducedMotion
import kotlinx.coroutines.launch

/** 0 = off screen, 1 = fully open (test hook). */
val SheetProgress = SemanticsPropertyKey<Float>("SheetProgress")
var SemanticsPropertyReceiver.sheetProgress by SheetProgress

/**
 * Bottom sheet on the motion-spec sheet spring (#13: spring.sheet in, ζ 0.94 / k 500, no
 * overshoot at the edge; #35: 200 ms ease-in out; scrim fades 200 ms). Reduced motion: instant.
 */
@Composable
fun RmSheet(onDismiss: () -> Unit, containerColor: Color, content: @Composable () -> Unit) {
    val reduced = reducedMotion()
    val progress = remember { Animatable(if (reduced) 1f else 0f) }
    val scope = rememberCoroutineScope()
    var height by remember { mutableStateOf(0) }
    var closing by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { if (!reduced) progress.animateTo(1f, Motion.sheet) }
    val close: () -> Unit = {
        if (!closing) {
            closing = true
            scope.launch {
                if (!reduced) progress.animateTo(0f, tween(200, easing = CubicBezierEasing(.4f, 0f, 1f, 1f)))
                onDismiss()
            }
        }
    }
    Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        BackHandler(onBack = close)
        Box(Modifier.fillMaxSize()) {
            Box(
                Modifier.fillMaxSize().graphicsLayer { alpha = progress.value.coerceIn(0f, 1f) }
                    .background(Color(0x99000000)).clickableNoRipple(close).testTag("sheet-scrim"),
            )
            Column(
                Modifier.align(Alignment.BottomCenter).fillMaxWidth()
                    .onSizeChanged { height = it.height }
                    .semantics { sheetProgress = progress.value }
                    .graphicsLayer { translationY = (1f - progress.value) * height }
                    .background(containerColor, RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp))
                    .navigationBarsPadding()
                    .testTag("rm-sheet"),
            ) {
                Box(Modifier.align(Alignment.CenterHorizontally).padding(top = 10.dp, bottom = 6.dp).size(width = 36.dp, height = 4.dp).background(Color(0x66FFFFFF), RoundedCornerShape(2.dp)))
                content()
            }
        }
    }
}
