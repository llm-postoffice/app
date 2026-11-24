// Die Dateien einer Sendung: was die App ins Datenrepo schreibt, Zeichen für Zeichen wie das Postwerkzeug (`answer`,
// `new`, `route`, `done`, `addendum`). Reine Funktionen ohne Browser und ohne Netz: tests/schreiben.test.mjs vergleicht
// sie mit den gemeinsamen Testfällen (Abschnitt write) und tests/mockgithub.test.mjs mit dem Postwerkzeug selbst.
// Jede Funktion gibt { dateien: [{ pfad, inhalt }], nachricht, eingaben, ... } zurück; `eingaben` sind die Texte, die der
// Nutzer getippt hat (für den Hinweis der Prüfung), `nachricht` ist der Text des Commits.
//
// ctx: { stempel, ulid, vergeben }  stempel ist `user, GERÄT, ZEIT`, ulid() liefert die nächste ULID, vergeben ist die
//      Menge der schon benutzten IDs (neue IDs kommen nie doppelt).
import { Doc, idMitStrich } from './format.js';
import { Fehler, folgeausgang, fruehereErgebnisse, leseAntwort, leseSchritte, sichtbar } from './urteil.js';
import { geheimnisTreffer, personenTreffer } from './pruefen.js';
import { neueId } from './erzeugen.js';
import { adressListe, projektDes, wirksamerKopf, absender } from './zustand.js';
import { ANHANG_MAX, anhangTexte, basisGroesse, groessenWort, nameGueltig } from './anhaenge.js';

const PROSA = ['Options', 'Blocking', 'Result', 'Reason', 'Note'];
/** Wie lang eine Zeile im Feld Result höchstens wird (_short im Werkzeug). */
const KURZ = 200;

/** render_doc: Titel, Kopfzeilen und Text; `behalte` setzt andere Kopfzeilen als Leerzeile (nur für die Prüfung). */
export function render(doc, behalte = null) {
  let aus = '';
  if (doc.title !== null && doc.title !== undefined) aus += `# ${doc.title}\n\n`;
  for (const [k, v] of doc.fields) aus += !behalte || behalte.includes(k) ? `- ${k}: ${v}\n` : '\n';
  if (doc.body) aus += doc.fields.length || (doc.title !== null && doc.title !== undefined) ? `\n${doc.body}\n` : `${doc.body}\n`;
  return aus;
}

const doc = (felder, text = '', titel = null) => new Doc(titel, felder, text);

/**
 * Prüft die Anhänge wie load_attachments des Werkzeugs (Namen, Dubletten, 1 MiB) und gibt sie zurück; sie sind
 * [{ name, groesse, typ, daten }] mit Base64 in `daten`. Das Feld Attachments (attachments_field) nennt die Namen in dieser Reihenfolge.
 */
function anhaengeGeprueft(anhaenge) {
  const gesehen = new Set();
  for (const a of anhaenge ?? []) {
    if (!nameGueltig(a.name)) throw new Fehler(`Anhang ${sichtbar(a.name, true)}: der Dateiname ist nicht zulässig`, 2);
    if (gesehen.has(a.name)) throw new Fehler(`Anhang ${sichtbar(a.name, true)} kommt zweimal vor`, 2);
    gesehen.add(a.name);
    const n = basisGroesse(a.daten);
    if (n > ANHANG_MAX) throw new Fehler(`Anhang ${sichtbar(a.name, true)} ist ${groessenWort(n)} groß; erlaubt sind höchstens ${groessenWort(ANHANG_MAX)}`, 2);
  }
  return anhaenge ?? [];
}
/** Die Dateien der Anhänge unter `ordner`: Inhalt als Base64, die Bytes bleiben, wie sie sind. */
const anhangDateien = (ordner, anhaenge) => anhaenge.map((a) => ({ pfad: `${ordner}/${a.name}`, base64: a.daten }));
const mitAnhangFeld = (felder, anhaenge) => (anhaenge.length ? [...felder, ['Attachments', anhaenge.map((a) => a.name).join(', ')]] : felder);

