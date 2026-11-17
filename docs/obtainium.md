# LLM-Post mit Obtainium installieren

Die Android-App kommt nicht aus einem Store. Sie hängt als APK an einem Release auf GitHub; Obtainium holt sie von dort
und meldet neue Fassungen. Obtainium braucht dafür kein GitHub-Token.

1. Installier Obtainium, falls es fehlt: [Obtainium-Releases](https://github.com/ImranR98/Obtainium/releases).
2. Tippe in Obtainium unten auf **Hinzufügen**.
3. Trag bei **Quell-URL der App** `https://github.com/llm-postoffice/app` ein.
4. Setz unter **Zusatzoptionen für GitHub** das Feld **App-Name** auf `LLM-Post`, sonst heißt die App `app`.
5. Tippe am Ende des Feldes für die URL auf das Plus-Symbol. Obtainium öffnet die Seite der App.
6. Tippe auf **Installieren**. Fragt Android, ob Obtainium Apps installieren darf, erlaube es.
7. Öffne LLM-Post und melde dich mit deinem GitHub-Token an. Die App sagt, was das Token braucht.

Das Symbol zeigt Obtainium erst nach der Installation. Neue Fassungen zeigt es mit **Aktualisieren**; ein Update behält
Anmeldung, Entwürfe und Daten.

| Wenn | Dann |
| --- | --- |
| Die App heißt in Obtainium `app` | Tippe auf der Seite der App auf das Stift-Symbol (**Zusätzliche Optionen**) und setz **App-Name** auf `LLM-Post` |
| Obtainium meldet **Keine APK gefunden** | Es gibt noch kein Release mit der App: [Releases](https://github.com/llm-postoffice/app/releases) |
| LLM-Post läuft schon als Web-App | Sende, was dort noch wartet, und melde dich in der Android-App neu an |
| Die Oberfläche ist englisch | Die Knöpfe heißen **Add**, **App source URL**, **Install**, **Update**, das Feld **App name** |
