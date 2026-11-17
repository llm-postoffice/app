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
