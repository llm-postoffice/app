# LLM-Post

LLM-Post ist eine installierbare Web-App für das Handy, die zeigt, was auf dich wartet, und deine Antworten, Urteile und neuen Einträge an ein Postsystem auf GitHub sendet.

Stand: im Aufbau, Teil F (Offline, Installation, Mitteilungen, Update). Die App holt das Postsystem mit einem Token auf das Gerät, rechnet daraus den Zustand der Einträge und zeigt **Wartet**, **Alle** (alle offenen Einträge aller Projekte, auch die, die nicht auf dich warten, gefiltert und sortiert), **Abnahmen**, **Erfassen**, **Mehr**, den Eingang, die Ideensammlung, die Suche und jeden Eintrag. Sie schreibt auch: Du beantwortest Fragen, beurteilst Abnahmen Schritt für Schritt, erledigst Einträge, sortierst den Eingang ein und erfasst neue Einträge. Jede Eingabe wartet zehn Sekunden auf **Rückgängig**, geht dann als ein Commit je Sendung über die Git-Data-API von GitHub raus und steht bis dahin in Worten als „noch nicht gesendet“ am Eintrag. Ohne Netz bleibt sie in der Warteschlange auf dem Gerät. Teil F ist dazu gekommen: Die App startet ohne Netz, erklärt in **Mehr** die Installation und die Mitteilungen über ntfy und wartet mit einer neuen Fassung, bis du **Neu starten** tippst. Noch nicht veröffentlicht und noch nicht nutzbar: die Veröffentlichung folgt in Teil G.

## Installation

Noch nicht möglich. Die App erscheint auf GitHub Pages, sobald Teil G sie veröffentlicht. Dann installierst du sie auf dem Handy (Vanadium oder Chrome auf Android) so:

1. Öffne die Adresse der App im Browser.
2. Öffne im Browser das Menü ⋮.
3. Tippe im Menü auf **Install and create shortcut**. Bei deutscher Oberfläche heißt der Eintrag vermutlich **App installieren** (nicht geprüft).
4. Bestätige die Frage des Browsers.
5. Öffne LLM-Post danach vom Startbildschirm.

Nach der Installation gilt die Anmeldung der App, nicht die eines Browsertabs. Links aus anderen Apps öffnen LLM-Post in einem Tab ohne diese Anmeldung; öffne die App zum Arbeiten vom Startbildschirm. Eine neue Fassung wartet, bis du in der Zeile unten oder in **Mehr** auf **Neu starten** tippst.

## Entwickeln

Die App braucht keinen Build: HTML, CSS und ES-Module, ohne npm-Pakete. Für die Prüfkette brauchst du Node ab Version 22, Chromium, gitleaks und einen Klon von p94-hig, dem Regelwerk des Betreibers; aus ihm kommt der Renderer `beispiele/rendern-mobil.mjs`. Ohne diesen Klon laufen alle Stufen außer `render`.

Prüfe alles:

```bash
make check HIG=PFAD
```

`PFAD` ist der Ordner des p94-hig-Klons. Ohne Angabe sucht `make` im Nachbarordner `../p94-hig`. Die Bilder des Renderers landen in `bilder/`; mit `BILDER=ORDNER` wählst du einen anderen Ordner.

Ausgabe, gekürzt (`make render` schreibt je Szenario ein Protokoll nach `bilder/lauf.txt`):

```text
ℹ tests 265
ℹ pass 262
ℹ fail 0
ℹ skipped 3
PASS  78 Dateien geprüft, kein Fremdhost
INF no leaks found
leer: PASS     Manifest       installierbar, Manifest vollständig (UPL-2)
leer: PASS     Offline        5 von 5 Zuständen starten ohne Netz (UOF-1)
leer: 15 PASS
alle Wege PASS
```

Die Stufen laufen auch einzeln:

