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
import com.rulemix.engine.RuleKind
import com.rulemix.app.domain.buildFromState
import com.rulemix.engine.BuildResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Editor state: the server MixState, built locally; offline = read-only from the cache. */
class EditorController(
    val mixId: String,
    private val repo: MixRepository,
    val api: Api,
    private val scope: CoroutineScope,
    private val rulesRepo: RulesRepository = RulesRepository(api),
) {
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
        result = buildFromState(s)
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

    private fun withRules(f: (List<MixRule>) -> List<MixRule>) {
        val s = state ?: return
        replace(s.copy(rules = f(s.rules)))
    }

    fun addRule(kind: RuleKind, n: Int?, uri: String) {
        scope.launch {
            try {
                val r = rulesRepo.add(mixId, kind, n, uri)
                withRules { it + r }
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
            } catch (e: ApiException) {
                replace(before)
                error = e.message
            }
        }
    }
}
