package io.github.llm_postoffice.llmpost

import java.util.Base64
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/** Das Prüfen der Nachricht `speichern`, ohne Android. */
class SpeichernTest {
    private fun b64(b: ByteArray) = Base64.getEncoder().encodeToString(b)

    @Test fun gueltigeDateiKommtMitBytesAnUndBehaeltDenTyp() {
        val s = speichernVon("Befund (1).pdf", "application/pdf", b64(byteArrayOf(0, 1, 2, -1)))!!
        assertEquals("Befund (1).pdf", s.name)
        assertEquals("application/pdf", s.typ)
        assertArrayEquals(byteArrayOf(0, 1, 2, -1), s.daten)
    }

    @Test fun ungueltigerTypWirdOctetStream() {
        for (t in listOf(null, "", "pdf", "text/plain; charset=utf-8", "a/b/c", "X Y/z")) {
            assertEquals(t, "application/octet-stream", speichernVon("a.bin", t, b64(byteArrayOf(1)))!!.typ)
        }
        assertEquals("image/png", speichernVon("a.png", "IMAGE/PNG", b64(byteArrayOf(1)))!!.typ)
    }

    @Test fun nameOhnePfadUndSteuerzeichen() {
        for (n in listOf(null, "", ".versteckt", "../x.txt", "a/b.txt", "a\\b.txt", "a\nb.txt", "a\u0000b", "x".repeat(101))) {
            assertNull(n, speichernVon(n, "text/plain", b64(byteArrayOf(1))))
        }
        assertNotNull(speichernVon("x".repeat(100), "text/plain", b64(byteArrayOf(1))))
    }

    @Test fun leereDateiGehtDurch() {
        assertEquals(0, speichernVon("leer.txt", "text/plain", "")!!.daten.size)
    }

    @Test fun kaputtesBase64UndZuGrossNichts() {
        assertNull(speichernVon("a.txt", "text/plain", "***"))
        assertNull(speichernVon("a.txt", "text/plain", null))
        assertNotNull(speichernVon("a.bin", null, b64(ByteArray(ANHANG_MAX))))
        assertNull(speichernVon("a.bin", null, b64(ByteArray(ANHANG_MAX + 1))))
        assertNull(speichernVon("a.bin", null, "A".repeat(ANHANG_MAX * 2)))
    }

    @Test fun antwortSindJson() {
        assertEquals("""{"nr":7,"art":"abgebrochen"}""", antwortAbgebrochen(7))
    }
}
