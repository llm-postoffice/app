// Bausteine der Ansichten: Chips, Karten, Kopfkarte, Bänder, Zustandsgrafik, Übersicht und Felder. Sie bauen Knoten nur
// mit el() aus dom.js: Text aus Einträgen geht ausschließlich als Text in den Baum (USI-1). Farbe, Symbol und Wort
// gehören zusammen; Farbe steht nie allein (UFA-2, UFA-7). Maße und Farben stehen in app.css.
import { el, ico } from './dom.js';
import { PRIO_WORTE, absenderText } from './ansichtstexte.js';
import { fristKnoten } from './frist.js';

/** Chip der Art: Symbol und Wort in der Farbe der Art. */
export const chipArt = (art) => el('span', { class: `chip-art ${art.klasse}` }, ico(art.symbol), art.wort);

/** Der rote Chip „Dringend“ mit Flagge; `text` kann „davon 1 dringend“ sein. */
export const chipDringend = (text = 'Dringend') => el('span', { class: 'chip-dringend' }, ico('flag-f'), text);

/** Chip eines Zustands: Rolle s-ok, s-warn, s-fehler oder s-neutral, Symbol, Wort. */
export const chipZustand = (z) => el('span', { class: `chip-zst ${z.rolle ?? 's-neutral'}` }, ico(z.symbol), el('span', {}, z.text, z.bis ? [' ', fristKnoten(z.bis, z.jetzt)] : null));

/** Zustandszeile mit Symbol; fett, wenn etwas auf dich wartet. */
export const zustandsZeile = (z) => (z.chip ? chipZustand(z)
  : el('span', { class: `zst${z.stark ? ' stark' : ''}${z.rolle ? ` ${z.rolle}` : ''}` }, ico(z.symbol), el('span', {}, z.text)));

/** ID mit Strich, Monospace, in Kupfer (Nachtrag, Abschnitt e). */
export const idSpan = (text) => el('span', { class: 'id' }, text);

/** Sitzung in Monospace ohne Farbe. */
export const sitzungSpan = (text) => el('span', { class: 'sitzung' }, text);

/** „von session:cb56d77f auf rechner-a“: die Sitzung in Monospace. Gibt null zurück, wenn kein Absender bekannt ist. */
export function vonZeile(von, klasse = 'von') {
  const a = typeof von === 'string' || von == null ? absenderText(von) : von;
  if (!a) return null;
  const wer = a.wer.startsWith('session:') ? sitzungSpan(a.wer) : a.wer;
  return el('span', { class: klasse }, 'von ', wer, a.wo ? `${a.trenner}${a.wo}` : '');
}

/** Projektname fett, Zusatz („an rechner-a“, „Niedrig“) leichter; ohne Projekt „ohne Projekt“ in Nebenfarbe. */
export function projektSpan(projekt, rest = null) {
  if (!projekt) return el('span', { class: 'projekt keins' }, 'ohne Projekt', rest ? ` · ${rest}` : '');
  return el('span', { class: 'projekt' }, projekt, rest ? el('span', { class: 'rest' }, ` · ${rest}`) : '');
}

/** Eine Karte der Liste: Kopfzeile mit Art, ID, Projekt und Dringend, Titel, Zustand, Absender. Als Ganzes ein Ziel. */
export function karte(m, href) {
  return el('li', {}, el('a', { class: `karte ${m.art.klasse}${m.dringend ? ' dringend' : ''}`, href },
    el('span', { class: 'kopfzeile' }, chipArt(m.art), idSpan(m.idText), projektSpan(m.projekt, m.an),
      m.dringend ? chipDringend() : null),
    el('span', { class: 'titel' }, m.titel),
    zustandsZeile(m.zustand),
    m.von ? vonZeile(m.von) : null));
}

/**
 * Eine Zeile der Übersicht „Alle“: die Art als Chip mit Symbol und Wort, ID, Projekt (nur wenn die Liste nicht nach Projekt
 * gruppiert ist), Titel, Zustand, Priorität und Alter. Als Ganzes ein Ziel; ohne Karte, damit viele Einträge dicht stehen.
 */
