// Schritte lesen, Antwort lesen, Gesamturteil und Folgeauftrag nach den gemeinsamen Testfällen (verdict).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Fehler, folgeausgang, fruehereErgebnisse, leseAntwort, leseSchritte } from '../js/urteil.js';
import { ladeEintraege } from '../js/zustand.js';
import { TC } from './hilfen/tc.mjs';

for (const fall of TC.verdict) {
  test(`verdict: ${fall.name}`, () => {
    const { schritte } = leseSchritte(fall.steps);
    assert.deepEqual(schritte.map((s) => s.n), fall.expect_steps);
    const fruehere = new Map(Object.entries(fall.previous ?? {}).map(([n, w]) => [Number(n), w]));
    const erwartet = fall.expect;
    if (erwartet.error) {
      assert.throws(() => leseAntwort(fall.answer, schritte, fruehere), (e) => e instanceof Fehler && e.message.includes(erwartet.error));
      return;
    }
    const antwort = leseAntwort(fall.answer, schritte, fruehere);
    const ist = {
      verdict: antwort.verdict,
      steps: Object.fromEntries([...antwort.steps].map(([n, [w]]) => [String(n), w])),
      ...folgeausgang(antwort),
    };
    assert.deepEqual(ist, erwartet);
  });
}

test('ein Fehler der Antwort ist ein Bedienfehler mit Code 2', () => {
  const { schritte } = leseSchritte('1. Etwas tun\n   Erwartet: es geht\n');
  assert.throws(() => leseAntwort('1: gut\n', schritte), (e) => e.code === 2);
});

test('frühere Runden: letztes Ergebnis je Schritt und Zahl der Runden', () => {
  const kopf = '# Abnahme\n\n- Kind: test\n- To: user\n';
  const nachtrag = (schritte) => `- By: user\n- Verdict: FAIL\n${schritte.map((s) => `- Step: ${s}\n`).join('')}`;
  const eintraege = ladeEintraege({
    k7m2qa: {
      '0-entry.md': kopf,
      '01M7CQZS800000000000000001-addendum.md': nachtrag(['1 PASS', '2 FAIL']),
      '01M7CQZS800000000000000002-addendum.md': nachtrag(['2 PASS']),
      '01M7CQZS800000000000000003-addendum.md': '- By: user\n\nNur ein Satz.\n',
    },
  });
  const { ergebnisse, runden } = fruehereErgebnisse(eintraege.get('k7m2qa'));
  assert.equal(runden, 2);
  assert.deepEqual([...ergebnisse], [[1, 'PASS'], [2, 'PASS']]);
});
