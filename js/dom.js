// Elemente nur mit textContent bauen, nie mit innerHTML aus Daten (USI-1). Symbole und feste Bausteine
// stehen als <template> in index.html und werden geklont; so braucht der Code keine SVG-Namensräume.

/** Baut ein Element; Attribute mit false entfallen, Kinder sind Text oder Knoten. */
export function el(tag, attr = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attr)) {
    if (v !== false && v !== null && v !== undefined) e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kinder.filter((k) => k !== null && k !== false && k !== undefined));
  return e;
}

/** Klont den Inhalt von <template id="ID"> aus index.html. */
export function vorlage(id) {
  const t = document.getElementById(id);
  if (!(t instanceof HTMLTemplateElement)) throw new Error(`Vorlage ${id} fehlt in index.html`);
  return t.content.cloneNode(true);
}
