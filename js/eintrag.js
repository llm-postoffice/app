// Die Ansicht eines Eintrags: Kopfkarte, Hinweise, Text, Möglichkeiten, Faden, Quelle und die Aktionsleiste; dazu die Blätter
// Deine Antwort und Einsortieren. Jede Handlung, die welt.js (handlungenVon) nennt, hat hier einen Knopf (UGE-2, E13).
// Senden gehört zur Schreibschicht (Teil E): ohne sie bleiben die Knöpfe gesperrt, ein Satz sagt warum, und was der Nutzer
// eintippt, bleibt als Entwurf auf dem Gerät. Nichts davon täuscht einen Erfolg vor.
import { el, ico } from './dom.js';
import { annahmeVon, fadenVon, handlungenVon, karteVon, moeglichkeiten, offenSatz, ortVon, abnahmeSchritte, sendungZu } from './welt.js';
import { idMitStrich } from './format.js';
import { vertrauen } from './zustand.js';
import { markdown } from './markdown.js';
import { sichtbar } from './urteil.js';
import { auswahl, band, feld, idSpan, knopf, kopfkarte, linkKnopf, platz } from './karten.js';
import { ohneStand, fehlerBand } from './ansichten.js';
import { kannSenden, SENDEN_FEHLT } from './schreiben.js';
import { URTEILE, zeitpunkt } from './ansichtstexte.js';
import { liesEntwurf, loescheEntwurf, schluessel, speichereEntwurf } from './entwuerfe.js';
import { naechsterOffen } from './abnahme.js';

/** Die ID im Wortlaut der Ansicht: „Abnahme k7m-2qa“. */
export const eintragsZeile = (art, id) => el('p', { class: 'eintragszeile' }, `${art} `, idSpan(idMitStrich(id)));

const fehltEintrag = (welt, id) => platz({
  bild: 'blau', symbol: 'search_off-f', titel: 'Eintrag nicht gefunden',
  saetze: [`Ein Eintrag mit der ID ${idMitStrich(id)} liegt nicht auf diesem Gerät. Gleiche in Mehr ab oder suche den Eintrag.`],
  knoepfe: [linkKnopf('Suchen', '#suche', { symbol: 'search' })],
});

/** Text eines Eintrags oder Nachtrags als Markdown ohne HTML; von außen kommender Text steht als Zitat (USI-1). */
export function textBlock(text, extern = false) {
  if (!String(text ?? '').trim()) return null;
  const inhalt = markdown(sichtbar(text, false));
  if (!extern) return el('div', { class: 'text-block' }, inhalt);
  return el('div', { class: 'text-block' },
    el('p', { class: 'fremd-hinweis' }, 'Dieser Text stammt von außen und steht als Zitat. Links darin öffnest du auf eigene Verantwortung.'),
    el('blockquote', { class: 'zitat' }, inhalt));
}

function moeglichkeitenListe(e) {
  const liste = moeglichkeiten(e);
  if (!liste.length) return [];
  return [el('h2', {}, 'Möglichkeiten'), el('ul', { class: 'moeglichkeiten' }, liste.map((m) => el('li', {},
    el('span', { class: 'buchstabe' }, m.schluessel),
    el('span', { class: 'was' }, m.text, m.empfehlung ? el('span', { class: 'chip-rat' }, ico('check_circle-f'), 'Empfehlung') : null))))];
}

function fadenListe(welt, e) {
  const posten = fadenVon(welt, e);
  if (!posten.length) return [];
  return [el('h2', {}, 'Faden'), el('ul', { class: 'faden' }, posten.map((p) => {
    const kopf = el('span', { class: 'kopf-zeile' }, `${zeitpunkt(p.zeit, welt.jetzt)} · ${p.kopf}`);
    if (p.ziel) return el('li', {}, el('a', { class: 'folge', href: `#eintrag/${p.ziel}` }, kopf, el('span', {}, sichtbar(p.text, true))));
    return el('li', {}, kopf, ...p.zeilen.map((z) => el('p', { class: 'satz' }, sichtbar(z, true))), textBlock(p.text, p.extern),
      p.gesendet ? el('span', { class: 'neben gesendet' }, p.gesendet) : null);
  }))];
}

