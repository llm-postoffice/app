// Die Welt der Ansichten: aus den Dateien auf dem Gerät (leseStand) rechnet sie die Einträge, ihren Zustand und die
// Listen für Wartet, Alle, Abnahmen, Eingang, Ideensammlung und Suche. Reine Funktionen ohne Browser, damit node --test jede
// Liste und jeden Satz prüft. Sie nutzt Zustand und Urteile aus Teil C (zustand.js, urteil.js) und ändert nichts an
// ihnen. Text aus Einträgen ist fremder Text: Einzeiler laufen durch sichtbar(), die Anzeige setzt ihn nur als
// textContent (USI-1).
import { leseStand } from './abgleich.js';
import { absender, adressen, anDich, dateienNachId, finde, Hauptbuch, imEingang, istIdeeAnDich, ladeEintraege, ladeProjekte, projektDes, vergleiche, vertrauen, wartetAufDich } from './zustand.js';
import { fruehereErgebnisse, leseSchritte, sichtbar } from './urteil.js';
import { idMitStrich, normId, ulidZeit } from './format.js';
import { ARTEN, PRIO_WORTE, SORT_WORTE, STATUS_WORTE, absenderText, adressText, artVon, entwurfZeile, kurz, schlangeZeile, schritte as schritteText, um, zeitpunkt } from './ansichtstexte.js';

const OFFEN_WORTE = new Set(['PASS', 'SKIP']);
const geschlossen = (st) => st.status === 'done' || st.status === 'dropped';

/** Liest alles, was die Ansichten brauchen, aus der Datenbank; `jetzt` ist die Uhr in ms. */
export async function ladeWelt(db, jetzt = Date.now()) {
  const stand = await leseStand(db);
  const entwuerfe = await db.alle('entwuerfe');
  const schlange = await db.alle('schlange');
  return baueWelt({ pfade: stand?.pfade ?? null, baum: stand?.baum ?? null, entwuerfe, schlange, jetzt });
}

/** Baut die Welt aus den Dateien (Pfad zu Text). Ohne Dateien (kein Stand auf dem Gerät) ist `hatStand` falsch. */
export function baueWelt({ pfade, baum = null, entwuerfe = [], schlange = [], jetzt = Date.now() }) {
  const eintraege = ladeEintraege(pfade ? dateienNachId(pfade) : new Map());
  const buch = new Hauptbuch(eintraege, jetzt);
  const liste = [...eintraege.values()].map((e) => ({ e, st: buch.zustand(e) }));
  const kinder = new Map();
  for (const { e } of liste) {
    const eltern = e.head.get('Parent');
    if (eltern) kinder.set(eltern, [...(kinder.get(eltern) ?? []), e]);
  }
  const projekte = ladeProjekte(pfade?.get('projects.md') ?? '');
  return {
    jetzt, hatStand: Boolean(pfade), baum, eintraege, buch, liste, kinder, projekte,
    entwuerfe: new Map(entwuerfe.map((d) => [d.schluessel, d])), schlange,
    projektNamen: [...new Set(projekte.values())].map((p) => p.name).sort((a, b) => a.localeCompare(b, 'de')),
  };
}

const rang = (w, a, b) => vergleiche(w.buch.rangSchluessel(a.e), w.buch.rangSchluessel(b.e));
const neueste = (a, b) => b.st.created - a.st.created || (a.e.id < b.e.id ? -1 : 1);

/** Einträge, die jetzt auf dich warten: nach Rang, Dringendes zuerst (ohne Ideen an dich). */
export const wartetListe = (w) => w.liste.filter(({ e, st }) => wartetAufDich(e, st)).sort((a, b) => rang(w, a, b));
/** Abnahmen, die auf dein Urteil warten. */
export const abnahmenListe = (w) => wartetListe(w).filter(({ e }) => e.head.get('Kind') === 'test');
/** Einträge ohne Ziel, die noch offen sind; neueste zuerst. */
export const eingangListe = (w) => w.liste.filter(({ e, st }) => imEingang(e) && !geschlossen(st)).sort(neueste);
/** Ideen an dich, offen; neueste zuerst. */
export const ideenListe = (w) => w.liste.filter(({ e, st }) => istIdeeAnDich(e) && !geschlossen(st)).sort(neueste);

