package com.rulemix.engine

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Mirrors packages/rules-engine/src/types.ts 1:1 (same JSON field names). */
@Serializable
enum class RuleKind {
    @SerialName("pin_first") PIN_FIRST,
    @SerialName("every_n") EVERY_N,
    @SerialName("repeat") REPEAT,
}

@Serializable
data class MixRuleInput(
    val id: String,
    val kind: RuleKind,
    val uri: String,
    val n: Int?,
    val removedPlays: Int = 0,
    val deletedCopies: List<Int> = emptyList(),
)

@Serializable
data class SourceTrack(val uri: String, val name: String, val artists: List<String>)

@Serializable
data class BuildInput(
    val source: List<SourceTrack?>,
    val rules: List<MixRuleInput>,
    val keepSourceOrder: Boolean,
    val seed: Long,
    val manualOrder: List<String>? = null,
    val bench: List<String> = emptyList(),
)

@Serializable
enum class NodeRole {
    @SerialName("original") ORIGINAL,
    @SerialName("copy") COPY,
}

@Serializable
data class GraphNode(
    val key: String,
    val role: NodeRole,
    val uri: String,
    val plays: Int,
    val ruleIndex: Int?,
    val ruleIndices: List<Int>,
    val shiftedFrom: Int?,
    val copyIndex: Int?,
    val firstSlot: Int,
)

@Serializable
data class BuildIssue(val kind: String, val ruleIndex: Int) {
    companion object {
        const val RULE_SONG_NOT_IN_SOURCE = "rule_song_not_in_source"
    }
}

@Serializable
data class BuildStats(val total: Int, val rulesApplied: Int, val skippedUnavailable: Int, val benched: Int)

@Serializable
data class BuildResult(
    val uris: List<String>,
    val nodes: List<GraphNode>,
    val issues: List<BuildIssue>,
    val stats: BuildStats,
)

const val MIN_N = 2
const val MAX_N = 10
