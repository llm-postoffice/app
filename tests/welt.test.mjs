// Die Welt der Ansichten: Listen, Zahlen, Zustandswörter, Suche mit norm_id, Handlungen je Art und der Stapel unter einem
// tiefen Link. Alles mit den erfundenen Beispieldaten (hilfen/beispieldaten.mjs); die Uhr steht fest.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { abnahmeSchritte, abnahmenListe, abnahmenNachRechner, annahmeVon, baueWelt, eingangListe, handlungenVon, ideenListe, karteVon, moeglichkeiten, offenSatz, ortVon, suche, wartetListe, zaehler, zustandVon, fadenVon } from '../js/welt.js';
import { stapelUnter } from '../js/adressen.js';
import { auswahlOptionen, filtere, gruppiere, hatFilter, leererFilter, uebersichtModelle } from '../js/welt.js';
import { JETZT, dateien, entwuerfe, schlange } from './hilfen/beispieldaten.mjs';

const welt = (extra = {}) => baueWelt({ pfade: dateien(), jetzt: JETZT, ...extra });
const ids = (liste) => liste.map(({ e }) => e.id);

test('Wartet: Dringendes zuerst, dann Rang und Alter; Ideen, Eingang und Wartende fehlen', () => {
  const w = welt();
  assert.deepEqual(ids(wartetListe(w)), ['q7w2de', 'h2n9vz', 'p4m7bt', '8k3m1x', 'm7q2ke', 'r2d4vn', 'x9k3ft']);
  assert.equal(ids(wartetListe(w))[0], 'q7w2de', 'dringend zuerst');
  for (const id of ['b3cyxm', 'k7m2qa', 'w3a9ck', 'tpc0e0', 'd5n8vk', 'f6s3ga']) assert.ok(!ids(wartetListe(w)).includes(id), id);
});

test('Zahlen für Übersicht und Plakette', () => {
  assert.deepEqual(zaehler(welt()), { fuerDich: 7, dringend: 1, eingang: 2, ideen: 4, abnahmen: 3, offeneSchritte: 23 });
  const leer = baueWelt({ pfade: new Map([['projects.md', '# Projekte\n']]), jetzt: JETZT });
  assert.deepEqual(zaehler(leer), { fuerDich: 0, dringend: 0, eingang: 0, ideen: 0, abnahmen: 0, offeneSchritte: 0 });
  assert.equal(leer.hatStand, true);
  assert.equal(baueWelt({ pfade: null, jetzt: JETZT }).hatStand, false);
});

test('Eingang und Ideensammlung: neueste zuerst', () => {
  const w = welt();
  assert.deepEqual(ids(eingangListe(w)), ['k7m2qa', 'w2tn4c']);
  assert.deepEqual(ids(ideenListe(w)), ['b3cyxm', 'x4pn8d', 'm8hq2s', 'z6bt3f']);
});

test('Abnahmen nach Rechner mit offenen Schritten; Runde 2 zählt nur die offenen', () => {
  const w = welt();
  assert.deepEqual(abnahmenNachRechner(w).map((g) => [g.host, g.eintraege.length, g.offen]), [['rechner-a', 2, 17], ['rechner-b', 1, 6]]);
  const b = w.eintraege.get('p4m7bt');
  assert.equal(abnahmeSchritte(b).runde, 2);
  assert.equal(offenSatz(b), '8 von 12 Schritten offen');
  assert.equal(offenSatz(w.eintraege.get('8k3m1x')), '9 Schritte offen');
  assert.equal(abnahmenListe(w).length, 3);
});

test('Zustandswörter nennen, wer handelt und seit wann (TXT-12)', () => {
  const w = welt();
  const z = (id) => zustandVon(w, w.eintraege.get(id), w.buch.zustand(w.eintraege.get(id)));
  assert.equal(z('r2d4vn').text, 'wartet auf deine Antwort seit 13:47');
  assert.equal(z('q7w2de').text, 'wartet auf dein Ja seit 10:07');
  assert.match(z('h2n9vz').text, /^wartet auf dein Urteil seit 2026-11-11 21:40, 6 Schritte offen$/);
  assert.equal(z('k7m2qa').text, 'offen, im Eingang ohne Ziel seit 11:07');
  assert.match(z('b3cyxm').text, /^offen, in deiner Ideensammlung seit 09:30$/);
  assert.match(z('tpc0e0').text, /^in Arbeit bei session:cb56d77f bis 17:07$/);
  assert.match(z('d5n8vk').text, /^beantwortet am 2026-11-13: A$/);
  assert.match(z('f6s3ga').text, /^verworfen am 2026-11-10$/);
  assert.equal(z('w3a9ck').text, 'wartet auf deine Antwort zu r2d-4vn');
  assert.equal(z('w3a9ck').symbol, 'schedule');
});

