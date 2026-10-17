package com.rulemix.app.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@Serializable
data class SessionUser(val id: String, val displayName: String? = null)

@Serializable
data class MobileSession(val token: String, val expiresAt: String, val user: SessionUser)

/** Sign-in with a Spotify code (ADR-0034) and sign-out. */
class AuthRepository(
    private val api: Api,
    private val tokens: TokenStore,
    private val redirectUri: String,
) {
    suspend fun signIn(code: String): MobileSession {
        val res = api.post(
            "/api/mobile/session",
            buildJsonObject {
                put("code", code)
                put("redirectUri", redirectUri)
            },
        ) ?: error("empty session response")
        val session = RmJson.decodeFromJsonElement(MobileSession.serializer(), res)
        tokens.set(session.token)
        return session
    }

    suspend fun signOut() {
        try {
            if (tokens.token.value != null) api.delete("/api/mobile/session")
        } catch (_: ApiException) {
            // Signing out locally always works.
        } finally {
            tokens.set(null)
        }
    }
}
