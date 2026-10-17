package com.rulemix.app

import android.content.Context
import android.content.SharedPreferences
import android.content.pm.ApplicationInfo
import androidx.test.core.app.ApplicationProvider
import com.rulemix.app.data.EncryptedTokenStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class TokenStoreBackupTest {
    private val ctx = ApplicationProvider.getApplicationContext<Context>()
    private fun plain(): SharedPreferences = ctx.getSharedPreferences("t", Context.MODE_PRIVATE)

    @Test fun autoBackupIsOff() {
        assertEquals(0, ctx.applicationInfo.flags and ApplicationInfo.FLAG_ALLOW_BACKUP)
    }

    @Test fun anUnreadableStoreIsWipedAndStartsSignedOut() {
        plain().edit().putString("token", "old").commit()
        var opens = 0
        var wiped = 0
        val store = EncryptedTokenStore(
            open = { if (opens++ == 0) throw java.security.GeneralSecurityException("AEADBadTag") else plain() },
            wipe = { wiped++; plain().edit().clear().commit() },
        )
        assertEquals(1, wiped)
        assertNull(store.token.value)
        store.set("fresh")
        assertEquals("fresh", plain().getString("token", null))
    }

    @Test fun aStoreThatNeverOpensKeepsTheTokenInMemory() {
        val store = EncryptedTokenStore(open = { throw java.io.IOException("x") }, wipe = {})
        assertNull(store.token.value)
        store.set("t1")
        assertEquals("t1", store.token.value)
    }

    @Test fun aHealthyStoreKeepsItsToken() {
        plain().edit().putString("token", "keep").commit()
        val store = EncryptedTokenStore(open = { plain() }, wipe = { error("no") })
        assertEquals("keep", store.token.value)
    }
}