export function zeile(m, href, { mitProjekt = true } = {}) {
  const prio = m.dringend ? el('span', { class: 'prio hoch' }, ico('flag-f'), 'Dringend') : el('span', { class: 'prio' }, PRIO_WORTE.find((o) => o.wert === m.stufe).text);
  return el('li', {}, el('a', { class: `zeile ${m.art.klasse}${m.dringend ? ' dringend' : ''}`, href },
    el('span', { class: 'kopfz' }, chipArt(m.art), idSpan(m.idText),
      mitProjekt ? projektSpan(m.projekt, m.an) : (m.an ? el('span', { class: 'rest' }, m.an) : null)),
    el('span', { class: 't' }, m.titel),
    zustandsZeile(m.zustand),
    el('span', { class: 'm' }, prio, ` · ${m.alter}`)));
}

/** Liste von Karten. */
export const karten = (modelle, adresse = (m) => `#eintrag/${m.id}`) => el('ul', { class: 'karten' }, modelle.map((m) => karte(m, adresse(m))));

/** Ruhige Karte mit rundem Symbol, fetter Zeile und Nebenzeile; ein Ziel in Mehr oder unter Wartet (Eingang). */
export function ruhigeKarte({ symbol, titel, zeile, href, weich = false }) {
  return el('li', {}, el('a', { class: 'karte ruhig', href },
    el('span', { class: 'rund' }, ico(symbol)),
    el('span', { class: 'daten' }, el('b', {}, weich ? weicherUmbruch(titel) : titel), el('span', {}, zeile)),
    ico('chevron_right')));
}

/** „Ideensammlung“ bricht bei großer Schrift an einem weichen Trennstrich statt mitten im Wort (Nachtrag, Abschnitt d). */
const weicherUmbruch = (wort) => wort.replace('sammlung', '­sammlung');

/** Die Kopfkarte eines Eintrags: Fläche der Art, Symbol im Kreis, Wort der Art, ID, Projekt, Absender, Titel, Zustand. */
export function kopfkarte(m, { rangText = null, weitere = [] } = {}) {
  return el('section', { class: `kopfkarte ${m.art.klasse}`, 'aria-labelledby': 'eintrag-titel' },
    el('div', { class: 'zeile1' }, el('span', { class: 'rund' }, ico(m.art.symbol)), el('span', { class: 'art' }, m.art.wort),
      m.dringend ? chipDringend() : null, idSpan(m.idText)),
    el('div', { class: `projektzeile${m.projekt ? '' : ' keins'}` }, m.projekt ?? 'ohne Projekt',
      ' · ', el('span', { class: 'rest' }, [m.an, rangText].filter(Boolean).join(' · '))),
    m.von ? vonZeile(m.von, 'meta') : null,
    el('h2', { id: 'eintrag-titel' }, m.titel),
    zustandsZeile({ ...m.zustand, chip: false, stark: m.zustand.stark ?? true }),
    ...weitere);
}

/** Band mit Symbol, Titel, Satz (oder eine Liste von Sätzen, je Satz ein Absatz) und Knöpfen; ton ist ruhig, ok, info, warn oder fehler. */
export function band({ ton = 'info', symbol, titel = null, satz, knoepfe = [], alarm = false }) {
  return el('div', { class: `band ${ton}`, role: alarm || ton === 'warn' || ton === 'fehler' ? 'alert' : 'status' },
    ico(symbol),
    el('div', {}, titel ? el('strong', {}, titel) : null, ...(Array.isArray(satz) ? satz : [satz]).map((t) => el('p', {}, t)), knoepfe.length ? el('div', { class: 'zeilenknoepfe' }, knoepfe) : null));
}

/** Knopf (button) mit Klasse gefuellt, tonal oder text; `symbol` setzt ein Symbol vor das Wort. */
export function knopf(text, { klasse = 'tonal', symbol = null, an = null, gesperrt = false, typ = 'button', id = null, form = null } = {}) {
  const k = el('button', { type: typ, class: `${klasse}${symbol ? ' ik' : ''}`, id, form, disabled: gesperrt }, symbol ? ico(symbol) : null, text);
  if (an) k.addEventListener('click', an);
  return k;
}

/** Link im Gewand eines Knopfs. */
export const linkKnopf = (text, href, { klasse = 'tonal', symbol = null } = {}) => el('a', { class: `${klasse}${symbol ? ' ik' : ''}`, href }, symbol ? ico(symbol) : null, text);

