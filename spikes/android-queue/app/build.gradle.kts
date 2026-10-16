import java.io.File

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Client ID is read at build time (never committed): env SPOTIFY_CLIENT_ID, or
// SPOTIFY_ENV_FILE pointing at apps/web/.env.local.
fun spotifyClientId(): String {
    System.getenv("SPOTIFY_CLIENT_ID")?.let { if (it.isNotBlank()) return it }
    val f = System.getenv("SPOTIFY_ENV_FILE")?.let { File(it) } ?: return ""
    if (!f.exists()) return ""
    return f.readLines().firstOrNull { it.startsWith("SPOTIFY_CLIENT_ID=") }
        ?.substringAfter("=")?.trim()?.trim('"') ?: ""
}

android {
    namespace = "com.rulemix.spike"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.rulemix.spike"
        minSdk = 26
        targetSdk = 33 // Android 14 BAL block workaround (spotify/android-sdk#361, #377)
        versionCode = 2
        versionName = "0.2-spike"
        buildConfigField("String", "SPOTIFY_CLIENT_ID", "\"${spotifyClientId()}\"")
        buildConfigField("String", "REDIRECT_URI", "\"rulemix-spike://callback\"")
        manifestPlaceholders["redirectSchemeName"] = "rulemix-spike"
        manifestPlaceholders["redirectHostName"] = "callback"
        manifestPlaceholders["redirectPathPattern"] = ".*"
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(files("libs/spotify-app-remote-release-0.8.0.aar"))
    implementation(files("libs/spotify-auth-release-2.1.0.aar"))
    implementation("com.google.code.gson:gson:2.10.1") // required by app-remote
    implementation("androidx.browser:browser:1.7.0")   // required by auth
    implementation("androidx.appcompat:appcompat:1.6.1")
}
