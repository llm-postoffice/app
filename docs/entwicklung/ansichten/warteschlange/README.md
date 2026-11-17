# Warteschlange sichtbar machen: Steckbrief und Varianten

Eintrag mzw-pn5, Frage w8qxf8. Gewählt und gebaut ist Variante 1 (Wahl des Nutzers am 2026-11-17), Fassung 20261117.09. Die Entwürfe unten bleiben als Beleg.

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

Erwartet war Variante 1, gewählt wurde Variante 1: Sichtbar, wenn es zählt; das Band verschwindet, sobald nichts wartet, und eine Seite verwaltet alles.

## Für alle drei

- Der offline angelegte Eintrag öffnet als lokale Seite „Neuer Eintrag“ mit dem Band „Noch nicht gesendet“ und **Verwerfen**; heute sagt die Adresse `#eintrag/ID` „Eintrag nicht gefunden“.
- Wartende Sendungen gehen von selbst raus (**Verwerfen** genügt); nur hängende (Token, Recht, Fehler) haben **Erneut senden**, wie in der Schreibschicht.
- Der Entwurf (ein Modul und ein Stil nur für die Vorschau, Szenarien `warteschlange-eins|zwei|drei-…`) steht im Commit der Entwürfe und ist nach der Wahl entfernt.

## Gebaut: Variante 1

- Wo: das Band steht oben in Wartet (`js/schlange.js`, `schlangeBandKnoten`), solange eine Sendung auf Netz wartet oder hängt; die Sendung in den zehn Sekunden von **Rückgängig** zählt nicht. **Anzeigen** öffnet `#schlange` (Titel „Noch nicht gesendet“, Zurück führt nach Wartet).
- Seite: eine Karte je Sendung (was, Eintrag, Zustand, was hilft); hängende zuerst. Knöpfe nach Zustand: **Erneut senden** (Fehler), **Neues Token eintragen** (Token, Recht), **Trotzdem senden** oder **Als Nachtrag senden** (Konflikt), immer **Verwerfen**, das die Eingabe als Entwurf zurücklegt. Ohne Sendung steht dort „Alles gesendet“.
- Offline angelegter Eintrag: `welt.js` legt einen neuen Eintrag in die Welt, sobald er in der Schlange liegt; seine Adresse öffnet ihn mit dem Band „Noch nicht gesendet“ und **Verwerfen** (danach Wartet). Er steht auch in Eingang und Listen.
- Schritte (gezählt): sehen, dass etwas wartet 0 (Band steht oben); Erneut senden 2 (Anzeigen, Erneut senden); Verwerfen 2 (Anzeigen, Verwerfen); offline angelegten Eintrag öffnen 2 (Anzeigen, Zeile).
- Wörter, die der Nutzer verstehen muss: Sendung, hängt, Anzeigen, Verwerfen, Erneut senden.
- Bilder: `gebaut-band-hell`, `gebaut-band-dunkel`, `gebaut-seite-hell`, `gebaut-seite-dunkel`, `gebaut-eintrag-hell`, `gebaut-leer-hell`.
- Kaltlesen (nur Bilder und Hauptaufgaben): alle vier Aufgaben lösbar. Befund und Folge: Verwerfen wirkte wie Löschen, darum sagt die Seite jetzt „Verwerfen nimmt eine Sendung zurück: deine Eingabe liegt dann wieder als Entwurf auf diesem Gerät“. Offen geblieben: das Band nennt nur Zahl und Zustand, nicht die Titel (gewollt, die Seite nennt sie); „Validation Failed“ ist der Wortlaut von GitHub.
- Prüfung: Rendern von `schlange-offline`, `schlange-online`, `schlange-leer` hell, dunkel, Schrift 200 %, ohne Netz ohne Fehler; Wegetest (Band, Seite, Hinweis ohne Netz, Zurück nach Wartet).
