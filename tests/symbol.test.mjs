// Das Symbol der App hat eine Quelle, tools/symbol.svg: Buchstaben sind Striche, keine Schrift; die Bilder
// aus make symbole haben die Größe, die das Manifest nennt.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

const wurzel = new URL('../', import.meta.url).pathname;
const lies = (datei) => readFile(join(wurzel, datei), 'utf8');

/** Breite und Höhe eines PNG aus dem IHDR-Block. */
async function groesse(datei) {
  const b = await readFile(join(wurzel, datei));
  assert.deepEqual([...b.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${datei} ist kein PNG`);
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

test('die Quelle des Symbols nutzt keine Schrift', async () => {
  const svg = await lies('tools/symbol.svg');
  assert.doesNotMatch(svg, /<text/);
  assert.doesNotMatch(svg, /font/);
});

test('die Bilder des Manifests haben die Größe aus sizes', async () => {
  const { icons } = JSON.parse(await lies('manifest.webmanifest'));
  assert.equal(icons.length, 3);
  for (const s of icons) assert.equal(await groesse(s.src), s.sizes, s.src);
});
