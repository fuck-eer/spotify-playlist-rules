package com.rulemix.app

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import com.rulemix.app.data.Arrangement
import com.rulemix.app.data.Mix
import com.rulemix.app.data.MixRule
import com.rulemix.app.data.MixSource
import com.rulemix.app.data.MixState
import com.rulemix.app.data.TrackMeta
import com.rulemix.app.domain.buildFromState
import com.rulemix.app.ui.editor.MixEditorScreen
import com.rulemix.app.ui.theme.RulemixTheme
import com.rulemix.engine.RuleKind
import com.rulemix.engine.SourceTrack
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

fun sampleState(manual: List<String>? = null, bench: List<String> = emptyList(), rules: List<MixRule>? = null): MixState {
    val ids = listOf("a", "b", "c", "d")
    return MixState(
        mix = Mix("m1", "Gym", MixSource("playlist", "pl", "Gym bangers"), keepSourceOrder = true, shuffleSeed = 1),
        rules = rules ?: listOf(MixRule("p", "lib-p", RuleKind.PIN_FIRST, null, 0, "spotify:track:b", "B")),
        source = ids.map { SourceTrack("spotify:track:$it", it.uppercase(), listOf("Kavi")) },
        tracks = ids.associate { "spotify:track:$it" to TrackMeta(it.uppercase(), listOf("Kavi")) },
        arrangement = Arrangement(manual, bench, 3),
    )
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class MixEditorScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test fun rendersSummaryGraphAndRulesOnline() {
        val s = sampleState()
        compose.setContent { RulemixTheme { MixEditorScreen(s, buildFromState(s), offline = false, onBack = {}) } }
        compose.onNodeWithTag("summary").assertExists()
        compose.onNodeWithText("5 songs · 1 rule").assertExists()
        compose.onNodeWithText("Start with").assertExists()
        compose.onNodeWithTag("play").assertIsEnabled()
        compose.onNodeWithTag("keep-order").assertIsEnabled()
    }

    @Test fun offlineIsReadOnlyFromTheCache() {
        val s = sampleState(manual = listOf("spotify:track:c", "spotify:track:a", "spotify:track:b", "spotify:track:d"))
        compose.setContent { RulemixTheme { MixEditorScreen(s, buildFromState(s), offline = true, onBack = {}) } }
        compose.onNodeWithTag("offline-banner").assertExists()
        compose.onNodeWithText("5 songs · 1 rule · your order").assertExists()
        compose.onNodeWithTag("play").assertIsNotEnabled()
        compose.onNodeWithTag("keep-order").assertIsNotEnabled()
        compose.onNodeWithText("Remove").assertIsNotEnabled()
    }
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class BuildGuardTest {
    @get:Rule val compose = createComposeRule()

    @Test fun anUnbuildableStateShowsAnErrorInsteadOfCrashing() {
        val bad = sampleState(rules = listOf(MixRule("p", "l", RuleKind.PIN_FIRST, null, 0, "spotify:track:a", removedPlays = 1)))
        org.junit.Assert.assertNull(com.rulemix.app.domain.safeBuildFromState(bad))
        compose.setContent { RulemixTheme { MixEditorScreen(bad, com.rulemix.app.domain.safeBuildFromState(bad), offline = false, onBack = {}) } }
        compose.onNodeWithText(com.rulemix.app.ui.editor.EditorStrings.BUILD_FAILED).assertExists()
    }
}
