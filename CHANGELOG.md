# Änderungen

## 20261119.01 (2026-11-19)

Ein Tipp auf einen Web-Push-Hinweis öffnet jetzt den Eintrag, um den es geht. Die App gleicht vorher ab, damit der Eintrag schon da ist.

- Kommt der Hinweis ohne Angabe zum Eintrag, öffnet die App den neuesten neuen Eintrag an dich, sonst **Wartet**. **Zurück** führt nach **Wartet**.
- Fehlt der Eintrag auch nach dem Abgleich, sagt die Ansicht warum und bietet **Zu Wartet** an.
- Die Fassung bringt einen neuen Service Worker mit: tippe nach dem Laden auf **Neu starten**.

## 20261118.02 (2026-11-18)

Web-Push ist als Probe wieder da: **Mehr** kann im Browser Hinweise auch über den Push-Dienst von Google zustellen, ntfy bleibt der Standard.

- In der Android-App fehlt der Abschnitt; dort kommen die Hinweise über ntfy. Ein Tipp auf den Web-Push-Hinweis öffnet **Wartet**.

## 20261118.01 (2026-11-18)

Abgleich und wartende Sendungen zeigen ihren Stand: **Wartet** nennt, ob gerade abgeglichen wird und wann der nächste Abgleich kommt; das Band „Noch nicht gesendet“ und die Seite dazu sagen „wird gesendet …“, „nächster Versuch in etwa 40 s“ und „gesendet um 14:07“.

- Was gewartet hatte und rausging, meldet ein Hinweis mit der Uhrzeit.

## 20261117.12 (2026-11-17)

Fotos werden vor dem Senden verkleinert (beim Teilen und bei **Datei anhängen**, bis 20 MiB); die Zeile nennt „verkleinert von … auf …“. Bildschirmfotos (PNG bis 1 MiB) bleiben unverändert. Ein verkleinertes Foto trägt keine Ortsangabe mehr.

- Was beim Teilen nicht übernommen wurde, steht oben in **Erfassen** in einem Band und bleibt dort, bis du **Verstanden** tippst. Es ging vorher beim ersten neuen Zeichnen verloren und stand unter dem Bildschirmrand.
- Andere Dateien über 1 MiB lehnt die App weiter ab, mit Name, Größe und Grund.

## 20261117.11 (2026-11-17)

Ohne Netz sagt die App nach dem Ende von **Rückgängig** sofort, dass die Antwort auf Netz wartet; vorher kam der Satz mitunter erst Sekunden später.

- **Erfassen:** Neben **Eintrag anlegen** steht **Entwurf verwerfen**, sobald im Entwurf etwas steht. Es leert Titel, Text, Wahl und Anhänge; **Rückgängig** holt sie zehn Sekunden lang zurück.

## 20261117.10 (2026-11-17)

Die Android-App nimmt Dateien aus anderen Apps an: Teile ein Foto, ein PDF oder mehrere Dateien an LLM-Post, dann öffnet sich **Erfassen** mit einem Entwurf, an dem sie hängen.

- Bis zu 10 Dateien je Teilen, jede bis 1,0 MiB. Eine zu große Datei nennt ein Satz mit Name und Größe, die übrigen hängen trotzdem an.

## 20261117.09 (2026-11-17)

Was noch nicht gesendet ist, siehst du jetzt, und ohne Netz sagt die App, was geschieht.

- **Noch nicht gesendet:** Ein Band oben in **Wartet** nennt, wie viele Sendungen warten oder hängen. **Anzeigen** öffnet eine Seite mit allen, dort gehen **Erneut senden** und **Verwerfen**. Ein Eintrag, den du ohne Netz angelegt hast, öffnet dort, statt „nicht gefunden“ zu sagen.
- Nach **Rückgängig** sagt ein Satz, dass die Sendung auf Netz wartet und rausgeht, sobald du online bist.
- Der Hinweis nach einer Antwort nennt auch Text und Anhänge. Die Warnung in **Mehr** nennt in der Android-App keinen Browser und sagt, was nicht gesendet ist.
- Nach der Dateiwahl steht sofort, dass die Datei geladen wird. Die Zeile **Ohne Netz** wartet mit dem Erscheinen, bis du den Bildschirm eine Sekunde nicht berührst, und schiebt so nichts mehr unter deinem Finger.
- Ein Link auf einen neuen Eintrag zeigt „lädt“, bis der Abgleich fertig ist. Der Faden nennt einen eigenen Nachtrag von Anfang an „von user“.

