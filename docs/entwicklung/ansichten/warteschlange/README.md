# Warteschlange sichtbar machen: Steckbrief und Varianten

Eintrag mzw-pn5, Frage w8qxf8. Die Wahl des Nutzers steht aus; gebaut ist noch nichts davon.

## Steckbrief

1. Wer und wann: der Nutzer am Handy, unterwegs, oft ohne Netz; die Schlange ist selten voll, aber ein Eintrag, der nur dort liegt, ist heute nirgends zu finden.
2. Aufgaben: sehen, was noch nicht gesendet ist; eine Sendung erneut senden oder verwerfen; einen offline angelegten Eintrag öffnen.
3. Zurück schließt zuerst, was offen ist, und führt dann einen Schritt hoch; ein offline angelegter Eintrag hat dieselbe Adresse wie später der gesendete.
4. Nicht Teil: eine Sendung bearbeiten; Sendungen anderer Geräte.
5. Offline: alles kommt aus der Datenbank des Geräts; mit Netz gehen wartende Sendungen von selbst raus, eine hängende braucht **Erneut senden**.

## Varianten

Erfundene Daten (drei Sendungen warten auf Netz, darunter ein neuer Eintrag; eine hängt), Bilder in 360 × 800 CSS-Pixeln, hell und dunkel. `vergleich.png` und `vergleich-dunkel.png` zeigen je Variante drei Bildschirme: wo man es sieht, Erneut senden und Verwerfen, der offline angelegte Eintrag.

| Variante | Bilder | Wette |
| --- | --- | --- |
| 1: Band „4 Sendungen noch nicht gesendet“ oben in Wartet, **Anzeigen** öffnet die Seite „Noch nicht gesendet“ | `variante-1-einstieg`, `-liste`, `-eintrag` | Sichtbar, wenn es zählt: das Band steht nur da, solange etwas wartet; eine Seite verwaltet alles. |
| 2: Abschnitt „Noch nicht gesendet“ oben in Mehr, Plakette an Mehr | `variante-2-einstieg`, `-liste`, `-eintrag` | Ruhe: Wartet bleibt, wie es ist; wer die Plakette deutet, findet die Liste. |
| 3: neue Einträge als eigene Karten oben in Wartet, die übrigen Sendungen zeigen ihren Zustand an der Karte, **Erneut senden** und **Verwerfen** stehen im Eintrag | `variante-3-einstieg`, `-liste` (Eintrag mit hängender Antwort), `-eintrag` | Kein neuer Ort: der Eintrag ist dort, wo man ihn sucht; es gibt aber keine Gesamtliste. |

Tipps bis zur Handlung (Erneut senden): Variante 1 drei (Band, Zeile bleibt, Knopf), Variante 2 zwei (Mehr, Knopf), Variante 3 drei (Karte, Eintrag, Knopf). Bis zum offline angelegten Eintrag: 2, 2, 1.

Erwartet ist Variante 1.

## Für alle drei

- Der offline angelegte Eintrag öffnet als lokale Seite „Neuer Eintrag“ mit dem Band „Noch nicht gesendet“ und **Verwerfen**; heute sagt die Adresse `#eintrag/ID` „Eintrag nicht gefunden“.
- Wartende Sendungen gehen von selbst raus (**Verwerfen** genügt); nur hängende (Token, Recht, Fehler) haben **Erneut senden**, wie in der Schreibschicht.
- Der Entwurf ist `tools/warteschlange-entwurf.mjs` mit Stil `tools/warteschlange-entwurf.css`; die Szenarien heißen `warteschlange-eins|zwei|drei-einstieg|liste|eintrag`. Die App selbst bleibt unverändert.
