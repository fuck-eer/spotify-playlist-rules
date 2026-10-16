package com.rulemix.app.ui.theme

import androidx.compose.ui.graphics.Color

/** Rule colours by rule position (ADR-0017), tokens.json `color.rule`. */
val RulePalette: List<Color> = listOf(
    Color(0xFFE8B04B), Color(0xFF7AA7FF), Color(0xFFE57A9A), Color(0xFF9AD08A), Color(0xFFC9A3F0),
    Color(0xFF5FCFC4), Color(0xFFF0895A), Color(0xFFD8D36A), Color(0xFF8F96F0), Color(0xFFC8B08A),
)

fun ruleColor(index: Int): Color = RulePalette[index.mod(RulePalette.size)]
