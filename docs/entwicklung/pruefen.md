# Prüfen

`make check HIG=PFAD` führt alle Stufen aus; `PFAD` ist der Klon von p94-hig. Jede Stufe läuft auch einzeln:

| Befehl | Prüft |
| --- | --- |
| `make test` | alle Tests mit `node --test`, auch Senden gegen eine nachgebaute GitHub-API |
| `make fremdhost` | dass im Code nur `api.github.com` vorkommen |
| `make secrets` | dass keine Geheimnisse im Arbeitsbaum stehen (gitleaks) |
| `make render` | jede Ansicht in jedem Zustand, hell, dunkel, Schrift 200 % und ohne Netz |
| `make wege` | alle Wege der App in Chromium, auch Start ohne Netz und Update |

Endet `make wege` mit `BLOCKED`, startet Chromium nicht. Ein Pfad in `$TMPDIR` über etwa 100 Zeichen bricht ab; setze
ein kurzes, etwa `TMPDIR=/tmp make wege`.

Der Wegetest wartet auf Zustände, nicht auf feste Zeiten: `tippe` wartet, bis das Ziel an stabiler Stelle steht, `neuLaden` und `navigiere`
bis die neue Ansicht steht, `warte` gilt das Dreifache der genannten Zeit (mindestens 15 s), weil `make check` die Stufen gleichzeitig
laufen lässt. Ein neuer Weg setzt keine Pause vor eine Prüfung, sondern wartet mit `warte` oder `bis` auf das, was er prüft; fest bleibt
nur, was beweist, dass nichts passiert.

## Schnell iterieren

Beim Arbeiten nur das laufen lassen, was die Änderung berührt; den vollen `make check` einmal vor dem PR.

| Befehl | Wirkung |
| --- | --- |
| `make render SZENARIEN="leer fehler"` | rendert nur diese Szenarien (`node tools/rendern.mjs --liste` nennt alle) |
| `node --test tests/NAME.test.mjs` | ein Test statt aller |
| `make render JOBS=3` | drei Szenarien gleichzeitig statt der Vorgabe oder des Budgets |

`make check` führt die fünf Stufen gleichzeitig aus (`make -j5 -k --output-sync=target`): jede wählt ihre Ports selbst und
legt Profile in eigene Temp-Ordner. Die Ausgabe einer Stufe erscheint am Stück, wenn sie fertig ist; scheitert eine, laufen
die anderen zu Ende, und `make check` endet mit Fehler.

Die Last begrenzt ein Budget an Jobs für alle Stufen zusammen: `make check` fragt einmal `claude-jobs --mem 1.2` (Kerne, freier
Speicher und Last, 1,2 GB je Chromium; ohne `claude-jobs` gilt 2) und gibt die Zahl als `BUDGET` an die Stufen weiter. Das Rendern
nimmt davon einen Job weniger (einen belegt der Wegetest, mindestens 1); `make check BUDGET=N` setzt das Budget selbst. Die Tests
laufen mit `--test-concurrency=2` (`TEST_JOBS=N` ändert das), weil die Vorgabe von node (Kerne minus 1) die Chromium-Stufen nicht
mitzählt.

Ohne Budget, etwa bei `make render`, rendert der Renderer bis zu sechs Szenarien gleichzeitig, jedes in einem eigenen Chromium
(je Job bis etwa 1,2 GB). Die Vorgabe ist die Hälfte der Kerne, höchstens 6, höchstens so viele Jobs, wie in den freien Speicher
passen (`MemAvailable`), und höchstens `CLAUDE_JOBS`, wenn das eine positive Zahl ist; `--jobs 1` rendert nacheinander.
`lauf.txt` steht in der Reihenfolge der Szenarien, nicht der Fertigstellung.

