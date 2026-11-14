// Texte des Abgleichs und des Speichers (js/texte.js): Wortlaut nach dem Entwurf und die Regeln des Betreibers für
// Handy, Text und Doku (TXT-3 Du, TXT-6 ISO-Zeiten und Ortszeit, TXT-8 kein Ausrufezeichen, TXT-9 kein Gedankenstrich, TXT-10 Plural, URM-3).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { abgleichZeile, dateien, fehlerAnzeige, fortschrittAnzeige, ohneNetzZeile, speicherAnzeige, tagUndUhr, uhrzeit } from '../js/texte.js';

const ort = (jahr, monat, tag, std, min) => new Date(jahr, monat - 1, tag, std, min).getTime();

test('Dateien im Singular, Plural und ohne Datei (TXT-10)', () => {
  assert.deepEqual([0, 1, 2, 514].map(dateien), ['keine Datei', '1 Datei', '2 Dateien', '514 Dateien']);
});

test('Zeiten in Ortszeit: heute, gestern, sonst Datum mit Uhrzeit (TXT-6)', () => {
  const jetzt = ort(2026, 11, 14, 14, 30);
  assert.equal(uhrzeit(ort(2026, 11, 14, 9, 5)), '09:05');
  assert.equal(tagUndUhr(ort(2026, 11, 14, 14, 2), jetzt), 'heute um 14:02');
  assert.equal(tagUndUhr(ort(2026, 11, 13, 23, 59), jetzt), 'gestern um 23:59');
  assert.equal(tagUndUhr(ort(2026, 11, 12, 8, 0), jetzt), '2026-11-12 08:00');
  assert.equal(tagUndUhr(ort(2026, 10, 31, 8, 0), ort(2026, 11, 1, 9, 0)), 'gestern um 08:00', 'über die Monatsgrenze');
});

test('die Zeile Abgleich nennt Zeitpunkt und Dateien oder den Zustand', () => {
  const jetzt = ort(2026, 11, 14, 14, 30);
  assert.equal(abgleichZeile({ phase: 'ohne-anmeldung', letzter: null }, jetzt), 'nicht angemeldet');
  assert.equal(abgleichZeile({ phase: 'bereit', letzter: null }, jetzt), 'noch nicht abgeglichen');
  assert.equal(abgleichZeile({ phase: 'bereit', letzter: { geprueft: ort(2026, 11, 14, 14, 2), dateien: 514 } }, jetzt), 'heute um 14:02, 514 Dateien');
  assert.equal(abgleichZeile({ phase: 'fehler', letzter: { geprueft: ort(2026, 11, 14, 14, 2), dateien: 1 } }, jetzt), 'heute um 14:02, 1 Datei');
});

test('der Fortschritt hat nur mit echter Gesamtzahl einen Wert (URM-3)', () => {
  assert.deepEqual(fortschrittAnzeige({ phase: 'dateien', fertig: 212, gesamt: 514 }), { text: 'Abgleich läuft: 212 von 514 Dateien', wert: 212, max: 514 });
  assert.deepEqual(fortschrittAnzeige({ phase: 'dateien', fertig: 0, gesamt: 1 }), { text: 'Abgleich läuft: 0 von 1 Datei', wert: 0, max: 1 });
  for (const f of [null, { phase: 'baum' }, { phase: 'dateien', fertig: 0, gesamt: 0 }]) {
    assert.deepEqual(fortschrittAnzeige(f), { text: 'Abgleich läuft: Dateiliste wird geholt', wert: null, max: null });
  }
});

test('Speicher: drei Zustände, Arbeitsspeicher und die Warnung nur mit wartenden Antworten', () => {
  assert.deepEqual(speicherAnzeige({ dauerhaft: true }, 'indexeddb', 3), { zeile: 'dauerhaft gewährt', warnung: null });
  assert.deepEqual(speicherAnzeige({ dauerhaft: false }, 'indexeddb', 0), { zeile: 'vom Browser verwaltet', warnung: null });
  assert.match(speicherAnzeige({ dauerhaft: false }, 'indexeddb', 2).warnung, /Noch nicht gesendete Antworten/);
  assert.equal(speicherAnzeige(undefined, 'indexeddb', 0).zeile, 'nicht geprüft');
  const a = speicherAnzeige({ dauerhaft: true }, 'arbeitsspeicher', 0);
  assert.equal(a.zeile, 'nur im Arbeitsspeicher');
  assert.ok(a.warnung, 'im Arbeitsspeicher gibt es immer eine Warnung');
});

