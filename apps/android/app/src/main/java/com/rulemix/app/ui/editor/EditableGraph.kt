package com.rulemix.app.ui.editor

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import com.rulemix.app.ui.motion.Motion
import com.rulemix.app.ui.motion.motionSpec
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.foundation.layout.size
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import androidx.compose.animation.core.VectorConverter
import kotlinx.coroutines.launch
import com.rulemix.app.data.MixState
import com.rulemix.app.domain.ArrangementOps
import com.rulemix.app.ui.graph.CoverGraph
import com.rulemix.app.ui.graph.RuleMeta
import com.rulemix.app.ui.graph.posOf
import com.rulemix.app.ui.theme.RmColor
import com.rulemix.app.ui.theme.RmType
import com.rulemix.engine.BuildResult
import com.rulemix.engine.GraphNode
import com.rulemix.engine.NodeRole

/** Test hook: the cover's current finger/settle translation (x, px). */
val SettleOffset = androidx.compose.ui.semantics.SemanticsPropertyKey<Float>("SettleOffset")
var androidx.compose.ui.semantics.SemanticsPropertyReceiver.settleOffset by SettleOffset

/** What the editable graph can ask of the editor. */
interface GraphEditor {
    fun removeKind(node: GraphNode): RemoveKind?
    fun remove(node: GraphNode)
    fun move(node: GraphNode, target: GraphNode)
    fun moveToSlot(node: GraphNode, slot: Int)
    fun restore(uri: String, index: Int = Int.MAX_VALUE)
    fun resetOrder()
}

fun EditorController.asGraphEditor(): GraphEditor = object : GraphEditor {
    override fun removeKind(node: GraphNode) = this@asGraphEditor.removeKind(node)
    override fun remove(node: GraphNode) = this@asGraphEditor.remove(node)
    override fun move(node: GraphNode, target: GraphNode) = this@asGraphEditor.move(node, target)
    override fun moveToSlot(node: GraphNode, slot: Int) = this@asGraphEditor.moveToSlot(node, slot)
    override fun restore(uri: String, index: Int) = this@asGraphEditor.restore(uri, index)
    override fun resetOrder() = this@asGraphEditor.resetOrder()
}

