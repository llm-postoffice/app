// Lädt die gemeinsamen Testfälle (tests/testfaelle/cases.json, Kopie aus dem Postsystem, Herkunft in QUELLE.json).
import { readFileSync } from 'node:fs';

const lies = (name) => JSON.parse(readFileSync(new URL(`../testfaelle/${name}`, import.meta.url), 'utf8'));

export const TC = lies('cases.json');
export const QUELLE = lies('QUELLE.json');

/** Geheimnisse stehen als Teile in der Datei und werden erst hier zusammengesetzt. */
export const textVon = (fall) => (Array.isArray(fall.text) ? fall.text.join('') : fall.text);