test('die Zeile ohne Netz nennt den Stand, wenn es einen gibt (UOF-4)', () => {
  assert.equal(ohneNetzZeile(ort(2026, 11, 14, 14, 2)), 'Ohne Netz: Stand von 14:02. Neues kommt, sobald wieder Netz da ist.');
  assert.equal(ohneNetzZeile(null), 'Ohne Netz: Neues kommt, sobald wieder Netz da ist.');
});

test('Fehler: Titel nach Entwurf, Ton, Aktion und der Stand bleibt erhalten', () => {
  const stand = ort(2026, 11, 14, 14, 2);
  const f = (art, extra = {}) => fehlerAnzeige({ art, message: 'm', ...extra }, stand);
  assert.equal(f('token', { status: 401 }).titel, 'Token abgelaufen oder widerrufen');
  assert.equal(f('token').ton, 'warnung');
  assert.equal(f('token').aktion, 'token');
  assert.match(f('token').satz, /Deine Antworten bleiben auf diesem Gerät in der Schlange\.$/);
  assert.equal(f('limit', { bis: ort(2026, 11, 14, 15, 12) }).titel, 'GitHub bremst');
  assert.match(f('limit', { bis: ort(2026, 11, 14, 15, 12) }).satz, /^Der nächste Versuch läuft um 15:12\. Dein Stand von 14:02 bleibt erhalten\.$/);
  assert.match(f('limit').satz, /^Der nächste Versuch läuft später\./);
  assert.equal(f('netz').titel, 'Ohne Netz');
  assert.equal(f('netz').ton, 'ruhig');
  assert.equal(f('nicht-gefunden').aktion, 'erneut');
  assert.equal(fehlerAnzeige({ art: 'netz', message: 'm' }, null).satz.endsWith('Auf diesem Gerät gibt es noch keinen Stand.'), true);
  assert.equal(f('gibt-es-nicht').titel, 'Abgleich fehlgeschlagen', 'unbekannte Arten fallen auf den allgemeinen Fehler zurück');
});

test('die Einzelheiten nennen Art, Status und Meldung für den, der sie braucht (GRM-3)', () => {
  const a = fehlerAnzeige({ art: 'token', status: 401, message: 'Token abgelehnt', ursache: 'Bad credentials' }, null);
  assert.equal(a.einzelheiten, 'Art: token\nStatus: 401\nMeldung: Token abgelehnt\nUrsache: Bad credentials');
  assert.equal(fehlerAnzeige({ art: 'netz', message: 'x' }, null).einzelheiten, 'Art: netz\nMeldung: x');
});

test('kein Text der App hat Ausrufezeichen, Gedankenstrich, Sie-Anrede oder Füllwörter (TXT-3, TXT-8, TXT-9)', () => {
  const texte = [];
  for (const art of ['netz', 'limit', 'token', 'verboten', 'nicht-gefunden', 'zu-gross', 'antwort', 'intern']) {
    const a = fehlerAnzeige({ art, message: 'm', bis: 1_800_000_000_000 }, ort(2026, 11, 14, 14, 2));
    texte.push(a.titel, a.satz);
  }
  texte.push(ohneNetzZeile(1), speicherAnzeige({ dauerhaft: false }, 'indexeddb', 1).warnung, speicherAnzeige(null, 'arbeitsspeicher', 0).warnung,
    fortschrittAnzeige({ phase: 'dateien', fertig: 1, gesamt: 2 }).text);
  for (const t of texte) {
    assert.doesNotMatch(t, /!|—| – /, t);
    assert.doesNotMatch(t, /\b(Sie|Ihr|Ihre|Ihnen)\b/, t);
    assert.doesNotMatch(t, /\b(einfach|nur|natürlich|bitte)\b/i, t);
  }
});
