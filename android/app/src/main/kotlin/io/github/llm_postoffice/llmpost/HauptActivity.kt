package io.github.llm_postoffice.llmpost

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.os.Bundle
import android.view.ViewGroup
import android.view.WindowInsets
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import android.window.OnBackInvokedDispatcher
import androidx.webkit.WebViewAssetLoader

/** Die einzige Ansicht der Hülle: eine WebView mit LLM-Post aus den Assets, Herkunft appassets.androidplatform.net. */
class HauptActivity : Activity() {
    private var web: WebView? = null
    private val lader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setDecorFitsSystemWindows(false)
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
        rahmen.addView(w, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) {
            // Zurück geht durch den Verlauf der App (ein Blatt schließt zuerst); ganz oben verlässt es die App
            val v = web
            if (v != null && v.canGoBack()) v.goBack() else moveTaskToBack(true)
        }
        if (savedInstanceState == null || w.restoreState(savedInstanceState) == null) w.loadUrl(START)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web?.saveState(outState)
    }

    override fun onDestroy() {
        web?.destroy()
        web = null
        super.onDestroy()
    }

    private inner class Klient : WebViewClient() {
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
    }
}
