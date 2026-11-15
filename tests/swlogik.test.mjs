// Entscheidungen des Service Workers ohne Browser (UOF-1, UOF-5): welche Caches fallen weg, wann wartet eine Aktualisierung,
// was gibt den wartenden Worker frei.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CACHE_VORSATZ, WECHSELN, aktualisierungWartet, gibtFrei, veralteteCaches } from '../js/swlogik.js';

test('nach dem Wechsel fallen alle früheren Fassungen der App weg, die aktuelle und fremde Caches bleiben', () => {
  const alle = ['postfach-20261114.01', 'postfach-20261115.01', 'postfach-20261115.02', 'andere-app-1'];
  assert.deepEqual(veralteteCaches(alle, 'postfach-20261115.02'), ['postfach-20261114.01', 'postfach-20261115.01']);
  assert.deepEqual(veralteteCaches(['postfach-20261115.02'], 'postfach-20261115.02'), [], 'nichts zu löschen');
  assert.deepEqual(veralteteCaches([], 'postfach-20261115.02'), []);
  assert.ok(alle.filter((k) => k.startsWith(CACHE_VORSATZ)).length === 3);
});

test('eine Aktualisierung wartet nur mit fertigem wartendem Worker und gesteuerter Seite', () => {
  const w = {};
  assert.equal(aktualisierungWartet({ waiting: w, controller: {} }), true);
  assert.equal(aktualisierungWartet({ waiting: w, controller: null }), false, 'erster Besuch: nichts zu wechseln');
  assert.equal(aktualisierungWartet({ waiting: null, controller: {} }), false, 'noch nichts installiert');
  assert.equal(aktualisierungWartet({}), false);
});

test('nur die Nachricht „wechseln“ gibt den wartenden Worker frei', () => {
  assert.equal(WECHSELN, 'wechseln');
  assert.equal(gibtFrei('wechseln'), true);
  for (const x of ['', 'Wechseln', 'skipWaiting', null, undefined, { type: 'wechseln' }]) assert.equal(gibtFrei(x), false);
});
