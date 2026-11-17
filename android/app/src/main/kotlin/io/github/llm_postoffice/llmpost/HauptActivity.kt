package io.github.llm_postoffice.llmpost

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.view.WindowInsets
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import android.window.OnBackInvokedDispatcher
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.io.File
import java.util.concurrent.Executors
import org.json.JSONException
import org.json.JSONObject

/** Die einzige Ansicht der Hülle: eine WebView mit LLM-Post aus den Assets, Herkunft appassets.androidplatform.net. */
class HauptActivity : Activity() {
    private var web: WebView? = null
    private val arbeiter = Executors.newSingleThreadExecutor()
    private val tresor by lazy { Tresor(File(noBackupFilesDir, "token.bin")) }
    private var antwort: JavaScriptReplyProxy? = null
    private var anstehend: Ziel? = null
    private var gesendeteFarben: String? = null
    private var speichern: Offen? = null
    private var dateiAuswahl: ValueCallback<Array<Uri>>? = null
    private class Offen(val nr: Int, val datei: Speichern, val proxy: JavaScriptReplyProxy)
    private val lader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Ab Android 15 gilt Rand zu Rand für targetSdk 35 und höher ohnehin; nur Android 13 und 14 brauchen den Aufruf
        @Suppress("DEPRECATION")
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) window.setDecorFitsSystemWindows(false)
        val rahmen = FrameLayout(this)
        // Die App zeichnet unter die Leisten; der Rahmen hält die WebView frei von Leisten, Aussparung und Tastatur
        rahmen.setOnApplyWindowInsetsListener { v, insets ->
            val r = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout() or WindowInsets.Type.ime())
            v.setPadding(r.left, r.top, r.right, r.bottom)
            WindowInsets.CONSUMED
        }
        setContentView(rahmen)
        val w = try {
            WebView(this)
        } catch (e: RuntimeException) {
            // Ohne WebView des Systems (abgeschaltet oder mitten im Update) kann die Hülle nichts zeigen
            Toast.makeText(this, R.string.webview_fehlt, Toast.LENGTH_LONG).show()
            finish()
            return
        }
        web = w
        w.setBackgroundColor(getColor(R.color.grund))
        w.settings.javaScriptEnabled = true
        w.settings.domStorageEnabled = true
        w.settings.allowFileAccess = false
        w.settings.allowContentAccess = false
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        w.webViewClient = Klient()
        w.webChromeClient = object : WebChromeClient() {
            // <input type=file> der Seite (Datei anhängen): die Dateiauswahl des Systems; jeder Aufruf wird beantwortet
            override fun onShowFileChooser(view: WebView, rueckruf: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                dateiAuswahl?.onReceiveValue(null)
                dateiAuswahl = rueckruf
                return try {
                    startActivityForResult(params.createIntent(), ANFRAGE_DATEI)
                    true
                } catch (_: ActivityNotFoundException) {
                    dateiAuswahl = null
                    rueckruf.onReceiveValue(null)
                    true
                }
            }
        }
        rahmen.addView(w, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) {
            // Zurück geht durch den Verlauf der App (ein Blatt schließt zuerst); ganz oben verlässt es die App
            val v = web
            if (v != null && v.canGoBack()) v.goBack() else moveTaskToBack(true)
        }
        // Brücke zur Web-App: Objekt llmpost vor dem ersten Skript, nur Herkunft der Assets, nur Hauptframe (js/huelle.js)
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(w, BRUECKE, setOf("https://$HOST")) { _, nachricht, herkunft, hauptframe, proxy ->
                if (hauptframe && herkunft.scheme == "https" && herkunft.host == HOST) nachricht.data?.let { verarbeite(it, proxy) }
            }
        }
        // Ein Link oder geteilter Text beim Start; nach Neuaufbau oder Start aus den letzten Apps gilt der alte Intent nicht
        val neu = savedInstanceState == null && (intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) == 0
        val ziel = if (neu) zielAus(intent) else null
        if (ziel is Ziel.Teilen) liefere(ziel)
        if (savedInstanceState == null || w.restoreState(savedInstanceState) == null) w.loadUrl(START + (ziel?.let(::adresseVon) ?: ""))
    }

    private fun zielAus(intent: Intent?): Ziel? = intent?.let {
        zielVon(
            it.action, it.dataString, it.type, it.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString(), it.getCharSequenceExtra(Intent.EXTRA_SUBJECT)?.toString(),
            streamsAus(it), (it.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION) != 0,
        )
    }

    // Die Adressen der geteilten Dateien: EXTRA_STREAM (eine oder eine Liste), sonst die ClipData; ein fehlerhaftes Extra zählt als leer
    private fun streamsAus(intent: Intent): List<String> {
        val adressen = try {
            when (intent.action) {
                Intent.ACTION_SEND -> listOfNotNull(intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java))
                Intent.ACTION_SEND_MULTIPLE -> intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
                else -> emptyList()
            }
        } catch (_: RuntimeException) { emptyList() }
        if (adressen.isNotEmpty() || (intent.action != Intent.ACTION_SEND && intent.action != Intent.ACTION_SEND_MULTIPLE)) return adressen.map { it.toString() }
        val klammer = intent.clipData ?: return emptyList()
        return (0 until klammer.itemCount).mapNotNull { klammer.getItemAt(it).uri?.toString() }
    }

    // Liest die Dateien eines Teilens abseits der Oberfläche und liefert dann; die Freigabe des Intents gilt, solange die Activity lebt
    private fun liefere(ziel: Ziel.Teilen) {
        if (ziel.quellen.isEmpty()) { zustelle(ziel); return }
        val quelle = InhaltsQuelle(contentResolver)
        arbeiter.execute {
            val fertig = mitDateien(ziel, quelle)
            runOnUiThread { if (!isDestroyed) zustelle(fertig) }
        }
    }

    // Auf der Oberfläche: an die Seite, sobald sie bereit ist (bereit holt `anstehend` nach)
    private fun zustelle(ziel: Ziel.Teilen) {
        val p = antwort
        if (p != null) p.postMessage(nachrichtVon(ziel)) else anstehend = ziel
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val ziel = zielAus(intent) ?: return
        if (ziel is Ziel.Teilen) liefere(ziel)
        else { val p = antwort; if (p != null) p.postMessage(nachrichtVon(ziel)) else anstehend = ziel }
    }

    private fun verarbeite(text: String, proxy: JavaScriptReplyProxy) {
        val m = try { JSONObject(text) } catch (_: JSONException) { return }
        val nr = m.optInt("nr", 0)
        // Unbekannte Arten übergeht die Hülle; weitere Werte an die Seite kommen als neue Art dazu
        when (m.optString("art")) {
            "bereit" -> {
                antwort = proxy
                gesendeteFarben = null
                sendeFarben()
                anstehend?.let { proxy.postMessage(nachrichtVon(it)) }
                anstehend = null
            }
            "token-holen" -> arbeiter.execute {
                val t = tresor.lies()
                runOnUiThread { if (!isDestroyed) proxy.postMessage(antwortToken(nr, t)) }
            }
            "speichern" -> {
                // Eine Datei der Seite ablegen: der Nutzer wählt Ort und Namen im Dialog des Systems (Storage Access Framework)
                val s = speichernVon(m.optString("name"), m.optString("typ"), m.optString("daten"))
                if (s == null || speichern != null) { proxy.postMessage(antwortFehler(nr)); return }
                speichern = Offen(nr, s, proxy)
                try {
                    startActivityForResult(
                        Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(s.typ).putExtra(Intent.EXTRA_TITLE, s.name),
                        ANFRAGE_SPEICHERN,
                    )
                } catch (_: ActivityNotFoundException) {
                    speichern = null
                    proxy.postMessage(antwortFehler(nr))
                }
            }
            "token-setzen" -> {
                val t = if (m.isNull("token")) null else m.optString("token").ifEmpty { null }
                arbeiter.execute {
                    val ok = (t == null || t.length <= TOKEN_MAX) && runCatching { tresor.setze(t) }.isSuccess
                    runOnUiThread { if (!isDestroyed) proxy.postMessage(if (ok) antwortOk(nr) else antwortFehler(nr)) }
                }
            }
        }
    }

    /** Die Systemfarben (Material You) als Nachricht an die Seite; ohne Wert eines Tons (kommt ab Android 12 nicht vor) nichts. */
    private fun systemfarben(): String? = farbenNachricht { palette, ton ->
        val id = resources.getIdentifier(systemfarbe(palette, ton), "color", "android")
        if (id == 0) null else getColor(id)
    }

    /** Schickt die Farben, wenn die Seite bereit ist und sich etwas geändert hat. */
    private fun sendeFarben() {
        val p = antwort ?: return
        val n = systemfarben() ?: return
        if (n == gesendeteFarben) return
        gesendeteFarben = n
        p.postMessage(n)
    }

    // Ein anderes Hintergrundbild oder der Wechsel von Hell und Dunkel kann die Activity neu aufbauen (die Seite meldet sich dann mit
    // bereit); bleibt sie bestehen, holt die Rückkehr in den Vordergrund die neuen Farben nach.
    override fun onResume() {
        super.onResume()
        sendeFarben()
    }

    @Deprecated("Eine Activity ohne AndroidX kennt nur diesen Weg")
    override fun onActivityResult(anfrage: Int, ergebnis: Int, daten: Intent?) {
        super.onActivityResult(anfrage, ergebnis, daten)
        when (anfrage) {
            ANFRAGE_SPEICHERN -> {
                val o = speichern ?: return
                speichern = null
                val ziel = daten?.data
                if (ergebnis != RESULT_OK || ziel == null) { o.proxy.postMessage(antwortAbgebrochen(o.nr)); return }
                arbeiter.execute {
                    val ok = runCatching { contentResolver.openOutputStream(ziel, "wt")?.use { it.write(o.datei.daten) } != null }.getOrDefault(false)
                    runOnUiThread { if (!isDestroyed) o.proxy.postMessage(if (ok) antwortOk(o.nr) else antwortFehler(o.nr)) }
                }
            }
            ANFRAGE_DATEI -> {
                // Die Antwort muss immer kommen, sonst öffnet die WebView nie wieder eine Dateiauswahl
                val f = dateiAuswahl ?: return
                dateiAuswahl = null
                f.onReceiveValue(if (ergebnis == RESULT_OK) WebChromeClient.FileChooserParams.parseResult(ergebnis, daten) else null)
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web?.saveState(outState)
    }

    override fun onDestroy() {
        dateiAuswahl?.onReceiveValue(null)
        dateiAuswahl = null
        web?.destroy()
        web = null
        arbeiter.shutdown()
        super.onDestroy()
    }

    private inner class Klient : WebViewClient() {
        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            antwort = null   // eine neue Seite meldet sich mit bereit neu
            gesendeteFarben = null
        }

        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
            lader.shouldInterceptRequest(request.url)

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url
            if (url.scheme == "https" && url.host == HOST) return false
            // Links nach draußen öffnet der Browser; andere Schemata lädt die Hülle nicht
            if (url.scheme == "https" || url.scheme == "http") {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE))
                } catch (_: ActivityNotFoundException) {
                }
            }
            return true
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            // Der Renderer ist abgestürzt oder wurde beendet: WebView verwerfen, Ansicht neu aufbauen
            (view.parent as? ViewGroup)?.removeView(view)
            view.destroy()
            web = null
            recreate()
            return true
        }
    }

    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val START = "https://$HOST/assets/web/index.html"
        const val BRUECKE = "llmpost"
        const val TOKEN_MAX = 4096
        const val ANFRAGE_SPEICHERN = 41
        const val ANFRAGE_DATEI = 42
    }
}
