// Die Warteschlange für den Nutzer (js/schlange.js): das Band oben in Wartet, die Seite „Noch nicht gesendet“ mit Erneut senden
// und Verwerfen, und der Eintrag, den dieses Gerät offline angelegt hat (er steht in der Welt, sobald er in der Schlange liegt).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { installiereFakeDom, suche as finde, textVon } from './hilfen/fakedom.mjs';
import { JETZT, dateien, schlangeOffline } from './hilfen/beispieldaten.mjs';
import { parse } from '../js/adressen.js';

let aufraeumen;
let M;
before(async () => {
  aufraeumen = installiereFakeDom();
  M = { welt: await import('../js/welt.js'), ansichten: await import('../js/ansichten.js'), eintrag: await import('../js/eintrag.js'),
    schlange: await import('../js/schlange.js'), texte: await import('../js/ansichtstexte.js') };
});
after(() => aufraeumen());

const welt = (schlange) => M.welt.baueWelt({ pfade: dateien(), jetzt: JETZT, schlange });
const z = (teil = {}) => ({ phase: 'bereit', fortschritt: null, fehler: null, ohneNetz: true, letzter: { geprueft: JETZT - 5 * 60000, dateien: 60 }, naechster: null, fertig: true, ...teil });
const t = (x) => textVon(x).replaceAll('­', '');
function kontext(mitSchreiber = true) {
  const aufrufe = [];
  const schreiben = mitSchreiber ? new Proxy({}, { get: (_, was) => async (id) => { aufrufe.push([was, id]); return true; } }) : null;
  const k = { jetzt: () => JETZT, schreiben, aufrufe, meldungen: [], gezeichnet: 0, ersetzt: [], gehe() {}, neuZeichnen() { k.gezeichnet++; }, ersetze(a) { k.ersetzt.push(a); }, meldung(s) { k.meldungen.push(s); return true; } };
  return k;
}

test('Das Band oben in Wartet nennt Zahl und Zustand und führt zur Seite', () => {
  const band = M.schlange.schlangeBandKnoten(welt(schlangeOffline()), z());
  assert.match(t(band), /4 Sendungen noch nicht gesendet/);
  assert.match(t(band), /3 warten auf Netz und gehen raus, sobald du online bist\. Eine hängt und braucht dich\./);
  assert.equal(finde(band, 'a')[0].getAttribute('href'), '#schlange');
  assert.match(t(M.ansichten.wartet(welt(schlangeOffline()), z(), kontext())), /4 Sendungen noch nicht gesendet/);
});

test('Ohne wartende oder hängende Sendung gibt es kein Band; zehn Sekunden Rückgängig zählen nicht', () => {
  assert.equal(M.schlange.schlangeBandKnoten(welt([]), z()), null);
  const frisch = { id: 'f1', eintrag: 'r2d4vn', art: 'antwort', wahl: 'A', zustand: 'liegt', zeit: JETZT, sendenAb: JETZT + 10_000 };
  assert.equal(M.schlange.schlangeBandKnoten(welt([frisch]), z({ ohneNetz: false })), null);
  assert.ok(M.schlange.schlangeBandKnoten(welt([frisch]), z({ ohneNetz: true })), 'ohne Netz wartet auch die frische Sendung');
  const gesendet = { id: 'g1', eintrag: 'r2d4vn', art: 'antwort', zustand: 'gesendet', zeit: JETZT };
  assert.equal(M.schlange.schlangeBandKnoten(welt([gesendet]), z()), null);
});

test('Eine einzelne Sendung steht in der Einzahl', () => {
  const band = M.schlange.schlangeBandKnoten(welt([schlangeOffline()[0]]), z());
  assert.match(t(band), /Eine Sendung noch nicht gesendet/);
  assert.match(t(band), /Eine wartet auf Netz und geht raus, sobald du online bist\./);
});

