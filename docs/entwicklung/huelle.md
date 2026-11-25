# Android-Hülle (stillgelegt)

Stand 2026-11-25: Die Hülle ist stillgelegt. Es gibt keine Releases und keinen Workflow mehr; die Web-App ist der einzige Weg zum Handy
(`docs/installieren.md`). `android/` und die Brücke in `js/huelle.js` bleiben im Verlauf, werden nicht mehr gebaut und nicht mehr
geprüft (`make apk` gehört nie zu `make check`). Der Signierschlüssel und die Secrets bleiben unangetastet, bis der Nutzer entscheidet.
Die Abschnitte unten beschreiben den Stand bis dahin.

`android/` ist eine WebView, die LLM-Post aus den Dateien dieses Repos zeigt. Du brauchst Java ab 17 (eine JRE reicht) und
die Kommandozeilenwerkzeuge des Android SDK, kein Android Studio.

## Bauen
1. Installier die Kommandozeilenwerkzeuge nach `$XDG_DATA_HOME/android-sdk/cmdline-tools/latest`
   (https://developer.android.com/studio, „Command line tools only“) und nimm die Lizenzen an. Ruf `android` mit
   `--no-metrics` auf. Plattform und Build-Tools lädt Gradle beim ersten Bau.
2. Bau das Debug-APK (`android/app/build/outputs/apk/debug/app-debug.apk`) und lass die JVM-Tests laufen:
   ```sh
   make apk && make apk-test
   ```

Werkzeuge liegen unter `$XDG_DATA_HOME` (ohne: `~/.local/share`): `android-sdk` (`ANDROID_HOME`), `gradle`
(`GRADLE_USER_HOME`), `android` (`ANDROID_USER_HOME`). Jede Variable lässt sich beim Aufruf setzen, etwa
`make apk ANDROID_HOME=PFAD`; ruf `android/gradlew` ohne `make` nur mit ihnen auf.

## Aufbau
- `versionName` ist die Fassung aus `js/version.js`; die Aufgabe `webDateien` kopiert die Dateien aus `DATEIEN` in
  `sw.js` als Assets.
- `HauptActivity.kt` lädt die App über `WebViewAssetLoader`; Links nach draußen öffnet der Browser. Die Brücke `llmpost`
  steht vor dem ersten Skript (Protokoll im Kopf von `js/huelle.js`). `Ziel.kt` liest Intents (`llmpost://eintrag/ID`,
  Teilen als Entwurf), `Tresor.kt` hält das Token im Android Keystore.
- Farben (Material You): `Farben.kt` ordnet Töne der Systempalette (`system_accent1_600` und so weiter, aus den Ressourcen von
  Android gelesen) den Rollen von `app.css` zu und baut die Nachricht `farben` (hell und dunkel in einer Nachricht, Protokoll im Kopf
  von `js/huelle.js`). `HauptActivity.kt` schickt sie nach `bereit` und bei der Rückkehr in den Vordergrund, wenn sie sich geändert hat;
  `js/farben.js` setzt die Rollen auf `:root`. Die Tabelle steht gleich in `tests/hilfen/farbrollen.mjs` (Vorschau,
  `tests/farbrollen.test.mjs` vergleicht beide). Der Hintergrund der Activity vor dem ersten Bild ist Ton 10 (hell) oder 900 (dunkel)
  der Palette neutral1. Nicht auf dem Handy belegt: ob ein Wechsel des Hintergrundbilds die Activity neu aufbaut oder nur die Rückkehr
  die Farben nachholt; beide Wege sind abgedeckt.
- Anhänge: Die Nachricht `speichern` (Name, Typ, Base64; Protokoll im Kopf von `js/huelle.js`) prüft `Speichern.kt` (Name ohne
  Pfad, höchstens 100 Zeichen, MIME-Typ, höchstens 1 MiB); `HauptActivity.kt` öffnet dazu `ACTION_CREATE_DOCUMENT` und
  schreibt die Bytes an den gewählten Ort, ohne neue Berechtigung. `<input type=file>` der Seite (Datei anhängen) bedient
  `onShowFileChooser` mit der Dateiauswahl des Systems. Beides prüft kein Test auf der JVM, nur das Handy.
- Dateien aus dem Teilen: Das Manifest nimmt `ACTION_SEND` und `ACTION_SEND_MULTIPLE` mit `*/*` an. `HauptActivity.kt` liest `EXTRA_STREAM`
  (sonst die ClipData) und die Freigabe des Intents (`FLAG_GRANT_READ_URI_PERMISSION`); `Ziel.kt` macht daraus ein `Ziel.Teilen` mit
  den Adressen. Gelesen wird abseits der Oberfläche über `InhaltsQuelle.kt` (ContentResolver: `OpenableColumns`, `getType`,
  `openInputStream`), die Regeln stehen rein in `Teilen.kt` (`ZielTest`, `TeilenTest`): nur `content://` mit Freigabe, höchstens 10
  Dateien, die Größe vorab und noch einmal beim Lesen begrenzt: auf 1 MiB, für Bilder (JPEG, PNG, WebP, HEIC) auf 20 MiB; eine
  größere Datei bleibt ohne Inhalt, nur Name, Größe und Grenze gehen an die Seite. Ein Teilen kommt als mehrere Nachrichten `teilen`
  (Protokoll im Kopf von `js/huelle.js`): erst Text und Abgelehntes, dann je Datei eine, und die nächste Datei liest die Hülle erst,
  wenn die Seite die vorige mit `weiter` quittiert (`nachrichten` in `Teilen.kt`, `HauptActivity.kt`); so liegt bei 20 MiB nie mehr als
  eine Datei im Speicher (Base64 über die Brücke, dazu `largeHeap` im Manifest). Die Seite nimmt sie über `teileAuf` in
  `js/anhaenge.js` in die Anhangliste von Erfassen auf, mit denselben Prüfungen wie Datei anhängen; Fotos kodiert
  `js/verkleinern.js` immer neu, ein PNG nur über 1 MiB (`createImageBitmap`, `OffscreenCanvas`, JPEG oder WebP, Kante 2560 bis 1280, Qualität 0,85 bis 0,7). Was nicht
  übernommen wurde, steht als Band oben in Erfassen, bis der Nutzer **Verstanden** tippt. Nicht auf dem Handy belegt: wie sich Apps
  mit nur `ClipData` oder ohne Freigabe verhalten, der Speicherbedarf bei 20 MiB; die Brücke prüft der Wegetest mit einer Attrappe.
- Ändert sich eine Abhängigkeit (Apache-2.0), ändert sich `android/app/BIBLIOTHEKEN.txt` mit.

## Release (nicht mehr in Betrieb)
Bis 2026-11-25 startete ein Tag `YYYYMMDD.NN` den Workflow `huelle.yml`, der das signierte APK an das Release hängte. Der Workflow
ist entfernt, ein Tag baut keine Hülle mehr. Wer die Hülle wieder braucht, holt `huelle.yml` aus dem Verlauf; lokal baut
`make apk-release` ein signiertes APK (Schlüssel: `make signatur`, Ablage `$XDG_DATA_HOME/llm-post/signatur/`).
