package com.rulemix.app

import android.content.Context
import com.rulemix.app.data.AndroidConnectivity
import com.rulemix.app.data.Api
import com.rulemix.app.data.Cache
import com.rulemix.app.data.Connectivity
import com.rulemix.app.data.FileCache
import com.rulemix.app.data.MixRepository
import com.rulemix.app.data.AuthRepository
import com.rulemix.app.data.EncryptedTokenStore
import com.rulemix.app.data.TokenStore

/** Manual DI: one per process. */
class AppContainer(
    context: Context,
    val tokens: TokenStore = EncryptedTokenStore(context),
    baseUrl: String = BuildConfig.API_BASE_URL,
    val connectivity: Connectivity = AndroidConnectivity(context),
    val cache: Cache = FileCache(java.io.File(context.filesDir, "cache")),
) {
    val appContext: Context = context.applicationContext
    val api = Api(baseUrl, tokens)
    val auth = AuthRepository(api, tokens, BuildConfig.REDIRECT_URI)
    val mixes = MixRepository(api, cache, connectivity)
}
