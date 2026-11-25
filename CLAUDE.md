# LLM-Post

Installierbare Web-App für das Handy (Android, Vanadium unter GrapheneOS, Chrome): zeigt, was auf den Nutzer wartet,
beantwortet Fragen, beurteilt Abnahmen Schritt für Schritt, erfasst Einträge und sortiert den Eingang. Die Daten liegen
in einem privaten GitHub-Repo; die App liest und schreibt sie mit einem Token des Nutzers über die GitHub-API und
arbeitet offline mit einer Warteschlange.

- p94-hig: es gelten die Teile mobile, text und doku; vom Teil gui nichts. Doku für vier Leser: README für alle (höchstens
  100 Zeilen), `docs/` für Nutzer (eine Seite je Aufgabe), `docs/entwicklung/` für Entwickler, diese Datei für Sitzungen;
  README plus `docs/` bleiben kurz (Entwurfsdateien unter `docs/entwicklung/ansichten/` zählen nicht). Prüfung:
  `python3 -I PFAD/beispiele/abnahme.py .` im p94-hig-Klon.
- Stack ohne Build: HTML, CSS, ES-Module, Tests mit `node --test` (Node ab 22). Keine npm-Pakete, keine Bibliothek,
  keine Fremdskripte. Die CSP steht als `<meta http-equiv>`, weil Pages keine Kopfzeilen setzt; darum kein Inline-Skript,
  kein Inline-Stil und kein Host außer `api.github.com`. Zu `default-src 'none'` gehört `manifest-src
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
  `{ ok, id }`, `{ ok: false, fehler }` oder `{ ok: false, pruefung }` zurück; `rangAendern`, `eintragVerwerfen`, `neuAdressieren`, `nachtragen` und `erledigen` mit Ergebnis gehören zum Blatt Bearbeiten (`js/bearbeiten.js`, Adresse `#eintrag/ID/bearbeiten`, Variante A laut Wahl, Entwürfe in `docs/entwicklung/ansichten/bearbeiten/`; `handlungenVon` nennt `bearbeiten` für jeden offenen Eintrag, `welt.hostNamen` liefert die Rechner); `senden`, `erneut`, `verwerfen` (Sendung, nicht `eintragVerwerfen`) und
  `rueckgaengig` sind die Eingriffe des Nutzers. Eine Sendung wartet zehn Sekunden (Hinweis mit **Rückgängig**,
  `hinweis.js`), gleicht dann bedingt ab, prüft auf Konflikte (schon beantwortet, einsortiert, erledigt) und geht als ein
  Commit über die Git-Data-API raus (`senden.js`: Kopf, Blobs, Baum, Commit, Zweig ohne force, mindestens 1 s zwischen
  schreibenden Anfragen, Neubau bei 409 und 422). Die Dateien einer Sendung baut `dateien.js` Zeichen für Zeichen wie das
  Postwerkzeug (Testfälle `write`), ULIDs und neue IDs `erzeugen.js` (`crypto.getRandomValues`, Uhr gegen den `Date`-Kopf
  korrigiert). Die Ansichten gehen über `absenden.js`: eine abgelehnte Eingabe zeigt ein Band (ein Geheimnis geht nie raus,
  Personendaten mit **Trotzdem senden**). `app.js` baut den Schreiber, wenn ein `fetch` kommt; ohne Schreiber (nur in Tests)
  bleiben die Knöpfe gesperrt und ein Satz sagt warum. Eine neue Handlung bekommt in `welt.js` (`handlungenVon`) einen
  Eintrag und in der Ansicht einen Knopf mit `data-handlung` (E13; Test und Wegetest prüfen beides). Entwurf verwerfen (`verwirfEntwurf`, Knopf `entwurf-verwerfen` in Erfassen, nur mit Inhalt) gehört zu keinem Eintrag und steht nicht in `handlungenVon`; sein Hinweis hat Rückgängig. Eine Meldung, die während Rückgängig kommt (etwa „wartet auf Netz“), hält `hinweis.js` zurück und zeigt sie am Ende der Frist. Die Vorschau lässt die
  Zeitgeber der Schreibschicht still stehen; ein Szenario tippt mit `klick` einen Knopf an.