/** Text wie read_text_input: Zeilenenden \n, Umbrüche an den Enden weg. */
export const normText = (s) => String(s ?? '').replace(/\r\n?/g, '\n').replace(/^\n+|\n+$/g, '');

/** _short: eine Zeile, Steuerzeichen sichtbar, nach n Zeichen mit … gekürzt (Zeichen nach Unicode, nicht UTF-16). */
export function kurz(text, n = 60) {
  const z = Array.from(sichtbar(text ?? '', true));
  return z.length <= n ? z.join('') : `${z.slice(0, n - 1).join('')}…`;
}

export const pfadEintrag = (id) => `entries/${id.slice(0, 2)}/${id}`;
const ereignis = (id, ulid, art) => `${pfadEintrag(id)}/${ulid}-${art}.md`;
const datei = (pfad, d) => ({ pfad, inhalt: render(d) });

/** Möglichkeiten einer Frage als { wahl, text } (option_choices: Schlüssel vor dem Doppelpunkt, sonst die Nummer). */
export function moeglichkeitenRoh(e) {
  const aus = [];
  (e.head.get('Options') ?? '').split(/\s*\|\s*/).forEach((t, i) => {
    const text = t.trim();
    if (!text) return;
    const m = /^(\S{1,12}):\s/.exec(text);
    aus.push({ wahl: m ? m[1] : String(i + 1), text });
  });
  return aus;
}

// ---- Antwort auf eine Frage oder einen anderen Eintrag

/**
 * Antwort auf eine Frage (`answer ID --option A`, Text auf stdin) oder, bei jeder anderen Art und mit `nachtrag`, ein Nachtrag
 * (`addendum`). Frage: Nachtrag mit `Answer` und Text, dazu die Statusdatei `done`. `nachtrag` (Als Nachtrag senden, wenn
 * die Frage schon beantwortet ist) schreibt allein den Text, ohne Answer und ohne Status.
 */
export function antwortDateien(ctx, e, { wahl = null, text = '', nachtrag = false, anhaenge: roh = [] } = {}) {
  const anhaenge = anhaengeGeprueft(roh);
  const kind = e.head.get('Kind');
  const t = normText(text);
  const gewaehlt = wahl ? moeglichkeitenRoh(e).find((m) => m.wahl.toLowerCase() === String(wahl).toLowerCase())?.text ?? null : null;
  if (wahl && gewaehlt === null) throw new Fehler(`„${sichtbar(wahl, true)}“ ist keine Möglichkeit von ${idMitStrich(e.id)}`, 2);
  if (kind !== 'question' || nachtrag) {
    const koerper = kind === 'question' && gewaehlt ? `Antwort ${gewaehlt}${t ? `\n\n${t}` : ''}` : t;
    if (!koerper) throw new Fehler('Der Nachtrag braucht Text', 2);
    const u = ctx.ulid();
    const d = doc(mitAnhangFeld([['By', ctx.stempel]], anhaenge), koerper);
    return {
      dateien: [datei(ereignis(e.id, u, 'addendum'), d), ...anhangDateien(`${pfadEintrag(e.id)}/attachments/${u}`, anhaenge)],
      nachricht: `post: addendum ${e.id}`, eingaben: [{ wo: 'Text', text: t }, ...anhangTexte(anhaenge)], pruef: d,
    };
  }
  if (!gewaehlt && !t) throw new Fehler('Die Antwort braucht eine Möglichkeit oder einen Text', 2);
  // Die Anhänge gehören zum Nachtrag mit der Antwort, nicht zur Statusdatei: ihre ULID ist die des Nachtrags (answer im Werkzeug)
  const u = ctx.ulid();
  const d = doc(mitAnhangFeld([['By', ctx.stempel], ...(gewaehlt ? [['Answer', gewaehlt]] : [])], anhaenge), t);
  const gegeben = gewaehlt ?? kurz(t.split('\n')[0], KURZ);
  const status = doc([['By', ctx.stempel], ['Status', 'done'], ['Result', `Antwort: ${gegeben}`]]);
  return {
    dateien: [datei(ereignis(e.id, u, 'addendum'), d), ...anhangDateien(`${pfadEintrag(e.id)}/attachments/${u}`, anhaenge), datei(ereignis(e.id, ctx.ulid(), 'status'), status)],
    nachricht: `post: answer ${e.id}`, eingaben: [{ wo: 'Text', text: t }, ...anhangTexte(anhaenge)], pruef: d,
  };
}

