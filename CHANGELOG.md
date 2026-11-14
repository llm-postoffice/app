# Änderungen

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