/** Band zu einer Sendung dieses Geräts, die nicht durchging: Konflikt oder Token (UOF-3); der Wortlaut kommt aus der Sendung. */
function sendungBand(welt, e, k) {
  const s = sendungZu(welt, e.id);
  if (!s || (s.zustand !== 'konflikt' && s.zustand !== 'token')) return null;
  const verwerfen = knopf('Verwerfen', { klasse: 'text', an: async () => { await k.db.entferne('schlange', s.id); k.neuZeichnen(); } });
  if (s.zustand === 'token') {
    return band({ ton: 'warn', symbol: 'key-f', titel: 'Token abgelaufen oder widerrufen', satz: 'GitHub lehnt das Token ab. Deine Eingabe bleibt auf diesem Gerät in der Schlange.', knoepfe: [linkKnopf('Neues Token eintragen', '#anmelden')] });
  }
  const text = s.art === 'einsortieren' ? `Trotzdem an ${s.ziel === 'user' ? 'dich' : s.ziel} senden` : 'Als Nachtrag senden';
  return band({
    ton: 'warn', symbol: 'warning-f', titel: s.titel ?? 'Schon bearbeitet', satz: s.grund ?? 'Ein anderes Gerät war schneller. Deine Eingabe wurde nicht gesendet.',
    knoepfe: [knopf(text, { gesperrt: !kannSenden(k), an: () => k.schreiben.senden(s.id) }), verwerfen],
  });
}

const HANDLUNG = {
  antworten: (id) => linkKnopf('Antworten', `#eintrag/${id}/antworten`, { klasse: 'gefuellt' }),
  einsortieren: (id) => linkKnopf('Einsortieren', `#eintrag/${id}/einsortieren`, { klasse: 'gefuellt' }),
};

/** Ein Knopf je Handlung der Art; Senden gesperrt, solange es keine Schreibschicht gibt. */
function aktionsLeiste(welt, eintrag, k, extra = []) {
  const id = eintrag.e.id;
  const liste = handlungenVon(welt, eintrag);
  const knoepfe = [];
  for (const h of liste) {
    let b;
    if (h === 'antworten' || h === 'einsortieren') b = HANDLUNG[h](id);
    else if (h === 'erledigt') b = knopf('Erledigt', { klasse: 'tonal', gesperrt: !kannSenden(k), an: () => k.schreiben.erledigen(id) });
    else if (h === 'abnahme') { b = extra[0]; }
    if (b) { b.dataset.handlung = h; knoepfe.push(b); }
  }
  if (!knoepfe.length) return null;
  const gesperrt = knoepfe.some((b) => b.disabled);
  return gesperrt ? [...knoepfe, el('p', { class: 'neben satz' }, SENDEN_FEHLT)] : knoepfe;
}

/** Abnahme als Eintrag: Schritte mit Urteil, darunter der Weg weiter. Das Beurteilen steht in ablauf.js. */
function abnahmeInhalt(welt, e, k) {
  const a = abnahmeSchritte(e);
  const entw = welt.entwuerfe.get(`urteil/${e.id}`)?.schritte ?? {};
  const nachste = naechsterOffen(a.offen, entw, 0);
  const erste = a.offen[0];
  const gesamt = el('p', { class: 'neben' }, a.offen.some((s) => !entw[s.n]) ? 'Gesamt wird FAIL, solange ein Schritt ohne Urteil bleibt.' : 'Alle Schritte haben ein Urteil. Sieh dir das Ergebnis an, ehe du sendest.');
  return { a, entw, nachste, erste, gesamt };
}

