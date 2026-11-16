# Gesamtübersicht: Steckbrief und Varianten

Entwurf zum Eintrag a52nwr, Schritte 1 und 2 der Schleife für eine neue Ansicht; Wahl und Bau stehen unten.

## Steckbrief

1. Wer und wann: der Nutzer am Handy, mehrmals am Tag, mit dem Daumen; er will sehen, was überhaupt offen ist, auch wenn es nicht auf ihn wartet.
2. Aufgaben: alle offenen Einträge überblicken; nach Projekt, Art, Priorität und Status filtern; nach Alter, Priorität, Projekt, Art oder Status sortieren.
3. Auch hier gilt: ein Eintrag öffnet sich und lässt sich bedienen (antworten, beurteilen, erledigen) wie in Wartet; Zurück führt zur Liste mit Filter und Rollposition.
4. Nicht Teil: Einträge ändern, die schon erledigt oder verworfen sind; Suche über Text (bleibt die Lupe oben); eigene Ansichten speichern.
5. Offline: die Liste zeigt den Stand des letzten Abgleichs, Filter und Sortierung arbeiten auf dem Gerät.

## Varianten

Daten sind erfunden (14 offene Einträge, davon 7 für dich); Bilder in 448 × 923 CSS-Pixeln, Pixeldichte 3, hell und dunkel.

| Variante | Bilder | Wette |
| --- | --- | --- |
| A: Reiter „Alle“, nach Projekt gruppiert, Filter als Chips mit Auswahl | `variante-a-hell.png`, `variante-a-dunkel.png` | Der Überblick zählt: dichte Zeilen, Gruppen je Projekt, der Filter steht sichtbar oben. |
| B: Reiter „Alle“, Karten wie in Wartet, Filter und Sortierung in einem Blatt | `variante-b-hell.png`, `variante-b-blatt-hell.png` (dunkel: `-dunkel`) | Vertrautes zählt: dieselben Karten, alles Einstellen an einer Stelle, aktive Filter als Chips. |
| C: Umschalter „Für dich / Alle“ auf der Startansicht, Liste mit Trennlinien, Filter als Formular | `variante-c-hell.png`, `variante-c-filter-hell.png` (dunkel: `-dunkel`) | Kein neuer Reiter: Alle ist ein Blick auf Wartet; das Formular entspricht dem Desktop. |

Erwartete Wahl: A. Sie gruppiert nach Projekt (der Überblick, den der Desktop nicht gibt), und der Filter steht sichtbar oben. B ist die Rückfallwahl, wenn die Chips-Menüs zu eng werden.

## Befunde der Entwürfe

- Fünf Reiter passen bei 448 Pixeln und bei 360 Pixeln nur, wenn `.leiste` schmaler rastert (`minmax(4.5rem, 1fr)` statt `5.5rem`); sonst bricht die Leiste um. Gilt für A und B.
- Das Blatt von B ist bei 360 × 800 und bei Schrift 200 % höher als das Fenster und scrollt; der Renderer meldet dort `Abstand` (FAIL), bei 448 × 923 nicht.
- Die Symbole filter_list, expand_more, close, swap_vert und list (Reiter) fehlen im Sprite und kommen im Bau aus Material Symbols Rounded.
- Eine Zeile in A und C zeigt das Alter („4 Std.“); die Sortierung nach Alter braucht dafür Alter und Eingang aus dem Eintrag.

## Wahl (2026-11-16)

Der Nutzer wählte „Variante A, aber mit den beschrifteten eingefärbten Icons aus Variante C“. Grund: das Icon für Freigabe allein
in A erklärt nicht, was es ist; der farbige Chip aus Icon, Wort und Fläche in C ist sofort verständlich.

Gebaut: Reiter **Alle** zwischen Wartet und Abnahmen, nach Projekt gruppiert, vier Filter als Chips (Status, Projekt, Art, Priorität),
Sortierung als Auswahl (Projekt, Priorität, Art, Status, Alter), jede Zeile mit der Art als Chip. Ein Chip öffnet die Auswahl als
Blatt mit Kästchen und Zahl der Treffer (`#alle/status` und so weiter); ein Tipp auf eine Zeile öffnet denselben Eintrag wie in Wartet.

Zu den Befunden oben:

- Fünf Reiter: `.leiste` rastert mit `minmax(4.5rem, 1fr)`; der Wegetest prüft eine Reihe bei 360 px. Bei Schrift 200 % bricht die Leiste
  in drei Reihen um (vorher zwei).
- Symbole: `list`, `list-f`, `expand_more` und `swap_vert` stehen aus Material Symbols Rounded im Sprite; `filter_list` und `close` entfielen.
- Die Filterleiste klebt nicht und bricht um statt zu scrollen, damit bei 360 × 800 und Schrift 200 % nichts abgeschnitten ist. Das Blatt
  scrollt als Ganzes wie die anderen Blätter.
- Das Alter kommt als „vor 4 Std.“ aus der Anlagezeit des Eintrags (`kurz` in `ansichtstexte.js`).
- Der Chip der Art ist derselbe Baustein (`chipArt`) wie in der Karte von Wartet; dort stand er schon, die Wahl ändert Wartet nicht.

## Quellen der Bilder

Die Bilder entstanden mit Entwurfsseiten und einem Skript, die nach der Wahl entfernt wurden; sie liegen im Verlauf des Zweigs
`uebersicht-varianten` (Ordner `varianten/`). Die gebaute Ansicht rendert `node tools/rendern.mjs` (Szenarien `normal`, `alle-projekt`,
`alle-alter`, `alle-nichts`).
