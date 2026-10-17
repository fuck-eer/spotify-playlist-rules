package com.rulemix.app

import android.provider.Settings
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.core.app.ApplicationProvider
import com.rulemix.app.domain.buildFromState
import com.rulemix.app.ui.graph.CoverGraph
import com.rulemix.app.ui.graph.PopScale
import com.rulemix.app.ui.graph.RuleMeta
import com.rulemix.app.ui.graph.WireProgress
import com.rulemix.app.ui.theme.RulemixTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class MotionTest {
    @get:Rule val compose = createComposeRule()

    private fun show(scale: Float) {
        Settings.Global.putFloat(ApplicationProvider.getApplicationContext<android.content.Context>().contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, scale)
        val s = sampleState()
        compose.mainClock.autoAdvance = false
        compose.setContent { RulemixTheme { CoverGraph(buildFromState(s).nodes, s.tracks, s.rules.map { RuleMeta(it.kind, it.n) }) } }
        compose.mainClock.advanceTimeByFrame()
    }

    private fun values(key: androidx.compose.ui.semantics.SemanticsPropertyKey<Float>) =
        compose.onAllNodes(SemanticsMatcher.keyIsDefined(key), useUnmergedTree = true).fetchSemanticsNodes().map { it.config.getOrNull(key)!! }

    @Test fun animatorScaleZeroShowsTheFinalStateWithoutAnimating() {
        show(0f)
        assertTrue(values(PopScale).isNotEmpty())
        assertTrue(values(PopScale).all { it == 1f })
        assertTrue(values(WireProgress).all { it == 1f })
    }

    @Test fun normalMotionStartsFromZeroAndSettles() {
        show(1f)
        assertTrue(values(PopScale).any { it < 1f })
        compose.mainClock.advanceTimeBy(3000)
        assertTrue(values(PopScale).all { it == 1f })
        assertEquals(true, values(WireProgress).all { it == 1f })
    }
}
