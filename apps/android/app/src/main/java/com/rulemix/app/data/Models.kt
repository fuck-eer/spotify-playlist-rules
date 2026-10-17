package com.rulemix.app.data

import com.rulemix.engine.RuleKind
import com.rulemix.engine.SourceTrack
import kotlinx.serialization.Serializable

/** JSON twins of the web API types (MixRow, MixRuleRow, MixState, SourceOption). */
@Serializable
data class MixSource(val type: String, val id: String? = null, val name: String)

@Serializable
data class Mix(
    val id: String,
    val name: String,
    val source: MixSource,
    val keepSourceOrder: Boolean,
    val shuffleSeed: Long,
    val targetPlaylistId: String? = null,
    val lastSavedAt: String? = null,
    val ruleCount: Int = 0,
    val createdAt: String = "",
    val updatedAt: String = "",
)

@Serializable
data class MixRule(
    val id: String,
    val ruleId: String,
    val kind: RuleKind,
    val n: Int? = null,
    val position: Int,
    val trackUri: String,
    val songName: String? = null,
    val removedPlays: Int = 0,
    val deletedCopies: List<Int> = emptyList(),
)

@Serializable
data class TrackMeta(val name: String, val artists: List<String>, val imageUrl: String? = null)

@Serializable
data class Arrangement(val manualOrder: List<String>? = null, val bench: List<String> = emptyList(), val version: Int = 0)

@Serializable
data class MixState(
    val mix: Mix,
    val rules: List<MixRule>,
    val source: List<SourceTrack?>,
    val tracks: Map<String, TrackMeta>,
    val arrangement: Arrangement,
)

@Serializable
data class SourceOption(
    val type: String,
    val id: String? = null,
    val name: String,
    val trackCount: Int,
    val imageUrl: String? = null,
    val ownerName: String = "",
    val tooLarge: Boolean = false,
)

@Serializable
data class SourcesResponse(val sources: List<SourceOption>, val maxSourceTracks: Int = 600)

/** A value that may come from the offline cache. */
data class CachedResult<T>(
    val data: T?,
    /** true when [data] is the cached copy, not a fresh fetch. */
    val stale: Boolean,
    /** true when the last fetch failed because there is no connection. */
    val offline: Boolean = false,
    val error: String? = null,
)
