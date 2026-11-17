// Die Zeile „Ohne Netz“ (js/netz.js): sie wechselt nie unter dem Finger, damit ein Tipp trifft, was der Nutzer vor sich sah.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { netzZeile, RUHE_MS, WIEDER_MS } from '../js/netz.js';

function aufbau() {
  const horcher = new Map();
  const ziel = { addEventListener: (n, f) => horcher.set(n, f) };
  const span = { textContent: '' };
  const zeile = { hidden: true, querySelector: () => span };
  const steuerung = { zustand: { ohneNetz: false, letzter: null }, f: null, beiAenderung(f) { this.f = f; } };
  const uhr = { ms: 100_000 };
  const aufgaben = [];
  const zeitgeber = { setze: (f, ms) => aufgaben.push({ f, ms }) };
  netzZeile(zeile, steuerung, { jetzt: () => uhr.ms, zeitgeber, ziel, online: () => true });
  const ereignis = (type) => horcher.get(type)({ type });
  const offline = (an) => { steuerung.zustand = { ...steuerung.zustand, ohneNetz: an }; steuerung.f(steuerung.zustand); };
  const tick = () => { const a = aufgaben.shift(); a.f(); };
  return { zeile, span, uhr, aufgaben, ereignis, offline, tick };
}

test('Ohne Berührung erscheint die Zeile sofort und nennt den Satz', () => {
  const a = aufbau();
  assert.equal(a.zeile.hidden, true);
  a.offline(true);
  assert.equal(a.zeile.hidden, false);
  assert.match(a.span.textContent, /^Ohne Netz: /);
  a.offline(false);
  assert.equal(a.zeile.hidden, true);
});

test('Liegt ein Finger auf dem Bildschirm, bleibt die Zeile weg; sie kommt erst eine Sekunde nach der Berührung', () => {
  const a = aufbau();
  a.ereignis('pointerdown');
  a.offline(true);
  assert.equal(a.zeile.hidden, true);
  assert.equal(a.aufgaben[0].ms, WIEDER_MS);
  a.uhr.ms += 5000; a.tick();
  assert.equal(a.zeile.hidden, true, 'der Finger liegt noch');
  a.ereignis('pointerup');
  a.uhr.ms += 200; a.tick();
  assert.equal(a.zeile.hidden, true, 'zu kurz nach der Berührung');
  a.uhr.ms += RUHE_MS; a.tick();
  assert.equal(a.zeile.hidden, false);
});

test('Auch das Verschwinden und Scrollen warten, bis Ruhe ist', () => {
  const a = aufbau();
  a.offline(true);
  a.ereignis('scroll');
  a.offline(false);
  assert.equal(a.zeile.hidden, false);
  a.uhr.ms += RUHE_MS; a.tick();
  assert.equal(a.zeile.hidden, true);
});

test('Wechselt der Zustand zurück, ehe die Zeile durfte, bleibt alles, wie es war', () => {
  const a = aufbau();
  a.ereignis('pointerdown'); a.ereignis('pointerup');
  a.offline(true); a.offline(false);
  a.uhr.ms += RUHE_MS; a.tick();
  assert.equal(a.zeile.hidden, true);
  assert.equal(a.aufgaben.length, 0, 'es läuft kein weiterer Zeitgeber');
});
