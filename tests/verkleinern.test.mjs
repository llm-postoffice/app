// Bilder verkleinern (js/verkleinern.js, bereiteVor in js/anhaenge.js): der Ablauf mit Attrappen für createImageBitmap und
// OffscreenCanvas. Echte Bilder in Chromium prüft der Wegetest.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KANTEN, QUALITAETEN, mitEndung, verkleinereBild } from '../js/verkleinern.js';
import { ANHANG_MAX, BILD_QUELLE_MAX, bereiteVor, verkleinerbar, wirdUmkodiert } from '../js/anhaenge.js';

/**
 * Eine Umgebung, in der die Größe des Ergebnisses aus Fläche, Qualität und Format folgt: Bytes = Pixel × Qualität × `dichte`
 * (WebP ist 20 % kleiner). `ohneWebp` lässt convertToBlob wie Chromium bei einem unbekannten Typ auf PNG zurückfallen.
 */
function umgebung({ breite = 4000, hoehe = 3000, dichte = 0.2, ohneWebp = false, lesbar = true } = {}) {
  const aufrufe = { bitmap: [], kodiert: [], zeichnen: [] };
  return {
    aufrufe,
    createImageBitmap: async (blob, optionen) => {
      aufrufe.bitmap.push(optionen);
      if (!lesbar) throw new Error('nicht dekodierbar');
      return { width: breite, height: hoehe, close() { aufrufe.geschlossen = true; } };
    },
    OffscreenCanvas: class {
      constructor(b, h) { this.b = b; this.h = h; }
      getContext() { return { fillStyle: '', fillRect() {}, imageSmoothingQuality: '', drawImage: (_, __, ___, b, h) => aufrufe.zeichnen.push([b, h]) }; }
      async convertToBlob({ type, quality }) {
        aufrufe.kodiert.push([this.b, this.h, type, quality]);
        const echt = type === 'image/webp' && ohneWebp ? 'image/png' : type;
        return new Blob([new Uint8Array(Math.round(this.b * this.h * quality * dichte * (echt === 'image/webp' ? 0.8 : 1)))], { type: echt });
      }
    },
  };
}

test('mitEndung ersetzt die Endung oder hängt eine an', () => {
  assert.equal(mitEndung('IMG_1.HEIC', 'jpg'), 'IMG_1.jpg');
  assert.equal(mitEndung('foto', 'webp'), 'foto.webp');
  assert.equal(mitEndung('a.b.png', 'jpg'), 'a.b.jpg');
  assert.equal(mitEndung('Bild (2).jpeg', 'jpg'), 'Bild (2).jpg');
});

test('Die Stufen: die Kanten fallen, die Qualität fällt, die erste Stufe, die passt, gilt', async () => {
  assert.deepEqual(KANTEN, [2560, 2048, 1600, 1280]);
  assert.deepEqual(QUALITAETEN, [0.85, 0.78, 0.7]);
  const u = umgebung();
  const r = await verkleinereBild(new Blob([new Uint8Array(5)]), 'IMG_1.png', { umgebung: u });
  assert.ok(r.ok);
  assert.deepEqual([r.breite, r.hoehe], [2560, 1920], 'die längste Kante ist 2560, das Verhältnis bleibt');
  assert.deepEqual(u.aufrufe.bitmap, [{ imageOrientation: 'from-image' }], 'die Ausrichtung nach Exif wird angewendet');
  assert.ok(r.blob.size <= ANHANG_MAX);
  assert.equal(u.aufrufe.geschlossen, true, 'das Bild wird freigegeben');
});

test('WebP, wenn es kleiner ist, sonst JPEG; fällt convertToBlob auf PNG zurück, gilt das Ergebnis nicht', async () => {
  const webp = await verkleinereBild(new Blob(['x']), 'a.jpg', { umgebung: umgebung() });
  assert.equal(webp.typ, 'image/webp');
  assert.equal(webp.name, 'a.webp');
  const jpg = await verkleinereBild(new Blob(['x']), 'a.png', { umgebung: umgebung({ ohneWebp: true }) });
  assert.equal(jpg.typ, 'image/jpeg');
  assert.equal(jpg.name, 'a.jpg');
});

test('Ist die erste Stufe zu groß, geht es kleiner: erst die Qualität, dann die Kante', async () => {
  const u = umgebung({ dichte: 0.6 });
  const r = await verkleinereBild(new Blob(['x']), 'a.jpg', { umgebung: u });
  assert.ok(r.ok);
  const jpeg = u.aufrufe.kodiert.filter((k) => k[2] === 'image/jpeg');
  assert.deepEqual(jpeg.slice(0, 3).map((k) => k[3]), [0.85, 0.78, 0.7], 'bei jeder Kante fällt die Qualität');
  assert.ok(jpeg.at(-1)[0] < 2560, 'danach fällt die Kante');
  assert.ok(r.blob.size <= ANHANG_MAX);
});

