// Speicher: der Vertrag der Schnittstelle am Speicher im Arbeitsspeicher (IndexedDB prüft tools/wege.mjs in Chromium),
// Einstellungen und die Bitte um dauerhaften Speicher.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SPEICHER, einstellung, oeffneDatenbank, oeffneOderRueckfall, setzeEinstellung, speicherDatenbank, speicherSichern } from '../js/speicher.js';
import { vertrag } from './hilfen/speichervertrag.mjs';

test('der Speicher im Arbeitsspeicher erfüllt den Vertrag der Schnittstelle', async () => {
  assert.deepEqual(await vertrag(speicherDatenbank()), []);
});

test('das Schema nennt alle Speicher, die Teil C, E und die Anhänge brauchen', () => {
  assert.deepEqual(Object.keys(SPEICHER).sort(), ['anhaenge', 'baum', 'dateien', 'einstellungen', 'entwuerfe', 'schlange']);
  assert.deepEqual(SPEICHER.schlange.indizes, ['zustand']);
});

test('Einstellungen: Vorgabe, schreiben, lesen', async () => {
  const db = speicherDatenbank();
  assert.equal(await einstellung(db, 'takt', 120), 120);
  await setzeEinstellung(db, 'takt', 300);
  assert.equal(await einstellung(db, 'takt', 120), 300);
});

test('ohne IndexedDB gibt es den Speicher im Arbeitsspeicher als Rückfall', async () => {
  await assert.rejects(() => oeffneDatenbank(undefined));
  const db = await oeffneOderRueckfall({ open() { throw new Error('gesperrt'); } });
  assert.equal(db.art, 'arbeitsspeicher');
});

test('speicherSichern: gewährt, abgelehnt, schon gewährt und ohne Schnittstelle', async () => {
  const fall = async (speicher) => { const db = speicherDatenbank(); const r = await speicherSichern(db, speicher, () => 42); return [r, await einstellung(db, 'speicher')]; };
  assert.deepEqual(await fall({ persist: async () => true, persisted: async () => false }), [true, { dauerhaft: true, geprueft: 42 }]);
  assert.deepEqual(await fall({ persist: async () => false, persisted: async () => false }), [false, { dauerhaft: false, geprueft: 42 }]);
  let gefragt = false;
  assert.deepEqual(await fall({ persist: async () => { gefragt = true; return false; }, persisted: async () => true }), [true, { dauerhaft: true, geprueft: 42 }]);
  assert.equal(gefragt, false, 'wer schon dauerhaft speichert, wird nicht noch einmal gefragt');
  assert.deepEqual(await fall(undefined), [null, { dauerhaft: null, geprueft: 42 }]);
  assert.deepEqual(await fall({ persist: async () => { throw new Error('nein'); } }), [null, { dauerhaft: null, geprueft: 42 }]);
});
