// Zustand der Einträge: Status, ready, Rang, Adressen, Eingang, "wartet auf dich". Reine Funktionen ohne Browser,
// Port von Entry, Store._scan, Ledger, effective_head, entry_json und waits_for_user aus dem Postsystem. Die Namen
// der Felder im Ergebnis von eintragJson stehen wie in `--json` dort (to, ready_reason, claimed_sender), damit die
// Tests Ergebnis und Erwartung ohne Umbenennen vergleichen. Zeiten sind Millisekunden seit 1970 (UTC).
import {
  ALIAS_RE, EREIGNIS_RE, ID_RE, Doc, isoDatum, isoText, lokalesDatum, normId, parseDoc, parseZeit, rangZahl,
  ulidZeit, zeitText,
} from './format.js';
import { LEERRAUM, strip, teilen } from './pytext.js';

export const STATUS = ['open', 'in_progress', 'waiting', 'done', 'dropped'];
/** Eine Übernahme gilt 12 Stunden, jede Datei des Halters verlängert sie. */
const UEBERNAHME_MS = 12 * 3600 * 1000;
const PROJEKT_NAME = '[A-Za-z0-9][A-Za-z0-9._-]*';
const PUBLISHED_RE = new RegExp(`^${PROJEKT_NAME}@[^${LEERRAUM}]+$`, 'u');

// ---- Einträge aus Dateien

/**
 * Baut die Einträge aus den Dateien des Repos. `dateien` ordnet jeder ID die Dateien ihres Ordners zu (Name zu Text),
 * wie sie in entries/XX/ID/ liegen. Wie Store._scan: eine ID muss ID_RE entsprechen, 0-entry.md muss da sein, Nachträge
 * heißen ULID-status.md oder ULID-addendum.md und stehen nach Dateinamen geordnet. Nicht übernommen: die Prüfung auf
 * 1 MiB je Datei (das Werkzeug dort meldet zu große Dateien; die App zeigt, was GitHub liefert).
 */
export function ladeEintraege(dateien) {
  const eintraege = new Map();
  for (const [id, ordner] of dateien instanceof Map ? dateien : Object.entries(dateien)) {
    const dateienDesOrdners = ordner instanceof Map ? ordner : new Map(Object.entries(ordner));
    if (!ID_RE.test(id) || !dateienDesOrdners.has('0-entry.md')) continue;
    const ereignisse = [];
    let plan = null;
    for (const name of [...dateienDesOrdners.keys()].sort()) {
      const m = EREIGNIS_RE.exec(name);
      if (m) ereignisse.push({ name, ulid: m[1], type: m[2], doc: parseDoc(dateienDesOrdners.get(name)) });
      else if (name === 'plan.md') plan = dateienDesOrdners.get(name);
    }
    eintraege.set(id, { id, head: parseDoc(dateienDesOrdners.get('0-entry.md')), events: ereignisse, plan });
  }
  return eintraege;
}

/** Ordnet Pfade des Baums (entries/XX/ID/DATEI) den IDs zu; andere Pfade und Unterordner (attachments/) bleiben weg. */
export function dateienNachId(pfade) {
  const dateien = new Map();
  for (const [pfad, text] of pfade) {
    const teile = pfad.split('/');
    if (teile.length !== 4 || teile[0] !== 'entries' || teile[1] !== teile[2].slice(0, 2)) continue;
    if (!dateien.has(teile[2])) dateien.set(teile[2], new Map());
    dateien.get(teile[2]).set(teile[3], text);
  }
  return dateien;
}

const aliase = (e) => e.head.getall('Alias');

/** Findet einen Eintrag nach ID oder Alias (Store.resolve); null, wenn es ihn nicht gibt. */
export function finde(eintraege, ref) {
  const key = normId(ref);
  if (eintraege.has(key)) return eintraege.get(key);
  for (const e of eintraege.values()) if (aliase(e).includes(key)) return e;
  return null;
}

// ---- Absender und Vertrauen

export function absender(doc) {
  const wert = doc.get('From') || doc.get('By') || '';
  return strip(wert.split(', ')[0]);
}
export const vertrauen = (doc) => (doc.get('Trust') === 'external' ? 'external' : 'session');

