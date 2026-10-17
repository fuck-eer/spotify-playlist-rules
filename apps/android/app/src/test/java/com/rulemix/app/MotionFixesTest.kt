package com.rulemix.app

import android.provider.Settings
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.test.core.app.ApplicationProvider
import com.rulemix.app.ui.common.RmSheet
import com.rulemix.app.ui.common.SheetProgress
import com.rulemix.app.ui.editor.EditableGraph
import com.rulemix.app.ui.editor.GraphEditor
import com.rulemix.app.ui.editor.RemoveKind
import com.rulemix.app.ui.editor.SettleOffset
import com.rulemix.app.ui.graph.CoverEntry
import com.rulemix.app.ui.graph.CoverGraph
import com.rulemix.app.ui.graph.CoverSweep
import com.rulemix.app.ui.graph.Entry
import com.rulemix.app.ui.graph.GhostScale
import com.rulemix.app.ui.theme.RmColor
import com.rulemix.app.ui.theme.RulemixTheme
import com.rulemix.app.domain.buildFromState
import com.rulemix.engine.GraphNode
import com.rulemix.engine.NodeRole
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class MotionFixesTest {
    @get:Rule val compose = createComposeRule()

    private fun scale(v: Float) = Settings.Global.putFloat(
        ApplicationProvider.getApplicationContext<android.content.Context>().contentResolver,
        Settings.Global.ANIMATOR_DURATION_SCALE, v,
    )
    private fun orig(i: Int, rule: Int? = null) = GraphNode("b:spotify:track:$i", NodeRole.ORIGINAL, "spotify:track:$i", 1, rule, listOfNotNull(rule), null, null, i)
    private fun copy(i: Int, k: Int) = GraphNode("r:x:$k", NodeRole.COPY, "spotify:track:$i", 1, 0, listOf(0), null, k, 0)

    private var nodes by mutableStateOf(listOf<GraphNode>())
    private fun pushNodes(n: List<GraphNode>) {
        nodes = n
        androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications()
    }
    private fun show(start: List<GraphNode>) {
        nodes = start
        compose.setContent { RulemixTheme { CoverGraph(nodes, emptyMap(), emptyList()) } }
        compose.mainClock.advanceTimeBy(2000)
    }
    private fun <T> value(key: String, prop: SemanticsPropertyKey<T>): T? =
        compose.onAllNodes(SemanticsMatcher.keyIsDefined(prop), useUnmergedTree = true).fetchSemanticsNodes()
            .firstOrNull { n -> n.children.any { c -> c.config.getOrNull(androidx.compose.ui.semantics.SemanticsProperties.TestTag) == "cover" } && contains(n, key) }
            ?.config?.getOrNull(prop)
    private fun contains(n: androidx.compose.ui.semantics.SemanticsNode, key: String): Boolean = n.config.getOrNull(androidx.compose.ui.semantics.SemanticsProperties.ContentDescription)?.any { key in it } == true ||
        n.children.any { contains(it, key) }
    private fun entries() = compose.onAllNodes(SemanticsMatcher.keyIsDefined(CoverEntry), useUnmergedTree = true).fetchSemanticsNodes().map { it.config[CoverEntry] }

    @Test fun reorderSlidesCoversToTheirNewSlots() {
        scale(1f)
        show(listOf(orig(0), orig(1), orig(2), orig(3)))
        nodes = listOf(orig(1), orig(0), orig(2), orig(3))
        compose.waitForIdle()
        assertTrue(entries().count { it == Entry.REFLOW } == 2)
    }

    @Test fun aNewCopyFliesInWithASweepAndAnOriginalGrowsBack() {
        scale(1f)
        show(listOf(orig(0), orig(1), orig(2)))
        compose.mainClock.autoAdvance = false
        pushNodes(listOf(orig(0), copy(0, 0), orig(1), orig(2), orig(3)))
        compose.mainClock.advanceTimeByFrame()
        compose.mainClock.advanceTimeByFrame()
        val e = entries()
        assertTrue("entries $e", Entry.FLY in e)
        assertTrue("entries $e", Entry.GROW in e)
        val sweeps = compose.onAllNodes(SemanticsMatcher.keyIsDefined(CoverSweep), useUnmergedTree = true).fetchSemanticsNodes().map { it.config[CoverSweep] }
        assertTrue("sweeps $sweeps", sweeps.any { it < 1f })
        compose.mainClock.advanceTimeBy(2000)
        val after = compose.onAllNodes(SemanticsMatcher.keyIsDefined(CoverSweep), useUnmergedTree = true).fetchSemanticsNodes().map { it.config[CoverSweep] }
        assertTrue("after $after", after.all { it == 1f })
    }

    @Test fun aRemovedCoverShrinksInPlaceThenGoes() {
        scale(1f)
        show(listOf(orig(0), orig(1), copy(0, 0)))
        compose.mainClock.autoAdvance = false
        pushNodes(listOf(orig(0), orig(1)))
        compose.mainClock.advanceTimeByFrame()
        compose.mainClock.advanceTimeBy(64)
        val g = compose.onAllNodes(SemanticsMatcher.keyIsDefined(GhostScale), useUnmergedTree = true).fetchSemanticsNodes()
        assertEquals(1, g.size)
        assertTrue(g[0].config[GhostScale] < 1f)
        compose.mainClock.advanceTimeBy(1000)
        assertEquals(0, compose.onAllNodes(SemanticsMatcher.keyIsDefined(GhostScale), useUnmergedTree = true).fetchSemanticsNodes().size)
    }

    @Test fun reducedMotionMovesEverythingInstantly() {
        scale(0f)
        show(listOf(orig(0), orig(1), copy(0, 0)))
        compose.mainClock.autoAdvance = false
        pushNodes(listOf(orig(1), orig(0), copy(0, 1), orig(5)))
        compose.mainClock.advanceTimeByFrame()
        compose.mainClock.advanceTimeByFrame()
        assertTrue(entries().all { it == Entry.NONE })
        assertEquals(0, compose.onAllNodes(SemanticsMatcher.keyIsDefined(GhostScale), useUnmergedTree = true).fetchSemanticsNodes().size)
    }

    @Test fun theSheetRidesTheSheetSpringAndIsInstantWithReducedMotion() {
        scale(1f)
        compose.mainClock.autoAdvance = false
        compose.setContent { RulemixTheme { RmSheet(onDismiss = {}, containerColor = RmColor.surface1) { Text("hi") } } }
        compose.mainClock.advanceTimeByFrame()
        val start = compose.onNodeWithTag("rm-sheet", useUnmergedTree = true).fetchSemanticsNode().config[SheetProgress]
        assertTrue(start < 1f)
        compose.mainClock.advanceTimeBy(1000)
        assertEquals(1f, compose.onNodeWithTag("rm-sheet", useUnmergedTree = true).fetchSemanticsNode().config[SheetProgress])
    }

    @Test fun reducedMotionSheetOpensInstantly() {
        scale(0f)
        compose.mainClock.autoAdvance = false
        compose.setContent { RulemixTheme { RmSheet(onDismiss = {}, containerColor = RmColor.surface1) { Text("hi") } } }
        compose.mainClock.advanceTimeByFrame()
        assertEquals(1f, compose.onNodeWithTag("rm-sheet", useUnmergedTree = true).fetchSemanticsNode().config[SheetProgress])
    }

    @Test fun aCancelledDragSpringsBackFromTheFinger() {
        scale(1f)
        val s = sampleState()
        val editor = object : GraphEditor {
            override fun removeKind(node: GraphNode) = RemoveKind.BENCH
            override fun remove(node: GraphNode) {}
            override fun move(node: GraphNode, target: GraphNode) {}
            override fun moveToSlot(node: GraphNode, slot: Int) {}
            override fun restore(uri: String, index: Int) {}
            override fun resetOrder() {}
        }
        compose.setContent { RulemixTheme { EditableGraph(s, buildFromState(s), editor, editable = true, onTap = {}) } }
        compose.mainClock.advanceTimeBy(2000)
        compose.mainClock.autoAdvance = false
        val tag = "tap-b:spotify:track:a"
        compose.onNodeWithTag(tag).performTouchInput {
            down(center)
            advanceEventTime(1000)
            moveBy(Offset(-300f, -400f)) // far from any target: no drop
            up()
        }
        compose.mainClock.advanceTimeByFrame()
        compose.mainClock.advanceTimeBy(32)
        val mid = compose.onNodeWithTag(tag).fetchSemanticsNode().config[SettleOffset]
        compose.mainClock.advanceTimeBy(1500)
        val end = compose.onNodeWithTag(tag).fetchSemanticsNode().config[SettleOffset]
        assertTrue("mid=$mid", mid < -1f) // still near the finger, springing back
        assertEquals(0f, end)
    }
}
