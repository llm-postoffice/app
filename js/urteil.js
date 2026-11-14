// Abnahmen: Schritte eines Testauftrags lesen, die Antwort lesen und daraus das Gesamturteil und den Folgeauftrag
// ableiten. Reine Funktionen ohne Browser, Port von scan_steps, previous_results, parse_answer und answer_outcome
// aus dem Postsystem. tests/urteil.test.mjs prüft sie mit den gemeinsamen Testfällen (verdict).
import {
  LEERRAUM, beginntMitLeerraum, einmalTrennen, istLeer, lstrip, rstrip, strip, stripZeichen, teilen, zeilen,
} from './pytext.js';

export const SCHRITT_WOERTER = ['PASS', 'FAIL', 'BLOCKED', 'SKIP'];
const ALIASE = { NOT_APPLICABLE: 'SKIP', NOT_RUN: '' };

// Python \d erkennt Ziffern aller Schriften und int() liest sie; die App liest nur 0 bis 9 (Abweichung: eine Zahl
// vor dem Schritt kommt von einer Tastatur).
const SCHRITT_RE = new RegExp(`^([0-9]+)[.)][${LEERRAUM}]+(.*)$`, 'u');
const ERWARTET_RE = new RegExp(`^[${LEERRAUM}]*(?:Erwartet|Erwartung)[${LEERRAUM}]*:[${LEERRAUM}]*(.*)$`, 'u');
const ERWARTET_IM_TEXT_RE = new RegExp(`[${LEERRAUM}]*(?:Erwartet|Erwartung)[${LEERRAUM}]*:[${LEERRAUM}]*`, 'u');
const ANTWORT_ZEILE_RE = new RegExp(`^([0-9]+)[${LEERRAUM}]*[:.)][${LEERRAUM}]*(.*)$`, 'u');
const GESAMT_RE = new RegExp(`^(?:Gesamt|Verdict)[${LEERRAUM}]*:[${LEERRAUM}]*(.*)$`, 'iu');

/** Erwartbarer Fehler mit Meldung; code 1 Fehler, 2 Bedienfehler (wie im Werkzeug). */
export class Fehler extends Error {
  constructor(meldung, code = 1) {
    super(meldung);
    this.name = 'Fehler';
    this.code = code;
  }
}

/** Macht fremden Text anzeigbar: Steuerzeichen werden sichtbar (^[), wie clean() im Werkzeug. */
export function sichtbar(text, zeile = false) {
  let t = String(text);
  if (zeile) t = t.replaceAll('\t', ' ').replaceAll('\n', ' ');
  return t.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, (z) => {
    const c = z.charCodeAt(0);
    return c < 0x20 ? `^${String.fromCharCode(c ^ 0x40)}` : c === 0x7f ? '^?' : '?';
  });
}

/**
 * Schritte eines Testauftrags und die Zeilen nach ihnen: "N. Titel", darunter Befehl und "Erwartet: ...". Eine nicht
 * eingerückte Zeile nach einer Leerzeile, die kein Schritt ist, trennt Gruppen von Schritten ("Auf dem Gerät:"). Geht
 * es danach mit der nächsten Nummer weiter, zählen die Schritte dazu; sonst endet die Liste vor der Zwischenzeile.
 */
export function leseSchritte(text) {
  const z = zeilen(text || '');
  const schritte = [];
  let luecke = false;
  let pause = null;
  for (let i = 0; i < z.length; i++) {
    const zeile = z[i];
    if (istLeer(zeile)) { luecke = true; continue; }
    const m = SCHRITT_RE.exec(zeile);
    if (m && (pause === null || Number(m[1]) === schritte[schritte.length - 1].n + 1)) {
      const teile = einmalTrennen(ERWARTET_IM_TEXT_RE, m[2]);
      const titel = strip(strip(teile[0]).replace(/:+$/, ''));
      schritte.push({ n: Number(m[1]), title: titel, lines: [], expect: teile.length > 1 ? strip(teile[1]) : null });
      luecke = false;
      pause = null;
      continue;
    }
    if (!schritte.length) continue;
    if (pause !== null) {
      if (m) break;
      continue;
    }
    if (luecke && !beginntMitLeerraum(zeile) && !ERWARTET_RE.test(zeile)) { pause = i; continue; }
    luecke = false;
    const e = ERWARTET_RE.exec(zeile);
    if (e) schritte[schritte.length - 1].expect = strip(e[1]);
    else schritte[schritte.length - 1].lines.push(strip(zeile));
  }
  return { schritte, rest: pause !== null ? z.slice(pause) : [] };
}

