// Die Ansicht „Alle“: alle offenen Einträge aller Projekte, auch die, die nicht auf dich warten, nach Projekt gruppiert (oder nach
// Priorität, Art, Status, Alter), mit Filtern für Status, Projekt, Art und Priorität. Gewählt wurde Variante A des Entwurfs
// (docs/entwicklung/ansichten/uebersicht) mit der Art als beschriftetem Chip aus Variante C. Die Rechnung steht in welt.js
// (rein, unter node --test); hier stehen nur der Baum und der Filter, den die Ansicht über Zurück und Neuzeichnen hält.
// Eine Auswahl ist ein Blatt mit eigener Adresse (`#alle/status` und so weiter): Zurück schließt es, die Liste dahinter
// zeichnet sich danach mit dem neuen Filter. Text aus Einträgen geht nur über el() in den Baum (USI-1).
import { el, ico } from './dom.js';
import { AUSWAHL_TITEL } from './adressen.js';
import { FILTER_WORTE, SORT_WORTE, artVon } from './ansichtstexte.js';
import { auswahlOptionen, filtere, gruppiere, gruppiertNachProjekt, hatFilter, leererFilter, uebersichtModelle } from './welt.js';
import { chipArt, knopf, linkKnopf, platz, zeile } from './karten.js';
import { fehlerBand, ohneStand, standZeile } from './ansichten.js';

// Der Filter lebt, solange die App offen ist: ein Eintrag öffnen und zurückgehen ändert ihn nicht.
let filter = leererFilter();
export const aktuellerFilter = () => filter;
export const setzeFilter = (f) => { filter = f; };

const zahl = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;

/** Der Text auf einem Chip: „Projekt“, mit Auswahl „Projekt: beta“ oder „Projekt: 2 gewählt“. */
function chipText(f, dim, wort, optionen) {
  const gewaehlt = f[dim];
  if (!gewaehlt.length) return wort;
  if (gewaehlt.length === 1) return `${wort}: ${optionen.find((o) => o.wert === gewaehlt[0])?.text ?? gewaehlt[0]}`;
  return `${wort}: ${gewaehlt.length} gewählt`;
}

/** Die Summe über der Liste: „14 offen · 7 für dich · 2 dringend“, gefiltert „5 von 14 offen · 3 für dich“. */
function summe(alle, sichtbar, gefiltert) {
  const fuerDich = sichtbar.filter((m) => m.lage === 'dich').length;
  const dringend = sichtbar.filter((m) => m.dringend).length;
  const kopf = gefiltert ? `${sichtbar.length} von ${alle.length} offen` : `${alle.length} offen`;
  return [el('b', {}, kopf), ` · ${fuerDich} für dich${dringend ? ` · ${dringend} dringend` : ''}`];
}

/** Die Leiste mit den Filtern und der Sortierung; ein Chip öffnet die Auswahl als Blatt. */
function filterLeiste(alle, f, k) {
  const chips = FILTER_WORTE.map(({ dim, text }) => {
    const aktiv = f[dim].length > 0;
    const a = el('a', { class: `fchip${aktiv ? ' an' : ''}`, href: `#alle/${dim}`, 'aria-haspopup': 'dialog' },
      aktiv ? ico('check') : null, el('span', { class: 'wort' }, chipText(f, dim, text, auswahlOptionen(alle, f, dim))), ico('expand_more'));
    return a;
  });
  const zuruecksetzen = hatFilter(f)
    ? knopf('Zurücksetzen', { klasse: 'text', an: () => { setzeFilter({ ...leererFilter(), sortierung: f.sortierung }); k.neuZeichnen(); } })
    : null;
  const sort = SORT_WORTE.find((o) => o.wert === f.sortierung) ?? SORT_WORTE[0];
  return el('div', { class: 'fleiste' },
    el('div', { class: 'reihe' }, chips, zuruecksetzen),
    el('div', { class: 'sortzeile' }, el('span', {}, sort.zeile),
      el('a', { class: 'sortieren', href: '#alle/sortieren', 'aria-haspopup': 'dialog' }, ico('swap_vert'), 'Sortieren', ico('expand_more'))));
}

