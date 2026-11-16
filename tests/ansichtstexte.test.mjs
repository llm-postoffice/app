// Wortlaut der Ansichten: Zeiten, Mehrzahlen, Absender und die Wörter der Warteschlange (TXT-6, TXT-10, TXT-12, UOF-3).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { absenderText, adressText, artVon, entwurfZeile, kurz, schlangeZeile, schritte, sendungText, um, vor, zeitpunkt } from '../js/ansichtstexte.js';

const jetzt = new Date(2026, 10, 14, 14, 7).getTime();
const am = (t, h, m) => new Date(2026, 10, t, h, m).getTime();

test('Zeiten: heute nur die Uhrzeit, sonst ISO-Datum und Uhrzeit (TXT-6)', () => {
  assert.equal(zeitpunkt(am(14, 9, 5), jetzt), '09:05');
  assert.equal(zeitpunkt(am(12, 18, 13), jetzt), '2026-11-12 18:13');
  assert.equal(um(am(14, 14, 9), jetzt), 'um 14:09');
  assert.equal(um(am(13, 14, 9), jetzt), 'am 2026-11-13');
});

test('vor: richtige Mehrzahl (TXT-10)', () => {
  assert.equal(vor(jetzt - 20_000, jetzt), 'gerade eben');
  assert.equal(vor(jetzt - 20 * 60000, jetzt), 'vor 20 min');
  assert.equal(vor(jetzt - 60 * 60000, jetzt), 'vor 1 Stunde');
  assert.equal(vor(jetzt - 180 * 60000, jetzt), 'vor 3 Stunden');
  assert.equal(vor(jetzt - 24 * 60 * 60000, jetzt), 'vor 1 Tag');
  assert.equal(vor(jetzt - 49 * 60 * 60000, jetzt), 'vor 2 Tagen');
  assert.equal(schritte(1), '1 Schritt');
  assert.equal(schritte(12), '12 Schritte');
});

test('Art: Wort, Symbol und Farbklasse gehören zusammen (UFA-2)', () => {
  assert.deepEqual(artVon('question'), { klasse: 'k-frage', wort: 'Frage', symbol: 'help-f' });
  assert.equal(artVon('approval').wort, 'Freigabe');
  assert.equal(artVon('idea').klasse, 'k-nachricht');
  assert.equal(artVon('unbekannt').wort, 'Eintrag');
});

test('Absender: Sitzung auf Rechner, Nutzer mit Gerät', () => {
  assert.deepEqual(absenderText('session:cb56d77f, rechner-a, 2026-11-14T13:47Z'), { wer: 'session:cb56d77f', wo: 'rechner-a', trenner: ' auf ' });
  assert.deepEqual(absenderText('user, handy, 2026-11-14T13:47Z'), { wer: 'user', wo: 'handy', trenner: ', ' });
  assert.deepEqual(absenderText('user, 2026-11-14T13:47Z'), { wer: 'user', wo: null, trenner: '' });
  assert.equal(absenderText(null), null);
});

test('Adressen im Klartext', () => {
  assert.equal(adressText(['project:alpha', 'host:rechner-a', 'user']), 'alpha, an rechner-a, dich');
});

test('Warteschlange: jeder Zustand sagt in Worten, was mit der Sendung ist (UOF-3)', () => {
  const s = { art: 'antwort', wahl: 'A', zustand: 'liegt' };
  assert.equal(sendungText(s), 'Antwort „A“');
  assert.equal(schlangeZeile(s).text, 'Antwort „A“ noch nicht gesendet');
  assert.equal(schlangeZeile(s, { ohneNetz: true }).text, 'Antwort „A“ noch nicht gesendet, wartet auf Netz');
  assert.equal(schlangeZeile({ ...s, zustand: 'sendet' }).text, 'Antwort „A“: wird gesendet …');
  assert.equal(schlangeZeile({ ...s, zustand: 'gesendet', zeit: am(14, 14, 2) }).text, 'gesendet 14:02');
  assert.equal(schlangeZeile({ art: 'urteil', verdict: 'FAIL', zustand: 'token' }).text, 'Antwort FAIL nicht gesendet: GitHub lehnt das Token ab');
  assert.equal(schlangeZeile({ art: 'einsortieren', ziel: 'user', zustand: 'liegt' }).text, 'Einsortieren an dich noch nicht gesendet');
  assert.equal(schlangeZeile({ zustand: 'konflikt', grund: 'schon bearbeitet' }).symbol, 'warning-f');
  assert.equal(entwurfZeile(5, 12).text, 'Entwurf: 5 von 12 Schritten beurteilt, noch nicht gesendet');
  assert.equal(entwurfZeile(0, 1).text, 'Entwurf: 0 von 1 Schritt beurteilt, noch nicht gesendet');
});

test('kurz: Alter einer Zeile in Kurzform mit richtiger Mehrzahl (TXT-10)', () => {
  assert.equal(kurz(jetzt - 20_000, jetzt), 'gerade eben');
  assert.equal(kurz(jetzt - 20 * 60000, jetzt), 'vor 20 min');
  assert.equal(kurz(jetzt - 4 * 3600000, jetzt), 'vor 4 Std.');
  assert.equal(kurz(jetzt - 26 * 3600000, jetzt), 'vor 1 Tag');
  assert.equal(kurz(jetzt - 3 * 86400000, jetzt), 'vor 3 Tagen');
  assert.equal(kurz(jetzt - 21 * 86400000, jetzt), 'vor 3 Wochen');
  assert.equal(kurz(jetzt - 95 * 86400000, jetzt), 'vor 3 Mon.');
  assert.equal(kurz(jetzt + 60000, jetzt), 'gerade eben', 'eine Uhr, die vorgeht, ergibt kein negatives Alter');
});