/** Woher kommt ein Eintrag? eingang, ideen, abnahmen oder null; bestimmt den Stapel unter einem tiefen Link. */
export function ortVon(w, id) {
  const e = finde(w.eintraege, id);
  if (!e) return null;
  const st = w.buch.zustand(e);
  if (istIdeeAnDich(e) && !geschlossen(st)) return 'ideen';
  if (imEingang(e) && !geschlossen(st)) return 'eingang';
  if (e.head.get('Kind') === 'test' && wartetAufDich(e, st)) return 'abnahmen';
  return null;
}

/** Hosts aus den Adressen (`host:NAME`) eines Eintrags. */
export const hostsVon = (e) => adressen(e).filter((a) => a.startsWith('host:')).map((a) => a.slice(5));

/** Die Schritte einer Abnahme und was davon offen ist (Runde 2 und später zeigen nur die offenen). */
export function abnahmeSchritte(e) {
  const { schritte, rest } = leseSchritte(e.head.body);
  const { ergebnisse, runden } = fruehereErgebnisse(e);
  const offen = schritte.filter((s) => !OFFEN_WORTE.has(ergebnisse.get(s.n)));
  return { schritte, offen, ergebnisse, runde: runden + 1, rest };
}

/** Zahl der Schritte, die dieses Gerät schon beurteilt hat (Entwurf, noch nicht gesendet). */
export function entwurfUrteile(w, id) {
  const d = w.entwuerfe.get(`urteil/${id}`);
  return d?.schritte ?? {};
}

/** „8 von 9 Schritten offen“ in Runde 2 und später, sonst „12 Schritte offen“. */
export function offenSatz(e) {
  const a = abnahmeSchritte(e);
  if (a.runde > 1) return `${a.offen.length} von ${a.schritte.length} ${a.schritte.length === 1 ? 'Schritt' : 'Schritten'} offen`;
  return `${schritteText(a.offen.length)} offen`;
}

function geschlossenAm(e, status) {
  for (let i = e.events.length - 1; i >= 0; i--) {
    const ev = e.events[i];
    if (ev.type === 'status' && ev.doc.get('Status') === status) return ulidZeit(ev.ulid);
  }
  return null;
}

/** Offene Sendungen (nicht gesendet) zu einem Eintrag aus der Warteschlange; die jüngste gilt. */
export const sendungZu = (w, id) => w.schlange.filter((s) => s.eintrag === id && s.zustand !== 'gesendet').sort((a, b) => (a.zeit ?? 0) - (b.zeit ?? 0)).at(-1) ?? null;

/**
 * Der Zustand in Worten: Symbol, Rolle der Farbe (s-…), Text und ob er fett steht. Eine Sendung aus der Warteschlange
 * oder ein Entwurf geht vor, weil sie sagt, was auf diesem Gerät geschieht (UOF-3). `ohneNetz` ergänzt „wartet auf Netz“.
 */
