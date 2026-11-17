// Erfundene Anhänge für die Szenarien der Vorschau und für Tests: zum Eintrag r2d4vn (ein Bild, ein PDF) und zu seinem Nachtrag
// (ein Messlauf als Text). Das Bild ist ein kleines echtes PNG (schematisches Fenster), das PDF ein Rumpf mit Füllung; nichts davon
// ist echt, die Namen sind neutral wie die übrigen Beispieldaten. Die Datei läuft in Node und im Browser.
import { bytesZuBasis } from '../../js/anhaenge.js';

const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
export const FENSTER_PNG = bytes(
  'iVBORw0KGgoAAAANSUhEUgAAASwAAAGQCAIAAACbF8osAAAEl0lEQVR42u3dvw2CQBiHYQo7R4DIPE7gEBS07GBBy1gmjmBjYmdv' +
  'zs6KysDx53t+eSaAe6srrrg/PsCCCp8ARAgiBEQIIgRECCIERAgiBEQIIgRECCIERAgiBEQIIgRECCIENhDh4XRmEg6lCEUoQkQo' +
  'QkQoQhEiQhEiQhGKEBGKEBGKUIS4rAcRAiIEEQIiBBECIgQRAiIEEQIiBBECIgQRAiIEEQIiBBECIgQRAv9H+Hy9gQWJEEQIIgRE' +
  'CCIERAgiBEQIIgRECCIERAgiBEQIIgRECCIERAgiBEQIIgRECCIERAgiBEQIIgRECCIERAgiBEQIIgRECCIERAgiBEQIIgRECCIE' +
  'RAgiBEQIIgRyR9i03c44HIhQhIhQhCBCESJCEYIIRYgIARGCCAERgggBEYIIARGCCMdc+wFCESGIcCzCZBZgIjQToQhNhCI0E6EI' +
  'TYQiNBOhCE2EIjQToQhNhCI0E6EITYQiNBOhCE2Eq46wrGomIQARilCEJkIRmghFKEIRilCEJkIRilCErijMRChCE6EIzUQoQhOh' +
  'CM1EKEIToQjNRChCE6EIzUQoQhOhCM1EaCZCEZqFjhA8EipCiBohIEIQISBCECEgQhAhIEIQISBCECEgQhAhIEIQISBCECEgQhAh' +
  'IEIQITBThE3b8eNgIUIRIkIRgghFiAhFCCIUIa4oABGCCAERgggBEYIIARHCfiP0gjnerBchiLAfklmAidBMhCI0EYrQTIQiNBGK' +
  '0EyEIjQRitBMhCI0EYrQTIQiNBGK0EyEIjQRrjrCsqpZnHhEiAhFKEIRmggRoQhFKEITISIUoSsKMxGaiVCEZiI0E6EIzURoJkIR' +
  'monQTIQiNBOhmQhFaCZCMxGK0GzzEYJHQkUIUSMERAgiBEQIIgRECCIERAgiBEQIIgRECCIERAgiBEQIIgRECCIERAgiBGaKsGm7' +
  'UBwdRChCRChCEKEIEaEIQYQiRISACEGEgAhBhIAIQYSACCFqhF4wx5v1IgQR9kMyCzARmolQhCZCEZqJUIQmQhGaiVCEJkIRmolQ' +
  'hCZCEZqJUIQmQhGaiVCEJsJVR1hWNRnIQ4QiFKEIRShCE6EIRShCEYrQRChCEYrQFYWZCM1EKEIzEZqJUIRmIjQToQjNRGgmQhGa' +
  'idBMhCI0E6GZCEVotvMIwSOhIoSoEQIiBBECIgQRAiIEEQIiBBECIgQRAiIEEQIiBBECIgQRAiIEEQIiBBECIgQRAiIEEQIiBBEC' +
  'IgQRggh9BRAhiBAQIYgQ2HaEx8sNQhEhiFCEiFCEIEIRIkIRgghFiAhFCCIUISIUIYjQX0GEIgQRgghFCCIEEYoQRAgiFCGIMKYU' +
  'YP6yCEUoQhGKUISIUIQiFKEIRShCEYpQhCIUoQhFKEIRilCEIkSEIgQRihARihBE6JcgQhGCCEGEIgQRgghFCCIEEYoQRAgiFCGI' +
  'EEQoQhAhiFCEECNCQIQgQkCEIEJAhCBCQIQgQkCEIEJAhCBCQIQgQkCEIEJAhCBCQIQgQkCEIEJAhCBCQIQgQkCEIEIQoa8AIgQR' +
  'AiIEEQIiBBEC2X0Bah5IQ65FK/QAAAAASUVORK5CYII=');

