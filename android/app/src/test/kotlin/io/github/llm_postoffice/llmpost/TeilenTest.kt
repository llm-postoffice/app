package io.github.llm_postoffice.llmpost

import java.io.ByteArrayInputStream
import java.io.InputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Das Lesen geteilter Dateien (eine, mehrere, zu groß, ohne Freigabe) und die Nachricht `teilen`, ohne Android. */
class TeilenTest {
    private val send = "android.intent.action.SEND"
    private val mehrere = "android.intent.action.SEND_MULTIPLE"

    /** Eine Attrappe: Adresse -> (Name, Typ, gemeldete Größe, Bytes oder null für nicht lesbar). */
    private class Attrappe(val dateien: Map<String, Quadrupel>) : Quelle {
        class Quadrupel(val name: String?, val typ: String?, val groesse: Long?, val bytes: ByteArray?)
        var geoeffnet = 0
        override fun name(adresse: String) = dateien[adresse]?.name
        override fun groesse(adresse: String) = dateien[adresse]?.groesse
        override fun typ(adresse: String) = dateien[adresse]?.typ
        override fun oeffne(adresse: String): InputStream? { geoeffnet++; return dateien[adresse]?.bytes?.let { ByteArrayInputStream(it) } }
    }

    private fun datei(name: String?, typ: String?, bytes: ByteArray?, gemeldet: Long? = bytes?.size?.toLong()) = Attrappe.Quadrupel(name, typ, gemeldet, bytes)

    @Test fun eineDateiOhneTextIstEinZiel() {
        val z = zielVon(send, null, "image/jpeg", null, null, listOf("content://fotos/1"), true) as Ziel.Teilen
        assertEquals(listOf("content://fotos/1"), z.quellen)
        assertEquals("", z.text)
        assertTrue(z.dateien.isEmpty())
        assertEquals(0, z.mehr)
    }

    @Test fun textZuDateienBleibtDieUnterschrift() {
        val z = zielVon(send, null, "image/png", "Siehe Bild", "Betreff", listOf("content://a/1"), true) as Ziel.Teilen
        assertEquals("Siehe Bild", z.text)
        assertEquals("Betreff", z.titel)
        assertNull(zielVon(send, null, "image/png", "Siehe Bild", "Betreff"))
    }

    @Test fun mehrereDateienInDerReihenfolgeDesIntents() {
        val z = zielVon(mehrere, null, "*/*", null, null, listOf("content://a/1", "content://a/2", "content://a/3"), true) as Ziel.Teilen
        assertEquals(listOf("content://a/1", "content://a/2", "content://a/3"), z.quellen)
    }

    @Test fun ueberDerGrenzeZaehltNurMehr() {
        val adressen = List(DATEIEN_MAX + 3) { "content://a/$it" }
        val z = zielVon(mehrere, null, "*/*", null, null, adressen, true) as Ziel.Teilen
        assertEquals(adressen.take(DATEIEN_MAX), z.quellen)
        assertEquals(3, z.mehr)
    }

    @Test fun ohneFreigabeUndOhneContentSchemaWirdNichtGelesen() {
        val ohne = zielVon(send, null, "image/png", null, null, listOf("content://a/1"), false) as Ziel.Teilen
        assertTrue(ohne.quellen.isEmpty())
        assertEquals(listOf("kein-zugriff"), ohne.dateien.map { it.fehler })
        val fremd = zielVon(mehrere, null, "*/*", null, null, listOf("file:///sdcard/a.png", "content://a/2", "https://example.org/a.png"), true) as Ziel.Teilen
        assertEquals(listOf("content://a/2"), fremd.quellen)
        assertEquals(listOf("kein-zugriff", "kein-zugriff"), fremd.dateien.map { it.fehler })
        val q = Attrappe(emptyMap())
        mitDateien(ohne, q)
        assertEquals("ohne Freigabe wird nie geöffnet", 0, q.geoeffnet)
    }

    @Test fun nichtsZuTeilenIstKeinZiel() {
        assertNull(zielVon(send, null, "image/png", null, null))
        assertNull(zielVon(mehrere, null, "*/*", " ", null))
    }

    @Test fun gelesenWirdMitNameTypUndBase64() {
        val q = Attrappe(mapOf("content://a/1" to datei("Foto 1.jpg", "image/jpeg", byteArrayOf(1, 2, 3))))
        val d = dateienVon(listOf("content://a/1"), q).single()
        assertEquals(Datei("Foto 1.jpg", "image/jpeg", 3, "AQID", null, BILD_MAX.toLong()), d)
    }

    @Test fun namenUndTypenAusErsatzquellen() {
        val q = Attrappe(mapOf(
            "content://a/Beleg.pdf?x=1" to datei(null, null, byteArrayOf(0)),
            "content://a/2" to datei("", "kein typ", byteArrayOf(0)),
        ))
        val d = dateienVon(listOf("content://a/Beleg.pdf?x=1", "content://a/2"), q, "application/pdf")
        assertEquals("Beleg.pdf", d[0].name)
        assertEquals("application/pdf", d[0].typ)
        assertEquals("2", d[1].name)
        assertEquals("application/pdf", d[1].typ)
        assertEquals("application/octet-stream", dateienVon(listOf("content://a/2"), q)[0].typ)
    }

