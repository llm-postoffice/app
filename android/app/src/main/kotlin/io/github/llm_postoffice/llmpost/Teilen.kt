package io.github.llm_postoffice.llmpost

import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.util.Base64

/**
 * Eine Datei aus dem Teilen (ACTION_SEND, ACTION_SEND_MULTIPLE), gelesen ohne Android-Typen, damit JVM-Tests es prüfen.
 * `fehler` ist null (dann steht der Inhalt in `daten`, Base64) oder zu-gross, unlesbar, kein-zugriff; `groesse` ist -1,
 * wenn sie unbekannt ist. `grenze` ist die Größe, über der die Datei zu groß ist (ANHANG_MAX, für Bilder BILD_MAX).
 */
data class Datei(val name: String, val typ: String, val groesse: Long, val daten: String?, val fehler: String?, val grenze: Long = ANHANG_MAX.toLong())

/** Bis zu dieser Größe liest die Hülle ein Bild; die Seite verkleinert es auf ANHANG_MAX (js/verkleinern.js). */
const val BILD_MAX = 20 * 1024 * 1024
private val BILD_TYP = Regex("^image/(jpeg|png|webp|heic|heif)$")
private val BILD_ENDUNG = setOf("jpg", "jpeg", "png", "webp", "heic", "heif")

/** Ob die Seite ein Bild dieser Art verkleinern kann (JPEG, PNG, WebP, HEIC/HEIF); wie verkleinerbar in js/anhaenge.js. */
internal fun verkleinerbar(name: String, typ: String): Boolean =
    if (typ.startsWith("image/")) BILD_TYP.matches(typ) else name.substringAfterLast('.', "").lowercase() in BILD_ENDUNG

/** So viele Dateien nimmt die Hülle aus einem Teilen; die Web-App (ANHAENGE_TEILEN_MAX in js/anhaenge.js) nimmt ebenso viele. */
const val DATEIEN_MAX = 10
private const val NAME_LAENGE_MAX = 255

/** Der Zugriff auf eine Datei hinter einer content://-Adresse; die Hülle setzt den ContentResolver ein, Tests eine Attrappe. */
interface Quelle {
    fun name(adresse: String): String?
    fun groesse(adresse: String): Long?
    fun typ(adresse: String): String?
    fun oeffne(adresse: String): InputStream?
}

/** Was aus den Adressen eines Intents wird: lesbare Adressen, abgelehnte Dateien und die Zahl derer über der Grenze. */
data class Adressen(val lesbar: List<String>, val abgelehnt: List<Datei>, val mehr: Int)

/**
 * Aus den Adressen eines Intents: die lesbaren content://-Adressen (höchstens DATEIEN_MAX), die abgelehnten als Dateien mit
 * dem Fehler kein-zugriff und die Zahl derer, die über die Grenze hinausgehen. Ohne Lesefreigabe des Intents
 * (FLAG_GRANT_READ_URI_PERMISSION) wird nichts gelesen.
 */
fun streamAdressen(adressen: List<String>, freigabe: Boolean): Adressen {
    val genommen = adressen.take(DATEIEN_MAX)
    val lesbar = if (freigabe) genommen.filter { it.startsWith("content://", ignoreCase = true) } else emptyList()
    val abgelehnt = List(genommen.size - lesbar.size) { Datei("Datei", "application/octet-stream", -1, null, "kein-zugriff") }
    return Adressen(lesbar, abgelehnt, adressen.size - genommen.size)
}

private sealed interface Gelesen {
    class Bytes(val bytes: ByteArray) : Gelesen
    data object ZuGross : Gelesen
    data object Fehler : Gelesen
}

/**
 * Liest die Datei hinter einer Adresse. Über der Grenze (1 MiB, für Bilder 20 MiB) gibt es keinen Inhalt, nur Name und Größe;
 * die Größe wird vorab aus der Angabe der Quelle geprüft und beim Lesen noch einmal, weil die Angabe fehlen oder falsch sein
 * kann. Ein Lesefehler macht die Datei zu `unlesbar`, nie zu einer Ausnahme.
 */
fun dateiVon(a: String, quelle: Quelle, wunschtyp: String? = null): Datei {
    val name = (quelle.name(a)?.takeIf { it.isNotEmpty() } ?: a.substringBefore('?').substringAfterLast('/').ifEmpty { "datei" }).take(NAME_LAENGE_MAX)
    val typ = listOf(quelle.typ(a), wunschtyp).firstOrNull { it != null && MIME.matches(it.lowercase()) }?.lowercase() ?: "application/octet-stream"
    val grenze = if (verkleinerbar(name, typ)) BILD_MAX else ANHANG_MAX
    val gemeldet = quelle.groesse(a)?.takeIf { it >= 0 }
    if (gemeldet != null && gemeldet > grenze) return Datei(name, typ, gemeldet, null, "zu-gross", grenze.toLong())
    val gelesen: Gelesen? = try {
        quelle.oeffne(a)?.use { liesBegrenzt(it, grenze, gemeldet) }
    } catch (_: Exception) {
        Gelesen.Fehler
    } catch (_: OutOfMemoryError) {
        Gelesen.Fehler
    }
    return when (gelesen) {
        null, Gelesen.Fehler -> Datei(name, typ, gemeldet ?: -1, null, "unlesbar", grenze.toLong())
        Gelesen.ZuGross -> Datei(name, typ, gemeldet ?: -1, null, "zu-gross", grenze.toLong())
        is Gelesen.Bytes -> try {
            Datei(name, typ, gelesen.bytes.size.toLong(), Base64.getEncoder().encodeToString(gelesen.bytes), null, grenze.toLong())
        } catch (_: OutOfMemoryError) {
            Datei(name, typ, gemeldet ?: -1, null, "unlesbar", grenze.toLong())
        }
    }
}

