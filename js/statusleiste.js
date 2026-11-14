// Statusleiste (UFA-1, ws1zqm). Die zwei theme-color mit media in index.html gelten bis zum Start. Auf einem
// Pixel 8 Pro übernahm die Statusleiste den Wechsel zurück nach Dunkel damit nicht; ab dem Start ersetzt ein
// einziges Tag die beiden und folgt dem Wechsel über matchMedia. Seine Farbe ist die der oberen Leiste (--grund),
// so steht sie nur einmal im CSS. Der Gestenbereich unter der App-Leiste blieb im Dunkelmodus weiß; ob die Seite
// ihn beeinflussen kann, ist nicht geprüft (Eintrag ws1zqm bei p94-hig, Probe in Teil F).
import { el } from './dom.js';

const dunkel = matchMedia('(prefers-color-scheme: dark)');

function setzen() {
  document.querySelectorAll('meta[name="theme-color"][media]').forEach((m) => m.remove());
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) { m = el('meta', { name: 'theme-color' }); document.head.append(m); }
  m.content = getComputedStyle(document.documentElement).getPropertyValue('--grund').trim();
}

export function statusleiste() {
  setzen();
  dunkel.addEventListener('change', setzen);
}