## 20261117.08 (2026-11-17)

Antworten: Bedienhilfen wie TalkBack sagen die gewählte Möglichkeit an, und das Blatt **Deine Antwort** springt nach der Wahl nicht mehr.

## 20261117.07 (2026-11-17)

Antworten: Im Blatt **Deine Antwort** wählt ein Tipp eine Möglichkeit (sie ist dann gefüllt und mit Haken markiert), und **Senden** schickt Wahl, eigenen Text und Anhänge zusammen.

## 20261117.06 (2026-11-17)

Anhänge: Du siehst, speicherst und sendest Dateien zu Einträgen.

- Ein **Eintrag** zeigt seine Anhänge in einem eigenen Abschnitt am Ende. Ein Tipp klappt die Zeile auf: Bilder und Text siehst du gleich, alles andere lädst du herunter.
- Einen Anhang lädt die App erst beim Aufklappen und behält ihn danach auf dem Gerät. Ohne Netz sagt die Zeile, was hilft.
- **Herunterladen** legt die Datei im Browser in den Download-Ordner, in der Android-App wählst du den Ort.
- In **Erfassen** und beim **Antworten** hängt **Datei anhängen** bis zu 1 MiB je Datei an. Ein Geheimnis in einem Textanhang geht nie raus.
- Die Android-App öffnet dafür die Dateiauswahl des Systems.

## 20261117.05 (2026-11-17)

Die Android-App übernimmt die Farben deines Hintergrundbilds (Android-Einstellung Hintergrund und Stil).

- **Farben:** Knöpfe, Auswahl, Hintergrund, Karten, Text und Hinweise der Android-App folgen deinem Hintergrundbild, hell und dunkel.
- Wechselst du das Hintergrundbild, übernimmt die App die neuen Farben, sobald du sie wieder öffnest.
- Arten (Frage, Freigabe, Abnahme, Auftrag, Nachricht) und Zustände (dringend, Warnung, ok) behalten ihre Farben.
- Die Web-App im Browser behält ihre Farben.
- Die Android-App nutzt eine veraltete Systemfunktion für die Ränder nur noch vor Android 15.

## 20261117.04 (2026-11-17)

Die App heißt jetzt LLM-Post, hat ein neues Symbol und kommt auch als Android-App.

- **LLM-Post** ist der neue Name der App. Deine Daten und deine Anmeldung bleiben.
- **Neues Symbol** für Android-App und Web-App: LLM und ein Brief.
- **Android-App:** dieselbe App ohne Browser, startet auch ohne Netz. Installation und Updates mit Obtainium, Schritte in `docs/obtainium.md`.
- Links der Form `llmpost://eintrag/ID` öffnen den Eintrag in der Android-App, jede andere Adresse mit `llmpost://` öffnet **Wartet**.
- **Teilen** aus einer anderen App legt den Text als Entwurf in **Erfassen**.
- In der Android-App meldest du dich einmal an; das Token liegt dort im Schlüsselspeicher von Android, nicht in der Datenbank der App.
- **Mehr** zeigt in der Android-App keinen Abschnitt **App installieren** und keine Zeile **Neue Fassung geladen**; Updates kommen über Obtainium.

## 20261117.03 (2026-11-17)

Die Priorität heißt überall Hoch, Normal, Niedrig.

- In **Erfassen** wählst du die **Priorität** mit Hoch, Normal oder Niedrig statt mit 1, 2 oder 3. Entwürfe bleiben erhalten.
- Ein **Eintrag** nennt die Priorität mit denselben Wörtern statt „Rang 2“.

## 20261117.02 (2026-11-17)

Die Probe für Web-Push in **Mehr** ist weg. Hinweise kommen weiter über ntfy.

- Der Abschnitt **Web-Push (Probe)** in **Mehr** fehlt jetzt. An den Hinweisen über ntfy ändert sich nichts.

## 20261117.01 (2026-11-17)

Neuer Reiter **Alle** und Web-Push als Probe.

