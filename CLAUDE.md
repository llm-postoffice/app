# LLM-Post

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
  derselbe Einstieg. Alle (`uebersicht.js`) hält den Filter im Speicher der Seite; Filter und Sortierung rechnet `welt.js` (rein), eine Auswahl ist ein Blatt mit Adresse `#alle/NAME`; die Vorschau setzt den Filter über `filter` im Szenario. Symbole stehen als Sprite in `index.html` und sind Material Symbols (Apache-2.0); jedes benutzte
  Symbol muss im Sprite stehen und jedes im Sprite benutzt sein (`tests/geruest.test.mjs`).
- Schreiben (Teil E): `js/schreiben.js` ist die Schreibschicht (`k.schreiben`, ein `Schreiber`): `antworten`, `urteilSenden`,
  `erledigen`, `einsortieren`, `anlegen` reihen eine Sendung in die Warteschlange (Speicher `schlange`) und geben
  `{ ok, id }`, `{ ok: false, fehler }` oder `{ ok: false, pruefung }` zurück; `senden`, `erneut`, `verwerfen` und
  `rueckgaengig` sind die Eingriffe des Nutzers. Eine Sendung wartet zehn Sekunden (Hinweis mit **Rückgängig**,
  `hinweis.js`), gleicht dann bedingt ab, prüft auf Konflikte (schon beantwortet, einsortiert, erledigt) und geht als ein
  Commit über die Git-Data-API raus (`senden.js`: Kopf, Blobs, Baum, Commit, Zweig ohne force, mindestens 1 s zwischen
  schreibenden Anfragen, Neubau bei 409 und 422). Die Dateien einer Sendung baut `dateien.js` Zeichen für Zeichen wie das
  Postwerkzeug (Testfälle `write`), ULIDs und neue IDs `erzeugen.js` (`crypto.getRandomValues`, Uhr gegen den `Date`-Kopf
  korrigiert). Die Ansichten gehen über `absenden.js`: eine abgelehnte Eingabe zeigt ein Band (ein Geheimnis geht nie raus,
  Personendaten mit **Trotzdem senden**). `app.js` baut den Schreiber, wenn ein `fetch` kommt; ohne Schreiber (nur in Tests)
  bleiben die Knöpfe gesperrt und ein Satz sagt warum. Eine neue Handlung bekommt in `welt.js` (`handlungenVon`) einen
  Eintrag und in der Ansicht einen Knopf mit `data-handlung` (E13; Test und Wegetest prüfen beides). Die Vorschau lässt die
  Zeitgeber der Schreibschicht still stehen; ein Szenario tippt mit `klick` einen Knopf an.
- Offline, Installation und Update (Teil F): `sw.js` ist ein Modul (`register('./sw.js', { type: 'module' })`) und hält die Hülle
  nach Fassung; seine Entscheidungen (welche Caches fallen weg, wann wartet ein Update, was gibt ihn frei) stehen in
  `js/swlogik.js`, rein unter `node --test`. `js/aktualisieren.js` (`Aktualisierung`, Container und Neuladen sind Parameter)
  beobachtet die Registrierung: wartet ein Worker und steuert schon eine ältere Fassung die Seite, zeigt `#neu` in
  `index.html` die Zeile „Neue Fassung geladen.“ mit **Neu starten**, in Mehr steht dasselbe als Band bei Fassung (dort fehlt
  die Zeile). Der Knopf schickt `wechseln` an den wartenden Worker; geladen wird einmal nach `controllerchange`, nie von
  selbst und nie, weil eine andere Seite wechselte (UOF-5; der Knopf heißt **Neu starten**, nicht **Neu laden** wie in der
  Regel: Abweichung, weil die App wirklich neu startet). Geprüft wird beim Öffnen und bei jeder Rückkehr in den
  Vordergrund, ohne Netz still. Wortlaut von Installation und Mitteilungen steht in `texte.js` (`installationAnzeige`,
  `MITTEILUNGEN`, mit **fett** für Beschriftungen); „Install and create shortcut“ ist der Eintrag in Vanadium (Probe),
  der deutsche Wortlaut ist nicht geprüft und steht so da. Mitteilungen weichen von UMI-3 ab (ein Tipp öffnet ntfy) und
  versprechen kein Öffnen der App (UMI-4), Grund im Kopf der Texte. Die Vorschau setzt `aktualisierung` und `installiert`
  für die Szenarien `neue-fassung`, `installiert` ein, die ein Renderer nicht herstellen kann; Szenarien mit `scroll`
  (Bilder von unteren Abschnitten in Mehr) laufen nicht im Standardlauf von `tools/rendern.mjs`, weil der Renderer beim
  Scrollen „unter der Statusleiste“ meldet. Der Wegetest ändert den Cache-Namen des Service Workers über den Server und
  belegt Start ohne Netz und Update-Weg in Chromium.