export function zustandVon(w, e, st, { ohneNetz = false } = {}) {
  const sendung = sendungZu(w, e.id);
  if (sendung) return { ...schlangeZeile(sendung, { ohneNetz, jetzt: w.jetzt }), chip: true };
  const kind = e.head.get('Kind');
  if (kind === 'test' && !geschlossen(st)) {
    const urteile = Object.keys(entwurfUrteile(w, e.id)).length;
    if (urteile) return { ...entwurfZeile(urteile, abnahmeSchritte(e).offen.length), chip: true };
  }
  const seit = zeitpunkt(st.created, w.jetzt);
  if (st.status === 'open') {
    if (istIdeeAnDich(e)) return { symbol: 'radio_button_unchecked-f', rolle: 's-neutral', text: `offen, in deiner Ideensammlung seit ${seit}` };
    if (imEingang(e)) return { symbol: 'schedule', text: `offen, im Eingang ohne Ziel seit ${seit}` };
    if (anDich(e)) {
      if (kind === 'question') return { symbol: 'schedule', stark: true, text: `wartet auf deine Antwort seit ${seit}` };
      if (kind === 'approval') return { symbol: 'schedule', stark: true, text: `wartet auf dein Ja seit ${seit}` };
      if (kind === 'test') return { symbol: 'schedule', stark: true, text: `wartet auf dein Urteil seit ${seit}, ${offenSatz(e)}` };
      return { symbol: 'schedule', text: `offen, für dich seit ${seit}` };
    }
    return { symbol: 'schedule', text: `offen, für ${adressText(adressen(e)) || 'alle'}` };
  }
  if (st.status === 'in_progress') {
    return { symbol: 'schedule', text: `in Arbeit bei ${sichtbar(st.holder ?? '?', true)}${st.until ? ` bis ${zeitpunkt(st.until, w.jetzt)}` : ''}` };
  }
  if (st.status === 'waiting') {
    const offen = st.conditions.find((b) => !b.met);
    const c = offen?.c;
    if (c?.kind === 'answered' || c?.kind === 'done') {
      const ziel = finde(w.eintraege, c.arg);
      const wer = ziel ? `${idMitStrich(ziel.id)}: ${sichtbar(ziel.head.title ?? '', true)}` : idMitStrich(c.arg);
      return { symbol: 'schedule', text: c.kind === 'answered' && ziel && anDich(ziel) ? `wartet auf deine Antwort zu ${idMitStrich(ziel.id)}` : `wartet auf ${wer}` };
    }
    if (c?.kind === 'date') return { symbol: 'schedule', text: `wartet bis ${c.arg}` };
    if (c?.kind === 'manual') return { symbol: 'schedule', text: `wartet auf Bestätigung: ${sichtbar(c.arg, true)}` };
    return { symbol: 'schedule', text: 'wartet' };
  }
  if (st.status === 'done') {
    const wann = geschlossenAm(e, 'done');
    const antwort = /^Antwort: (.*)$/s.exec(st.result ?? '')?.[1];
    if (kind === 'question' && antwort) return { symbol: 'check_circle', rolle: 's-ok', text: `beantwortet ${wann ? um(wann, w.jetzt) : ''}: ${sichtbar(antwort, true)}`.replace('  ', ' ') };
    return { symbol: 'check_circle', rolle: 's-ok', text: `erledigt ${wann ? um(wann, w.jetzt) : ''}`.trim() };
  }
  const wann = geschlossenAm(e, 'dropped');
  return { symbol: 'cancel-f', rolle: 's-neutral', text: `verworfen ${wann ? um(wann, w.jetzt) : ''}`.trim() };
}

/** Alles, was eine Karte der Liste und die Kopfkarte zeigen. */
export function karteVon(w, { e, st }, optionen = {}) {
  const kind = e.head.get('Kind');
  const von = absenderText(e.head.get('From'));
  const hosts = hostsVon(e);
  return {
    id: e.id, idText: idMitStrich(e.id), kind, art: artVon(kind), dringend: st.urgent, rang: st.priority,
    projekt: projektDes(e), an: kind === 'test' && hosts.length ? `an ${hosts.join(', ')}` : null,
    titel: sichtbar(e.head.title ?? '(ohne Titel)', true), von, zustand: zustandVon(w, e, st, optionen), status: st.status,
  };
}

/** Zahlen für die Übersicht und die Plakette der Leiste. */
export function zaehler(w) {
  const wartet = wartetListe(w);
  const abn = abnahmenListe(w);
  return {
    fuerDich: wartet.length, dringend: wartet.filter(({ st }) => st.urgent).length,
    eingang: eingangListe(w).length, ideen: ideenListe(w).length,
    abnahmen: abn.length, offeneSchritte: abn.reduce((n, { e }) => n + abnahmeSchritte(e).offen.length, 0),
  };
}

// ---- Alle: alle offenen Einträge, gefiltert, sortiert und gruppiert

export const stufeVon = (st) => (st.priority <= 1 ? 'hoch' : st.priority === 2 ? 'normal' : 'niedrig');
const statusVon = (e, st) => (wartetAufDich(e, st) ? 'dich' : st.status === 'in_progress' ? 'arbeit' : st.status === 'waiting' ? 'andere' : 'offen');
const OHNE_PROJEKT = 'ohne Projekt';

