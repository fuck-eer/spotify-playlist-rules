package com.rulemix.engine

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class BuildTest {
    private fun t(id: String) = "spotify:track:$id"
    private fun src(vararg ids: String) = ids.map { SourceTrack(t(it), it, listOf("A")) }

    @Test
    fun validationThrowsIllegalArgument() {
        assertThrows<IllegalArgumentException> {
            build(BuildInput(src("A"), listOf(MixRuleInput("r", RuleKind.REPEAT, t("A"), 2, removedPlays = 2)), true, 0))
        }
        assertThrows<IllegalArgumentException> { build(BuildInput(src("A"), emptyList(), true, -1)) }
    }

    @Test
    fun benchKeepsStartWithCopy() {
        val r = build(
            BuildInput(src("A", "B", "C"), listOf(MixRuleInput("p", RuleKind.PIN_FIRST, t("B"), null)), true, 0, bench = listOf(t("B"))),
        )
        assertEquals(listOf("B", "A", "C").map(::t), r.uris)
    }
}
