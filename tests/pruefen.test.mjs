// Geheimnisse und Personendaten nach den gemeinsamen Testfällen (secrets, personal). Geheimnisse stehen in der Datei
// der Fälle in Teilen; erst der Test setzt sie zusammen, damit keine Prüfung des Repos (gitleaks) anschlägt.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { geheimnisTreffer, ibanGueltig, personenTreffer } from '../js/pruefen.js';
import { TC, textVon } from './hilfen/tc.mjs';

for (const fall of TC.secrets) {
  test(`secrets: ${fall.name}`, () => assert.deepEqual(geheimnisTreffer(textVon(fall)), fall.expect));
}
for (const fall of TC.personal) {
  test(`personal: ${fall.name}`, () => assert.deepEqual(personenTreffer(textVon(fall)), fall.expect));
}

test('kein Teil eines Geheimnisses ist für sich ein Treffer', () => {
  for (const fall of TC.secrets.filter((f) => f.expect.length)) {
    assert.ok(Array.isArray(fall.text), fall.name);
    for (const teil of fall.text) assert.deepEqual(geheimnisTreffer(teil), [], `${fall.name}: Teil „${teil.slice(0, 12)}“`);
  }
});

test('Python- und JavaScript-Muster lesen Unicode gleich: Wortgrenze vor ä, langes s als s', () => {
  // Python-\b liegt nicht zwischen ä und s (beides Wortzeichen); ein ASCII-\b in JavaScript fände hier einen Treffer.
  const schluessel = `sk-${'a1'.repeat(12)}`;
  assert.deepEqual(geheimnisTreffer(`ä${schluessel}`), []);
  assert.deepEqual(geheimnisTreffer(`Schlüssel ${schluessel}`), [[1, 'API-Schlüssel']]);
  // Python-re.I setzt das lange s und das Kelvinzeichen gleich s und k; das Flag u in JavaScript auch
  assert.deepEqual(geheimnisTreffer(`ſk-${'a1'.repeat(12)}`), []);
  assert.equal(geheimnisTreffer(`TOKEN=${'Ab3d'.repeat(3)}`).length, 1);
  assert.equal(geheimnisTreffer(`TOKEN=${'Ab3d'.repeat(3)}`).length, 1);
});

test('IBAN: Prüfsumme nach Modulo 97', () => {
  assert.equal(ibanGueltig('DE89 3704 0044 0532 0130 00'), true);
  assert.equal(ibanGueltig('DE89 3704 0044 0532 0130 01'), false);
  assert.equal(ibanGueltig('DE89'), false);
});
