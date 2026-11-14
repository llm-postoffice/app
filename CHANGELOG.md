# Änderungen

## 20261114.01 (2026-11-14)

Erstes Gerüst. Die App ist noch nicht veröffentlicht; die Ansichten sind leere Hüllen.

- Die App ist installierbar: Manifest mit Symbolen in 192 und 512 Pixeln, eines davon maskierbar.
- Sie startet ohne Netz; ein Service Worker hält die Hülle nach Fassung.
- Die Navigationsleiste hat vier Bereiche: **Wartet**, **Abnahmen**, **Erfassen** und **Mehr**.
- Jede Ansicht hat eine eigene Adresse. Zurück schließt zuerst ein offenes Blatt und geht dann genau
  eine Ebene hoch; ein tiefer Link baut den Stapel darunter auf.
- **Mehr** zeigt die Fassung der App.
- Ohne Netz erscheint oben eine ruhige Zeile.
