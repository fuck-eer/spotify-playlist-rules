package com.rulemix.app

import com.rulemix.app.data.Api
import com.rulemix.app.data.InMemoryTokenStore
import com.rulemix.app.playback.PlayController
import com.rulemix.app.playback.PlayResult
import com.rulemix.app.playback.RemotePlayer
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class PlayControllerTest {
    private lateinit var server: MockWebServer
    private lateinit var api: Api
    private val calls = mutableListOf<String>()
    private var remoteFails = false
    private val remote = object : RemotePlayer {
        override suspend fun setShuffle(on: Boolean) { if (remoteFails) error("no spotify"); calls += "shuffle $on" }
        override suspend fun play(uri: String) { calls += "play $uri" }
    }
    private val opened = mutableListOf<String>()

    @Before fun setUp() {
        server = MockWebServer().apply { start() }
        api = Api(server.url("/").toString(), InMemoryTokenStore("t"))
    }
    @After fun tearDown() = server.shutdown()

    private fun controller() = PlayController(api, remote, { opened += it; true }, pollMs = 1)
    private fun run(status: String, extra: String = "") =
        MockResponse().setBody("""{"run":{"id":"r1","kind":"play","status":"$status"$extra}}""")

    @Test fun successPollsThenShufflesOffAndPlaysTheRunsPlaylist() = runTest {
        server.enqueue(MockResponse().setResponseCode(202).setBody("""{"runId":"r1"}"""))
        server.enqueue(run("running"))
        server.enqueue(run("succeeded", ""","playlistId":"pl9""""))
        assertEquals(PlayResult.Playing("pl9"), controller().play("m1"))
        assertEquals(listOf("shuffle false", "play spotify:playlist:pl9"), calls)
        assertEquals("/api/mixes/m1/play", server.takeRequest().path)
        assertEquals("/api/mixes/m1/save/r1", server.takeRequest().path)
    }

    @Test fun remoteFailureFallsBackToTheIntent() = runTest {
        remoteFails = true
        server.enqueue(MockResponse().setResponseCode(202).setBody("""{"runId":"r1"}"""))
        server.enqueue(run("succeeded", ""","playlistId":"pl9""""))
        assertEquals(PlayResult.OpenedInSpotify("pl9"), controller().play("m1"))
        assertEquals(listOf("spotify:playlist:pl9"), opened)
    }

    @Test fun runFailureIsAnErrorWithTheServerMessage() = runTest {
        server.enqueue(MockResponse().setResponseCode(202).setBody("""{"runId":"r1"}"""))
        server.enqueue(run("failed", ""","error":"Spotify said no.""""))
        assertEquals(PlayResult.Failed("Spotify said no."), controller().play("m1"))
        assertEquals(emptyList<String>(), calls)
    }

    @Test fun runInProgressJoinsTheExistingRun() = runTest {
        server.enqueue(MockResponse().setResponseCode(409).setBody("""{"error":{"code":"run_in_progress","message":"x"},"runId":"r7"}"""))
        server.enqueue(run("succeeded", ""","playlistId":"pl1""""))
        assertEquals(PlayResult.Playing("pl1"), controller().play("m1"))
        server.takeRequest()
        assertEquals("/api/mixes/m1/save/r7", server.takeRequest().path)
    }
}
