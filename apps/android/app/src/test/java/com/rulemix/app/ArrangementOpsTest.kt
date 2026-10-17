package com.rulemix.app

import com.rulemix.app.domain.ArrangementDraft
import com.rulemix.app.domain.ArrangementOps
import com.rulemix.app.domain.RuleEdits
import com.rulemix.app.domain.buildFromState
import com.rulemix.app.data.MixRule
import com.rulemix.engine.NodeRole
import com.rulemix.engine.RuleKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

/** Same table as apps/web/lib/arrangement-ops.test.ts + arrangement-bench-ops.test.ts. */
class ArrangementOpsTest {
    private fun a(manual: List<String>? = null, bench: List<String> = emptyList()) =
        ArrangementDraft(manual, bench, listOf(RuleEdits("x", 0, emptyList()), RuleEdits("y", 0, listOf(2))))

    @Test fun moveOriginal() {
        assertEquals(listOf("b", "c", "a"), ArrangementOps.moveOriginal(listOf("a", "b", "c"), "a", "c"))
        assertEquals(listOf("c", "a", "b"), ArrangementOps.moveOriginal(listOf("a", "b", "c"), "c", "a"))
        assertEquals(listOf("a", "b"), ArrangementOps.moveOriginal(listOf("a", "b"), "a", "zz"))
    }

    @Test fun benchOriginalAppendsAndDropsFromManualOrder() {
        val x = ArrangementOps.benchOriginal(a(), "b")
        assertEquals(listOf("b"), x.bench)
        assertNull(x.manualOrder)
        val m = ArrangementOps.benchOriginal(a(listOf("c", "b", "a"), listOf("z")), "b")
        assertEquals(listOf("z", "b"), m.bench)
        assertEquals(listOf("c", "a"), m.manualOrder)
        assertSame(m, ArrangementOps.benchOriginal(m, "b"))
    }

    @Test fun deleteCopyRecordsOnceSorted() {
        val x = ArrangementOps.deleteCopy(ArrangementOps.deleteCopy(a(), "y", 0), "y", 0)
        assertEquals(listOf(RuleEdits("x", 0, emptyList()), RuleEdits("y", 0, listOf(0, 2))), x.rules)
    }

    @Test fun deleteRepeatPlayCountsDownToAPlainOriginal() {
        assertEquals(RuleEdits("x", 1, emptyList()), ArrangementOps.deleteRepeatPlay(a(), "x").rules[0])
        val s = sampleState(rules = listOf(MixRule("x", "l", RuleKind.REPEAT, 2, 0, "spotify:track:a", removedPlays = 1)))
        val n = buildFromState(s).nodes.first { it.uri == "spotify:track:a" }
        assertEquals(NodeRole.ORIGINAL, n.role)
        assertEquals(1, n.plays)
    }

    @Test fun restoreFromBenchAtStartMiddleEnd() {
        val x = a(bench = listOf("q", "z"))
        val line = listOf("a", "b", "c")
        val r0 = ArrangementOps.restoreFromBench(x, "q", 0, line)
        assertEquals(listOf("z"), r0.bench)
        assertEquals(listOf("q", "a", "b", "c"), r0.manualOrder)
        assertEquals(listOf("a", "b", "q", "c"), ArrangementOps.restoreFromBench(x, "q", 2, line).manualOrder)
        assertEquals(listOf("a", "b", "c", "q"), ArrangementOps.restoreFromBench(x, "q", 99, line).manualOrder)
    }

    @Test fun applyAndDraftRoundTrip() {
        val s = sampleState()
        val d = ArrangementOps.benchOriginal(ArrangementOps.draftOf(s), "spotify:track:c")
        val t = ArrangementOps.apply(s, d)
        assertEquals(listOf("spotify:track:c"), t.arrangement.bench)
        assertEquals(d, ArrangementOps.draftOf(t))
        assertEquals(false, buildFromState(t).nodes.any { it.uri == "spotify:track:c" })
    }
}
