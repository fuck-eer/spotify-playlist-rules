package com.rulemix.app.ui.graph

import kotlin.math.max

/** Same maths as web `components/graph/layout.ts` (dp instead of px). */
const val COL_WIDTH = 72
const val ROW_HEIGHT = 92
const val MIN_COLS = 3

data class GraphPos(val x: Int, val y: Int, val row: Int, val col: Int)

fun colsFor(widthDp: Int, colWidth: Int = COL_WIDTH): Int = max(MIN_COLS, widthDp / colWidth)

fun posOf(i: Int, cols: Int, colWidth: Int = COL_WIDTH, rowHeight: Int = ROW_HEIGHT): GraphPos {
    val row = i / cols
    val c = i % cols
    val col = if (row % 2 == 0) c else cols - 1 - c
    return GraphPos(col * colWidth + colWidth / 2, row * rowHeight + rowHeight / 2, row, col)
}

fun graphLayout(count: Int, cols: Int): List<GraphPos> = List(count) { posOf(it, cols) }

fun rowCount(count: Int, cols: Int): Int = (count + cols - 1) / cols

/** Index of the nearest allowed node within `radius`, or -1 (web `nearestIndex`). */
fun nearestIndex(count: Int, cols: Int, x: Float, y: Float, radius: Float, allow: (Int) -> Boolean = { true }): Int {
    var best = -1
    var bestD = radius * radius
    for (i in 0 until count) {
        if (!allow(i)) continue
        val p = posOf(i, cols)
        val d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y)
        if (d <= bestD) {
            bestD = d
            best = i
        }
    }
    return best
}
