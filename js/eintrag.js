// Die Ansicht eines Eintrags: Kopfkarte, Hinweise, Text, Möglichkeiten, Faden, Quelle und die Aktionsleiste; dazu die Blätter
// Deine Antwort und Einsortieren. Jede Handlung, die welt.js (handlungenVon) nennt, hat hier einen Knopf (UGE-2, E13).
// Senden geht über die Schreibschicht (schreiben.js, `k.schreiben`): jede Handlung reiht eine Sendung ein, der Hinweis unten
// bietet zehn Sekunden Rückgängig an, danach geht sie raus. Fehlt die Schreibschicht (Tests), bleiben die Knöpfe gesperrt und
// ein Satz sagt warum. Nichts täuscht einen Erfolg vor: gesendet heißt nur, was GitHub angenommen hat.
import { el, ico } from './dom.js';
import { annahmeVon, fadenVon, handlungenVon, karteVon, moeglichkeiten, offenSatz, ortVon, abnahmeSchritte, sendungHaengt, sendungWartet, sendungZu, stufeVon } from './welt.js';
import { PRIO_WORTE, sendungText, sendungZustand } from './ansichtstexte.js';
import { fristKnoten } from './frist.js';
import { verwerfenKnopf } from './schlange.js';
import { idMitStrich } from './format.js';
import { vertrauen } from './zustand.js';
import { markdown } from './markdown.js';
import { sichtbar } from './urteil.js';
import { auswahl, band, feld, idSpan, knopf, kopfkarte, linkKnopf, platz } from './karten.js';
import { ohneStand, fehlerBand } from './ansichten.js';
import { kannSenden, SENDEN_FEHLT } from './schreiben.js';
import { absender } from './absenden.js';
import { URTEILE, zeitpunkt } from './ansichtstexte.js';
import { liesEntwurf, schluessel, speichereEntwurf } from './entwuerfe.js';
import { naechsterOffen } from './abnahme.js';
import { anhaengeAbschnitt } from './anhaengeansicht.js';
import { anhangWahl } from './anhangwahl.js';

/** Die ID im Wortlaut der Ansicht: „Abnahme k7m-2qa“. */
export const eintragsZeile = (art, id) => el('p', { class: 'eintragszeile' }, `${art} `, idSpan(idMitStrich(id)));

/** Der Eintrag liegt auch nach dem Abgleich nicht vor: sagt warum und führt zurück (ein Tipp auf eine Mitteilung endet hier, wenn der Eintrag fehlt). */
const fehltEintrag = (welt, id, z) => platz({
  bild: 'blau', symbol: 'search_off-f', titel: 'Eintrag nicht gefunden',
  saetze: z.fehler || z.ohneNetz
    ? [`Der Eintrag ${idMitStrich(id)} liegt noch nicht auf diesem Gerät. Der letzte Abgleich ist gescheitert.`, 'Gleiche in Mehr ab, sobald du Netz hast.']
    : [`Auch nach dem Abgleich liegt kein Eintrag ${idMitStrich(id)} auf diesem Gerät.`, 'Er wurde vielleicht verschoben oder gelöscht.'],
  knoepfe: [linkKnopf('Zu Wartet', '#wartet', { klasse: 'gefuellt', symbol: 'inbox' }), linkKnopf('Suchen', '#suche', { symbol: 'search' })],
});

