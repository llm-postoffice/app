# LLM-Post auf dem Handy installieren

LLM-Post läuft als Web-App in Vanadium (oder Chrome) auf Android und meldet Neues per Web-Push. Du brauchst dazu einen
Rechner, auf dem `claude-post` läuft: Er schickt die Hinweise.

1. Öffne https://llm-postoffice.github.io/app/ in Vanadium.
2. Öffne das Menü ⋮, tippe auf **Install and create shortcut** und bestätige die Frage.
3. Öffne LLM-Post vom Startbildschirm, nicht aus dem Browsertab, und melde dich mit deinem GitHub-Token an.
4. Öffne die Einstellungen von Android, **Apps**, **Vanadium**, **App battery usage**, und wähle **Unrestricted**.
5. Mach dasselbe bei **Google Play services**: Web-Push läuft über sie.
6. Führe auf dem Rechner `claude-post webpush setup` aus und kopiere den Schlüssel, den es zeigt.
7. Öffne in LLM-Post **Mehr**, **Mitteilungen**, füge den Schlüssel ein, tippe **Einschalten** und erlaube Mitteilungen.
8. Tippe **Abo kopieren**, führe `claude-post webpush setup` noch einmal aus und füge das Abo ein.
9. Prüfe es mit `claude-post webpush test`: Auf dem Handy erscheint „Neue Einträge für dich“.

Ein Update kommt von selbst: Die App zeigt **Neue Fassung geladen** mit **Neu starten**. Anmeldung, Entwürfe und die
Warteschlange bleiben.

Die Namen in den Menüs sind die englischen. Bei deutscher Oberfläche heißen sie vermutlich **App installieren** und
**Uneingeschränkt**. Die Schritte 4 und 5 und die deutschen Namen sind noch nicht am Gerät geprüft.

| Wenn | Dann |
| --- | --- |
| Der Menüeintrag fehlt | Lade die Seite neu; die App muss einmal vollständig geladen sein |
| Hinweise kommen verspätet oder gar nicht | Prüfe Schritt 4 und 5, dann den Abschnitt **Mitteilungen** in **Mehr** |
| Du hattest die frühere Android-App | Sende, was dort noch wartet, deinstalliere sie und melde dich in der Web-App neu an |
