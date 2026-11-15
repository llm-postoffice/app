// Abnahme Schritt für Schritt: ein Schritt je Bildschirm mit Aktion, Befehl, Erwartetem und vier Urteilen, ein Blatt für den
// Satz bei FAIL, BLOCKED und SKIP, und das Ergebnis vor dem Senden. Die Urteile liegen als Entwurf auf dem Gerät
// (entwuerfe.js) und überstehen Zurück, Neuladen und das Ende der App; gesendet wird mit **Antwort senden** über die
// Schreibschicht (schreiben.js), zehn Sekunden Rückgängig, bei FAIL mit dem Folgeauftrag im selben Commit.
import { el, ico } from './dom.js';
import { abnahmeSchritte, hostsVon } from './welt.js';
import { projektDes } from './zustand.js';
import { sichtbar } from './urteil.js';
import { URTEILE } from './ansichtstexte.js';
import { ergebnisVon, naechsterOffen, einzeilig } from './abnahme.js';
import { band, feld, knopf, linkKnopf, platz } from './karten.js';
import { ohneStand } from './ansichten.js';
import { eintragsZeile } from './eintrag.js';
import { liesEntwurf, schluessel, speichereEntwurf } from './entwuerfe.js';
import { idMitStrich } from './format.js';
import { kannSenden, SENDEN_FEHLT } from './schreiben.js';
import { absender } from './absenden.js';

const WOERTER = ['PASS', 'FAIL', 'BLOCKED', 'SKIP'];
const SATZ_FRAGE = { FAIL: 'Was hast du gesehen?', BLOCKED: 'Was hat dich gehindert?', SKIP: 'Warum lässt du den Schritt aus?' };
const SATZ_HINWEIS = { FAIL: 'Ein Satz genügt. Er steht im Folgeauftrag.', BLOCKED: 'Ein Satz genügt. Er steht im Folgeauftrag.', SKIP: 'Ein Satz genügt. Er steht im Ergebnis.' };

/** Die Urteile dieses Geräts zu einer Abnahme: { schritte: { N: { wort, satz } }, anmerkung }. */
export async function ladeUrteile(k, id) {
  const d = await liesEntwurf(k.db, schluessel.urteil(id));
  return { schritte: d?.schritte ?? {}, anmerkung: d?.anmerkung ?? '' };
}

/** Speichert die Urteile; sind keine und keine Anmerkung mehr da, verschwindet der Entwurf. */
export async function speichereUrteile(k, id, u) {
  const leer = !Object.keys(u.schritte).length && !String(u.anmerkung ?? '').trim();
  await speichereEntwurf(k.db, schluessel.urteil(id), { schritte: u.schritte, anmerkung: u.anmerkung ?? '' }, leer, k.jetzt());
}

function nichtGefunden(titel, satz) {
  return { inhalt: [platz({ bild: 'blau', symbol: 'search_off-f', titel, saetze: [satz], knoepfe: [linkKnopf('Zu Wartet', '#wartet')] })] };
}

function eintragOderLeer(welt, z, k, o, name) {
  const platzhalter = ohneStand(welt, z, k, { geladen: `${name} wird geladen`, nichtGeladen: `${name} nicht geladen` });
  if (platzhalter) return { fertig: { inhalt: platzhalter } };
  const e = welt.eintraege.get(o.id);
  if (!e || e.head.get('Kind') !== 'test') {
    return { fertig: nichtGefunden('Abnahme nicht gefunden', `Eine Abnahme mit der ID ${idMitStrich(o.id)} liegt nicht auf diesem Gerät. Gleiche in Mehr ab.`) };
  }
  return { e };
}