- Anhänge (Fassung 20261117.06): Der Abgleich liest Name und Größe aus dem Baum (`baum.anhaenge`), nie den Inhalt; `js/anhangholer.js` lädt ihn beim Aufklappen über die Blob-Abfrage und hält ihn im Speicher `anhaenge` (Datenbank Fassung 2). `js/anhaengeansicht.js` zeigt den Abschnitt am Eintrag (Bilder nur Raster als `data:`-Adresse, Text über `textContent`), `js/anhangwahl.js` das Anhängen in Erfassen und Antworten; die Regeln für Namen, Größe und Pfade (`attachments/NAME`, `attachments/ULID/NAME` mit Feld `Attachments`) stehen in `js/anhaenge.js` und `js/dateien.js` wie im Postwerkzeug. `bereiteVor` in `anhaenge.js` kodiert Fotos (JPEG, WebP, HEIC) mit `js/verkleinern.js` immer neu, ein PNG nur über 1 MiB; bleibt das Ergebnis nicht kleiner, gilt das Original (der Wegetest prüft es über **Datei anhängen**). Herunterladen: ein Link auf einen Blob. Urteile (Abnahme) und Neu adressieren nehmen noch keine Anhänge.
- Warteschlange sichtbar: `js/schlange.js` (Band oben in Wartet, Seite `#schlange` mit Erneut senden, Verwerfen, Trotzdem senden; `welt.js` `offeneSendungen`); ein neuer Eintrag aus der Schlange steht in der Welt (`mitLokalen`), damit seine Adresse öffnet. Die Zeile `Ohne Netz` (`#stand`, `js/netz.js`) erscheint und verschwindet nie unter dem Finger: erst eine Sekunde nach der letzten Berührung. Der Schreiber meldet über `meldung` einmal je Sendung, dass sie auf Netz wartet. Stand sichtbar (Fassung 20261118.01): eine Sendung, die gewartet hat (`gewartet`, gesetzt in `liegen`, `erneut`, `senden`), bleibt in Band und Seite sichtbar, während sie läuft (`sendet`) und nach dem Senden (`gesendet`, höchstens eine Minute); eine frische Sendung ohne Wartezeit lässt kein Band aufblitzen. Fristen („in etwa 40 s“) stehen in `js/frist.js` als Element mit `data-bis`; `starteFristen` (Uhr und Zeitgeber der App, in der Vorschau still) schreibt nur deren Text neu. `standZeile` in `ansichten.js` liefert die Zeilen unter der Zahl (Abgleich läuft, nächster Abgleich, ohne Netz) und hält die Höhe gleich; nach dem Lauf meldet `meldeNachgeholt` per Hinweis, was gewartet hatte und raus ist. Szenarien `schlange-sendet`, `schlange-versuch`, `schlange-gesendet` (`nachStart` legt Sendungen nach dem Start an, weil der Start „wird gesendet“ zurücksetzt).
- Netz erkennen: `navigator.onLine` täuscht unter einem dauerhaften VPN im Flugmodus (bleibt true). `js/netzprobe.js` (`Netzpruefer`, rein, Fetch, Uhr und Zeitgeber sind Parameter): `onLine === false` gilt sofort als offline, sonst eine HEAD-Probe auf `js/version.js` des eigenen Ursprungs (`cache: no-store`, 3 s) beim Start, bei online/offline, beim Sichtbarwerden, nach einem Abgleichfehler am Netz und vor jedem Abgleich und jeder Sendung (`pruefeNetz` der Steuerung und des Schreibers, höchstens alle 10 s neu); offline und sichtbar neue Probe nach 5, 10, 20, 40, 60 s, bei Erfolg `netzDa`. Der Service Worker fängt nur GET ab, ein HEAD geht ans Netz; die CSP braucht dafür `connect-src 'self'`. Echter Flugmodus mit VPN bleibt ein Test auf dem Handy.
- Offline, Installation und Update (Teil F): `sw.js` ist ein Modul (`register('./sw.js', { type: 'module' })`) und hält die Hülle
  nach Fassung; seine Entscheidungen (welche Caches fallen weg, wann wartet ein Update, was gibt ihn frei) stehen in
  `js/swlogik.js`, rein unter `node --test`. `js/aktualisieren.js` (`Aktualisierung`, Container und Neuladen sind Parameter)
  beobachtet die Registrierung: wartet ein Worker und steuert schon eine ältere Fassung die Seite, zeigt `#neu` in
  `index.html` die Zeile „Neue Fassung geladen.“ mit **Neu starten**, in Mehr steht dasselbe als Band bei Fassung (dort fehlt
  die Zeile). Der Knopf schickt `wechseln` an den wartenden Worker; geladen wird einmal nach `controllerchange`, nie von
  selbst und nie, weil eine andere Seite wechselte (der Knopf heißt **Neu starten**, nicht **Neu laden**, weil die App wirklich neu
  startet). Geprüft wird beim Öffnen und bei jeder Rückkehr in den
  Vordergrund, ohne Netz still. Wortlaut von Installation und Mitteilungen steht in `texte.js` (`installationAnzeige`,
  `WEBPUSH`, mit **fett** für Beschriftungen); „Install and create shortcut“ ist der Eintrag in Vanadium (Probe),
  der deutsche Wortlaut ist nicht geprüft und steht so da. Die Vorschau setzt `aktualisierung` und `installiert`
  für die Szenarien `neue-fassung`, `installiert` ein, die ein Renderer nicht herstellen kann; Szenarien mit `scroll`
  (Bilder von unteren Abschnitten in Mehr) laufen nicht im Standardlauf von `tools/rendern.mjs`, weil der Renderer beim
  Scrollen „unter der Statusleiste“ meldet. Der Wegetest ändert den Cache-Namen des Service Workers über den Server und
  belegt Start ohne Netz und Update-Weg in Chromium.