test('Sendungen und Entwürfe auf dem Gerät gehen den Zustandswörtern vor (UOF-3)', () => {
  const w = welt({ schlange: schlange(), entwuerfe: entwuerfe() });
  const z = (id, o) => zustandVon(w, w.eintraege.get(id), w.buch.zustand(w.eintraege.get(id)), o).text;
  assert.equal(z('r2d4vn'), 'Antwort „A“ noch nicht gesendet');
  assert.equal(z('r2d4vn', { ohneNetz: true }), 'Antwort „A“ noch nicht gesendet, wartet auf Netz');
  assert.equal(z('p4m7bt'), 'Antwort FAIL nicht gesendet: GitHub lehnt das Token ab');
  assert.equal(z('8k3m1x'), 'Entwurf: 9 von 9 Schritten beurteilt, noch nicht gesendet');
  assert.equal(z('w2tn4c'), 'nicht gesendet: schon einsortiert');   // der lange Grund steht im Band des Eintrags
});

test('Suche: Titel und ID, auch erledigt und verworfen; die ID mit und ohne Strich, groß und mit o, i, l (norm_id)', () => {
  const w = welt();
  for (const q of ['tpc-0e0', 'TPC0E0', 'tpc-oeo', 'TPC-OEO', ' tpc0e0 ']) assert.deepEqual(ids(suche(w, q).treffer), ['tpc0e0'], q);
  assert.deepEqual(ids(suche(w, 'd5n').treffer), ['d5n8vk'], 'Teil-ID ab drei Zeichen');
  assert.deepEqual(ids(suche(w, 'Doppelter Auftrag').treffer), ['f6s3ga'], 'verworfen wird gefunden');
  assert.ok(ids(suche(w, 'bibliothek').treffer).includes('r2d4vn'), 'Titel ohne Rücksicht auf Großschreibung');
  assert.deepEqual(suche(w, 'zzz-999'), { treffer: [], gesamt: 0, abfrage: 'zzz-999' });
  assert.deepEqual(suche(w, '   ').treffer, []);
  assert.equal(suche(w, 'a', 3).treffer.length <= 3, true);
});

test('ortVon sagt, woher ein Eintrag kommt; stapelUnter baut danach den Stapel (UNA-3)', () => {
  const w = welt();
  assert.equal(ortVon(w, 'k7m2qa'), 'eingang');
  assert.equal(ortVon(w, 'b3cyxm'), 'ideen');
  assert.equal(ortVon(w, '8k3m1x'), 'abnahmen');
  assert.equal(ortVon(w, 'r2d4vn'), null);
  assert.equal(ortVon(w, 'zzzzzz'), null);
  const ort = (id) => ortVon(w, id);
  assert.deepEqual(stapelUnter({ ansicht: 'eintrag', id: 'k7m2qa' }, ort), ['#wartet', '#eingang']);
  assert.deepEqual(stapelUnter({ ansicht: 'eintrag', id: 'b3cyxm' }, ort), ['#wartet', '#mehr', '#ideen']);
  assert.deepEqual(stapelUnter({ ansicht: 'schritt', id: '8k3m1x', schritt: 3 }, ort), ['#wartet', '#abnahmen', '#eintrag/8k3m1x']);
  assert.deepEqual(stapelUnter({ ansicht: 'eintrag', id: 'k7m2qa', blatt: 'einsortieren' }, ort), ['#wartet', '#eingang', '#eintrag/k7m2qa']);
});

test('Handlungen je Art: jede hat einen Knopf in der Ansicht (UGE-2, E13)', () => {
  const w = welt();
  const h = (id) => handlungenVon(w, { e: w.eintraege.get(id), st: w.buch.zustand(w.eintraege.get(id)) });
  assert.deepEqual(h('r2d4vn'), ['antworten', 'bearbeiten']);
  assert.deepEqual(h('8k3m1x'), ['abnahme', 'bearbeiten']);
  assert.deepEqual(h('q7w2de'), ['bearbeiten'], 'Freigaben haben bis Phase 4 nur Bearbeiten (E5)');
  assert.deepEqual(h('m7q2ke'), ['antworten', 'erledigt', 'bearbeiten']);
  assert.deepEqual(h('k7m2qa'), ['einsortieren', 'bearbeiten']);
  assert.deepEqual(h('b3cyxm'), ['bearbeiten'], 'jeder offene Eintrag lässt sich bearbeiten');
  assert.deepEqual(h('d5n8vk'), [], 'Erledigtes hat keine');
});