- **Alle:** alle offenen Einträge aller Projekte, auch die, die nicht auf dich warten, nach Projekt gruppiert. Filter für Status, Projekt, Art und Priorität; sortierbar nach Projekt, Priorität, Art, Status und Alter. Die Art steht als farbiger Chip mit Symbol und Wort an jeder Zeile.
- Ein Tipp auf eine Zeile öffnet den Eintrag wie in **Wartet**; Zurück führt mit demselben Filter in die Liste. Die Leiste unten hat fünf Reiter und passt bei 360 px in eine Reihe.
- **Web-Push (Probe)** in **Mehr** schaltet Hinweise ohne ntfy ein (nur mit den Google Play Services), kopiert das Abo für `claude-post webpush setup` und beendet es; scheitert der Browser, steht sein Fehlertext da. Ein Tipp auf den Hinweis öffnet das Postfach. ntfy bleibt, wie es ist.

## 20261115.02 (2026-11-15)

Teil F: Offline, Installation, Mitteilungen und Update. Die App startet ohne Netz, sagt, wie du sie installierst und was die Hinweise tun, und wartet mit einer neuen Fassung, bis du sie übernimmst.

- **Neue Fassung:** Wartet eine neue Fassung der App, zeigt eine Zeile unten „Neue Fassung geladen.“ mit **Neu starten**; in **Mehr** steht dasselbe als Band bei **Fassung**. Die App lädt nie von selbst neu, auch nicht, wenn eine andere Seite der App die Fassung wechselt. **Neu starten** übernimmt die Fassung und lädt die Seite einmal neu; Entwürfe und noch nicht gesendete Sendungen bleiben auf dem Gerät. Während du tippst, weicht die Zeile. Die App fragt beim Öffnen und bei jeder Rückkehr in den Vordergrund nach einer neuen Fassung, ohne Netz still.
- **App installieren** in **Mehr** nennt die Schritte nummeriert, mit dem Menüeintrag „Install and create shortcut“ aus Vanadium; für deutsche Oberflächen nennt der Text „App installieren“ als vermutlichen Wortlaut (nicht geprüft). Läuft die App schon installiert, sagt **Mehr** das. Beide Fälle erklären, dass nach der Installation die Anmeldung der App gilt, nicht die eines Browsertabs: Links aus anderen Apps öffnen das Postfach in einem Tab ohne Anmeldung.
- **Mitteilungen** in **Mehr** sagen in Worten, was **ID kopieren** im Hinweis tut (die ID in die Zwischenablage legen und den Hinweis schließen), dass ein Tipp auf den Hinweis die App ntfy öffnet und nicht das Postfach, und dass du das Abo in ntfy über **+** anlegst, nicht über einen Link.
- Der Service Worker ist jetzt ein Modul und löscht beim Wechsel nur frühere Fassungen der App (`postfach-…`), keine fremden Caches. Die Entscheidungen dazu stehen in `js/swlogik.js` und laufen unter `node --test`.
- Für Entwickler: Der Wegetest belegt in Chromium, dass der erste Besuch die Hülle in den Cache legt und die App danach bei gesperrtem Netz startet, ohne etwas vom Server zu holen, und spielt den Update-Weg mit einer zweiten Fassung des Service Workers nach (Update wartet, **Neu starten**, Entwurf und Schlange bleiben, die alte Hülle fällt weg). Neue Szenarien der Vorschau: `neue-fassung`, `neue-fassung-schlange`, `installiert`; `mehr-fassung`, `mehr-installieren`, `mehr-installiert` und `mehr-mitteilungen` scrollen **Mehr** zu einem Abschnitt und gehören nur auf Namen zum Rendern, weil der Renderer beim Scrollen Text unter der Statusleiste als Randfehler meldet.

## 20261115.01 (2026-11-15)

Teil E: Schreiben. Die App sendet jetzt: Antworten, Urteile, Erledigt, Einsortieren und neue Einträge gehen als Commit ins Datenrepo. Die gesperrten Knöpfe aus Teil D sind angeschlossen.