test('Ein kleines Bild wird nie hochgerechnet: die Kante bleibt höchstens so lang wie das Bild', async () => {
  const u = umgebung({ breite: 1500, hoehe: 1000, dichte: 5 });
  const r = await verkleinereBild(new Blob(['x']), 'a.png', { umgebung: u });
  assert.equal(r.ok, false);
  assert.equal(r.grund, 'zu-gross');
  assert.ok(u.aufrufe.zeichnen.every(([b]) => b <= 1500));
  assert.deepEqual([...new Set(u.aufrufe.zeichnen.map(([b]) => b))], [1500, 1280], 'doppelte Stufen fallen weg');
});

test('Nicht lesbar und nicht verfügbar sind eigene Gründe', async () => {
  assert.deepEqual(await verkleinereBild(new Blob(['x']), 'a.heic', { umgebung: umgebung({ lesbar: false }) }), { ok: false, grund: 'nicht-lesbar' });
  assert.deepEqual(await verkleinereBild(new Blob(['x']), 'a.jpg', { umgebung: {} }), { ok: false, grund: 'nicht-verfuegbar' });
});

test('verkleinerbar: JPEG, PNG, WebP, HEIC nach Typ oder Endung; GIF, SVG und der Rest nie', () => {
  for (const [n, t] of [['a.jpg', 'image/jpeg'], ['a', 'image/png'], ['a.webp', ''], ['a.HEIC', 'application/octet-stream'], ['a.heif', 'image/heif']]) assert.ok(verkleinerbar(n, t), `${n} ${t}`);
  for (const [n, t] of [['a.gif', 'image/gif'], ['a.svg', 'image/svg+xml'], ['a.pdf', 'application/pdf'], ['a.jpg', 'image/gif'], ['a', '']]) assert.ok(!verkleinerbar(n, t), `${n} ${t}`);
});

test('bereiteVor: bis 1 MiB bleibt alles, wie es ist', async () => {
  const bytes = Uint8Array.from([1, 2, 3]);
  let gerufen = 0;
  const r = await bereiteVor({ name: 'a.png', typ: 'image/png', groesse: 3, bytes }, async () => { gerufen++; return { ok: false }; });
  assert.deepEqual(r, { ok: true, name: 'a.png', typ: 'image/png', groesse: 3, daten: 'AQID' });
  assert.equal(gerufen, 0);
  const aus = await bereiteVor({ name: 'b.jpg', typ: 'image/jpeg', groesse: ANHANG_MAX, blob: new Blob([bytes]) }, null);
  assert.equal(aus.daten, 'AQID');
  assert.equal(aus.vorher, undefined);
});

test('bereiteVor: ein Bild über 1 MiB geht an verkleinere, das Ergebnis trägt die frühere Größe', async () => {
  const gesehen = [];
  const r = await bereiteVor({ name: 'IMG_1.heic', typ: 'image/heic', groesse: 4 * ANHANG_MAX, bytes: new Uint8Array(3) },
    async (blob, name) => { gesehen.push([blob.size, blob.type, name]); return { ok: true, blob: new Blob([Uint8Array.from([1, 2, 3])]), typ: 'image/jpeg', name: 'IMG_1.jpg' }; });
  assert.deepEqual(gesehen, [[3, 'image/heic', 'IMG_1.heic']]);
  assert.deepEqual(r, { ok: true, name: 'IMG_1.jpg', typ: 'image/jpeg', groesse: 3, daten: 'AQID', vorher: 4 * ANHANG_MAX });
});

test('bereiteVor: abgelehnt wird mit Satz, ohne die Datei zu lesen', async () => {
  const nie = { arrayBuffer: async () => { throw new Error('gelesen'); }, size: 0 };
  const pdf = await bereiteVor({ name: 'b.pdf', typ: 'application/pdf', groesse: 2 * ANHANG_MAX, blob: nie }, async () => ({ ok: true }));
  assert.match(pdf.fehler, /^b\.pdf ist 2,0 MiB groß; erlaubt sind höchstens 1,0 MiB\. Verkleinere die Datei und wähle sie noch einmal\.$/);
  const riesig = await bereiteVor({ name: 'r.jpg', typ: 'image/jpeg', groesse: BILD_QUELLE_MAX + 1, blob: nie }, async () => ({ ok: true }), 'wähle');
  assert.match(riesig.fehler, /^r\.jpg ist 20,0 MiB groß; Bilder verkleinert die App bis 20,0 MiB\. Verkleinere das Bild und wähle es noch einmal\.$/);
  const lesbar = await bereiteVor({ name: 'x.heic', typ: 'image/heic', groesse: 2 * ANHANG_MAX, blob: nie }, async () => ({ ok: false, grund: 'nicht-lesbar' }));
  assert.match(lesbar.fehler, /^x\.heic ist 2,0 MiB groß, und die App kann es nicht verkleinern\. Erlaubt sind höchstens 1,0 MiB\. Verkleinere das Bild und wähle es noch einmal\.$/);
  const gross = await bereiteVor({ name: 'y.png', typ: 'image/png', groesse: 9 * ANHANG_MAX, blob: nie }, async () => ({ ok: false, grund: 'zu-gross' }));
  assert.match(gross.fehler, /^y\.png ist 9,0 MiB groß, lässt sich aber nicht auf 1,0 MiB verkleinern\. Wähle eine kleinere Fassung\.$/);
  const ohne = await bereiteVor({ name: 'z.png', typ: 'image/png', groesse: 2 * ANHANG_MAX, blob: nie }, null);
  assert.match(ohne.fehler, /z\.png ist 2,0 MiB groß; erlaubt sind höchstens 1,0 MiB/);
});

