// Material You: die Tabelle der Töne in der Hülle (Farben.kt) und in der Vorschau (tests/hilfen/farbrollen.mjs) ist dieselbe,
// die Beispielpaletten haben die Töne von Android, und die Rollen halten den Kontrast auf jeder Beispielpalette.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { ROLLEN } from '../js/farben.js';
import { PALETTEN, TABELLE, TOENE, farbenNachricht, kontrast, rollen } from './hilfen/farbrollen.mjs';

const lies = (d) => readFile(new URL(`../${d}`, import.meta.url), 'utf8');

test('die Tabelle in Farben.kt ist die der Vorschau', async () => {
  const kt = await lies('android/app/src/main/kotlin/io/github/llm_postoffice/llmpost/Farben.kt');
  const zeilen = [...kt.matchAll(/Rolle\("([a-z-]+)", "(\w+)", (\d+), "(\w+)", (\d+)\)/g)].map((m) => [m[1], m[2], Number(m[3]), m[4], Number(m[5])]);
  assert.deepEqual(zeilen, TABELLE);
});

test('die Tabelle nennt genau die Rollen, die die Seite annimmt, und nur Töne von Android', () => {
  assert.deepEqual(TABELLE.map((z) => z[0]), ROLLEN);
  for (const z of TABELLE) {
    assert.ok(z[2] in TOENE && z[4] in TOENE, z[0]);
    for (const p of [z[1], z[3]]) assert.ok(['accent1', 'accent2', 'accent3', 'neutral1', 'neutral2'].includes(p), z[0]);
  }
});

test('die Beispielpaletten haben alle Töne, von Weiß bis Schwarz', () => {
  for (const [name, pal] of Object.entries(PALETTEN)) {
    for (const [p, toene] of Object.entries(pal)) {
      assert.deepEqual(Object.keys(toene).map(Number).sort((a, b) => a - b), Object.keys(TOENE).map(Number), `${name} ${p}`);
      assert.equal(toene[0], '#ffffff');
      assert.equal(toene[1000], '#000000');
    }
  }
});

test('farbenNachricht ist eine gültige Nachricht der Hülle', () => {
  const n = farbenNachricht('gruen');
  assert.equal(n.art, 'farben');
  assert.deepEqual(Object.keys(n.hell), ROLLEN);
  assert.deepEqual(Object.keys(n.dunkel), ROLLEN);
});

// [Vordergrund, Hintergrund, Schwelle]: Text 4,5, Symbole, Kanten und Knopfflächen 3
const PAARE = [['text', 'grund', 4.5], ['text', 'flaeche', 4.5], ['neben', 'grund', 4.5], ['neben', 'flaeche', 4.5], ['auf-akzent', 'akzent', 4.5],
  ['auf-tonal', 'tonal', 4.5], ['akzent', 'grund', 4.5], ['akzent', 'flaeche', 4.5], ['akzent', 'tonal', 3], ['auf-umgekehrt', 'umgekehrt', 4.5],
  ['hinweis-knopf', 'umgekehrt', 4.5]];

test('jede Beispielpalette hält den Kontrast der Rollen, hell und dunkel', () => {
  for (const name of Object.keys(PALETTEN)) {
    for (const schema of ['hell', 'dunkel']) {
      const r = rollen(PALETTEN[name], schema);
      for (const [v, h, min] of PAARE) assert.ok(kontrast(r[v], r[h]) >= min, `${name} ${schema} ${v} auf ${h}: ${kontrast(r[v], r[h]).toFixed(2)}`);
    }
  }
});