| Befehl | Prüft |
| --- | --- |
| `make test` | Fassung, Adressen, Stapel für Zurück, Manifest, CSP, Hülle des Service Workers, Abgleich und Senden gegen eine nachgebaute GitHub-API (Commit je Sendung, Schreibabstand, Neubau bei 409 und 422, Konflikt, Token abgelehnt, Rückgängig, Uhrabweichung), Zustand, Urteile, Prüfmuster und die Dateien einer Sendung gegen die gemeinsamen Testfälle; dazu die Listen, Sätze, den Markdown-Renderer und jede Ansicht gegen ein Wegwerf-DOM |
| `make fremdhost` | dass im Code nur `api.github.com` und `ntfy.sh` vorkommen |
| `make secrets` | dass keine Geheimnisse im Arbeitsbaum stehen (gitleaks) |
| `make render` | jede Ansicht in jedem Zustand (leer, lädt, Fehler, offline, Token abgelaufen, neue Fassung wartet, installiert, Anmeldung, Hinweis mit Rückgängig, noch nicht gesendet, abgelehnte Eingabe, Sendefehler) in zwei Größen, hell, dunkel, Schrift 200 % und ohne Netz |
| `make wege` | Anmeldung, alle Zurück-Wege der Tabelle, Blätter, einen Knopf zu jeder Handlung, eine linke Kante je Ansicht, Entwürfe über Neuladen, Statusleiste, Netzzeile, den Start ohne Netz aus dem Cache, den Update-Weg mit einer zweiten Fassung des Service Workers (Update wartet, **Neu starten**, Entwurf und Schlange bleiben), Installation und Mitteilungen in **Mehr**, IndexedDB, den Abgleich mit allen Zuständen aus **Mehr**, das Schreiben in Echtzeit (Antwort mit Rückgängig, Einsortieren, Erfassen, Abnahme mit FAIL, Geheimnis im Text, ohne Netz, Token abgelehnt) und eine fehlerfreie Konsole in Chromium |

Wenn Chromium nicht startet und `make wege` mit `BLOCKED` endet: Chromium legt einen Socket unter `$TMPDIR` an, und ein Pfad über etwa 100 Zeichen bricht ab. Setze dann ein kurzes `TMPDIR`, etwa `TMPDIR=/tmp make wege`.

### Prüfung gegen den echten Datenbestand

Drei Tests rechnen gegen die Daten und das Werkzeug des Postsystems und überspringen sich ohne diese Angaben (Ausgabe `SKIP`). Setze die Umgebung, wenn du das Postsystem lokal hast:

| Variable | Inhalt |
| --- | --- |
| `POST_QUELLE` | Ordner des Postsystems; der Test vergleicht `tests/testfaelle/cases.json` mit dessen `testdata/cases.json` |
| `POST_DATEN` | Ordner des Datenklons, wird nur gelesen |
| `POST_BEFEHL` | Befehlszeile, die alle Einträge als JSON druckt; `{JETZT}` steht für die Zeit, auf die das Werkzeug rechnet |
| `POST_WERKZEUG` | Pfad der Python-Datei des Werkzeugs, für den Vergleich der Prüfmuster |
| `POST_PRUEFBEFEHL` | Befehlszeile, die die Prüfung des Werkzeugs auf einem Datenordner ausführt; `{DATEN}` steht für den Ordner, und der Befehl setzt die Umgebungsvariable des Werkzeugs für den Datenordner selbst, etwa `env VARIABLE={DATEN} WERKZEUG check` |

Der Abgleich läuft dabei gegen den Datenklon als Mock-Quelle; die Zustände der App müssen Feld für Feld gleich der Ausgabe des Werkzeugs sein. Der dritte Test (`tests/mockgithub.test.mjs`) lässt die App alle Arten von Sendung an eine Mock-Quelle schicken, die die Git-Data-API nachbaut, legt die angenommenen Dateien in eine Kopie des Datenklons (mit `POST_DATEN` als Vorlage, nur gelesen) und verlangt, dass `POST_PRUEFBEFEHL` auf dieser Kopie mit Exit 0 endet. Kein Test schreibt nach GitHub. `tests/testfaelle/QUELLE.json` nennt Fassung und Commit der Kopie der Testfälle und wie du sie neu übernimmst.

### Vorschau mit erfundenen Daten