/** Letztes Ergebnis je Schritt aus früheren Runden und die Zahl der Runden. */
export function fruehereErgebnisse(eintrag) {
  const ergebnisse = new Map();
  let runden = 0;
  for (const ev of eintrag.events) {
    if (ev.type !== 'addendum' || !ev.doc.get('Verdict')) continue;
    runden++;
    for (const wert of ev.doc.getall('Step')) {
      const [n, , wort] = teilen(wert, ' ');
      if (/^[0-9]+$/.test(n)) ergebnisse.set(Number(n), strip(wort));
    }
  }
  return { ergebnisse, runden };
}

/**
 * Liest "N: WORT Satz" je Schritt, eingerückte Zeilen darunter als Ausgabe, "Gesamt: WORT". Kein Text geht verloren:
 * Zeilen vor dem ersten Schritt und nach "Gesamt:" sind Freitext. `fruehere` ist eine Map Schritt zu Wort aus früheren
 * Runden; mit `vorlage` entfallen nur unveränderte Zeilen der Vorlage mit #, sonst jede Zeile mit #.
 */
export function leseAntwort(text, schritte, fruehere = new Map(), vorlage = null) {
  const bekannt = new Set(schritte.map((s) => s.n));
  const offen = schritte.filter((s) => !['PASS', 'SKIP'].includes(fruehere.get(s.n))).map((s) => s.n);
  const kommentare = vorlage === null ? null : new Set(zeilen(vorlage).map(rstrip));
  const bekommen = new Map();
  const notizen = new Map();
  let urteil = '';
  let grund = '';
  let aktuell = null;
  let gesehen = false;
  const frei = [];
  for (const roh of zeilen(text)) {
    const zeile = rstrip(roh);
    if (lstrip(zeile).startsWith('#') && (kommentare === null || kommentare.has(zeile))) continue;
    const v = GESAMT_RE.exec(zeile);
    if (v) {
      if (gesehen) throw new Fehler('Gesamt steht zweimal in der Antwort', 2);
      gesehen = true;
      const [wort, , rest] = teilen(strip(v[1]), ' ');
      urteil = stripZeichen(strip(wort), '.,:;„“"').toUpperCase();
      grund = strip(rest);
      aktuell = null;
      continue;
    }
    const m = ANTWORT_ZEILE_RE.exec(zeile);
    if (m && !beginntMitLeerraum(zeile)) {
      const n = Number(m[1]);
      const [w, , rest] = teilen(strip(m[2]), ' ');
      let wort = stripZeichen(w, '.,:;').toUpperCase();
      wort = Object.hasOwn(ALIASE, wort) ? ALIASE[wort] : wort;
      if (gesehen && !(bekannt.has(n) && !bekommen.has(n) && (!wort || SCHRITT_WOERTER.includes(wort)))) {
        frei.push(zeile);   // unter "Gesamt:" ist eine Zeile wie "2. Idee" Freitext, kein Schritt
        continue;
      }
      if (!bekannt.has(n)) throw new Fehler(`Schritt ${n} gibt es nicht; die Abnahme hat die Schritte 1 bis ${schritte.length}`, 2);
      if (bekommen.has(n)) throw new Fehler(`Schritt ${n} steht zweimal in der Antwort`, 2);
      if (wort && !SCHRITT_WOERTER.includes(wort)) {
        throw new Fehler(`Schritt ${n}: „${sichtbar(m[2], true).slice(0, 40)}“ ist kein Ergebnis; erlaubt sind PASS, FAIL, BLOCKED und SKIP, leer heißt nicht ausgeführt`, 2);
      }
      bekommen.set(n, [wort, strip(rest)]);
      aktuell = n;
      continue;
    }
    if (aktuell === null) frei.push(zeile);
    else if (strip(zeile)) {
      if (!notizen.has(aktuell)) notizen.set(aktuell, []);
      notizen.get(aktuell).push(zeile);
    }
  }
  if (urteil && !['PASS', 'FAIL'].includes(urteil)) {
    throw new Fehler(`Gesamt: „${sichtbar(urteil, true)}“ ist kein Urteil; erlaubt sind PASS und FAIL`, 2);
  }
  const beantwortet = new Map([...bekommen].filter(([, [w]]) => w).map(([n, [w]]) => [n, w]));
  if (!beantwortet.size && !urteil) throw new Fehler('keine Antwort gefunden; je Schritt eine Zeile wie „1: PASS“', 2);
  const nachNummer = [...bekommen].sort((a, b) => a[0] - b[0]);
  for (const [n, [wort, rest]] of nachNummer) {
    if (['FAIL', 'BLOCKED', 'SKIP'].includes(wort) && !rest && !notizen.get(n)?.length) {
      throw new Fehler(`Schritt ${n}: ${wort} braucht einen Satz, was du gesehen hast oder warum`, 2);
    }
  }
  const fehlgeschlagen = [...beantwortet].filter(([, w]) => w === 'FAIL' || w === 'BLOCKED').map(([n]) => n);
  const leer = offen.filter((n) => !beantwortet.get(n));
  const berechnet = fehlgeschlagen.length || leer.length ? 'FAIL' : 'PASS';
  if (urteil === 'PASS' && fehlgeschlagen.length) {
    throw new Fehler(`Gesamt: PASS passt nicht zu ${fehlgeschlagen.map((n) => `Schritt ${n} ${beantwortet.get(n)}`).join(', ')}`, 2);
  }
  if (urteil === 'PASS' && leer.length) {
    throw new Fehler(`Gesamt: PASS, aber ohne Ergebnis: Schritt ${leer.join(', ')}; ausfüllen oder SKIP mit Grund`, 2);
  }
  if (!urteil && leer.length && !fehlgeschlagen.length) {
    throw new Fehler(`ohne Ergebnis: Schritt ${leer.join(', ')}; ausfüllen, SKIP mit Grund oder „Gesamt: FAIL“ mit Satz`, 2);
  }
  if (urteil === 'FAIL' && !fehlgeschlagen.length && !grund) {
    throw new Fehler('Gesamt: FAIL ohne fehlgeschlagenen Schritt braucht einen Satz dahinter', 2);
  }
  return {
    verdict: urteil || berechnet, stated: Boolean(urteil), steps: new Map(nachNummer), notes: notizen, reason: grund,
    free: frei.join('\n').replace(/^\n+|\n+$/g, ''),
  };
}

/**
 * Was aus einer Antwort folgt: fehlgeschlagene Schritte, ob ein Folgeauftrag kommt, welche Schritte er nennt und ob er
 * das Etikett bug trägt. Die Schlüssel stehen wie im Werkzeug (failed, follow_up, follow_up_steps, label).
 */
export function folgeausgang(antwort) {
  const woerter = [...antwort.steps].map(([n, [w]]) => [n, w]);
  return {
    failed: woerter.filter(([, w]) => w === 'FAIL' || w === 'BLOCKED').map(([n]) => n),
    follow_up: antwort.verdict === 'FAIL',
    follow_up_steps: woerter.filter(([, w]) => w === 'FAIL' || w === 'BLOCKED' || w === '').map(([n]) => n),
    label: woerter.some(([, w]) => w === 'FAIL') ? 'bug' : null,
  };
}
