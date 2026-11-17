// Fristen in Worten: „in etwa 40 s“, „in etwa 2 min“. Eine Frist steht in einem eigenen Element mit dem Zeitpunkt in
// `data-bis`; `starteFristen` schreibt den Text dieser Elemente jede Sekunde neu. Nur der Text eines Elements ändert sich,
// nie die Zahl der Zeilen oder Elemente: so verschiebt eine laufende Frist nichts unter dem Finger. Uhr und Zeitgeber sind
// Parameter, damit Tests und die Vorschau sie anhalten.
import { el } from './dom.js';

/** Schrittweite in Sekunden unter einer Minute: der Text springt seltener und bleibt ruhig. */
const SCHRITT_S = 5;

/** Die Frist in Worten; `rest` in ms. Bei null und davor „gleich“. */
export function fristText(rest) {
  const s = Math.ceil(rest / 1000);
  if (s <= 0) return 'gleich';
  if (s < 60) {
    const gerundet = Math.ceil(s / SCHRITT_S) * SCHRITT_S;
    if (gerundet < 60) return `in etwa ${gerundet} s`;
  }
  const min = Math.ceil(s / 60);
  if (min < 60) return `in etwa ${min} min`;
  return `in etwa ${Math.ceil(min / 60)} Std`;
}

/** Das Element einer Frist bis zum Zeitpunkt `bis` (ms); `jetzt` ist die Uhrzeit beim Zeichnen. */
export const fristKnoten = (bis, jetzt) => el('span', { class: 'frist', 'data-bis': String(bis) }, fristText(bis - jetzt));

/** Hält alle Fristen unter `wurzel` aktuell. Gibt eine Funktion zurück, die den Zeitgeber anhält. */
export function starteFristen(wurzel, { jetzt = () => Date.now(), zeitgeber = { setze: (f, ms) => setTimeout(f, ms), loesche: (t) => clearTimeout(t) } } = {}) {
  let timer = null;
  const takt = () => {
    for (const e of wurzel.querySelectorAll('[data-bis]')) {
      const text = fristText(Number(e.getAttribute('data-bis')) - jetzt());
      if (e.textContent !== text) e.textContent = text;
    }
    timer = zeitgeber.setze(takt, 1000);
  };
  timer = zeitgeber.setze(takt, 1000);
  return () => zeitgeber.loesche(timer);
}
