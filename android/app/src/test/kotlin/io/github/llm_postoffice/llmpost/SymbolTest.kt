package io.github.llm_postoffice.llmpost

import java.io.File
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Das Symbol der Hülle: Quelle tools/symbol.svg, Bilder aus make symbole. */
class SymbolTest {
    private fun ganzzahl(b: ByteArray, ab: Int) =
        (0 until 4).fold(0) { n, i -> (n shl 8) or (b[ab + i].toInt() and 0xff) }

    @Test fun vordergrundIstEinPngMit432Pixeln() {
        val b = File("src/main/res/drawable-nodpi/symbol_vorne.png").readBytes()
        val signatur = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
        assertArrayEquals(signatur, b.copyOfRange(0, 8))
        assertEquals(432, ganzzahl(b, 16))
        assertEquals(432, ganzzahl(b, 20))
    }

    @Test fun adaptivesSymbolHatDreiEbenen() {
        val xml = File("src/main/res/mipmap-anydpi/symbol.xml").readText()
        for (ebene in listOf(
            "<background android:drawable=\"@color/symbol\"",
            "<foreground android:drawable=\"@drawable/symbol_vorne\"",
            "<monochrome android:drawable=\"@drawable/symbol_vorne\"",
        )) assertTrue(ebene, xml.contains(ebene))
    }
}
