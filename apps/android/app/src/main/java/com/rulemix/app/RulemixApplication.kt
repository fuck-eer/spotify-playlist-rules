package com.rulemix.app

import android.app.Application

class RulemixApplication : Application() {
    val container: AppContainer by lazy { AppContainer(this) }
}
