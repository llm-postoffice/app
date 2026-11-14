# Änderungen

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
- Für Entwickler: `tools/vorschau.mjs` und `tools/rendern.mjs` zeigen und rendern jede Ansicht mit erfundenen Daten; der Wegetest prüft alle Zurück-Wege, einen Knopf zu jeder Handlung, eine linke Kante je Ansicht und die Entwürfe.

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
