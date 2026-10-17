package com.rulemix.app.ui.graph

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.rulemix.app.data.TrackMeta
import com.rulemix.app.ui.theme.RmColor
import com.rulemix.app.ui.theme.RmType
import com.rulemix.app.ui.theme.ruleColor
import com.rulemix.engine.GraphNode
import com.rulemix.engine.NodeRole

const val COVER_DP = 48
private const val RING_DP = 3

enum class RingKind { PLAIN, RULE, SPLIT }

fun ringKind(node: GraphNode): RingKind = when {
    node.ruleIndex == null -> RingKind.PLAIN
    node.ruleIndices.size > 1 -> RingKind.SPLIT
    else -> RingKind.RULE
}

/** Deterministic gradient for missing art (web `placeholder`). */
fun placeholderBrush(uri: String): Brush {
    var h = 0
    for (c in uri) h = (h * 31 + c.code) and 0xffffff
    val a = Color(0xFF000000 or (h.toLong() and 0x7f7f7f) or 0x202020)
    val b = Color(0xFF000000 or ((h.toLong() shr 4) and 0x5f5f5f) or 0x101010)
    return Brush.linearGradient(listOf(a, b))
}

/** One cover: ring (plain / rule / split), stack rings + `x{N}`, `#n` chip, slot label. */
@Composable
fun Cover(
    node: GraphNode,
    track: TrackMeta?,
    rules: List<RuleMeta>,
    modifier: Modifier = Modifier,
    /** 0..1 while the rule colour sweeps clockwise over the plain ring (#7); null = settled. */
    sweep: Float? = null,
) {
    val kind = ringKind(node)
    val chipIndex = if (node.role == NodeRole.COPY || node.plays > 1) node.ruleIndex else null
    val ringColor = node.ruleIndex?.let(::ruleColor) ?: RmColor.ringPlain
    Column(modifier.width(COL_WIDTH.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier
                .size(COVER_DP.dp)
                .testTag("cover")
                .semantics { contentDescription = coverLabel(node, track, rules) },
            contentAlignment = Alignment.Center,
        ) {
            if (node.plays > 1) {
                Box(Modifier.size(COVER_DP.dp).offset(6.dp, (-4).dp).border(RING_DP.dp, ringColor.copy(alpha = .6f), CircleShape))
                Box(Modifier.size(COVER_DP.dp).offset(3.dp, (-2).dp).border(RING_DP.dp, ringColor.copy(alpha = .8f), CircleShape))
            }
            val ring = when (kind) {
                RingKind.SPLIT -> Modifier.drawBehind {
                    val stroke = RING_DP.dp.toPx()
                    val inset = stroke / 2
                    val s = Size(size.width - stroke, size.height - stroke)
                    drawArc(ruleColor(node.ruleIndices[0]), -90f, 180f, false, Offset(inset, inset), s, style = Stroke(stroke))
                    drawArc(ruleColor(node.ruleIndices[1]), 90f, 180f, false, Offset(inset, inset), s, style = Stroke(stroke))
                }
                else -> if (sweep != null && node.ruleIndex != null) {
                    Modifier.border(RING_DP.dp, RmColor.ringPlain, CircleShape).drawBehind {
                        val stroke = RING_DP.dp.toPx()
                        val inset = stroke / 2
                        drawArc(ringColor, -90f, 360f * sweep, false, Offset(inset, inset), Size(size.width - stroke, size.height - stroke), style = Stroke(stroke))
                    }
                } else Modifier.border(RING_DP.dp, ringColor, CircleShape)
            }
            Box(Modifier.size(COVER_DP.dp).then(ring).testTag("ring-${kind.name.lowercase()}"))
            Box(
                Modifier.size((COVER_DP - 2 * RING_DP).dp).clip(CircleShape).background(placeholderBrush(node.uri)),
            ) {
                val art = track?.imageUrl
                if (art != null) AsyncImage(model = art, contentDescription = null, modifier = Modifier.size((COVER_DP - 2 * RING_DP).dp))
            }
            if (node.plays > 1) {
                Text(
                    "x${node.plays}",
                    style = RmType.slot.copy(color = Color.White),
                    modifier = Modifier.background(Color(0xB3000000), RoundedCornerShape(4.dp)).padding(horizontal = 4.dp),
                )
            }
            if (chipIndex != null) {
                val chipScale = if (sweep == null) 1f else ((sweep - 0.4f) / 0.6f).coerceIn(0f, 1f)
                Text(
                    "#${chipIndex + 1}",
                    style = RmType.slot.copy(color = Color.Black),
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .offset(8.dp, (-6).dp)
                        .graphicsLayer { scaleX = chipScale; scaleY = chipScale }
                        .background(ruleColor(chipIndex), RoundedCornerShape(999.dp))
                        .padding(horizontal = 4.dp)
                        .testTag("chip"),
                )
            }
        }
        Text(slotLabel(node), style = RmType.slot.copy(color = RmColor.textDim))
        if (node.shiftedFrom != null) {
            Text("moved from #${node.shiftedFrom!! + 1}", style = RmType.slot.copy(color = RmColor.textMuted))
        }
    }
}