/** Ein Link auf einen Eintrag, den dieses Gerät noch nicht kennt, während der erste Abgleich dieser Sitzung läuft. */
const ladeEintrag = () => platz({
  bild: 'blau', titel: 'Eintrag wird geladen',
  saetze: ['Die App gleicht gerade ab und sucht den Eintrag.'],
  fortschritt: { max: null, wert: 0, text: 'Abgleich läuft …', beschriftung: 'Eintrag wird geladen' },
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

/** Band zu einer Sendung dieses Geräts, die nicht durchging: Konflikt, Token, Recht oder Fehler (UOF-3); der Wortlaut kommt aus der Sendung. */
function sendungBand(welt, e, k, z) {
  const s = sendungZu(welt, e.id);
  if (!s) return null;
  if (sendungWartet(welt, s, z.ohneNetz)) {
    const w = sendungZustand(s, { ohneNetz: z.ohneNetz });
    const satz = s.art === 'anlegen' ? 'Der Eintrag liegt auf diesem Gerät und geht raus, sobald du online bist.' : `${sendungText(s)} geht raus, sobald du online bist.`;
    return band({ ton: 'warn', symbol: w.symbol, titel: 'Noch nicht gesendet', satz: s.warteArt === 'netz' || z.ohneNetz ? satz : [[...(w.satz ? [`${w.satz} `] : []), ...(w.bis ? ['Nächster Versuch ', fristKnoten(w.bis, welt.jetzt), '.'] : ['Ein neuer Versuch folgt.'])]],
      knoepfe: [verwerfenKnopf(s, k, { ziel: s.art === 'anlegen' ? '#wartet' : null })] });
  }
  if (!sendungHaengt(s)) return null;
  const verwerfen = verwerfenKnopf(s, k, { ziel: s.art === 'anlegen' ? '#wartet' : null });
  if (s.zustand === 'token') {
    return band({ ton: 'warn', symbol: 'key-f', titel: 'Token abgelaufen oder widerrufen', satz: 'GitHub lehnt das Token ab. Deine Eingabe bleibt auf diesem Gerät in der Schlange und geht mit einem neuen Token raus.', knoepfe: [linkKnopf('Neues Token eintragen', '#anmelden')] });
  }
  if (s.zustand === 'verboten') {
    return band({ ton: 'warn', symbol: 'key-f', titel: 'Token darf nicht schreiben', satz: 'GitHub erlaubt diesem Token nur das Lesen. Trage ein Token mit dem Recht Contents mit Lesen und Schreiben ein. Deine Eingabe bleibt in der Schlange.', knoepfe: [linkKnopf('Neues Token eintragen', '#anmelden'), verwerfen] });
  }
  if (s.zustand === 'fehler') {
    return band({ ton: 'fehler', symbol: 'error-f', titel: 'Nicht gesendet', satz: `${s.grund ?? 'GitHub hat die Sendung nicht angenommen.'} Deine Eingabe bleibt auf diesem Gerät.`,
      knoepfe: [knopf('Erneut senden', { gesperrt: !kannSenden(k), an: async () => { await k.schreiben.erneut(s.id); k.neuZeichnen(); } }), verwerfen] });
  }
  const text = s.art === 'einsortieren' ? `Trotzdem an ${s.ziel === 'user' ? 'dich' : s.ziel} senden` : 'Als Nachtrag senden';
  return band({
    ton: 'warn', symbol: 'warning-f', titel: s.titel ?? 'Schon bearbeitet', satz: s.grund ?? 'Ein anderes Gerät war schneller. Deine Eingabe wurde nicht gesendet.',
    knoepfe: [knopf(text, { gesperrt: !kannSenden(k), an: async () => { await k.schreiben.senden(s.id); k.neuZeichnen(); } }), verwerfen],
  });
}

const HANDLUNG = {
  antworten: (id) => linkKnopf('Antworten', `#eintrag/${id}/antworten`, { klasse: 'gefuellt' }),
  einsortieren: (id) => linkKnopf('Einsortieren', `#eintrag/${id}/einsortieren`, { klasse: 'gefuellt' }),
  bearbeiten: (id) => linkKnopf('Bearbeiten', `#eintrag/${id}/bearbeiten`, { klasse: 'text' }),
};

/** Ein Knopf je Handlung der Art; Senden gesperrt, solange es keine Schreibschicht gibt. Erledigt geht über `erledigen` (absenden.js). */
function aktionsLeiste(welt, eintrag, k, extra = [], erledigen = null) {
  const id = eintrag.e.id;
  const liste = handlungenVon(welt, eintrag);
  const knoepfe = [];
  for (const h of liste) {
    let b;
    if (h === 'antworten' || h === 'einsortieren' || h === 'bearbeiten') b = HANDLUNG[h](id);
    else if (h === 'erledigt') b = knopf('Erledigt', { klasse: 'tonal', gesperrt: !kannSenden(k), an: (ev) => erledigen?.los(false, ev.currentTarget) });
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
  if (!e) return { inhalt: [z.fertig === false ? ladeEintrag() : fehltEintrag(welt, o.id, z)] };
  const st = welt.buch.zustand(e);
  const eintrag = { e, st };
  const m = karteVon(welt, eintrag, { ohneNetz: z.ohneNetz });
  const kind = e.head.get('Kind');
  const extern = vertrauen(e.head) === 'external';
  const teile = [fehlerBand(welt, z, k), kopfkarte(m, { rangText: `Priorität ${PRIO_WORTE.find((p) => p.wert === stufeVon(st)).text}` })];
  teile.push(sendungBand(welt, e, k, z));
  const erledigen = handlungenVon(welt, eintrag).includes('erledigt') ? absender(() => k.schreiben.erledigen(e.id), () => k.ersetze('#wartet')) : null;
  if (erledigen) teile.push(erledigen.platz);
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
  teile.push(...anhaengeAbschnitt(welt, e, k));
  const quelle = e.head.get('Source');
  if (quelle) teile.push(el('h2', {}, 'Quelle'), el('p', { class: 'quelle' }, el('code', {}, sichtbar(quelle, true))));
  return { inhalt: teile, aktion: aktionsLeiste(welt, eintrag, k, extra, erledigen), titel: m.art.wort };
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

async function textFeld(k, entwurf, name, beschriftung, bei) {
  const t = el('textarea', { name, rows: 3, autocapitalize: 'sentences' });
  t.value = entwurf?.text ?? '';
  t.addEventListener('input', bei);
  return { feld: feld({ beschriftung, steuerung: t }), t };
}

/** Blatt Deine Antwort: die Möglichkeiten als Auswahl, darunter ein freier Text; Senden schickt die gewählte Möglichkeit und den Text. Gesperrt ohne Schreibschicht. */
export async function antwortBlatt(welt, k, o, schliessen) {
  const e = welt.eintraege.get(o.id);
  if (!e) return { koerper: [el('p', {}, 'Der Eintrag liegt nicht auf diesem Gerät.')], knoepfe: [knopf('Schließen', { klasse: 'text', an: schliessen })] };
  const gesperrt = !kannSenden(k);
  const liste = moeglichkeiten(e);
  const key = schluessel.antwort(e.id);
  const entwurf = await liesEntwurf(k.db, key);
  const koerper = [eintragsZeile(karteVon(welt, { e, st: welt.buch.zustand(e) }).art.wort, e.id)];
  if (gesperrt) koerper.push(band({ ton: 'info', symbol: 'info-f', satz: SENDEN_FEHLT }));
  let wahl = liste.some((m) => m.schluessel === entwurf?.wahl) ? entwurf.wahl : null;
  let text = null;
  const wert = () => ({ text: text.t.value, ...(wahl ? { wahl } : {}) });
  const fehlt = el('p', { class: 'neben satz', hidden: gesperrt }, liste.length ? 'Wähle eine Möglichkeit oder schreibe eine eigene Antwort.' : 'Schreibe eine Antwort.');
  let senden = null;
  const merken = () => {
    const leer = !text.t.value.trim() && !wahl;
    if (senden) senden.disabled = gesperrt || leer;
    fehlt.className = leer ? 'neben satz' : 'neben satz still';
    return speichereEntwurf(k.db, key, wert(), leer, k.jetzt());
  };
  const anhang = await anhangWahl(k, key, { gesperrt });
  const { platz: ablehnung, los } = absender(
    (opt) => k.schreiben.antworten(e.id, { wahl, text: text.t.value.trim(), anhaenge: anhang.liste(), entwurf: { schluessel: key, wert: wert() }, ...opt }),
    () => schliessen());
  if (liste.length) {
    // Radiogruppe nach dem ARIA-Muster: jede Zeile ist selbst das Radio (role, aria-checked), kein verstecktes Eingabefeld in einem
    // label; so liest eine Bedienhilfe den Zustand direkt von dem Knoten, den man sieht und antippt. Tab erreicht nur die gewählte
    // (sonst die erste) Zeile, Pfeile wählen die nächste, Leertaste und Eingabe wählen die Zeile im Fokus.
    const zeilen = liste.map((m) => el('div', { class: 'wahl', role: 'radio', 'data-wahl': m.schluessel, 'aria-checked': 'false', 'aria-disabled': gesperrt ? 'true' : false, tabindex: '-1' },
      el('span', { class: 'buchstabe' }, m.schluessel),
      el('span', { class: 'was' }, m.text, m.empfehlung ? el('span', { class: 'chip-rat' }, ico('check_circle-f'), 'Empfehlung') : null),
      ico('check_circle-f', 'an')));
    const zeigeWahl = () => {
      const eine = zeilen.some((z) => z.getAttribute('data-wahl') === wahl) ? wahl : zeilen[0].getAttribute('data-wahl');
      for (const z of zeilen) {
        z.setAttribute('aria-checked', String(z.getAttribute('data-wahl') === wahl));
        z.setAttribute('tabindex', !gesperrt && z.getAttribute('data-wahl') === eine ? '0' : '-1');
      }
    };
    const waehle = (z, fokus) => {
      if (gesperrt) return;
      wahl = z.getAttribute('data-wahl'); zeigeWahl(); merken();
      if (fokus) z.focus();
    };
    zeilen.forEach((z, i) => {
      z.addEventListener('click', () => waehle(z, false));
      z.addEventListener('keydown', (ev) => {
        if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
        const schritt = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[ev.key];
        if (schritt) waehle(zeilen[(i + schritt + zeilen.length) % zeilen.length], true);
        else if (ev.key === ' ' || ev.key === 'Enter') waehle(z, true);
        else return;
        ev.preventDefault();
      });
    });
    const gruppe = el('div', { class: 'antworten', role: 'radiogroup', 'aria-label': 'Möglichkeiten' }, zeilen);
    zeigeWahl();
    koerper.push(gruppe);
  }
  text = await textFeld(k, entwurf, 'antwort', liste.length ? 'Eigene Antwort' : 'Deine Antwort', merken);
  koerper.push(text.feld, anhang.platz, fehlt, ablehnung);
  senden = knopf('Senden', { klasse: 'gefuellt', gesperrt: gesperrt || (!wahl && !text.t.value.trim()), an: async (ev) => {
    if (!wahl && !text.t.value.trim()) return;
    await los(false, ev.currentTarget);
  } });
  fehlt.className = senden.disabled ? 'neben satz' : 'neben satz still';
  return { koerper, knoepfe: [knopf('Abbrechen', { klasse: 'text', an: schliessen }), senden] };
}

/** Blatt Einsortieren: Ziel (An dich oder ein Projekt) und ein freiwilliger Satz; Senden wartet auf ein Ziel. */
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
  const { platz: ablehnung, los } = absender(
    (opt) => k.schreiben.einsortieren(e.id, { ziel: ziel.value, satz: satz.value.trim(), entwurf: { schluessel: schluessel.einsortieren(e.id), wert: { ziel: ziel.value, satz: satz.value } }, ...opt }),
    () => schliessen());
  const senden = knopf('Senden', { klasse: 'gefuellt', gesperrt: gesperrt || !ziel.value, an: (ev) => (ziel.value ? los(false, ev.currentTarget) : undefined) });
  ziel.addEventListener('change', () => { senden.disabled = gesperrt || !ziel.value; sichern(); });
  satz.addEventListener('input', sichern);
  const koerper = [eintragsZeile(art.wort, e.id)];
  if (gesperrt) koerper.push(band({ ton: 'info', symbol: 'info-f', satz: SENDEN_FEHLT }));
  koerper.push(feld({ beschriftung: 'Wohin gehört der Eintrag?', steuerung: ziel }));
  if (!welt.projektNamen.length) koerper.push(el('p', { class: 'neben' }, 'Projekte fehlen noch. Gleiche in Mehr ab.'));
  koerper.push(feld({ beschriftung: 'Satz dazu (freiwillig)', steuerung: satz }), ablehnung);
  return { koerper, knoepfe: [knopf('Abbrechen', { klasse: 'text', an: schliessen }), senden], klasse: art.klasse };
}
