package com.rulemix.app.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Holds the rulemix Bearer token (ADR-0034). `token` is observable so 401 → signed out. */
interface TokenStore {
    val token: StateFlow<String?>
    fun set(value: String?)
}

class InMemoryTokenStore(initial: String? = null) : TokenStore {
    private val state = MutableStateFlow(initial)
    override val token: StateFlow<String?> = state
    override fun set(value: String?) {
        state.value = value
    }
}

/** EncryptedSharedPreferences-backed store. */
class EncryptedTokenStore(context: Context) : TokenStore {
    private val prefs = EncryptedSharedPreferences.create(
        context,
        "rulemix_session",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )
    private val state = MutableStateFlow(prefs.getString(KEY, null))
    override val token: StateFlow<String?> = state
    override fun set(value: String?) {
        prefs.edit().apply { if (value == null) remove(KEY) else putString(KEY, value) }.apply()
        state.value = value
    }
    private companion object { const val KEY = "token" }
}