// ---- Adressen und wirksamer Kopf (tpc0e0)

/** Die Adressen im Feld To einer Datei (Kopf oder Nachtrag). */
export function adressListe(doc) {
  return (doc.get('To') || '').split(',').map(strip).filter(Boolean);
}

function projektIn(adressen) {
  for (const a of adressen) if (a.startsWith('project:')) return a.slice(8).split('/')[0];
  return null;
}
const projektVon = (doc) => doc.get('Project') || projektIn(adressListe(doc));
/** Ein Eintrag an `all` bleibt, wie er ist: Nachträge adressieren ihn nicht neu. */
const verteilt = (head) => head.get('Recipients') !== null || strip(head.get('To') || '') === 'all';

/** Nachträge mit To in der Reihenfolge der Dateinamen; `vor` ist ein Dateiname, ab dem keiner mehr zählt. */
export function umadressierungen(eintrag, vor = null) {
  return eintrag.events.filter((ev) => ev.type === 'addendum' && strip(ev.doc.get('To') || '')
    && (vor === null || ev.name < vor));
}

/**
 * Der wirksame Kopf eines Eintrags: To und Project kommen vom letzten Nachtrag mit To; ohne einen solchen, bei einem
 * Eintrag an `all` und ohne Ereignisse ist es der Kopf der Datei. Ein Nachtrag setzt die Adressen ganz neu; Project
 * steht im Nachtrag oder folgt dem neuen project:NAME, sonst bleibt das bisherige. Wer To oder Project eines Eintrags
 * liest, nimmt diese Funktion und nie eintrag.head.
 */
export function wirksamerKopf(eintrag, vor = null) {
  const head = eintrag.head;
  if (!eintrag.events.length || verteilt(head)) return head;
  const wege = umadressierungen(eintrag, vor);
  if (!wege.length) return head;
  let to = null;
  let projekt = projektVon(head);
  for (const ev of wege) {
    to = adressListe(ev.doc);
    projekt = strip(ev.doc.get('Project') || '') || projektIn(to) || projekt;
  }
  const felder = head.fields.filter(([k]) => k !== 'To' && k !== 'Project');
  felder.push(['To', to.join(', ')]);
  if (projekt) felder.push(['Project', projekt]);
  return new Doc(head.title, felder, head.body);
}

export const adressen = (e) => adressListe(wirksamerKopf(e));
export const projektDes = (e) => projektVon(wirksamerKopf(e));
/** Liegt der Eintrag im Eingang: keine Adresse und kein Projekt? */
export function imEingang(e) {
  const kopf = wirksamerKopf(e);
  return !adressListe(kopf).length && !kopf.get('Project');
}
export const anDich = (e) => adressen(e).includes('user');
/** Idee an dich: gehört in die Ideensammlung, wartet nicht auf dich und zählt nicht als offen. */
export const istIdeeAnDich = (e) => e.head.get('Kind') === 'idea' && anDich(e);
/** Wartet der Eintrag jetzt auf dich? Offen und übernehmbar, an user, keine Idee. */
export const wartetAufDich = (e, st) => st.ready && anDich(e) && !istIdeeAnDich(e);

// ---- Bedingungen

/** parse_condition: { kind, arg, text }; ungültige Bedingungen heißen kind invalid. */
export function liesBedingung(roh) {
  const text = strip(roh || '');
  const [kind, trenner, rest] = teilen(text, ':');
  let arg = strip(rest);
  const ungueltig = { kind: 'invalid', arg: roh, text: roh };
  if (!trenner) return ungueltig;
  if (kind === 'done' || kind === 'answered') {
    arg = normId(arg);
    if (!(ID_RE.test(arg) || ALIAS_RE.test(arg))) return ungueltig;
  } else if (kind === 'published') {
    if (!PUBLISHED_RE.test(arg)) return ungueltig;
  } else if (kind === 'date') {
    if (isoDatum(arg) === null) return ungueltig;
  } else if (kind === 'manual') {
    if (!arg) return ungueltig;
  } else {
    return ungueltig;
  }
  return { kind, arg, text: `${kind}:${arg}` };
}

// ---- Zustand

