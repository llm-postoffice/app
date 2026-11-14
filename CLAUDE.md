# Postfach

Installierbare Web-App für das Handy (Android, Vanadium unter GrapheneOS, Chrome): zeigt, was auf den Nutzer wartet,
beantwortet Fragen, beurteilt Abnahmen Schritt für Schritt, erfasst Einträge und sortiert den Eingang. Die Daten liegen
in einem privaten GitHub-Repo; die App liest und schreibt sie mit einem Token des Nutzers über die GitHub-API und
arbeitet offline mit einer Warteschlange.

- p94-hig: es gelten die Teile mobile, text und doku; vom Teil gui nichts.
- Stack ohne Build: HTML, CSS, ES-Module, Tests mit `node --test` (Node ab 22). Keine npm-Pakete, keine Bibliothek,
  keine Fremdskripte. Die CSP steht als `<meta http-equiv>`, weil Pages keine Kopfzeilen setzt; darum kein Inline-Skript,
  kein Inline-Stil und kein Host außer `api.github.com` und `ntfy.sh`. Zu `default-src 'none'` gehört `manifest-src
  'self'`: ohne es blockt Chromium das Manifest, und die App ließe sich nicht installieren. Der Renderer merkt das
  nicht, `tools/wege.mjs` schon (Verstöße gegen die CSP werden aufgezeichnet).
- Aufbau: `index.html` und `app.css` (Hülle, Farben, Maße), `js/` (Module), `sw.js` (Hülle nach Fassung, neue Dateien
  gehören in `DATEIEN`), `tools/` (Wegetest, Fremdhost-Prüfung), `tests/`. Module: `adressen.js`, `format.js`,
  `pytext.js`, `zustand.js`, `urteil.js`, `pruefen.js` und `texte.js` sind rein und laufen unter `node --test`;
  `speicher.js` (IndexedDB oder Arbeitsspeicher, dieselbe Schnittstelle), `abgleich.js` (GitHub lesen; `fetch` und
  Datenbank sind Parameter) und `steuerung.js` (wann der Abgleich läuft; auch Zeitgeber, Uhr und Sichtbarkeit sind
  Parameter) kennen den Browser nicht selbst. Die Ansichten (Teil D) bauen ihren Baum nur mit `el()` und `ico()` aus
  `dom.js` (nie `innerHTML`, Daten nur über `textContent`; ein Test erzwingt es), lesen den Stand über `welt.js` (rein,
  unter `node --test`) und laufen über `anzeigen.js`; `app.js` verbindet alles und ist für `start.js` und die Vorschau
  derselbe Einstieg. Symbole stehen als Sprite in `index.html` und sind Material Symbols (Apache-2.0); jedes benutzte
  Symbol muss im Sprite stehen und jedes im Sprite benutzt sein (`tests/geruest.test.mjs`).
- Schreiben ist Teil E: `js/schreiben.js` legt den Vertrag fest (`k.schreiben` mit `antworten`, `urteilSenden`,
  `erledigen`, `einsortieren`, `anlegen`). Bis dahin sind die Knöpfe gesperrt und ein Satz sagt warum; nichts täuscht
  einen Erfolg vor. Neue Handlungen bekommen in `welt.js` (`handlungenVon`) einen Eintrag und in der Ansicht einen Knopf
  mit `data-handlung` (E13; Test und Wegetest prüfen beides).
- Vorschau und Render: `tools/vorschau.mjs` liefert die App unter `/SZENARIO/` mit erfundenen Daten
  (`tests/hilfen/beispieldaten.mjs`, neutral: alpha, beta, gamma, rechner-a) und ersetzt dort nur `js/start.js`;
  `tools/rendern.mjs` lässt den Renderer aus p94-hig jedes Szenario prüfen. Ein neuer Zustand ist ein neues Szenario
  und eine Zeile in `ADRESSEN`.
- Der Renderer meldet in der Größe 448 × 923 (Ränder 0) „Ränder“ für jeden Text, der über den unteren Rand des Fensters
  hinausreicht, also für jede Seite, die scrollt (die Prüfung zählt dort einen Streifen der Höhe 0, den keine Leiste
  verdecken kann). Das ist ein Fehler des Renderers, nicht der App; die Meldung wird nicht umgedeutet.
- Gates: `make check` (Tests, Prüfung auf Fremdhosts, gitleaks, Rendern aller Zustände mit `rendern-mobil.mjs` aus dem
  p94-hig-Klon, Wegetest). Pfad des Klons: `make check HIG=PFAD`.
- Lizenz GPL-3.0-or-later. Version `YYYYMMDD.NN` steht gleich in `js/version.js`, `sw.js` und der obersten
  CHANGELOG-Überschrift und ist in der Ansicht Mehr sichtbar.
- Nie Tokens, PATs oder ntfy-Topics in Dateien, Logs oder Ausgaben; Testgeheimnisse nur zur Laufzeit verkettet.
- Zustand, Urteile und Prüfmuster sind ein Nachbau des Postwerkzeugs in Python (`zustand.js` und die Dateien daneben).
  Gleich bleiben sie durch die gemeinsamen Testfälle (`tests/testfaelle/cases.json`, wörtliche Kopie, Herkunft in
  `QUELLE.json`) und den Vergleich mit dem Werkzeug über `POST_QUELLE`, `POST_DATEN`, `POST_BEFEHL` und
  `POST_WERKZEUG` (siehe README). Weicht ein Regex-Muster von Python ab, steht die Abweichung mit Grund im Kopf von
  `js/pruefen.js`.
- Der Wegetest fängt `api.github.com` in Chromium ab (CDP `Fetch`) und antwortet aus einer Mock-Quelle; mit einem Testtoken
  geht nie eine Anfrage ins Netz. Der Browser-Test fand Fehler, die node nicht findet (Zeitgeber ohne Empfänger,
  MIME-Typ von `.mjs`); neue Browser-Schnittstellen darum dort prüfen.
- Das Repo ist öffentlich: kein Name des privaten Datenrepos, keine Rechner-, Personen- oder Pfadnamen in Code, Tests,
  Doku, Commits und PRs. Repo und Eigentümer trägt der Nutzer bei der Anmeldung ein.
- PR-Fluss: Arbeit auf einem Zweig, ein PR gegen `main` mit dem Prüfergebnis in der Beschreibung. `main` verlangt einen
  PR; Claude öffnet ihn, der Nutzer mergt. Nie direkt auf `main` pushen (einzige Ausnahme war der erste Commit).
- Browser-Tests nur headless mit frischem Profil, nie in Claude in Chrome. Chromium legt einen Socket unter `$TMPDIR`
  an und bricht bei einem Pfad über etwa 100 Zeichen ab (`Socket path too long`); dann ein kurzes `TMPDIR` setzen.
- Pages liefert `main` aus der Wurzel aus; es wird mit Teil G eingeschaltet, nicht früher.
