package com.rulemix.spike

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.spotify.android.appremote.api.ConnectionParams
import com.spotify.android.appremote.api.Connector
import com.spotify.android.appremote.api.SpotifyAppRemote
import com.spotify.protocol.client.CallResult
import com.spotify.sdk.android.auth.AuthorizationClient
import com.spotify.sdk.android.auth.AuthorizationRequest
import com.spotify.sdk.android.auth.AuthorizationResponse
import com.spotify.protocol.client.Subscription
import com.spotify.protocol.types.PlayerState
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Throwaway spike: can App Remote play an exact sequence with repeats, clear/replace the queue, and report state? */
class MainActivity : AppCompatActivity() {

    companion object {
        // From the QA test playlist (looked up in rulemix track_cache).
        const val HYPOCRITE = "spotify:track:1QuXuJFFDlWb7NqbPo1jwA"      // A
        const val KISSING_MOUTHS = "spotify:track:2ahVlPHe8XlXKFjL2zZLPD" // B
        const val DEMONS = "spotify:track:5qaEfEh1AtSdrdrByCP7qR"         // C
        const val RUN_CLOSER = "spotify:track:40rO5T5aZa0MlgzCetTRTn"     // D
        val NAMES = mapOf(HYPOCRITE to "A Hypocrite", KISSING_MOUTHS to "B Kissing Mouths",
            DEMONS to "C Demons", RUN_CLOSER to "D Run Closer")
    }