    @Test fun genauEinMebibyteGehtDurch() {
        val bytes = ByteArray(ANHANG_MAX)
        val d = dateienVon(listOf("content://a/1"), Attrappe(mapOf("content://a/1" to datei("a.bin", "application/octet-stream", bytes)))).single()
        assertNull(d.fehler)
        assertEquals(ANHANG_MAX.toLong(), d.groesse)
    }

    @Test fun zuGrossLiestNichtsUndMeldetNameUndGroesse() {
        val q = Attrappe(mapOf("content://a/1" to datei("gross.pdf", "application/pdf", null, ANHANG_MAX + 1L)))
        val d = dateienVon(listOf("content://a/1"), q).single()
        assertEquals(Datei("gross.pdf", "application/pdf", ANHANG_MAX + 1L, null, "zu-gross"), d)
        assertEquals("die Größe wird vorab geprüft", 0, q.geoeffnet)
    }

    @Test fun zuGrossAuchOhneGroessenangabe() {
        val q = Attrappe(mapOf("content://a/1" to datei("gross.pdf", "application/pdf", ByteArray(ANHANG_MAX + 1), null)))
        val d = dateienVon(listOf("content://a/1"), q).single()
        assertEquals("zu-gross", d.fehler)
        assertNull(d.daten)
        assertEquals(-1L, d.groesse)
    }

    @Test fun unlesbarWennDieQuelleNichtOeffnet() {
        val q = Attrappe(mapOf("content://a/1" to datei("weg.pdf", "application/pdf", null, 10)))
        assertEquals("unlesbar", dateienVon(listOf("content://a/1"), q).single().fehler)
    }

    @Test fun einFehlerhaltDieAnderenNichtAuf() {
        val q = Attrappe(mapOf(
            "content://a/1" to datei("gross.pdf", "application/pdf", null, ANHANG_MAX + 1L),
            "content://a/2" to datei("klein.txt", "text/plain", "Hallo".toByteArray()),
        ))
        val z = mitDateien(Ziel.Teilen("", "", listOf("content://a/1", "content://a/2")), q)
        assertTrue(z.quellen.isEmpty())
        assertEquals(listOf("zu-gross", null), z.dateien.map { it.fehler })
    }

    @Test fun nachrichtMitDateien() {
        val z = Ziel.Teilen("T", "X", dateien = listOf(Datei("a\"b.txt", "text/plain", 5, "SGFsbG8=", null), Datei("gross.png", "image/png", 2_000_000, null, "zu-gross"), Datei("Datei", "application/octet-stream", -1, null, "kein-zugriff")), mehr = 2)
        assertEquals(
            """{"art":"teilen","titel":"T","text":"X","dateien":[""" +
                """{"name":"a\"b.txt","typ":"text/plain","groesse":5,"daten":"SGFsbG8="},""" +
                """{"name":"gross.png","typ":"image/png","groesse":2000000,"fehler":"zu-gross","grenze":1048576},""" +
                """{"name":"Datei","typ":"application/octet-stream","groesse":null,"fehler":"kein-zugriff"}],"mehr":2}""",
            nachrichtVon(z),
        )
    }

    private val MiB = 1024 * 1024

    /** Eine Attrappe, die beim Lesen eine Ausnahme wirft. */
    private class Kaputt : InputStream() { override fun read(): Int = throw java.io.IOException("weg") }

    @Test fun einBildBisZwanzigMebibyteWirdGelesen() {
        val bytes = ByteArray(3 * MiB) { (it % 251).toByte() }
        val d = dateiVon("content://a/1", Attrappe(mapOf("content://a/1" to datei("IMG_1.jpg", "image/jpeg", bytes))))
        assertNull(d.fehler)
        assertEquals(3L * MiB, d.groesse)
        assertEquals(java.util.Base64.getEncoder().encodeToString(bytes), d.daten)
    }

    @Test fun einBildOhneTypGiltNachDerEndung() {
        val d = dateiVon("content://a/1", Attrappe(mapOf("content://a/1" to datei("IMG_1.JPG", null, ByteArray(2 * MiB)))))
        assertNull(d.fehler)
        assertEquals("application/octet-stream", d.typ)
    }

    @Test fun einBildUeberZwanzigMebibyteIstZuGrossMitGrenze() {
        val q = Attrappe(mapOf("content://a/1" to datei("riesig.jpg", "image/jpeg", null, BILD_MAX + 1L)))
        val d = dateiVon("content://a/1", q)
        assertEquals(Datei("riesig.jpg", "image/jpeg", BILD_MAX + 1L, null, "zu-gross", BILD_MAX.toLong()), d)
        assertEquals(0, q.geoeffnet)
    }

    @Test fun einBildOhneGroessenangabeUeberDerGrenzeIstZuGross() {
        val q = Attrappe(mapOf("content://a/1" to datei("riesig.png", "image/png", ByteArray(BILD_MAX + 1), null)))
        val d = dateiVon("content://a/1", q)
        assertEquals("zu-gross", d.fehler)
        assertEquals(BILD_MAX.toLong(), d.grenze)
    }

