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
angenommenen Dateien mit Exit 0 endet. Kein Test schreibt nach GitHub.