/** Erledigt: die Statusdatei `done` mit einem Ergebnis (`done ID RESULT`). */
export function erledigtDateien(ctx, e, ergebnis = 'Erledigt in der App') {
  const status = doc([['By', ctx.stempel], ['Status', 'done'], ['Result', ergebnis]]);
  return { dateien: [datei(ereignis(e.id, ctx.ulid(), 'status'), status)], nachricht: `post: done ${e.id}`, eingaben: [], pruef: status };
}

/**
 * Priorität und Dringlichkeit ändern (`rank ID --priority N [--urgent|--no-urgent]`): eine Statusdatei ohne `Status`, nur mit
 * den Feldern, die sich ändern. `st` ist der Zustand des Eintrags; ändert sich nichts, gibt es keine Datei.
 */
export function rangDateien(ctx, e, st, { rang = null, dringend = null } = {}) {
  if (rang === null && dringend === null) throw new Fehler('rank braucht eine Priorität oder die Dringlichkeit', 2);
  if (rang !== null && ![1, 2, 3].includes(Number(rang))) throw new Fehler('Die Priorität ist 1 (Hoch), 2 (Normal) oder 3 (Niedrig)', 2);
  const felder = [['By', ctx.stempel]];
  if (rang !== null && Number(rang) !== st.priority) felder.push(['Priority', String(Number(rang))]);
  if (dringend !== null && Boolean(dringend) !== st.urgent) felder.push(['Urgent', dringend ? 'yes' : 'no']);
  const d = doc(felder);
  if (felder.length === 1) return { dateien: [], nachricht: `post: rank ${e.id}`, eingaben: [], pruef: d, unveraendert: true };
  return { dateien: [datei(ereignis(e.id, ctx.ulid(), 'status'), d)], nachricht: `post: rank ${e.id}`, eingaben: [], pruef: d };
}

/** Verwerfen (`drop ID GRUND`): die Statusdatei `dropped` mit Grund (erste Zeile) und dem Rest als Text. Ohne Grund Fehler. */
export function verwerfenDateien(ctx, e, grund) {
  const t = normText(grund).trim();
  if (!t) throw new Fehler('Der Grund fehlt', 2);
  const [erste, ...rest] = t.split('\n');
  const d = doc([['By', ctx.stempel], ['Status', 'dropped'], ['Reason', erste.trim()]], rest.join('\n').replace(/^\n+|\n+$/g, ''));
  return { dateien: [datei(ereignis(e.id, ctx.ulid(), 'status'), d)], nachricht: `post: drop ${e.id}`, eingaben: [{ wo: 'Grund', text: t }], pruef: d };
}

// ---- Abnahme

function antwortKoerper(a, runde) {
  const zeilen = [`Abnahme Runde ${runde}: ${a.verdict}${a.reason ? `, ${a.reason}` : ''}`];
  for (const [n, [wort, rest]] of a.steps) {
    zeilen.push(`${n}: ${wort || 'nicht ausgeführt'}${rest ? ` ${rest}` : ''}`);
    zeilen.push(...(a.notes.get(n) ?? []));
  }
  if (a.free) zeilen.push('', 'Anmerkung:', a.free);
  return zeilen.join('\n');
}

function folgeKoerper(e, a, runde, schritte) {
  const nach = new Map(schritte.map((s) => [s.n, s]));
  const aus = [`Abnahme ${e.id} „${sichtbar(e.head.title ?? '', true)}“, Runde ${runde}: FAIL${a.reason ? `, ${a.reason}` : ''}.`, ''];
  const gelistet = new Set(folgeausgang(a).follow_up_steps);
  for (const [n, [wort, rest]] of a.steps) {
    if (!gelistet.has(n)) continue;
    const s = nach.get(n);
    aus.push(`${n}. ${s.title}`);
    aus.push(...s.lines.map((x) => `   ${x}`));
    aus.push(`   Erwartet: ${s.expect || '-'}`);
    aus.push(`   Ergebnis: ${wort || 'nicht ausgeführt'}${rest ? ` ${rest}` : ''}`);
    if (a.notes.get(n)?.length) { aus.push('   Ausgabe:'); aus.push(...a.notes.get(n).map((x) => `     ${x.trim()}`)); }
    aus.push('');
  }
  if (a.free) aus.push('Anmerkung:', a.free, '');
  aus.push(`Danach kommt die Abnahme ${e.id} mit den offenen Schritten zu dir zurück; vorher in einem Nachtrag zu ${e.id} sagen, was sich geändert hat.`);
  return aus.join('\n');
}

