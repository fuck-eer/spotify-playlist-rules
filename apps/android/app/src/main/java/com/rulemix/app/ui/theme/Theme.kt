package com.rulemix.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

private val Scheme = darkColorScheme(
    background = RmColor.bg,
    onBackground = RmColor.text,
    surface = RmColor.surface1,
    onSurface = RmColor.text,
    surfaceVariant = RmColor.surface2,
    onSurfaceVariant = RmColor.textMuted,
    surfaceContainer = RmColor.surface2,
    surfaceContainerHigh = RmColor.surface2,
    surfaceContainerLow = RmColor.surface1,
    primary = RmColor.text,
    onPrimary = RmColor.bg,
    secondary = RmColor.textMuted,
    error = RmColor.error,
    outline = RmColor.line,
    scrim = RmColor.scrim,
)

private val RmShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(16.dp),
    extraLarge = RoundedCornerShape(16.dp),
)

@Composable
fun RulemixTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Scheme, typography = RmTypography, shapes = RmShapes, content = content)
}
