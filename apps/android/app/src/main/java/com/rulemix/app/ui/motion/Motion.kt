package com.rulemix.app.ui.motion

import android.content.Context
import android.provider.Settings
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/** The four v2 motion tokens (motion-spec.md, ADR-0031). */
object Motion {
    val snap = spring<Float>(dampingRatio = 0.82f, stiffness = 600f)
    val pop = spring<Float>(dampingRatio = 0.71f, stiffness = 800f)
    val sheet = spring<Float>(dampingRatio = 0.94f, stiffness = 500f)
    val easeOut = tween<Float>(240, easing = CubicBezierEasing(.2f, .8f, .2f, 1f))
    const val LONG_PRESS_MS = 350L
    const val REFLOW_MS = 260
}

/** Reduced motion = the system animator scale is 0. */
fun isReducedMotion(context: Context): Boolean =
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f

@Composable
fun reducedMotion(): Boolean {
    val ctx = LocalContext.current
    return remember(ctx) { isReducedMotion(ctx) }
}

/** `spec`, or an instant change when reduced motion is on. */
@Composable
fun <T> motionSpec(spec: AnimationSpec<T>): AnimationSpec<T> = if (reducedMotion()) snap() else spec