test('Die Seite zeigt die hängende Sendung zuerst, mit Erneut senden und Verwerfen; Wartendes hat nur Verwerfen', async () => {
  const k = kontext();
  const w = welt(schlangeOffline());
  const knoten = M.schlange.schlangeAnsicht(w, z(), k);
  const zeilen = finde(knoten, '.sendung');
  assert.equal(zeilen.length, 4);
  assert.match(t(zeilen[0]), /Antwort\s*Befund: release scheitert bei Projekten ohne Eintrag/);
  assert.match(t(zeilen[0]), /Nicht gesendet: GitHub nimmt die Sendung nicht an/);
  assert.deepEqual(finde(zeilen[0], 'button').map(t), ['Erneut senden', 'Verwerfen']);
  for (const l of zeilen.slice(1)) {
    assert.match(t(l), /Wartet auf Netz, geht raus, sobald du online bist/);
    assert.deepEqual(finde(l, 'button').map(t), ['Verwerfen']);
  }
  assert.match(t(zeilen[2]), /Neuer Eintrag\s*Eingabefelder prüfen/);
  await finde(zeilen[0], 'button')[0].klick();
  assert.deepEqual(k.aufrufe, [['erneut', 'w4']]);
  await finde(zeilen[1], 'button')[0].klick();
  assert.deepEqual(k.aufrufe.at(-1), ['verwerfen', 'w1']);
  assert.deepEqual(k.meldungen, ['Verworfen.']);
  assert.equal(k.gezeichnet, 2);
});

test('Die Seite nennt Konflikt und Token mit dem, was hilft', () => {
  const s = [
    { id: 's2', eintrag: 'p4m7bt', art: 'urteil', verdict: 'FAIL', zustand: 'token', zeit: JETZT },
    { id: 's4', eintrag: 'w2tn4c', art: 'einsortieren', ziel: 'beta', zustand: 'konflikt', zeit: JETZT, titel: 'Schon einsortiert', grund: 'Ein anderes Gerät war schneller.' },
  ];
  const knoten = M.schlange.schlangeAnsicht(welt(s), z({ ohneNetz: false }), kontext());
  const text = t(knoten);
  assert.match(text, /Neues Token eintragen/);
  assert.match(text, /Trotzdem an beta senden/);
  assert.match(text, /Trage ein neues Token ein, dann geht sie raus/);
});

test('Ohne Sendung sagt die Seite, dass alles gesendet ist', () => {
  assert.match(t(M.schlange.schlangeAnsicht(welt([]), z(), kontext())), /Alles gesendet/);
});

test('Ein offline angelegter Eintrag öffnet seine Adresse statt „nicht gefunden“, mit Band und Verwerfen', () => {
  const w = welt(schlangeOffline());
  assert.ok(w.eintraege.has('n9x4kt'));
  const k = kontext();
  const r = M.eintrag.eintragAnsicht(w, z(), k, { id: 'n9x4kt' }).inhalt;
  assert.doesNotMatch(t(r), /nicht gefunden/);
  assert.match(t(r), /Eingabefelder prüfen/);
  assert.match(t(r), /Noch nicht gesendet\s*Der Eintrag liegt auf diesem Gerät und geht raus, sobald du online bist\./);
  const verwerfen = finde(r, 'button').find((b) => t(b) === 'Verwerfen');
  assert.equal(verwerfen.dataset.handlung, 'verwerfen');
});

test('Verwerfen im offline angelegten Eintrag führt nach Wartet, der Eintrag ist danach nicht mehr da', async () => {
  const k = kontext();
  const r = M.eintrag.eintragAnsicht(welt(schlangeOffline()), z(), k, { id: 'n9x4kt' }).inhalt;
  await finde(r, 'button').find((b) => t(b) === 'Verwerfen').klick();
  assert.deepEqual(k.aufrufe, [['verwerfen', 'w2']]);
  assert.deepEqual(k.ersetzt, ['#wartet']);
  assert.equal(welt(schlangeOffline().filter((s) => s.id !== 'w2')).eintraege.has('n9x4kt'), false);
});

test('Die Adresse #schlange gehört zu Wartet und hat einen Titel', () => {
  const o = parse('#schlange');
  assert.equal(o.ansicht, 'schlange');
  assert.equal(o.bereich, 'wartet');
  assert.equal(M.texte.sendungText({ art: 'anlegen' }), 'Neuer Eintrag');
});