test('wirdUmkodiert: Fotos immer, PNG nur über 1 MiB, alles andere nie', () => {
  const klein = 1000;
  const gross = 2 * ANHANG_MAX;
  for (const [n, t] of [['a.jpg', 'image/jpeg'], ['a.webp', 'image/webp'], ['a.heic', 'image/heic'], ['a.HEIF', ''], ['a', 'image/jpeg']]) {
    assert.ok(wirdUmkodiert(n, t, klein) && wirdUmkodiert(n, t, gross), `${n} ${t}`);
  }
  for (const [n, t] of [['a.png', 'image/png'], ['a.PNG', 'application/octet-stream']]) {
    assert.ok(!wirdUmkodiert(n, t, klein) && !wirdUmkodiert(n, t, ANHANG_MAX) && wirdUmkodiert(n, t, ANHANG_MAX + 1), `${n} ${t}`);
  }
  for (const [n, t] of [['a.gif', 'image/gif'], ['a.svg', 'image/svg+xml'], ['a.pdf', 'application/pdf'], ['a.txt', 'text/plain']]) assert.ok(!wirdUmkodiert(n, t, gross), `${n} ${t}`);
});

test('bereiteVor: ein Foto unter 1 MiB wird neu kodiert, wenn das Ergebnis kleiner ist', async () => {
  const original = new Uint8Array(500);
  const r = await bereiteVor({ name: 'IMG_7.jpeg', typ: 'image/jpeg', groesse: original.length, bytes: original },
    async () => ({ ok: true, blob: new Blob([new Uint8Array(200)], { type: 'image/jpeg' }), typ: 'image/jpeg', name: 'IMG_7.jpg' }));
  assert.deepEqual([r.ok, r.name, r.groesse, r.vorher], [true, 'IMG_7.jpg', 200, 500]);
});

test('bereiteVor: ist das Ergebnis nicht kleiner oder lässt sich das Foto nicht lesen, bleibt das Original', async () => {
  const original = Uint8Array.from([1, 2, 3, 4]);
  const gleich = await bereiteVor({ name: 'a.jpg', typ: 'image/jpeg', groesse: 4, bytes: original }, async () => ({ ok: true, blob: new Blob([new Uint8Array(9)], { type: 'image/jpeg' }), typ: 'image/jpeg', name: 'a.jpg' }));
  assert.deepEqual(gleich, { ok: true, name: 'a.jpg', typ: 'image/jpeg', groesse: 4, daten: 'AQIDBA==' });
  const heic = await bereiteVor({ name: 'a.heic', typ: 'image/heic', groesse: 4, bytes: original }, async () => ({ ok: false, grund: 'nicht-lesbar' }));
  assert.deepEqual(heic, { ok: true, name: 'a.heic', typ: 'image/heic', groesse: 4, daten: 'AQIDBA==' });
  const wirft = await bereiteVor({ name: 'a.webp', typ: 'image/webp', groesse: 4, bytes: original }, async () => { throw new Error('x'); });
  assert.equal(wirft.ok, true);
  assert.equal(wirft.vorher, undefined);
});

test('bereiteVor: ein PNG bis 1 MiB bleibt, ein PNG darüber wird wie ein Foto umgewandelt', async () => {
  let gerufen = 0;
  const verkleinere = async () => { gerufen++; return { ok: true, blob: new Blob([new Uint8Array(7)], { type: 'image/jpeg' }), typ: 'image/jpeg', name: 'kamera.jpg' }; };
  const klein = await bereiteVor({ name: 'beleg.png', typ: 'image/png', groesse: ANHANG_MAX, bytes: new Uint8Array(ANHANG_MAX) }, verkleinere);
  assert.equal(klein.vorher, undefined);
  assert.equal(gerufen, 0);
  const gross = await bereiteVor({ name: 'kamera.png', typ: 'image/png', groesse: ANHANG_MAX + 1, bytes: new Uint8Array(ANHANG_MAX + 1) }, verkleinere);
  assert.deepEqual([gross.name, gross.typ, gross.groesse, gross.vorher], ['kamera.jpg', 'image/jpeg', 7, ANHANG_MAX + 1]);
  assert.equal(gerufen, 1);
});