`tools/vorschau.mjs` startet die App mit erfundenen Einträgen (`tests/hilfen/beispieldaten.mjs`), ohne Token und ohne Netz. Jedes Szenario hat eine eigene Adresse, etwa `/normal/`, `/leer/`, `/fehler/`, `/offline/`, `/neue-fassung/`, `/installiert/`, `/anmeldung/` und für das Schreiben `/antworten/`, `/eingang-senden/` und `/erfassen-pruefung/`; `node tools/rendern.mjs --liste` nennt sie samt den Ansichten, die jedes zeigt. `make render` rendert alle Szenarien; ein einzelnes rendert dieser Aufruf:

```bash
node tools/rendern.mjs --hig PFAD -o bilder leer fehler
```

Die erfundenen Daten bleiben neutral (Projekte `alpha`, `beta`, `gamma`, Rechner `rechner-a`). Die App selbst enthält keinen Hook für Attrappen: die Vorschau ersetzt nur `js/start.js`, tauscht `fetch` gegen die Mock-Quelle und hält die Zeitgeber der Schreibschicht an, damit nichts von allein sendet und jeder Zustand für das Bild stehen bleibt. Ein Szenario kann nach dem Start einen Knopf antippen (`klick`), um etwa den Hinweis mit **Rückgängig** zu zeigen.

Der Wegetest kann die Zustände von **Mehr** als Bilder schreiben (hell, dunkel, Text 200 %):

```bash
node tools/wege.mjs --bilder bilder/abgleich
```

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `index.html`, `app.css` | Hülle mit Symbol-Sprite, Leisten und Blatt; Farben und Maße |
| `js/` | ES-Module: Adressen, Navigation mit der History API, Statusleiste, Netzzeile; Speicher (`speicher.js`, IndexedDB), Abgleich (`abgleich.js`), Steuerung (`steuerung.js`); Zustand der Einträge (`zustand.js`, `urteil.js`, `pruefen.js`, `format.js`, `pytext.js`); Ansichten: `welt.js` (Listen und Sätze aus dem Stand auf dem Gerät), `anzeigen.js` (wählt die Ansicht), `ansichten.js` (Wartet, Abnahmen, Eingang, Ideensammlung, Suche), `uebersicht.js` (Alle mit Filtern und Sortierung), `eintrag.js`, `ablauf.js` (Abnahme Schritt für Schritt), `erfassen.js`, `anmelden.js`, `mehr.js` (mit Installation und Mitteilungen), `markdown.js` (eigener Renderer ohne HTML), `karten.js` (Bausteine), `entwuerfe.js`; Schreiben (Teil E): `schreiben.js` (Warteschlange mit Zuständen, Rückgängig, Konflikte), `senden.js` (ein Commit je Sendung über die Git-Data-API, Schreibabstand, Neubau), `dateien.js` (die Dateien einer Sendung wie das Postwerkzeug sie schreibt, Prüfung auf Geheimnisse und Personendaten), `erzeugen.js` (ULIDs, neue IDs, Stempel, Uhrabweichung), `hinweis.js` (Hinweis mit Rückgängig), `absenden.js` (gemeinsamer Weg der Ansichten zur Schreibschicht); Update (Teil F): `aktualisieren.js` (neue Fassung wartet, Neu starten, Prüfung beim Öffnen) und `swlogik.js` (Entscheidungen des Service Workers, rein) |
| `sw.js`, `manifest.webmanifest`, `symbole/` | Start ohne Netz (der Service Worker ist ein Modul) und Installation |
| `tests/`, `tools/`, `Makefile` | Prüfkette; `tools/vorschau.mjs` und `tools/rendern.mjs` für die Vorschau mit erfundenen Daten |

## Fehlerberichte

https://github.com/llm-postoffice/app/issues

## Lizenz

GPL-3.0-or-later, siehe [LICENSE](LICENSE).

Die Symbole in `index.html` sind Material Symbols Rounded von Google (Apache-2.0, Text in [LICENSES/Apache-2.0.txt](LICENSES/Apache-2.0.txt), Quelle https://github.com/google/material-design-icons). Die App-Symbole in `symbole/` sind Platzhalter aus dem Beispiel von p94-hig unter GPL-3.0-or-later.
