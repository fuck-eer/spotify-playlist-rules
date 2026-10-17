package com.rulemix.app

import android.content.Context
import com.rulemix.app.data.Api
import com.rulemix.app.data.AuthRepository
import com.rulemix.app.data.EncryptedTokenStore
import com.rulemix.app.data.TokenStore

/** Manual DI: one per process. */
class AppContainer(
    context: Context,
    val tokens: TokenStore = EncryptedTokenStore(context),
    baseUrl: String = BuildConfig.API_BASE_URL,
) {
    val appContext: Context = context.applicationContext
    val api = Api(baseUrl, tokens)
    val auth = AuthRepository(api, tokens, BuildConfig.REDIRECT_URI)
}
