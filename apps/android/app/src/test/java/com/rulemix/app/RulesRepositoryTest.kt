package com.rulemix.app

import com.rulemix.app.data.Api
import com.rulemix.app.data.InMemoryTokenStore
import com.rulemix.app.data.RulesRepository
import com.rulemix.engine.RuleKind
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class RulesRepositoryTest {
    private lateinit var server: MockWebServer
    private lateinit var repo: RulesRepository
    private fun ok(body: String, code: Int = 200) = MockResponse().setResponseCode(code).setBody(body)
    private fun row(id: String, kind: String, n: Int?, pos: Int) =
        """{"rule":{"id":"$id","ruleId":"lib","kind":"$kind","n":$n,"position":$pos,"trackUri":"spotify:track:a","songName":"A","removedPlays":0,"deletedCopies":[]}}"""

    @Before fun setUp() {
        server = MockWebServer().apply { start() }
        repo = RulesRepository(Api(server.url("/").toString(), InMemoryTokenStore("t")))
    }
    @After fun tearDown() = server.shutdown()

    @Test fun addUsesTheExistingLibraryRule() = runTest {
        server.enqueue(ok("""{"rules":[{"id":"lib-pin","kind":"pin_first","n":null,"archivedAt":null}]}"""))
        server.enqueue(ok(row("m1", "pin_first", null, 0), 201))
        val r = repo.add("mix", RuleKind.PIN_FIRST, null, "spotify:track:a")
        assertEquals("/api/rules", server.takeRequest().path)
        val post = server.takeRequest()
        assertEquals("/api/mixes/mix/rules", post.path)
        val b = Json.parseToJsonElement(post.body.readUtf8()).jsonObject
        assertEquals("lib-pin", b["ruleId"]!!.jsonPrimitive.content)
        assertEquals("spotify:track:a", b["trackUri"]!!.jsonPrimitive.content)
        assertEquals(RuleKind.PIN_FIRST, r.kind)
    }

    @Test fun addCreatesAMissingLibraryRule() = runTest {
        server.enqueue(ok("""{"rules":[]}"""))
        server.enqueue(ok("""{"rule":{"id":"lib-e4","kind":"every_n","n":4,"archivedAt":null}}""", 201))
        server.enqueue(ok(row("m2", "every_n", 4, 0), 201))
        repo.add("mix", RuleKind.EVERY_N, 4, "spotify:track:a")
        server.takeRequest()
        val create = server.takeRequest()
        assertEquals("POST", create.method)
        val b = Json.parseToJsonElement(create.body.readUtf8()).jsonObject
        assertEquals("every_n", b["kind"]!!.jsonPrimitive.content)
        assertEquals(4, b["n"]!!.jsonPrimitive.content.toInt())
        assertEquals("lib-e4", Json.parseToJsonElement(server.takeRequest().body.readUtf8()).jsonObject["ruleId"]!!.jsonPrimitive.content)
    }

    @Test fun changePatchesInPlaceAndRemoveDeletes() = runTest {
        server.enqueue(ok("""{"rules":[{"id":"lib-r3","kind":"repeat","n":3,"archivedAt":null}]}"""))
        server.enqueue(ok(row("m3", "repeat", 3, 1)))
        server.enqueue(MockResponse().setResponseCode(204))
        val r = repo.change("mix", "m3", RuleKind.REPEAT, 3)
        server.takeRequest()
        val patch = server.takeRequest()
        assertEquals("PATCH", patch.method)
        assertEquals("/api/mixes/mix/rules/m3", patch.path)
        assertEquals(1, r.position)
        repo.remove("mix", "m3")
        val del = server.takeRequest()
        assertEquals("DELETE", del.method)
        assertEquals("/api/mixes/mix/rules/m3", del.path)
    }

    @Test fun maxRulesComesFromTheRulesEndpoint() = runTest {
        server.enqueue(ok("""{"rules":[],"maxRules":10}"""))
        assertEquals(10, repo.maxRules("mix"))
    }
}
