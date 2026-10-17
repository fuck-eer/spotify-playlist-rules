package com.rulemix.app

import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.rulemix.app.ui.common.SpotifyMissing
import com.rulemix.app.ui.common.SpotifyMissingStrings
import com.rulemix.app.ui.theme.RulemixTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class SpotifyMissingTest {
    @get:Rule val compose = createComposeRule()

    @Test fun showsTheMessageAndAPlayStoreButton() {
        var tapped = false
        compose.setContent { RulemixTheme { SpotifyMissing(onGetSpotify = { tapped = true }) } }
        compose.onNodeWithText(SpotifyMissingStrings.TITLE).assertExists()
        compose.onNodeWithText(SpotifyMissingStrings.CTA).assertHasClickAction().performClick()
        assertTrue(tapped)
    }
}