- Web-Push, der einzige Weg für Mitteilungen (der frühere Hinweisdienst ist entfernt, siehe CHANGELOG): `js/webpush.js` (`WebPushProbe`, Browser und Speicher des Schlüssels sind Parameter), der Abschnitt „Mitteilungen“ in `js/mehr.js` und die Handler `push` und `notificationclick` in `sw.js`; ihre Entscheidungen (fester Hinweis, Ziel des Tipps, welches Fenster) stehen rein in `js/swlogik.js` (`pushZiel`, `klickPlan`). Nur im Browser mit Service Worker und `PushManager`: ohne `PushManager` steht ein Satz. Das Postwerkzeug sendet den Push ohne Nutzlast (`claude-post webpush`, nur VAPID-Kopfzeile): der Hinweis ist fest („Neue Einträge für dich“); eine Nutzlast `{"ziel":"#eintrag/ID"}` bestimmt den Eintrag, jedes andere Ziel fällt auf Wartet. Ein Tipp öffnet nie sofort: der Service Worker holt ein offenes Fenster nach vorn und schickt ihm die Nachricht `push-klick`, oder er öffnet die App mit `?push`; die App gleicht dann ab (`js/pushklick.js`, `folgeTipp`) und öffnet danach das Ziel über `geheUeberWartet` (Zurück führt nach Wartet). Ohne Nutzlast ist das Ziel der neueste Eintrag an dich, den der Stand vor dem Abgleich nicht kannte, sonst Wartet. Fehlt der Eintrag auch dann, sagt `fehltEintrag` in `eintrag.js` warum und führt mit **Zu Wartet** zurück. Die Berechtigung für Mitteilungen fragt nur der Tipp auf **Einschalten**; die Push-Anmeldung braucht keinen weiteren Host in der CSP (der Browser spricht mit seinem Push-Dienst). Szenarien `mehr-webpush`, `-an`, `-fehler`, `-ohne` (nachgebauter Browser in `tools/vorschau.mjs`; ohne Feld `webpush` hat die Vorschau kein Web-Push). Der Wegetest prüft den Abschnitt im Browser; das Abo selbst braucht den Push-Dienst von Google und bleibt dem Test auf dem Handy. Entfernen: diese Stellen, die Zeilen in `app.js`, `DATEIEN` in `sw.js` und die Szenarien.
- Der Schreibtest `tests/mockgithub.test.mjs` braucht `POST_DATEN` und `POST_PRUEFBEFEHL` (siehe `docs/entwicklung/pruefen.md`) und überspringt
  sich ohne sie; mit ihnen endet die Prüfung des Postwerkzeugs auf der Sandbox mit Exit 0.