/** Ansicht Schritt: ein Schritt der Abnahme mit den vier Urteilen. */
export async function schrittAnsicht(welt, z, k, o) {
  const { e, fertig } = eintragOderLeer(welt, z, k, o, 'Abnahme');
  if (fertig) return fertig;
  const a = abnahmeSchritte(e);
  const s = a.schritte.find((x) => x.n === o.schritt);
  if (!s) return nichtGefunden('Schritt nicht gefunden', `Die Abnahme ${idMitStrich(e.id)} hat die Schritte 1 bis ${a.schritte.length}.`);
  const u = await ladeUrteile(k, e.id);
  const offen = a.offen.some((x) => x.n === s.n);
  const beurteilt = a.offen.filter((x) => u.schritte[x.n]?.wort).length;
  const host = hostsVon(e)[0];
  const gewaehlt = u.schritte[s.n]?.wort ?? null;
  const teile = [
    eintragsZeile('Abnahme', e.id),
    el('h2', { class: 'titel-gross' }, `Schritt ${s.n} von ${a.schritte.length}`),
    el('p', { class: 'neben' }, `${beurteilt} von ${a.offen.length} beurteilt${host ? `, an ${host}` : ''}`),
    el('h2', {}, 'Aktion'), el('p', {}, sichtbar(s.title, true)),
  ];
  if (s.lines.length) teile.push(el('h2', {}, 'Befehl'), el('code', { class: 'befehl' }, sichtbar(s.lines.join('\n'))));
  if (s.expect) teile.push(el('h2', {}, 'Erwartet'), el('p', { class: 'erwartet' }, sichtbar(s.expect, true)));
  if (!offen) {
    teile.push(band({ ton: 'ok', symbol: 'check_circle-f', satz: `Dieser Schritt hat in einer früheren Runde ${a.ergebnisse.get(s.n)} bekommen und zählt nicht mehr.` }),
      linkKnopf('Zurück zur Abnahme', `#eintrag/${e.id}`, { klasse: 'tonal' }));
    return { inhalt: teile };
  }
  const weiter = async (urteile) => {
    const naechster = naechsterOffen(a.offen, urteile.schritte, s.n);
    k.ersetze(naechster ? `#eintrag/${e.id}/schritt/${naechster.n}` : `#eintrag/${e.id}/ergebnis`);
  };
  teile.push(el('h2', {}, 'Dein Urteil'), el('div', { class: 'urteile', role: 'group', 'aria-label': 'Dein Urteil' }, WOERTER.map((w) => {
    const d = URTEILE[w];
    const b = el('button', { type: 'button', class: `tonal v ${d.rolle}`, 'data-urteil': w, 'aria-pressed': gewaehlt === w ? 'true' : 'false' },
      ico(d.symbol), el('b', {}, w), el('span', {}, d.bedeutung));
    b.addEventListener('click', async () => {
      if (w === 'PASS') {
        const neu = { ...u, schritte: { ...u.schritte, [s.n]: { wort: 'PASS' } } };
        await speichereUrteile(k, e.id, neu);
        weiter(neu);
      } else {
        k.gehe(`#eintrag/${e.id}/schritt/${s.n}/${w.toLowerCase()}`);
      }
    });
    return b;
  })));
  teile.push(el('p', { class: 'neben' }, 'Bei FAIL, BLOCKED und SKIP schreibst du einen Satz dazu.'));
  if (gewaehlt && gewaehlt !== 'PASS') {
    teile.push(el('p', {}, el('strong', {}, `${gewaehlt}: `), einzeilig(u.schritte[s.n].satz)));
  }
  teile.push(el('p', { class: 'neben' }, 'Die Urteile bleiben auf diesem Gerät, bis du die Antwort sendest.'));
  return { inhalt: teile, titel: `Schritt ${s.n}` };
}

/** Blatt Satz: warum FAIL, BLOCKED oder SKIP; ohne Satz gibt es kein Urteil (das Werkzeug verlangt ihn). */
export async function satzBlatt(welt, k, o, schliessen) {
  const e = welt.eintraege.get(o.id);
  if (!e) return { koerper: [el('p', {}, 'Die Abnahme liegt nicht auf diesem Gerät.')], knoepfe: [knopf('Schließen', { klasse: 'text', an: schliessen })] };
  const a = abnahmeSchritte(e);
  const u = await ladeUrteile(k, e.id);
  const vorher = u.schritte[o.schritt];
  const t = el('textarea', { name: 'satz', rows: 3, autocapitalize: 'sentences' });
  t.value = vorher?.wort === o.wort ? vorher.satz ?? '' : '';
  const feldBauen = (fehler) => feld({ beschriftung: SATZ_FRAGE[o.wort], steuerung: t, hinweis: SATZ_HINWEIS[o.wort], fehler });
  let f = feldBauen(null);
  const koerper = [f];
  const speichern = knopf('Speichern', { klasse: 'gefuellt', an: async () => {
    if (!t.value.trim()) {
      const neu = feldBauen('Schreibe einen Satz dazu.');
      f.replaceWith(neu); f = neu; t.focus();
      return;
    }
    const neu = { ...u, schritte: { ...u.schritte, [o.schritt]: { wort: o.wort, satz: t.value.trim() } } };
    await speichereUrteile(k, e.id, neu);
    const naechster = naechsterOffen(a.offen, neu.schritte, o.schritt);
    k.schliesseUndGehe(naechster ? `#eintrag/${e.id}/schritt/${naechster.n}` : `#eintrag/${e.id}/ergebnis`);
  } });
  return { koerper, knoepfe: [knopf('Abbrechen', { klasse: 'text', an: schliessen }), speichern], symbol: URTEILE[o.wort].symbol, rolle: URTEILE[o.wort].rolle };
}