/** Graph with tap, long-press drag to reorder, TalkBack actions, Bench cluster and Reset. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditableGraph(
    state: MixState,
    result: BuildResult,
    editor: GraphEditor,
    editable: Boolean,
    onTap: (GraphNode) -> Unit,
    onAskSlot: (GraphNode) -> Unit = {},
    /** Last arrangement outcome, announced to TalkBack (polite live region only; no deprecated announceForAccessibility). */
    announcement: String? = null,
) {
    val haptics = LocalHapticFeedback.current
    val density = LocalDensity.current
    var cols by remember { mutableIntStateOf(3) }
    var dragging by remember { mutableStateOf<String?>(null) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    var benchOpen by remember { mutableStateOf(false) }
    val reduced = com.rulemix.app.ui.motion.reducedMotion()
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    /** Drop settle / cancel (#10, #11): the cover springs from the finger to its slot. */
    val settle = remember { androidx.compose.runtime.mutableStateMapOf<String, androidx.compose.animation.core.Animatable<Offset, androidx.compose.animation.core.AnimationVector2D>>() }
    fun settleFrom(key: String, from: Offset) {
        if (reduced || from == Offset.Zero) return
        val a = androidx.compose.animation.core.Animatable(from, Offset.VectorConverter)
        settle[key] = a
        scope.launch {
            a.animateTo(Offset.Zero, androidx.compose.animation.core.spring(dampingRatio = 0.82f, stiffness = 600f, visibilityThreshold = Offset(0.5f, 0.5f)))
            if (settle[key] === a) settle.remove(key)
        }
    }
    val lineSize = ArrangementOps.lineOf(result.nodes).size
    Column {
        Text(
            announcement ?: "",
            modifier = Modifier.size(1.dp).testTag("graph-announcer").semantics {
                liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite
            },
            color = androidx.compose.ui.graphics.Color.Transparent,
        )
        if (state.arrangement.manualOrder != null && editable) {
            TextButton(onClick = editor::resetOrder, modifier = Modifier.testTag("reset-order")) { Text(EditorStrings.RESET) }
        }
        CoverGraph(
            nodes = result.nodes,
            tracks = state.tracks,
            rules = state.rules.map { RuleMeta(it.kind, it.n) },
            onCols = { cols = it },
            cover = { node, index, content ->
                val kind = if (editable) editor.removeKind(node) else null
                val actions = buildList {
                    when (kind) {
                        RemoveKind.BENCH -> add(CustomAccessibilityAction(EditorStrings.MOVE_TO_BENCH) { editor.remove(node); true })
                        RemoveKind.DELETE_PLAY -> add(CustomAccessibilityAction(EditorStrings.REMOVE_PLAY) { editor.remove(node); true })
                        RemoveKind.DELETE_COPY -> add(CustomAccessibilityAction(EditorStrings.DELETE_COPY) { editor.remove(node); true })
                        null -> {}
                    }
                    if (editable && node.role == NodeRole.ORIGINAL && lineSize > 1) {
                        add(CustomAccessibilityAction(EditorStrings.MOVE_TO_SLOT) { onAskSlot(node); true })
                    }
                }
                val isDragged = dragging == node.key
                val lift by animateFloatAsState(if (isDragged) 1.14f else 1f, motionSpec(Motion.snap), label = "lift")
                Box(
                    Modifier
                        .testTag("tap-${node.key}")
                        .zIndex(if (isDragged) 1f else 0f)
                        .graphicsLayer {
                            scaleX = lift
                            scaleY = lift
                            val t = if (isDragged) offset else settle[node.key]?.value ?: Offset.Zero
                            translationX = t.x
                            translationY = t.y
                        }
                        .semantics {
                            customActions = actions
                            settleOffset = (if (isDragged) offset else settle[node.key]?.value ?: Offset.Zero).x
                        }
                        .then(Modifier.clickableNoRipple { onTap(node) })
                        .then(
                            if (editable && node.role == NodeRole.ORIGINAL) {
                                Modifier.pointerInput(node.key, result) {
                                    detectDragGesturesAfterLongPress(
                                        onDragStart = {
                                            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                            dragging = node.key
                                            offset = Offset.Zero
                                        },
                                        onDrag = { ch, d -> ch.consume(); offset += d },
                                        onDragCancel = {
                                            settleFrom(node.key, offset)
                                            dragging = null
                                        },
                                        onDragEnd = {
                                            val p = posOf(index, cols)
                                            val dx = with(density) { offset.x.toDp().value }
                                            val dy = with(density) { offset.y.toDp().value }
                                            val t = ArrangementOps.pickDropTarget(
                                                result.nodes,
                                                { i -> posOf(i, cols).let { it.x.toFloat() to it.y.toFloat() } },
                                                p.x + dx, p.y + dy, node.key,
                                            )
                                            // The slot reflow (CoverGraph) moves old→new slot; this adds finger→slot.
                                            settleFrom(node.key, offset)
                                            dragging = null
                                            if (t >= 0) {
                                                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                                editor.move(node, result.nodes[t])
                                            }
                                        },
                                    )
                                }
                            } else Modifier,
                        ),
                ) { content() }
            },
        )
        val bench = state.arrangement.bench
        if (bench.isNotEmpty()) {
            Row(
                Modifier.fillMaxWidth().padding(8.dp).animateContentSize(if (com.rulemix.app.ui.motion.reducedMotion()) androidx.compose.animation.core.snap() else Motion.snapSize).background(RmColor.surface2, RoundedCornerShape(10.dp))
                    .clickableNoRipple { benchOpen = true }.padding(12.dp).testTag("bench-cluster"),
                verticalAlignment = Alignment.CenterVertically,
            ) { Text(EditorStrings.benchCount(bench.size), style = RmType.body.copy(color = RmColor.text)) }
        }
        if (benchOpen && bench.isNotEmpty()) {
            com.rulemix.app.ui.common.RmSheet(onDismiss = { benchOpen = false }, containerColor = RmColor.surface1) {
                BenchSheetContent(state, editable) { editor.restore(it) }
            }
        }
    }
}

@Composable
fun BenchSheetContent(state: MixState, editable: Boolean, onPutBack: (String) -> Unit) {
    Column(Modifier.padding(16.dp).testTag("bench-sheet")) {
        Text(EditorStrings.benchCount(state.arrangement.bench.size), style = RmType.rowTitle.copy(color = RmColor.text))
        state.arrangement.bench.forEach { uri ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(state.tracks[uri]?.name ?: uri, style = RmType.body.copy(color = RmColor.text), modifier = Modifier.weight(1f))
                TextButton(onClick = { onPutBack(uri) }, enabled = editable, modifier = Modifier.testTag("put-back-$uri")) { Text(EditorStrings.PUT_BACK) }
            }
        }
    }
}

@Composable
fun SlotDialog(total: Int, onMove: (Int) -> Unit, onDismiss: () -> Unit) {
    var text by remember { mutableStateOf("") }
    val slot = text.toIntOrNull()?.takeIf { it in 1..total }
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(EditorStrings.SLOT_TITLE) },
        text = {
            androidx.compose.material3.OutlinedTextField(
                value = text, onValueChange = { text = it.filter(Char::isDigit).take(4) },
                label = { Text("1–$total") }, singleLine = true, modifier = Modifier.testTag("slot-input"),
            )
        },
        confirmButton = { TextButton(onClick = { slot?.let(onMove) }, enabled = slot != null) { Text(EditorStrings.MOVE) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(EditorStrings.CANCEL) } },
    )
}
