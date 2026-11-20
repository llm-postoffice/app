# Prüfen

`make check HIG=PFAD` führt alle Stufen aus; `PFAD` ist der Klon von p94-hig. Jede Stufe läuft auch einzeln:

| Befehl | Prüft |
| --- | --- |
| `make test` | alle Tests mit `node --test`, auch Senden gegen eine nachgebaute GitHub-API |
| `make fremdhost` | dass im Code nur `api.github.com` und `ntfy.sh` vorkommen |
| `make secrets` | dass keine Geheimnisse im Arbeitsbaum stehen (gitleaks) |
| `make render` | jede Ansicht in jedem Zustand, hell, dunkel, Schrift 200 % und ohne Netz |
| `make wege` | alle Wege der App in Chromium, auch Start ohne Netz und Update |

Endet `make wege` mit `BLOCKED`, startet Chromium nicht. Ein Pfad in `$TMPDIR` über etwa 100 Zeichen bricht ab; setze
ein kurzes, etwa `TMPDIR=/tmp make wege`.

Der Wegetest wartet auf Zustände, nicht auf feste Zeiten: `tippe` wartet, bis das Ziel an stabiler Stelle steht, `neuLaden` und `navigiere`
bis die neue Ansicht steht, `warte` gilt das Dreifache der genannten Zeit (mindestens 15 s), weil Chromium auf einem ausgelasteten Rechner
langsamer zeichnet. Ein neuer Weg setzt keine Pause vor eine Prüfung, sondern wartet mit `warte` oder `bis` auf das, was er prüft; fest bleibt
nur, was beweist, dass nichts passiert.

## Schnell iterieren

Beim Arbeiten nur das laufen lassen, was die Änderung berührt; den vollen `make check` einmal vor dem PR.

| Befehl | Wirkung |
| --- | --- |
| `make render SZENARIEN="leer fehler"` | rendert nur diese Szenarien (`node tools/rendern.mjs --liste` nennt alle) |
| `node --test tests/NAME.test.mjs` | ein Test statt aller |
| `make render JOBS=3` | drei Szenarien gleichzeitig statt der Vorgabe |

`make check` führt zuerst die leichten Stufen test, fremdhost und secrets gleichzeitig aus (`make -j -k --output-sync=target`),
danach render und wege nacheinander, jede allein: beide starten Chromium, und das Rendern wählt seine Jobs nach Kernen und
freiem Speicher, ohne andere Stufen mitzuzählen. Jede Stufe wählt ihre Ports selbst und legt Profile in eigene Temp-Ordner. Die
Ausgabe einer Stufe erscheint am Stück, wenn sie fertig ist; scheitert eine, laufen die anderen zu Ende, und `make check` endet
mit Fehler. Das Rendern rendert bis zu sechs Szenarien gleichzeitig, jedes in
einem eigenen Chromium (je Job bis etwa 1,2 GB). Die Vorgabe ist die Hälfte der Kerne, höchstens 6 und höchstens so viele
Jobs, wie in den freien Speicher passen (`MemAvailable`); `--jobs 1` rendert nacheinander. `lauf.txt` steht in der
Reihenfolge der Szenarien, nicht der Fertigstellung.

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
| `POST_QUELLE` | Ordner des Postsystems (Vergleich der Testfälle) |
| `POST_DATEN` | Ordner des Datenklons, nur gelesen |
| `POST_BEFEHL` | Befehlszeile, die alle Einträge als JSON druckt; `{JETZT}` steht für die Rechenzeit |
| `POST_WERKZEUG` | Python-Datei des Werkzeugs (Vergleich der Prüfmuster) |
| `POST_PRUEFBEFEHL` | Befehlszeile der Prüfung des Werkzeugs; `{DATEN}` steht für einen Datenordner |

`tests/mockgithub.test.mjs` schickt alle Sendungen an eine Mock-Quelle und verlangt, dass `POST_PRUEFBEFEHL` auf den
angenommenen Dateien mit Exit 0 endet, auch für einen Eintrag und eine Antwort mit Anhängen (Bytes, `attachments/NAME`, `attachments/ULID/NAME`, Feld `Attachments`). Kein Test schreibt nach GitHub.
