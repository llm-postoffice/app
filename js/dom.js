// Elemente nur mit textContent bauen, nie mit innerHTML aus Daten (USI-1). Symbole stehen als Sprite in index.html
// und werden über ein use-Element mit dem Namen des Symbols gerufen; so braucht der Code keine Bilddatei und keine Schrift.
// Den Namensraum von SVG liest der Code vom Sprite in index.html ab, den der HTML-Parser schon richtig angelegt hat; so
// steht in den Modulen keine Adresse eines fremden Hosts (tools/fremdhost.mjs).
const svgRaum = () => document.querySelector('svg.sprite').namespaceURI;

/** Baut ein Element; Attribute mit false entfallen, Kinder sind Text, Knoten oder Listen davon. Text bleibt Text, nie HTML. */
export function el(tag, attr = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attr)) {
    if (v !== false && v !== null && v !== undefined) e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kinder.flat(Infinity).filter((k) => k !== null && k !== false && k !== undefined));
  return e;
}

/** Ein Symbol aus dem Sprite, 24 px; `klasse` hängt weitere Klassen an. Das Wort daneben trägt die Bedeutung (UFA-2). */
export function ico(name, klasse = '') {
  const s = document.createElementNS(svgRaum(), 'svg');
  s.setAttribute('class', klasse ? `ico ${klasse}` : 'ico');
  s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(svgRaum(), 'use');
  u.setAttribute('href', `#i-${name}`);
  s.append(u);
  return s;
}