/**
 * Antwort auf eine Abnahme (`answer ID`, die ausgefüllte Vorlage auf stdin): Nachtrag mit Verdict, Round und Step, dazu
 * bei PASS die Statusdatei `done`, bei FAIL der Folgeauftrag (E3) mit `Parent`, die Statusdatei `waiting` mit der
 * Bedingung `done:ID` und alles im selben Commit. `st` ist der Zustand des Eintrags (für den Rang des Folgeauftrags).
 * Wirft Fehler, wenn die Antwort das Werkzeug nicht annähme. `nachtrag` schreibt allein den Antworttext als Nachtrag.
 */
export function urteilDateien(ctx, e, st, antwortText, { nachtrag = false } = {}) {
  const text = normText(antwortText);
  if (nachtrag) {
    if (!text) throw new Fehler('Der Nachtrag braucht Text', 2);
    const d = doc([['By', ctx.stempel]], text);
    return { dateien: [datei(ereignis(e.id, ctx.ulid(), 'addendum'), d)], nachricht: `post: addendum ${e.id}`, eingaben: [{ wo: 'Anmerkung', text }], pruef: d };
  }
  const { schritte } = leseSchritte(e.head.body);
  const { ergebnisse, runden } = fruehereErgebnisse(e);
  const runde = runden + 1;
  const a = leseAntwort(text, schritte, ergebnisse);
  const felder = [['By', ctx.stempel], ['Verdict', a.verdict], ['Round', String(runde)]];
  for (const [n, [wort]] of a.steps) if (wort) felder.push(['Step', `${n} ${wort}`]);
  const d = doc(felder, antwortKoerper(a, runde));
  const aus = folgeausgang(a);
  const dateien = [datei(ereignis(e.id, ctx.ulid(), 'addendum'), d)];
  let folgeId = null;
  let status;
  if (aus.follow_up) {
    let titel = `Abnahme ${e.id}, Runde ${runde}: ${aus.failed.length ? `Schritt ${aus.failed.join(', ')} nicht bestanden` : 'nicht bestanden'}`;
    titel = `${titel}: ${sichtbar(e.head.title ?? '', true)}`;
    const z = Array.from(titel);
    if (z.length > 120) titel = `${z.slice(0, 119).join('')}…`;
    const projekt = projektDes(e);
    const fragende = absender(e.head);
    let an = projekt ? `project:${projekt}` : fragende;
    // Die Sitzung, die die Abnahme anlegte, bekommt den Folgeauftrag auch (save_answer im Postwerkzeug). Die App antwortet nie
    // selbst als Sitzung, darum entfällt dort der Vergleich mit der antwortenden Sitzung.
    if (/^session:\S+$/.test(fragende) && fragende !== an) an = `${an}, ${fragende}`;
    const kopf = [['Kind', 'task'], ['To', an], ...(projekt ? [['Project', projekt]] : []), ['From', ctx.stempel]];
    if (aus.label) kopf.push(['Labels', aus.label]);
    if (st.priority !== 2) kopf.push(['Priority', String(st.priority)]);
    kopf.push(['Parent', e.id]);
    folgeId = neueId(ctx.vergeben, ctx.zufall);
    dateien.push(datei(`${pfadEintrag(folgeId)}/0-entry.md`, doc(kopf, folgeKoerper(e, a, runde, schritte), titel)));
    status = doc([['By', ctx.stempel], ['Status', 'waiting'], ['Condition', `done:${folgeId}`], ['Note', `Runde ${runde}: FAIL, Folgeauftrag ${folgeId}`]]);
  } else {
    const woerter = [...a.steps.values()].map(([w]) => w);
    const bestanden = woerter.filter((w) => w === 'PASS').length;
    const uebersprungen = woerter.filter((w) => w === 'SKIP').length;
    status = doc([['By', ctx.stempel], ['Status', 'done'], ['Result', `Abnahme bestanden in Runde ${runde}: ${bestanden} PASS${uebersprungen ? `, ${uebersprungen} SKIP` : ''}`]]);
  }
  dateien.push(datei(ereignis(e.id, ctx.ulid(), 'status'), status));
  const eingaben = [...a.steps].filter(([, [, rest]]) => rest).map(([n, [, rest]]) => ({ wo: `Schritt ${n}`, text: rest }));
  if (a.free) eingaben.push({ wo: 'Anmerkung', text: a.free });
  return { dateien, nachricht: `post: answer ${e.id}: ${a.verdict}${folgeId ? `, new ${folgeId}` : ''}`, eingaben, pruef: d, folgeId, runde, verdict: a.verdict };
}

