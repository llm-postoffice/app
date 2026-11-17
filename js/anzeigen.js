// Zeigt eine Ansicht: obere Leiste, Navigationsleiste mit Plakette, Inhalt, Aktionsleiste und Blatt. Die Ansicht rechnet sich
// aus der Welt (welt.js, aus den Dateien auf dem Gerät) und dem Zustand des Abgleichs; geladen wird bei jedem Zeichnen neu, weil
// die Datenbank die Quelle der Wahrheit ist. Ein Zeichnen, das ein neueres überholt, wird verworfen.
import { BEREICHE, blattTitelVon, hatZurueck, titelVon } from './adressen.js';
import { el, ico } from './dom.js';
import { abnahmen, eingang, ideen, sucheAnsicht, wartet } from './ansichten.js';
import { antwortBlatt, einsortierenBlatt, eintragAnsicht } from './eintrag.js';
import { ergebnisAnsicht, satzBlatt, schrittAnsicht } from './ablauf.js';
import { erfassenAnsicht } from './erfassen.js';
import { anmeldenAnsicht } from './anmelden.js';
import { alleAnsicht, auswahlBlatt } from './uebersicht.js';
import { geraetBlatt, mehrAnsicht } from './mehr.js';
import { ladeWelt, zaehler } from './welt.js';

const $ = (id) => document.getElementById(id);

// Datenbank, Steuerung und Navigation setzt app.js, ehe die erste Ansicht erscheint.
let k = null;
let nummer = 0;
let sucheText = '';
export const setzeKontext = (kontext) => { k = kontext; };
export const suchText = () => sucheText;
export const setzeSuchText = (t) => { sucheText = t; };

/** Tippt der Nutzer gerade in ein Feld der Seite? Dann zeichnet ein automatisches Neuzeichnen nichts neu. */
const tippt = () => {
  const a = document.activeElement;
  return Boolean(a && a.matches?.('input:not([type=checkbox]):not([type=radio]), textarea, select') && a.closest('main, #blatt'));
};

function kopf(o, angemeldet) {
  $('titel').textContent = titelVon(o);
  $('titel').hidden = o.ansicht === 'suche';
  $('suchfeld').hidden = o.ansicht !== 'suche';
  $('zurueck').hidden = !(hatZurueck(o) || (o.ansicht === 'anmelden' && angemeldet && (history.state?.tiefe ?? 0) > 0));
  $('suchen').hidden = !BEREICHE.includes(o.ansicht);
  $('leiste').hidden = o.ansicht === 'anmelden' && !angemeldet;
  for (const a of document.querySelectorAll('#leiste a')) {
    if (a.dataset.bereich === o.bereich) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

function plakette(welt) {
  const n = zaehler(welt).fuerDich;
  const p = $('plakette');
  p.hidden = !n;
  p.textContent = n > 99 ? '99+' : String(n);
  p.parentElement.parentElement.setAttribute('aria-label', n ? `Wartet, ${n} für dich` : 'Wartet');
}

async function ansicht(o, welt, z) {
  switch (o.ansicht) {
    case 'wartet': return { inhalt: wartet(welt, z, k) };
    case 'alle': return { inhalt: alleAnsicht(welt, z, k) };
    case 'abnahmen': return { inhalt: abnahmen(welt, z, k) };
    case 'eingang': return { inhalt: eingang(welt, z, k) };
    case 'ideen': return { inhalt: ideen(welt, z, k) };
    case 'suche': return { inhalt: sucheAnsicht(welt, z, k, sucheText) };
    case 'eintrag': return eintragAnsicht(welt, z, k, o);
    case 'schritt': return schrittAnsicht(welt, z, k, o);
    case 'ergebnis': return ergebnisAnsicht(welt, z, k, o);
    case 'erfassen': return erfassenAnsicht(welt, z, k);
    case 'mehr': return { inhalt: await mehrAnsicht(welt, z, k) };
    case 'anmelden': return anmeldenAnsicht(k, { fertig: () => k.nachAnmeldung() });
    default: return { inhalt: [] };
  }
}

async function blatt(o, welt) {
  const b = $('blatt');
  const titel = blattTitelVon(o);
  if (!titel) { if (b.open) b.close(); return; }
  const schliessen = () => b.close();
  let r;
  if (o.blatt === 'antworten') r = await antwortBlatt(welt, k, o, schliessen);
  else if (o.blatt === 'einsortieren') r = await einsortierenBlatt(welt, k, o, schliessen);
  else if (o.blatt === 'satz') r = await satzBlatt(welt, k, o, schliessen);
  else if (o.blatt === 'auswahl') r = auswahlBlatt(welt, k, o, schliessen);
  else r = await geraetBlatt(k, schliessen);
  $('blatt-titel').replaceChildren(...(r.symbol ? [el('span', { class: r.rolle }, ico(r.symbol))] : []), titel);
  $('blatt-koerper').replaceChildren(...r.koerper.filter(Boolean));
  $('blatt-knoepfe').replaceChildren(...r.knoepfe);
  b.className = `blatt ${r.klasse ?? ''}`.trim();
  if (!b.open) b.showModal();   // Fokus auf das erste bedienbare Feld, keine Tastatur ohne Berührung (UEI-4)
}

/** Zeigt die Ansicht `o` (Ergebnis von parse in adressen.js). `automatisch` heißt: nicht vom Nutzer ausgelöst. */
export async function anzeigen(o, { automatisch = false } = {}) {
  if (automatisch && tippt()) return;
  const mein = ++nummer;
  const angemeldet = Boolean(await k.steuerung.anmeldung());
  if (mein !== nummer) return;
  if (!angemeldet && o.ansicht !== 'anmelden') { k.ersetze('#anmelden'); return; }
  kopf(o, angemeldet);
  const welt = await ladeWelt(k.db, k.jetzt());
  const z = k.steuerung.zustand;
  const r = await ansicht(o, welt, z);
  if (mein !== nummer) return;
  document.title = 'Postfach';
  if (r.titel) $('titel').textContent = r.titel;
  plakette(welt);
  $('inhalt').replaceChildren(...r.inhalt.flat().filter(Boolean));
  const aktion = $('aktion');
  aktion.hidden = !r.aktion;
  aktion.replaceChildren(...(r.aktion ?? []));
  await blatt(o, welt);
}
