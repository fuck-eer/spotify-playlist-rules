package com.rulemix.app.data

import android.content.Context
import android.content.SharedPreferences
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

/**
 * EncryptedSharedPreferences-backed store. If the prefs can't be opened or read (e.g. restored
 * onto a device without the Keystore master key, S2), they are wiped and the user starts
 * signed out instead of crashing.
 */
class EncryptedTokenStore internal constructor(
    open: () -> SharedPreferences,
    wipe: () -> Unit,
) : TokenStore {
    constructor(context: Context) : this(
        open = {
            EncryptedSharedPreferences.create(
                context,
                PREFS,
                MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        },
        wipe = { context.deleteSharedPreferences(PREFS) },
    )

    /** null when even a fresh store can't be opened: tokens then live in memory only. */
    private val prefs: SharedPreferences?
    private val state: MutableStateFlow<String?>

    init {
        val first = runCatching { open().also { it.getString(KEY, null) } }
        val p = first.getOrNull() ?: run {
            runCatching(wipe)
            runCatching(open).getOrNull()
        }
        prefs = p
        state = MutableStateFlow(if (first.isSuccess) runCatching { p?.getString(KEY, null) }.getOrNull() else null)
    }

    override val token: StateFlow<String?> get() = state
    override fun set(value: String?) {
        prefs?.let { p -> runCatching { p.edit().apply { if (value == null) remove(KEY) else putString(KEY, value) }.apply() } }
        state.value = value
    }

    companion object {
        const val PREFS = "rulemix_session"
        private const val KEY = "token"
    }
}
