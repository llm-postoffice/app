// Zustand, ready, Rang, Adressen, Eingang und "wartet auf dich" nach den gemeinsamen Testfällen (state).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseZeit } from '../js/format.js';
import {
  Hauptbuch, anDich, eintragJson, imEingang, ladeEintraege, wartetAufDich, wirksamerKopf,
} from '../js/zustand.js';
import { TC } from './hilfen/tc.mjs';

const SCHLUESSEL = ['status', 'ready', 'ready_reason', 'holder', 'until', 'priority', 'urgent', 'conditions', 'to', 'project'];

test('die Testfälle haben das Format 1 und je Gruppe Fälle', () => {
  assert.equal(TC.format, 1);
  for (const gruppe of ['state', 'verdict', 'secrets', 'personal', 'write']) assert.ok(TC[gruppe].length > 0, gruppe);
  const namen = ['state', 'verdict', 'secrets', 'personal', 'write'].flatMap((g) => TC[g].map((f) => f.name));
  assert.equal(new Set(namen).size, namen.length, 'Namen der Fälle sind eindeutig');
});

for (const fall of TC.state) {
  test(`state: ${fall.name}`, () => {
    const eintraege = ladeEintraege(fall.entries);
    const buch = new Hauptbuch(eintraege, parseZeit(fall.at));
    for (const [id, erwartet] of Object.entries(fall.expect)) {
      const e = eintraege.get(id);
      assert.ok(e, `Eintrag ${id} fehlt`);
      const st = buch.zustand(e);
      const json = eintragJson(e, st);
      const ist = Object.fromEntries(SCHLUESSEL.map((k) => [k, json[k]]));
      ist.inbox = imEingang(e);
      ist.for_user = wartetAufDich(e, st);
      assert.deepEqual(ist, erwartet, id);
    }
  });
}

test('jeder Fall nennt alle Schlüssel der Erwartung, auch die Adressen', () => {
  for (const fall of TC.state) {
    for (const erwartet of Object.values(fall.expect)) {
      assert.deepEqual(Object.keys(erwartet).sort(), [...SCHLUESSEL, 'inbox', 'for_user'].sort(), fall.name);
    }
  }
});

test('ein einsortierter Eintrag verlässt den Eingang, sein Kopf in der Datei bleibt unverändert', () => {
  const fall = TC.state.find((f) => f.name === 'Eingang einsortiert');
  const eintraege = ladeEintraege(fall.entries);
  assert.deepEqual([...eintraege.values()].filter(imEingang).map((e) => e.id), ['k7m2qa']);
  const geroutet = [...eintraege.values()].find((e) => !imEingang(e) && e.events.some((ev) => ev.doc.get('To')));
  if (geroutet) assert.notEqual(wirksamerKopf(geroutet), geroutet.head);
});

test('anDich folgt dem wirksamen Kopf, nicht dem Kopf der Datei', () => {
  for (const fall of TC.state) {
    const eintraege = ladeEintraege(fall.entries);
    for (const [id, erwartet] of Object.entries(fall.expect)) {
      assert.equal(anDich(eintraege.get(id)), erwartet.to.includes('user'), `${fall.name}: ${id}`);
    }
  }
});