    private val REQ_AUTH = 1337
    private val SCOPES = arrayOf("app-remote-control", "user-modify-playback-state")
    private var authed = false
    private var connecting = false
    private var connectSeq = 0
    private var remote: SpotifyAppRemote? = null
    private var sub: Subscription<PlayerState>? = null
    private var lastUri: String? = null
    private val sequence = mutableListOf<String>()
    private val h = Handler(Looper.getMainLooper())
    private val fmt = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)
    private lateinit var logView: TextView
    private lateinit var status: TextView
    private lateinit var scroll: ScrollView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        logView = findViewById(R.id.log); status = findViewById(R.id.status); scroll = findViewById(R.id.scroll)
        findViewById<Button>(R.id.login).setOnClickListener { login(browser = false) }
        findViewById<Button>(R.id.loginBrowser).setOnClickListener { login(browser = true) }
        findViewById<Button>(R.id.connect).setOnClickListener { connect() }
        findViewById<Button>(R.id.runQueue).setOnClickListener { test1QueueRepeats() }
        findViewById<Button>(R.id.runReplace).setOnClickListener { test2Replace() }
        findViewById<Button>(R.id.runIndex).setOnClickListener { test3State() }
        findViewById<Button>(R.id.next).setOnClickListener { call("skipNext") { it.playerApi.skipNext() } }
        findViewById<Button>(R.id.prev).setOnClickListener { call("skipPrevious") { it.playerApi.skipPrevious() } }
        findViewById<Button>(R.id.pause).setOnClickListener {
            remote?.playerApi?.playerState?.setResultCallback { s ->
                if (s.isPaused) call("resume") { it.playerApi.resume() } else call("pause") { it.playerApi.pause() }
            }
        }
        findViewById<Button>(R.id.clear).setOnClickListener { logView.text = ""; sequence.clear() }
        log("clientId set: ${BuildConfig.SPOTIFY_CLIENT_ID.isNotBlank()}  redirect=${BuildConfig.REDIRECT_URI}")
        log("Spotify installed: ${SpotifyAppRemote.isSpotifyInstalled(this)}  sdkInt=${android.os.Build.VERSION.SDK_INT}")
        log("lifecycle: onCreate (no auto-connect; tap LOGIN, then it connects)")
        handleBrowserRedirect(intent)
    }

    override fun onStart() { super.onStart(); log("lifecycle: onStart") }
    override fun onResume() { super.onResume(); log("lifecycle: onResume") }
    override fun onPause() { super.onPause(); log("lifecycle: onPause") }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent); log("lifecycle: onNewIntent data=${intent.data?.scheme}://${intent.data?.host}")
        handleBrowserRedirect(intent)
    }

    private fun login(browser: Boolean) {
        val req = AuthorizationRequest.Builder(BuildConfig.SPOTIFY_CLIENT_ID, AuthorizationResponse.Type.TOKEN, BuildConfig.REDIRECT_URI)
            .setScopes(SCOPES).setShowDialog(false).build()
        log("auth: starting ${if (browser) "openLoginInBrowser" else "openLoginActivity"} scopes=${SCOPES.joinToString(" ")}")
        try {
            if (browser) AuthorizationClient.openLoginInBrowser(this, req)
            else AuthorizationClient.openLoginActivity(this, REQ_AUTH, req)
        } catch (t: Throwable) { log("auth: launch threw ${t.javaClass.simpleName}: ${t.message}") }
    }

    @Deprecated("spike")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        log("lifecycle: onActivityResult req=$requestCode result=$resultCode hasData=${data != null}")
        if (requestCode == REQ_AUTH) onAuthResponse(AuthorizationClient.getResponse(resultCode, data))
    }

    private fun handleBrowserRedirect(i: Intent?) {
        val uri = i?.data ?: return
        if (uri.scheme == "rulemix-spike") onAuthResponse(AuthorizationResponse.fromUri(uri))
    }

    private fun onAuthResponse(r: AuthorizationResponse) {
        // Never log the token itself.
        log("auth: response type=${r.type} error=${r.error} state=${r.state} expiresIn=${r.expiresIn} hasToken=${!r.accessToken.isNullOrEmpty()} hasCode=${!r.code.isNullOrEmpty()}")
        if (r.type == AuthorizationResponse.Type.TOKEN || r.type == AuthorizationResponse.Type.CODE) {
            authed = true; log("auth: OK → connecting App Remote with showAuthView(false)"); connect()
        } else log("auth: not successful; App Remote connect not attempted")
    }

    override fun onStop() {
        super.onStop(); log("lifecycle: onStop → disconnect")
        sub?.cancel(); sub = null; connecting = false; connectSeq++
        remote?.let { SpotifyAppRemote.disconnect(it) }; remote = null
        status.text = "Disconnected"
    }

    private fun connect() {
        if (remote?.isConnected == true) { log("already connected"); return }
        if (connecting) { log("connect already in progress, ignoring"); return }
        connecting = true
        val seq = ++connectSeq
        h.postDelayed({
            if (connecting && seq == connectSeq) { connecting = false; status.text = "Connect timed out"; log("connect timed out (20s, no onConnected/onFailure)") }
        }, 20_000)
        log("connect: SpotifyAppRemote.connect(showAuthView=${!authed}) seq=$seq")
        val params = ConnectionParams.Builder(BuildConfig.SPOTIFY_CLIENT_ID)
            .setRedirectUri(BuildConfig.REDIRECT_URI)
            .showAuthView(!authed)
            .build()
        status.text = "Connecting…"
        SpotifyAppRemote.connect(this, params, object : Connector.ConnectionListener {
            override fun onConnected(r: SpotifyAppRemote) {
                if (seq == connectSeq) connecting = false
                remote = r; status.text = "Connected"; log("CONNECTED")
                sub = r.playerApi.subscribeToPlayerState().setEventCallback { onState(it) } as Subscription<PlayerState>
                sub?.setErrorCallback { log("subscription error: $it") }
            }
            override fun onFailure(t: Throwable) {
                if (seq == connectSeq) connecting = false
                status.text = "Connect failed"; log("CONNECT FAILED: ${t.javaClass.simpleName}: ${t.message}")
            }
        })
    }

    private fun onState(s: PlayerState) {
        val uri = s.track?.uri
        val label = NAMES[uri] ?: s.track?.name ?: "null"
        if (uri != lastUri) {
            lastUri = uri
            sequence += label.take(1).takeIf { NAMES.containsKey(uri) } ?: label
            log("TRACK → $label ($uri) paused=${s.isPaused} shuffle=${s.playbackOptions?.isShuffling} pos=${s.playbackPosition}ms")
            log("   SEQUENCE so far: ${sequence.joinToString(",")}")
            log("   restrictions: next=${s.playbackRestrictions?.canSkipNext} prev=${s.playbackRestrictions?.canSkipPrev}")
        } else {
            status.text = "Connected · $label · ${if (s.isPaused) "paused" else "playing"} · ${s.playbackPosition / 1000}s"
        }
    }

    /** Test 1: shuffle off, play(A), then queue B,B,C,A. Expect sequence A,B,B,C,A when skipping. */
    private fun test1QueueRepeats() {
        log("=== TEST 1: play(A) then queue B,B,C,A ==="); sequence.clear(); lastUri = null
        val steps = listOf<Pair<String, (SpotifyAppRemote) -> CallResult<*>>>(
            "setShuffle(false)" to { it.playerApi.setShuffle(false) },
            "setRepeat(OFF)" to { it.playerApi.setRepeat(0) },
            "play(A)" to { it.playerApi.play(HYPOCRITE) },
            "queue(B)" to { it.playerApi.queue(KISSING_MOUTHS) },
            "queue(B) again" to { it.playerApi.queue(KISSING_MOUTHS) },
            "queue(C)" to { it.playerApi.queue(DEMONS) },
            "queue(A) again" to { it.playerApi.queue(HYPOCRITE) },
        )
        runSteps(steps, 0) { log("Test 1 queued. Tap Next ⏭ 4× (or let it play) — expected A,B,B,C,A then whatever Spotify autoplays.") }
    }

    /** Test 2: with stuff queued, play(D) — does play() clear the user queue or keep it? */
    private fun test2Replace() {
        log("=== TEST 2: queue C,C then play(D): does play() replace/clear the queue? ==="); sequence.clear(); lastUri = null
        val steps = listOf<Pair<String, (SpotifyAppRemote) -> CallResult<*>>>(
            "queue(C)" to { it.playerApi.queue(DEMONS) },
            "queue(C) again" to { it.playerApi.queue(DEMONS) },
            "play(D)" to { it.playerApi.play(RUN_CLOSER) },
        )
        runSteps(steps, 0) {
            log("Now tap Next ⏭. If next is C → queue SURVIVES play() (no clear). If not C → play() cleared it.")
            log("Note: App Remote 0.8.0 has no clearQueue/getQueue method; Web API GET /me/player/queue can cross-check.")
        }
    }

    /** Test 3: one-shot getPlayerState dump. */
    private fun test3State() {
        log("=== TEST 3: getPlayerState ===")
        remote?.playerApi?.playerState?.setResultCallback { s ->
            log("state: track=${NAMES[s.track?.uri] ?: s.track?.name} uri=${s.track?.uri} paused=${s.isPaused} " +
                "shuffle=${s.playbackOptions?.isShuffling} repeat=${s.playbackOptions?.repeatMode} " +
                "pos=${s.playbackPosition} dur=${s.track?.duration} speed=${s.playbackSpeed}")
        }?.setErrorCallback { log("getPlayerState ERROR: ${it.message}") } ?: log("not connected")
    }

    private fun runSteps(steps: List<Pair<String, (SpotifyAppRemote) -> CallResult<*>>>, i: Int, done: () -> Unit) {
        val r = remote ?: run { log("not connected — tap Connect"); return }
        if (i >= steps.size) { done(); return }
        val (name, fn) = steps[i]
        fn(r).setResultCallback {
            log("$name OK")
            h.postDelayed({ runSteps(steps, i + 1, done) }, if (name.startsWith("play")) 1500 else 400)
        }.setErrorCallback {
            log("$name ERROR: ${it.javaClass.simpleName}: ${it.message}")
            h.postDelayed({ runSteps(steps, i + 1, done) }, 400)
        }
    }

    private fun call(name: String, fn: (SpotifyAppRemote) -> CallResult<*>) {
        val r = remote ?: run { log("not connected"); return }
        fn(r).setResultCallback { log("$name OK") }.setErrorCallback { log("$name ERROR: ${it.message}") }
    }

    private fun log(msg: String) {
        logView.append("${fmt.format(Date())} $msg\n")
        scroll.post { scroll.fullScroll(ScrollView.FOCUS_DOWN) }
    }
}