/** Liest die Dateien hinter den Adressen (dateiVon je Adresse). */
fun dateienVon(adressen: List<String>, quelle: Quelle, wunschtyp: String? = null): List<Datei> = adressen.map { dateiVon(it, quelle, wunschtyp) }

// Liest höchstens `grenze` Bytes und erkennt ein Byte mehr: so erkennt die Hülle eine Datei mit falscher oder fehlender
// Größenangabe, ohne sie ganz zu laden. Mit passender Angabe wird der Puffer genau so groß angelegt (bei 20 MiB zählt jede Kopie).
private fun liesBegrenzt(ein: InputStream, grenze: Int, erwartet: Long?): Gelesen {
    if (erwartet != null && erwartet <= grenze) {
        val roh = ByteArray(erwartet.toInt())
        var n = 0
        while (n < roh.size) {
            val r = ein.read(roh, n, roh.size - n)
            if (r < 0) break
            n += r
        }
        if (n == roh.size && ein.read() >= 0) return Gelesen.ZuGross
        return Gelesen.Bytes(if (n == roh.size) roh else roh.copyOf(n))
    }
    val aus = ByteArrayOutputStream()
    val puffer = ByteArray(16 * 1024)
    while (aus.size() <= grenze) {
        val n = ein.read(puffer, 0, minOf(puffer.size, grenze + 1 - aus.size()))
        if (n < 0) break
        aus.write(puffer, 0, n)
    }
    return if (aus.size() > grenze) Gelesen.ZuGross else Gelesen.Bytes(aus.toByteArray())
}

/** Das Ziel mit den gelesenen Dateien: die abgelehnten zuerst, dann die gelesenen in der Reihenfolge des Intents. */
fun mitDateien(ziel: Ziel.Teilen, quelle: Quelle, wunschtyp: String? = null): Ziel.Teilen =
    ziel.copy(quellen = emptyList(), dateien = ziel.dateien + dateienVon(ziel.quellen, quelle, wunschtyp))

// Base64 braucht keine Maskierung; der Inhalt wird ohne Umweg über jsonText angehängt (bei 20 MiB zählt jede Kopie)
private fun jsonDatei(d: Datei): String {
    val b = StringBuilder((d.daten?.length ?: 0) + 256)
    b.append("""{"name":""").append(jsonText(d.name)).append(""","typ":""").append(jsonText(d.typ)).append(""","groesse":""").append(if (d.groesse < 0) "null" else d.groesse.toString())
    if (d.fehler != null) {
        b.append(""","fehler":""").append(jsonText(d.fehler))
        if (d.fehler == "zu-gross") b.append(""","grenze":""").append(d.grenze)
    } else {
        b.append(""","daten":"""").append(d.daten).append('"')
    }
    return b.append('}').toString()
}

/** Der Teil der Nachricht `teilen` mit den Dateien (Protokoll im Kopf von js/huelle.js); leer, wenn es keine gibt. */
fun dateienJson(ziel: Ziel.Teilen): String =
    if (ziel.dateien.isEmpty() && ziel.mehr == 0) "" else ""","dateien":[${ziel.dateien.joinToString(",") { jsonDatei(it) }}],"mehr":${ziel.mehr}"""

private fun unlesbar(name: String) =
    """{"art":"teilen","titel":"","text":"","dateien":[{"name":${jsonText(name)},"typ":"application/octet-stream","groesse":null,"fehler":"unlesbar"}],"mehr":0}"""

/**
 * Die Nachrichten `teilen` zu einem Ziel, eine nach der anderen gelesen: die Folge ist träge, eine Datei wird erst gelesen, wenn
 * die Seite die vorige mit `weiter` quittiert hat, und nur eine ist je Zeitpunkt im Speicher. Zuerst Titel, Text, abgelehnte
 * Dateien und `mehr`, falls es etwas davon gibt, dann je Adresse eine Nachricht mit einer Datei.
 */
fun nachrichten(ziel: Ziel.Teilen, quelle: Quelle, wunschtyp: String? = null): Sequence<String> = sequence {
    val kopf = ziel.copy(quellen = emptyList())
    if (ziel.quellen.isEmpty() || ziel.titel.isNotBlank() || ziel.text.isNotBlank() || ziel.dateien.isNotEmpty() || ziel.mehr > 0) yield(nachrichtVon(kopf))
    for (a in ziel.quellen) {
        val d = dateiVon(a, quelle, wunschtyp)
        yield(try { nachrichtVon(Ziel.Teilen("", "", dateien = listOf(d))) } catch (_: OutOfMemoryError) { unlesbar(d.name) })
    }
}
