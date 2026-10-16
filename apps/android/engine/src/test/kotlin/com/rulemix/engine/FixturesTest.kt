package com.rulemix.engine

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.MethodSource
import java.io.File

@Serializable
data class Fixture(val name: String, val input: BuildInput, val expected: BuildResult)

class FixturesTest {
    companion object {
        /** Must match `has all N fixtures` in packages/rules-engine/src/build.fixtures.test.ts. */
        const val EXPECTED_COUNT = 24
        val json = Json { ignoreUnknownKeys = false }
        private val engineDir = File(System.getProperty("rulemix.engineDir")!!)
        private val dir: File = File(engineDir, "fixtures")

        @JvmStatic
        fun files(): List<String> = dir.list()!!.filter { Regex("^\\d\\d-.*\\.json$").matches(it) }.sorted()
    }

    @Test
    fun fixtureCountMatchesTheTsSuite() {
        assertEquals(EXPECTED_COUNT, files().size)
        val ts = File(engineDir, "src/build.fixtures.test.ts").readText()
        assertEquals(true, ts.contains("toHaveLength($EXPECTED_COUNT)"), "TS suite count differs")
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("files")
    fun fixture(file: String) {
        val f = json.decodeFromString(Fixture.serializer(), File(dir, file).readText())
        assertEquals(f.expected, build(f.input), f.name)
    }
}
