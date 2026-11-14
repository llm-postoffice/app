// Markdown ohne HTML: ein kleiner eigener Renderer über DOM-Knoten, keine Bibliothek (Annahme 2). Er liest Text in
// zwei Schritten: `markdownBaum` macht aus dem Text einen Baum (rein, node --test prüft ihn), `markdownDom` baut daraus
// Knoten. Rohes HTML im Text bleibt Text: nichts davon wird je als Markup gelesen, und der Baum kennt nur diese Knoten:
// Absatz, Überschrift, Liste, Zitat, Codeblock, Trennlinie; innen Text, Code, fett, kursiv und Link. Links gibt es
// ausschließlich mit https: und tragen rel="noopener noreferrer"; jede andere Adresse bleibt als Text stehen (USI-1).
// Bilder lädt der Renderer nie, vom Bild bleibt der Alternativtext. Tabellen zeigt er als Text in festen Zeichen,
// damit eine breite Tabelle nicht den Bildschirm verbreitert.
import { el } from './dom.js';

/** Nur https: mit Rechnername, ohne Zugangsdaten in der Adresse; sonst null. Ergebnis ist die normierte Adresse. */
export function sichererLink(roh) {
  let u;
  try { u = new URL(String(roh).trim()); } catch { return null; }
  if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) return null;
  return u.href;
}

// ---- Inline

