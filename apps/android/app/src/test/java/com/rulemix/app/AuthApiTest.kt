package com.rulemix.app

import com.rulemix.app.data.Api
import com.rulemix.app.data.ApiException
import com.rulemix.app.data.AuthRepository
import com.rulemix.app.data.InMemoryTokenStore
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class AuthApiTest {
    private lateinit var server: MockWebServer
    private val tokens = InMemoryTokenStore()
    private lateinit var api: Api

    @Before fun setUp() {
        server = MockWebServer().apply { start() }
        api = Api(server.url("/").toString(), tokens)
    }
    @After fun tearDown() = server.shutdown()

    private fun json(body: String, code: Int = 200) =
        MockResponse().setResponseCode(code).setHeader("content-type", "application/json").setBody(body)

    @Test fun signInPostsTheCodeAndRedirectAndStoresTheToken() = runTest {
        server.enqueue(json("""{"token":"tok-1","expiresAt":"2026-12-01T00:00:00.000Z","user":{"id":"u1","displayName":"Nishchay"}}"""))
        val s = AuthRepository(api, tokens, "rulemix://callback").signIn("code-123")
        val req = server.takeRequest()
        assertEquals("POST", req.method)
        assertEquals("/api/mobile/session", req.path)
        val body = Json.parseToJsonElement(req.body.readUtf8()).jsonObject
        assertEquals("code-123", body["code"]!!.jsonPrimitive.content)
        assertEquals("rulemix://callback", body["redirectUri"]!!.jsonPrimitive.content)
        assertNull(req.getHeader("Authorization"))
        assertEquals("tok-1", tokens.token.value)
        assertEquals("Nishchay", s.user.displayName)
    }

    @Test fun sendsBearerAndA401ClearsTheToken() = runTest {
        tokens.set("tok-2")
        server.enqueue(json("""{"mixes":[]}"""))
        server.enqueue(json("""{"error":{"code":"unauthorized","message":"Please sign in."}}""", 401))
        api.get("/api/mixes")
        assertEquals("Bearer tok-2", server.takeRequest().getHeader("Authorization"))
        val e = runCatching { api.get("/api/mixes") }.exceptionOrNull()
        assertTrue(e is ApiException.Unauthorized)
        assertNull(tokens.token.value)
    }

    @Test fun signOutDeletesTheSessionAndClearsLocally() = runTest {
        tokens.set("tok-3")
        server.enqueue(MockResponse().setResponseCode(204))
        AuthRepository(api, tokens, "rulemix://callback").signOut()
        val req = server.takeRequest()
        assertEquals("DELETE", req.method)
        assertEquals("Bearer tok-3", req.getHeader("Authorization"))
        assertNull(tokens.token.value)
    }

    @Test fun httpErrorsCarryTheServerCode() = runTest {
        server.enqueue(json("""{"error":{"code":"rule_limit","message":"Up to 10 rules per mix."}}""", 409))
        val e = runCatching { api.get("/api/mixes/m/rules") }.exceptionOrNull() as ApiException.Http
        assertEquals(409, e.status)
        assertEquals("rule_limit", e.code)
        assertEquals("Up to 10 rules per mix.", e.message)
    }
}