export const MESSLAUF = `Messlauf rechner-a, 14.11. 13:50
Befehl: beta-tool --version
Läufe: 5, Zeiten in Sekunden

Lauf  Standard   Zusatzpaket
1     0,071      0,152
2     0,069      0,148
3     0,070      0,151
4     0,072      0,149
5     0,068      0,150

Mittel  0,070    0,150
Streuung unter 3 %, beide stabil.
`;

/** Ein PDF-Rumpf mit Füllung auf `groesse` Bytes (kein lesbares PDF; die App zeigt PDF nicht an). */
export function pdfRumpf(groesse = 18 * 1024) {
  const kopf = new TextEncoder().encode('%PDF-1.4\n% Vergleich der Bibliotheken (Beispiel)\n');
  const aus = new Uint8Array(groesse).fill(0x20);
  aus.set(kopf);
  aus.set(new TextEncoder().encode('\n%%EOF\n'), groesse - 7);
  return aus;
}

/** Eine Textdatei über 1 MiB: die App lädt sie nicht und sagt es. */
export const grosseDatei = () => new TextEncoder().encode('2026-11-14T13:50:00Z lauf ok\n'.repeat(41_000));

/**
 * Legt die Anhänge zu r2d4vn in `daten` (Map Pfad zu Text oder Bytes) und gibt `daten` zurück: Bild und PDF am Eintrag, der Messlauf
 * am Nachtrag; mit `gross` dazu eine Datei über 1 MiB.
 */
export function anhaengeDazu(daten, { gross = false } = {}) {
  const nachtrag = [...daten.keys()].find((p) => p.startsWith('entries/r2/r2d4vn/') && p.endsWith('-addendum.md')).split('/').pop().split('-')[0];
  daten.set('entries/r2/r2d4vn/attachments/eingabefelder-standard.png', FENSTER_PNG);
  daten.set('entries/r2/r2d4vn/attachments/vergleich-bibliotheken.pdf', pdfRumpf());
  daten.set(`entries/r2/r2d4vn/attachments/${nachtrag}/messlauf-rechner-a.txt`, MESSLAUF);
  if (gross) daten.set('entries/r2/r2d4vn/attachments/lauf-protokoll.log', grosseDatei());
  return daten;
}

/**
 * Ein kurzer Eintrag n5tz8d (eine Notiz) mit Anhängen, damit der Abschnitt ohne Scrollen auf dem ersten Bildschirm steht; `welche`
 * nennt sie in der Reihenfolge der Zeilen: png, pdf, txt, gross (Datei über 1 MiB).
 */
export function kurzerEintrag(daten, welche = ['png', 'pdf', 'txt']) {
  const dir = 'entries/n5/n5tz8d';
  daten.set(`${dir}/0-entry.md`, '# Messung der Startzeit\n\n- Kind: note\n- From: session:cb56d77f, rechner-a, 2026-11-14T13:40Z\n- Priority: 3\n\nDie Messung steht im Anhang.\n');
  const dateien = { png: ['eingabefelder-standard.png', FENSTER_PNG], pdf: ['vergleich-bibliotheken.pdf', pdfRumpf()], txt: ['messlauf-rechner-a.txt', MESSLAUF], gross: ['lauf-protokoll.log', grosseDatei()] };
  for (const w of welche) daten.set(`${dir}/attachments/${dateien[w][0]}`, dateien[w][1]);
  return daten;
}

/** Anhänge, wie die Auswahl sie im Entwurf ablegt (js/anhangwahl.js). */
export const entwurfAnhaenge = () => [
  { name: 'eingabefelder-standard.png', groesse: FENSTER_PNG.length, typ: 'image/png', daten: bytesZuBasis(FENSTER_PNG) },
  { name: 'messlauf-rechner-a.txt', groesse: new TextEncoder().encode(MESSLAUF).length, typ: 'text/plain', daten: bytesZuBasis(new TextEncoder().encode(MESSLAUF)) },
];
