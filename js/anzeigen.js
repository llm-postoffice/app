// Zeigt eine Ansicht: Titel, Pfeil Zurück, Leiste, Inhalt und Blatt. Bis Teil D sind die Ansichten leere
// Hüllen mit eigener Adresse; Mehr zeigt den Zustand dieses Geräts (mehr.js).
import { BEREICHE, blattTitelVon, hatZurueck, idMitStrich, titelVon } from './adressen.js';
import { el, vorlage } from './dom.js';
import { mehr as mehrAbschnitt } from './mehr.js';

const $ = (id) => document.getElementById(id);

function platz(titel, satz) {
  const teil = vorlage('t-platz');
  teil.querySelector('h2').textContent = titel;
  teil.querySelector('p').textContent = satz;
  return teil;
}

// Datenbank und Steuerung des Abgleichs setzt start.js, ehe die erste Ansicht erscheint.
let kontext = null;
export const setzeKontext = (k) => { kontext = k; };
const mehr = () => mehrAbschnitt(kontext);

function inhalt(o) {
  if (o.ansicht === 'mehr') return [mehr()];
  const teile = [];
  if (o.id) teile.push(el('p', { class: 'neben' }, o.ansicht === 'schritt' ? 'Abnahme ' : 'Eintrag ', el('span', { class: 'id' }, idMitStrich(o.id))));
  teile.push(platz('Im Aufbau', 'Diese Ansicht ist noch nicht gebaut.'));
  return teile;
}

/** Zeigt die Ansicht `o` (Ergebnis von parse in adressen.js). */
export function anzeigen(o) {
  $('titel').textContent = titelVon(o);
  $('zurueck').hidden = !hatZurueck(o);
  $('suchen').hidden = !BEREICHE.includes(o.ansicht);
  $('leiste').hidden = o.ansicht === 'anmelden';
  for (const a of document.querySelectorAll('#leiste a')) {
    if (a.dataset.bereich === o.bereich) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  $('inhalt').replaceChildren(...inhalt(o));
  const blatt = $('blatt');
  const blattTitel = blattTitelVon(o);
  if (blattTitel) {
    $('blatt-titel').textContent = blattTitel;
    if (!blatt.open) blatt.showModal();   // Fokus auf Abbrechen, keine Tastatur (UEI-4)
  } else if (blatt.open) {
    blatt.close();
  }
}
