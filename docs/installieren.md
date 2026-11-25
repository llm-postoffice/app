# LLM-Post auf dem Handy installieren

LLM-Post ist eine Web-App. Du installierst sie aus Vanadium (oder Chrome) auf Android und bekommst Hinweise auf Neues.
Einen Store und eine APK gibt es nicht.

1. Öffne https://llm-postoffice.github.io/app/ in Vanadium.
2. Öffne das Menü ⋮ und tippe auf **Install and create shortcut**.
3. Bestätige die Frage und öffne LLM-Post vom Startbildschirm, nicht aus dem Browsertab.
4. Melde dich mit deinem GitHub-Token an. Die App sagt, was es braucht.
5. Öffne **Mehr** und folge dort dem Abschnitt **Mitteilungen** (Abo in ntfy) oder **Web-Push (Probe)**.
6. Öffne die Einstellungen von Android, **Apps**, **Vanadium**, **App battery usage**, und wähle **Unrestricted**.
7. Mach dasselbe bei **Google Play services** (Hinweise über Web-Push brauchen sie).

Ein Update kommt von selbst: Die App zeigt **Neue Fassung geladen** mit **Neu starten**. Anmeldung, Entwürfe und die Warteschlange bleiben.

Die Namen in den Menüs sind die englischen. Bei deutscher Oberfläche heißen sie vermutlich **App installieren** und **Uneingeschränkt**.
Die Schritte 6 und 7 und die deutschen Namen sind noch nicht am Gerät geprüft.

| Wenn | Dann |
| --- | --- |
| Der Menüeintrag fehlt | Lade die Seite neu; die App muss einmal vollständig geladen sein |
| Hinweise kommen verspätet oder gar nicht | Prüfe Schritt 6 und 7, danach **Mehr**, **Mitteilungen** |
| Du hattest die Android-App aus einem früheren Release | Sende, was dort noch wartet, deinstalliere sie und melde dich in der Web-App neu an |
