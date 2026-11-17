package io.github.llm_postoffice.llmpost

/** Was ein Intent von der App will. Gelesen ohne Android-Typen, damit JVM-Tests es prüfen. */
sealed interface Ziel {
    data class Eintrag(val id: String) : Ziel
    data object Wartet : Ziel
    data class Teilen(val titel: String, val text: String) : Ziel
}

const val SCHEMA = "llmpost"
const val TEXT_MAX = 100_000
private val ID = Regex("[0-9A-Za-z-]{1,32}")
private val URI = Regex("^([A-Za-z][A-Za-z0-9+.-]*):(.*)$", RegexOption.DOT_MATCHES_ALL)
private val EINTRAG = Regex("^eintrag/([^/]+)$", RegexOption.IGNORE_CASE)

/** aktion = Intent.action, daten = Intent.dataString, typ = Intent.type, text = EXTRA_TEXT, betreff = EXTRA_SUBJECT */
fun zielVon(aktion: String?, daten: String?, typ: String?, text: String?, betreff: String?): Ziel? = when (aktion) {
    "android.intent.action.VIEW" -> adresseAus(daten)
    "android.intent.action.SEND" ->
        if (typ == "text/plain" && !text.isNullOrBlank()) Ziel.Teilen((betreff ?: "").take(TEXT_MAX), text.take(TEXT_MAX)) else null
    else -> null
}

// llmpost://eintrag/ID öffnet den Eintrag, jede andere Adresse mit dem Schema öffnet Wartet; fremde Schemata nichts
private fun adresseAus(daten: String?): Ziel? {
    val teile = URI.find(daten ?: return null) ?: return null
    if (!teile.groupValues[1].equals(SCHEMA, ignoreCase = true)) return null
    val pfad = teile.groupValues[2].removePrefix("//").substringBefore('?').substringBefore('#').trimEnd('/')
    val id = EINTRAG.find(pfad)?.groupValues?.get(1)
    return if (id != null && ID.matches(id)) Ziel.Eintrag(id) else Ziel.Wartet
}

/** Die Adresse der Web-App für den Start mit diesem Ziel. */
fun adresseVon(ziel: Ziel): String = when (ziel) {
    is Ziel.Eintrag -> "#eintrag/${ziel.id}"
    Ziel.Wartet -> "#wartet"
    is Ziel.Teilen -> "#erfassen"
}

/** Die Nachricht an die Seite (Protokoll im Kopf von js/huelle.js). */
fun nachrichtVon(ziel: Ziel): String = when (ziel) {
    is Ziel.Teilen -> """{"art":"teilen","titel":${jsonText(ziel.titel)},"text":${jsonText(ziel.text)}}"""
    else -> """{"art":"oeffnen","adresse":${jsonText(adresseVon(ziel))}}"""
}

fun antwortToken(nr: Int, token: String?): String = """{"nr":$nr,"art":"token","token":${jsonText(token)}}"""
fun antwortOk(nr: Int): String = """{"nr":$nr,"art":"ok"}"""
fun antwortFehler(nr: Int): String = """{"nr":$nr,"art":"fehler"}"""

/** Ein Text als JSON-Zeichenkette; null wird null. */
fun jsonText(s: String?): String {
    if (s == null) return "null"
    val b = StringBuilder(s.length + 2).append('"')
    for (c in s) when {
        c == '"' -> b.append("\\\"")
        c == '\\' -> b.append("\\\\")
        c == '\n' -> b.append("\\n")
        c == '\r' -> b.append("\\r")
        c == '\t' -> b.append("\\t")
        c < ' ' || c == '\u2028' || c == '\u2029' -> b.append("\\u").append(String.format("%04x", c.code))
        else -> b.append(c)
    }
    return b.append('"').toString()
}
