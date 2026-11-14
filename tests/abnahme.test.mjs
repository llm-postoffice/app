// Abnahme Schritt für Schritt: aus den Urteilen auf dem Gerät den Antworttext und das Ergebnis rechnen; es ist derselbe
// Text, den das Postwerkzeug liest (urteil.js leseAntwort).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { antwortText, einzeilig, ergebnisVon, naechsterOffen } from '../js/abnahme.js';

const schritte = [1, 2, 3, 4].map((n) => ({ n, title: `Schritt ${n}`, lines: [], expect: null }));

test('Antworttext: je Schritt eine Zeile, offene Schritte machen das Gesamturteil FAIL', () => {
  const t = antwortText(schritte, { 1: { wort: 'PASS' }, 2: { wort: 'FAIL', satz: 'Linien\nin der Pipe' }, 3: { wort: 'SKIP', satz: 'Shell fehlt' } });
  assert.equal(t, '1: PASS\n2: FAIL Linien in der Pipe\n3: SKIP Shell fehlt\nGesamt: FAIL Schritt 4 ohne Urteil');
  assert.equal(antwortText(schritte, { 1: { wort: 'PASS' }, 2: { wort: 'PASS' }, 3: { wort: 'PASS' }, 4: { wort: 'PASS' } }, 'Alles gut'), '1: PASS\n2: PASS\n3: PASS\n4: PASS\n\nGesamt:\nAlles gut');
});

test('Ergebnis: PASS, wenn alles PASS ist; FAIL mit Folgeauftrag sonst', () => {
  const alle = Object.fromEntries([1, 2, 3, 4].map((n) => [n, { wort: 'PASS' }]));
  const gut = ergebnisVon({ schritte, offen: schritte, fruehere: new Map(), urteile: alle });
  assert.equal(gut.verdict, 'PASS');
  assert.equal(gut.folge.follow_up, false);
  assert.equal(gut.satz, '4 von 4 Schritten sind beurteilt.');
  const schlecht = ergebnisVon({ schritte, offen: schritte, fruehere: new Map(), urteile: { ...alle, 3: { wort: 'FAIL', satz: 'kaputt' }, 4: { wort: 'SKIP', satz: 'egal' } } });
  assert.equal(schlecht.verdict, 'FAIL');
  assert.equal(schlecht.folge.follow_up, true);
  assert.deepEqual(schlecht.zaehlung, { PASS: 2, FAIL: 1, BLOCKED: 0, SKIP: 1, offen: 0 });
  assert.match(schlecht.satz, /^Schritt 3 ist FAIL\./);
  assert.deepEqual(schlecht.nichtPass.map((s) => s.n), [3, 4]);
});

test('Ergebnis ohne Urteil: FAIL mit Hinweis auf die Schritte ohne Urteil', () => {
  const r = ergebnisVon({ schritte, offen: schritte, fruehere: new Map(), urteile: { 1: { wort: 'PASS' } } });
  assert.equal(r.verdict, 'FAIL');
  assert.match(r.satz, /3 Schritte haben noch kein Urteil/);
});

test('Frühere Runden: PASS und SKIP von damals zählen nicht mehr mit', () => {
  const offen = schritte.slice(2);
  const r = ergebnisVon({ schritte, offen, fruehere: new Map([[1, 'PASS'], [2, 'SKIP']]), urteile: { 3: { wort: 'PASS' }, 4: { wort: 'PASS' } } });
  assert.equal(r.verdict, 'PASS');
});

test('Nächster offener Schritt: erst nach vorn, dann von vorn', () => {
  assert.equal(naechsterOffen(schritte, { 1: {}, 2: {} }, 2).n, 3);
  assert.equal(naechsterOffen(schritte, { 3: {}, 4: {} }, 4).n, 1);
  assert.equal(naechsterOffen(schritte, { 1: {}, 2: {}, 3: {}, 4: {} }, 2), null);
});

test('Ein Satz bleibt eine Zeile, Steuerzeichen werden sichtbar', () => {
  assert.equal(einzeilig('a\n\tb   c'), 'a b c');
  assert.equal(einzeilig('x\u001b[0m'), 'x^[[0m');
});
