// Die Mock-Quelle läuft im Browser ohne node:crypto; ihre SHA-1 und Base64 müssen dasselbe liefern wie Node, sonst
// stimmen die Prüfsummen der Vorschau und des Wegetests nicht mit denen von Git überein.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { blobSha, sha1Hex } from './hilfen/mockquelle.mjs';

const kodiere = (t) => new TextEncoder().encode(t);

test('sha1Hex stimmt mit node:crypto überein, auch an den Blockgrenzen und bei Umlauten', () => {
  const proben = ['', 'a', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(63), 'x'.repeat(64), 'x'.repeat(65), 'Größe: ä ö ü ß – 日本', 'z'.repeat(1000)];
  for (const p of proben) assert.equal(sha1Hex(kodiere(p)), createHash('sha1').update(p).digest('hex'), `Länge ${p.length}`);
});

test('blobSha bildet die Prüfsumme eines Git-Blobs: SHA-1 über „blob LÄNGE\\0“ und den Text', () => {
  for (const text of ['', 'hallo\n', 'Größe ä\n']) {
    const bytes = Buffer.from(text);
    const soll = createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
    assert.equal(blobSha(text), soll);
  }
});
