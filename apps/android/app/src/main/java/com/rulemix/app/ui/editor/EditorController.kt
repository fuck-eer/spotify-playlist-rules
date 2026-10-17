package com.rulemix.app.ui.editor

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.rulemix.app.data.Api
import com.rulemix.app.data.ApiException
import com.rulemix.app.data.MixRepository
import com.rulemix.app.data.MixRule
import com.rulemix.app.data.MixState
import com.rulemix.app.data.RulesRepository
import com.rulemix.app.data.ArrangementRepository
import com.rulemix.app.data.ArrangementSave
import com.rulemix.app.domain.ArrangementDraft
import com.rulemix.app.domain.ArrangementOps
import com.rulemix.engine.GraphNode
import com.rulemix.engine.NodeRole
import com.rulemix.engine.RuleKind
import com.rulemix.app.domain.safeBuildFromState
import com.rulemix.engine.BuildResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Editor state: the server MixState, built locally; offline = read-only from the cache. */
class EditorController(
    val mixId: String,
    private val repo: MixRepository,
    val api: Api,
    private val scope: CoroutineScope,
    private val rulesRepo: RulesRepository = RulesRepository(api),
    private val arrangements: ArrangementRepository = ArrangementRepository(api),
) {
    /** One-line feedback (snackbar) for arrangement edits. */
    var notice by mutableStateOf<String?>(null)
    /** The last arrangement outcome, kept for TalkBack (the snackbar clears [notice]). */
    var announcement by mutableStateOf<String?>(null)
        private set
    private var announceToggle = false

    /** Announce only confirmed outcomes; a zero-width toggle makes a repeated message re-announce. */
    private fun announce(message: String?) {
        if (message.isNullOrEmpty()) return
        announceToggle = !announceToggle
        announcement = if (announceToggle) message else message + "\u200b"
    }
    private var benchedOnce = false
    var maxRules by mutableStateOf(10)
        private set
    var state by mutableStateOf<MixState?>(null)
        private set
    var result by mutableStateOf<BuildResult?>(null)
        private set
    var offline by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)

    fun load() {
        scope.launch { runCatching { maxRules = rulesRepo.maxRules(mixId) } }
        scope.launch {
            repo.state(mixId).collect {
                offline = it.offline
                if (it.data != null) replace(it.data, cache = false)
                if (it.error != null && it.data == null) error = it.error
            }
        }
    }

    /** Swap in a new state (optimistic edit, 409 server state, reload). */
    fun replace(s: MixState, cache: Boolean = true) {
        state = s
        result = safeBuildFromState(s)
        if (cache) repo.remember(s)
    }

    fun setKeepSourceOrder(on: Boolean) {
        val s = state ?: return
        replace(s.copy(mix = s.mix.copy(keepSourceOrder = on)))
        scope.launch {
            try {
                api.patch("/api/mixes/$mixId", buildJsonObject { put("keepSourceOrder", on) })
            } catch (e: ApiException) {
                replace(s)
                error = e.message
            }
        }
    }

    fun reshuffle() {
        scope.launch {
            try {
                api.post("/api/mixes/$mixId/reshuffle")
                reload()
            } catch (e: ApiException) {
                error = e.message
            }
        }
    }

    suspend fun reload() {
        repo.state(mixId).collect { r -> if (!r.stale && r.data != null) replace(r.data, cache = false) }
    }

    /** Rule changes bump the server's arrangement version (N1); adopt it so our next PUT isn't stale. */
    private suspend fun refreshVersion() {
        runCatching {
            repo.state(mixId).collect { r ->
                if (!r.stale && r.data != null) state?.let { replace(it.copy(arrangement = it.arrangement.copy(version = r.data.arrangement.version))) }
            }
        }
    }

    private fun withRules(f: (List<MixRule>) -> List<MixRule>) {
        val s = state ?: return
        replace(s.copy(rules = f(s.rules)))
    }

    fun addRule(kind: RuleKind, n: Int?, uri: String) {
        scope.launch {
            try {
                val r = rulesRepo.add(mixId, kind, n, uri)
                withRules { it + r }
                refreshVersion()
            } catch (e: ApiException) {
                error = e.message
            }
        }
    }

    /** In place: the rule keeps its priority position (and colour). */
    fun changeRule(id: String, kind: RuleKind, n: Int) {
        scope.launch {
            try {
                val r = rulesRepo.change(mixId, id, kind, n)
                withRules { rs -> rs.map { if (it.id == id) r.copy(songName = r.songName ?: it.songName) else it } }
                refreshVersion()
            } catch (e: ApiException) {
                error = e.message
            }
        }
    }

    fun removeRule(id: String) {
        val before = state ?: return
        withRules { rs -> rs.filter { it.id != id }.mapIndexed { i, r -> r.copy(position = i) } }
        scope.launch {
            try {
                rulesRepo.remove(mixId, id)
                refreshVersion()
            } catch (e: ApiException) {
                replace(before)
                error = e.message
            }
        }
    }

    private val saveLock = Mutex()
    private var confirmed: MixState? = null
    private var pendingSaves = 0
    private var saveEpoch = 0

    /**
     * Optimistic arrangement save, one at a time per Mix (S1): each PUT carries the version the
     * previous one returned. A real 409 swaps in the server state; any failure restores the last
     * confirmed state and drops edits queued behind it.
     */
    private fun commit(f: (ArrangementDraft) -> ArrangementDraft, message: String? = null) {
        val s = state ?: return
        if (pendingSaves == 0) confirmed = s
        val d = f(ArrangementOps.draftOf(s))
        replace(ArrangementOps.apply(s, d))
        if (message != null) notice = message
        pendingSaves++
        val mine = saveEpoch
        scope.launch {
            try {
                saveLock.withLock {
                    val base = confirmed
                    if (mine != saveEpoch || base == null) return@withLock
                    try {
                        when (val r = arrangements.put(mixId, base.arrangement.version, d)) {
                            is ArrangementSave.Saved -> {
                                val done = ArrangementOps.apply(base, d)
                                confirmed = done.copy(arrangement = done.arrangement.copy(version = r.version))
                                state?.let { replace(it.copy(arrangement = it.arrangement.copy(version = r.version))) }
                                announce(message)
                                // The server drops a Repeat rule at 1 play.
                                if (d.rules.any { e -> base.rules.any { it.id == e.id && it.kind == RuleKind.REPEAT && (it.n ?: 2) - e.removedPlays <= 1 } }) reload()
                            }
                            is ArrangementSave.Stale -> {
                                saveEpoch++
                                confirmed = r.state
                                replace(r.state)
                                notice = ArrangementRepository.STALE
                                announce(ArrangementRepository.STALE)
                            }
                        }
                    } catch (e: ApiException) {
                        saveEpoch++
                        replace(base)
                        error = e.message
                        announce(e.message)
                    }
                }
            } finally {
                pendingSaves--
            }
        }
    }

    /** What removing [node] does: bench, delete copy, delete one play; null when refused (Start with copy). */
    fun removeKind(node: GraphNode): RemoveKind? {
        val s = state ?: return null
        return when {
            node.role == NodeRole.COPY -> {
                val r = node.ruleIndex?.let { s.rules.getOrNull(it) } ?: return null
                if (r.kind == RuleKind.PIN_FIRST) null else RemoveKind.DELETE_COPY
            }
            node.plays >= 2 -> RemoveKind.DELETE_PLAY
            else -> RemoveKind.BENCH
        }
    }

    fun remove(node: GraphNode) {
        val s = state ?: return
        when (removeKind(node)) {
            RemoveKind.BENCH -> {
                val msg = if (!benchedOnce) EditorStrings.BENCH_HINT else EditorStrings.BENCHED
                benchedOnce = true
                commit({ ArrangementOps.benchOriginal(it, node.uri) }, msg)
            }
            RemoveKind.DELETE_COPY -> {
                val r = s.rules[node.ruleIndex!!]
                commit({ ArrangementOps.deleteCopy(it, r.id, node.copyIndex ?: 0) }, EditorStrings.COPY_DELETED)
            }
            RemoveKind.DELETE_PLAY -> {
                val r = s.rules.firstOrNull { it.kind == RuleKind.REPEAT && it.trackUri == node.uri } ?: return
                commit({ ArrangementOps.deleteRepeatPlay(it, r.id) }, EditorStrings.PLAY_DELETED)
            }
            null -> notice = EditorStrings.CANT_REMOVE
        }
    }

    /** Moves an Original onto the line position held by [target] (sets a Manual order). */
    fun move(node: GraphNode, target: GraphNode) {
        val nodes = result?.nodes ?: return
        if (node.role != NodeRole.ORIGINAL || target.role != NodeRole.ORIGINAL) return
        val line = ArrangementOps.lineOf(nodes)
        val s = state ?: return
        val order = ArrangementOps.moveOriginal(line, node.uri, target.uri)
        val after = safeBuildFromState(ArrangementOps.apply(s, ArrangementOps.draftOf(s).copy(manualOrder = order)))
        val slot = (after?.nodes?.firstOrNull { it.key == node.key }?.firstSlot ?: 0) + 1
        commit({ it.copy(manualOrder = order) }, EditorStrings.moved(slot))
    }

    /** Move to line slot [slot] (1-based), for TalkBack "Move to slot…". */
    fun moveToSlot(node: GraphNode, slot: Int) {
        val nodes = result?.nodes ?: return
        val line = ArrangementOps.lineOf(nodes)
        val target = line.getOrNull((slot - 1).coerceIn(0, line.size - 1)) ?: return
        nodes.firstOrNull { it.role == NodeRole.ORIGINAL && it.uri == target }?.let { move(node, it) }
    }

    fun restore(uri: String, index: Int = Int.MAX_VALUE) {
        val line = result?.nodes?.let(ArrangementOps::lineOf) ?: return
        commit({ ArrangementOps.restoreFromBench(it, uri, index, line) }, EditorStrings.RESTORED)
    }

    /** Clears the Manual order (back to the rules' order); the Bench stays. */
    fun resetOrder() = commit({ it.copy(manualOrder = null) }, EditorStrings.RESET_DONE)
}

enum class RemoveKind { BENCH, DELETE_COPY, DELETE_PLAY }
