package io.github.llm_postoffice.llmpost

import java.util.Base64

/** Eine Datei, die die Seite über die Nachricht `speichern` (Protokoll im Kopf von js/huelle.js) ablegen lassen will. */
class Speichern(val name: String, val typ: String, val daten: ByteArray)

/** So viele Bytes darf ein Anhang haben (1 MiB, wie im Postwerkzeug); größere legt die Hülle nicht ab. */
const val ANHANG_MAX = 1024 * 1024
internal val MIME = Regex("^[a-z0-9][a-z0-9.+-]{0,60}/[a-z0-9][a-z0-9.+-]{0,100}$")
private const val NAME_MAX = 100

/**
 * Prüft die Angaben der Seite. Der Name ist ein Dateiname ohne Pfad, höchstens 100 Zeichen; ein unbekannter oder
 * ungültiger Typ wird application/octet-stream; ohne gültiges Base64 oder über 1 MiB gibt es null.
 */
fun speichernVon(name: String?, typ: String?, daten: String?): Speichern? {
    if (name.isNullOrEmpty() || name.length > NAME_MAX || name.startsWith(".")) return null
    if (name.any { it == '/' || it == '\\' || it < ' ' || it == '\u007f' }) return null
    if (daten == null || daten.length > ANHANG_MAX / 3 * 4 + 8) return null
    val bytes = try { Base64.getDecoder().decode(daten) } catch (_: IllegalArgumentException) { return null }
    if (bytes.size > ANHANG_MAX) return null
    val art = typ?.lowercase()?.takeIf { MIME.matches(it) } ?: "application/octet-stream"
    return Speichern(name, art, bytes)
}

fun antwortAbgebrochen(nr: Int): String = """{"nr":$nr,"art":"abgebrochen"}"""
