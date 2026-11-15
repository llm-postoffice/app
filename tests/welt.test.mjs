// Die Welt der Ansichten: Listen, Zahlen, Zustandswörter, Suche mit norm_id, Handlungen je Art und der Stapel unter einem
// tiefen Link. Alles mit den erfundenen Beispieldaten (hilfen/beispieldaten.mjs); die Uhr steht fest.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { abnahmeSchritte, abnahmenListe, abnahmenNachRechner, annahmeVon, baueWelt, eingangListe, handlungenVon, ideenListe, karteVon, moeglichkeiten, offenSatz, ortVon, suche, wartetListe, zaehler, zustandVon, fadenVon } from '../js/welt.js';
import { stapelUnter } from '../js/adressen.js';
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
  assert.deepEqual(h('r2d4vn'), ['antworten']);
  assert.deepEqual(h('8k3m1x'), ['abnahme']);
  assert.deepEqual(h('q7w2de'), [], 'Freigaben haben keine Handlung bis Phase 4 (E5)');
  assert.deepEqual(h('m7q2ke'), ['antworten', 'erledigt']);
  assert.deepEqual(h('k7m2qa'), ['einsortieren']);
  assert.deepEqual(h('b3cyxm'), []);
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
  assert.deepEqual(m.von, { wer: 'session:cb56d77f', wo: 'rechner-a', trenner: ' auf ' });
  const rohe = new Map(dateien());
  rohe.set('entries/aa/aaaaaa/0-entry.md', '# Titel\u001b[31m rot\n\n- Kind: note\n- To: user\n- From: user, handy, 2026-11-14T10:00Z\n\nText');
  const y = baueWelt({ pfade: rohe, jetzt: JETZT });
  assert.equal(karteVon(y, { e: y.eintraege.get('aaaaaa'), st: y.buch.zustand(y.eintraege.get('aaaaaa')) }).titel, 'Titel^[[31m rot');
});
