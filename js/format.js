// Dateiformat des Datenrepos: Kopfzeilen lesen, IDs, Zeiten. Reine Funktionen ohne Browser, Port der Funktionen
// parse_doc, norm_id, parse_time und ulid_time aus dem Postsystem (docs/format.md dort). tests/testfaelle prüfen
// sie mit den gemeinsamen Testfällen, tests/datenklon.test.mjs mit dem echten Datenbestand.
import { ganzzahl, strip } from './pytext.js';

export const ID_RE = /^[0-9a-hjkmnp-tv-z]{6}$/;
export const ALIAS_RE = /^[0-9a-f]{4}$/;
export const EREIGNIS_RE = /^([0-9A-HJKMNP-TV-Z]{26})-(status|addendum)\.md$/;
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ID_STRICHE = /[-\u2010\u2011\u2012\u2013]/g;
const VERWECHSLUNG = { o: '0', i: '1', l: '1' };

/** Namen der Kopfzeilen; die Schreibweise gleicht jede Eingabe in Groß- und Kleinschreibung aus. */
const FELDER = ['Kind', 'To', 'Project', 'From', 'Labels', 'Priority', 'Urgent', 'Condition', 'Review', 'Options',
  'Blocking', 'Source', 'Fingerprint', 'Parent', 'Recipients', 'Alias', 'Trust', 'By', 'Status', 'Holder', 'Until',
  'Result', 'Reason', 'Duplicate-Of', 'Superseded-By', 'Commit', 'Note', 'Verdict', 'Round', 'Step', 'Answer',
  'Approval', 'Origin', 'Depth', 'Session', 'Host', 'Surface', 'Link', 'Started', 'Ended'];
const FELD_KLEIN = new Map(FELDER.map((f) => [f.toLowerCase(), f]));
// Python: ^- ([A-Za-z][A-Za-z-]*): (.*)$ mit match auf eine Zeile; das Flag s lässt den Punkt jedes Zeichen nehmen
// (Python-Punkt stößt sich allein an \n, das in einer Zeile nicht vorkommt; JavaScript auch an U+2028 und U+2029).
const KOPF_RE = /^- ([A-Za-z][A-Za-z-]*): (.*)$/s;

/** Eine Datei des Repos: Titel, Kopfzeilen (Paare, Reihenfolge bleibt) und Text. */
export class Doc {
  constructor(title = null, fields = [], body = '') {
    this.title = title;
    this.fields = fields;
    this.body = body;
  }

  /** Erster Wert des Feldes oder null (Python: None). */
  get(name) {
    for (const [k, v] of this.fields) if (k === name) return v;
    return null;
  }

  getall(name) {
    return this.fields.filter(([k]) => k === name).map(([, v]) => v);
  }
}

/** Liest Titel, Kopfzeilen und Text (Leseregeln 1 bis 4 des Formats). */
export function parseDoc(text) {
  const z = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  let i = 0;
  while (i < z.length && !strip(z[i])) i++;
  let title = null;
  if (i < z.length && z[i].startsWith('# ')) { title = strip(z[i].slice(2)); i++; }
  while (i < z.length && !strip(z[i])) i++;
  const fields = [];
  while (i < z.length) {
    const m = KOPF_RE.exec(z[i]);
    if (!m) break;
    fields.push([FELD_KLEIN.get(m[1].toLowerCase()) ?? m[1], strip(m[2])]);
    i++;
  }
  const body = z.slice(i).join('\n').replace(/^\n+|\n+$/g, '');
  return new Doc(title, fields, body);
}

/**
 * Nachsichtige Eingabe einer ID: Groß- und Kleinschreibung, Striche (auch kopierte) und die Verwechslungen o statt
 * 0 sowie i oder l statt 1 fallen weg. Gültige IDs enthalten weder o, i noch l, die Abbildung ist eindeutig.
 */
export function normId(text) {
  return strip(text ?? '').replace(ID_STRICHE, '').toLowerCase().replace(/[oil]/g, (c) => VERWECHSLUNG[c]);
}

/** Zeigt eine ID gegliedert (k7m-2qa): sechs Zeichen mit Strich, alles andere bleibt. */
export function idMitStrich(id) {
  return typeof id === 'string' && ID_RE.test(id) ? `${id.slice(0, 3)}-${id.slice(3)}` : id;
}

