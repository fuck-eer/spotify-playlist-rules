package com.rulemix.app.ui.mixes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.rulemix.app.data.SourceOption
import com.rulemix.app.ui.theme.RmColor
import com.rulemix.app.ui.theme.RmType

object SourcePickerStrings {
    const val TITLE = "Pick a source"
    const val NAME = "Mix name"
    const val NAME_HINT = "Name your mix to pick a source"
    const val LOADING = "Loading your playlists…"
    const val EMPTY = "No playlists yet. Make one in Spotify, then come back."
    fun tooLarge(n: Int) = "This source has $n songs. rulemix handles up to 600."
    fun meta(s: SourceOption) = "${s.trackCount} songs"
}

/** New mix: name + source (as web: the mix is created when the source is picked). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SourcePickerSheet(
    sources: List<SourceOption>?,
    error: String?,
    onPick: (name: String, source: SourceOption) -> Unit,
    onDismiss: () -> Unit,
) {
    var name by remember { mutableStateOf("") }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = RmColor.surface1) {
        Column(Modifier.padding(horizontal = 16.dp)) {
            Text(SourcePickerStrings.TITLE, style = RmType.sheetTitle.copy(color = RmColor.text))
            OutlinedTextField(
                value = name,
                onValueChange = { name = it.take(80) },
                label = { Text(SourcePickerStrings.NAME) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp).testTag("mix-name"),
            )
            if (name.isBlank()) Text(SourcePickerStrings.NAME_HINT, style = RmType.hint.copy(color = RmColor.warning))
            if (error != null) Text(error, style = RmType.hint.copy(color = RmColor.error))
        }
        when {
            sources == null -> Text(SourcePickerStrings.LOADING, Modifier.padding(16.dp), color = RmColor.textMuted)
            sources.isEmpty() -> Text(SourcePickerStrings.EMPTY, Modifier.padding(16.dp), color = RmColor.textMuted)
            else -> LazyColumn(Modifier.padding(bottom = 24.dp)) {
                items(sources, key = { "${it.type}:${it.id}" }) { s ->
                    val enabled = !s.tooLarge && name.isNotBlank()
                    Column(
                        Modifier.fillMaxWidth().clickable(enabled = enabled) { onPick(name.trim(), s) }.padding(horizontal = 16.dp, vertical = 10.dp),
                    ) {
                        Text(s.name, style = RmType.rowTitle.copy(color = if (s.tooLarge) RmColor.textDim else RmColor.text))
                        Text(
                            if (s.tooLarge) SourcePickerStrings.tooLarge(s.trackCount) else SourcePickerStrings.meta(s),
                            style = RmType.hint.copy(color = RmColor.textMuted),
                        )
                    }
                }
            }
        }
    }
}
