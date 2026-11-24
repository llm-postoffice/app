// Ein winziges DOM für node --test: gerade genug, damit dom.js (el, ico) und die Ansichten Bäume bauen, die ein Test
// lesen kann. Es kennt Elemente, Text, Attribute, Klassen, Kinder, Ereignisse und einfache Selektoren (tag, .klasse,
// [name], [name="wert"], Komma). Kein Layout, keine Ereignisse außer dem, was ein Test selbst auslöst.
class Text { constructor(t) { this.data = String(t); this.eltern = null; } get textContent() { return this.data; } }

export class Knoten {
  constructor(tag, ns = null) { this.tag = tag.toLowerCase(); this.ns = ns; this.attr = new Map(); this.kinder = []; this.eltern = null; this.horcher = {}; this.wert = '';
    this.dataset = new Proxy({}, { set: (o, n, v) => { this.attr.set(`data-${n.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, String(v)); o[n] = v; return true; } });
  }

  setAttribute(k, v) { this.attr.set(k, String(v)); if (k === 'disabled') this.disabled = true; }
  getAttribute(k) { return this.attr.get(k) ?? null; }
  hasAttribute(k) { return this.attr.has(k); }
  removeAttribute(k) { this.attr.delete(k); }
  get className() { return this.attr.get('class') ?? ''; }
  set className(v) { this.attr.set('class', v); }
  get id() { return this.attr.get('id') ?? ''; }
  get hidden() { return this.attr.has('hidden'); }
  set hidden(v) { if (v) this.attr.set('hidden', ''); else this.attr.delete('hidden'); }
  get value() { return this.wert !== '' ? this.wert : (this.attr.get('value') ?? ''); }
  set value(v) { this.wert = String(v); }
  get checked() { return this.gesetzt ?? this.attr.has('checked'); }
  set checked(v) { this.gesetzt = Boolean(v); }
  get disabled() { return this.attr.has('disabled'); }
  set disabled(v) { if (v) this.attr.set('disabled', ''); else this.attr.delete('disabled'); }
  // Wie der Browser: ein Knoten bleibt Knoten, alles andere wird Text (ein Array also „a,b“, ein Element „[object HTMLSpanElement]“).
  append(...kinder) { for (const k of kinder) { const n = typeof k === 'string' ? new Text(k) : (k instanceof Knoten || k instanceof Text ? k : new Text(String(k))); n.eltern = this; this.kinder.push(n); } }
  replaceChildren(...kinder) { this.kinder = []; this.append(...kinder); }
  replaceWith(neu) { const i = this.eltern.kinder.indexOf(this); neu.eltern = this.eltern; this.eltern.kinder[i] = neu; }
  addEventListener(name, f) { (this.horcher[name] ??= []).push(f); }
  async klick() { for (const f of this.horcher.click ?? []) await f({ target: this, preventDefault() {} }); }
  focus() {}
  get textContent() { return this.kinder.map((k) => k.textContent).join(''); }
  set textContent(t) { this.kinder = []; this.append(String(t)); }
  *alle() { for (const k of this.kinder) if (k instanceof Knoten) { yield k; yield* k.alle(); } }
  matches(sel) {
    return sel.split(',').some((s) => {
      s = s.trim();
      const m = /^([a-z0-9]*)((?:\.[\w-]+|\[[\w-]+(?:="[^"]*")?\])*)$/i.exec(s);
      if (!m) return false;
      if (m[1] && m[1].toLowerCase() !== this.tag) return false;
      for (const teil of m[2].match(/\.[\w-]+|\[[^\]]+\]/g) ?? []) {
        if (teil[0] === '.') { if (!this.className.split(/\s+/).includes(teil.slice(1))) return false; } else {
          const [, n, v] = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(teil);
          if (v === undefined ? !this.attr.has(n) : this.attr.get(n) !== v) return false;
        }
      }
      return true;
    });
  }
  querySelectorAll(sel) { return [...this.alle()].filter((n) => n.matches(sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
}

/** Setzt document und ein paar Browser-Namen; gibt eine Funktion zurück, die sie entfernt. */
export function installiereFakeDom() {
  const vorher = globalThis.document;
  globalThis.document = { createElement: (t) => new Knoten(t), createElementNS: (ns, t) => new Knoten(t, ns), querySelector: () => ({ namespaceURI: 'svg-raum' }) };
  return () => { globalThis.document = vorher; };
}

/** Alle Texte unter einem Knoten oder einer Liste von Knoten, zu einer Zeichenkette. */
export const textVon = (x) => (Array.isArray(x) ? x.flat(Infinity).filter(Boolean).map(textVon).join(' ') : x?.textContent ?? '');
/** Alle Knoten einer Liste (oder Bäume) passend zu `sel`. */
export const suche = (x, sel) => [x].flat(Infinity).filter(Boolean).flatMap((n) => (n.matches?.(sel) ? [n] : []).concat(n.querySelectorAll?.(sel) ?? []));
