// Anhänge: Namen, Größen, Arten und die Prüfungen vor dem Anhängen. Rein, läuft unter node --test; das Laden aus dem Repo
// steht in anhangholer.js, die Ansicht in anhaengeansicht.js.
//
// Ablage im Datenrepo (docs/format.md des Postwerkzeugs, Abschnitt Anhänge):
//   entries/XX/ID/attachments/NAME          gehört zum Eintrag
//   entries/XX/ID/attachments/ULID/NAME     gehört zum Nachtrag ULID-addendum.md (Feld Attachments: a, b)
// Je Datei höchstens 1 MiB; der Name hat bis zu 100 Zeichen aus Buchstaben, Ziffern, Leerzeichen und . _ - + ( ),
// beginnt und endet nicht mit . oder Leerzeichen. Zu einem Nachtrag gehört, was in attachments/ULID/ liegt, wenn die
// Datei ULID-addendum.md da ist; ein Ordner ohne Nachtrag zählt nicht.
import { ID_RE, ulidZeit } from './format.js';

export const ANHANG_MAX = 1024 * 1024;
/** Darüber warnt das Werkzeug: Der Datenklon wird belastet, kleiner ist besser. */
export const ANHANG_WARNUNG = 300 * 1024;

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
// ATTACH_NAME_RE des Werkzeugs; \w ist dort Python-\w (Buchstaben und Ziffern aller Schriften und _), vgl. pytext.js
const NAME_RE = /^(?:[\p{L}\p{N}_()+][\p{L}\p{N}_ .()+-]{0,98}[\p{L}\p{N}_()+]|[\p{L}\p{N}_()+])$/u;

/** Ist das ein zulässiger Name für einen Anhang? */
export const nameGueltig = (name) => typeof name === 'string' && NAME_RE.test(name);

/** Zerlegt einen Pfad des Baums: { id, ulid (oder null), name } für einen Anhang, sonst null. */
export function anhangPfad(pfad) {
  const t = pfad.split('/');
  if (t.length < 5 || t.length > 6 || t[0] !== 'entries' || t[3] !== 'attachments' || !ID_RE.test(t[2]) || t[1] !== t[2].slice(0, 2)) return null;
  const name = t[t.length - 1];
  if (!nameGueltig(name)) return null;
  if (t.length === 5) return { id: t[2], ulid: null, name };
  return ULID_RE.test(t[4]) ? { id: t[2], ulid: t[4], name } : null;
}

/** Der Pfad im Repo zu einem Eintrag des Baums ({ id, ulid, name }). */
export const anhangPfadVon = (a) => `entries/${a.id.slice(0, 2)}/${a.id}/attachments/${a.ulid ? `${a.ulid}/` : ''}${a.name}`;

// ---- Art und Typ

const BILD = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
const TEXT = new Set(['txt', 'md', 'log', 'csv', 'tsv', 'json', 'yml', 'yaml', 'toml', 'ini', 'conf', 'cfg', 'patch', 'diff', 'sh', 'py', 'js', 'mjs', 'html', 'css', 'xml', 'sql', 'kt', 'rs', 'go', 'c', 'h']);
const SONST = { pdf: 'application/pdf', zip: 'application/zip', gz: 'application/gzip', tar: 'application/x-tar', odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet', svg: 'image/svg+xml' };

const endung = (name) => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '');

/** bild (Rasterformat nach Endung; SVG nie), text (nach Endung) oder datei. */
export function artVon(name) {
  const e = endung(name);
  if (e in BILD) return 'bild';
  return TEXT.has(e) ? 'text' : 'datei';
}

/** Der Medientyp für Anzeige und Speichern. */
export function typVon(name) {
  const e = endung(name);
  if (e in BILD) return BILD[e];
  if (TEXT.has(e)) return e === 'html' ? 'text/plain' : e === 'csv' ? 'text/csv' : e === 'json' ? 'application/json' : 'text/plain';
  return SONST[e] ?? 'application/octet-stream';
}

/** Das Wort für die Art in der Zeile: Bild, Text, PDF, Archiv oder Datei. */
export function artWort(name) {
  const a = artVon(name);
  if (a === 'bild') return 'Bild';
  if (a === 'text') return 'Text';
  const e = endung(name);
  if (e === 'pdf') return 'PDF';
  if (['zip', 'gz', 'tar'].includes(e)) return 'Archiv';
  return 'Datei';
}

/** Größe wie im Werkzeug (size_text): 812 B, 47,1 KiB, 1,2 MiB. */
export function groessenWort(n) {
  if (n < 1024) return `${n} B`;
  const [einheit, wert] = n < 1024 * 1024 ? ['KiB', n / 1024] : ['MiB', n / (1024 * 1024)];
  return `${wert.toFixed(1).replace('.', ',')} ${einheit}`;
}

// ---- Anhänge eines Eintrags