function gefaltet(e, ereignisse) {
  const head = e.head;
  const bedingungen = head.getall('Condition');
  const st = {
    raw: bedingungen.length ? 'waiting' : 'open', holder: null, until: null, takenAt: null, conds: bedingungen,
    priority: rangZahl(head.get('Priority')), urgent: head.get('Urgent') === 'yes', review: head.get('Review'),
    result: null, reason: null,
  };
  for (const ev of ereignisse) {
    if (ev.type !== 'status') continue;
    const d = ev.doc;
    if (d.fields.some(([k]) => k === 'Condition')) st.conds = d.getall('Condition');
    if (STATUS.includes(d.get('Status'))) {
      const neu = d.get('Status');
      if (neu !== 'in_progress') st.holder = st.until = st.takenAt = null;
      st.raw = neu;
    }
    if (d.get('Holder') !== null) { st.holder = d.get('Holder'); st.takenAt = ulidZeit(ev.ulid); }
    if (d.get('Until') !== null) {
      const t = parseZeit(d.get('Until'));
      if (t !== null) st.until = t;
    }
    if (d.get('Review') !== null) st.review = d.get('Review');
    if (d.get('Priority') !== null) st.priority = rangZahl(d.get('Priority'), st.priority);
    if (d.get('Urgent') !== null) st.urgent = d.get('Urgent') === 'yes';
    if (d.get('Result') !== null) st.result = d.get('Result');
    if (d.get('Reason') !== null) st.reason = d.get('Reason');
  }
  return st;
}

function angelegtAm(e) {
  const teile = (e.head.get('From') || '').split(', ');
  if (teile.length >= 3) {
    const t = parseZeit(teile[2]);
    if (t !== null) return t;
  }
  if (e.events.length) return ulidZeit(e.events[0].ulid);
  // Das Werkzeug fragt hier die Änderungszeit der Datei; die App hat sie nicht und nimmt wie dort bei einem
  // Fehler den Anfang der Zeitrechnung.
  return 0;
}

/** Stand aller Einträge zu einem Zeitpunkt `at` (ms); wird immer neu aus den Dateien berechnet. */
export class Hauptbuch {
  constructor(eintraege, at = Date.now()) {
    this.eintraege = eintraege;
    this.at = at;
    this.cache = new Map();
  }

  /** Wirksamer Status samt Übernahme, ohne Bedingungen zu prüfen (verhindert Zyklen). */
  wirksamerStatus(e, ereignisse = null) {
    const events = ereignisse ?? e.events;
    const st = gefaltet(e, events);
    let abgelaufen = false;
    let until = st.until;
    let status = st.raw;
    if (status === 'in_progress') {
      let ende = until;
      let letzte = null;
      for (const ev of events) {
        if (absender(ev.doc) === st.holder && st.takenAt && ulidZeit(ev.ulid) > st.takenAt) letzte = ulidZeit(ev.ulid);
      }
      if (letzte !== null && (ende === null || letzte + UEBERNAHME_MS > ende)) ende = letzte + UEBERNAHME_MS;
      until = ende;
      if (ende === null || this.at > ende) { abgelaufen = true; status = 'open'; }
    }
    return { status, st, until, abgelaufen };
  }

  /** Der Zustand eines Eintrags: Status, ready, Rang, Bedingungen, Halter. */
  zustand(e) {
    if (this.cache.has(e.id)) return this.cache.get(e.id);
    const { status, st, until, abgelaufen } = this.wirksamerStatus(e);
    const bedingungen = st.conds.map((text) => {
      const c = liesBedingung(text);
      return { c, met: this.erfuellt(c) };
    });
    let ready = false;
    let grund = null;
    if (status === 'open') {
      ready = true;
      if (abgelaufen) grund = 'Übernahme abgelaufen';
    } else if (status === 'waiting') {
      const review = st.review;
      if (bedingungen.length && bedingungen.every((b) => b.met)) { ready = true; grund = `${bedingungen[0].c.text} erfüllt`; }
      else if (!bedingungen.length) ready = true;
      if (!ready && review && this.wiedervorlageErreicht(review)) { ready = true; grund = `Wiedervorlage seit ${review}`; }
    }
    const ergebnis = {
      status, raw_status: st.raw, ready, ready_reason: grund,
      holder: status === 'in_progress' ? st.holder : null,
      until: status === 'in_progress' ? until : null,
      lease_expired: abgelaufen, conditions: bedingungen, priority: st.priority, urgent: st.urgent, review: st.review,
      result: st.result, reason: st.reason, created: angelegtAm(e),
    };
    this.cache.set(e.id, ergebnis);
    return ergebnis;
  }

