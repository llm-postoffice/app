// Prüft das Gerüst gegen die Regeln aus p94-hig mobile und die Vorgaben der App: Manifest (UPL-2), CSP (UPL-3),
// Viewport (UPL-4, UPL-5), Textskalierung (USC-1), Symbole, Hülle im Service Worker (UOF-1). Die Suchen spiegeln
// die Testrezepte der Checkliste.
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

const wurzel = new URL('../', import.meta.url).pathname;
const lies = (datei) => readFile(join(wurzel, datei), 'utf8');
const gibt = (datei) => stat(join(wurzel, datei)).then(() => true, () => false);
const ohneKommentare = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
async function dateien(ordner) {
  const liste = [];
  for (const e of await readdir(join(wurzel, ordner), { withFileTypes: true })) {
    if (e.isDirectory()) liste.push(...await dateien(join(ordner, e.name)));
    else liste.push(join(ordner, e.name));
  }
  return liste.sort();
}

const CSP = "default-src 'none'; manifest-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
  + "connect-src 'self' https://api.github.com; base-uri 'none'; form-action 'none'";
const html = await lies('index.html');

test('das Manifest nennt alles, was Chromium zum Installieren verlangt (UPL-2)', async () => {
  const m = JSON.parse(await lies('manifest.webmanifest'));
  assert.equal(m.name, 'LLM-Post');
  assert.equal(m.short_name, 'LLM-Post');
  assert.equal(m.display, 'standalone');
  assert.equal(m.id, './');
  assert.equal(m.scope, './');
  assert.equal(m.start_url, './#wartet');
  assert.equal(m.lang, 'de');
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/);
  assert.match(m.background_color, /^#[0-9a-f]{6}$/);
  for (const g of ['192x192', '512x512']) assert.ok(m.icons.some((i) => i.sizes === g && i.purpose === 'any'), `Symbol ${g} any`);
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'), 'maskierbares Symbol');
  for (const i of m.icons) assert.ok(await gibt(i.src), `${i.src} fehlt`);
  for (const wert of [m.id, m.scope, m.start_url, ...m.icons.map((i) => i.src)]) assert.doesNotMatch(wert, /^(\/|[a-z]+:)/, `${wert} ist nicht relativ`);
});

test('die CSP steht als meta und lautet wie vorgegeben, dazu manifest-src (UPL-3)', () => {
  const m = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html);
  assert.equal(m?.[1], CSP);
});

test('die Seite lädt weder Skripte noch Stil noch Hosts von außen und hat kein Inline-Skript (UPL-3)', () => {
  assert.deepEqual([...html.matchAll(/<script\b[^>]*>/g)].map((s) => s[0]), ['<script type="module" src="js/start.js">']);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/, 'Ereignisattribut');
  assert.doesNotMatch(html, /\sstyle\s*=/, 'style-Attribut verletzt style-src');
  assert.doesNotMatch(html, /<style\b/);
  assert.doesNotMatch(html, /(src|href)="(https?:)?\/\//);
  assert.doesNotMatch(html, /autofocus/, 'UEI-4');
});

test('Viewport, Sprache und Textskalierung stehen wie verlangt (UPL-4, UPL-5, USC-1)', () => {
  assert.match(html, /<html lang="de">/);
  const viewport = /<meta name="viewport" content="([^"]*)"/.exec(html)?.[1] ?? '';
  assert.match(viewport, /width=device-width/);
  assert.match(viewport, /viewport-fit=cover/);
  assert.match(viewport, /interactive-widget=resizes-content/);
  assert.doesNotMatch(viewport, /user-scalable\s*=\s*(no|0)|maximum-scale/);
  assert.match(html, /<meta name="text-scale" content="scale">/);
  assert.match(html, /<meta name="color-scheme" content="light dark">/);
  assert.match(html, /<meta name="theme-color" media="\(prefers-color-scheme: light\)" content="#ffffff">/);
  assert.match(html, /<meta name="theme-color" media="\(prefers-color-scheme: dark\)" content="#121316">/);
});

test('jedes Symbol, das die Seite oder der Code ruft, steht im Sprite', async () => {
  const sprite = new Set([...html.matchAll(/<symbol id="(i-[^"]+)"/g)].map((m) => m[1]));
  assert.ok(sprite.size > 0);
  const quellen = [html, ...await Promise.all((await dateien('js')).map(lies))].join('\n');
  // Namen stehen als href="#i-NAME", als symbol: 'NAME' (texte.js, ansichtstexte.js, karten.js) oder als ico('NAME')
  const gerufen = new Set([...quellen.matchAll(/href="#(i-[^"]+)"/g)].map((m) => m[1]));
  for (const m of quellen.matchAll(/\bsymbol: '([a-z_-]+)'/g)) gerufen.add(`i-${m[1]}`);
  for (const m of quellen.matchAll(/\bico\('([a-z_-]+)'/g)) gerufen.add(`i-${m[1]}`);
  for (const g of gerufen) assert.ok(sprite.has(g), `Symbol ${g} fehlt im Sprite`);
  for (const s of sprite) assert.ok(gerufen.has(s), `Symbol ${s} steht im Sprite, wird aber nicht gerufen`);
});

test('der Service Worker hält jede Datei der Hülle und nichts, was es nicht gibt (UOF-1)', async () => {
  const sw = await lies('sw.js');
  const liste = [...(/const DATEIEN = \[([^\]]*)\]/s.exec(sw)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(liste.length > 0);
  const dazu = liste.filter((d) => d !== './').map((d) => d.replace(/^\.\//, ''));
  for (const d of dazu) assert.ok(await gibt(d), `${d} steht in DATEIEN, fehlt aber`);
  const erwartet = ['index.html', 'app.css', 'manifest.webmanifest', ...await dateien('js'), ...await dateien('symbole')].sort();
  assert.deepEqual([...dazu].sort(), erwartet);
  assert.ok(liste.includes('./'), 'die Startadresse ./ gehört in die Hülle');
});

test('der Code baut keinen Text als HTML und nutzt keine Fenster des Browsers (USI-1, UDI-2)', async () => {
  for (const d of await dateien('js')) {
    const text = ohneKommentare(await lies(d));
    assert.doesNotMatch(text, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/, d);
    assert.doesNotMatch(text, /\b(alert|confirm|prompt)\(/, d);
    assert.doesNotMatch(text, /\beval\(|new Function\(/, d);
    assert.doesNotMatch(text, /Notification\.requestPermission|getUserMedia|geolocation/, `${d}: Berechtigung nur im Zusammenhang (UDI-5)`);
  }
});

test('das Stylesheet setzt keine feste Schrift und keine Höhe in vh (USC-1, UAN-4)', async () => {
  const css = await lies('app.css');
  assert.doesNotMatch(css, /font-size:\s*[0-9.]+px/);
  assert.doesNotMatch(css, /(^|\})\s*(html|:root)\s*\{[^}]*font-size/);
  assert.doesNotMatch(css, /100vh/);
  assert.doesNotMatch(css, /@import|url\(/);
});

test('die App kennt den entfernten Hinweisdienst nicht mehr: kein Treffer in index.html, sw.js und js/', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const dateien = ['../index.html', '../sw.js', ...(await readdir(new URL('../js/', import.meta.url))).map((f) => `../js/${f}`)];
  for (const f of dateien) assert.doesNotMatch(await readFile(new URL(f, import.meta.url), 'utf8'), new RegExp('nt' + 'fy', 'i'), f);
});