// ---- Neu adressieren

/** Das Projekt nach dem Neuadressieren (routed_project): genanntes Projekt, sonst das aus `project:NAME`, sonst das alte. */
function projektNach(alt, to, genannt) {
  const aus = (genannt ?? '').trim();
  if (aus) return aus;
  for (const a of to) if (a.startsWith('project:')) return a.slice(8).split('/')[0];
  return alt;
}

/**
 * Nachtrag mit `To` und, wenn sich das Projekt ändert oder genannt wird, `Project` (`route ID --to … [--project NAME]
 * [--reason TEXT]`). Wirksam ist der letzte Nachtrag mit `To` (wirksamerKopf). Ist nichts neu, gibt es keine Datei.
 */
export function routeDateien(ctx, e, { to, project = null, reason = '' }) {
  if (!to?.length) throw new Fehler('route braucht eine Adresse', 2);
  if (to.includes('all')) throw new Fehler('Neu adressieren geht nicht an all', 2);
  const vorher = wirksamerKopf(e);
  const altTo = adressListe(vorher);
  const altProjekt = vorher.get('Project') || (altTo.find((a) => a.startsWith('project:')) ?? '').slice(8).split('/')[0] || null;
  const neuProjekt = projektNach(altProjekt, to, project);
  const gleich = [...altTo].map((a) => a.toLowerCase()).sort().join(',') === [...to].map((a) => a.toLowerCase()).sort().join(',') && neuProjekt === altProjekt;
  const grund = normText(reason);
  const felder = [['By', ctx.stempel], ['To', to.join(', ')]];
  if (neuProjekt && (project || neuProjekt !== altProjekt)) felder.push(['Project', neuProjekt]);
  const d = doc(felder, grund);
  if (gleich) return { dateien: [], nachricht: `post: route ${e.id}`, eingaben: [], pruef: d, unveraendert: true };
  return { dateien: [datei(ereignis(e.id, ctx.ulid(), 'addendum'), d)], nachricht: `post: route ${e.id}`, eingaben: [{ wo: 'Satz', text: grund }], pruef: d };
}

// ---- Neuer Eintrag

export const ARTEN_NEU = ['task', 'bug', 'idea', 'plan', 'question', 'approval', 'test', 'message', 'note'];
const BRAUCHT_TEXT = ['question', 'approval', 'test', 'message', 'plan'];

/** Die Prüfung vor dem Anlegen (nicht die auf Geheimnisse): Titel und Text wie das Werkzeug sie verlangt. */
export function pruefeNeu({ art, titel, text }) {
  const t = String(titel ?? '').trim();
  if (!t) return { titel: 'Gib einen Titel ein.' };
  if (Array.from(t).length > 120) return { titel: `Der Titel hat ${Array.from(t).length} Zeichen; erlaubt sind höchstens 120.` };
  if (/[\r\n]/.test(t)) return { titel: 'Der Titel steht in einer Zeile.' };
  if (BRAUCHT_TEXT.includes(art) && !normText(text)) return { text: 'Diese Art braucht einen Text.' };
  return null;
}

