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

test('answered:ID wartet auf Fragen, Abnahmen und Tests (ANSWERABLE_KINDS des Werkzeugs), nicht auf Aufgaben', () => {
  const kopf = (art) => `# Ziel\n\n- Kind: ${art}\n- To: project:demo\n- From: session:aaaa0000, rechner-a, 2026-11-14T08:00Z\n\nText.\n`;
  const fertig = '- By: session:bbbb1111, rechner-b, 2026-11-14T11:00Z\n- Status: done\n';
  const wartend = '# Wartet\n\n- Kind: task\n- To: project:demo\n- Condition: answered:ZIEL\n- From: session:aaaa0000, rechner-a, 2026-11-14T08:00Z\n\nText.\n';
  for (const [art, erfuellt] of [['question', true], ['approval', true], ['test', true], ['task', false], ['idea', false]]) {
    const eintraege = ladeEintraege({
      k7m2qk: { '0-entry.md': wartend.replace('ZIEL', 'k7m2qm') },
      k7m2qm: { '0-entry.md': kopf(art), '01M7CVDMW00000000000000001-status.md': fertig },
    });
    const buch = new Hauptbuch(eintraege, parseZeit('2026-11-14T12:00Z'));
    const bedingungen = eintragJson(eintraege.get('k7m2qk'), buch.zustand(eintraege.get('k7m2qk'))).conditions;
    assert.equal(bedingungen[0].met, erfuellt, art);
  }
});
