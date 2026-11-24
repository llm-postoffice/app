# LLM-Post

LLM-Post ist eine Web-App und Android-App für das Handy: Sie zeigt, was auf dich wartet, und sendet deine Antworten,
Urteile und neuen Einträge an ein Postsystem auf GitHub.

Du siehst, was auf dich wartet, beantwortest Fragen, beurteilst Abnahmen Schritt für Schritt, erledigst Einträge,
sortierst den Eingang ein und erfasst neue Einträge. Anhänge siehst du am Eintrag, speicherst du als Datei und hängst du beim Erfassen
und Antworten an (bis 1 MiB je Datei, Fotos verkleinert die App selbst, Bildschirmfotos bleiben). Jede Eingabe wartet zehn Sekunden auf **Rückgängig** und geht dann
als ein Commit raus; ohne Netz bleibt sie auf dem Gerät in der Warteschlange, ein Band oben in Wartet zeigt, was noch nicht gesendet ist.
Hinweise auf Neues kommen über ntfy; im Browser kann **Mehr** sie als Probe auch über Web-Push zustellen.

## Installation

Als Android-App mit Obtainium (Schritte: [docs/obtainium.md](docs/obtainium.md)). Trag diese Quell-URL ein:

```text
https://github.com/llm-postoffice/app
```

Als Web-App (Vanadium oder Chrome auf Android):

1. Öffne https://llm-postoffice.github.io/app/ im Browser.
2. Öffne das Menü ⋮ und tippe auf **Install and create shortcut**. Bei deutscher Oberfläche heißt der Eintrag
   vermutlich **App installieren** (nicht geprüft).
3. Bestätige die Frage und öffne LLM-Post vom Startbildschirm.

Melde dich beim ersten Start mit einem GitHub-Token an; die App sagt, was es braucht. Die Anmeldung gilt für die
installierte App, nicht für einen Browsertab: Öffne die App zum Arbeiten vom Startbildschirm.

Einträge ändern, neu adressieren oder verwerfen: [docs/bearbeiten.md](docs/bearbeiten.md).

## Entwickeln

Die App braucht keinen Build. Für die Prüfkette brauchst du Node ab Version 22, Chromium, gitleaks und einen Klon von
p94-hig (daraus kommt der Renderer):

```bash
make check HIG=PFAD
```

`PFAD` ist der Ordner des p94-hig-Klons. Einzelne Stufen, Vorschau mit erfundenen Daten und Prüfung gegen echte Daten:
[docs/entwicklung/pruefen.md](docs/entwicklung/pruefen.md). Bau der Android-Hülle und Release:
[docs/entwicklung/huelle.md](docs/entwicklung/huelle.md).

## Fehler und Lizenz

Fehler meldest du unter https://github.com/llm-postoffice/app/issues. Lizenz: GPL-3.0-or-later, siehe
[LICENSE](LICENSE). Die Symbole in `index.html` sind Material Symbols Rounded von Google (Apache-2.0, Text in
[LICENSES/Apache-2.0.txt](LICENSES/Apache-2.0.txt), Quelle https://github.com/google/material-design-icons). Das
Android-APK enthält Apache-2.0-Bibliotheken; Liste und Lizenztext liegen darin unter `lizenzen/`.
