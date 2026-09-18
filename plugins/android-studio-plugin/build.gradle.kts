plugins {
    id("java")
    kotlin("jvm") version "1.9.24"
    id("org.jetbrains.intellij") version "1.17.4"
}

group = "io.nutritrack"
version = "1.0.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.google.code.gson:gson:2.10.1")
}

// Configure Gradle IntelliJ Plugin
intellij {
    version.set("2024.1.4")
    type.set("IC")
    plugins.set(listOf("com.intellij.gradle"))
}

tasks {
    withType<JavaCompile> {
        sourceCompatibility = "17"
        targetCompatibility = "17"
    }
    withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
        kotlinOptions.jvmTarget = "17"
    }

    patchPluginXml {
        sinceBuild.set("231")
        untilBuild.set(provider { null })
    }

    signPlugin {
        enabled = false
    }

    publishPlugin {
        enabled = false
    }
}
