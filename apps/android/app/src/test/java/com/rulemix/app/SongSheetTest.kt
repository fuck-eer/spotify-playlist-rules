package com.rulemix.app

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.rulemix.app.data.MixRule
import com.rulemix.app.data.TrackMeta
import com.rulemix.app.ui.editor.SongSheetContent
import com.rulemix.app.ui.editor.SongSheetStrings
import com.rulemix.app.ui.theme.RulemixTheme
import com.rulemix.engine.RuleKind
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class SongSheetTest {
    @get:Rule val compose = createComposeRule()
    private val adds = mutableListOf<Pair<RuleKind, Int?>>()
    private val changes = mutableListOf<Triple<String, RuleKind, Int>>()

    private fun show(rules: List<Pair<Int, MixRule>> = emptyList(), count: Int = rules.size, max: Int = 10) =
        compose.setContent {
            RulemixTheme {
                SongSheetContent(
                    "spotify:track:a", TrackMeta("A", listOf("Kavi")), rules, count, max,
                    onAdd = { k, n -> adds += k to n }, onChange = { id, k, n -> changes += Triple(id, k, n) }, onRemove = {},
                )
            }
        }

    @Test fun startWithAddsAPinFirstRule() {
        show()
        compose.onNodeWithText(SongSheetStrings.START_WITH).performClick()
        assertEquals(listOf(RuleKind.PIN_FIRST to null), adds)
    }

    @Test fun afterEveryNStepperDefaultsTo4AndIsBounded2To10() {
        show()
        compose.onNodeWithText(SongSheetStrings.EVERY_N).performClick()
        compose.onNodeWithText(SongSheetStrings.EVERY_PROMPT).assertExists()
        compose.onNodeWithTag("stepper-value").assertTextEquals("4")
        repeat(10) { compose.onNodeWithContentDescription(SongSheetStrings.INCREASE).performClick() }
        compose.onNodeWithTag("stepper-value").assertTextEquals("10")
        compose.onNodeWithContentDescription(SongSheetStrings.INCREASE).assertIsNotEnabled()
        repeat(12) { runCatching { compose.onNodeWithContentDescription(SongSheetStrings.DECREASE).performClick() } }
        compose.onNodeWithTag("stepper-value").assertTextEquals("2")
        compose.onNodeWithContentDescription(SongSheetStrings.DECREASE).assertIsNotEnabled()
        compose.onNodeWithText(SongSheetStrings.ADD).performClick()
        assertEquals(listOf(RuleKind.EVERY_N to 2), adds)
    }

    @Test fun repeatStepperDefaultsTo2() {
        show()
        compose.onNodeWithText(SongSheetStrings.REPEAT).performClick()
        compose.onNodeWithText(SongSheetStrings.REPEAT_PROMPT).assertExists()
        compose.onNodeWithTag("stepper-value").assertTextEquals("2")
        compose.onNodeWithText(SongSheetStrings.ADD).performClick()
        assertEquals(listOf(RuleKind.REPEAT to 2), adds)
    }

    @Test fun atTheRuleCapTheButtonsAreDisabledWithTheCapCopy() {
        show(count = 10, max = 10)
        compose.onNodeWithText("Up to 10 rules per mix.").assertExists()
        compose.onNodeWithText(SongSheetStrings.START_WITH).assertIsNotEnabled()
        compose.onNodeWithText(SongSheetStrings.REPEAT).assertIsNotEnabled()
    }

    @Test fun changeOpensTheStepperWithTheCurrentNAndSaves() {
        show(listOf(1 to MixRule("x", "l", RuleKind.EVERY_N, 6, 1, "spotify:track:a")))
        compose.onNodeWithText("#2 After every 6").assertExists()
        compose.onNodeWithText(SongSheetStrings.CHANGE).performClick()
        compose.onNodeWithTag("stepper-value").assertTextEquals("6")
        compose.onNodeWithContentDescription(SongSheetStrings.INCREASE).performClick()
        compose.onNodeWithText(SongSheetStrings.SAVE).assertIsEnabled().performClick()
        assertEquals(listOf(Triple("x", RuleKind.EVERY_N, 7)), changes)
    }
}
