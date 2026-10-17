package com.rulemix.app.data

import com.rulemix.engine.RuleKind
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

@Serializable
data class LibraryRule(val id: String, val kind: RuleKind, val n: Int? = null, val archivedAt: String? = null)

/** Library rules and a Mix's rules (same endpoints as web). */
class RulesRepository(private val api: Api) {
    private var library: List<LibraryRule>? = null

    suspend fun library(): List<LibraryRule> = library ?: RmJson.decodeFromJsonElement(
        ListSerializer(LibraryRule.serializer()),
        api.get("/api/rules")!!.jsonObject["rules"]!!,
    ).also { library = it }

    suspend fun maxRules(mixId: String): Int =
        api.get("/api/mixes/$mixId/rules")?.jsonObject?.get("maxRules")?.jsonPrimitive?.int ?: 10

    /** The active library Rule for kind/n, created when missing. */
    suspend fun resolve(kind: RuleKind, n: Int?): String {
        library().firstOrNull { it.kind == kind && it.n == n && it.archivedAt == null }?.let { return it.id }
        val res = api.post(
            "/api/rules",
            buildJsonObject {
                put("kind", RmJson.encodeToJsonElement(RuleKind.serializer(), kind))
                if (n == null) put("n", JsonNull) else put("n", n)
            },
        )!!
        val rule = RmJson.decodeFromJsonElement(LibraryRule.serializer(), res.jsonObject["rule"]!!)
        library = (library ?: emptyList()) + rule
        return rule.id
    }

    suspend fun add(mixId: String, kind: RuleKind, n: Int?, trackUri: String): MixRule {
        val ruleId = resolve(kind, n)
        val res = api.post(
            "/api/mixes/$mixId/rules",
            buildJsonObject {
                put("ruleId", ruleId)
                put("trackUri", trackUri)
            },
        )!!
        return RmJson.decodeFromJsonElement(MixRule.serializer(), res.jsonObject["rule"]!!)
    }

    /** Edits in place: same id and priority position. */
    suspend fun change(mixId: String, mixRuleId: String, kind: RuleKind, n: Int?): MixRule {
        val ruleId = resolve(kind, n)
        val res = api.patch("/api/mixes/$mixId/rules/$mixRuleId", buildJsonObject { put("ruleId", ruleId) })!!
        return RmJson.decodeFromJsonElement(MixRule.serializer(), res.jsonObject["rule"]!!)
    }

    suspend fun remove(mixId: String, mixRuleId: String) {
        api.delete("/api/mixes/$mixId/rules/$mixRuleId")
    }
}
