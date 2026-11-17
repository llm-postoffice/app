// Material You für die Vorschau: erfundene Systempaletten (Monet) und die Zuordnung ihrer Töne zu den Farbrollen von app.css.
// Rein, ohne Browser. Die Paletten sind nachgebaut, nicht vom Gerät gelesen: Helligkeit (Ton) und Farbton stimmen mit
// Android überein (Töne 0, 10, 50, 100 bis 1000 = Helligkeit 100, 99, 95, 90 bis 0), die Buntheit (accent1 48, accent2 16,
// accent3 32 bei Farbton +60, neutral1 4, neutral2 8) ist in CIE-LCh angenähert und in den sRGB-Raum gekürzt.

/** Töne der Systempalette und ihre Helligkeit (L*). */
export const TOENE = { 0: 100, 10: 99, 50: 95, 100: 90, 200: 80, 300: 70, 400: 60, 500: 50, 600: 40, 700: 30, 800: 20, 900: 10, 1000: 0 };

/** Grundfarbtöne (LCh-Winkel) der Beispielpaletten, wie sie ein Hintergrundbild ergibt. */
export const GRUNDFARBEN = { gruen: 140, orange: 60, violett: 305 };

const lin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const unlin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function lchNachRgb(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const f = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const X = 0.95047 * f(fx), Y = L > 8 ? fy ** 3 : L / (24389 / 27), Z = 1.08883 * f(fz);
  return [
    3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
    -0.969266 * X + 1.8760108 * Y + 0.041556 * Z,
    0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z,
  ];
}
const imRaum = (rgb) => rgb.every((c) => c >= -0.0005 && c <= 1.0005);

/** Hex-Farbe zu Helligkeit L, Buntheit C (gekürzt, bis sie in sRGB passt) und Farbton h. */
export function lchHex(L, C, h) {
  if (L >= 100) return '#ffffff';
  if (L <= 0) return '#000000';
  let lo = 0, hi = C;
  if (imRaum(lchNachRgb(L, C, h))) lo = C;
  else for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (imRaum(lchNachRgb(L, m, h))) lo = m; else hi = m; }
  return '#' + lchNachRgb(L, lo, h).map((c) => Math.round(Math.min(1, Math.max(0, lin(c))) * 255).toString(16).padStart(2, '0')).join('');
}

/** Die fünf Tonpaletten für einen Grundfarbton: { accent1, accent2, accent3, neutral1, neutral2 }, je { 0 … 1000 }. */
export function palette(h) {
  const art = { accent1: [48 * 1.3, h], accent2: [16 * 1.3, h], accent3: [32 * 1.3, h + 60], neutral1: [4, h], neutral2: [8, h] };
  const aus = {};
  for (const [name, [c, w]] of Object.entries(art)) {
    aus[name] = Object.fromEntries(Object.entries(TOENE).map(([ton, l]) => [ton, lchHex(l, c, w)]));
  }
  return aus;
}
export const PALETTEN = Object.fromEntries(Object.entries(GRUNDFARBEN).map(([n, h]) => [n, palette(h)]));

// Zuordnung nach Material 3 (Standardschema), aus den Systemtönen: Rolle von app.css = [Palette, Ton].
const AKZENT = {
  hell: { '--akzent': ['accent1', 600], '--auf-akzent': ['accent1', 0], '--tonal': ['accent1', 100], '--auf-tonal': ['accent1', 900] },
  dunkel: { '--akzent': ['accent1', 200], '--auf-akzent': ['accent1', 800], '--tonal': ['accent1', 700], '--auf-tonal': ['accent1', 100] },
};
const FLAECHEN = {
  hell: {
    '--grund': ['neutral1', 10], '--flaeche': ['neutral1', 50], '--text': ['neutral1', 900], '--neben': ['neutral2', 700],
    '--linie': ['neutral2', 200], '--umgekehrt': ['neutral1', 800], '--auf-umgekehrt': ['neutral1', 50],
  },
  dunkel: {
    '--grund': ['neutral1', 900], '--flaeche': ['neutral1', 800], '--text': ['neutral1', 100], '--neben': ['neutral2', 200],
    '--linie': ['neutral2', 700], '--umgekehrt': ['neutral1', 100], '--auf-umgekehrt': ['neutral1', 800],
  },
};
// Aktion im Hinweis unten (Snackbar): inversePrimary
const HINWEIS = { hell: ['accent1', 200], dunkel: ['accent1', 600] };

/** Die Rollen als Werte: variante 'a' (nur Akzente) oder 'b' (auch Flächen), schema 'hell' oder 'dunkel'. */
export function rollen(variante, pal, schema) {
  const tab = { ...AKZENT[schema], ...(variante === 'b' ? FLAECHEN[schema] : {}) };
  const aus = Object.fromEntries(Object.entries(tab).map(([rolle, [p, t]]) => [rolle, pal[p][t]]));
  aus['--hinweis-knopf'] = pal[HINWEIS[schema][0]][HINWEIS[schema][1]];
  return aus;
}

/** Werte aller Rollen einer Variante für beide Schemata (feste Rollen kommen aus app.css und fehlen hier). */
export function rollenBeider(variante, name) {
  const pal = PALETTEN[name];
  return { hell: rollen(variante, pal, 'hell'), dunkel: rollen(variante, pal, 'dunkel') };
}

const kanal = (hex, i) => unlin(parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255);
export const leuchtdichte = (hex) => 0.2126 * kanal(hex, 0) + 0.7152 * kanal(hex, 1) + 0.0722 * kanal(hex, 2);
export function kontrast(a, b) {
  const [x, y] = [leuchtdichte(a), leuchtdichte(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