const BILD_SYMBOL = { ok: { symbol: 'task_alt-f' }, blau: { symbol: 'cloud_download-f' }, fehler: { symbol: 'cloud_off-f' }, nachricht: { symbol: 'lightbulb-f' }, warn: { symbol: 'warning-f' } };

/** Zustandsgrafik für leer, lädt und Fehler: Fläche, Symbol im Kreis, drei Punkte, ohne Bilddatei (UFA-10). */
export function platz({ bild = 'blau', symbol = null, titel, saetze = [], knoepfe = [], neben = [], fortschritt = null, einzelheiten = null }) {
  return el('section', { class: 'platz' },
    el('div', { class: `bild ${bild}`, 'aria-hidden': 'true' }, el('span', { class: 'blob' }, ''), el('span', { class: 'punkt p1' }, ''),
      el('span', { class: 'punkt p2' }, ''), el('span', { class: 'punkt p3' }, ''), el('span', { class: 'mitte' }, ico(symbol ?? BILD_SYMBOL[bild].symbol))),
    el('h2', {}, titel),
    saetze.map((s) => el('p', {}, s)),
    fortschritt ? [el('progress', { max: fortschritt.max ?? false, value: fortschritt.max ? fortschritt.wert : false, 'aria-label': fortschritt.beschriftung }), el('p', {}, fortschritt.text)] : null,
    knoepfe,
    neben.map((s) => el('p', { class: 'neben' }, s)),
    einzelheiten ? el('details', {}, el('summary', {}, 'Einzelheiten'), el('pre', {}, einzelheiten)) : null);
}

/** Übersicht oben: das Ergebnis zuerst, groß („5 für dich“), dazu Chips und Nebenzeilen (GRM-6). */
export function uebersicht({ n, wort, chips = [], neben = [] }) {
  return el('div', { class: 'uebersicht' },
    el('p', { class: 'zahl' }, el('span', { class: 'n' }, String(n)), ` ${wort}`),
    chips.length ? el('div', { class: 'chips-reihe' }, chips) : null,
    neben.map((s) => el('p', { class: 'neben' }, s)));
}

/** Gruppentitel in einer Liste: kleiner, ruhiger Text über den Karten. */
export const gruppentitel = (...kinder) => el('p', { class: 'gruppentitel' }, ...kinder);

/** Beschriftetes Feld: Beschriftung über dem Feld, Hinweis darunter (UEI-5). */
export function feld({ beschriftung, steuerung, hinweis = null, fehler = null, id = null }) {
  return el('label', { class: `feld${fehler ? ' mit-fehler' : ''}`, id }, beschriftung, steuerung,
    fehler ? el('span', { class: 'fehlertext', role: 'alert' }, ico('error-f'), el('span', {}, fehler)) : null,
    hinweis ? el('small', {}, hinweis) : null);
}

/** Auswahlfeld des Systems (select); `gruppen` sind [{ titel, optionen: [{ wert, text }] }], `wert` ist die Vorauswahl. */
export function auswahl({ name, gruppen, wert = '', platzhalter = null }) {
  const s = el('select', { name });
  if (platzhalter) s.append(el('option', { value: '', disabled: true, selected: wert === '' }, platzhalter));
  for (const g of gruppen) {
    s.append(el('optgroup', { label: g.titel }, g.optionen.map((o) => el('option', { value: o.wert, selected: o.wert === wert }, o.text))));
  }
  return s;
}

/** Chips zur Auswahl (Radio): Art in Erfassen mit Haken im gewählten, Priorität ohne Symbol. */
export function chipAuswahl({ name, optionen, wert, arten = false }) {
  return el('div', { class: `chips${arten ? ' arten' : ''}` }, optionen.map((o) => el('label', { class: `chip ${o.klasse ?? ''}`.trim() },
    el('input', { type: 'radio', name, value: o.wert, checked: o.wert === wert }),
    el('span', {}, arten ? el('i', { class: 'gewaehlt' }, ico('check')) : null, o.symbol ? ico(o.symbol) : null, o.text))));
}

/** Aufklappbarer Teil mit Dreieck (Nachtrag, Fund 6). */
export const aufklappbar = (titel, ...kinder) => el('details', {}, el('summary', {}, titel), ...kinder);
