package com.rulemix.app

import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.rulemix.app.data.MixRule
import com.rulemix.app.domain.buildFromState
import com.rulemix.app.ui.editor.EditableGraph
import com.rulemix.app.ui.editor.EditorStrings
import com.rulemix.app.ui.editor.GraphEditor
import com.rulemix.app.ui.editor.RemoveKind
import com.rulemix.app.ui.theme.RulemixTheme
import com.rulemix.engine.GraphNode
import com.rulemix.engine.NodeRole
import com.rulemix.engine.RuleKind
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class EditableGraphTest {
    @get:Rule val compose = createComposeRule()
    private val calls = mutableListOf<String>()
    private val editor = object : GraphEditor {
        override fun removeKind(node: GraphNode) = when {
            node.role == NodeRole.COPY -> RemoveKind.DELETE_COPY
            node.plays >= 2 -> RemoveKind.DELETE_PLAY
            else -> RemoveKind.BENCH
        }
        override fun remove(node: GraphNode) { calls += "remove ${node.key}" }
        override fun move(node: GraphNode, target: GraphNode) { calls += "move" }
        override fun moveToSlot(node: GraphNode, slot: Int) { calls += "slot" }
        override fun restore(uri: String, index: Int) { calls += "restore $uri" }
        override fun resetOrder() { calls += "reset" }
    }

    private fun labels(tag: String) =
        compose.onNodeWithTag(tag).fetchSemanticsNode().config.getOrNull(androidx.compose.ui.semantics.SemanticsActions.CustomActions)!!

    @Test fun talkBackActionsPerNodeKind() {
        val s = sampleState(rules = listOf(MixRule("e", "l", RuleKind.EVERY_N, 2, 0, "spotify:track:a")))
        val r = buildFromState(s)
        compose.setContent { RulemixTheme { EditableGraph(s, r, editor, editable = true, onTap = {}) } }
        val orig = labels("tap-b:spotify:track:b").map { it.label }
        assertEquals(listOf(EditorStrings.MOVE_TO_BENCH, EditorStrings.MOVE_TO_SLOT), orig)
        val copyKey = r.nodes.first { it.role == NodeRole.COPY }.key
        val copy = labels("tap-$copyKey")
        assertEquals(listOf(EditorStrings.DELETE_COPY), copy.map { it.label })
        compose.runOnIdle { copy[0].action() }
        assertEquals(listOf("remove $copyKey"), calls)
    }

    @Test fun benchClusterOpensTheSheetAndPutsBack() {
        val s = sampleState(bench = listOf("spotify:track:c"), manual = listOf("spotify:track:a", "spotify:track:b", "spotify:track:d"))
        compose.setContent { RulemixTheme { EditableGraph(s, buildFromState(s), editor, editable = true, onTap = {}) } }
        compose.onNodeWithText(EditorStrings.benchCount(1)).performClick()
        compose.onNodeWithTag("put-back-spotify:track:c").performClick()
        compose.onNodeWithTag("reset-order").performClick()
        assertEquals(listOf("restore spotify:track:c", "reset"), calls)
    }

    @Test fun readOnlyHasNoActions() {
        val s = sampleState()
        compose.setContent { RulemixTheme { EditableGraph(s, buildFromState(s), editor, editable = false, onTap = {}) } }
        assertEquals(emptyList<Any>(), labels("tap-b:spotify:track:a"))
    }

    @Test fun theLastOutcomeIsAPoliteLiveRegionForTalkBack() {
        val s = sampleState()
        compose.setContent { RulemixTheme { EditableGraph(s, buildFromState(s), editor, editable = true, onTap = {}, announcement = "Moved to slot 3. Order saved.") } }
        val n = compose.onNodeWithTag("graph-announcer", useUnmergedTree = true).fetchSemanticsNode()
        assertEquals(androidx.compose.ui.semantics.LiveRegionMode.Polite, n.config.getOrNull(androidx.compose.ui.semantics.SemanticsProperties.LiveRegion))
        compose.onNodeWithText("Moved to slot 3. Order saved.", useUnmergedTree = true).assertExists()
    }
}
