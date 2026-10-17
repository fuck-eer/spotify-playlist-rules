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
import androidx.compose.runtime.Composable
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
    BoxWithConstraints(modifier.fillMaxWidth()) {
        val cols = colsFor(maxWidth.value.toInt())
        onCols(cols)
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
                Box(
                    Modifier.width(width).height(ROW_HEIGHT.dp).drawBehind {
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
                        drawPath(path, RmColor.wire, style = Stroke(stroke))
                    },
                ) {
                    for (i in first..last) {
                        val p = posOf(i, cols)
                        val node = nodes[i]
                        Box(Modifier.offset(x = (p.x - COL_WIDTH / 2).dp, y = (ROW_HEIGHT / 2 - COVER_DP / 2).dp)) {
                            cover(node, i) { Cover(node, tracks[node.uri], rules) }
                        }
                    }
                }
            }
        }
    }
}