    @Test fun einePdfUeberEinemMebibyteBleibtZuGrossMitGrenzeEinMebibyte() {
        val q = Attrappe(mapOf("content://a/1" to datei("bericht.pdf", "application/pdf", null, 2L * MiB)))
        val d = dateiVon("content://a/1", q)
        assertEquals("zu-gross", d.fehler)
        assertEquals(ANHANG_MAX.toLong(), d.grenze)
        val ohne = dateiVon("content://a/1", Attrappe(mapOf("content://a/1" to datei("bericht.pdf", "application/pdf", ByteArray(2 * MiB), null))))
        assertEquals("zu-gross", ohne.fehler)
        assertNull(ohne.daten)
    }

    @Test fun einGifBleibtBeiEinemMebibyte() {
        val d = dateiVon("content://a/1", Attrappe(mapOf("content://a/1" to datei("anim.gif", "image/gif", null, 2L * MiB))))
        assertEquals("zu-gross", d.fehler)
        assertEquals(ANHANG_MAX.toLong(), d.grenze)
    }

    @Test fun eineFalscheKleineGroessenangabeSchuetztNichtVorZuVielInhalt() {
        val q = Attrappe(mapOf("content://a/1" to datei("a.pdf", "application/pdf", ByteArray(2 * MiB), 10L)))
        assertEquals("zu-gross", dateiVon("content://a/1", q).fehler)
    }

    @Test fun eineZuGrosseAngabeBeiKurzemInhaltLiefertDenKurzenInhalt() {
        val q = Attrappe(mapOf("content://a/1" to datei("a.txt", "text/plain", ByteArray(5), 900L)))
        val d = dateiVon("content://a/1", q)
        assertNull(d.fehler)
        assertEquals(5L, d.groesse)
    }

    @Test fun einLesefehlerMachtDieDateiUnlesbarUndWirftNicht() {
        val q = object : Quelle {
            override fun name(adresse: String) = "kaputt.pdf"
            override fun groesse(adresse: String): Long? = null
            override fun typ(adresse: String) = "application/pdf"
            override fun oeffne(adresse: String): InputStream = Kaputt()
        }
        val d = dateiVon("content://a/1", q)
        assertEquals(Datei("kaputt.pdf", "application/pdf", -1, null, "unlesbar"), d)
    }

    @Test fun nachrichtenKommenEineNachDerAnderenUndLesenTraege() {
        val q = Attrappe(mapOf(
            "content://a/1" to datei("gross.pdf", "application/pdf", null, 2L * MiB),
            "content://a/2" to datei("klein.txt", "text/plain", "Hallo".toByteArray()),
            "content://a/3" to datei("foto.jpg", "image/jpeg", ByteArray(3 * MiB)),
        ))
        val z = Ziel.Teilen("", "", listOf("content://a/1", "content://a/2", "content://a/3"))
        val es = nachrichten(z, q).iterator()
        assertEquals("ohne Titel, Text und Ablehnung gibt es keine Kopf-Nachricht", 0, q.geoeffnet)
        val eins = es.next()
        assertTrue(eins.contains(""""name":"gross.pdf"""") && eins.contains(""""fehler":"zu-gross","grenze":1048576"""))
        assertEquals("die Größe sagt es vorab, nichts wird geöffnet", 0, q.geoeffnet)
        val zwei = es.next()
        assertTrue(zwei.contains(""""name":"klein.txt"""") && zwei.contains(""""daten":"SGFsbG8="""") && zwei.contains(""""mehr":0"""))
        assertEquals("die dritte Datei ist noch nicht gelesen", 1, q.geoeffnet)
        val drei = es.next()
        assertTrue(drei.contains(""""name":"foto.jpg"""") && drei.contains(""""groesse":${3 * MiB}"""))
        assertEquals(2, q.geoeffnet)
        assertTrue(!es.hasNext())
    }

    @Test fun nachrichtenBeginnenMitTextUndAbgelehnten() {
        val z = Ziel.Teilen("T", "X", listOf("content://a/1"), listOf(Datei("Datei", "application/octet-stream", -1, null, "kein-zugriff")), mehr = 2)
        val q = Attrappe(mapOf("content://a/1" to datei("a.txt", "text/plain", "A".toByteArray())))
        val alle = nachrichten(z, q).toList()
        assertEquals(2, alle.size)
        assertTrue(alle[0].startsWith("""{"art":"teilen","titel":"T","text":"X","dateien":[{"name":"Datei"""") && alle[0].endsWith(""""mehr":2}"""))
        assertTrue(alle[1].contains(""""name":"a.txt""""))
        assertEquals(1, nachrichten(Ziel.Teilen("T", "X"), q).count())
    }

    @Test fun nachrichtOhneDateienBleibtWieBisher() {
        assertEquals("""{"art":"teilen","titel":"T","text":"X"}""", nachrichtVon(Ziel.Teilen("T", "X")))
    }
}
