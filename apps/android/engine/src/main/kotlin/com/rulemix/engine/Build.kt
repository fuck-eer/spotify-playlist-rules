package com.rulemix.engine

private const val TRACK_PREFIX = "spotify:track:"

private fun assertValid(input: BuildInput) {
    require(input.seed in 0L..0xffffffffL) { "seed must be an integer in [0, 2^32), got ${input.seed}" }
    val ids = HashSet<String>()
    input.rules.forEachIndexed { i, rule ->
        require(ids.add(rule.id)) { "rules[$i]: duplicate rule id ${rule.id}" }
        if (rule.kind == RuleKind.PIN_FIRST) {
            require(rule.n == null) { "rules[$i]: pin_first requires n = null" }
        } else {
            require(rule.n != null && rule.n in MIN_N..MAX_N) {
                "rules[$i]: ${rule.kind} requires an integer n in [$MIN_N, $MAX_N]"
            }
        }
        require(rule.removedPlays >= 0) { "rules[$i]: removedPlays must be an integer >= 0" }
        if (rule.kind == RuleKind.REPEAT) {
            require(rule.removedPlays < (rule.n ?: 0)) { "rules[$i]: removedPlays must be < n" }
        } else {
            require(rule.removedPlays == 0) { "rules[$i]: removedPlays must be 0 for ${rule.kind}" }
        }
        require(rule.deletedCopies.all { it >= 0 }) { "rules[$i]: deletedCopies must be integers >= 0" }
    }
}

private class Draft(
    val key: String,
    val role: NodeRole,
    val uri: String,
    val plays: Int,
    val ruleIndex: Int?,
    val ruleIndices: MutableList<Int>,
    val shiftedFrom: Int?,
    val copyIndex: Int?,
)

private fun findFreeSlot(slots: Array<Draft?>, p: Int): Int {
    for (q in p + 1 until slots.size) if (slots[q] == null) return q
    for (q in p - 1 downTo 0) if (slots[q] == null) return q
    error("no free slot: slot accounting is inconsistent")
}

private fun copyCount(rule: MixRuleInput, b: Int): Int = when (rule.kind) {
    RuleKind.PIN_FIRST -> 1
    RuleKind.EVERY_N -> maxOf(1, b / (rule.n ?: 1)) // ADR-0019
    RuleKind.REPEAT -> 0
}

/** Kotlin port of the v2 engine (docs/spec-v2.md "Engine v2", steps 1–7). */
fun build(input: BuildInput): BuildResult {
    assertValid(input)

    // 1. available, de-duplicated by first occurrence.
    val available = ArrayList<String>()
    val seen = HashSet<String>()
    var skippedUnavailable = 0
    for (item in input.source) {
        if (item == null || !item.uri.startsWith(TRACK_PREFIX)) skippedUnavailable++
        else if (seen.add(item.uri)) available.add(item.uri)
    }

    // 2. line.
    val ordered: List<String> = if (input.manualOrder != null) {
        val picked = LinkedHashSet<String>()
        for (uri in input.manualOrder) if (uri in seen) picked.add(uri)
        picked.toList() + available.filter { it !in picked }
    } else if (input.keepSourceOrder) available else seededShuffle(available, input.seed)
    val bench = input.bench.toHashSet()
    val line = ordered.filter { it !in bench }
    val onLine = line.toHashSet()
    val benched = ordered.size - line.size

    // 3. slot counts.
    val b = line.size
    val counts = input.rules.map { copyCount(it, b) }
    val total = b + counts.sum()

    val issues = ArrayList<BuildIssue>()
    var rulesApplied = 0
    input.rules.forEachIndexed { i, rule ->
        if (rule.kind == RuleKind.REPEAT) {
            if (rule.uri in onLine) rulesApplied++
            else issues.add(BuildIssue(BuildIssue.RULE_SONG_NOT_IN_SOURCE, i))
        } else {
            rulesApplied++
            if (rule.uri !in seen) issues.add(BuildIssue(BuildIssue.RULE_SONG_NOT_IN_SOURCE, i))
        }
    }

    // 4. claim rule slots.
    val slots = arrayOfNulls<Draft>(total)
    input.rules.forEachIndexed { ruleIndex, rule ->
        if (rule.kind == RuleKind.REPEAT) return@forEachIndexed
        val positions = if (rule.kind == RuleKind.PIN_FIRST) listOf(0)
        else List(counts[ruleIndex]) { minOf((it + 1) * ((rule.n ?: 0) + 1) - 1, total - 1) }
        positions.forEachIndexed { i, p ->
            val copyIndex = if (rule.kind == RuleKind.PIN_FIRST) 0 else i + 1
            fun node(shiftedFrom: Int?) = Draft(
                "r:${rule.id}:$copyIndex", NodeRole.COPY, rule.uri, 1, ruleIndex,
                mutableListOf(ruleIndex), shiftedFrom, copyIndex,
            )
            val taken = slots[p]
            if (taken == null) slots[p] = node(null)
            else if (rule.kind == RuleKind.EVERY_N && taken.uri == rule.uri && ruleIndex !in taken.ruleIndices) {
                taken.ruleIndices.add(ruleIndex) // ADR-0020 merge
            } else slots[findFreeSlot(slots, p)] = node(p)
        }
    }

    // 5. fill with the line.
    val repeatFor = HashMap<String, Int>()
    input.rules.forEachIndexed { i, r -> if (r.kind == RuleKind.REPEAT && r.uri !in repeatFor) repeatFor[r.uri] = i }
    var next = 0
    val drafts = ArrayList<Draft>()
    for (slot in slots) {
        if (slot != null) drafts.add(slot)
        else if (next < b) {
            val uri = line[next++]
            val ri = repeatFor[uri]
            val rule = ri?.let { input.rules[it] }
            val plays = if (rule != null) maxOf(1, (rule.n ?: 1) - rule.removedPlays) else 1
            val stack = plays >= 2 && ri != null
            drafts.add(
                Draft(
                    "b:$uri", NodeRole.ORIGINAL, uri, plays, if (stack) ri else null,
                    if (stack) mutableListOf(ri!!) else mutableListOf(), null, null,
                ),
            )
        }
    }

    // 6. remove deleted copies.
    val deleted = HashSet<String>()
    for (r in input.rules) for (c in r.deletedCopies) deleted.add("r:${r.id}:$c")
    val kept = drafts.filter { it.key !in deleted }

    // 7. expand plays.
    val nodes = ArrayList<GraphNode>()
    val uris = ArrayList<String>()
    for (d in kept) {
        nodes.add(GraphNode(d.key, d.role, d.uri, d.plays, d.ruleIndex, d.ruleIndices.toList(), d.shiftedFrom, d.copyIndex, uris.size))
        repeat(d.plays) { uris.add(d.uri) }
    }
    return BuildResult(uris, nodes, issues, BuildStats(uris.size, rulesApplied, skippedUnavailable, benched))
}
