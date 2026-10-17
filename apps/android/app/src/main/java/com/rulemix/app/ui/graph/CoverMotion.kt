package com.rulemix.app.ui.graph

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.SemanticsPropertyReceiver
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.rulemix.app.ui.motion.Motion
import com.rulemix.engine.GraphNode
import com.rulemix.engine.NodeRole
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** How a cover entered: first render pop, reflow slide, copy fly-in, restore grow. */
enum class Entry { POP, REFLOW, FLY, GROW, NONE }

val CoverEntry = SemanticsPropertyKey<Entry>("CoverEntry")
var SemanticsPropertyReceiver.coverEntry by CoverEntry
val CoverSweep = SemanticsPropertyKey<Float>("CoverSweep")
var SemanticsPropertyReceiver.coverSweep by CoverSweep
val GhostScale = SemanticsPropertyKey<Float>("GhostScale")
var SemanticsPropertyReceiver.ghostScale by GhostScale

data class Ghost(val node: GraphNode, val pos: GraphPos, val toScale: Float)

/**
 * Position/colour memory across renders (motion-spec #3, #4, #7, #45, #49): where each key
 * was, its rule colour, and covers that just left (ghosts).
 */
class MotionBook {
    val positions = mutableMapOf<String, GraphPos>()
    val ruleOf = mutableMapOf<String, Int?>()
    val ghosts = mutableStateListOf<Ghost>()
    private var last: List<GraphNode>? = null
    private var lastCols = 0
    var shown = false
        private set
    private var current: Map<String, Int> = emptyMap()
    var cols = 0
        private set

    fun update(nodes: List<GraphNode>, cols: Int, reduced: Boolean = false) {
        this.cols = cols
        current = nodes.withIndex().associate { it.value.key to it.index }
        val prev = last
        if (prev != null && prev !== nodes) {
            shown = true
            val keys = current.keys
            if (!reduced) prev.withIndex().filter { it.value.key !in keys && ghosts.none { g -> g.node.key == it.value.key } }.forEach { (i, n) ->
                val pos = positions[n.key] ?: posOf(i, lastCols.takeIf { it > 0 } ?: cols)
                val deleting = n.role == NodeRole.COPY || n.plays > 1
                ghosts += Ghost(n, pos, if (deleting) 0.6f else 0.2f)
            }
            // A key that comes back cancels its ghost.
            ghosts.removeAll { it.node.key in keys }
        }
        last = nodes
        lastCols = cols
    }

    /** Where the Original of [uri] sits now (copy fly-in source). */
    fun sourceOf(uri: String): GraphPos? = current["b:$uri"]?.let { posOf(it, cols) }
}

private val EASE_IN = CubicBezierEasing(.4f, 0f, 1f, 1f)
private fun snapOffset() = spring(dampingRatio = 0.82f, stiffness = 600f, visibilityThreshold = Offset(0.5f, 0.5f))

@Composable
fun AnimatedCover(
    node: GraphNode,
    p: GraphPos,
    reduced: Boolean,
    book: MotionBook,
    initialIndex: Int,
    content: @Composable (sweep: Float?) -> Unit,
) {
    val density = LocalDensity.current
    // Decide once per (key, slot) how this cover arrives.
    val plan = remember(node.key, p) {
        val before = book.positions[node.key]
        when {
            reduced -> Entry.NONE to Offset.Zero
            before != null && before != p -> Entry.REFLOW to Offset((before.x - p.x).toFloat(), (before.y - p.y).toFloat())
            before != null -> Entry.NONE to Offset.Zero
            !book.shown -> Entry.POP to Offset.Zero
            node.role == NodeRole.COPY -> {
                val src = book.sourceOf(node.uri) ?: p
                Entry.FLY to Offset((src.x - p.x).toFloat(), (src.y - p.y).toFloat())
            }
            else -> Entry.GROW to Offset.Zero
        }
    }
    val sweepNeeded = remember(node.key, node.ruleIndex) {
        !reduced && book.shown && node.ruleIndex != null &&
            (book.ruleOf.containsKey(node.key).not() && node.role == NodeRole.COPY || book.ruleOf.containsKey(node.key) && book.ruleOf[node.key] != node.ruleIndex)
    }
    SideEffect {
        book.positions[node.key] = p
        book.ruleOf[node.key] = node.ruleIndex
    }
    val (entry, from) = plan
    val offset = remember(node.key, p) { Animatable(from, Offset.VectorConverter) }
    val scale = remember(node.key, p) {
        Animatable(when (entry) { Entry.POP -> 0.5f; Entry.FLY -> 0.6f; Entry.GROW -> 0.2f; else -> 1f })
    }
    val alpha = remember(node.key, p) {
        Animatable(when (entry) { Entry.POP, Entry.GROW -> 0f; Entry.FLY -> 0.2f; else -> 1f })
    }
    val sweep = remember(node.key, node.ruleIndex) { Animatable(if (sweepNeeded) 0f else 1f) }
    LaunchedEffect(node.key, p) {
        when (entry) {
            Entry.POP -> {
                delay(minOf(initialIndex, 12) * 30L)
                launch { alpha.animateTo(1f, tween(160)) }
                scale.animateTo(1f, Motion.pop)
            }
            Entry.REFLOW -> offset.animateTo(Offset.Zero, snapOffset())
            Entry.FLY -> {
                launch { alpha.animateTo(1f, Motion.easeOut) }
                launch { scale.animateTo(1f, Motion.pop) }
                offset.animateTo(Offset.Zero, snapOffset())
            }
            Entry.GROW -> {
                launch { alpha.animateTo(1f, tween(160)) }
                scale.animateTo(1f, Motion.pop)
            }
            Entry.NONE -> Unit
        }
    }
    LaunchedEffect(node.key, node.ruleIndex) {
        if (sweepNeeded) {
            if (node.role == NodeRole.COPY) delay(140)
            sweep.animateTo(1f, tween(320, easing = CubicBezierEasing(.2f, .8f, .2f, 1f)))
        }
    }
    Box(
        Modifier.offset(x = (p.x - COL_WIDTH / 2).dp, y = (ROW_HEIGHT / 2 - COVER_DP / 2).dp)
            .semantics {
                popScale = scale.value
                coverEntry = entry
                coverSweep = sweep.value
            }
            .graphicsLayer {
                translationX = with(density) { offset.value.x.dp.toPx() }
                translationY = with(density) { offset.value.y.dp.toPx() }
                scaleX = scale.value
                scaleY = scale.value
                this.alpha = alpha.value.coerceIn(0f, 1f)
            },
    ) { content(if (sweep.value < 1f) sweep.value else null) }
}

@Composable
fun GhostCover(g: Ghost, reduced: Boolean, book: MotionBook, content: @Composable () -> Unit) {
    val scale = remember { Animatable(1f) }
    val alpha = remember { Animatable(1f) }
    LaunchedEffect(Unit) {
        if (!reduced) {
            launch { alpha.animateTo(0f, tween(180, easing = EASE_IN)) }
            scale.animateTo(g.toScale, tween(180, easing = EASE_IN))
        }
        book.ghosts.remove(g)
        book.positions.remove(g.node.key)
    }
    Box(
        Modifier.offset(x = (g.pos.x - COL_WIDTH / 2).dp, y = (ROW_HEIGHT / 2 - COVER_DP / 2).dp)
            .semantics { ghostScale = scale.value }
            .graphicsLayer { scaleX = scale.value; scaleY = scale.value; this.alpha = alpha.value },
    ) { content() }
}
