# Postfach

Postfach ist eine installierbare Web-App für das Handy, die zeigt, was auf dich wartet, und deine Antworten, Urteile und neuen Einträge an ein Postsystem auf GitHub sendet.

Stand: im Aufbau, Teil D (Ansichten, Navigation, Suche). Die App holt das Postsystem mit einem Token auf das Gerät, rechnet daraus den Zustand der Einträge und zeigt **Wartet**, **Abnahmen**, **Erfassen**, **Mehr**, den Eingang, die Ideensammlung, die Suche und jeden Eintrag; eine Abnahme beurteilst du Schritt für Schritt. Sie liest nur: Antworten, Erledigen, Einsortieren und Anlegen sind als gesperrte Knöpfe da, deine Eingaben bleiben als Entwurf auf dem Gerät, und gesendet wird erst in Teil E. Noch nicht veröffentlicht und noch nicht nutzbar.

## Installation

Noch nicht möglich. Die App erscheint auf GitHub Pages, sobald Teil G sie veröffentlicht.

## Entwickeln

Die App braucht keinen Build: HTML, CSS und ES-Module, ohne npm-Pakete. Für die Prüfkette brauchst du Node ab Version 22, Chromium, gitleaks und einen Klon von p94-hig, dem Regelwerk des Betreibers; aus ihm kommt der Renderer `beispiele/rendern-mobil.mjs`. Ohne diesen Klon laufen alle Stufen außer `render`.

Prüfe alles:

```bash
make check HIG=PFAD
```

`PFAD` ist der Ordner des p94-hig-Klons. Ohne Angabe sucht `make` im Nachbarordner `../p94-hig`. Die Bilder des Renderers landen in `bilder/`; mit `BILDER=ORDNER` wählst du einen anderen Ordner.

Ausgabe, gekürzt (`make render` schreibt je Szenario ein Protokoll nach `bilder/lauf.txt`):

```text
ℹ tests 199
ℹ pass 196
ℹ fail 0
ℹ skipped 3
PASS  68 Dateien geprüft, kein Fremdhost
INF no leaks found
leer: PASS     Manifest       installierbar, Manifest vollständig (UPL-2)
leer: PASS     Offline        5 von 5 Zuständen starten ohne Netz (UOF-1)
leer: 15 PASS
alle Wege PASS
```

Die Stufen laufen auch einzeln:

| Befehl | Prüft |
| --- | --- |
| `make test` | Fassung, Adressen, Stapel für Zurück, Manifest, CSP, Hülle des Service Workers, Abgleich gegen eine nachgebaute GitHub-API, Zustand, Urteile und Prüfmuster gegen die gemeinsamen Testfälle; dazu die Listen, Sätze, den Markdown-Renderer und jede Ansicht gegen ein Wegwerf-DOM |
| `make fremdhost` | dass im Code nur `api.github.com` und `ntfy.sh` vorkommen |
| `make secrets` | dass keine Geheimnisse im Arbeitsbaum stehen (gitleaks) |
| `make render` | jede Ansicht in jedem Zustand (leer, lädt, Fehler, offline, Token abgelaufen, Anmeldung) in zwei Größen, hell, dunkel, Schrift 200 % und ohne Netz |
| `make wege` | Anmeldung, alle Zurück-Wege der Tabelle, Blätter, einen Knopf zu jeder Handlung, eine linke Kante je Ansicht, Entwürfe über Neuladen, Statusleiste, Netzzeile, IndexedDB, den Abgleich mit allen Zuständen aus **Mehr** und eine fehlerfreie Konsole in Chromium |

Wenn Chromium nicht startet und `make wege` mit `BLOCKED` endet: Chromium legt einen Socket unter `$TMPDIR` an, und ein Pfad über etwa 100 Zeichen bricht ab. Setze dann ein kurzes `TMPDIR`, etwa `TMPDIR=/tmp make wege`.

### Prüfung gegen den echten Datenbestand

