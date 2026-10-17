package com.rulemix.app

import com.rulemix.app.data.Api
import com.rulemix.app.data.ArrangementRepository
import com.rulemix.app.data.ArrangementSave
import com.rulemix.app.data.InMemoryTokenStore
import com.rulemix.app.data.MixRepository
import com.rulemix.app.data.MemoryCache
import com.rulemix.app.data.FakeConnectivity
import com.rulemix.app.data.MixState
import com.rulemix.app.data.RmJson
import com.rulemix.app.domain.ArrangementOps
import com.rulemix.app.ui.editor.EditorController
import com.rulemix.app.ui.editor.EditorStrings
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ArrangementRepositoryTest {
    private lateinit var server: MockWebServer
    private lateinit var api: Api

    @Before fun setUp() {
        server = MockWebServer().apply { start() }
        api = Api(server.url("/").toString(), InMemoryTokenStore("t"))
    }
    @After fun tearDown() = server.shutdown()

    @Test fun putSendsVersionAndAnExplicitNullManualOrder() = runTest {
        server.enqueue(MockResponse().setBody("""{"version":4}"""))
        val r = ArrangementRepository(api).put("m1", 3, ArrangementOps.draftOf(sampleState()))
        assertEquals(ArrangementSave.Saved(4), r)
        val req = server.takeRequest()
        assertEquals("PUT", req.method)
        assertEquals("/api/mixes/m1/arrangement", req.path)
        val b = RmJson.parseToJsonElement(req.body.readUtf8()).jsonObject
        assertEquals(3, b["version"]!!.jsonPrimitive.int)
        assertEquals(JsonNull, b["manualOrder"])
        assertTrue(b.containsKey("bench") && b.containsKey("rules"))
    }

    @Test fun staleVersionReturnsTheServerState() = runTest {
        val server409 = sampleState(bench = listOf("spotify:track:d"))
        val body = """{"error":{"code":"stale_version","message":"Updated from another device."},"state":${RmJson.encodeToString(MixState.serializer(), server409)}}"""
        server.enqueue(MockResponse().setResponseCode(409).setBody(body))
        val r = ArrangementRepository(api).put("m1", 1, ArrangementOps.draftOf(sampleState()))
        assertEquals(listOf("spotify:track:d"), (r as ArrangementSave.Stale).state.arrangement.bench)
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    @Test fun controllerBenchesOptimisticallyAndTakesTheServerStateOn409() {
        val scope = TestScope(StandardTestDispatcher())
        val c = EditorController("m1", MixRepository(api, MemoryCache(), FakeConnectivity(true)), api, scope)
        c.replace(sampleState(), cache = false)
        val other = sampleState(bench = listOf("spotify:track:d"))
        server.enqueue(MockResponse().setResponseCode(409).setBody(
            """{"error":{"code":"stale_version","message":"x"},"state":${RmJson.encodeToString(MixState.serializer(), other)}}""",
        ))
        val node = c.result!!.nodes.first { it.uri == "spotify:track:c" }
        c.remove(node)
        assertEquals(listOf("spotify:track:c"), c.state!!.arrangement.bench)
        assertEquals(EditorStrings.BENCH_HINT, c.notice)
        // The HTTP call runs on Dispatchers.IO; pump until it lands.
        val until = System.currentTimeMillis() + 5000
        while (c.notice != ArrangementRepository.STALE && System.currentTimeMillis() < until) {
            scope.advanceUntilIdle()
            Thread.sleep(10)
        }
        assertEquals(listOf("spotify:track:d"), c.state!!.arrangement.bench)
        assertEquals(ArrangementRepository.STALE, c.notice)
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    @Test fun twoEditsBeforeTheFirstResponseSaveInOrderOnTheReturnedVersion() {
        val scope = TestScope(StandardTestDispatcher())
        val c = EditorController("m1", MixRepository(api, MemoryCache(), FakeConnectivity(true)), api, scope)
        c.replace(sampleState(), cache = false) // version 3
        server.enqueue(MockResponse().setBody("""{"version":4}""").setBodyDelay(200, java.util.concurrent.TimeUnit.MILLISECONDS))
        server.enqueue(MockResponse().setBody("""{"version":5}"""))
        val nodes = c.result!!.nodes
        c.remove(nodes.first { it.uri == "spotify:track:c" })
        c.remove(nodes.first { it.uri == "spotify:track:d" })
        assertEquals(listOf("spotify:track:c", "spotify:track:d"), c.state!!.arrangement.bench)
        val until = System.currentTimeMillis() + 5000
        while (c.state!!.arrangement.version != 5 && System.currentTimeMillis() < until) {
            scope.advanceUntilIdle()
            Thread.sleep(10)
        }
        val first = RmJson.parseToJsonElement(server.takeRequest().body.readUtf8()).jsonObject
        val second = RmJson.parseToJsonElement(server.takeRequest().body.readUtf8()).jsonObject
        assertEquals(3, first["version"]!!.jsonPrimitive.int)
        assertEquals(4, second["version"]!!.jsonPrimitive.int)
        assertEquals(5, c.state!!.arrangement.version)
        assertEquals(listOf("spotify:track:c", "spotify:track:d"), c.state!!.arrangement.bench)
        assertTrue(c.notice != ArrangementRepository.STALE)
        assertEquals(EditorStrings.BENCHED, c.announcement)
    }
}
