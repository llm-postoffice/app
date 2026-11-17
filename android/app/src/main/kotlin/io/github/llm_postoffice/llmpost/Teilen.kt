package io.github.llm_postoffice.llmpost

import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.util.Base64

/**
 * Eine Datei aus dem Teilen (ACTION_SEND, ACTION_SEND_MULTIPLE), gelesen ohne Android-Typen, damit JVM-Tests es prüfen.
 * `fehler` ist null (dann steht der Inhalt in `daten`, Base64) oder zu-gross, unlesbar, kein-zugriff; `groesse` ist -1,
 * wenn sie unbekannt ist.
 */
data class Datei(val name: String, val typ: String, val groesse: Long, val daten: String?, val fehler: String?)

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

/**
 * Liest die Dateien hinter den Adressen. Über 1 MiB gibt es keinen Inhalt, nur Name und Größe; die Größe wird vorab aus der
 * Angabe der Quelle geprüft und beim Lesen noch einmal, weil die Angabe fehlen oder falsch sein kann.
 */
fun dateienVon(adressen: List<String>, quelle: Quelle, wunschtyp: String? = null): List<Datei> = adressen.map { a ->
    val name = (quelle.name(a)?.takeIf { it.isNotEmpty() } ?: a.substringBefore('?').substringAfterLast('/').ifEmpty { "datei" }).take(NAME_LAENGE_MAX)
    val typ = listOf(quelle.typ(a), wunschtyp).firstOrNull { it != null && MIME.matches(it.lowercase()) }?.lowercase() ?: "application/octet-stream"
    val gemeldet = quelle.groesse(a)?.takeIf { it >= 0 }
    if (gemeldet != null && gemeldet > ANHANG_MAX) return@map Datei(name, typ, gemeldet, null, "zu-gross")
    val bytes = try { quelle.oeffne(a)?.use { liesBegrenzt(it) } } catch (_: Exception) { null }
        ?: return@map Datei(name, typ, gemeldet ?: -1, null, "unlesbar")
    if (bytes.size > ANHANG_MAX) Datei(name, typ, gemeldet ?: -1, null, "zu-gross")
    else Datei(name, typ, bytes.size.toLong(), Base64.getEncoder().encodeToString(bytes), null)
}

// Liest höchstens ANHANG_MAX + 1 Bytes: so erkennt die Hülle eine Datei mit falscher oder fehlender Größenangabe, ohne sie ganz zu laden
private fun liesBegrenzt(ein: InputStream): ByteArray {
    val aus = ByteArrayOutputStream()
    val puffer = ByteArray(16 * 1024)
    while (aus.size() <= ANHANG_MAX) {
        val n = ein.read(puffer, 0, minOf(puffer.size, ANHANG_MAX + 1 - aus.size()))
        if (n < 0) break
        aus.write(puffer, 0, n)
    }
    return aus.toByteArray()
}

/** Das Ziel mit den gelesenen Dateien: die abgelehnten zuerst, dann die gelesenen in der Reihenfolge des Intents. */
fun mitDateien(ziel: Ziel.Teilen, quelle: Quelle, wunschtyp: String? = null): Ziel.Teilen =
    ziel.copy(quellen = emptyList(), dateien = ziel.dateien + dateienVon(ziel.quellen, quelle, wunschtyp))

private fun jsonDatei(d: Datei): String {
    val kopf = """{"name":${jsonText(d.name)},"typ":${jsonText(d.typ)},"groesse":${if (d.groesse < 0) "null" else d.groesse.toString()}"""
    return kopf + (if (d.fehler != null) ""","fehler":${jsonText(d.fehler)}}""" else ""","daten":${jsonText(d.daten)}}""")
}

/** Der Teil der Nachricht `teilen` mit den Dateien (Protokoll im Kopf von js/huelle.js); leer, wenn es keine gibt. */
fun dateienJson(ziel: Ziel.Teilen): String =
    if (ziel.dateien.isEmpty() && ziel.mehr == 0) "" else ""","dateien":[${ziel.dateien.joinToString(",") { jsonDatei(it) }}],"mehr":${ziel.mehr}"""
