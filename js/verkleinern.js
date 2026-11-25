// Bilder verkleinern: ein Foto vom Handy ist fast immer größer als ANHANG_MAX. Die App malt es kleiner und kodiert es neu, bis
// es hineinpasst (Datei anhängen, über anhaenge.js: bereiteVor). Fotos (JPEG, WebP, HEIC) kodiert
// bereiteVor immer neu, ein PNG nur über ANHANG_MAX; ein PNG bis ANHANG_MAX bleibt, damit Bildschirmfotos mit Text scharf bleiben. Browser-Teile (createImageBitmap, OffscreenCanvas) sind
// Parameter, damit der Ablauf unter node --test mit Attrappen läuft; echte Bilder prüft der Wegetest in Chromium.
import { ANHANG_MAX } from './anhaenge.js';

/** Längste Kante in Pixeln, von groß nach klein. */
export const KANTEN = [2560, 2048, 1600, 1280];
/** Qualität je Kante, von hoch nach niedrig; bei jeder Kante zuerst die beste. */
export const QUALITAETEN = [0.85, 0.78, 0.7];
const ENDUNG = { 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Der Name mit der Endung des neuen Formats; eine vorhandene Endung (bis fünf Zeichen) wird ersetzt. */
export const mitEndung = (name, endung) => `${String(name).replace(/\.[A-Za-z0-9]{1,5}$/, '')}.${endung}`;

async function kodiere(flaeche, typ, qualitaet) {
  try {
    const b = await flaeche.convertToBlob({ type: typ, quality: qualitaet });
    // convertToBlob fällt bei einem unbekannten Typ still auf PNG zurück; ein solches Ergebnis zählt nicht
    return b && b.type === typ ? b : null;
  } catch { return null; }
}

/**
 * Verkleinert ein Bild (JPEG, PNG, WebP, oder was createImageBitmap dekodiert) auf höchstens `max` Bytes: erst die längste
 * Kante schrittweise kleiner (KANTEN), je Kante die Qualität schrittweise niedriger (QUALITAETEN). Ergebnis ist JPEG oder, wenn
 * kleiner, WebP; die Ausrichtung nach den Exif-Daten ist angewendet, Transparenz wird weiß. Ergebnis: { ok: true, blob, typ,
 * name, breite, hoehe } oder { ok: false, grund } mit grund 'nicht-lesbar' (das Format dekodiert der Browser nicht, etwa HEIC),
 * 'zu-gross' (auch die kleinste Stufe passt nicht) oder 'nicht-verfuegbar' (der Browser hat die Schnittstellen nicht).
 */
export async function verkleinereBild(blob, name, { max = ANHANG_MAX, umgebung = globalThis } = {}) {
  if (typeof umgebung.createImageBitmap !== 'function' || typeof umgebung.OffscreenCanvas !== 'function') return { ok: false, grund: 'nicht-verfuegbar' };
  let bild;
  try { bild = await umgebung.createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { return { ok: false, grund: 'nicht-lesbar' }; }
  try {
    const lang = Math.max(bild.width, bild.height);
    if (!(lang > 0)) return { ok: false, grund: 'nicht-lesbar' };
    for (const kante of [...new Set(KANTEN.map((k) => Math.min(k, lang)))]) {
      const f = kante / lang;
      const breite = Math.max(1, Math.round(bild.width * f));
      const hoehe = Math.max(1, Math.round(bild.height * f));
      const flaeche = new umgebung.OffscreenCanvas(breite, hoehe);
      const z = flaeche.getContext('2d');
      if (!z) return { ok: false, grund: 'nicht-verfuegbar' };
      z.fillStyle = '#ffffff';
      z.fillRect(0, 0, breite, hoehe);
      z.imageSmoothingQuality = 'high';
      z.drawImage(bild, 0, 0, breite, hoehe);
      for (const q of QUALITAETEN) {
        const jpg = await kodiere(flaeche, 'image/jpeg', q);
        if (!jpg || jpg.size > max) continue;
        const webp = await kodiere(flaeche, 'image/webp', q);
        const bester = webp && webp.size < jpg.size ? webp : jpg;
        return { ok: true, blob: bester, typ: bester.type, name: mitEndung(name, ENDUNG[bester.type]), breite, hoehe };
      }
    }
    return { ok: false, grund: 'zu-gross' };
  } finally {
    bild.close?.();
  }
}