Zwei Tests rechnen gegen die Daten und das Werkzeug des Postsystems und überspringen sich ohne diese Angaben (Ausgabe `SKIP`). Setze die Umgebung, wenn du das Postsystem lokal hast:

| Variable | Inhalt |
| --- | --- |
| `POST_QUELLE` | Ordner des Postsystems; der Test vergleicht `tests/testfaelle/cases.json` mit dessen `testdata/cases.json` |
| `POST_DATEN` | Ordner des Datenklons, wird nur gelesen |
| `POST_BEFEHL` | Befehlszeile, die alle Einträge als JSON druckt; `{JETZT}` steht für die Zeit, auf die das Werkzeug rechnet |
| `POST_WERKZEUG` | Pfad der Python-Datei des Werkzeugs, für den Vergleich der Prüfmuster |

Der Abgleich läuft dabei gegen den Datenklon als Mock-Quelle; die Zustände der App müssen Feld für Feld gleich der Ausgabe des Werkzeugs sein. `tests/testfaelle/QUELLE.json` nennt Fassung und Commit der Kopie der Testfälle und wie du sie neu übernimmst.

### Vorschau mit erfundenen Daten

`tools/vorschau.mjs` startet die App mit erfundenen Einträgen (`tests/hilfen/beispieldaten.mjs`), ohne Token und ohne Netz. Jedes Szenario hat eine eigene Adresse, etwa `/normal/`, `/leer/`, `/fehler/`, `/offline/` und `/anmeldung/`; `node tools/rendern.mjs --liste` nennt sie samt den Ansichten, die jedes zeigt. `make render` rendert alle Szenarien; ein einzelnes rendert dieser Aufruf:

```bash
node tools/rendern.mjs --hig PFAD -o bilder leer fehler
```

Die erfundenen Daten bleiben neutral (Projekte `alpha`, `beta`, `gamma`, Rechner `rechner-a`). Die App selbst enthält keinen Hook für Attrappen: die Vorschau ersetzt nur `js/start.js` und tauscht `fetch` gegen die Mock-Quelle.

Der Wegetest kann die Zustände von **Mehr** als Bilder schreiben (hell, dunkel, Text 200 %):

```bash
node tools/wege.mjs --bilder bilder/abgleich
```

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `index.html`, `app.css` | Hülle mit Symbol-Sprite, Leisten und Blatt; Farben und Maße |
| `js/` | ES-Module: Adressen, Navigation mit der History API, Statusleiste, Netzzeile; Speicher (`speicher.js`, IndexedDB), Abgleich (`abgleich.js`), Steuerung (`steuerung.js`); Zustand der Einträge (`zustand.js`, `urteil.js`, `pruefen.js`, `format.js`, `pytext.js`); Ansichten: `welt.js` (Listen und Sätze aus dem Stand auf dem Gerät), `anzeigen.js` (wählt die Ansicht), `ansichten.js` (Wartet, Abnahmen, Eingang, Ideensammlung, Suche), `eintrag.js`, `ablauf.js` (Abnahme Schritt für Schritt), `erfassen.js`, `anmelden.js`, `mehr.js`, `markdown.js` (eigener Renderer ohne HTML), `karten.js` (Bausteine), `entwuerfe.js`, `schreiben.js` (Schnittstelle der Schreibschicht aus Teil E) |
| `sw.js`, `manifest.webmanifest`, `symbole/` | Start ohne Netz und Installation |
| `tests/`, `tools/`, `Makefile` | Prüfkette; `tools/vorschau.mjs` und `tools/rendern.mjs` für die Vorschau mit erfundenen Daten |

## Fehlerberichte

https://github.com/llm-postoffice/app/issues

## Lizenz

GPL-3.0-or-later, siehe [LICENSE](LICENSE).

Die Symbole in `index.html` sind Material Symbols Rounded von Google (Apache-2.0, Text in [LICENSES/Apache-2.0.txt](LICENSES/Apache-2.0.txt), Quelle https://github.com/google/material-design-icons). Die App-Symbole in `symbole/` sind Platzhalter aus dem Beispiel von p94-hig unter GPL-3.0-or-later.
