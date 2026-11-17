// Prüft die Bilder, die der Renderer schreibt: ein leeres Bild oder dasselbe Bild für zwei Adressen eines Szenarios ist ein Fehler.
// Der Renderer prüft den Aufbau der Seite, nicht, ob sie fertig gestartet ist; bricht der Start ab, bleibt die Hülle ohne Inhalt,
// und alle seine Prüfungen melden trotzdem PASS. Rein bis auf das Lesen der Dateien; PNG liest zlib aus Node.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

/** Ein Bild gilt als leer, wenn weniger als dieser Anteil der Pixel von der häufigsten Farbe abweicht. Gemessen: auch die
 *  Seite „Nichts offen“ hat Text und Leiste und liegt weit darüber. */
export const MIN_ANTEIL = 0.002;
/** Eine PNG-Datei unter dieser Größe (Bytes) ist leer, ob sie sich lesen lässt oder nicht. */
export const MIN_BYTES = 3000;

const KANAELE = { 0: 1, 2: 3, 4: 2, 6: 4 };

/** Liest ein PNG (8 Bit, ohne Verschränkung) und gibt { breite, hoehe, kanaele, daten } zurück; wirft bei allem anderen. */
export function lesePng(buf) {
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('kein PNG');
  let breite = 0; let hoehe = 0; let tiefe = 0; let typ = 0; let verschraenkt = 0;
  const teile = [];
  for (let i = 8; i + 8 <= buf.length;) {
    const laenge = buf.readUInt32BE(i);
    const art = buf.toString('latin1', i + 4, i + 8);
    const inhalt = buf.subarray(i + 8, i + 8 + laenge);
    if (art === 'IHDR') { breite = inhalt.readUInt32BE(0); hoehe = inhalt.readUInt32BE(4); tiefe = inhalt[8]; typ = inhalt[9]; verschraenkt = inhalt[12]; }
    else if (art === 'IDAT') teile.push(inhalt);
    else if (art === 'IEND') break;
    i += 12 + laenge;
  }
  const kanaele = KANAELE[typ];
  if (!kanaele || tiefe !== 8 || verschraenkt) throw new Error(`PNG-Art nicht unterstützt (Typ ${typ}, Tiefe ${tiefe})`);
  const roh = inflateSync(Buffer.concat(teile));
  const zeile = breite * kanaele;
  if (roh.length < hoehe * (zeile + 1)) throw new Error('PNG abgeschnitten');
  const daten = Buffer.alloc(hoehe * zeile);
  for (let y = 0; y < hoehe; y++) {
    const filter = roh[y * (zeile + 1)];
    const von = y * (zeile + 1) + 1;
    const nach = y * zeile;
    for (let x = 0; x < zeile; x++) {
      const a = x >= kanaele ? daten[nach + x - kanaele] : 0;
      const b = y ? daten[nach - zeile + x] : 0;
      const c = x >= kanaele && y ? daten[nach - zeile + x - kanaele] : 0;
      let v = roh[von + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`PNG-Filter ${filter} unbekannt`);
      daten[nach + x] = v & 255;
    }
  }
  return { breite, hoehe, kanaele, daten };
}

/** Anteil der Pixel, die von der häufigsten Farbe abweichen (0 bis 1). */
export function abweichung({ breite, hoehe, kanaele, daten }) {
  const zahl = new Map();
  const n = breite * hoehe;
  for (let p = 0; p < n; p++) {
    let k = 0;
    for (let c = 0; c < kanaele; c++) k = k * 256 + daten[p * kanaele + c];
    zahl.set(k, (zahl.get(k) ?? 0) + 1);
  }
  return n ? 1 - Math.max(...zahl.values()) / n : 0;
}

/** Dateiname, den der Renderer einer Adresse gibt. */
export const dateiname = (adresse) => adresse.replace(/[^\p{L}\p{N}_-]+/gu, '-');

/**
 * Prüft die Bilder eines Szenarios in `ordner`. Die Varianten (Größe, Modus, ...) stehen nirgends fest: erwartet wird jede Endung,
 * die der Renderer für mindestens eine Adresse geschrieben hat (ADRESSE-ENDUNG.png; bei zwei passenden Adressen gilt die längere).
 * Gibt eine Liste von Befunden zurück (leer: alles in Ordnung); jeder nennt Adresse und Variante. Eine Variante, die einer Adresse
 * fehlt, obwohl eine andere sie hat, zählt, ebenso ein leeres Bild und dasselbe Bild für zwei Adressen.
 */
export function pruefeBilder(ordner, adressen) {
  const namen = adressen.map((adr) => ({ adr, stamm: `${dateiname(adr)}-` })).sort((x, y) => y.stamm.length - x.stamm.length);
  const varianten = new Set();
  for (const f of existsSync(ordner) ? readdirSync(ordner) : []) {
    if (!f.endsWith('.png')) continue;
    const treffer = namen.find((n) => f.startsWith(n.stamm));
    if (treffer) varianten.add(f.slice(treffer.stamm.length, -4));
  }
  if (!varianten.size) return adressen.map((adr) => `${adr}: keine Bilder`);
  const befunde = [];
  const hashes = new Map();
  for (const adr of adressen) {
    for (const v of [...varianten].sort()) {
      const datei = join(ordner, `${dateiname(adr)}-${v}.png`);
      const wo = `${adr} (${v})`;
      if (!existsSync(datei)) { befunde.push(`${wo}: Bild fehlt`); continue; }
      const buf = readFileSync(datei);
      if (buf.length < MIN_BYTES) { befunde.push(`${wo}: Bild leer (${buf.length} Bytes)`); continue; }
      try {
        const anteil = abweichung(lesePng(buf));
        if (anteil < MIN_ANTEIL) { befunde.push(`${wo}: Bild leer (nur eine Farbe)`); continue; }
      } catch (e) { befunde.push(`${wo}: Bild nicht lesbar (${e.message})`); continue; }
      const h = createHash('sha256').update(buf).digest('hex');
      const schon = hashes.get(`${v}/${h}`);
      if (schon) befunde.push(`${wo}: dasselbe Bild wie ${schon}; die Adresse zeigt nicht ihre Ansicht`);
      else hashes.set(`${v}/${h}`, adr);
    }
  }
  return befunde;
}
