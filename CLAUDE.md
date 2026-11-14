# Postfach

Installierbare Web-App für das Handy (Android, Vanadium unter GrapheneOS, Chrome): zeigt, was auf den Nutzer wartet,
beantwortet Fragen, beurteilt Abnahmen Schritt für Schritt, erfasst Einträge und sortiert den Eingang. Die Daten liegen
in einem privaten GitHub-Repo; die App liest und schreibt sie mit einem Token des Nutzers über die GitHub-API und
arbeitet offline mit einer Warteschlange.

- p94-hig: es gelten die Teile mobile, text und doku; vom Teil gui nichts.
- Stack ohne Build: HTML, CSS, ES-Module, Tests mit `node --test` (Node ab 22). Keine npm-Pakete, keine Bibliothek,
  keine Fremdskripte. Die CSP steht als `<meta http-equiv>`, weil Pages keine Kopfzeilen setzt; darum kein Inline-Skript,
  kein Inline-Stil und kein Host außer `api.github.com` und `ntfy.sh`.
- Gates: `make check` (Tests, Prüfung auf Fremdhosts, gitleaks, Rendern aller Zustände mit `rendern-mobil.mjs` aus dem
  p94-hig-Klon, Wegetest). Pfad des Klons: `make check HIG=PFAD`.
- Lizenz GPL-3.0-or-later. Version `YYYYMMDD.NN` steht gleich in `js/version.js`, `sw.js` und der obersten
  CHANGELOG-Überschrift und ist in der Ansicht Mehr sichtbar.
- Nie Tokens, PATs oder ntfy-Topics in Dateien, Logs oder Ausgaben; Testgeheimnisse nur zur Laufzeit verkettet.
- Das Repo ist öffentlich: kein Name des privaten Datenrepos, keine Rechner-, Personen- oder Pfadnamen in Code, Tests,
  Doku, Commits und PRs. Repo und Eigentümer trägt der Nutzer bei der Anmeldung ein.
- PR-Fluss: Arbeit auf einem Zweig, ein PR gegen `main` mit dem Prüfergebnis in der Beschreibung. `main` verlangt einen
  PR; Claude öffnet ihn, der Nutzer mergt. Nie direkt auf `main` pushen (einzige Ausnahme war der erste Commit).
- Browser-Tests nur headless mit frischem Profil, nie in Claude in Chrome.
- Pages liefert `main` aus der Wurzel aus; es wird mit Teil G eingeschaltet, nicht früher.
