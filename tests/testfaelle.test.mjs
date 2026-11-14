// Die Kopie der gemeinsamen Testfälle: Herkunft in QUELLE.json, und bei vorhandener Quelle (POST_QUELLE zeigt auf den
// Ordner des Postsystems) ist die Kopie gleich der Quelle. Ohne Quelle überspringt der Vergleich.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { QUELLE, TC } from './hilfen/tc.mjs';

test('QUELLE.json nennt Fassung, Commit und Format der Kopie', () => {
  assert.equal(QUELLE.datei, 'cases.json');
  assert.match(QUELLE.fassung, /^\d{8}\.\d{2}$/);
  assert.match(QUELLE.commit, /^[0-9a-f]{7,40}$/);
  assert.equal(QUELLE.format, TC.format);
});

const quelle = process.env.POST_QUELLE;
test('die Kopie ist gleich testdata/cases.json der Quelle', { skip: quelle ? false : 'POST_QUELLE nicht gesetzt' }, () => {
  const original = readFileSync(`${quelle}/testdata/cases.json`, 'utf8');
  const kopie = readFileSync(new URL('./testfaelle/cases.json', import.meta.url), 'utf8');
  assert.equal(kopie, original, 'Kopie veraltet: neu übernehmen (Anleitung in tests/testfaelle/QUELLE.json)');
});