- Jede Eingabe wartet zehn Sekunden auf **Rückgängig**. Der Hinweis unten sagt, was gespeichert ist; **Rückgängig** legt die Eingabe als Entwurf zurück. Danach geht die Sendung raus: ein Commit je Sendung über die Git-Data-API, mindestens eine Sekunde zwischen zwei schreibenden Anfragen, ohne force. Hat inzwischen jemand anderes gepusht, baut die App den Commit auf dem neuen Stand neu.
- Der Zustand steht in Worten am Eintrag: „noch nicht gesendet“, „noch nicht gesendet, wartet auf Netz“, „wird gesendet“, „gesendet 14:02“. Ohne Netz bleibt die Sendung in der Warteschlange und geht von allein raus, sobald das Netz zurück ist.
- **Antworten** auf Fragen: eine Möglichkeit mit einem Tipp oder freier Text. Ist die Frage inzwischen beantwortet, sendet die App nichts und zeigt das Band „Schon beantwortet“ mit **Als Nachtrag senden** oder **Verwerfen**.
- **Abnahmen**: **Antwort senden** schickt Urteile, Gesamturteil und bei FAIL den Folgeauftrag in einem Commit. Der Entwurf der Urteile liegt bis dahin auf dem Gerät.
- **Erfassen** legt Einträge mit Titel, Art, An, Rang und Dringend an. Bei einer Idee ist **An dich** vorbelegt, damit sie in der Ideensammlung landet statt im Eingang. Eine Nachricht braucht einen Text.
- **Einsortieren** im Eingang: Ziel wählen (**An dich** oder ein Projekt), auf Wunsch ein Satz dazu, **Senden** wartet auf ein Ziel. Der Eintrag bleibt im Eingang, bis die Sendung angekommen ist, und trägt bis dahin „noch nicht gesendet“. Hat inzwischen ein anderes Gerät den Eintrag adressiert, zeigt die App „Schon einsortiert“ mit **Trotzdem senden**.
- Vor dem Senden prüft die App Titel, Text und Sätze auf Geheimnisse und persönliche Angaben. Ein Geheimnis geht nie raus; bei persönlichen Angaben kannst du mit **Trotzdem senden** freigeben. Das Band nennt Ort und Art, nie den Wert.
- Lehnt GitHub das Token ab oder fehlt ihm das Recht zum Schreiben, bleibt die Eingabe in der Warteschlange und der Eintrag zeigt ein Band mit **Neues Token eintragen**; nach einem neuen Token gehen die Sendungen von allein raus. Bei anderen Fehlern bietet das Band **Erneut senden** und **Verwerfen**.
- Neue Einträge tragen die Zeit von GitHub, nicht die des Geräts. **Mehr** warnt, wenn die Uhr des Geräts mehr als eine Minute abweicht.
- Für Entwickler: `tests/mockgithub.test.mjs` schickt alle Arten von Sendung an eine nachgebaute Git-Data-API und verlangt, dass die Prüfung des Postwerkzeugs auf einer Kopie des Datenklons mit Exit 0 endet (Umgebung `POST_DATEN` und `POST_PRUEFBEFEHL`, sonst SKIP). Der Wegetest spielt das Schreiben in Echtzeit nach, die Vorschau hat Szenarien für Hinweis, abgelehnte Eingabe, Sendefehler und Uhr.

## 20261114.03 (2026-11-14)

Teil D: Ansichten, Navigation und Suche. Die App zeigt jetzt, was auf dich wartet. Senden kommt mit einer späteren Fassung; Eingaben bleiben bis dahin als Entwurf auf dem Gerät.