test('Frage: Möglichkeiten, Empfehlung und Annahme', () => {
  const e = welt().eintraege.get('r2d4vn');
  assert.deepEqual(moeglichkeiten(e), [
    { schluessel: 'A', text: 'Standardbibliothek', empfehlung: true }, { schluessel: 'B', text: 'Zusatzpaket aus extra', empfehlung: false }]);
  assert.equal(annahmeVon(e), 'A');
});

test('Faden: Nachtrag, Folgeauftrag und gesendete Sendung in zeitlicher Reihenfolge', () => {
  const w = welt();
  const f = fadenVon(w, w.eintraege.get('r2d4vn'));
  assert.deepEqual(f.map((p) => p.kopf), ['Nachtrag von session:cb56d77f', 'Folgeauftrag p1c-b2x von session:27b922d7']);
  assert.equal(f[1].ziel, 'p1cb2x');
});

test('Karte: Art, Projekt, Rechner und Absender; Text aus dem Eintrag bleibt Text mit sichtbaren Steuerzeichen', () => {
  const w = welt();
  const m = karteVon(w, { e: w.eintraege.get('8k3m1x'), st: w.buch.zustand(w.eintraege.get('8k3m1x')) });
  assert.equal(m.art.wort, 'Abnahme');
  assert.equal(m.an, 'an rechner-a');
  assert.equal(m.projekt, 'alpha');
  const { wann, ...vonOhne } = m.von;
  assert.deepEqual(vonOhne, { wer: 'session:cb56d77f', wo: 'rechner-a', trenner: ' auf ' });
  assert.match(wann, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  const rohe = new Map(dateien());
  rohe.set('entries/aa/aaaaaa/0-entry.md', '# Titel\u001b[31m rot\n\n- Kind: note\n- To: user\n- From: user, handy, 2026-11-14T10:00Z\n\nText');
  const y = baueWelt({ pfade: rohe, jetzt: JETZT });
  assert.equal(karteVon(y, { e: y.eintraege.get('aaaaaa'), st: y.buch.zustand(y.eintraege.get('aaaaaa')) }).titel, 'Titel^[[31m rot');
});

// ---- Alle: offene Einträge aller Projekte, filtern, sortieren, gruppieren

const alle = () => uebersichtModelle(welt());
const idsM = (liste) => liste.map((m) => m.id);
const filter = (teil) => ({ ...leererFilter(), ...teil });

test('Alle: jeder offene Eintrag steht drin, auch die, die nicht auf dich warten; Erledigtes und Verworfenes nicht', () => {
  const m = alle();
  assert.equal(m.length, 16);
  for (const id of ['tpc0e0', 'w3a9ck', 'p1cb2x', 'k7m2qa', 'b3cyxm']) assert.ok(idsM(m).includes(id), id);
  for (const id of ['d5n8vk', 'f6s3ga']) assert.ok(!idsM(m).includes(id), `${id} ist geschlossen`);
  const lage = (id) => m.find((x) => x.id === id).lage;
  assert.deepEqual(['q7w2de', 'tpc0e0', 'w3a9ck', 'p1cb2x'].map(lage), ['dich', 'arbeit', 'andere', 'offen']);
  assert.equal(m.find((x) => x.id === 'q7w2de').alter, 'vor 4 Std.');
  assert.deepEqual(m.filter((x) => x.lage === 'dich').map((x) => x.id).sort(), ids(wartetListe(welt())).sort(), 'Für dich ist genau die Liste Wartet');
});

test('Alle: ein leerer Filter lässt alles durch; jede Dimension verengt, mehrere Werte einer Dimension gelten als oder, Dimensionen als und', () => {
  const m = alle();
  assert.equal(hatFilter(leererFilter()), false);
  assert.equal(filtere(m, leererFilter()).length, 16);
  assert.deepEqual(idsM(filtere(m, filter({ projekt: ['gamma'] }))).sort(), ['h2n9vz', 'z6bt3f']);
  assert.equal(filtere(m, filter({ projekt: ['gamma', 'beta'] })).length, 7);
  assert.deepEqual(idsM(filtere(m, filter({ projekt: [''] }))).sort(), ['k7m2qa', 'w2tn4c'], 'ohne Projekt');
  assert.deepEqual(idsM(filtere(m, filter({ status: ['arbeit', 'andere'] }))).sort(), ['tpc0e0', 'w3a9ck']);
  assert.deepEqual(idsM(filtere(m, filter({ art: ['question', 'approval'] }))).sort(), ['q7w2de', 'r2d4vn']);
  assert.deepEqual(idsM(filtere(m, filter({ projekt: ['beta'], status: ['dich'] }))).sort(), ['p4m7bt', 'r2d4vn']);
  assert.equal(hatFilter(filter({ sortierung: 'art' })), false, 'die Sortierung ist kein Filter');
  assert.equal(hatFilter(filter({ prio: ['hoch'] })), true);
});

test('Alle: Priorität filtert Dringend als eigenes Merkmal und Hoch, Normal, Niedrig nach dem Rang', () => {
  const m = alle();
  assert.deepEqual(idsM(filtere(m, filter({ prio: ['dringend'] }))), ['q7w2de']);
  assert.deepEqual(idsM(filtere(m, filter({ prio: ['hoch'] }))), ['q7w2de'], 'Rang 1 ist Hoch, auch wenn er dringend ist');
  assert.equal(filtere(m, filter({ prio: ['niedrig'] })).length, 6);
  assert.equal(filtere(m, filter({ prio: ['niedrig', 'dringend'] })).length, 7);
});

test('Alle: die Zahlen einer Auswahl zählen mit den anderen Filtern, nicht mit dem eigenen', () => {
  const m = alle();
  const zahlen = (f, dim) => Object.fromEntries(auswahlOptionen(m, f, dim).map((o) => [o.wert, o.n]));
  assert.deepEqual(zahlen(leererFilter(), 'status'), { dich: 7, arbeit: 1, andere: 1, offen: 7 });
  assert.deepEqual(zahlen(filter({ projekt: ['beta'] }), 'status'), { dich: 2, arbeit: 0, andere: 1, offen: 2 });
  assert.deepEqual(zahlen(filter({ projekt: ['beta'] }), 'projekt'), { alpha: 7, beta: 5, gamma: 2, '': 2 }, 'das Projekt zählt sich nicht selbst');
  assert.deepEqual(auswahlOptionen(m, leererFilter(), 'art').map((o) => o.text), ['Frage', 'Freigabe', 'Abnahme', 'Auftrag', 'Nachricht', 'Idee', 'Notiz']);
  assert.deepEqual(auswahlOptionen(m, leererFilter(), 'projekt').map((o) => o.text), ['alpha', 'beta', 'gamma', 'ohne Projekt'], 'ohne Projekt steht zuletzt');
  assert.deepEqual(auswahlOptionen(m, leererFilter(), 'prio').map((o) => o.text), ['Dringend', 'Hoch', 'Normal', 'Niedrig']);
  assert.ok(auswahlOptionen([], filter({ projekt: ['alpha'] }), 'projekt').some((o) => o.wert === 'alpha'), 'ein gewählter Wert bleibt abwählbar');
});

test('Alle: Gruppen nach Projekt, Priorität, Art und Status; innerhalb zählt der Rang', () => {
  const m = alle();
  const gruppen = (s) => gruppiere(m, s).map((g) => `${g.titel}:${g.eintraege.length}`);
  assert.deepEqual(gruppen('projekt'), ['alpha:7', 'beta:5', 'gamma:2', 'ohne Projekt:2']);
  assert.deepEqual(idsM(gruppiere(m, 'projekt')[0].eintraege).slice(0, 2), ['q7w2de', '8k3m1x'], 'Dringendes zuerst, dann ältere Anlage');
  assert.deepEqual(gruppen('prioritaet'), ['Dringend:1', 'Normal:9', 'Niedrig:6']);
  assert.deepEqual(gruppen('art'), ['Frage:1', 'Freigabe:1', 'Abnahme:3', 'Auftrag:3', 'Nachricht:3', 'Idee:4', 'Notiz:1']);
  assert.deepEqual(gruppen('status'), ['Wartet auf dich:7', 'In Arbeit:1', 'Wartet auf anderes:1', 'Offen:7']);
  assert.equal(gruppiere(m, 'projekt')[0].fuerDich, 4);
  assert.equal(gruppiere(m, 'projekt').reduce((n, g) => n + g.eintraege.length, 0), 16, 'kein Eintrag geht verloren');
});

test('Alle: nach Alter eine Liste ohne Gruppentitel, neue oder alte zuerst; leer ergibt keine Gruppe', () => {
  const m = alle();
  const neu = gruppiere(m, 'alter-neu');
  assert.equal(neu.length, 1);
  assert.equal(neu[0].titel, null);
  assert.deepEqual(idsM(neu[0].eintraege).slice(0, 3), ['w3a9ck', 'p1cb2x', 'r2d4vn']);
  assert.deepEqual(idsM(gruppiere(m, 'alter-alt')[0].eintraege).slice(0, 2), ['z6bt3f', 'h2n9vz']);
  for (const s of ['projekt', 'prioritaet', 'art', 'status', 'alter-neu', 'alter-alt']) assert.deepEqual(gruppiere([], s), [], s);
});