- Android-Hülle, Web-Teil: `js/huelle.js` (rein, unter `node --test`) spricht mit der Hülle über das Objekt `llmpost`, das die Hülle vor dem ersten Skript anlegt; fehlt es (Browser), ändert sich nichts. Nachrichten sind JSON: `bereit`, `token-holen`, `token-setzen` (Seite an Hülle, mit `nr`) und `oeffnen`, `teilen` (Hülle an Seite); ein weiterer Wert der Hülle (etwa Systemfarben) wird eine neue Art mit einem Empfänger in `huelle.verbinde` in `js/app.js`; das Protokoll steht im Kopf von `js/huelle.js` und gilt wörtlich auch für die Kotlin-Seite. In der Hülle legt `mitTresor` das Token in den Android Keystore statt in IndexedDB, die App registriert keinen Service Worker (Updates kommen als APK), Mehr zeigt keinen Abschnitt App installieren, und geteilter Text landet als Entwurf in Erfassen. Die Vorschau stellt die Hülle mit den Szenarien `huelle` und `mehr-huelle` nach, der Wegetest mit einer nachgebauten Brücke auf der Herkunft `localhost`.
- Der Schreibtest `tests/mockgithub.test.mjs` braucht `POST_DATEN` und `POST_PRUEFBEFEHL` (siehe README) und überspringt
  sich ohne sie; mit ihnen endet die Prüfung des Postwerkzeugs auf der Sandbox mit Exit 0.
- Vorschau und Render: `tools/vorschau.mjs` liefert die App unter `/SZENARIO/` mit erfundenen Daten
  (`tests/hilfen/beispieldaten.mjs`, neutral: alpha, beta, gamma, rechner-a) und ersetzt dort nur `js/start.js`;
  `tools/rendern.mjs` lässt den Renderer aus p94-hig jedes Szenario prüfen. Ein neuer Zustand ist ein neues Szenario
  und eine Zeile in `ADRESSEN`.
- Der Renderer meldet in der Größe 448 × 923 (Ränder 0) „Ränder“ für jeden Text, der über den unteren Rand des Fensters
  hinausreicht, also für jede Seite, die scrollt (die Prüfung zählt dort einen Streifen der Höhe 0, den keine Leiste
  verdecken kann). Das ist ein Fehler des Renderers, nicht der App; die Meldung wird nicht umgedeutet.
- Android-Hülle (`android/`, Kotlin ohne Compose): eine Activity (`HauptActivity`) mit einer WebView, die die Web-App aus den Assets zeigt (`WebViewAssetLoader`, Herkunft `https://appassets.androidplatform.net`, Pfad `/assets/web/`). Einzige Bibliothek ist `androidx.webkit`, Tests mit JUnit 4 unter `android/app/src/test/`. Die Aufgabe `webDateien` in `android/app/build.gradle.kts` kopiert dieselben Dateien wie `DATEIEN` in `sw.js`; `versionName` ist die Fassung aus `js/version.js`, `versionCode` dieselbe Zahl ohne Punkt. Werkzeuge liegen nach XDG (Android-SDK unter `$XDG_DATA_HOME/android-sdk`, von Hand installiert, die Kommandozeile `android` nur mit `--no-metrics`; Gradle und das JDK 17 für den Bau unter `$XDG_DATA_HOME/gradle`; `ANDROID_USER_HOME` ist `$XDG_DATA_HOME/android`; das Makefile setzt alle drei), nichts in `~` direkt, kein `~/Android`. Fehlende Plattformen und Build-Tools lädt Gradle selbst; jede weitere Installation am SDK nur nach Rückfrage. Gates der Hülle: `make apk-test` und `make apk`; sie gehören nicht zu `make check`. Bau und Werkzeuge: `docs/entwicklung/huelle.md`.
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