- Vorschau und Render: `tools/vorschau.mjs` liefert die App unter `/SZENARIO/` mit erfundenen Daten
  (`tests/hilfen/beispieldaten.mjs`, neutral: alpha, beta, gamma, rechner-a) und ersetzt dort nur `js/start.js`;
  `tools/rendern.mjs` lässt den Renderer aus p94-hig jedes Szenario prüfen. Ein neuer Zustand ist ein neues Szenario
  und eine Zeile in `ADRESSEN`.
- Der Renderer meldet in der Größe 448 × 923 (Ränder 0) „Ränder“ für jeden Text, der über den unteren Rand des Fensters
  hinausreicht, also für jede Seite, die scrollt (die Prüfung zählt dort einen Streifen der Höhe 0, den keine Leiste
  verdecken kann). Das ist ein Fehler des Renderers, nicht der App; die Meldung wird nicht umgedeutet.
- Android-Hülle: stillgelegt und aus dem Baum entfernt (2026-11-25, Auftrag dxcy2d, Antwort C aus rvp-xm6: `android/`, Brücke `js/huelle.js`, Systemfarben `js/farben.js`, Teilen-Weg, `huelle.yml`, Makefile-Ziele `apk*`). Die Web-App ist der einzige Weg zum Handy (`docs/installieren.md`); der Verlauf in Git hält den Stand davor (letzte Fassung mit Hülle: 20261124.03). Signierschlüssel und Secrets der Hülle sind gelöscht (2026-11-25, js32bt).
- Das Symbol der App hat eine Quelle, `tools/symbol.svg`; `make symbole` erzeugt `symbole/*.png`, nach einer Änderung an der Quelle beides committen (`tests/symbol.test.mjs`).
- Gates: `make check` (Tests, Prüfung auf Fremdhosts, gitleaks, Rendern aller Zustände mit `rendern-mobil.mjs` aus dem
  p94-hig-Klon, Wegetest). Pfad des Klons: `make check HIG=PFAD`. Die Stufen laufen gleichzeitig, das Rendern mit mehreren
  Jobs (`make check` verteilt ein Budget aus `claude-jobs`; allein nach Kernen und freiem Speicher; `JOBS=N` oder `--jobs N`). Das Rendern wartet nicht auf eine feste Pause, sondern mit `--bereit` auf `window.fertig`, das die Vorschau setzt (`--warte` ist die Obergrenze). Beim Iterieren nur die betroffenen Szenarien
  und Tests (`make render SZENARIEN="leer fehler"`, `node --test tests/NAME.test.mjs`); der volle `make check` einmal vor
  dem PR. Einzelheiten: `docs/entwicklung/pruefen.md`.
- Lizenz GPL-3.0-or-later. Version `YYYYMMDD.NN` steht gleich in `js/version.js`, `sw.js` und der obersten
  CHANGELOG-Überschrift und ist in der Ansicht Mehr sichtbar.
- Nie Tokens, PATs oder Schlüssel in Dateien, Logs oder Ausgaben; Testgeheimnisse nur zur Laufzeit verkettet.
- Zustand, Urteile und Prüfmuster sind ein Nachbau des Postwerkzeugs in Python (`zustand.js` und die Dateien daneben).
  Gleich bleiben sie durch die gemeinsamen Testfälle (`tests/testfaelle/cases.json`, wörtliche Kopie, Herkunft in
  `QUELLE.json`) und den Vergleich mit dem Werkzeug über `POST_QUELLE`, `POST_DATEN`, `POST_BEFEHL` und
  `POST_WERKZEUG` (Werkzeug und Testfälle liegen in claude-tools: `post/claude_post_main.py`, `tests/post`; Aufruf mit
  `python3 -I` und `CLAUDE_POST_DIR` auf einer Wegwerf-Kopie der Daten, siehe `docs/entwicklung/pruefen.md`). Weicht ein Regex-Muster von Python ab, steht die Abweichung mit Grund im Kopf von
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
- Pages ist eingeschaltet und liefert `main` aus der Wurzel aus (https://llm-postoffice.github.io/app/, Stand 2026-11-17: gebaut, Fassung 20261117.04).
