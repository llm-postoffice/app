// Prüfungen vor dem Senden: Geheimnisse und Personendaten in Titel und Text finden, wie `new` im Postsystem sie
// beim Anlegen prüft. Reine Funktionen ohne Browser, Port von secret_hits, looks_secret, personal_hits und iban_ok.
// Ein Treffer nennt Zeile und Art, nie den Wert. tests/pruefen.test.mjs prüft sie mit den gemeinsamen Testfällen
// (secrets, personal).
//
// Abweichungen der Python-Muster von JavaScript, mit Grund (Bausteine in pytext.js):
//  - (?i) wird zum Flag i, re.S zum Flag s; alle Muster laufen mit u, damit \p{...} und die Groß-/Kleinschreibung
//    Unicode folgen wie in Python (das lange s und das Kelvinzeichen treffen s und k in beiden).
//  - \b, \w, \W, \d, \s und [^\s...] sind durch Unicode-Klassen aus pytext.js ersetzt: Python liest sie für str
//    Unicode-weit, JavaScript ohne u nur ASCII. \b steht als Blick zur Seite; jedes \b der Muster liegt vor oder
//    nach einem Wortzeichen, so ist der Blick gleichwertig.
//  - In der Zeichenklasse des Schlüsselwerts steht " statt \", weil u-Muster nur Zeichen der Syntax mit \ erlauben.
//  - str.isdigit in looks_secret kennt auch hoch- und tiefgestellte Ziffern; ZIFFERN_SONST nennt sie.
//  - re.I setzt in Python das punktierte İ (U+0130) und das punktlose ı (U+0131) mit i gleich, das Flag iu in
//    JavaScript nicht; ohne_punkt() gleicht beide vor den Mustern mit Flag i an, mit gleicher Länge und Zeilenzahl.
import { GRENZE_NACH, GRENZE_VOR, LEERRAUM, NICHT_WORT, ZIFFER } from './pytext.js';

const SP = LEERRAUM;
const D = ZIFFER;
const muster = (quelle, flags = 'gu') => new RegExp(quelle, flags);

/** [Art, Muster] der Geheimnisse; die Muster stammen aus dem Postsystem. */
export const GEHEIMNIS_MUSTER = [
  ['privater Schlüssel', muster('-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----', 'gsu')],
  ['age-Schlüssel', muster('AGE-SECRET-KEY-1[0-9A-Z]{20,}')],
  ['API-Schlüssel', muster(`${GRENZE_VOR}sk-(?:ant-)?[A-Za-z0-9_-]{20,}`)],
  ['GitHub-Token', muster(`${GRENZE_VOR}(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})`)],
  ['GitLab-Token', muster(`${GRENZE_VOR}glpat-[A-Za-z0-9_-]{20,}`)],
  ['AWS-Schlüssel', muster(`${GRENZE_VOR}AKIA[0-9A-Z]{16}${GRENZE_NACH}`)],
  ['Slack-Token', muster(`${GRENZE_VOR}xox[abprs]-[A-Za-z0-9-]{10,}`)],
  ['Schlüsselwert', muster(
    '(?<![A-Za-z0-9])(?:[A-Za-z0-9]+[_-]){0,4}(password|passwort|passwd|secret|token|api[_-]?key)'
    + `(?:_[A-Za-z0-9]+){0,4}(['"]?[${SP}]*[:=][${SP}]*)(['"]?)(?![$<{\\[])([^${SP}'"\`()]{8,})\\3`
    + `(?![^${SP}'",;])`, 'gidu')],
  ['Zugangsdaten in URL', muster(
    `${GRENZE_VOR}[a-z][a-z0-9+.-]*://[^${SP}/:@]+:(?![$<{\\[])[^${SP}/@]{8,}@`, 'giu')],
];

/** [Kategorie, Muster] der Personendaten. */
const PERSONEN_MUSTER = [
  ['E-Mail', muster('[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}')],
  ['Telefon', muster(`(?<![\\p{L}\\p{N}_+])(?:\\+|00)[1-9]${D}(?:[ /-]?${D}){6,13}${GRENZE_NACH}`)],
  ['Telefon', muster(`(?<![\\p{L}\\p{N}_.])0[1-9]${D}(?:[ /-]?${D}){5,12}(?![\\p{L}\\p{N}_.])`)],
  ['IBAN', muster(`${GRENZE_VOR}[A-Z]{2}${D}{2}(?: ?[A-Z0-9]){11,30}${GRENZE_NACH}`)],
  ['Geburtsdatum', muster(
    `${GRENZE_VOR}(?:geb\\.|geboren|geburtsdatum|date of birth|dob)${NICHT_WORT}{0,3}[${SP}]*${D}{1,4}[.-][${SP}]?${D}{1,2}[.-][${SP}]?${D}{2,4}`,
    'giu')],
  ['Personalnummer', muster(
    `${GRENZE_VOR}(?:personalnummer|personalnr\\.?|pers\\.-?nr\\.?|mitarbeiternummer)[${SP}]*[:#]?[${SP}]*${D}{3,}`, 'giu')],
  ['Aktenzeichen', muster(
    `${GRENZE_VOR}(?:aktenzeichen|geschäftszeichen|az\\.|gz\\.)[${SP}]*[:#]?[${SP}]*[A-Za-z0-9][A-Za-z0-9 ./-]{1,30}${D}`,
    'giu')],
];
const MAIL_OK_DOMAINS = ['example.com', 'example.org', 'example.net'];
// Endungen von systemd-Einheiten: NAME@INSTANZ.service ist eine Instanz, keine Adresse (wie im Postwerkzeug).
const UNIT_ENDUNGEN = ['service', 'socket', 'timer', 'target', 'mount', 'path', 'slice', 'scope', 'automount', 'device', 'swap'];
// Zeichen, die Python isdigit() kennt, isdecimal() aber nicht (hoch- und tiefgestellte, eingekreiste Ziffern u. a.);
// erzeugt aus Python 3.14 (Unicode 16.0), 128 Zeichen. \p{Nd} deckt die Dezimalziffern ab.
const ZIFFERN_SONST = '\\u00b2-\\u00b3\\u00b9\\u1369-\\u1371\\u19da\\u2070\\u2074-\\u2079\\u2080-\\u2089\\u2460-\\u2468\\u2474-\\u247c\\u2488-\\u2490\\u24ea\\u24f5-\\u24fd\\u24ff\\u2776-\\u277e\\u2780-\\u2788\\u278a-\\u2792\\u{10a40}-\\u{10a43}\\u{10e60}-\\u{10e68}\\u{11052}-\\u{1105a}\\u{1f100}-\\u{1f10a}';
const HAT_ZIFFER = muster(`[${D}${ZIFFERN_SONST}]`, 'u');
const HAT_NICHT_ALNUM = muster('[^\\p{L}\\p{N}]', 'u');
const HAT_GROSS = muster('\\p{Uppercase}', 'u');
const HAT_KLEIN = muster('\\p{Lowercase}', 'u');

