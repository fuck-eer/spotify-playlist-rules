package com.rulemix.app

import com.rulemix.app.data.Api
import com.rulemix.app.data.FakeConnectivity
import com.rulemix.app.data.InMemoryTokenStore
import com.rulemix.app.data.MemoryCache
import com.rulemix.app.data.MixRepository
import com.rulemix.app.data.OfflineStrings
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class MixRepositoryTest {
    private lateinit var server: MockWebServer
    private val cache = MemoryCache()
    private val net = FakeConnectivity(true)
    private lateinit var repo: MixRepository

    private val mixesJson = """{"mixes":[{"id":"m1","name":"Gym","source":{"type":"playlist","id":"pl","name":"Gym bangers"},"keepSourceOrder":false,"shuffleSeed":7,"targetPlaylistId":null,"lastSavedAt":null,"ruleCount":2,"createdAt":"x","updatedAt":"y"}]}"""

    @Before fun setUp() {
        server = MockWebServer().apply { start() }
        repo = MixRepository(Api(server.url("/").toString(), InMemoryTokenStore("t")), cache, net)
    }
    @After fun tearDown() = server.shutdown()

    @Test fun onlineFetchWritesTheCache() = runTest {
        server.enqueue(MockResponse().setBody(mixesJson))
        val out = repo.mixes().toList()
        assertEquals(1, out.size)
        assertFalse(out[0].stale)
        assertEquals("Gym", out[0].data!!.single().name)
        assertTrue(cache.read("mixes")!!.contains("Gym bangers"))
    }

    @Test fun offlineReturnsTheCacheMarkedStale() = runTest {
        server.enqueue(MockResponse().setBody(mixesJson))
        repo.mixes().toList()
        net.online.value = false
        val out = repo.mixes().toList()
        assertEquals(1, out.size)
        assertTrue(out[0].stale)
        assertTrue(out[0].offline)
        assertEquals(2, out[0].data!!.single().ruleCount)
        assertEquals(1, server.requestCount)
    }

    @Test fun noCacheOfflineGivesTheEmptyStateMessage() = runTest {
        net.online.value = false
        val r = repo.mixes().toList().single()
        assertNull(r.data)
        assertEquals(OfflineStrings.NO_CACHE, r.error)
        assertEquals("You're offline. Connect to load your mixes.", r.error)
    }

    @Test fun connectionFailureFallsBackToTheCache() = runTest {
        cache.write("mixes", """[{"id":"m9","name":"Old","source":{"type":"liked","name":"Liked Songs"},"keepSourceOrder":true,"shuffleSeed":1}]""")
        server.shutdown()
        val out = repo.mixes().toList()
        assertEquals("Old", out.first().data!!.single().name)
        assertTrue(out.last().offline)
        assertEquals("Old", out.last().data!!.single().name)
    }

    @Test fun stateIsCachedPerMix() = runTest {
        server.enqueue(MockResponse().setBody("""{"mix":{"id":"m1","name":"Gym","source":{"type":"liked","name":"Liked Songs"},"keepSourceOrder":true,"shuffleSeed":1},"rules":[],"source":[{"uri":"spotify:track:a","name":"A","artists":["K"]},null],"tracks":{"spotify:track:a":{"name":"A","artists":["K"],"imageUrl":null}},"arrangement":{"manualOrder":null,"bench":[],"version":3}}"""))
        val s = repo.state("m1").toList().single().data!!
        assertEquals(3, s.arrangement.version)
        assertNull(s.source[1])
        net.online.value = false
        assertEquals(3, repo.state("m1").toList().single().data!!.arrangement.version)
    }
}
