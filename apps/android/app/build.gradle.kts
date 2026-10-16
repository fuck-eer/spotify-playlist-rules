import java.io.File

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
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

fun apiBaseUrl(): String = System.getenv("RULEMIX_API_BASE_URL")?.takeIf { it.isNotBlank() }
    ?: "https://rulemix.vercel.app"

android {
    namespace = "com.rulemix.app"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.rulemix.app"
        minSdk = 26
        targetSdk = 33 // App Remote / Android 14 login workaround (ADR-0025 context, spike)
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "SPOTIFY_CLIENT_ID", "\"${spotifyClientId()}\"")
        buildConfigField("String", "API_BASE_URL", "\"${apiBaseUrl()}\"")
        buildConfigField("String", "REDIRECT_URI", "\"rulemix://callback\"")
        manifestPlaceholders["redirectSchemeName"] = "rulemix"
        manifestPlaceholders["redirectHostName"] = "callback"
        manifestPlaceholders["redirectPathPattern"] = ".*"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildFeatures {
        buildConfig = true
        compose = true
    }
    composeOptions { kotlinCompilerExtensionVersion = libs.versions.composeCompiler.get() }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    testOptions { unitTests.isIncludeAndroidResources = true }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}

dependencies {
    implementation(project(":engine"))
    implementation(files("libs/spotify-app-remote-release-0.8.0.aar"))
    implementation(files("libs/spotify-auth-release-2.1.0.aar"))
    implementation(libs.gson) // required by app-remote
    implementation(libs.browser) // required by auth

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    implementation(libs.compose.animation)
    implementation(libs.activity.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.serialization.json)
    implementation(libs.coroutines.android)
    implementation(libs.okhttp)
    implementation(libs.coil.compose)
    implementation(libs.security.crypto)

    testImplementation(libs.junit4)
    testImplementation(libs.robolectric)
    testImplementation(libs.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(platform(libs.compose.bom))
    testImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
}
