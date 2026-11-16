# Gesamtübersicht: Steckbrief und Varianten

Entwurf zum Eintrag a52nwr, Schritt 2 der Schleife für eine neue Ansicht. Gebaut wird noch nichts.

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

## Quellen der Bilder

`varianten/bauen.mjs` erzeugt die Entwurfsseiten (`a.html` und weitere), `varianten/rendern.mjs PFAD-ZU-p94-hig AUSGABE` rendert sie mit `beispiele/rendern-mobil.mjs` aus p94-hig. Die Seiten nutzen `app.css`; die App selbst bleibt unverändert.
