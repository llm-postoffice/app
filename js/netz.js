// Netz (UOF-4): ohne Netz ist ein Zustand, kein Fehler; eine ruhige Zeile oben nennt ihn. Offline gilt, wenn das Gerät
// es meldet oder der letzte Abgleich am Netz scheiterte; eine Antwort des Servers, auch eine Ablehnung, hebt es auf
// (die Steuerung führt das). Solange die App offline ist, fragt die Steuerung alle 10 s erneut, weil mit einem VPN
// kein Ereignis online kommt.
import { ohneNetzZeile } from './texte.js';

export function netzZeile(zeile, steuerung) {
  const text = zeile.querySelector('span');
  const setzen = () => {
    const z = steuerung.zustand;
    const ohne = !navigator.onLine || z.ohneNetz;
    zeile.hidden = !ohne;
    if (ohne) text.textContent = ohneNetzZeile(z.letzter?.geprueft ?? null);
  };
  addEventListener('online', setzen);
  addEventListener('offline', setzen);
  steuerung.beiAenderung(setzen);
  setzen();
}
