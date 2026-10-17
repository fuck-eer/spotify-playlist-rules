package com.rulemix.app.ui.editor

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.rulemix.app.data.MixState
import com.rulemix.app.ui.graph.RuleMeta
import com.rulemix.app.ui.graph.ruleName
import com.rulemix.app.ui.theme.RmColor
import com.rulemix.app.ui.theme.RmType
import com.rulemix.app.ui.theme.ruleColor

/** RULES: one row per Mix rule in priority order (#n chip in the rule colour). */
@Composable
fun RulesSection(state: MixState, editable: Boolean, onRemove: (String) -> Unit) {
            state.rules.forEachIndexed { i, r ->
                val song = r.songName ?: state.tracks[r.trackUri]?.name ?: "Unknown song"
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp).testTag("rule-row"), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.background(ruleColor(i), RoundedCornerShape(999.dp)).padding(horizontal = 6.dp)) {
                        Text("#${i + 1}", style = RmType.slot.copy(color = RmColor.onPlay))
                    }
                    Spacer(Modifier.padding(4.dp))
                    Column(Modifier.weight(1f)) {
                        Text(ruleName(RuleMeta(r.kind, r.n)), style = RmType.rowTitle.copy(color = RmColor.text))
                        Text(song, style = RmType.hint.copy(color = RmColor.textMuted))
                    }
                    TextButton(onClick = { onRemove(r.id) }, enabled = editable) { Text(EditorStrings.REMOVE) }
                }
            }
}
