package com.rulemix.app

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.rulemix.app.data.CachedResult
import com.rulemix.app.data.Mix
import com.rulemix.app.data.MixSource
import com.rulemix.app.data.OfflineStrings
import com.rulemix.app.ui.mixes.MixListScreen
import com.rulemix.app.ui.theme.RulemixTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class MixListScreenTest {
    @get:Rule val compose = createComposeRule()
    private val mix = Mix("m1", "Gym", MixSource("playlist", "pl", "Gym bangers"), false, 1, ruleCount = 1)

    @Test fun offlineShowsTheBannerAndDisablesNewMix() {
        var newMix = 0
        compose.setContent {
            RulemixTheme {
                MixListScreen(CachedResult(listOf(mix), stale = true, offline = true), online = false, onOpen = {}, onNewMix = { newMix++ }, onSignOut = {})
            }
        }
        compose.onNodeWithTag("offline-banner").assertExists()
        compose.onNodeWithText(OfflineStrings.BANNER).assertExists()
        compose.onNodeWithText("Gym bangers · 1 rule").assertExists()
        compose.onNodeWithTag("new-mix").assertIsNotEnabled().performClick()
        assertEquals(0, newMix)
    }

    @Test fun onlineHasNoBannerAndNewMixWorks() {
        var newMix = 0
        compose.setContent {
            RulemixTheme { MixListScreen(CachedResult(emptyList(), stale = false), online = true, onOpen = {}, onNewMix = { newMix++ }, onSignOut = {}) }
        }
        compose.onNodeWithTag("offline-banner").assertDoesNotExist()
        compose.onNodeWithText("No mixes yet").assertExists()
        compose.onNodeWithTag("new-mix").assertIsEnabled().performClick()
        assertEquals(1, newMix)
    }

    @Test fun offlineWithoutCacheShowsTheMessage() {
        compose.setContent {
            RulemixTheme { MixListScreen(CachedResult(null, stale = true, offline = true, error = OfflineStrings.NO_CACHE), online = false, onOpen = {}, onNewMix = {}, onSignOut = {}) }
        }
        compose.onNodeWithText("You're offline. Connect to load your mixes.").assertExists()
    }
}