/**
 * Alle offenen Einträge für die Übersicht „Alle“, auch die, die nicht auf dich warten: je Eintrag die Karte (karteVon) mit
 * Lage (dich, arbeit, andere, offen; das ist der Status der Auswahl), Stufe (hoch, normal, niedrig), Alter in Kurzform, Anlagezeit und Rangschlüssel.
 * Ohne Reihenfolge; sie ergibt sich aus `gruppiere`.
 */
export function uebersichtModelle(w, optionen = {}) {
  return w.liste.filter(({ st }) => !geschlossen(st)).map((x) => ({
    ...karteVon(w, x, optionen), lage: statusVon(x.e, x.st), stufe: stufeVon(x.st), erstellt: x.st.created,
    alter: kurz(x.st.created, w.jetzt), rangSchluessel: w.buch.rangSchluessel(x.e),
  }));
}

/** Ein leerer Filter: keine Auswahl heißt alle; die Sortierung ist die Vorgabe (nach Projekt gruppiert). */
export const leererFilter = () => ({ status: [], projekt: [], art: [], prio: [], sortierung: 'projekt' });
/** Ist etwas gefiltert? Die Sortierung zählt nicht. */
export const hatFilter = (f) => ['status', 'projekt', 'art', 'prio'].some((d) => f[d].length);

const wertVon = {
  status: (m) => m.lage, projekt: (m) => m.projekt ?? '', art: (m) => m.kind,
};
const passtZu = (m, f, dim) => {
  if (!f[dim].length) return true;
  if (dim === 'prio') return f.prio.includes(m.stufe) || (m.dringend && f.prio.includes('dringend'));
  return f[dim].includes(wertVon[dim](m));
};

/** Die Einträge, die zum Filter passen; `ohne` lässt eine Dimension außer Acht (für die Zahlen in ihrer eigenen Auswahl). */
export const filtere = (modelle, f, ohne = null) => modelle.filter((m) => ['status', 'projekt', 'art', 'prio'].every((d) => d === ohne || passtZu(m, f, d)));

/**
 * Die Auswahl einer Dimension: [{ wert, text, n }]. `n` zählt die Einträge, die mit den anderen Filtern zu diesem Wert passen.
 * Projekte und Arten stehen nur, wenn es offene Einträge dazu gibt oder der Wert schon gewählt ist.
 */
export function auswahlOptionen(modelle, f, dim) {
  const rest = filtere(modelle, f, dim);
  const zahl = (test) => rest.filter(test).length;
  if (dim === 'status') return STATUS_WORTE.map((o) => ({ ...o, n: zahl((m) => m.lage === o.wert) }));
  if (dim === 'prio') return PRIO_WORTE.map((o) => ({ ...o, n: zahl((m) => (o.wert === 'dringend' ? m.dringend : m.stufe === o.wert)) }));
  if (dim === 'art') {
    return Object.keys(ARTEN).filter((k) => modelle.some((m) => m.kind === k) || f.art.includes(k))
      .map((k) => ({ wert: k, text: ARTEN[k].wort, n: zahl((m) => m.kind === k) }));
  }
  const namen = [...new Set([...modelle.map((m) => m.projekt ?? ''), ...f.projekt])].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'de')));
  return namen.map((n) => ({ wert: n, text: n || OHNE_PROJEKT, n: zahl((m) => (m.projekt ?? '') === n) }));
}

const nachRang = (a, b) => vergleiche(a.rangSchluessel, b.rangSchluessel);
const nachAlter = (a, b) => a.erstellt - b.erstellt || (a.id < b.id ? -1 : 1);

/**
 * Gruppen für die Liste: [{ wert, titel, eintraege, fuerDich }]. Die Sortierung nennt die Gruppe: projekt, prioritaet, art oder
 * status; innerhalb einer Gruppe gilt der Rang (Dringendes zuerst, dann die ältere Anlage). `alter-neu` und `alter-alt` ergeben
 * eine Gruppe ohne Titel. Leere Gruppen fehlen.
 */
