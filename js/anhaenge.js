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
  const a = { name, groesse: neu.groesse, typ: neu.typ || typVon(name), daten: neu.daten };
  if (neu.vorher) a.vorher = neu.vorher;
  return { ok: true, liste: [...liste, a], hinweis };
}

// ---- Bilder verkleinern

/** Bis zu dieser Größe nimmt die App ein Bild an, um es auf ANHANG_MAX zu verkleinern (die Hülle liest Bilder bis hierher). */
export const BILD_QUELLE_MAX = 20 * 1024 * 1024;

const FOTO_TYP = /^image\/(jpeg|webp|heic|heif)$/;
const FOTO_ENDUNG = new Set(['jpg', 'jpeg', 'webp', 'heic', 'heif']);

/** 'foto' (JPEG, WebP, HEIC/HEIF), 'png' oder null (alles andere, auch GIF und SVG). Der Typ gilt, sonst die Endung. */
function bildArt(name, typ) {
  const t = String(typ ?? '').toLowerCase();
  if (t.startsWith('image/')) return FOTO_TYP.test(t) ? 'foto' : t === 'image/png' ? 'png' : null;
  const e = endung(String(name ?? ''));
  return FOTO_ENDUNG.has(e) ? 'foto' : e === 'png' ? 'png' : null;
}

/** Ob die App ein Bild dieser Art neu kodieren kann (Fotos und PNG); die Hülle liest solche Bilder bis BILD_QUELLE_MAX. */
export const verkleinerbar = (name, typ) => bildArt(name, typ) !== null;

/**
 * Ob die App die Datei neu kodiert: ein Foto (JPEG, WebP, HEIC) immer, ein PNG nur über ANHANG_MAX (Bildschirmfotos und Belege
 * mit Text bleiben scharf), alles andere nie.
 */
export function wirdUmkodiert(name, typ, groesse) {
  const art = bildArt(name, typ);
  return art === 'foto' || (art === 'png' && groesse > ANHANG_MAX);
}

/**
 * Bereitet eine gewählte oder geteilte Datei zum Anhängen vor. `datei` ist { name, typ, groesse, bytes oder blob }.
 * Ein Foto kodiert `verkleinere(blob, name)` (verkleinern.js) immer neu, ein PNG über ANHANG_MAX auch; bleibt das Ergebnis nicht
 * kleiner als das Original, gilt das Original. Ein Bild über ANHANG_MAX, das sich nicht verkleinern lässt, wird abgelehnt; ein
 * kleineres bleibt, wie es ist. Alles andere über ANHANG_MAX wird abgelehnt, ohne es zu lesen. Fehlt `verkleinere`, bleibt alles,
 * wie es ist. `verb` ist „wähle“ oder „teile“ im Satz.
 * Ergebnis: { ok: true, name, typ, groesse, daten (Base64), vorher (nur nach dem Neukodieren) } oder { ok: false, fehler }.
 */
export async function bereiteVor(datei, verkleinere = null, verb = 'wähle') {
  const { name, typ } = datei;
  const gross = groessenWort(datei.groesse);
  const satz = (s) => `${name} ist ${gross} groß${s}`;
  const ueber = datei.groesse > ANHANG_MAX;
  const lesen = async () => bytesZuBasis(datei.bytes ?? new Uint8Array(await datei.blob.arrayBuffer()));
  if (ueber && (!verkleinerbar(name, typ) || !verkleinere)) {
    const r = nimmAuf([], { name, groesse: datei.groesse, typ, daten: '' });
    return { ok: false, fehler: r.fehler.replace('wähle sie noch einmal', `${verb} sie noch einmal`) };
  }
  if (ueber && datei.groesse > BILD_QUELLE_MAX) return { ok: false, fehler: satz(`; Bilder verkleinert die App bis ${groessenWort(BILD_QUELLE_MAX)}. Verkleinere das Bild und ${verb} es noch einmal.`) };
  if (!verkleinere || !wirdUmkodiert(name, typ, datei.groesse) || datei.groesse > BILD_QUELLE_MAX) return { ok: true, name, typ, groesse: datei.groesse, daten: await lesen() };
  let v;
  try { v = await verkleinere(datei.blob ?? new Blob([datei.bytes], { type: typ || typVon(name) }), name); } catch { v = { ok: false, grund: 'nicht-lesbar' }; }
  if (!v.ok) {
    // Ein Foto bis 1 MiB, das sich nicht neu kodieren lässt (etwa HEIC ohne Decoder), geht so, wie es ist
    if (!ueber) return { ok: true, name, typ, groesse: datei.groesse, daten: await lesen() };
    return { ok: false, fehler: satz(v.grund === 'zu-gross' ? `, lässt sich aber nicht auf ${groessenWort(ANHANG_MAX)} verkleinern. ${verb === 'teile' ? 'Teile' : 'Wähle'} eine kleinere Fassung.`
      : `, und die App kann es nicht verkleinern. Erlaubt sind höchstens ${groessenWort(ANHANG_MAX)}. Verkleinere das Bild und ${verb} es noch einmal.`) };
  }
  if (!ueber && v.blob.size >= datei.groesse) return { ok: true, name, typ, groesse: datei.groesse, daten: await lesen() };
  const bytes = new Uint8Array(await v.blob.arrayBuffer());
  return { ok: true, name: v.name, typ: v.typ, groesse: bytes.length, daten: bytesZuBasis(bytes), vorher: datei.groesse };
}