/**
 * Neuer Eintrag (`new KIND TITEL --to … [--priority N] [--urgent]`): `0-entry.md` mit Kind, To, Project, From, Priority und
 * Urgent. `an` ist `user`, ein Projektname oder null (Eingang). Rang 2 ist die Vorgabe und bleibt weg. Kein Eintrag
 * trägt eine Bedingung, Quelle oder Optionen: die App erfasst von Hand.
 */
export function anlegenDateien(ctx, { art, titel, an = null, text = '', rang = 2, dringend = false, anhaenge: roh = [] }) {
  const f = pruefeNeu({ art, titel, text });
  if (f) throw new Fehler(Object.values(f)[0], 2);
  const anhaenge = anhaengeGeprueft(roh);
  const t = normText(text);
  const id = neueId(ctx.vergeben, ctx.zufall);
  const felder = [['Kind', art]];
  if (an === 'user') felder.push(['To', 'user']);
  else if (an) felder.push(['To', `project:${an}`], ['Project', an]);
  felder.push(['From', ctx.stempel]);
  if (rang && Number(rang) !== 2) felder.push(['Priority', String(rang)]);
  if (dringend) felder.push(['Urgent', 'yes']);
  const d = doc(felder, t, String(titel).trim());
  return {
    dateien: [datei(`${pfadEintrag(id)}/0-entry.md`, d), ...anhangDateien(`${pfadEintrag(id)}/attachments`, anhaenge)],
    nachricht: `post: new ${id}: ${String(titel).trim()}`, eingaben: [{ wo: 'Titel', text: String(titel).trim() }, { wo: 'Text', text: t }, ...anhangTexte(anhaenge)], pruef: d, id,
  };
}

// ---- Prüfung auf Geheimnisse und Personendaten

/** Welche Teile der Datei sind Eingaben des Nutzers? Der Hinweis nennt „im Titel“ statt einer Zeile der Datei. */
const WO = (wo) => (wo === 'Titel' ? 'im Titel' : wo === 'Text' ? 'im Text' : wo === 'Satz' ? 'in deinem Satz' : wo === 'Anmerkung' ? 'in der Anmerkung' : wo === 'Grund' ? 'im Grund'
  : wo === 'Name des Anhangs' ? 'im Namen eines Anhangs' : wo.startsWith('Anhang ') ? `im ${wo}` : `in ${wo}`);

/**
 * Prüft eine Sendung vor dem Senden: Geheimnisse blockieren immer, Personendaten nur, solange der Nutzer sie nicht freigibt.
 * Das Werkzeug sucht Geheimnisse in der ganzen Datei und Personendaten in Titel, Text und den Kopfzeilen mit Fließtext;
 * die App tut dasselbe mit der Hauptdatei (`pruef`) und nennt, wo es geht, den Teil, den der Nutzer geschrieben hat.
 * Ergebnis: { geheimnisse: [{ wo, zeile, art }], personen: [{ wo, zeile, art }] }; nie ein Wert.
 */
export function pruefeSendung(sendung) {
  const treffer = (finder, text) => finder(text).map(([zeile, art]) => ({ zeile, art }));
  const ordne = (liste, finder, ohneNamen = false) => {
    const aus = [];
    for (const { wo, text, nurGeheimnis } of sendung.eingaben ?? []) {
      if (ohneNamen && nurGeheimnis) continue;   // der Name eines Anhangs geht nur durch die Prüfung auf Geheimnisse
      for (const t of treffer(finder, text)) aus.push({ wo: WO(wo), ...t });
    }
    return aus;
  };
  let geheimnisse = ordne(sendung.eingaben, geheimnisTreffer);
  if (!geheimnisse.length) {
    const rest = treffer(geheimnisTreffer, render(sendung.pruef));
    geheimnisse = rest.map((t) => ({ wo: 'in der Antwort', ...t }));
  }
  let personen = ordne(sendung.eingaben, personenTreffer, true);
  if (!personen.length) personen = treffer(personenTreffer, render(sendung.pruef, PROSA)).map((t) => ({ wo: 'in der Antwort', ...t }));
  return { geheimnisse, personen };
}