/**
 * Die Anhänge eines Eintrags aus dem Baum (`baum.anhaenge`: [{ id, ulid, name, sha, groesse }]): zuerst die des Eintrags,
 * dann die der Nachträge in der Reihenfolge der Nachträge. Ergebnis: [{ name, sha, groesse, art, typ, ulid, zeit, pfad }];
 * ulid und zeit gibt es nur bei Anhängen eines Nachtrags (zeit ist der Zeitpunkt des Nachtrags in ms).
 */
export function anhaengeVon(baum, e) {
  const nachtraege = new Set(e.events.filter((ev) => ev.type === 'addendum').map((ev) => ev.ulid));
  const aus = [];
  for (const a of baum?.anhaenge ?? []) {
    if (a.id !== e.id || (a.ulid !== null && !nachtraege.has(a.ulid))) continue;
    aus.push({
      name: a.name, sha: a.sha, groesse: a.groesse, art: artVon(a.name), typ: typVon(a.name),
      ulid: a.ulid, zeit: a.ulid ? ulidZeit(a.ulid) : null,
      pfad: anhangPfadVon(a),
    });
  }
  return aus.sort((a, b) => (a.ulid ?? '').localeCompare(b.ulid ?? '') || a.name.localeCompare(b.name, 'de'));
}

// ---- Bytes, Base64, Text

/** Bytes aus Base64; GitHub setzt Zeilenumbrüche in den Inhalt, sie fallen weg. */
export function basisZuBytes(b64) {
  const roh = atob(String(b64).replace(/\s+/g, ''));
  const aus = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i++) aus[i] = roh.charCodeAt(i);
  return aus;
}

export function bytesZuBasis(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}

/** Die Größe in Bytes, die ein Base64-Text ergibt, ohne ihn zu entpacken. */
export function basisGroesse(b64) {
  const t = String(b64).replace(/\s+/g, '');
  return Math.floor((t.length * 3) / 4) - (t.endsWith('==') ? 2 : t.endsWith('=') ? 1 : 0);
}

/** Der Text einer Datei, wenn sie Text ist (UTF-8 ohne NUL-Byte, attachment_text des Werkzeugs), sonst null. */
export function textVon(bytes) {
  if (bytes.includes(0)) return null;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return null; }
}

/** Die Adresse für img: data:TYP;base64,… (die CSP erlaubt img-src data:). */
export const dataAdresse = (typ, b64) => `data:${typ};base64,${String(b64).replace(/\s+/g, '')}`;

// ---- Auswahl beim Anhängen

/** Ein Name, den das Werkzeug annimmt: unzulässige Zeichen werden _, Ränder und Länge angepasst. */
export function saeubereName(roh) {
  let n = String(roh ?? '').split(/[\\/]/).pop().replace(/[^\p{L}\p{N}_ .()+-]/gu, '_');
  n = n.replace(/^[. ]+|[. ]+$/g, '');
  if (Array.from(n).length > 100) {
    const e = endung(n);
    const rumpf = e ? n.slice(0, n.length - e.length - 1) : n;
    const rest = e ? 100 - e.length - 1 : 100;
    n = `${Array.from(rumpf).slice(0, rest).join('').replace(/[. ]+$/g, '')}${e ? `.${e}` : ''}`;
  }
  return nameGueltig(n) ? n : 'anhang';
}

/**
 * Nimmt eine gewählte Datei in die Liste auf. `liste` sind die schon gewählten ([{ name, groesse, typ, daten }], daten ist
 * Base64); `neu` ist { name, groesse, typ, daten }. Ergebnis: { ok: true, liste, hinweis } oder { ok: false, fehler }.
 * Abgelehnt werden zu große Dateien und doppelte Namen; über 300 KiB gibt es einen Hinweis.
 */
export function nimmAuf(liste, neu) {
  const name = saeubereName(neu.name);
  if (neu.groesse > ANHANG_MAX) return { ok: false, fehler: `${name} ist ${groessenWort(neu.groesse)} groß; erlaubt sind höchstens ${groessenWort(ANHANG_MAX)}. Verkleinere die Datei und wähle sie noch einmal.` };
  if (liste.some((a) => a.name === name)) return { ok: false, fehler: `Eine Datei mit dem Namen ${name} ist schon angehängt. Entferne sie oder benenne die neue Datei um.` };
  const hinweis = neu.groesse > ANHANG_WARNUNG ? `${name} ist ${groessenWort(neu.groesse)} groß. Über ${groessenWort(ANHANG_WARNUNG)} belastet ein Anhang das Datenrepo; kleiner ist besser.` : null;
  return { ok: true, liste: [...liste, { name, groesse: neu.groesse, typ: neu.typ || typVon(name), daten: neu.daten }], hinweis };
}

/** Die Texte der Textanhänge für die Prüfung auf Geheimnisse und Personendaten: [{ wo, text }]. */
export function anhangTexte(liste) {
  const aus = [];
  for (const a of liste ?? []) {
    aus.push({ wo: 'Name des Anhangs', text: a.name, nurGeheimnis: true });   // das Werkzeug prüft den Namen nur auf Geheimnisse
    const text = textVon(basisZuBytes(a.daten));
    if (text !== null) aus.push({ wo: `Anhang ${a.name}`, text });
  }
  return aus;
}
