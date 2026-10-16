plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

kotlin { jvmToolchain(17) }

dependencies {
    implementation(libs.serialization.json)
    testImplementation(platform("org.junit:junit-bom:5.10.2"))
    testImplementation(libs.junit5.api)
    testImplementation(libs.junit5.params)
    testRuntimeOnly(libs.junit5.engine)
    testRuntimeOnly(libs.junit5.launcher)
}

// The shared fixtures are the contract (ADR-0031): same files as the TS engine.
sourceSets["test"].resources.srcDir("../../../packages/rules-engine/fixtures")

tasks.test {
    useJUnitPlatform()
    systemProperty("rulemix.engineDir", file("../../../packages/rules-engine").absolutePath)
    inputs.dir("../../../packages/rules-engine/fixtures")
}