/** Der Inhalt der Ansicht Eintrag und ihre Aktionsleiste. */
export function eintragAnsicht(welt, z, k, o) {
  const e = welt.eintraege.get(o.id);
  const platzhalter = ohneStand(welt, z, k, { geladen: 'Eintrag wird geladen', nichtGeladen: 'Eintrag nicht geladen' });
  if (platzhalter) return { inhalt: platzhalter };
  if (!e) return { inhalt: [fehltEintrag(welt, o.id)] };
  const st = welt.buch.zustand(e);
  const eintrag = { e, st };
  const m = karteVon(welt, eintrag, { ohneNetz: z.ohneNetz });
  const kind = e.head.get('Kind');
  const extern = vertrauen(e.head) === 'external';
  const teile = [fehlerBand(welt, z, k), kopfkarte(m, { rangText: `Rang ${st.priority}` })];
  teile.push(sendungBand(welt, e, k));
  const wartetFrage = kind === 'question' && handlungenVon(welt, eintrag).includes('antworten');
  const annahme = wartetFrage ? annahmeVon(e) : null;
  if (annahme) teile.push(el('p', {}, `Ohne deine Antwort arbeitet die Sitzung mit Annahme ${annahme} weiter.`));
  if (ortVon(welt, e.id) === 'eingang') teile.push(el('p', {}, 'Der Eintrag hat kein Ziel. Er bleibt im Eingang, bis du ihn einsortierst.'));
  if (kind === 'approval' && st.status === 'open') {
    teile.push(band({ ton: 'info', symbol: 'lock-f', titel: 'Freigeben gibt es noch nicht', satz: 'Freigeben und Ablehnen gehen erst in Phase 4, mit deinem Passkey. Bis dahin gibst du am Rechner frei.' }));
  }
  teile.push(textBlock(e.head.body, extern));
  let extra = [];
  if (kind === 'test') {
    const t = abnahmeInhalt(welt, e, k);
    const weiter = t.nachste
      ? linkKnopf(`${Object.keys(t.entw).length ? 'Weiter mit' : 'Beginnen mit'} Schritt ${t.nachste.n}`, `#eintrag/${e.id}/schritt/${t.nachste.n}`, { klasse: 'gefuellt' })
      : linkKnopf('Ergebnis ansehen', `#eintrag/${e.id}/ergebnis`, { klasse: 'gefuellt' });
    extra = [weiter];
    teile.push(el('h2', {}, 'Schritte'), el('ul', { class: 'schritte' }, abnahmeSchritte(e).schritte.map((s) => schrittZeile(welt, e, s, t.entw))), t.gesamt);
    if (t.a.runde > 1) teile.push(el('p', { class: 'neben' }, `Runde ${t.a.runde}: ${offenSatz(e)}. Schritte mit PASS oder SKIP aus früheren Runden zählen nicht mehr.`));
  } else {
    teile.push(...moeglichkeitenListe(e));
  }
  teile.push(...fadenListe(welt, e));
  const quelle = e.head.get('Source');
  if (quelle) teile.push(el('h2', {}, 'Quelle'), el('p', { class: 'quelle' }, el('code', {}, sichtbar(quelle, true))));
  return { inhalt: teile, aktion: aktionsLeiste(welt, eintrag, k, extra), titel: m.art.wort };
}

/** Eine Zeile der Schrittliste: Nummer, Aktion, Urteil als Wort mit Symbol; frühere Runden zählen mit. */
function schrittZeile(welt, e, s, entw) {
  const a = abnahmeSchritte(e);
  const frueher = a.ergebnisse.get(s.n);
  const urteil = entw[s.n]?.wort ?? (a.offen.includes(s) ? null : frueher);
  const u = urteil ? URTEILE[urteil] : null;
  return el('li', {}, el('a', { class: 'schritt', href: `#eintrag/${e.id}/schritt/${s.n}` },
    el('span', { class: 'nr' }, String(s.n)), el('span', { class: 'was' }, sichtbar(s.title, true)),
    u ? el('span', { class: `urteil ${u.rolle}` }, ico(u.symbol), urteil)
      : el('span', { class: 'urteil offen s-neutral' }, ico('schedule'), 'offen')));
}

// ---- Blätter

async function textFeld(k, key, name, beschriftung, hinweis = null) {
  const t = el('textarea', { name, rows: 3, autocapitalize: 'sentences' });
  t.value = (await liesEntwurf(k.db, key))?.text ?? '';
  const sichern = () => speichereEntwurf(k.db, key, { text: t.value }, !t.value.trim(), k.jetzt());
  t.addEventListener('input', sichern);
  return { feld: feld({ beschriftung, steuerung: t, hinweis }), t, sichern };
}

