# Anhänge in der App: Steckbrief und Varianten

Eintrag jtm-qk9. Gewählt und gebaut ist Variante 2 (Wahl des Nutzers am 2026-11-17 in tjz-jt3), Fassung 20261117.06. Die Entwürfe unten bleiben als Beleg; Befunde und Grenzen am Ende.

## Steckbrief

1. Wer und wann: der Nutzer am Handy, unterwegs, beim Antworten oder Beurteilen; nur ein Teil der Einträge hat Anhänge, etwa ein paar Mal die Woche; ein Daumen.
2. Aufgaben: sehen, was an einem Eintrag oder Nachtrag hängt (Name, Größe); ein Bild oder einen Text gleich lesen; alles andere herunterladen.
3. Zurück schließt zuerst, was offen ist, und führt dann zum Eintrag; ein geöffneter Anhang hat eine Adresse, wenn er eine eigene Seite ist.
4. Nicht Teil: Anhänge an Abnahmen (Urteil) und beim Einsortieren; Vorschau von PDF und Büroformaten; Bearbeiten; Blättern oder Zoomen wie in einer Galerie.
5. Offline: die Liste (Name, Größe) kommt aus dem Abgleich; der Inhalt nur, wenn er schon einmal geöffnet war.

## Varianten

Daten sind erfunden (ein Eintrag mit einem Bild und einer PDF, ein Nachtrag mit einer Textdatei); Bilder in 360 × 800 CSS-Pixeln, Pixeldichte 2, hell (`-hell`) und dunkel (`-dunkel`). Je Variante: Liste, Bild geöffnet, Text geöffnet. `vergleich.png` (hell) und `vergleich-dunkel.png` zeigen alle neun Zustände.

| Variante | Bilder | Wette |
| --- | --- | --- |
| 1: Anhänge beim Text, unter dem Eintragstext und unter jedem Nachtrag, mit Vorschau | `variante-1-liste`, `variante-1-bild`, `variante-1-text` | Lesen ohne Tipp: das Bild steht oben angeschnitten da, vom Text die ersten Zeilen; ein Tipp zeigt alles. |
| 2: eigener Abschnitt „Anhänge“ am Ende, Zeilen mit Herkunft, ein Tipp klappt die Zeile auf | `variante-2-liste`, `variante-2-bild`, `variante-2-text` | Ruhe: der Eintrag bleibt kurz, die Liste ist die Übersicht, der Inhalt kommt auf Wunsch. |
| 3: eine Zeile „3 Anhänge“ unter der Kopfkarte, Blatt mit der Liste, jeder Anhang auf einer eigenen Seite | `variante-3-liste`, `variante-3-bild`, `variante-3-text` | Platz: der Eintrag ändert sich kaum, jeder Anhang bekommt den ganzen Bildschirm. |

Tipps bis zum Inhalt: Variante 1 keiner für die Vorschau, einer für alles; Variante 2 einer; Variante 3 drei (Zeile, Anhang, danach Zurück).

Erwartet war Variante 1, gewählt wurde 2: der Eintrag bleibt kurz, nichts lädt, bevor der Nutzer es will.

## Gebaut: Variante 2

- Wo: Abschnitt „Anhänge (N)“ nach dem Verlauf, vor der Quelle (`js/anhaengeansicht.js`). Zeile = Symbol, Name, Größe, Art, Herkunft („vom Eintrag“, „vom Nachtrag von 14:07“); ein Tipp klappt auf. Geöffnete Zeilen bleiben bei einem Abgleich offen.
- Inhalt: Bild und Text sofort, alles andere mit **Herunterladen**. Zu große Dateien (über 1 MiB) und fehlendes Netz sagen, was hilft, mit **Erneut versuchen**.
- Hochladen: **Datei anhängen** in Erfassen und im Antwortblatt (`js/anhangwahl.js`), Liste mit **Entfernen**. Speicherung wie im Postwerkzeug; die Sendung geht samt Dateien in einem Commit raus.
- Schritte (gezählt auf den Bildern): Bild sehen 2 Tipps (Eintrag, Zeile); PDF speichern 3 (Eintrag, Zeile, Herunterladen) plus Dialog des Systems; Datei im Erfassen 3 (Datei anhängen, Auswahl, Senden); in der Antwort 4 (Antworten, Datei anhängen, Auswahl, Senden).
- Wörter, die der Nutzer verstehen muss: Anhänge, Datei anhängen, Entfernen, Herunterladen, Erneut versuchen, vom Nachtrag, Gekürzt (langer Text, nur die ersten Zeichen).
- Vorher und nachher: `vorher-` und `nachher-erfassen-*`, `vorher-` und `nachher-antworten-*` (hell, dunkel); gebaut: `gebaut-liste-hell`, `gebaut-bild-hell`, `gebaut-text-hell`, `gebaut-offline-dunkel`, `gebaut-farben-dunkel` (Palette aus Material You, Szenario `farben-anhaenge`).
- Prüfung: Rendern aller Anhangs-Szenarien hell, dunkel, Schrift 200 %, ohne Netz ohne Fehler (das Szenario mit Scroll läuft nur einzeln); Wegetest in Chromium (Abschnitt, Herunterladen, ohne Netz, Hochladen, keine CSP-Verstöße); Kaltlesen in `kaltlesen.md`.

## Befunde der Entwürfe

- Die fünf Symbole (Bild, Textdatei, Datei, Herunterladen, Anhang) stehen jetzt als Material Symbols im Sprite.
- Ein auf Zeilen gekürzter Text ohne Rahmen zählt für den Renderer nicht als abgeschnitten; ein per `max-height` gekürztes `pre` schon (Abgeschnitten, Text 200 %). Die Vorschau kürzt darum nach ganzen Zeilen.
- Lange Zeilen eines Textanhangs brechen um (`pre-wrap`); Spalten in Tabellen verrutschen dann bei schmalen Zeilen, bleiben aber lesbar. Waagerechtes Scrollen im Text gäbe es nur mit einem eigenen Griff.

## Grenzen der Technik

- CSP unverändert: Bilder als `data:`-Adresse, Herunterladen über einen Blob-Link in der Seite oder die Nachricht `speichern` der Hülle; kein `blob:` in `img-src`.
- Abgleich: der Baum nennt Name, Größe und Prüfsumme; der Inhalt kommt erst beim Aufklappen und bleibt im Speicher `anhaenge` der Datenbank (Fassung 2). Offline sichtbar ist, was schon einmal offen war.
- Größe: bis 1 MiB je Datei, Hinweis über 300 KB; Texte werden auf Geheimnisse und Personendaten geprüft wie im Werkzeug.
- Hülle: **Herunterladen** öffnet über `ACTION_CREATE_DOCUMENT` den Dialog „Speichern unter“; **Datei anhängen** nutzt `onShowFileChooser`. Beides prüft nur der Test auf dem Handy (kein Emulator).
- Geteilte Dateien (`ACTION_SEND` mit Datei) sind nicht gebaut: nötig wären ein Intent-Filter für Bild und Datei in der Manifest-Datei, Lesen von `EXTRA_STREAM` über den ContentResolver (Größe vorab, Obergrenze 1 MiB), eine Nachricht `teilen` mit Dateien an die Seite und dort der Entwurf in Erfassen mit den Anhängen.
