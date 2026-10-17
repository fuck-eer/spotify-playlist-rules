package com.rulemix.app.ui.graph

import com.rulemix.app.data.TrackMeta
import com.rulemix.engine.GraphNode
import com.rulemix.engine.RuleKind

/** Same strings as web `components/graph/labels.ts`. */
data class RuleMeta(val kind: RuleKind, val n: Int?)

fun ruleName(r: RuleMeta): String = when (r.kind) {
    RuleKind.PIN_FIRST -> "Start with"
    RuleKind.EVERY_N -> "After every ${r.n}"
    RuleKind.REPEAT -> "Repeat x${r.n}"
}

fun slotLabel(node: GraphNode): String {
    val first = node.firstSlot + 1
    return if (node.plays > 1) "$first-${first + node.plays - 1}" else "$first"
}

fun coverLabel(node: GraphNode, track: TrackMeta?, rules: List<RuleMeta>): String {
    val song = if (track != null) "${track.name} by ${track.artists.joinToString(", ")}" else "Unknown song"
    val base = "Slot ${slotLabel(node)}, $song"
    if (node.ruleIndex == null) return base
    val names = node.ruleIndices.mapNotNull { rules.getOrNull(it) }.map(::ruleName)
    val nums = node.ruleIndices.joinToString(" and ") { "#${it + 1}" }
    val label = "$base, rule $nums ${names.joinToString(" and ")}"
    return if (node.shiftedFrom == null) label else "$label, moved from #${node.shiftedFrom!! + 1}"
}

fun summaryText(total: Int, ruleCount: Int, manual: Boolean): String {
    val s = "$total ${if (total == 1) "song" else "songs"} · $ruleCount ${if (ruleCount == 1) "rule" else "rules"}"
    return if (manual) "$s · your order" else s
}
