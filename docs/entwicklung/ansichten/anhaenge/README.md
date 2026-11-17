# Anhänge in der App: Steckbrief und Varianten

Entwurf zum Eintrag jtm-qk9, Schritte 1 und 2 der Schleife für eine neue Ansicht; die Wahl steht noch aus, gebaut ist nichts.

## Steckbrief

1. Wer und wann: der Nutzer am Handy, unterwegs, beim Antworten oder Beurteilen; nur ein Teil der Einträge hat Anhänge, etwa ein paar Mal die Woche; ein Daumen.
2. Aufgaben: sehen, was an einem Eintrag oder Nachtrag hängt (Name, Größe); ein Bild oder einen Text gleich lesen; alles andere herunterladen.
3. Zurück schließt zuerst, was offen ist, und führt dann zum Eintrag; ein geöffneter Anhang hat eine Adresse, wenn er eine eigene Seite ist.
4. Nicht Teil: Anhänge vom Handy aus anlegen oder senden; Vorschau von PDF und Büroformaten; Bearbeiten; Blättern oder Zoomen wie in einer Galerie.
5. Offline: die Liste (Name, Größe) kommt aus dem Abgleich; der Inhalt nur, wenn er schon einmal geöffnet war.

## Varianten

Daten sind erfunden (ein Eintrag mit einem Bild und einer PDF, ein Nachtrag mit einer Textdatei); Bilder in 360 × 800 CSS-Pixeln, Pixeldichte 2, hell (`-hell`) und dunkel (`-dunkel`). Je Variante: Liste, Bild geöffnet, Text geöffnet. `vergleich.png` (hell) und `vergleich-dunkel.png` zeigen alle neun Zustände.

| Variante | Bilder | Wette |
| --- | --- | --- |
| 1: Anhänge beim Text, unter dem Eintragstext und unter jedem Nachtrag, mit Vorschau | `variante-1-liste`, `variante-1-bild`, `variante-1-text` | Lesen ohne Tipp: das Bild steht oben angeschnitten da, vom Text die ersten Zeilen; ein Tipp zeigt alles. |
| 2: eigener Abschnitt „Anhänge“ am Ende, Zeilen mit Herkunft, ein Tipp klappt die Zeile auf | `variante-2-liste`, `variante-2-bild`, `variante-2-text` | Ruhe: der Eintrag bleibt kurz, die Liste ist die Übersicht, der Inhalt kommt auf Wunsch. |
| 3: eine Zeile „3 Anhänge“ unter der Kopfkarte, Blatt mit der Liste, jeder Anhang auf einer eigenen Seite | `variante-3-liste`, `variante-3-bild`, `variante-3-text` | Platz: der Eintrag ändert sich kaum, jeder Anhang bekommt den ganzen Bildschirm. |

Tipps bis zum Inhalt: Variante 1 keiner für die Vorschau, einer für alles; Variante 2 einer; Variante 3 drei (Zeile, Anhang, danach Zurück).

Erwartete Wahl: 1. Anhänge werden beim Antworten gebraucht (ein Bildschirmfoto, eine Messung), und nur 1 zeigt sie ohne Tipp. 2 ist die Rückfallwahl, wenn die Seite durch Vorschauen zu lang oder das Laden beim Öffnen zu teuer wird.

## Befunde der Entwürfe

- Die Symbole Bild, Textdatei, Datei, Herunterladen und Anhang fehlen im Sprite; die Entwürfe zeichnen eigene Platzhalter, im Bau kommen sie aus Material Symbols Rounded.
- Ein auf Zeilen gekürzter Text ohne Rahmen zählt für den Renderer nicht als abgeschnitten; ein per `max-height` gekürztes `pre` schon (Abgeschnitten, Text 200 %). Die Vorschau kürzt darum nach ganzen Zeilen.
- Lange Zeilen eines Textanhangs brechen um (`pre-wrap`); Spalten in Tabellen verrutschen dann bei schmalen Zeilen, bleiben aber lesbar. Waagerechtes Scrollen im Text gäbe es nur mit einem eigenen Griff.

## Grenzen der Technik

- Bilder: `img-src 'self' data:` steht schon in der CSP. Ein Anhang kommt über die Blob-Abfrage der GitHub-API (`api.github.com`, in `connect-src`) als Base64 und wird als `data:`-Adresse gezeigt; die CSP muss sich nicht ändern. `blob:` wäre nur nötig, wenn Bilder aus `URL.createObjectURL` kommen sollen (dann `img-src 'self' data: blob:`); `raw.githubusercontent.com` bliebe gesperrt und wird nicht gebraucht.
- Abgleich: `liestApp` (js/abgleich.js) lässt Anhänge heute weg, obwohl der Baum sie samt Größe nennt. Die Liste braucht nur Name, Größe und Prüfsumme aus dem Baum, keinen Inhalt; der Inhalt würde erst beim Öffnen geladen.
- Offline: ohne eigenen Speicher nur bei Netz. Vorschlag: geöffnete Anhänge in einem neuen Speicher der Datenbank (Fassung 2) behalten, bis zu einer Obergrenze; die Liste steht immer da.
- Größe: bis 1 MiB je Datei, als Base64 etwa 1,4 MB; Text wird nach Zeilen gekürzt, das Bild lädt erst beim Sehen.
- Herunterladen: im Browser geht `a[download]` mit einer Adresse aus dem Blob. In der Android-Hülle fehlt ein `DownloadListener`, ein Tipp tut dort nichts. Gebraucht wird eine Nachricht der Brücke (Name, Typ, Inhalt) und in der Hülle ein Dialog „Speichern unter“ des Systems (ohne neue Berechtigung).
