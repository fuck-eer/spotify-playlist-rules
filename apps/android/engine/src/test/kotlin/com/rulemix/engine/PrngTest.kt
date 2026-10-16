package com.rulemix.engine

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

@Serializable
data class PrngVectors(val mulberry32: List<Mul>, val shuffle: List<Shuf>) {
    @Serializable data class Mul(val seed: Long, val first: List<Double>)
    @Serializable data class Shuf(val seed: Long, val input: List<String>, val output: List<String>)
}

class PrngTest {
    private val v = Json.decodeFromString(
        PrngVectors.serializer(),
        PrngTest::class.java.getResource("/prng.json")!!.readText(),
    )

    @Test
    fun mulberry32MatchesTs() {
        for (m in v.mulberry32) {
            val r = mulberry32(m.seed)
            assertEquals(m.first, m.first.map { r() }, "seed ${m.seed}")
        }
    }

    @Test
    fun seededShuffleMatchesTs() {
        for (s in v.shuffle) assertEquals(s.output, seededShuffle(s.input, s.seed), "seed ${s.seed}")
    }
}
