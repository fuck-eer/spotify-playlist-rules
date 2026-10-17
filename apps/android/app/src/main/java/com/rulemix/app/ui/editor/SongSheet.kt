package com.rulemix.app.ui.editor

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.rulemix.app.data.MixRule
import com.rulemix.app.data.TrackMeta
import com.rulemix.app.ui.graph.RuleMeta
import com.rulemix.app.ui.graph.placeholderBrush
import com.rulemix.app.ui.graph.ruleName
import com.rulemix.app.ui.theme.RmColor
import com.rulemix.app.ui.theme.RmType
import com.rulemix.app.ui.theme.ruleColor
import com.rulemix.engine.MAX_N
import com.rulemix.engine.MIN_N
import com.rulemix.engine.RuleKind

object SongSheetStrings {
    const val START_WITH = "Start with"
    const val EVERY_N = "After every N"
    const val REPEAT = "Repeat"
    const val EVERY_PROMPT = "Every how many songs?"
    const val REPEAT_PROMPT = "How many times?"
    const val ADD = "Add"
    const val SAVE = "Save"
    const val CHANGE = "Change"
    const val REMOVE = "Remove"
    const val DECREASE = "Decrease"
    const val INCREASE = "Increase"
    const val OPEN = "Open in Spotify"
    const val EVERY_DEFAULT = 4
    const val REPEAT_DEFAULT = 2
    fun cap(max: Int) = "Up to $max rules per mix."
}

private data class Stepper(val kind: RuleKind, val n: Int, val replace: String?)

/** Song bottom sheet (interaction-spec §3): rules on this song, add paths, Open in Spotify. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SongSheet(
    uri: String,
    track: TrackMeta?,
    songRules: List<Pair<Int, MixRule>>,
    ruleCount: Int,
    maxRules: Int,
    onAdd: (RuleKind, Int?) -> Unit,
    onChange: (String, RuleKind, Int) -> Unit,
    onRemove: (String) -> Unit,
    onDismiss: () -> Unit,
    footer: @Composable () -> Unit = {},
) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = RmColor.surface2) {
        SongSheetContent(uri, track, songRules, ruleCount, maxRules, onAdd, onChange, onRemove, footer)
    }
}

@Composable
fun SongSheetContent(
    uri: String,
    track: TrackMeta?,
    songRules: List<Pair<Int, MixRule>>,
    ruleCount: Int,
    maxRules: Int,
    onAdd: (RuleKind, Int?) -> Unit,
    onChange: (String, RuleKind, Int) -> Unit,
    onRemove: (String) -> Unit,
    footer: @Composable () -> Unit = {},
) {
    val ctx = LocalContext.current
    var stepper by remember { mutableStateOf<Stepper?>(null) }
    val full = ruleCount >= maxRules
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 32.dp).testTag("song-sheet")) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(56.dp).clip(CircleShape).background(placeholderBrush(uri))) {
                if (track?.imageUrl != null) AsyncImage(track.imageUrl, null, Modifier.size(56.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(track?.name ?: "Unknown song", style = RmType.rowTitle.copy(color = RmColor.text))
                Text(track?.artists?.joinToString(", ") ?: "", style = RmType.hint.copy(color = RmColor.textMuted))
            }
        }
        songRules.forEach { (i, r) ->
            Row(Modifier.fillMaxWidth().padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(10.dp).clip(CircleShape).background(ruleColor(i)))
                Spacer(Modifier.width(8.dp))
                Text("#${i + 1} ${ruleName(RuleMeta(r.kind, r.n))}", style = RmType.body.copy(color = RmColor.text), modifier = Modifier.weight(1f))
                if (r.kind != RuleKind.PIN_FIRST) {
                    TextButton(onClick = { stepper = Stepper(r.kind, r.n ?: 2, r.id) }) { Text(SongSheetStrings.CHANGE) }
                }
                TextButton(onClick = { onRemove(r.id) }) { Text(SongSheetStrings.REMOVE) }
            }
        }
        Row(Modifier.padding(top = 16.dp)) {
            listOf(
                SongSheetStrings.START_WITH to { onAdd(RuleKind.PIN_FIRST, null) },
                SongSheetStrings.EVERY_N to { stepper = Stepper(RuleKind.EVERY_N, SongSheetStrings.EVERY_DEFAULT, null) },
                SongSheetStrings.REPEAT to { stepper = Stepper(RuleKind.REPEAT, SongSheetStrings.REPEAT_DEFAULT, null) },
            ).forEach { (label, action) ->
                FilledTonalButton(onClick = action, enabled = !full, modifier = Modifier.padding(end = 8.dp)) { Text(label) }
            }
        }
        if (full) Text(SongSheetStrings.cap(maxRules), style = RmType.hint.copy(color = RmColor.textDim), modifier = Modifier.padding(top = 6.dp))
        val st = stepper
        AnimatedVisibility(st != null) {
            if (st != null) {
                Row(Modifier.fillMaxWidth().padding(top = 12.dp).testTag("stepper"), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        if (st.kind == RuleKind.EVERY_N) SongSheetStrings.EVERY_PROMPT else SongSheetStrings.REPEAT_PROMPT,
                        style = RmType.body.copy(color = RmColor.text),
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onClick = { stepper = st.copy(n = st.n - 1) }, enabled = st.n > MIN_N) {
                        Icon(Icons.Filled.Remove, contentDescription = SongSheetStrings.DECREASE)
                    }
                    Text("${st.n}", style = RmType.rowTitle.copy(color = RmColor.text), modifier = Modifier.testTag("stepper-value"))
                    IconButton(onClick = { stepper = st.copy(n = st.n + 1) }, enabled = st.n < MAX_N) {
                        Icon(Icons.Filled.Add, contentDescription = SongSheetStrings.INCREASE)
                    }
                    Button(
                        onClick = {
                            if (st.replace != null) onChange(st.replace, st.kind, st.n) else onAdd(st.kind, st.n)
                            stepper = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = RmColor.text, contentColor = RmColor.bg),
                        shape = RoundedCornerShape(999.dp),
                    ) { Text(if (st.replace != null) SongSheetStrings.SAVE else SongSheetStrings.ADD) }
                }
            }
        }
        footer()
        TextButton(
            onClick = {
                val id = uri.substringAfterLast(":")
                ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://open.spotify.com/track/$id")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            },
            modifier = Modifier.padding(top = 8.dp),
        ) { Text(SongSheetStrings.OPEN) }
    }
}
