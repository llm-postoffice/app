// Die Bildprüfung von tools/rendern.mjs: leere, fehlende und doppelte Bilder sind Befunde, echte Bilder nicht.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';
import { abweichung, lesePng, pruefeBilder } from '../tools/bilder.mjs';

const chunk = (art, inhalt) => {
  const kopf = Buffer.alloc(8); kopf.writeUInt32BE(inhalt.length); kopf.write(art, 4, 'latin1');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([kopf.subarray(4), inhalt])));
  return Buffer.concat([kopf, inhalt, crc]);
};
/** Schreibt ein RGB-PNG; `filter` 0 bis 4 filtert alle Zeilen so, wie ein Encoder es täte. */
function png(breite, hoehe, pixel, filter = 0) {
  const zeile = breite * 3;
  const roh = Buffer.alloc(hoehe * (zeile + 1));
  const wert = (x, y) => pixel(Math.floor(x / 3), y)[x % 3];
  for (let y = 0; y < hoehe; y++) {
    roh[y * (zeile + 1)] = filter;
    for (let x = 0; x < zeile; x++) {
      const a = x >= 3 ? wert(x - 3, y) : 0; const b = y ? wert(x, y - 1) : 0; const c = x >= 3 && y ? wert(x - 3, y - 1) : 0;
      const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
      const vorher = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      roh[y * (zeile + 1) + 1 + x] = (wert(x, y) - vorher) & 255;
    }
  }
  const kopf = Buffer.alloc(13); kopf.writeUInt32BE(breite, 0); kopf.writeUInt32BE(hoehe, 4); kopf[8] = 8; kopf[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', kopf), chunk('IDAT', deflateSync(roh)), chunk('IEND', Buffer.alloc(0))]);
}
const weiss = () => [255, 255, 255];
// Ein Bild mit Inhalt: weißer Grund mit Streifen und Krümeln wie Text, die sich je `n` unterscheiden
const mitInhalt = (n) => png(300, 400, (x, y) => {
  const krume = ((x * 7919 + y * 104729 + n * 15485863) >>> 0) % 11 === 0 && y > 50 && y < 300;
  return krume ? [(x * 13 + n) & 255, (y * 29) & 255, 90] : [255, 255, 255];
});

test('lesePng entfernt jeden Filter wieder', () => {
  for (let f = 0; f <= 4; f++) {
    const p = (x, y) => [(x * 7 + y) & 255, (y * 3) & 255, (x ^ y) & 255];
    const bild = lesePng(png(20, 10, p, f));
    assert.equal(bild.daten[(3 * 20 + 5) * 3 + 1], p(5, 3)[1], `Filter ${f}`);
    assert.equal(bild.daten[(9 * 20 + 19) * 3 + 2], p(19, 9)[2], `Filter ${f}`);
  }
});

test('abweichung: einfarbig 0, mit Inhalt deutlich darüber', () => {
  assert.equal(abweichung(lesePng(png(100, 100, weiss))), 0);
  assert.ok(abweichung(lesePng(mitInhalt(0))) > 0.02);
});

// Neutrale Endungen: das Werkzeug kennt keine; es nimmt, was der Renderer schreibt
const VARIANTEN = ['klein-hell', 'klein-dunkel', 'gross-hell', 'gross-dunkel', 'klein-text200', 'klein-offline'];
function szenario(dateien) {
  const ordner = mkdtempSync(join(tmpdir(), 'bilder-'));
  for (const [name, inhalt] of Object.entries(dateien)) writeFileSync(join(ordner, name), inhalt);
  return ordner;
}
const alle = (adr, n) => Object.fromEntries(VARIANTEN.map((v) => [`${adr}-${v}.png`, mitInhalt(n)]));

test('pruefeBilder: gute Bilder ergeben keinen Befund; Adressen mit / heißen im Dateinamen mit -', () => {
  const ordner = szenario({ ...alle('wartet', 1), ...alle('eintrag-r2d4vn', 2) });
  try { assert.deepEqual(pruefeBilder(ordner, ['wartet', 'eintrag/r2d4vn']), []); } finally { rmSync(ordner, { recursive: true }); }
});

test('pruefeBilder: ein leeres Bild nennt Adresse und Variante', () => {
  const ordner = szenario({ ...alle('wartet', 1), ...alle('alle', 2), 'alle-klein-dunkel.png': png(360, 800, weiss) });
  try {
    const befunde = pruefeBilder(ordner, ['wartet', 'alle']);
    assert.equal(befunde.length, 1);
    assert.match(befunde[0], /^alle \(klein-dunkel\): Bild leer/);
  } finally { rmSync(ordner, { recursive: true }); }
});

test('pruefeBilder: eine winzige oder kaputte Datei ist ein Befund, kein Absturz', () => {
  const kaputt = Object.fromEntries(VARIANTEN.slice(1).map((v) => [`alle-${v}.png`, Buffer.alloc(5000, 1)]));
  const ordner = szenario({ ...alle('wartet', 1), 'alle-klein-hell.png': Buffer.alloc(0), ...kaputt });
  try {
    const befunde = pruefeBilder(ordner, ['wartet', 'alle']);
    assert.equal(befunde.length, VARIANTEN.length);
    assert.ok(befunde.some((b) => /^alle \(klein-hell\): Bild leer \(0 Bytes\)/.test(b)));
    assert.ok(befunde.some((b) => /^alle \(gross-dunkel\): Bild nicht lesbar/.test(b)));
  } finally { rmSync(ordner, { recursive: true }); }
});

test('pruefeBilder: eine Variante, die andere Adressen haben, fehlt als Befund; eine, die keine hat, nicht', () => {
  const dateien = alle('wartet', 1);
  delete dateien['wartet-gross-hell.png'];
  const ordner = szenario({ ...dateien, ...alle('alle', 2) });
  try { assert.deepEqual(pruefeBilder(ordner, ['wartet', 'alle']), ['wartet (gross-hell): Bild fehlt']); } finally { rmSync(ordner, { recursive: true }); }
  const ohne = Object.fromEntries(Object.entries(alle('wartet', 1)).filter(([n]) => !n.includes('offline')));
  const ordner2 = szenario({ ...ohne, ...Object.fromEntries(Object.entries(alle('alle', 2)).filter(([n]) => !n.includes('offline'))) });
  try { assert.deepEqual(pruefeBilder(ordner2, ['wartet', 'alle']), []); } finally { rmSync(ordner2, { recursive: true }); }
});

test('pruefeBilder: ohne ein einziges Bild ist jede Adresse ein Befund; Adressen, die mit dem Namen einer anderen beginnen, bleiben getrennt', () => {
  const leer = szenario({});
  try { assert.deepEqual(pruefeBilder(leer, ['wartet', 'alle']), ['wartet: keine Bilder', 'alle: keine Bilder']); } finally { rmSync(leer, { recursive: true }); }
  const ordner = szenario({ ...alle('alle', 1), ...alle('alle-status', 2) });
  try { assert.deepEqual(pruefeBilder(ordner, ['alle', 'alle/status']), []); } finally { rmSync(ordner, { recursive: true }); }
});

test('pruefeBilder: dasselbe Bild für zwei Adressen zeigt die Hülle statt der Ansicht', () => {
  const ordner = szenario({ ...alle('wartet', 1), ...alle('alle', 1) });
  try {
    const befunde = pruefeBilder(ordner, ['wartet', 'alle']);
    assert.equal(befunde.length, VARIANTEN.length);
    assert.ok(befunde.every((b) => /^alle \(.+\): dasselbe Bild wie wartet/.test(b)));
  } finally { rmSync(ordner, { recursive: true }); }
});

test('Vorschau: der Service Worker eines Szenarios hält alle Dateien, die der Einstieg ohne Netz braucht', async () => {
  const { starteVorschau } = await import('../tools/vorschau.mjs');
  const { server, basis } = await starteVorschau();
  try {
    const sw = await (await fetch(`${basis}/leer/sw.js`)).text();
    // anhangdaten.mjs importiert js/anhaenge.js über die Wurzel, nicht über /leer/: ohne Eintrag blieb die Hülle leer
    for (const d of ['../tests/hilfen/beispieldaten.mjs', '../tests/hilfen/anhangdaten.mjs', '../js/anhaenge.js']) assert.ok(sw.includes(`'${d}'`), d);
  } finally { server.close(); }
});

test('Vorschau: der Einstieg jedes Szenarios setzt window.fertig zuletzt, und das Rendern wartet darauf statt auf eine feste Pause', async () => {
  const { starteVorschau } = await import('../tools/vorschau.mjs');
  const { ADRESSEN } = await import('./hilfen/beispieldaten.mjs');
  const { server, basis } = await starteVorschau();
  try {
    for (const name of Object.keys(ADRESSEN)) {
      const start = await (await fetch(`${basis}/${name}/js/start.js`)).text();
      assert.ok(start.trimEnd().endsWith('window.fertig = true;'), `${name}: window.fertig steht nicht am Ende des Einstiegs`);
    }
  } finally { server.close(); }
  // Das Rendern gibt dem Renderer die Bedingung mit (--bereit); die Pause --warte ist nur noch die Obergrenze
  const rendern = readFileSync(new URL('../tools/rendern.mjs', import.meta.url), 'utf8');
  assert.match(rendern, /`--bereit=\$\{BEREIT\}`/);
  assert.match(rendern, /BEREIT = '[^']*window\.fertig === true/);
});
