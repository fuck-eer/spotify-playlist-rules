package com.rulemix.app.data

import java.io.File

/** Last fetched JSON per key, as files in `filesDir/cache/` (read-only offline copy). */
interface Cache {
    fun read(key: String): String?
    fun write(key: String, json: String)
    fun clear()
}

class FileCache(private val dir: File) : Cache {
    private fun file(key: String) = File(dir, key.replace(Regex("[^A-Za-z0-9_.-]"), "_") + ".json")
    override fun read(key: String): String? = file(key).takeIf { it.exists() }?.readText()
    override fun write(key: String, json: String) {
        dir.mkdirs()
        val tmp = File(dir, "${file(key).name}.tmp")
        tmp.writeText(json)
        tmp.renameTo(file(key))
    }
    override fun clear() {
        dir.listFiles()?.forEach { it.delete() }
    }
}

class MemoryCache : Cache {
    val map = mutableMapOf<String, String>()
    override fun read(key: String) = map[key]
    override fun write(key: String, json: String) {
        map[key] = json
    }
    override fun clear() = map.clear()
}