const SPEZIAL = /[\\`*_[<!h]/;
const URL_ANFANG = /^https:\/\/[^\s<>()[\]]+/;

/** Liest Fließtext: Code, fett, kursiv, Links und Escapes; alles andere ist Text. Gibt eine Liste von Knoten zurück. */
export function inline(text) {
  const aus = [];
  let puffer = '';
  const leeren = () => { if (puffer) { aus.push(puffer); puffer = ''; } };
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (!SPEZIAL.test(c)) { puffer += c; i++; continue; }
    if (c === '\\' && i + 1 < text.length && /[\\`*_{}[\]()#+\-.!<>|]/.test(text[i + 1])) { puffer += text[i + 1]; i += 2; continue; }
    if (c === '`') {
      const n = /^`+/.exec(text.slice(i))[0].length;
      const ende = text.indexOf('`'.repeat(n), i + n);
      if (ende > i + n) { leeren(); aus.push({ t: 'code', x: text.slice(i + n, ende).replace(/^ (.*) $/s, '$1') }); i = ende + n; continue; }
      puffer += '`'.repeat(n); i += n; continue;
    }
    if (c === '!' && text[i + 1] === '[') {
      const m = /^!\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/.exec(text.slice(i));
      if (m) { puffer += m[1]; i += m[0].length; continue; }   // kein Bild laden: der Alternativtext bleibt
      puffer += c; i++; continue;
    }
    if (c === '[') {
      const m = /^\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/.exec(text.slice(i));
      if (m) {
        leeren();
        const href = sichererLink(m[2]);
        const kinder = inline(m[1]);
        if (href) aus.push({ t: 'a', href, k: kinder.length ? kinder : [m[2]] });
        else aus.push(...kinder, ...(m[2] && m[1] !== m[2] ? [` (${m[2]})`] : []));   // unsicheres Ziel: nur Text
        i += m[0].length; continue;
      }
      puffer += c; i++; continue;
    }
    if (c === '<') {
      const m = /^<(https:\/\/[^\s<>]+)>/.exec(text.slice(i));
      if (m && sichererLink(m[1])) { leeren(); aus.push({ t: 'a', href: sichererLink(m[1]), k: [m[1]] }); i += m[0].length; continue; }
      puffer += c; i++; continue;   // <b> und andere Marken bleiben Text
    }
    if (c === 'h') {
      const m = (i === 0 || /[\s([]/.test(text[i - 1])) ? URL_ANFANG.exec(text.slice(i)) : null;
      if (m) {
        const roh = m[0].replace(/[.,;:!?'"]+$/, '');
        const href = sichererLink(roh);
        if (href) { leeren(); aus.push({ t: 'a', href, k: [roh] }); i += roh.length; continue; }
      }
      puffer += c; i++; continue;
    }
    // * und _: fett (doppelt) vor kursiv (einfach); _ innerhalb eines Worts bleibt Text (snake_case)
    if (c === '*' || c === '_') {
      const doppelt = text[i + 1] === c;
      const marke = c.repeat(doppelt ? 2 : 1);
      const davor = i > 0 ? text[i - 1] : ' ';
      const imWort = c === '_' && /[\p{L}\p{N}]/u.test(davor);
      if (!imWort && text[i + marke.length] && !/\s/.test(text[i + marke.length])) {
        let ende = i + marke.length;
        for (;;) {
          ende = text.indexOf(marke, ende);
          if (ende < 0) break;
          const danach = text[ende + marke.length] ?? ' ';
          const schluss = !/\s/.test(text[ende - 1]) && !(c === '_' && /[\p{L}\p{N}]/u.test(danach));
          if (schluss && ende > i + marke.length && !(doppelt === false && text[ende + 1] === c)) break;
          ende += marke.length;
        }
        if (ende > 0) {
          leeren();
          aus.push({ t: doppelt ? 'b' : 'i', k: inline(text.slice(i + marke.length, ende)) });
          i = ende + marke.length; continue;
        }
      }
      puffer += marke; i += marke.length; continue;
    }
    puffer += c; i++;
  }
  leeren();
  return aus;
}

// ---- Blöcke

const ZAUN = /^ {0,3}(`{3,}|~{3,})\s*([^`]*)$/;
const UEBERSCHRIFT = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const TRENNER = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const LISTE = /^( *)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
const ZITAT = /^ {0,3}>[ \t]?(.*)$/;
const TABELLE = /^\s*\|.*\|\s*$/;

/** Liest den Text zeilenweise in Blöcke. Zeilenumbrüche im Absatz bleiben Umbrüche (wie in Kommentaren auf GitHub). */
export function markdownBaum(text, tiefe = 0) {
  const zeilen = String(text ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  const aus = [];
  let i = 0;
  const leer = (z) => !z.trim();
  while (i < zeilen.length) {
    const z = zeilen[i];
    if (leer(z)) { i++; continue; }
    let m = ZAUN.exec(z);
    if (m) {
      const zaun = m[1];
      const zeilenCode = [];
      i++;
      while (i < zeilen.length && !new RegExp(`^ {0,3}${zaun[0]}{${zaun.length},}\\s*$`).test(zeilen[i])) zeilenCode.push(zeilen[i++]);
      i++;
      aus.push({ t: 'code', x: zeilenCode.join('\n') });
      continue;
    }
    if ((m = UEBERSCHRIFT.exec(z))) { aus.push({ t: 'h', n: m[1].length, k: inline(m[2]) }); i++; continue; }
    if (TRENNER.test(z)) { aus.push({ t: 'hr' }); i++; continue; }
    if (ZITAT.test(z)) {
      const innen = [];
      while (i < zeilen.length && (m = ZITAT.exec(zeilen[i]))) { innen.push(m[1]); i++; }
      aus.push({ t: 'quote', k: tiefe < 6 ? markdownBaum(innen.join('\n'), tiefe + 1) : [{ t: 'p', k: [innen.join('\n')] }] });
      continue;
    }
    if (TABELLE.test(z)) {
      const tab = [];
      while (i < zeilen.length && TABELLE.test(zeilen[i])) tab.push(zeilen[i++]);
      aus.push({ t: 'code', x: tab.join('\n') });
      continue;
    }
    if ((m = LISTE.exec(z))) {
      const geordnet = /\d/.test(m[2]);
      const basis = m[1].length;
      const eintraege = [];
      while (i < zeilen.length) {
        const l = LISTE.exec(zeilen[i]);
        if (!l || l[1].length < basis || (l[1].length === basis && /\d/.test(l[2]) !== geordnet)) break;
        if (l[1].length > basis + 1 && eintraege.length) break;
        const innen = [l[3]];
        i++;
        while (i < zeilen.length && !leer(zeilen[i])) {
          const fortsetzung = LISTE.exec(zeilen[i]);
          if (fortsetzung && fortsetzung[1].length <= basis) break;
          if (!fortsetzung && !/^ {2,}/.test(zeilen[i]) && (ZAUN.test(zeilen[i]) || UEBERSCHRIFT.test(zeilen[i]) || ZITAT.test(zeilen[i]))) break;
          innen.push(zeilen[i].replace(/^ {1,4}/, ''));
          i++;
        }
        // Eine Leerzeile zwischen zwei Einträgen derselben Liste hält die Liste zusammen
        eintraege.push(tiefe < 6 ? markdownBaum(innen.join('\n'), tiefe + 1) : [{ t: 'p', k: [innen.join('\n')] }]);
        let j = i;
        while (j < zeilen.length && leer(zeilen[j])) j++;
        const naechste = j < zeilen.length ? LISTE.exec(zeilen[j]) : null;
        if (naechste && naechste[1].length === basis && /\d/.test(naechste[2]) === geordnet) i = j; else break;
      }
      aus.push({ t: geordnet ? 'ol' : 'ul', k: eintraege });
      continue;
    }
    // Absatz bis zur Leerzeile oder bis zum Anfang eines anderen Blocks
    const absatz = [];
    while (i < zeilen.length && !leer(zeilen[i])
      && (absatz.length === 0 || !(ZAUN.test(zeilen[i]) || UEBERSCHRIFT.test(zeilen[i]) || TRENNER.test(zeilen[i]) || ZITAT.test(zeilen[i]) || LISTE.test(zeilen[i]) || TABELLE.test(zeilen[i])))) {
      absatz.push(zeilen[i++].replace(/\s+$/, ''));
    }
    aus.push({ t: 'p', k: absatz.flatMap((s, n) => (n ? [{ t: 'br' }, ...inline(s.replace(/^\s+/, ''))] : inline(s.replace(/^\s+/, '')))) });
  }
  return aus;
}

// ---- Knoten

const ueberschrift = (n) => (n <= 2 ? 'h3' : 'h4');

function innen(knoten, bauen) {
  return knoten.map((k) => {
    if (typeof k === 'string') return k;
    switch (k.t) {
      case 'code': return bauen('code', {}, k.x);
      case 'b': return bauen('strong', {}, ...innen(k.k, bauen));
      case 'i': return bauen('em', {}, ...innen(k.k, bauen));
      case 'br': return bauen('br', {});
      case 'a': return bauen('a', { href: k.href, rel: 'noopener noreferrer', target: '_blank', referrerpolicy: 'no-referrer' }, ...innen(k.k, bauen));
      default: return '';
    }
  });
}

/** Baut aus dem Baum Knoten. `bauen(tag, attribute, ...kinder)` ist dom.js `el`; ein Test reicht eine Attrappe. */
export function markdownDom(baum, bauen = el) {
  return baum.map((b) => {
    switch (b.t) {
      case 'p': return bauen('p', {}, ...innen(b.k, bauen));
      case 'h': return bauen(ueberschrift(b.n), {}, ...innen(b.k, bauen));
      case 'hr': return bauen('hr', {});
      case 'code': return bauen('pre', { class: 'text-code' }, bauen('code', {}, b.x));
      case 'quote': return bauen('blockquote', { class: 'zitat' }, ...markdownDom(b.k, bauen));
      case 'ul': case 'ol': return bauen(b.t, {}, ...b.k.map((e) => bauen('li', {}, ...markdownDom(e, bauen))));
      default: return '';
    }
  });
}

/** Text zu Knoten in einem Aufruf. */
export const markdown = (text, bauen = el) => markdownDom(markdownBaum(text), bauen);
