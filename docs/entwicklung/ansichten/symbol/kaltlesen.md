# Kaltlesung: Symbol

- Datum: 2026-11-17
- Variante: 1, Umschlag mit LLM (gewählt in der Frage hpqve5)
- Bilder: `variante-1.png` (Bogen), `symbole/symbol-192.png`, `symbole/maskierbar-512.png`
- Aufgaben: LLM-Post auf dem Startbildschirm, im Browser-Tab schnell finden und von
  anderen Apps unterscheiden; es klein (48 px) und als einfarbiges Themen-Symbol wiedererkennen.

## Bericht

Verhindert eine Aufgabe: nichts.

Bremst:

- Bogen, 48 px hell und dunkel: „LLM“ ist nur etwa 5 bis 6 px hoch bei etwa 2 px Strich und läuft zusammen; übrig
  bleibt ein Umschlag wie bei jeder Mail-App. Vorschlag: Buchstaben höher und fetter, Klappe dünner und flacher.
- Bogen, Themen-Symbol: „LLM“ und Klappe sind Aussparungen; bei 48 px nicht gezeigt, die Lesbarkeit dort ist
  ungeprüft. Gleicher Vorschlag.
- Abgrenzung zu anderen Apps: Blau trennt, kein Befund.

Sieht falsch aus:

- Bogen, rund hell und dunkel: Die Ecken des Umschlags liegen nahe am Kreisrand und wirken gedrängt.
- `maskierbar-512.png`: Der Umschlag füllt 56 % der Breite, im runden Symbol der Hülle 70 %; rund maskiert wirkt
  das Symbol der Web-App kleiner.
- `symbol-192.png`: nichts, „LLM“ ist lesbar.

## Geändert

- Buchstaben 30 % größer (Höhe 11,8 statt 9,1 von 40 Einheiten des Umschlags), Strich 4,2 statt 3,4.
- Klappe flacher (Spitze bei 50,5 statt 53) und dünner (Strich 3,0 statt 3,5), damit Platz für die Buchstaben bleibt.
- Danach `make symbole`. Bei 48 px ist „LLM“ jetzt als drei Buchstaben lesbar; das gilt auch für das Themen-Symbol,
  das dieselbe Form nutzt.
- Nicht geändert: die Größe des Umschlags im runden und im maskierbaren Symbol. Das sieht nur anders aus, als es
  könnte, und bremst keine Aufgabe; der Bogen der Wahl zeigt das Motiv in dieser Größe.
