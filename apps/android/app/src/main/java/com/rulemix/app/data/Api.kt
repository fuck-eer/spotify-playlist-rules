package com.rulemix.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

sealed class ApiException(message: String) : Exception(message) {
    /** 401: the token was cleared; the app shows sign-in. */
    class Unauthorized : ApiException("Please sign in.")
    class Http(val status: Int, val code: String?, message: String, val body: JsonElement?) :
        ApiException(message)
    class Offline(cause: IOException) : ApiException("You're offline.") {
        init { initCause(cause) }
    }
}

val RmJson = Json { ignoreUnknownKeys = true; explicitNulls = false; encodeDefaults = true }

/** rulemix HTTP client: JSON, Bearer interceptor, 401 → token cleared (signed out). */
class Api(
    private val baseUrl: String,
    private val tokens: TokenStore,
    client: OkHttpClient = OkHttpClient(),
) {
    private val http = client.newBuilder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(Interceptor { chain ->
            val t = tokens.token.value
            val req = chain.request().newBuilder().apply {
                if (t != null) header("Authorization", "Bearer $t")
                header("Accept", "application/json")
            }.build()
            chain.proceed(req)
        })
        .build()

    suspend fun get(path: String): JsonElement? = call("GET", path, null)
    suspend fun post(path: String, body: JsonElement? = null): JsonElement? = call("POST", path, body)
    suspend fun put(path: String, body: JsonElement): JsonElement? = call("PUT", path, body)
    suspend fun patch(path: String, body: JsonElement): JsonElement? = call("PATCH", path, body)
    suspend fun delete(path: String): JsonElement? = call("DELETE", path, null)

    private suspend fun call(method: String, path: String, body: JsonElement?): JsonElement? =
        withContext(Dispatchers.IO) {
            val rb = body?.toString()?.toRequestBody(JSON)
                ?: if (method == "POST") "".toRequestBody(JSON) else null
            val req = Request.Builder().url(baseUrl.trimEnd('/') + path).method(method, rb).build()
            val res = try {
                http.newCall(req).execute()
            } catch (e: IOException) {
                throw ApiException.Offline(e)
            }
            res.use {
                val text = it.body?.string().orEmpty()
                val json = if (text.isBlank()) null else runCatching { RmJson.parseToJsonElement(text) }.getOrNull()
                if (it.code == 401) {
                    tokens.set(null)
                    throw ApiException.Unauthorized()
                }
                if (!it.isSuccessful) {
                    val err = (json as? JsonObject)?.get("error")?.let { e -> runCatching { e.jsonObject }.getOrNull() }
                    throw ApiException.Http(
                        it.code,
                        err?.get("code")?.jsonPrimitive?.contentOrNull,
                        err?.get("message")?.jsonPrimitive?.contentOrNull ?: "Something went wrong. Try again.",
                        json,
                    )
                }
                json
            }
        }

    private companion object { val JSON = "application/json".toMediaType() }
}
