# Postfach

Postfach ist eine installierbare Web-App für das Handy, die zeigt, was auf dich wartet, und deine Antworten, Urteile und neuen Einträge an ein Postsystem auf GitHub sendet.

Stand: im Aufbau, Teil B (Gerüst und Prüfkette). Die vier Bereiche **Wartet**, **Abnahmen**, **Erfassen** und **Mehr** sind leere Hüllen mit eigener Adresse; Lesen, Schreiben und Offline-Warteschlange folgen in späteren Teilen. Noch nicht veröffentlicht und noch nicht nutzbar.

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
ℹ tests 34
ℹ pass 34
ℹ fail 0
PASS  19 Dateien geprüft, kein Fremdhost
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
| `make test` | Fassung, Adressen, Stapel für Zurück, Manifest, CSP, Hülle des Service Workers |
| `make fremdhost` | dass im Code nur `api.github.com` und `ntfy.sh` vorkommen |
| `make secrets` | dass keine Geheimnisse im Arbeitsbaum stehen (gitleaks) |
| `make render` | jede Ansicht in zwei Größen, hell, dunkel, Schrift 200 % und ohne Netz |
| `make wege` | Zurück-Reihenfolge, Blätter, Statusleiste, Netzzeile und eine fehlerfreie Konsole in Chromium |

Wenn Chromium nicht startet und `make wege` mit `BLOCKED` endet: Chromium legt einen Socket unter `$TMPDIR` an, und ein Pfad über etwa 100 Zeichen bricht ab. Setze dann ein kurzes `TMPDIR`, etwa `TMPDIR=/tmp make wege`.

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `index.html`, `app.css` | Hülle mit Symbol-Sprite, Leisten und Blatt; Farben und Maße |
| `js/` | ES-Module: Adressen, Navigation mit der History API, Anzeige, Statusleiste, Netzzeile |
| `sw.js`, `manifest.webmanifest`, `symbole/` | Start ohne Netz und Installation |
| `tests/`, `tools/`, `Makefile` | Prüfkette |

## Fehlerberichte

https://github.com/llm-postoffice/app/issues

## Lizenz

GPL-3.0-or-later, siehe [LICENSE](LICENSE).

Die Symbole in `index.html` sind Material Symbols Rounded von Google (Apache-2.0, Text in [LICENSES/Apache-2.0.txt](LICENSES/Apache-2.0.txt), Quelle https://github.com/google/material-design-icons). Die App-Symbole in `symbole/` sind Platzhalter aus dem Beispiel von p94-hig unter GPL-3.0-or-later.
