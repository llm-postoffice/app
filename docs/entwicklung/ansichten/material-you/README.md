# Material You: Steckbrief und Varianten

Entwurf zum Eintrag g4g-r2g, Schritte 1 und 2 der Schleife für eine neue Ansicht; Wahl und Bau stehen noch aus.

## Steckbrief

1. Wer und wann: der Nutzer am Handy mit der Android-Hülle, mehrmals am Tag; die App soll zur Farbwelt des Handys passen.
2. Aufgabe: nichts Neues zu bedienen; was wartet, antworten, beurteilen, erledigen bleibt, wie es ist. Die Farben folgen dem Hintergrundbild.
3. Ab Android 12 gibt die Hülle die Tonpaletten des Systems über die Brücke (neue Nachrichtenart) an die Seite; `app.css` legt seine Rollen darauf, hell und dunkel.
4. Nicht Teil: die Web-App auf Pages und Android unter 12 (feste Farben bleiben); eigene Farbwahl in der App; Farben für Arten und Zustände aus dem System.
5. Offen: ob GrapheneOS dynamische Farben anbietet (kommt aus AOSP, ANGENOMMEN); das ist auf dem Handy zu prüfen.

## Varianten

Bilder in 448 × 923 CSS-Pixeln (hier auf halbe Breite verkleinert), Wartet und Eintrag (Frage), hell und dunkel, mit drei erfundenen Paletten
(Grün, Orange, Violett). Die Paletten sind nachgebaut (`tests/hilfen/farbrollen.mjs`): Töne und Farbton wie bei Monet, Buntheit angenähert.
Übersicht aller Varianten: `vergleich.png`.

| Variante | Bilder | Wette |
| --- | --- | --- |
| A: nur Akzente aus dem System (Knöpfe, Chips, Auswahl, Links, aktiver Reiter, Zahl) | `variante-a-PALETTE-wartet-hell.png` und so weiter | Die App bleibt ruhig und vertraut, nimmt aber die Farbe des Handys auf. |
| B: auch Flächen und Text aus dem System (Grund, Karten, Linien, Hinweis, Text) | `variante-b-PALETTE-…` | Die App sieht aus wie ein Teil des Systems; Karten und Grund tragen einen leichten Farbstich. |
| C: feste Farben wie heute | `variante-c-wartet-hell.png` und so weiter | Zum Vergleich; Pages und Android unter 12 bleiben so. |

PALETTE ist `gruen`, `orange` oder `violett`. Erwartete Wahl: A. Die Arten (Frage, Freigabe, Abnahme, Auftrag, Nachricht) und die Zustände
(dringend, Warnung, ok) bleiben in beiden Varianten fest, weil die Farbe dort etwas bedeutet; drei Systemfarben können fünf Arten nicht
unterscheiden. B bringt dafür den größten Wiedererkennungswert, kostet aber einen leichten Stich in jeder Fläche.

## Zuordnung der Töne

Material-3-Standard aus den Systemtönen (Hell / Dunkel):

| Rolle in `app.css` | Hell | Dunkel | Variante |
| --- | --- | --- | --- |
| `--akzent` | accent1 600 | accent1 200 | A, B |
| `--auf-akzent` | accent1 0 | accent1 800 | A, B |
| `--tonal`, `--auf-tonal` | accent1 100, 900 | accent1 700, 100 | A, B |
| `--grund` | neutral1 10 | neutral1 900 | B |
| `--flaeche` | neutral1 50 | neutral1 800 | B |
| `--text`, `--neben` | neutral1 900, neutral2 700 | neutral1 100, neutral2 200 | B |
| `--linie` | neutral2 200 | neutral2 700 | B |
| `--umgekehrt`, `--auf-umgekehrt` | neutral1 800, 50 | neutral1 100, 800 | B |
| Aktion im Hinweis | accent1 200 | accent1 600 | A, B |

accent2 und accent3 braucht kein Entwurf; sie kämen für Nachricht oder Chips infrage.

## Befunde

- Der Renderer meldet für alle sieben Szenarien (drei Paletten je Variante und C), beide Ansichten, beide Größen, hell, dunkel, Schrift 200 % und ohne Netz nur PASS, auch beim Kontrast (je 15 von 15).
- `node tools/farbkontrast.mjs --alles` rechnet die Paare nach, auch die festen Rollen auf den neuen Flächen: kein Paar unter 4,5:1 (Text) und 3:1 (Symbole). Das ist kein Zufall: jede Paarung von Systemtönen liegt mindestens 50 Töne (L*) auseinander, das gibt in jedem Farbton mindestens 4,5:1. Die Garantie gilt für die Töne der Palette, nicht für Farben, die Hersteller verändern.
- Eine harte Farbe stört: `.hinweis button` setzt im Dunkeln `#0b57d0`. Die Vorschau überschreibt sie mit einer Rolle für die Aktion im Hinweis; im Bau wird daraus eine Variable.
- Die Vorschau setzt die Werte über das CSSOM (`style.setProperty`, ein `CSSStyleSheet`); die CSP bleibt, wie sie ist. Im Bau gilt dasselbe für die Werte der Hülle.
- Die Farbe der Statusleiste (`theme-color`) bleibt fest; in B müsste sie mitwandern.

## Wahl

Steht aus. Die Frage liegt bei claude-post.
