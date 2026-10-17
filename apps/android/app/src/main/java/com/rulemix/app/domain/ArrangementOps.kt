package com.rulemix.app.domain

import com.rulemix.app.data.MixState
import com.rulemix.engine.GraphNode
import com.rulemix.engine.NodeRole
import kotlinx.serialization.Serializable

/** Kotlin twin of apps/web/lib/arrangement-ops.ts: what PUT /arrangement takes, minus the version. */
@Serializable
data class RuleEdits(val id: String, val removedPlays: Int, val deletedCopies: List<Int>)

@Serializable
data class ArrangementDraft(val manualOrder: List<String>?, val bench: List<String>, val rules: List<RuleEdits>)

object ArrangementOps {
    fun draftOf(s: MixState) = ArrangementDraft(
        s.arrangement.manualOrder,
        s.arrangement.bench,
        s.rules.map { RuleEdits(it.id, it.removedPlays, it.deletedCopies) },
    )

    /** The state with [d] applied (optimistic edit). */
    fun apply(s: MixState, d: ArrangementDraft): MixState = s.copy(
        arrangement = s.arrangement.copy(manualOrder = d.manualOrder, bench = d.bench),
        rules = s.rules.map { r ->
            d.rules.firstOrNull { it.id == r.id }?.let { r.copy(removedPlays = it.removedPlays, deletedCopies = it.deletedCopies) } ?: r
        },
    )

    fun lineOf(nodes: List<GraphNode>): List<String> = nodes.filter { it.role == NodeRole.ORIGINAL }.map { it.uri }

    fun moveOriginal(line: List<String>, from: String, to: String): List<String> {
        val i = line.indexOf(from)
        val j = line.indexOf(to)
        if (i < 0 || j < 0 || i == j) return line.toList()
        val out = line.toMutableList()
        out.removeAt(i)
        out.add(j, from)
        return out
    }

    /** Index into [nodes] of the Original nearest (x, y) within [radius], excluding [draggedKey]; -1 if none. */
    fun pickDropTarget(
        nodes: List<GraphNode>,
        positions: (Int) -> Pair<Float, Float>,
        x: Float,
        y: Float,
        draggedKey: String,
        radius: Float = 70f,
    ): Int {
        var best = -1
        var bestD = radius * radius
        nodes.forEachIndexed { i, n ->
            if (n.role != NodeRole.ORIGINAL || n.key == draggedKey) return@forEachIndexed
            val (px, py) = positions(i)
            val d = (px - x) * (px - x) + (py - y) * (py - y)
            if (d <= bestD) {
                bestD = d
                best = i
            }
        }
        return best
    }

    private fun withRule(a: ArrangementDraft, id: String, f: (RuleEdits) -> RuleEdits) =
        a.copy(rules = a.rules.map { if (it.id == id) f(it) else it })

    fun benchOriginal(a: ArrangementDraft, uri: String): ArrangementDraft =
        if (uri in a.bench) a else a.copy(bench = a.bench + uri, manualOrder = a.manualOrder?.filter { it != uri })

    fun deleteCopy(a: ArrangementDraft, ruleId: String, k: Int) =
        withRule(a, ruleId) { r -> if (k in r.deletedCopies) r else r.copy(deletedCopies = (r.deletedCopies + k).sorted()) }

    fun deleteRepeatPlay(a: ArrangementDraft, ruleId: String) =
        withRule(a, ruleId) { it.copy(removedPlays = it.removedPlays + 1) }

    fun restoreFromBench(a: ArrangementDraft, uri: String, index: Int, line: List<String>): ArrangementDraft {
        val rest = line.filter { it != uri }
        val i = index.coerceIn(0, rest.size)
        return a.copy(bench = a.bench.filter { it != uri }, manualOrder = rest.take(i) + uri + rest.drop(i))
    }
}