export function gruppiere(modelle, sortierung = 'projekt') {
  const gruppe = (wert, titel, eintraege) => ({ wert, titel, eintraege, fuerDich: eintraege.filter((m) => m.lage === 'dich').length });
  const nach = (arten, schluessel, titelVon) => arten.map((a) => gruppe(a, titelVon(a), modelle.filter((m) => schluessel(m) === a).sort(nachRang))).filter((g) => g.eintraege.length);
  switch (sortierung) {
    case 'alter-neu': return modelle.length ? [gruppe('alle', null, [...modelle].sort((a, b) => nachAlter(b, a)))] : [];
    case 'alter-alt': return modelle.length ? [gruppe('alle', null, [...modelle].sort(nachAlter))] : [];
    case 'prioritaet': return nach(PRIO_WORTE.map((o) => o.wert), (m) => (m.dringend ? 'dringend' : m.stufe), (a) => PRIO_WORTE.find((o) => o.wert === a).text);
    case 'art': return nach(Object.keys(ARTEN), (m) => m.kind, (a) => ARTEN[a].wort);
    case 'status': return nach(STATUS_WORTE.map((o) => o.wert), (m) => m.lage, (a) => STATUS_WORTE.find((o) => o.wert === a).text);
    default: {
      const namen = [...new Set(modelle.map((m) => m.projekt ?? ''))].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'de')));
      return nach(namen, (m) => m.projekt ?? '', (n) => n || OHNE_PROJEKT);
    }
  }
}

/** Ist das eine Sortierung, die nach Projekt gruppiert (dann steht das Projekt nicht in der Zeile)? */
export const gruppiertNachProjekt = (sortierung) => sortierung === 'projekt';
/** Gültige Sortierungen: die Schlüssel in der Reihenfolge der Auswahl. */
export const SORTIERUNGEN = SORT_WORTE.map((o) => o.wert);

/** Gruppen der Abnahmen je Rechner: [{ host, abnahmen, offen, aelteste }], nach Name sortiert; ohne Rechner „ohne Rechner“. */
export function abnahmenNachRechner(w) {
  const gruppen = new Map();
  for (const eintrag of abnahmenListe(w)) {
    const host = hostsVon(eintrag.e)[0] ?? null;
    if (!gruppen.has(host)) gruppen.set(host, { host, eintraege: [] });
    gruppen.get(host).eintraege.push(eintrag);
  }
  return [...gruppen.values()]
    .map((g) => ({
      host: g.host, eintraege: g.eintraege,
      offen: g.eintraege.reduce((n, { e }) => n + abnahmeSchritte(e).offen.length, 0),
      aelteste: Math.min(...g.eintraege.map(({ st }) => st.created)),
    }))
    .sort((a, b) => (a.host ?? '￿').localeCompare(b.host ?? '￿', 'de'));
}

/**
 * Suche in Titel und ID, auch in erledigten und verworfenen Einträgen. Die ID versteht sich mit und ohne Strich und
 * mit den Verwechslungen o, i und l wie `norm_id` (Eingabe „TPC-0E0“ trifft tpc0e0). Eine Teil-ID zählt ab drei Zeichen.
 * Neueste zuerst; `grenze` kürzt die Liste, `gesamt` nennt die Zahl aller Treffer.
 */
export function suche(w, eingabe, grenze = 50) {
  const q = String(eingabe ?? '').trim();
  if (!q) return { treffer: [], gesamt: 0, abfrage: '' };
  const titel = q.toLowerCase();
  const kennung = normId(q);
  const alle = w.liste.filter(({ e }) => {
    if ((e.head.title ?? '').toLowerCase().includes(titel)) return true;
    const ids = [e.id, ...e.head.getall('Alias')];
    return ids.some((id) => id === kennung || (kennung.length >= 3 && id.includes(kennung)));
  }).sort(neueste);
  return { treffer: alle.slice(0, grenze), gesamt: alle.length, abfrage: q };
}