const PUNKTIERT = String.fromCodePoint(0x130);
const PUNKTLOS = String.fromCodePoint(0x131);
/** Python-re.I liest İ und ı wie i; JavaScript nicht. Ersatz mit gleicher Länge, Zeilen und Stellen bleiben. */
const ohnePunkt = (text) => text.replaceAll(PUNKTIERT, 'I').replaceAll(PUNKTLOS, 'i');
/** Der Text für ein Muster: bei Flag i angeglichen (siehe oben), sonst unverändert. */
const fuer = (rx, text) => (rx.flags.includes('i') ? ohnePunkt(text) : text);

const zeileVon = (text, index) => {
  let n = 1;
  for (let i = text.indexOf('\n'); i >= 0 && i < index; i = text.indexOf('\n', i + 1)) n++;
  return n;
};

/** Sortiert und entdoppelt Treffer [Zeile, Art] wie sorted(set(...)) in Python. */
function ordnen(treffer) {
  const einmalig = new Map(treffer.map((t) => [`${t[0]}\u0000${t[1]}`, t]));
  return [...einmalig.values()].sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
}

/** Wert hinter "token:" und Ähnlichem: URLs und reine Kleinbuchstaben-Wörter sind keine Geheimnisse. */
export function siehtGeheimAus(wert) {
  if (/^https?:\/\//i.test(wert)) return false;
  if (HAT_ZIFFER.test(wert)) return true;
  if (HAT_NICHT_ALNUM.test(wert)) return true;
  return HAT_GROSS.test(wert) && HAT_KLEIN.test(wert);
}

/** Geheimnisse im Text: Liste von [Zeile ab 1, Art]; nie der Wert. */
export function geheimnisTreffer(text) {
  const treffer = [];
  for (const [art, rx] of GEHEIMNIS_MUSTER) {
    for (const m of fuer(rx, text).matchAll(rx)) {
      if (art === 'Schlüsselwert' && !siehtGeheimAus(text.slice(...m.indices[4]))) continue;
      treffer.push([zeileVon(text, m.index), art]);
    }
  }
  return ordnen(treffer);
}

/** Prüfsumme einer IBAN nach ISO 7064 (Modulo 97). */
export function ibanGueltig(kandidat) {
  const s = kandidat.replaceAll(' ', '').toUpperCase();
  if (s.length < 15 || s.length > 34 || !/^[A-Z0-9]+$/.test(s)) return false;
  const verschoben = s.slice(4) + s.slice(0, 4);
  const ziffern = [...verschoben].map((c) => parseInt(c, 36)).join('');
  return BigInt(ziffern) % 97n === 1n;
}

function mailTrifft(treffer) {
  const i = treffer.lastIndexOf('@');
  const lokal = treffer.slice(0, i).toLowerCase();
  const domain = treffer.slice(i + 1).toLowerCase();
  if (UNIT_ENDUNGEN.includes(domain.slice(domain.lastIndexOf('.') + 1))) return false;
  if (lokal === 'noreply' || lokal === 'no-reply' || domain.endsWith('noreply.github.com')) return false;
  return !MAIL_OK_DOMAINS.includes(domain);
}

/** Personendaten im Text: Liste von [Zeile ab 1, Kategorie]. */
export function personenTreffer(text) {
  const treffer = [];
  for (const [kategorie, rx] of PERSONEN_MUSTER) {
    for (const m of fuer(rx, text).matchAll(rx)) {
      if (kategorie === 'E-Mail' && !mailTrifft(m[0])) continue;
      if (kategorie === 'IBAN') {
        const roh = m[0].replaceAll(' ', '');
        let gueltig = false;
        for (let n = roh.length; n > 14 && !gueltig; n--) gueltig = ibanGueltig(roh.slice(0, n));
        if (!gueltig) continue;
      }
      treffer.push([zeileVon(text, m.index), kategorie]);
    }
  }
  return ordnen(treffer);
}