Das Rendern wartet nicht auf eine feste Pause, sondern auf die Seite: der Einstieg der Vorschau setzt `window.fertig`, wenn der Abgleich beim Start
zu Ende ist und die Ansicht gezeichnet steht (Szenarien mit `live: 'haengt'` warten nicht auf den Abgleich, er endet dort nie), und `tools/rendern.mjs` gibt dem Renderer
das als `--bereit` mit. `--warte` (Vorgabe 10 s) ist nur die Obergrenze; auf einem ausgelasteten Rechner dauert das Zeichnen länger, die Prüfung
folgt ihm. Die Vorschau begrenzt das Warten auf den Abgleich auf 5 s (`data-fertig` am Wurzelelement nennt `abgleich`, `haengt` oder `frist`; gemessen am 2026-11-23: alle Szenarien enden mit `abgleich`, `laedt` mit `haengt`, am längsten nach 1,1 s). Ein Tipp (`klick`) ohne Knopf ist nur in Szenarien mit mehreren Adressen erlaubt, sonst ein Fehler. Das braucht einen p94-hig-Klon ab Fassung 20261121.01 (`--bereit` im Renderer); `tools/rendern.mjs` lehnt einen älteren mit Exit 2 ab.

`make render` prüft nach dem Renderer jedes Bild (`tools/bilder.mjs`): ein leeres oder fehlendes Bild und dasselbe Bild für zwei Adressen
eines Szenarios sind ein FAIL in `lauf.txt` mit Adresse und Variante. Der Renderer selbst meldet PASS, wenn der Start der Seite abbricht
und nur die leere Hülle bleibt. Die Vorschau legt dafür alle Dateien, die der Einstieg über `tests/hilfen/` lädt, in den Service Worker des
Szenarios; der Renderer trennt ihn nach der ersten Adresse vom Netz, und alles, was fehlt, bricht ab Adresse zwei den Start ab.

Vorschau mit erfundenen Daten: `node tools/vorschau.mjs` startet die App mit erfundenen Einträgen, ohne Token und Netz, ein Szenario je Adresse (`/leer/`).
`node tools/rendern.mjs --hig PFAD -o bilder leer fehler` rendert einzelne; `--liste` nennt alle.

## Gegen den echten Datenbestand

Drei Tests überspringen sich ohne diese Variablen:

| Variable | Inhalt |
| --- | --- |
| `POST_QUELLE` | Ordner `tests/post` im Klon von claude-tools (dort liegt `testdata/cases.json`; Vergleich der Testfälle) |
| `POST_DATEN` | Wegwerf-Kopie des Datenordners (nur gelesen, siehe unten) |
| `POST_BEFEHL` | Befehlszeile, die alle Einträge als JSON druckt; `{JETZT}` steht für die Rechenzeit |
| `POST_WERKZEUG` | `post/claude_post_main.py` im Klon von claude-tools (Vergleich der Prüfmuster) |
| `POST_PRUEFBEFEHL` | Befehlszeile der Prüfung des Werkzeugs; `{DATEN}` steht für einen Datenordner |

Das Werkzeug liegt seit claude-tools 20261125.02 in `post/claude_post_main.py`, die Daten in einem eigenen Repo. Es läuft
mit `python3 -I` und liest den Datenordner aus `CLAUDE_POST_DIR`. Nimm eine Kopie ohne Fernrepo, nie den echten Ordner:

```bash
CT=PFAD/claude-tools
D=$(mktemp -d) && cp -a PFAD/DATENORDNER/. "$D" && git -C "$D" remote | xargs -r -n1 git -C "$D" remote remove
export POST_QUELLE=$CT/tests/post POST_DATEN=$D POST_WERKZEUG=$CT/post/claude_post_main.py
export POST_BEFEHL="env CLAUDE_POST_DIR=$D python3 -I $CT/post/claude_post_main.py --all --json --status all"
export POST_PRUEFBEFEHL="env CLAUDE_POST_DIR={DATEN} python3 -I $CT/post/claude_post_main.py check"
node --test tests/testfaelle.test.mjs tests/datenklon.test.mjs tests/mockgithub.test.mjs
```

`tests/mockgithub.test.mjs` schickt alle Sendungen an eine Mock-Quelle und verlangt, dass `POST_PRUEFBEFEHL` auf den
angenommenen Dateien mit Exit 0 endet, auch für einen Eintrag und eine Antwort mit Anhängen (Bytes, `attachments/NAME`, `attachments/ULID/NAME`, Feld `Attachments`). Kein Test schreibt nach GitHub.
