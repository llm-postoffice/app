# Postfach

Postfach ist eine installierbare Web-App für das Handy, die zeigt, was auf dich wartet, und deine Antworten, Urteile und neuen Einträge an ein Postsystem auf GitHub sendet.

Stand: im Aufbau, Teil C (Abgleich und Zustand). Die App holt das Postsystem mit einem Token auf das Gerät, speichert es in IndexedDB und rechnet daraus den Zustand der Einträge; **Mehr** zeigt den Abgleich. Die Ansichten **Wartet**, **Abnahmen** und **Erfassen** sind noch leere Hüllen; Anmelden, Schreiben und Offline-Warteschlange folgen in späteren Teilen. Noch nicht veröffentlicht und noch nicht nutzbar.

## Installation

Noch nicht möglich. Die App erscheint auf GitHub Pages, sobald Teil G sie veröffentlicht.

## Entwickeln

Die App braucht keinen Build: HTML, CSS und ES-Module, ohne npm-Pakete. Für die Prüfkette brauchst du Node ab Version 22, Chromium, gitleaks und einen Klon von p94-hig, dem Regelwerk des Betreibers; aus ihm kommt der Renderer `beispiele/rendern-mobil.mjs`. Ohne diesen Klon laufen alle Stufen außer `render`.

Prüfe alles:

```bash
make check HIG=PFAD
```

`PFAD` ist der Ordner des p94-hig-Klons. Ohne Angabe sucht `make` im Nachbarordner `../p94-hig`. Die Bilder des Renderers landen in `bilder/`; mit `BILDER=ORDNER` wählst du einen anderen Ordner.

Ausgabe, gekürzt:

```text
ℹ tests 136
ℹ pass 133
ℹ fail 0
ℹ skipped 3
PASS  43 Dateien geprüft, kein Fremdhost
INF no leaks found
PASS     Manifest       installierbar, Manifest vollständig (UPL-2)
PASS     Offline        12 von 12 Zuständen starten ohne Netz (UOF-1)
72 Bilder nach bilder geschrieben
15 PASS
alle Wege PASS
```

Die Stufen laufen auch einzeln:

| Befehl | Prüft |
| --- | --- |
| `make test` | Fassung, Adressen, Stapel für Zurück, Manifest, CSP, Hülle des Service Workers, Abgleich gegen eine nachgebaute GitHub-API, Zustand, Urteile und Prüfmuster gegen die gemeinsamen Testfälle |
| `make fremdhost` | dass im Code nur `api.github.com` und `ntfy.sh` vorkommen |
| `make secrets` | dass keine Geheimnisse im Arbeitsbaum stehen (gitleaks) |
| `make render` | jede Ansicht in zwei Größen, hell, dunkel, Schrift 200 % und ohne Netz |
| `make wege` | Zurück-Reihenfolge, Blätter, Statusleiste, Netzzeile, IndexedDB, der Abgleich mit allen Zuständen aus **Mehr** und eine fehlerfreie Konsole in Chromium |

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

Der Wegetest kann die Zustände von **Mehr** als Bilder schreiben (hell, dunkel, Text 200 %):

```bash
node tools/wege.mjs --bilder bilder/abgleich
```

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `index.html`, `app.css` | Hülle mit Symbol-Sprite, Leisten und Blatt; Farben und Maße |
| `js/` | ES-Module: Adressen, Navigation mit der History API, Anzeige, Statusleiste, Netzzeile; Speicher (`speicher.js`, IndexedDB), Abgleich (`abgleich.js`), Steuerung (`steuerung.js`), Mehr (`mehr.js`, `texte.js`); Zustand der Einträge (`zustand.js`, `urteil.js`, `pruefen.js`, `format.js`, `pytext.js`) |
| `sw.js`, `manifest.webmanifest`, `symbole/` | Start ohne Netz und Installation |
| `tests/`, `tools/`, `Makefile` | Prüfkette |

## Fehlerberichte

https://github.com/llm-postoffice/app/issues

## Lizenz

GPL-3.0-or-later, siehe [LICENSE](LICENSE).

Die Symbole in `index.html` sind Material Symbols Rounded von Google (Apache-2.0, Text in [LICENSES/Apache-2.0.txt](LICENSES/Apache-2.0.txt), Quelle https://github.com/google/material-design-icons). Die App-Symbole in `symbole/` sind Platzhalter aus dem Beispiel von p94-hig unter GPL-3.0-or-later.
