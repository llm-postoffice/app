package io.github.llm_postoffice.llmpost

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Das Lesen der Intents (Links llmpost://, Teilen) und die Nachrichten an die Seite, ohne Android. */
class ZielTest {
    private val view = "android.intent.action.VIEW"
    private val send = "android.intent.action.SEND"
    private fun link(d: String?) = zielVon(view, d, null, null, null)

    @Test fun linkMitIdOeffnetDenEintrag() {
        val z = link("llmpost://eintrag/K7M-2QA")
        assertEquals(Ziel.Eintrag("K7M-2QA"), z)
        assertEquals("#eintrag/K7M-2QA", adresseVon(z!!))
    }

    @Test fun jedeAndereAdresseOeffnetWartet() {
        for (d in listOf("llmpost://wartet", "llmpost://irgendwas/x", "llmpost://eintrag/", "llmpost://eintrag/a%2Fb",
            "llmpost://eintrag/" + "a".repeat(33), "llmpost:")) {
            assertEquals(d, Ziel.Wartet, link(d))
        }
    }

    @Test fun schemaOhneGrossKleinUndOhneAnhang() {
        assertEquals(Ziel.Eintrag("x1"), link("LLMPOST://eintrag/x1"))
        assertEquals(Ziel.Eintrag("x1"), link("llmpost://eintrag/x1/?a=b#c"))
    }

    @Test fun fremdeSchemataUndAndereAktionenNichts() {
        assertNull(link("https://example.org/#eintrag/x1"))
        assertNull(link(null))
        assertNull(zielVon("android.intent.action.MAIN", "llmpost://wartet", null, null, null))
    }

    @Test fun teilenNurMitText() {
        assertEquals(Ziel.Teilen("Seite", "Hallo"), zielVon(send, null, "text/plain", "Hallo", "Seite"))
        assertEquals(Ziel.Teilen("", "Hallo"), zielVon(send, null, "text/plain", "Hallo", null))
        assertNull(zielVon(send, null, "text/plain", null, "Seite"))
        assertNull(zielVon(send, null, "text/plain", "  ", "Seite"))
        assertNull(zielVon(send, null, "image/png", "Hallo", "Seite"))
        val lang = zielVon(send, null, "text/plain", "x".repeat(100_001), null) as Ziel.Teilen
        assertEquals(TEXT_MAX, lang.text.length)
    }

    @Test fun nachrichtZumOeffnen() {
        assertEquals("""{"art":"oeffnen","adresse":"#eintrag/K7M-2QA"}""", nachrichtVon(Ziel.Eintrag("K7M-2QA")))
        assertEquals("""{"art":"oeffnen","adresse":"#wartet"}""", nachrichtVon(Ziel.Wartet))
    }

    @Test fun nachrichtZumTeilenMitEscapes() {
        assertEquals(
            """{"art":"teilen","titel":"a\"b","text":"z1\nz2\\\u0001\u2028😀"}""",
            nachrichtVon(Ziel.Teilen("a\"b", "z1\nz2\\\u0001\u2028😀")),
        )
    }

    @Test fun antwortenAufFragenDerSeite() {
        assertEquals("""{"nr":3,"art":"token","token":null}""", antwortToken(3, null))
        assertEquals("""{"nr":4,"art":"token","token":"x"}""", antwortToken(4, "x"))
        assertEquals("""{"nr":5,"art":"ok"}""", antwortOk(5))
        assertEquals("""{"nr":6,"art":"fehler"}""", antwortFehler(6))
    }
}
