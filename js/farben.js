// Systemfarben der Android-Hülle (Material You). Die Hülle schickt { art: 'farben', hell: { ROLLE: '#rrggbb', … }, dunkel: { … } }
// (Protokoll im Kopf von huelle.js); die Rollen heißen wie die Variablen in app.css ohne `--`. Hier steht, welche Rollen gelten,
// was ein gültiger Wert ist und wie sie auf :root landen. Rein bis auf `stil` (style der Wurzel, CSSOM statt Inline-Stil im
// Markup, die CSP bleibt) und `dunkel` (die Abfrage prefers-color-scheme), beides Parameter. Ohne Hülle kommt nie eine
// Nachricht: dann gelten die festen Farben aus app.css.

/** Die Rollen, die die Hülle setzen darf. Arten, Zustände und Kennung (frage-…, f-…, ok-…, id) bleiben fest. */
export const ROLLEN = ['akzent', 'auf-akzent', 'tonal', 'auf-tonal', 'grund', 'flaeche', 'text', 'neben', 'linie',
  'umgekehrt', 'auf-umgekehrt', 'hinweis-knopf'];

const HEX = /^#[0-9a-f]{6}$/i;

const einSchema = (m) => {
  const aus = {};
  if (!m || typeof m !== 'object' || Array.isArray(m)) return aus;
  for (const rolle of ROLLEN) if (typeof m[rolle] === 'string' && HEX.test(m[rolle])) aus[rolle] = m[rolle].toLowerCase();
  return aus;
};

/** Die gültigen Werte je Schema, { hell, dunkel }; ungültige Werte und unbekannte Rollen fallen weg, nichts Gültiges ergibt null. */
export function pruefeFarben(n) {
  if (!n || typeof n !== 'object') return null;
  const aus = { hell: einSchema(n.hell), dunkel: einSchema(n.dunkel) };
  return Object.keys(aus.hell).length + Object.keys(aus.dunkel).length > 0 ? aus : null;
}

export class Systemfarben {
  #stil;
  #dunkel;
  #stand = null;

  /**
   * @param {object} p
   * @param {{ setProperty: Function, removeProperty: Function }} p.stil  style der Wurzel
   * @param {{ matches: boolean, addEventListener: Function }} p.dunkel   die Abfrage (prefers-color-scheme: dark)
   */
  constructor({ stil, dunkel }) {
    this.#stil = stil;
    this.#dunkel = dunkel;
    dunkel.addEventListener('change', () => this.#anwenden());
  }

  /** Übernimmt eine Nachricht der Hülle; eine ohne gültigen Wert ändert nichts. Gibt zurück, ob etwas galt. */
  uebernimm(n) {
    const f = pruefeFarben(n);
    if (!f) return false;
    this.#stand = f;
    this.#anwenden();
    return true;
  }

  #anwenden() {
    if (!this.#stand) return;
    const werte = this.#stand[this.#dunkel.matches ? 'dunkel' : 'hell'];
    for (const rolle of ROLLEN) {
      if (rolle in werte) this.#stil.setProperty(`--${rolle}`, werte[rolle]); else this.#stil.removeProperty(`--${rolle}`);
    }
  }
}

/** Die Systemfarben der Seite, wenn sie einen Browser mit Wurzel und Abfrage hat, sonst null. */
export function systemfarbenVon(g = globalThis) {
  const stil = g.document?.documentElement?.style;
  const dunkel = typeof g.matchMedia === 'function' ? g.matchMedia('(prefers-color-scheme: dark)') : null;
  return stil && dunkel ? new Systemfarben({ stil, dunkel }) : null;
}
