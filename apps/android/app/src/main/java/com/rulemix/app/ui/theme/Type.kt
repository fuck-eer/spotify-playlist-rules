package com.rulemix.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.rulemix.app.R

@OptIn(ExperimentalTextApi::class)
private fun figtree(weight: Int) = Font(
    R.font.figtree,
    weight = FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight)),
)

/** Figtree (OFL) is the Circular-like fallback; no Spotify fonts are shipped. */
val Figtree = FontFamily(figtree(400), figtree(500), figtree(600), figtree(700), figtree(800))

object RmType {
    val display = TextStyle(fontFamily = Figtree, fontSize = 24.sp, fontWeight = FontWeight(800), letterSpacing = (-0.02).em)
    val title = TextStyle(fontFamily = Figtree, fontSize = 20.sp, fontWeight = FontWeight(800), letterSpacing = (-0.02).em)
    val dialog = TextStyle(fontFamily = Figtree, fontSize = 22.sp, fontWeight = FontWeight(800))
    val sheetTitle = TextStyle(fontFamily = Figtree, fontSize = 20.sp, fontWeight = FontWeight(800))
    val rowTitle = TextStyle(fontFamily = Figtree, fontSize = 16.sp, fontWeight = FontWeight(600))
    val body = TextStyle(fontFamily = Figtree, fontSize = 14.sp)
    val hint = TextStyle(fontFamily = Figtree, fontSize = 13.sp)
    val label = TextStyle(fontFamily = Figtree, fontSize = 11.sp, fontWeight = FontWeight(700), letterSpacing = 0.1.em)
    val slot = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 11.sp, fontWeight = FontWeight(500))
    val chip = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 10.sp, fontWeight = FontWeight(700))
}

val RmTypography = Typography(
    displaySmall = RmType.display,
    titleLarge = RmType.title,
    titleMedium = RmType.rowTitle,
    bodyMedium = RmType.body,
    bodySmall = RmType.hint,
    labelSmall = RmType.label,
)
