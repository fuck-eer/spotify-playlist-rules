package com.rulemix.app

import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import com.rulemix.app.data.TrackMeta
import com.rulemix.app.ui.graph.CoverGraph
import com.rulemix.app.ui.graph.RuleMeta
import com.rulemix.app.ui.theme.RulemixTheme
import com.rulemix.engine.GraphNode
import com.rulemix.engine.NodeRole
import com.rulemix.engine.RuleKind
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class CoverGraphTest {
    @get:Rule val compose = createComposeRule()

    private fun node(i: Int, role: NodeRole = NodeRole.ORIGINAL, plays: Int = 1, rule: Int? = null, rules: List<Int> = listOfNotNull(rule), shifted: Int? = null) =
        GraphNode("${if (role == NodeRole.COPY) "r:x" else "b"}:spotify:track:$i:$i", role, "spotify:track:$i", plays, rule, rules, shifted, if (role == NodeRole.COPY) 1 else null, i)

    private val tracks = (0..5).associate { "spotify:track:$it" to TrackMeta("Song $it", listOf("Kavi")) }
    private val rules = listOf(RuleMeta(RuleKind.EVERY_N, 4), RuleMeta(RuleKind.PIN_FIRST, null), RuleMeta(RuleKind.REPEAT, 3))

    @Test fun ringChipAndContentDescriptionPerNodeKind() {
        val nodes = listOf(
            node(0),
            node(1, NodeRole.COPY, rule = 0),
            node(2, NodeRole.COPY, rule = 0, rules = listOf(0, 1)),
            node(3, plays = 3, rule = 2),
            node(4, NodeRole.COPY, rule = 0, shifted = 1),
        )
        compose.setContent { RulemixTheme { CoverGraph(nodes, tracks, rules, Modifier.width(400.dp)) } }
        compose.onNodeWithContentDescription("Slot 1, Song 0 by Kavi").assertExists()
        compose.onNodeWithContentDescription("Slot 2, Song 1 by Kavi, rule #1 After every 4").assertExists()
        compose.onNodeWithContentDescription("Slot 3, Song 2 by Kavi, rule #1 and #2 After every 4 and Start with").assertExists()
        compose.onNodeWithContentDescription("Slot 4-6, Song 3 by Kavi, rule #3 Repeat x3").assertExists()
        compose.onNodeWithContentDescription("Slot 5, Song 4 by Kavi, rule #1 After every 4, moved from #2").assertExists()
        compose.onAllNodesWithTag("ring-plain").assertCountEquals(1)
        compose.onAllNodesWithTag("ring-rule").assertCountEquals(3)
        compose.onAllNodesWithTag("ring-split").assertCountEquals(1)
        compose.onAllNodesWithTag("chip", useUnmergedTree = true).assertCountEquals(4)
    }

    @Test fun sixHundredNodesComposeOnlyVisibleRows() {
        val nodes = (0 until 600).map { node(it) }
        compose.setContent { RulemixTheme { CoverGraph(nodes, emptyMap(), emptyList(), Modifier.width(360.dp), maxHeight = 560.dp) } }
        compose.onNodeWithTag("cover-graph").assertExists()
        val composed = compose.onAllNodesWithTag("cover").fetchSemanticsNodes().size
        assertTrue("composed $composed covers", composed in 1..60)
    }
}