/** Alle offenen Einträge: Summe, Filter, Gruppen. */
export function alleAnsicht(welt, z, k, f = filter) {
  const platzhalter = ohneStand(welt, z, k, { geladen: 'Einträge werden geladen', nichtGeladen: 'Einträge nicht geladen' });
  if (platzhalter) return platzhalter;
  const alle = uebersichtModelle(welt, { ohneNetz: z.ohneNetz });
  const stand = standZeile(z, welt.jetzt);
  const oben = [fehlerBand(welt, z, k)];
  if (!alle.length) {
    return [...oben, platz({
      bild: 'ok', titel: 'Nichts offen',
      saetze: ['Hier stehen alle offenen Einträge aller Projekte, auch die, die nicht auf dich warten.'],
      knoepfe: [linkKnopf('Etwas erfassen', '#erfassen')], neben: stand,
    })];
  }
  const sichtbar = filtere(alle, f);
  const gefiltert = hatFilter(f);
  const kopf = [...oben, el('p', { class: 'summe' }, ...summe(alle, sichtbar, gefiltert)),
    stand.length ? el('div', { class: 'stand-zeile' }, stand.map((zeile) => el('p', { class: 'neben' }, zeile))) : null, filterLeiste(alle, f, k)];
  if (!sichtbar.length) {
    return [...kopf, platz({
      bild: 'blau', symbol: 'search_off-f', titel: 'Nichts gefunden',
      saetze: ['Kein offener Eintrag passt zu diesen Filtern.'],
      knoepfe: [knopf('Filter zurücksetzen', { an: () => { setzeFilter({ ...leererFilter(), sortierung: f.sortierung }); k.neuZeichnen(); } })],
    })];
  }
  const mitProjekt = !gruppiertNachProjekt(f.sortierung);
  const liste = gruppiere(sichtbar, f.sortierung).flatMap((g) => [
    g.titel ? el('h2', { class: 'gruppenkopf' }, el('b', {}, g.titel), ' ',
      el('span', {}, `${g.eintraege.length} offen${g.fuerDich ? ` · ${g.fuerDich} für dich` : ''}`)) : null,
    el('ul', { class: 'gruppe' }, g.eintraege.map((m) => zeile(m, `#eintrag/${m.id}`, { mitProjekt }))),
  ]);
  return [...kopf, ...liste];
}

/** Eine Reihe der Auswahl: Kästchen oder Kreis, Wort (die Art als Chip) und die Zahl der Treffer. */
function option({ typ, name, o, gewaehlt, dim }) {
  const eingabe = el('input', { type: typ, name, value: o.wert, checked: gewaehlt });
  const wort = dim === 'art' ? chipArt(artVon(o.wert)) : el('span', { class: 'wort' }, o.text);
  return el('label', { class: 'option' }, eingabe, wort, o.n === undefined ? null : el('span', { class: 'n' }, String(o.n)));
}

/**
 * Das Blatt einer Auswahl (`#alle/status` und so weiter): ein Filter mit Kästchen, die Sortierung mit Kreisen. Eine Wahl gilt
 * sofort; Zurück oder der Knopf unten schließen das Blatt, danach zeichnet sich die Liste neu. Die Sortierung schließt von
 * allein, weil es nur eine Wahl gibt.
 */
export function auswahlBlatt(welt, k, o, schliessen, { f = filter, uebernehmen = setzeFilter } = {}) {
  const alle = uebersichtModelle(welt);
  const dim = o.welche;
  if (dim === 'sortieren') {
    const koerper = [el('div', { class: 'optionen', role: 'radiogroup', 'aria-label': AUSWAHL_TITEL.sortieren },
      SORT_WORTE.map((s) => option({ typ: 'radio', name: 'sortierung', o: { wert: s.wert, text: s.text }, gewaehlt: s.wert === f.sortierung, dim })))];
    koerper[0].addEventListener('change', (e) => { uebernehmen({ ...f, sortierung: e.target.value }); schliessen(); });
    return { koerper, knoepfe: [] };
  }
  const optionen = auswahlOptionen(alle, f, dim);
  const gruppe = el('div', { class: 'optionen', role: 'group', 'aria-label': AUSWAHL_TITEL[dim] },
    optionen.map((x) => option({ typ: 'checkbox', name: dim, o: x, gewaehlt: f[dim].includes(x.wert), dim })));
  const zeigen = knopf('', { klasse: 'gefuellt', an: schliessen });
  const wort = FILTER_WORTE.find((w) => w.dim === dim).text;
  const nachfuehren = () => {
    const gewaehlt = [...gruppe.querySelectorAll('input')].filter((i) => i.checked).map((i) => i.value);
    uebernehmen({ ...f, [dim]: gewaehlt });
    f = { ...f, [dim]: gewaehlt };
    const n = filtere(alle, f).length;
    zeigen.textContent = n === 0 ? 'Nichts gefunden' : zahl(n, 'Eintrag zeigen', 'Einträge zeigen');
  };
  gruppe.addEventListener('change', nachfuehren);
  const zurueck = knopf('Zurücksetzen', { klasse: 'text', an: () => {
    for (const i of gruppe.querySelectorAll('input')) i.checked = false;
    nachfuehren();
  } });
  zurueck.setAttribute('aria-label', `${wort} zurücksetzen`);
  zeigen.textContent = zahl(filtere(alle, f).length, 'Eintrag zeigen', 'Einträge zeigen');
  return { koerper: [gruppe], knoepfe: [zurueck, zeigen] };
}
