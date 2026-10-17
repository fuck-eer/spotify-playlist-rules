package com.rulemix.app

import com.rulemix.app.ui.graph.GraphPos
import com.rulemix.app.ui.graph.colsFor
import com.rulemix.app.ui.graph.graphLayout
import com.rulemix.app.ui.graph.nearestIndex
import com.rulemix.app.ui.graph.rowCount
import org.junit.Assert.assertEquals
import org.junit.Test

/** Same vectors as apps/web/components/graph/layout.test.ts. */
class GraphLayoutTest {
    @Test fun columnsAreFloorWidthOver72WithAMinimumOf3() {
        assertEquals(4, colsFor(300))
        assertEquals(13, colsFor(1000))
        assertEquals(3, colsFor(100))
    }

    @Test fun oneAndThreeNodesAtWidth300() {
        assertEquals(GraphPos(36, 46, 0, 0), graphLayout(1, colsFor(300))[0])
        assertEquals(listOf(36, 108, 180), graphLayout(3, colsFor(300)).map { it.x })
        assertEquals(1, rowCount(3, colsFor(300)))
    }

    @Test fun sevenNodesAtWidth300Row2RunsRightToLeft() {
        val l = graphLayout(7, colsFor(300))
        assertEquals(2, rowCount(7, 4))
        assertEquals(GraphPos(252, 138, 1, 3), l[4])
        assertEquals(GraphPos(108, 138, 1, 1), l[6])
    }

    @Test fun twentyNodesWideAndNarrow() {
        val wide = graphLayout(20, colsFor(1000))
        assertEquals(2, rowCount(20, 13))
        assertEquals(GraphPos(12 * 72 + 36, 138, 1, 12), wide[13])
        assertEquals(6, wide[19].col)
        val narrow = graphLayout(20, colsFor(300))
        assertEquals(5, rowCount(20, 4))
        assertEquals(GraphPos(252, 4 * 92 + 46, 4, 3), narrow[19])
    }

    @Test fun nearestIndexFindsTheClosestAllowedNode() {
        assertEquals(1, nearestIndex(7, 4, 110f, 50f, 70f))
        assertEquals(2, nearestIndex(7, 4, 110f, 50f, 80f) { it != 1 })
        assertEquals(-1, nearestIndex(7, 4, 2000f, 2000f, 70f))
    }
}
