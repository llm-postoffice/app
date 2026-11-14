// Text nach den Regeln von Python (str): Das Datenformat und seine Prüfungen sind in Python festgelegt, die App
// muss dieselben Zeichen als Leerraum, Wortzeichen und Zeilenende lesen. JavaScript weicht an diesen Stellen ab:
//   \s      Python: Leerraum nach str.isspace (auch \x1c bis \x1f und \x85), JavaScript: dazu \ufeff, ohne diese
//   \w, \b  Python: Buchstaben und Ziffern aller Schriften und _, JavaScript ohne u-Flag nur ASCII
//   \d      Python: alle Dezimalziffern (\p{Nd}), JavaScript nur 0 bis 9
//   split   Python splitlines trennt auch an \v, \f, \x1c bis \x1e, \x85, \u2028 und \u2029
// Die Bausteine stehen hier einmal; Muster setzen sie mit dem Flag u zusammen (new RegExp(..., 'u')).

/** Zeichen, die Python als Leerraum zählt, für das Innere einer Zeichenklasse. */
export const LEERRAUM = '\\t\\n\\v\\f\\r \\x1c-\\x1f\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
/** Python \w, \W (Buchstaben, Ziffern und _; Flag u nötig). */
export const WORT = '[\\p{L}\\p{N}_]';
export const NICHT_WORT = '[^\\p{L}\\p{N}_]';
/** Python \b vor und nach einem Wortzeichen als Blick zur Seite (der Treffer beginnt oder endet auf einem Wortzeichen). */
export const GRENZE_VOR = '(?<![\\p{L}\\p{N}_])';
export const GRENZE_NACH = '(?![\\p{L}\\p{N}_])';
/** Python \d (Flag u nötig). */
export const ZIFFER = '\\p{Nd}';

const ANFANG = new RegExp(`^[${LEERRAUM}]+`, 'u');
const ENDE = new RegExp(`[${LEERRAUM}]+$`, 'u');
const ERSTES = new RegExp(`^[${LEERRAUM}]`, 'u');

/** str.strip() */
export const strip = (s) => s.replace(ANFANG, '').replace(ENDE, '');
/** str.lstrip() */
export const lstrip = (s) => s.replace(ANFANG, '');
/** str.rstrip() */
export const rstrip = (s) => s.replace(ENDE, '');
/** s[0].isspace() für eine nicht leere Zeichenkette */
export const beginntMitLeerraum = (s) => ERSTES.test(s);
/** Bleibt nach strip() etwas übrig? (not s.strip()) */
export const istLeer = (s) => strip(s) === '';

/** str.strip(zeichen): entfernt die genannten Zeichen an beiden Enden. */
export function stripZeichen(s, zeichen) {
  const menge = new Set([...zeichen]);
  const z = [...s];
  let a = 0;
  let e = z.length;
  while (a < e && menge.has(z[a])) a++;
  while (e > a && menge.has(z[e - 1])) e--;
  return z.slice(a, e).join('');
}

/** str.splitlines() ohne Zeilenenden. */
export function zeilen(text) {
  const teile = text.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/);
  if (teile[teile.length - 1] === '') teile.pop();
  return teile;
}

/** str.partition(trenner): [vor, trenner oder '', nach]. */
export function teilen(s, trenner) {
  const i = s.indexOf(trenner);
  return i < 0 ? [s, '', ''] : [s.slice(0, i), trenner, s.slice(i + trenner.length)];
}

/** re.split(muster, s, 1): am ersten Treffer in zwei Teile trennen, sonst [s]. */
export function einmalTrennen(muster, s) {
  const m = muster.exec(s);
  return m ? [s.slice(0, m.index), s.slice(m.index + m[0].length)] : [s];
}

/**
 * int(s) für Dezimalzahlen: Leerraum außen, Vorzeichen und Unterstriche zwischen Ziffern sind erlaubt wie in
 * Python. null, wenn Python einen ValueError würfe. Ziffern anderer Schriften liest die App nicht (Abweichung:
 * Python-int nimmt sie, aber Rang und Schrittnummern kommen von Tastaturen mit 0 bis 9).
 */
export function ganzzahl(s) {
  const t = strip(String(s));
  return /^[+-]?[0-9]+(?:_[0-9]+)*$/.test(t) ? Number(t.replaceAll('_', '')) : null;
}