/** Der Faden eines Eintrags: Nachträge, Abschlüsse, Folgeaufträge und Sendungen dieses Geräts, nach Zeit. */
export function fadenVon(w, e) {
  const posten = [];
  for (const ev of e.events) {
    const d = ev.doc;
    const wer = absender(d) || '?';
    const zeit = ulidZeit(ev.ulid);
    if (ev.type === 'addendum') {
      const zeilen = [];
      const to = d.get('To');
      if (to && to.trim()) {
        const projekt = d.get('Project');
        zeilen.push(`Neu adressiert an ${adressText(to.split(',').map((s) => s.trim()).filter(Boolean))}${projekt ? ` (Projekt ${projekt})` : ''}.`);
      }
      if (d.get('Answer')) zeilen.push(`Antwort ${d.get('Answer')}`);
      if (d.get('Approval')) zeilen.push(d.get('Approval') === 'granted' ? 'Freigabe erteilt.' : 'Freigabe abgelehnt.');
      if (d.get('Verdict')) zeilen.push(`Gesamt: ${d.get('Verdict')}`);
      posten.push({ zeit, kopf: `Nachtrag von ${wer}`, wer, zeilen, text: d.body, extern: vertrauen(d) === 'external' });
    } else {
      const status = d.get('Status');
      const text = [d.get('Result'), d.get('Reason'), d.get('Note')].filter(Boolean).join(' ');
      if (status === 'done' || status === 'dropped' || (text && status !== 'in_progress')) {
        posten.push({ zeit, kopf: `${status === 'done' ? 'Erledigt' : status === 'dropped' ? 'Verworfen' : 'Vermerk'} von ${wer}`, wer, zeilen: text ? [text] : [], text: '', extern: false });
      }
    }
  }
  for (const k of w.kinder.get(e.id) ?? []) {
    posten.push({ zeit: w.buch.zustand(k).created, kopf: `Folgeauftrag ${idMitStrich(k.id)} von ${absender(k.head) || '?'}`, wer: absender(k.head), zeilen: [], text: k.head.title ?? '', einzeilig: true, extern: false, ziel: k.id });
  }
  for (const s of w.schlange.filter((x) => x.eintrag === e.id && x.zustand === 'gesendet')) {
    posten.push({ zeit: s.zeit ?? w.jetzt, kopf: `Nachtrag von ${s.von ?? 'diesem Gerät'}`, wer: s.von, zeilen: s.art === 'einsortieren' ? [`Neu adressiert an ${s.ziel === 'user' ? 'dich' : s.ziel}.`] : [], text: s.satz ?? '', gesendet: schlangeZeile(s, { jetzt: w.jetzt }).text, extern: false });
  }
  return posten.sort((a, b) => a.zeit - b.zeit);
}

/** Die Möglichkeiten einer Frage: Schlüssel, Text und ob der Text „(Empfehlung)“ trägt. */
export function moeglichkeiten(e) {
  const roh = e.head.get('Options');
  if (!roh) return [];
  return roh.split(' | ').map((teil, i) => {
    const m = /^([^\s:][^:]*?):\s+(.*)$/s.exec(teil.trim());
    let schluessel = String(i + 1);
    let text = teil.trim();
    if (m && m[1].length <= 12) { schluessel = m[1]; text = m[2]; }
    const empfehlung = /\s*\(Empfehlung\)\s*$/.test(text);
    return { schluessel, text: sichtbar(text.replace(/\s*\(Empfehlung\)\s*$/, ''), true), empfehlung };
  });
}

/** `Blocking: no (A)` sagt, womit die Sitzung ohne Antwort weiterarbeitet: Text in der Klammer oder null. */
export function annahmeVon(e) {
  const m = /^no\s*\((.*)\)\s*$/s.exec(e.head.get('Blocking') ?? '');
  return m ? sichtbar(m[1], true) : null;
}

/** Welche Handlungen bietet die Ansicht eines Eintrags? Jede hat einen Knopf (UGE-2, E13). */
export function handlungenVon(w, { e, st }) {
  const kind = e.head.get('Kind');
  if (geschlossen(st)) return [];
  if (kind === 'question' && wartetAufDich(e, st)) return ['antworten'];
  if (kind === 'test' && wartetAufDich(e, st)) return ['abnahme'];
  if (kind === 'approval') return [];   // Freigeben geht erst in Phase 4 (E5)
  if (istIdeeAnDich(e)) return [];       // Aktionen der Ideensammlung später (N7)
  if (imEingang(e)) return ['einsortieren'];
  if (anDich(e) && (kind === 'message' || kind === 'task' || kind === 'note' || kind === 'plan')) return ['antworten', 'erledigt'];
  return [];
}
