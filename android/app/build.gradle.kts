// App-Modul der Android-Hülle. versionName ist die Fassung aus js/version.js, versionCode dieselbe Zahl ohne Punkt.
// webDateien kopiert beim Bau dieselben Dateien wie DATEIEN in sw.js in die Assets unter web/.
plugins {
    id("com.android.application")
}

val web: File = rootDir.parentFile
val fassung: String = Regex("""VERSION = '(\d{8}\.\d{2})'""")
    .find(web.resolve("js/version.js").readText())?.groupValues?.get(1)
    ?: error("js/version.js nennt keine Fassung der Form YYYYMMDD.NN")

android {
    namespace = "io.github.llm_postoffice.llmpost"
    compileSdk = 37
    defaultConfig {
        applicationId = "io.github.llm_postoffice.llmpost"
        minSdk = 33
        targetSdk = 36
        versionName = fassung
        versionCode = fassung.replace(".", "").toInt()
    }
    buildFeatures {
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.18.0")
    testImplementation("junit:junit:4.13.2")
}

/** Kopiert die Web-App in die Assets (web/), damit die WebView sie ohne Netz zeigt. */
abstract class WebDateien : DefaultTask() {
    @get:InputFiles @get:PathSensitive(PathSensitivity.RELATIVE) abstract val dateien: ConfigurableFileCollection
    @get:Internal abstract val wurzel: DirectoryProperty
    @get:Input abstract val muster: ListProperty<String>
    @get:OutputDirectory abstract val ziel: DirectoryProperty
    @get:Inject abstract val fs: FileSystemOperations

    @TaskAction
    fun kopiere() {
        fs.sync {
            from(wurzel) { include(muster.get()) }
            into(ziel.dir("web"))
        }
    }
}

val webMuster = listOf("index.html", "app.css", "manifest.webmanifest", "js/**", "symbole/**")
val webDateien = tasks.register<WebDateien>("webDateien") {
    wurzel.set(web)
    muster.set(webMuster)
    dateien.from(fileTree(web) { include(webMuster) })
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(webDateien, WebDateien::ziel)
    }
}
