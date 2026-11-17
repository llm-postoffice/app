# Android-Hülle bauen

Die Hülle in `android/` ist eine kleine Android-App: eine WebView, die LLM-Post aus den Dateien dieses Repos zeigt.
Sie braucht kein Android Studio, nur Java ab 17 (eine JRE reicht) und die Kommandozeilenwerkzeuge des Android SDK.

## Erster Bau

1. Installier die Kommandozeilenwerkzeuge des Android SDK nach `$XDG_DATA_HOME/android-sdk/cmdline-tools/latest`
   (https://developer.android.com/studio, Abschnitt „Command line tools only“) und nimm die Lizenzen an. Ruf die
   Kommandozeile `android` dabei immer mit `--no-metrics` auf; ohne sammelt sie Nutzungsdaten. Plattform und
   Build-Tools lädt Gradle beim ersten Bau selbst.
2. Bau das Debug-APK:
   ```sh
   make apk
   ```
   Es liegt danach in `android/app/build/outputs/apk/debug/app-debug.apk`.
3. Lass die JVM-Tests laufen:
   ```sh
   make apk-test
   ```

## Wohin die Werkzeuge gehen

| Was | Ort | Variable |
| --- | --- | --- |
| Android-SDK | `$XDG_DATA_HOME/android-sdk` | `ANDROID_HOME` |
| Gradle mit dem JDK 17 für den Bau | `$XDG_DATA_HOME/gradle` | `GRADLE_USER_HOME` |
| Debug-Schlüssel, Einstellungen der Android-Werkzeuge | `$XDG_DATA_HOME/android` | `ANDROID_USER_HOME` |

Ohne `XDG_DATA_HOME` gilt `~/.local/share`. Jede Variable lässt sich beim Aufruf setzen, etwa
`make apk ANDROID_HOME=PFAD`. Wer `android/gradlew` ohne `make` aufruft, setzt sie selbst.

## Aufbau

- `android/app/build.gradle.kts`: `versionName` ist die Fassung aus `js/version.js`, `versionCode` dieselbe Zahl
  ohne Punkt (`FassungTest`). Die Aufgabe `webDateien` kopiert dieselben Dateien wie `DATEIEN` in `sw.js` in die
  Assets unter `web/`.
- `HauptActivity.kt`: lädt `https://appassets.androidplatform.net/assets/web/index.html` über `WebViewAssetLoader`.
  Links nach draußen öffnet der Browser. Zurück geht durch den Verlauf der App und verlässt sie ganz oben.
- Das Symbol `res/drawable-nodpi/symbol_vorne.png` ist eine Kopie von `symbole/maskierbar-512.png`; `SymbolTest`
  hält beide gleich.

## Brücke zur Web-App

- Die Hülle legt vor dem ersten Skript das Objekt `llmpost` an (`WebViewCompat.addWebMessageListener`), nur für die
  Herkunft der Assets und nur im Hauptframe. Das Protokoll steht im Kopf von `js/huelle.js`.
- `Ziel.kt` liest Intents ohne Android-Typen (`ZielTest`): `llmpost://eintrag/ID` öffnet den Eintrag, jede andere
  Adresse mit dem Schema öffnet Wartet, Teilen (`text/plain`) legt den Text als Entwurf in Erfassen.
- `Tresor.kt` hält das Token: AES-GCM mit einem Schlüssel im Android Keystore, Datei `token.bin` in
  `noBackupFilesDir`. Fehlt der Schlüssel (etwa nach einer Neuinstallation), fragt die App neu nach der Anmeldung.
- Einen Link auf einem angeschlossenen Handy ausprobieren:
  ```sh
  adb shell am start -a android.intent.action.VIEW -d 'llmpost://eintrag/ID'
  ```

## Release

Ein Tag der Form `YYYYMMDD.NN` startet `.github/workflows/huelle.yml`: Tests, Bau, Signatur, dann hängt der Lauf
`llm-post-TAG.apk` an das Release des Tags und legt es mit dem Abschnitt aus `CHANGELOG.md` an, wenn es fehlt. Der
Tag muss gleich `js/version.js` sein. Push den Tag mit deinem Konto; ein Tag aus einem Workflow startet keinen Lauf.

Einmal vorher:

1. Leg den Signierschlüssel an. Er liegt danach in `~/.local/share/llm-post/signatur/`. Sichere den Ordner außerhalb
   dieses Rechners: ohne ihn gibt es keine Updates mehr, nur eine Neuinstallation.
   ```sh
   make signatur
   ```
2. Trag ihn als Secrets im Repo ein:
   ```sh
   base64 -w0 ~/.local/share/llm-post/signatur/llm-post.p12 | gh secret set SIGNATUR_P12
   gh secret set SIGNATUR_PASSWORT < ~/.local/share/llm-post/signatur/passwort
   ```

Lokal signiert bauen: `make apk-release`; das APK liegt dann in `android/app/build/llm-post-FASSUNG.apk`.

Nach dem zweiten Release prüfen, dass beide Fassungen dasselbe Zertifikat tragen (gleiche Zeile `SHA-256 digest`):
```sh
~/.local/share/android-sdk/build-tools/37.0.0/apksigner verify --print-certs llm-post-ALT.apk
~/.local/share/android-sdk/build-tools/37.0.0/apksigner verify --print-certs llm-post-NEU.apk
```