  wiedervorlageErreicht(review) {
    const tag = isoDatum(review);
    return tag !== null && tag <= lokalesDatum(this.at);
  }

  erfuellt(c) {
    if (c.kind === 'done' || c.kind === 'answered') {
      const ziel = finde(this.eintraege, c.arg);
      if (!ziel) return false;
      if (c.kind === 'answered' && ziel.head.get('Kind') !== 'question') return false;
      return this.wirksamerStatus(ziel).status === 'done';
    }
    if (c.kind === 'date') return isoDatum(c.arg) <= lokalesDatum(this.at);
    return false;
  }

  /** Sortierschlüssel nach Rang: dringend zuerst, dann P1 vor P2, dann die ältere Anlage, dann die ID. */
  rangSchluessel(e) {
    const s = this.zustand(e);
    return [s.urgent ? 0 : 1, s.priority, s.created, e.id];
  }
}

/** Vergleicht zwei Sortierschlüssel (Python-Tupelvergleich). */
export function vergleiche(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

/** Der Rang als Text: P2, bei dringend „P1 dringend“. */
export const rangText = (priority, urgent) => `P${priority}${urgent ? ' dringend' : ''}`;

// ---- Ausgabe wie `--json`

/** Zeitpunkt der Erledigung oder Verwerfung; sonst null. */
function geschlossenAm(e, st) {
  if (st.status !== 'done' && st.status !== 'dropped') return null;
  for (let i = e.events.length - 1; i >= 0; i--) {
    const ev = e.events[i];
    if (ev.type === 'status' && ev.doc.get('Status') === st.status) return ulidZeit(ev.ulid);
  }
  return null;
}

/** Die Felder der JSON-Ausgabe des Postwerkzeugs (ohne `full` und `local`) für einen Eintrag. */
export function eintragJson(e, st) {
  const kopf = e.head;
  const geschlossen = geschlossenAm(e, st);
  return {
    id: e.id, kind: kopf.get('Kind'), title: kopf.title, to: adressen(e), project: projektDes(e), from: kopf.get('From'),
    labels: (kopf.get('Labels') || '').split(',').map(strip).filter(Boolean),
    priority: st.priority, urgent: st.urgent, status: st.status, ready: st.ready, ready_reason: st.ready_reason,
    holder: st.holder, until: st.until === null ? null : zeitText(st.until),
    conditions: st.conditions.map(({ c, met }) => ({ text: c.text, met })),
    trust: vertrauen(kopf), claimed_sender: absender(kopf), created: isoText(st.created),
    parent: kopf.get('Parent'), aliases: aliase(e), review: st.review,
    closed: geschlossen === null ? null : isoText(geschlossen), result: st.result, reason: st.reason,
  };
}

// ---- projects.md

/** Liest projects.md: Name (Alias in Kleinbuchstaben) zu { name, aliases, remote, hosts }. */
export function ladeProjekte(text) {
  const projekte = new Map();
  if (!text) return projekte;
  const teile = text.split(/^## /m).slice(1);
  for (const block of teile) {
    const [nameRoh, , rest] = teilen(block, '\n');
    const name = strip(nameRoh);
    const doc = parseDoc(rest);
    const liste = (wert) => (wert || '').split(',').map(strip).filter(Boolean);
    const proj = { name, aliases: liste(doc.get('Aliases')), remote: doc.get('Remote'), hosts: liste(doc.get('Hosts')) };
    if (!new RegExp(`^${PROJEKT_NAME}$`).test(name)) continue;
    for (const key of [name, ...proj.aliases]) if (!projekte.has(key.toLowerCase())) projekte.set(key.toLowerCase(), proj);
  }
  return projekte;
}
