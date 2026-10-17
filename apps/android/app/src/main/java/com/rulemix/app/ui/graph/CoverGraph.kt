package com.rulemix.app.ui.graph

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.animation.core.Animatable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.key
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.SemanticsPropertyReceiver
import androidx.compose.ui.semantics.semantics
import com.rulemix.app.ui.motion.Motion
import com.rulemix.app.ui.motion.reducedMotion
import kotlinx.coroutines.delay
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.rulemix.app.data.TrackMeta
import com.rulemix.app.ui.theme.RmColor
import com.rulemix.engine.GraphNode

private const val BULGE = 34

/** Test hooks: current pop scale of a cover slot and draw-in progress of a row wire. */
val PopScale = SemanticsPropertyKey<Float>("PopScale")
var SemanticsPropertyReceiver.popScale by PopScale
val WireProgress = SemanticsPropertyKey<Float>("WireProgress")
var SemanticsPropertyReceiver.wireProgress by WireProgress

/**
 * The cover graph: a LazyColumn of rows (row-level virtualisation for 600+ nodes), odd rows
 * right to left, the wire drawn per row in drawBehind. [cover] lets interaction layers wrap
 * each cover (tap, drag, semantics actions).
 */
@Composable
fun CoverGraph(
    nodes: List<GraphNode>,
    tracks: Map<String, TrackMeta>,
    rules: List<RuleMeta>,
    modifier: Modifier = Modifier,
    maxHeight: Dp = 560.dp,
    state: LazyListState = rememberLazyListState(),
    onCols: (Int) -> Unit = {},
    cover: @Composable (node: GraphNode, index: Int, content: @Composable () -> Unit) -> Unit = { _, _, c -> c() },
) {
    val reduced = reducedMotion()
    val book = remember { MotionBook() }
    BoxWithConstraints(modifier.fillMaxWidth()) {
        val cols = colsFor(maxWidth.value.toInt())
        onCols(cols)
        book.update(nodes, cols, reduced)
        val rows = rowCount(nodes.size, cols)
        val width = (cols * COL_WIDTH).dp
        LazyColumn(
            state = state,
            modifier = Modifier.fillMaxWidth().heightIn(max = maxHeight).testTag("cover-graph"),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            items(rows, key = { it }) { row ->
                val first = row * cols
                val last = minOf(nodes.size - 1, first + cols - 1)
                val wire = remember { Animatable(if (reduced) 1f else 0f) }
                LaunchedEffect(Unit) { if (!reduced) { delay(minOf(row, 6) * 40L); wire.animateTo(1f, Motion.easeOut) } }
                Box(
                    Modifier.width(width).height(ROW_HEIGHT.dp).semantics { wireProgress = wire.value }.drawBehind {
                        val stroke = 2.dp.toPx()
                        val a = posOf(first, cols)
                        val b = posOf(last, cols)
                        val y = (ROW_HEIGHT / 2).dp.toPx()
                        val path = Path().apply {
                            moveTo(a.x.dp.toPx(), y)
                            lineTo(b.x.dp.toPx(), y)
                            if (last + 1 < nodes.size) {
                                val c = posOf(last + 1, cols)
                                val dx = (if (row % 2 == 0) BULGE else -BULGE).dp.toPx()
                                val bx = b.x.dp.toPx()
                                val cx = c.x.dp.toPx()
                                val ny = y + ROW_HEIGHT.dp.toPx()
                                cubicTo(bx + dx, y, cx + dx, ny, cx, ny)
                            }
                        }
                        if (wire.value >= 1f) {
                            drawPath(path, RmColor.wire, style = Stroke(stroke))
                        } else {
                            // Draw-in: the first [wire] fraction of the row's path.
                            val m = PathMeasure().apply { setPath(path, false) }
                            val seg = Path()
                            m.getSegment(0f, m.length * wire.value, seg, true)
                            drawPath(seg, RmColor.wire, style = Stroke(stroke))
                        }
                    },
                ) {
                    for (i in first..last) {
                        val p = posOf(i, cols)
                        val node = nodes[i]
                        AnimatedCover(node, p, reduced, book, initialIndex = i) {
                            cover(node, i) { Cover(node, tracks[node.uri], rules, sweep = it) }
                        }
                    }
                    // Removed covers dissolve in place where they were (#45 delete-shrink, bench shrink).
                    for (g in book.ghosts.filter { it.pos.row == row }) {
                        key(g.node.key) { GhostCover(g, reduced, book) { Cover(g.node, tracks[g.node.uri], rules) } }
                    }
                }
            }
        }
    }
}