/** Zeit der ULID in Millisekunden seit 1970. */
export function ulidZeit(wert) {
  let ms = 0;
  for (const c of wert.slice(0, 10)) ms = ms * 32 + ULID_ALPHABET.indexOf(c);
  return ms;
}

const tageImMonat = (j, m) => new Date(Date.UTC(j, m, 0)).getUTCDate();

/**
 * datetime.date.fromisoformat: Datum JJJJ-MM-TT (auch JJJJMMTT) als Zahl JJJJMMTT, sonst null. Abweichung:
 * Wochendaten (2026-W46-5), die Python 3.11 ebenfalls liest, kennt die App nicht; im Datenbestand gibt es sie nicht.
 */
export function isoDatum(text) {
  const m = /^([0-9]{4})-?([0-9]{2})-?([0-9]{2})$/.exec(text);
  if (!m || (text.length === 10) !== text.includes('-')) return null;
  const [j, mo, t] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (j < 1 || mo < 1 || mo > 12 || t < 1 || t > tageImMonat(j, mo)) return null;
  return j * 10000 + mo * 100 + t;
}

/** Das lokale Datum eines Zeitpunkts (ms) als Zahl JJJJMMTT (Python: astimezone().date()). */
export function lokalesDatum(ms) {
  const d = new Date(ms);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

const ZEIT_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:[T ]([0-9]{2})(?::([0-9]{2})(?::([0-9]{2})(?:[.,]([0-9]{1,6}))?)?)?)?(Z|[+-][0-9]{2}(?::?[0-9]{2})?)?$/;

/**
 * parse_time: ISO-Zeit als ms seit 1970 (UTC) oder null, wo Python einen ValueError würfe. Ohne Zeitzone gilt UTC.
 * Abweichung: Python 3.11 liest weitere Schreibweisen (Basisformat ohne Striche, Wochendaten, beliebiges
 * Trennzeichen); die App liest JJJJ-MM-TT, dann T oder Leerzeichen, Uhrzeit und Zone wie sie im Bestand steht.
 */
export function parseZeit(text) {
  const m = ZEIT_RE.exec(strip(text));
  if (!m) return null;
  const [j, mo, t] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [h, mi, s] = [Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)];
  if (j < 1 || mo < 1 || mo > 12 || t < 1 || t > tageImMonat(j, mo) || h > 23 || mi > 59 || s > 59) return null;
  const bruch = m[7] ? Number(m[7].padEnd(6, '0').slice(0, 3)) : 0;
  let ms = Date.UTC(j, mo - 1, t, h, mi, s, bruch);
  const zone = m[8];
  if (zone && zone !== 'Z') {
    const [zh, zm] = [Number(zone.slice(1, 3)), Number(zone.replace(':', '').slice(3, 5) || 0)];
    if (zh > 23 || zm > 59) return null;
    ms -= (zone[0] === '-' ? -1 : 1) * (zh * 60 + zm) * 60000;
  }
  return ms;
}

const zwei = (n) => String(n).padStart(2, '0');

/** fmt_time: JJJJ-MM-TTTHH:MMZ in UTC, auf die Minute gekürzt. */
export function zeitText(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${zwei(d.getUTCMonth() + 1)}-${zwei(d.getUTCDate())}T${zwei(d.getUTCHours())}:${zwei(d.getUTCMinutes())}Z`;
}

/** datetime.isoformat() für eine Zeit in UTC: JJJJ-MM-TTTHH:MM:SS, bei Bruchteilen .mmm000, dann +00:00. */
export function isoText(ms) {
  const d = new Date(ms);
  const bruch = ms % 1000 ? `.${String(d.getUTCMilliseconds()).padStart(3, '0')}000` : '';
  return `${d.getUTCFullYear()}-${zwei(d.getUTCMonth() + 1)}-${zwei(d.getUTCDate())}T${zwei(d.getUTCHours())}:${zwei(d.getUTCMinutes())}:${zwei(d.getUTCSeconds())}${bruch}+00:00`;
}

/** Rang als Zahl aus einem Kopffeld (int(); bei Fehler der Vorgabewert). */
export function rangZahl(wert, vorgabe = 2) {
  if (wert === null || wert === undefined) return vorgabe;
  return ganzzahl(wert) ?? vorgabe;
}
