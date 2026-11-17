#!/usr/bin/env node
// Kontrast der Farbrollen für die Beispielpaletten von Material You (tests/hilfen/farbrollen.mjs), je Variante, Palette und
// Schema. Feste Rollen kommen aus app.css. Text auf Fläche braucht 4,5:1, Symbole, Kanten und Knopfflächen 3:1.
// Aufruf: node tools/farbkontrast.mjs [--alles]   (ohne --alles nur Paare unter ihrer Schwelle)
import { readFileSync } from 'node:fs';
import { PALETTEN, kontrast, rollenBeider } from '../tests/hilfen/farbrollen.mjs';

const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8');
const werte = (text) => Object.fromEntries([...text.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
const hellCss = werte(/:root\s*{([^}]*)}/.exec(css)[1]);
const dunkelCss = { ...hellCss, ...werte(/prefers-color-scheme: dark\)\s*{\s*:root\s*{([^}]*)}/.exec(css)[1]) };

// [Vordergrund, Hintergrund, Schwelle, Zweck]
const PAARE = [
  ['--text', '--grund', 4.5, 'Text auf Grund'], ['--text', '--flaeche', 4.5, 'Text auf Fläche'],
  ['--neben', '--grund', 4.5, 'Nebentext auf Grund'], ['--neben', '--flaeche', 4.5, 'Nebentext auf Fläche'],
  ['--auf-akzent', '--akzent', 4.5, 'Text im gefüllten Knopf'], ['--auf-tonal', '--tonal', 4.5, 'Text im tonalen Knopf'],
  ['--akzent', '--grund', 4.5, 'Link und Textknopf auf Grund'], ['--akzent', '--flaeche', 4.5, 'Link und Textknopf auf Fläche'],
  ['--akzent', '--tonal', 3, 'Kante der Auswahl gegen Tonfläche'],
  ['--auf-umgekehrt', '--umgekehrt', 4.5, 'Hinweis unten'], ['--hinweis-knopf', '--umgekehrt', 4.5, 'Aktion im Hinweis'],
  ['--linie', '--grund', 1.3, 'Trennlinie auf Grund (nur Zierde)'],
  ['--id', '--flaeche', 4.5, 'Kennung auf Fläche (fest)'], ['--id', '--grund', 4.5, 'Kennung auf Grund (fest)'],
  ...['frage', 'freigabe', 'abnahme', 'auftrag', 'nachricht'].flatMap((a) => [
    [`--${a}-acc`, '--flaeche', 3, `Symbol ${a} auf Fläche (fest)`], [`--${a}-acc`, '--grund', 3, `Symbol ${a} auf Grund (fest)`]]),
];

const alles = process.argv.includes('--alles');
let schlecht = 0;
for (const v of ['a', 'b']) {
  for (const name of Object.keys(PALETTEN)) {
    const r = rollenBeider(v, name);
    for (const schema of ['hell', 'dunkel']) {
      const w = { ...(schema === 'hell' ? hellCss : dunkelCss), ...r[schema] };
      const zeilen = [];
      for (const [vg, hg, min, zweck] of PAARE) {
        if (!w[vg] || !w[hg]) continue;
        const k = kontrast(w[vg], w[hg]);
        const ok = k >= min;
        if (!ok) schlecht++;
        if (alles || !ok) zeilen.push(`  ${ok ? 'ok  ' : 'ZU WENIG'} ${k.toFixed(2).replace('.', ',')}:1 (mindestens ${min}) ${zweck}: ${vg} ${w[vg]} auf ${hg} ${w[hg]}`);
      }
      if (zeilen.length) process.stdout.write(`Variante ${v.toUpperCase()}, ${name}, ${schema}\n${zeilen.join('\n')}\n`);
    }
  }
}
process.stdout.write(`${schlecht} Paare unter der Schwelle\n`);
