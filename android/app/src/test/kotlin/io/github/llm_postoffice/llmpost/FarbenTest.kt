package io.github.llm_postoffice.llmpost

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Die Zuordnung der Systemtöne zu den Rollen von app.css und die Nachricht an die Seite, ohne Android. */
class FarbenTest {
    // Eine erfundene Palette: jede Kombination aus Palette und Ton hat ihre eigene Farbe
    private val palettenNamen = listOf("accent1", "accent2", "accent3", "neutral1", "neutral2")
    private fun farbe(palette: String, ton: Int): Int = 0xFF000000.toInt() or (palettenNamen.indexOf(palette) * 0x10000 + ton)

    private fun nachricht() = farbenNachricht { p, t -> farbe(p, t) }!!

    @Test fun hexIstKleingeschriebenOhneAlpha() {
        assertEquals("#006e18", hex(0xFF006E18.toInt()))
        assertEquals("#000000", hex(0xFF000000.toInt()))
        assertEquals("#ffffff", hex(-1))
    }

    @Test fun systemfarbeHeisstWieDieRessource() = assertEquals("system_accent1_600", systemfarbe("accent1", 600))

    @Test fun akzentFolgtMaterial3() {
        val n = nachricht()
        assertTrue(n.contains("\"hell\":{\"akzent\":\"${hex(farbe("accent1", 600))}\""))
        val dunkel = n.substringAfter("\"dunkel\":")
        assertTrue(dunkel.startsWith("{\"akzent\":\"${hex(farbe("accent1", 200))}\""))
    }

    @Test fun jedeRolleStehtInHellUndDunkelEinmal() {
        val n = nachricht()
        val hell = n.substringAfter("\"hell\":").substringBefore("\"dunkel\":")
        val dunkel = n.substringAfter("\"dunkel\":")
        for (r in ROLLEN) {
            assertEquals(r.name, 1, Regex("\"${r.name}\":").findAll(hell).count())
            assertEquals(r.name, 1, Regex("\"${r.name}\":").findAll(dunkel).count())
        }
        assertEquals(12, ROLLEN.size)
        assertEquals(ROLLEN.size, ROLLEN.map { it.name }.toSet().size)
    }

    @Test fun artenUndZustaendeBleibenFest() {
        val n = nachricht()
        for (fest in listOf("frage", "freigabe", "abnahme", "auftrag", "nachricht", "f-", "w-", "ok-", "id")) {
            assertFalse(fest, n.contains("\"$fest"))
        }
    }

    @Test fun ohneFarbeEinesTonsKeineNachricht() {
        assertNull(farbenNachricht { p, t -> if (p == "neutral2" && t == 700) null else farbe(p, t) })
        assertNull(farbenNachricht { _, _ -> null })
    }

    @Test fun dieNachrichtIstGueltigesJson() {
        val n = nachricht()
        assertNotNull(n)
        assertTrue(n.startsWith("{\"art\":\"farben\",\"hell\":{"))
        assertTrue(n.endsWith("}}"))
        assertEquals(n.count { it == '{' }, n.count { it == '}' })
        assertEquals(ROLLEN.size * 2, Regex("\"#[0-9a-f]{6}\"").findAll(n).count())
    }

    @Test fun dunkelNimmtDieTonleiterDesDunklen() {
        val d = ROLLEN.first { it.name == "grund" }
        assertEquals("neutral1", d.hellPalette); assertEquals(10, d.hellTon)
        assertEquals("neutral1", d.dunkelPalette); assertEquals(900, d.dunkelTon)
    }
}
