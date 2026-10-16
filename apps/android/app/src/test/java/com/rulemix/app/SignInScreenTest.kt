package com.rulemix.app

import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.rulemix.app.ui.signin.SignInScreen
import com.rulemix.app.ui.signin.SignInStrings
import com.rulemix.app.ui.theme.RulemixTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class SignInScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun showsTheSpotifySignInButton() {
        var clicked = false
        compose.setContent { RulemixTheme { SignInScreen(onSignIn = { clicked = true }) } }
        compose.onNodeWithText(SignInStrings.CTA).assertHasClickAction().performClick()
        compose.onNodeWithText(SignInStrings.TAGLINE).assertExists()
        assertTrue(clicked)
    }
}
