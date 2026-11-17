package io.github.llm_postoffice.llmpost

/**
 * Systemfarben (Material You) für die Seite, gelesen ohne Android-Typen, damit JVM-Tests es prüfen.
 *
 * Android liefert Tonpaletten (android.R.color.system_accent1_0 … system_neutral2_1000). Diese Tabelle ordnet Töne den Rollen
 * von app.css zu (Material-3-Standard); die Rollen heißen wie die Variablen dort ohne `--`. Arten, Zustände und Kennung der
 * App bleiben fest. Dieselbe Tabelle steht in tests/hilfen/farbrollen.mjs; tests/farbrollen.test.mjs vergleicht beide.
 */
data class Rolle(val name: String, val hellPalette: String, val hellTon: Int, val dunkelPalette: String, val dunkelTon: Int)

val ROLLEN = listOf(
    Rolle("akzent", "accent1", 600, "accent1", 200),
    Rolle("auf-akzent", "accent1", 0, "accent1", 800),
    Rolle("tonal", "accent1", 100, "accent1", 700),
    Rolle("auf-tonal", "accent1", 900, "accent1", 100),
    Rolle("grund", "neutral1", 10, "neutral1", 900),
    Rolle("flaeche", "neutral1", 50, "neutral1", 800),
    Rolle("text", "neutral1", 900, "neutral1", 100),
    Rolle("neben", "neutral2", 700, "neutral2", 200),
    Rolle("linie", "neutral2", 200, "neutral2", 700),
    Rolle("umgekehrt", "neutral1", 800, "neutral1", 100),
    Rolle("auf-umgekehrt", "neutral1", 50, "neutral1", 800),
    Rolle("hinweis-knopf", "accent1", 200, "accent1", 600),
)

/** Der Name der Systemfarbe in den Ressourcen von Android, etwa system_accent1_600. */
fun systemfarbe(palette: String, ton: Int): String = "system_${palette}_$ton"

/** Die Nachricht an die Seite (Protokoll im Kopf von js/huelle.js). `farbe` liefert die Farbe (ARGB) eines Tons oder null. */
fun farbenNachricht(farbe: (palette: String, ton: Int) -> Int?): String? {
    fun schema(hell: Boolean): String? {
        val teile = ROLLEN.map { r ->
            val f = (if (hell) farbe(r.hellPalette, r.hellTon) else farbe(r.dunkelPalette, r.dunkelTon)) ?: return null
            "\"${r.name}\":\"${hex(f)}\""
        }
        return teile.joinToString(",", "{", "}")
    }
    val hell = schema(true) ?: return null
    val dunkel = schema(false) ?: return null
    return """{"art":"farben","hell":$hell,"dunkel":$dunkel}"""
}

/** Eine Farbe als #rrggbb in Kleinbuchstaben, ohne Alpha. */
fun hex(argb: Int): String = String.format("#%06x", argb and 0xFFFFFF)