/** So viele Dateien nimmt Erfassen aus einem Teilen der Hülle (DATEIEN_MAX in Teilen.kt). */
export const ANHAENGE_TEILEN_MAX = 10;

/**
 * Nimmt die Dateien aus der Nachricht `teilen` der Hülle in die Liste auf, über dieselbe Prüfung wie Datei anhängen (nimmAuf).
 * `dateien` sind { name, typ, groesse, daten } oder { name, typ, groesse, fehler, grenze } (Protokoll im Kopf von huelle.js),
 * `mehr` die Zahl der Dateien, die die Hülle über ihrer Grenze ausließ. Ein Bild über ANHANG_MAX verkleinert `verkleinere`
 * (bereiteVor). Ergebnis: { liste, fehler: [Satz], hinweise: [Satz] }.
 */
export async function teileAuf(liste, dateien, mehr = 0, verkleinere = null) {
  const fehler = [];
  const hinweise = [];
  const alle = Array.isArray(dateien) ? dateien : [];
  let aus = liste;
  for (const d of alle.slice(0, ANHAENGE_TEILEN_MAX)) {
    if (!d || typeof d !== 'object') continue;
    const name = typeof d.name === 'string' && d.name !== '' ? saeubereName(d.name) : 'Datei';
    const bekannt = typeof d.groesse === 'number' && d.groesse >= 0;
    if (d.fehler === 'zu-gross') {
      const bild = d.grenze > ANHANG_MAX;
      const wie = bekannt ? `${name} ist ${groessenWort(d.groesse)} groß` : `${name} ist größer als ${groessenWort(bild ? d.grenze : ANHANG_MAX)}`;
      fehler.push(bild ? `${wie}; Bilder verkleinert die App bis ${groessenWort(d.grenze)}. Verkleinere das Bild und teile es noch einmal.`
        : `${wie}; erlaubt sind höchstens ${groessenWort(ANHANG_MAX)}. Verkleinere die Datei und teile sie noch einmal.`);
      continue;
    }
    if (d.fehler === 'kein-zugriff') { fehler.push('Eine Datei ließ sich nicht öffnen, weil die andere App sie nicht freigab. Teile sie noch einmal.'); continue; }
    if (d.fehler || typeof d.daten !== 'string') { fehler.push(`${name} lässt sich nicht lesen. Teile sie noch einmal.`); continue; }
    let bytes;
    try { bytes = basisZuBytes(d.daten); } catch { fehler.push(`${name} lässt sich nicht lesen. Teile sie noch einmal.`); continue; }
    const typ = typeof d.typ === 'string' && /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i.test(d.typ) && d.typ !== 'application/octet-stream' ? d.typ.toLowerCase() : '';
    let b;
    try { b = await bereiteVor({ name, typ: typ || typVon(name), groesse: bytes.length, bytes }, verkleinere, 'teile'); } catch { b = { ok: false, fehler: `${name} lässt sich nicht lesen. Teile sie noch einmal.` }; }
    if (!b.ok) { fehler.push(b.fehler); continue; }
    const r = nimmAuf(aus, { name: b.name, groesse: b.groesse, typ: b.typ, daten: b.daten, vorher: b.vorher });
    if (r.ok) { aus = r.liste; if (r.hinweis) hinweise.push(r.hinweis); } else fehler.push(r.fehler.replace('wähle sie noch einmal', 'teile sie noch einmal'));
  }
  const ausgelassen = Math.max(0, alle.length - ANHAENGE_TEILEN_MAX) + (Number.isInteger(mehr) && mehr > 0 ? mehr : 0);
  if (ausgelassen) fehler.push(`${ausgelassen} ${ausgelassen === 1 ? 'weitere Datei ist' : 'weitere Dateien sind'} nicht dabei; je Teilen gehen höchstens ${ANHAENGE_TEILEN_MAX}.`);
  return { liste: aus, fehler, hinweise };
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