- **Wartet** zeigt zuerst das Ergebnis („5 für dich“), darunter die Einträge nach Rang, Dringendes zuerst. Der Eingang steht darunter, die Plakette in der Leiste zählt mit.
- **Abnahmen** gruppiert nach Rechner und nennt die offenen Schritte. Jede Abnahme beurteilst du Schritt für Schritt mit PASS, FAIL, BLOCKED oder SKIP; bei FAIL, BLOCKED und SKIP schreibst du einen Satz dazu. Die Urteile bleiben nach Zurück, Neuladen und Beenden der App auf dem Gerät. Das Ergebnis zeigt das Gesamturteil und den Folgeauftrag, den die App beim Senden anlegen wird.
- Ein Eintrag zeigt Art, Projekt, Absender, Text als Markdown, Möglichkeiten einer Frage, den Faden und die Quelle. Text von außen steht als Zitat; Links gibt es nur mit https und sie öffnen mit `rel="noopener noreferrer"`.
- **Eingang** und **Ideensammlung** haben eigene Listen; **Suche** findet Titel und ID, auch erledigte und verworfene Einträge, eine ID mit und ohne Strich und mit den Verwechslungen o, i und l.
- **Erfassen** legt einen Eintrag von Hand an. **Mehr** führt zu Eingang, Ideensammlung und Suche, zeigt die Anmeldung, die Mitteilungen über ntfy und den Abschnitt Dieses Gerät mit dem Namen des Geräts.
- Die Anmeldung fragt Repo, Token, Name des Geräts und das Ablaufdatum des Tokens. **Neues Token eintragen** steht bei „Token abgelaufen oder widerrufen“.
- Freigaben haben keine Knöpfe: Freigeben und Ablehnen gehen erst in Phase 4, und der Eintrag sagt es.
- Die Knöpfe zum Antworten, Erledigen, Einsortieren, Erfassen und Senden sind da, aber gesperrt, solange diese Fassung nur liest. Ein Satz sagt es; nichts wird vorgetäuscht.
- Jede Ansicht hat Zustände für leer, lädt, Fehler, ohne Netz und Token abgelaufen.
- Blätter scrollen bei großer Schrift als Ganzes; die Knöpfe stehen am Ende und überdecken kein Feld. Der Titel der oberen Leiste steht auf derselben linken Kante wie der Inhalt.
- Für Entwickler: `tools/vorschau.mjs` und `tools/rendern.mjs` zeigen und rendern jede Ansicht mit erfundenen Daten; der Wegetest prüft alle Zurück-Wege, die Blätter bei Schrift 200 %, einen Knopf zu jeder Handlung, eine linke Kante je Ansicht und die Entwürfe.

## 20261114.02 (2026-11-14)

Teil C: Abgleich und Zustand. Die App holt jetzt das Postsystem auf das Gerät und rechnet daraus den Zustand der Einträge; die Ansichten dafür folgen in späteren Teilen.

- Der Abgleich holt die Dateiliste des Repos und nur die Dateien, die neu oder geändert sind. Ohne Änderung kostet er eine Anfrage, die GitHub nicht auf das Kontingent anrechnet.
- Der Stand liegt auf dem Gerät in IndexedDB und bleibt ohne Netz lesbar. Bricht ein erster Abgleich ab, geht er beim nächsten Öffnen dort weiter, wo er aufgehört hat.
- Der Abgleich läuft beim Öffnen, bei der Rückkehr ins Netz, mit dem Knopf **Jetzt abgleichen** und im Vordergrund im Takt (Vorgabe alle 2 Minuten, einstellbar in **Mehr**).
- **Mehr** zeigt den Speicher (dauerhaft gewährt, vom Browser verwaltet oder nur im Arbeitsspeicher), den Zeitpunkt des letzten Abgleichs und den Fortschritt, etwa „212 von 514 Dateien“.
- Läuft das Token ab, steht dort „Token abgelaufen oder widerrufen“; bremst GitHub, steht dort „GitHub bremst“ mit der Zeit des nächsten Versuchs. Der Stand auf dem Gerät bleibt in beiden Fällen erhalten.
- Zustand, Rang, Urteile, Folgeeinträge und die Prüfung auf Geheimnisse und persönliche Angaben rechnet die App nach den Regeln des Postsystems. Abweichungen der Muster zwischen Python und JavaScript stehen im Kopf von `js/pruefen.js`.
## 20261114.01 (2026-11-14)

Erstes Gerüst. Die App ist noch nicht veröffentlicht; die Ansichten sind leere Hüllen.

- Die App ist installierbar: Manifest mit Symbolen in 192 und 512 Pixeln, eines davon maskierbar.
- Sie startet ohne Netz; ein Service Worker hält die Hülle nach Fassung.
- Die Navigationsleiste hat vier Bereiche: **Wartet**, **Abnahmen**, **Erfassen** und **Mehr**.
- Jede Ansicht hat eine eigene Adresse. Zurück schließt zuerst ein offenes Blatt und geht dann genau
  eine Ebene hoch; ein tiefer Link baut den Stapel darunter auf.
- **Mehr** zeigt die Fassung der App.
- Ohne Netz erscheint oben eine ruhige Zeile.
