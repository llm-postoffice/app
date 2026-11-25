import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { VERSION } from '../js/version.js';

const lies = (datei) => readFile(new URL(`../${datei}`, import.meta.url), 'utf8');

test('die Fassung hat die Form YYYYMMDD.NN mit einem echten Datum', () => {
  const m = /^(\d{4})(\d{2})(\d{2})\.(\d{2})$/.exec(VERSION);
  assert.ok(m, `${VERSION} ist nicht YYYYMMDD.NN`);
  const [, j, mo, t, nn] = m.map(Number);
  const d = new Date(Date.UTC(j, mo - 1, t));
  assert.equal(d.getUTCFullYear(), j);
  assert.equal(d.getUTCMonth(), mo - 1);
  assert.equal(d.getUTCDate(), t);
  assert.ok(nn >= 1, 'NN beginnt bei 01');
});

test('die Fassung steht gleich in sw.js', async () => {
  const sw = await lies('sw.js');
  assert.equal(/const FASSUNG = '([^']+)'/.exec(sw)?.[1], `postfach-${VERSION}`);
});

test('die Fassung steht gleich in der obersten CHANGELOG-Überschrift', async () => {
  const changelog = await lies('CHANGELOG.md');
  // Ein Abschnitt „Unveröffentlicht“ darf davor stehen; die Fassung erhöht erst die Veröffentlichung.
  const erste = changelog.split('\n').find((z) => z.startsWith('## ') && z !== '## Unveröffentlicht');
  assert.ok(erste?.startsWith(`## ${VERSION} (`), `oberste Überschrift: ${erste}`);
  assert.match(erste, /\(\d{4}-\d{2}-\d{2}\)$/, 'ISO-Datum in der Überschrift (DCH-1)');
});
