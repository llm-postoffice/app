// Netz (UOF-4): ohne Netz ist ein Zustand, kein Fehler; eine ruhige Zeile oben nennt ihn. Offline gilt, wenn das Gerät
// es meldet oder der letzte Abgleich am Netz scheiterte; eine Antwort des Servers, auch eine Ablehnung, hebt es auf
// (die Steuerung führt das). Solange die App offline ist, fragt die Steuerung alle 10 s erneut, weil mit einem VPN
// kein Ereignis online kommt. Die Zeile steht im Fluss und schiebt den Inhalt; darum erscheint und verschwindet sie nie, solange
// ein Finger auf dem Bildschirm liegt, und erst eine Sekunde nach der letzten Berührung oder dem letzten Scrollen: ein Tipp
// trifft so immer, was der Nutzer vor sich sah.
import { ohneNetzZeile } from './texte.js';

/** So lange nach der letzten Berührung bleibt die Zeile, wie sie ist. */
export const RUHE_MS = 1000;
/** So oft prüft die Zeile in dieser Zeit erneut, ob sie wechseln darf. */
export const WIEDER_MS = 250;

export function netzZeile(zeile, steuerung, { jetzt = () => Date.now(), zeitgeber = { setze: (f, ms) => setTimeout(f, ms) }, ziel = globalThis, online = () => navigator.onLine } = {}) {
  const text = zeile.querySelector('span');
  let unten = false;
  let zuletzt = -Infinity;
  let wartet = false;
  const ruhig = () => !unten && jetzt() - zuletzt >= RUHE_MS;
  const setzen = () => {
    const z = steuerung.zustand;
    const ohne = !online() || z.ohneNetz;
    if (ohne) text.textContent = ohneNetzZeile(z.letzter?.geprueft ?? null);
    if (zeile.hidden === !ohne) return;
    if (ruhig()) { zeile.hidden = !ohne; return; }
    if (wartet) return;
    wartet = true;
    zeitgeber.setze(() => { wartet = false; setzen(); }, WIEDER_MS);
  };
  const beruehrt = (ev) => {
    zuletzt = jetzt();
    if (ev.type === 'pointerdown') unten = true;
    if (ev.type === 'pointerup' || ev.type === 'pointercancel') unten = false;
  };
  for (const name of ['pointerdown', 'pointerup', 'pointercancel', 'scroll']) ziel.addEventListener(name, beruehrt, { capture: true, passive: true });
  ziel.addEventListener('online', setzen);
  ziel.addEventListener('offline', setzen);
  steuerung.beiAenderung(setzen);
  setzen();
}