/** Blatt Deine Antwort: die Möglichkeiten als Knöpfe, darunter ein freier Text. Gesperrt ohne Schreibschicht. */
export async function antwortBlatt(welt, k, o, schliessen) {
  const e = welt.eintraege.get(o.id);
  if (!e) return { koerper: [el('p', {}, 'Der Eintrag liegt nicht auf diesem Gerät.')], knoepfe: [knopf('Schließen', { klasse: 'text', an: schliessen })] };
  const gesperrt = !kannSenden(k);
  const liste = moeglichkeiten(e);
  const koerper = [eintragsZeile(karteVon(welt, { e, st: welt.buch.zustand(e) }).art.wort, e.id)];
  if (gesperrt) koerper.push(band({ ton: 'info', symbol: 'info-f', satz: SENDEN_FEHLT }));
  if (liste.length) {
    koerper.push(el('div', { class: 'antworten' }, liste.map((m) => {
      const b = el('button', { type: 'button', class: 'tonal', disabled: gesperrt, 'data-wahl': m.schluessel },
        el('span', { class: 'buchstabe' }, m.schluessel),
        el('span', { class: 'was' }, m.text, m.empfehlung ? el('span', { class: 'chip-rat' }, ico('check_circle-f'), 'Empfehlung') : null));
      b.addEventListener('click', async () => { await k.schreiben.antworten(e.id, { wahl: m.schluessel }); await loescheEntwurf(k.db, schluessel.antwort(e.id)); schliessen(); });
      return b;
    })));
  }
  const { feld: f, t } = await textFeld(k, schluessel.antwort(e.id), 'antwort', liste.length ? 'Eigene Antwort' : 'Deine Antwort');
  koerper.push(f);
  const senden = knopf('Senden', { klasse: 'gefuellt', gesperrt: gesperrt, an: async () => {
    if (!t.value.trim()) return;
    await k.schreiben.antworten(e.id, { text: t.value.trim() });
    await loescheEntwurf(k.db, schluessel.antwort(e.id));
    schliessen();
  } });
  return { koerper, knoepfe: [knopf('Abbrechen', { klasse: 'text', an: schliessen }), senden] };
}

/** Blatt Einsortieren: Ziel (An dich oder ein Projekt) und ein freiwilliger Satz. */
export async function einsortierenBlatt(welt, k, o, schliessen) {
  const e = welt.eintraege.get(o.id);
  if (!e) return { koerper: [el('p', {}, 'Der Eintrag liegt nicht auf diesem Gerät.')], knoepfe: [knopf('Schließen', { klasse: 'text', an: schliessen })] };
  const gesperrt = !kannSenden(k);
  const art = karteVon(welt, { e, st: welt.buch.zustand(e) }).art;
  const entwurf = await liesEntwurf(k.db, schluessel.einsortieren(e.id));
  const ziel = auswahl({
    name: 'ziel', wert: entwurf?.ziel ?? '', platzhalter: 'Ziel wählen',
    gruppen: [{ titel: 'An dich', optionen: [{ wert: 'user', text: 'An dich' }] },
      ...(welt.projektNamen.length ? [{ titel: `Projekte (${welt.projektNamen.length})`, optionen: welt.projektNamen.map((p) => ({ wert: p, text: p })) }] : [])],
  });
  const satz = el('textarea', { name: 'satz', rows: 1, autocapitalize: 'sentences' });
  satz.value = entwurf?.satz ?? '';
  const sichern = () => speichereEntwurf(k.db, schluessel.einsortieren(e.id), { ziel: ziel.value, satz: satz.value }, !ziel.value && !satz.value.trim(), k.jetzt());
  ziel.addEventListener('change', sichern);
  satz.addEventListener('input', sichern);
  const koerper = [eintragsZeile(art.wort, e.id)];
  if (gesperrt) koerper.push(band({ ton: 'info', symbol: 'info-f', satz: SENDEN_FEHLT }));
  koerper.push(feld({ beschriftung: 'Wohin gehört der Eintrag?', steuerung: ziel }));
  if (!welt.projektNamen.length) koerper.push(el('p', { class: 'neben' }, 'Projekte fehlen noch. Gleiche in Mehr ab.'));
  koerper.push(feld({ beschriftung: 'Satz dazu (freiwillig)', steuerung: satz }));
  const senden = knopf('Senden', { klasse: 'gefuellt', gesperrt, an: async () => {
    if (!ziel.value) { ziel.focus(); return; }
    await k.schreiben.einsortieren(e.id, { ziel: ziel.value, satz: satz.value.trim() });
    await loescheEntwurf(k.db, schluessel.einsortieren(e.id));
    schliessen();
  } });
  return { koerper, knoepfe: [knopf('Abbrechen', { klasse: 'text', an: schliessen }), senden], klasse: art.klasse };
}
