// Android-Hülle von LLM-Post: ein Modul app mit einer WebView, die die Web-App aus dem Repo als Assets mitbringt.
// Bau und Werkzeuge: docs/entwicklung/huelle.md
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    // Holt das JDK für den Bau (gradle/gradle-daemon-jvm.properties), wenn es noch fehlt
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "llm-post"
include(":app")
