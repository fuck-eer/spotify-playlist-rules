package com.rulemix.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.rulemix.app.ui.signin.SignInScreen
import com.rulemix.app.ui.theme.RulemixTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { RulemixTheme { SignInScreen(onSignIn = {}) } }
    }
}
