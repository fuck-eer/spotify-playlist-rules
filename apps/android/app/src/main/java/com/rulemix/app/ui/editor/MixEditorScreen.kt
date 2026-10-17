package com.rulemix.app.ui.editor

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.rulemix.app.data.MixState
import com.rulemix.app.ui.graph.CoverGraph
import com.rulemix.app.ui.graph.RuleMeta
import com.rulemix.app.ui.graph.ruleName
import com.rulemix.app.ui.graph.summaryText
import com.rulemix.app.ui.mixes.OfflineBanner
import com.rulemix.app.ui.theme.RmColor
import com.rulemix.app.ui.theme.RmType
import com.rulemix.app.ui.theme.ruleColor
import com.rulemix.engine.BuildResult
import com.rulemix.engine.GraphNode

object EditorStrings {
    const val SOURCE = "SOURCE"
    const val PREVIEW = "PREVIEW"
    const val RULES = "RULES"
    const val OPTIONS = "OPTIONS"
    const val KEEP = "Keep base order"
    const val RESHUFFLE = "Reshuffle"
    const val PLAY = "Play"
    const val HINT = "Tap a song for rules. Drag to move, bench or delete."
    const val NO_RULES = "No rules yet. Without one, you just get a copy."
    const val REMOVE = "Remove"
    const val LOADING = "Building the preview…"
    const val BUILD_FAILED = "This mix couldn't be built. Try reloading."
    fun moved(k: Int) = "Moved to slot $k. Order saved."
    const val BENCH_HINT = "Moved to the bench. Benched songs stay out of the mix until you put them back."
    const val BENCHED = "Moved to the bench."
    const val COPY_DELETED = "Copy deleted."
    const val PLAY_DELETED = "One play removed."
    const val CANT_REMOVE = "Start-with songs can't be removed. Delete the rule instead."
    const val RESTORED = "Put back."
    const val RESET_DONE = "Order reset."
    const val RESET = "Reset order"
    const val MOVE_TO_BENCH = "Move to bench"
    const val DELETE_COPY = "Delete this copy"
    const val MOVE_TO_SLOT = "Move to slot…"
    const val REMOVE_PLAY = "Remove one play"
    const val SLOT_TITLE = "Move to slot"
    const val MOVE = "Move"
    const val CANCEL = "Cancel"
    const val PUT_BACK = "Put back at the end"
    fun benchCount(n: Int) = if (n == 1) "1 song on the bench" else "$n songs on the bench"
    fun sourceCard(name: String, songs: Int) = "$name · $songs songs"
}

/** The editor: name, source card, PREVIEW graph, RULES, OPTIONS and the bottom bar. */
@Composable
fun MixEditorScreen(
    state: MixState?,
    result: BuildResult?,
    offline: Boolean,
    onBack: () -> Unit,
    snackbar: SnackbarHostState = remember { SnackbarHostState() },
    onTap: (GraphNode) -> Unit = {},
    onRemoveRule: (String) -> Unit = {},
    onKeepSourceOrder: (Boolean) -> Unit = {},
    onReshuffle: () -> Unit = {},
    onPlay: () -> Unit = {},
    graph: @Composable (MixState, BuildResult) -> Unit = { s, r -> DefaultGraph(s, r, onTap) },
    extraRules: @Composable () -> Unit = {},
) {
    val editable = !offline
    Scaffold(
        containerColor = RmColor.bg,
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            Row(Modifier.fillMaxWidth().background(RmColor.surface1).padding(12.dp), horizontalArrangement = Arrangement.End) {
                Button(
                    onClick = onPlay,
                    enabled = editable && state != null,
                    shape = RoundedCornerShape(999.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = RmColor.play, contentColor = RmColor.onPlay),
                    modifier = Modifier.testTag("play"),
                ) { Text(EditorStrings.PLAY, style = RmType.rowTitle) }
            }
        },
    ) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).verticalScroll(rememberScrollState())) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = RmColor.text) }
                Text(state?.mix?.name ?: "", style = RmType.title.copy(color = RmColor.text))
            }
            if (offline) OfflineBanner()
            if (state == null || result == null) {
                Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text(if (state != null) EditorStrings.BUILD_FAILED else EditorStrings.LOADING, color = RmColor.textMuted)
                }
            } else {
            Section(EditorStrings.SOURCE)
            Text(
                EditorStrings.sourceCard(state.mix.source.name, state.source.count { it != null }),
                style = RmType.rowTitle.copy(color = RmColor.text),
                modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth().background(RmColor.surface1, RoundedCornerShape(10.dp)).padding(12.dp),
            )
            Section(EditorStrings.PREVIEW)
            Text(
                summaryText(result.stats.total, state.rules.size, state.arrangement.manualOrder != null),
                style = RmType.hint.copy(color = RmColor.textMuted),
                modifier = Modifier.padding(horizontal = 16.dp).testTag("summary"),
            )
            Text(EditorStrings.HINT, style = RmType.hint.copy(color = RmColor.textDim), modifier = Modifier.padding(horizontal = 16.dp))
            Box(Modifier.padding(horizontal = 8.dp, vertical = 8.dp).background(RmColor.surface1, RoundedCornerShape(10.dp))) {
                graph(state, result)
            }
            Section(EditorStrings.RULES)
            if (state.rules.isEmpty()) {
                Text(EditorStrings.NO_RULES, style = RmType.body.copy(color = RmColor.textMuted), modifier = Modifier.padding(horizontal = 16.dp))
            }
            RulesSection(state, editable, onRemoveRule)
            extraRules()
            Section(EditorStrings.OPTIONS)
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(EditorStrings.KEEP, style = RmType.body.copy(color = RmColor.text), modifier = Modifier.weight(1f))
                Switch(checked = state.mix.keepSourceOrder, onCheckedChange = onKeepSourceOrder, enabled = editable, modifier = Modifier.testTag("keep-order"))
            }
            if (!state.mix.keepSourceOrder) {
                TextButton(onClick = onReshuffle, enabled = editable, modifier = Modifier.padding(horizontal = 8.dp)) { Text(EditorStrings.RESHUFFLE) }
            }
            Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
fun DefaultGraph(state: MixState, result: BuildResult, onTap: (GraphNode) -> Unit) {
    CoverGraph(
        nodes = result.nodes,
        tracks = state.tracks,
        rules = state.rules.map { RuleMeta(it.kind, it.n) },
        cover = { node, _, content ->
            Box(Modifier.testTag("tap-${node.key}").then(Modifier.clickableNoRipple { onTap(node) })) { content() }
        },
    )
}

@Composable
private fun Section(label: String) {
    Text(label, style = RmType.label.copy(color = RmColor.textDim), modifier = Modifier.padding(start = 16.dp, top = 20.dp, bottom = 6.dp))
}
