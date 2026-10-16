package com.rulemix.engine

/** Standard mulberry32, bit-exact with the TS version (Int arithmetic = Math.imul / `| 0`). */
fun mulberry32(seed: Long): () -> Double {
    var a = seed.toInt()
    return {
        a += 0x6d2b79f5
        var t = (a xor (a ushr 15)) * (1 or a)
        t = (t + ((t xor (t ushr 7)) * (61 or t))) xor t
        ((t xor (t ushr 14)).toLong() and 0xffffffffL).toDouble() / 4294967296.0
    }
}

/** Fisher–Yates from the end, driven by mulberry32(seed). Does not mutate `items`. */
fun <T> seededShuffle(items: List<T>, seed: Long): List<T> {
    val out = items.toMutableList()
    val rand = mulberry32(seed)
    for (i in out.size - 1 downTo 1) {
        val j = kotlin.math.floor(rand() * (i + 1)).toInt()
        val tmp = out[i]
        out[i] = out[j]
        out[j] = tmp
    }
    return out
}