const chipWort = (w, n) => el('span', { class: `chip-zst ${URTEILE[w].rolle}` }, ico(URTEILE[w].symbol), el('span', {}, `${n} ${w}`));

/** Ansicht Ergebnis: Gesamturteil, Zählung, was nicht PASS ist, alle Schritte zum Ändern und die Anmerkung. */
export async function ergebnisAnsicht(welt, z, k, o) {
  const { e, fertig } = eintragOderLeer(welt, z, k, o, 'Abnahme');
  if (fertig) return fertig;
  const a = abnahmeSchritte(e);
  const u = await ladeUrteile(k, e.id);
  const r = ergebnisVon({ schritte: a.schritte, offen: a.offen, fruehere: a.ergebnisse, urteile: u.schritte, anmerkung: u.anmerkung });
  const teile = [eintragsZeile('Abnahme', e.id)];
  if (r.fehler) {
    teile.push(band({ ton: 'fehler', symbol: 'error-f', titel: 'Die Antwort ist noch nicht in Ordnung', satz: r.fehler, knoepfe: [linkKnopf('Zu den Schritten', `#eintrag/${e.id}`)] }));
    return { inhalt: teile };
  }
  const rolle = r.verdict === 'PASS' ? 's-ok' : 's-fehler';
  const ziele = projektDes(e);
  const chips = ['PASS', 'FAIL', 'BLOCKED', 'SKIP'].filter((w) => r.zaehlung[w]).map((w) => chipWort(w, r.zaehlung[w]));
  teile.push(el('section', { class: `ergebnis ${rolle}`, 'aria-label': 'Ergebnis' },
    el('p', { class: 'gesamt' }, ico(r.verdict === 'PASS' ? 'check_circle-f' : 'cancel-f'), `Gesamt: ${r.verdict}`),
    el('p', {}, r.satz), chips.length ? el('div', { class: 'chips-reihe' }, chips) : null,
    r.folge.follow_up ? el('p', {}, `Beim Senden legt die App einen Folgeauftrag${ziele ? ` für ${ziele}` : ''} an.`) : null));
  if (r.nichtPass.length) {
    teile.push(el('h2', {}, 'Was nicht PASS ist'), el('ul', { class: 'fall-liste' }, r.nichtPass.map((s) => el('li', {},
      el('span', { class: `chip-zst ${URTEILE[s.wort].rolle}` }, ico(URTEILE[s.wort].symbol), el('span', {}, s.wort)),
      el('p', { class: 'neben' }, `Schritt ${s.n} · ${s.titel}`), s.satz ? el('p', { class: 'satz' }, s.satz) : null))));
  }
  const liste = el('ul', { class: 'schritte' }, a.offen.map((s) => {
    const w = u.schritte[s.n]?.wort;
    const d = w ? URTEILE[w] : null;
    return el('li', {}, el('a', { class: 'schritt', href: `#eintrag/${e.id}/schritt/${s.n}` }, el('span', { class: 'nr' }, String(s.n)),
      el('span', { class: 'was' }, sichtbar(s.title, true)),
      d ? el('span', { class: `urteil ${d.rolle}` }, ico(d.symbol), w) : el('span', { class: 'urteil offen s-neutral' }, ico('schedule'), 'offen')));
  }));
  teile.push(el('details', {}, el('summary', {}, `Alle ${a.offen.length} Schritte ansehen`), el('p', { class: 'neben' }, 'Tippe auf einen Schritt, um das Urteil zu ändern.'), liste));
  const an = el('textarea', { name: 'anmerkung', rows: 2, autocapitalize: 'sentences' });
  an.value = u.anmerkung;
  an.addEventListener('input', async () => { u.anmerkung = an.value; await speichereUrteile(k, e.id, u); });
  teile.push(feld({ beschriftung: 'Anmerkung (freiwillig)', steuerung: an }));
  const gesperrt = !kannSenden(k);
  const { platz: ablehnung, los } = absender(
    (opt) => k.schreiben.urteilSenden(e.id, { text: r.text, entwurf: { schluessel: schluessel.urteil(e.id), wert: { schritte: u.schritte, anmerkung: u.anmerkung ?? '' } }, ...opt }),
    () => k.ersetze('#wartet'));
  teile.splice(1, 0, ablehnung);   // oben, damit eine Ablehnung ohne Suchen im Blick ist
  const senden = knopf('Antwort senden', { klasse: 'gefuellt', gesperrt, an: (ev) => los(false, ev.currentTarget) });
  senden.dataset.handlung = 'abnahme';
  return { inhalt: teile, aktion: gesperrt ? [senden, el('p', { class: 'neben satz' }, SENDEN_FEHLT)] : [senden], titel: 'Ergebnis' };
}
