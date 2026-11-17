#!/usr/bin/env node
// Rendert die Ansichten der App mit erfundenen Daten: startet die Vorschau (tools/vorschau.mjs) und lässt den Renderer
// rendern-mobil.mjs aus dem p94-hig-Klon jedes Szenario in beiden Größen, hell, dunkel, Schrift 200 % und ohne Netz
// prüfen (UEW-2). Die Bilder liegen je Szenario in einem Ordner: ORDNER/SZENARIO/ADRESSE-GROESSE-MODUS.png.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { starteVorschau } from './vorschau.mjs';
import { ADRESSEN, SZENARIEN } from '../tests/hilfen/beispieldaten.mjs';

const PROG = 'rendern';
const HILFE = `Aufruf: node tools/rendern.mjs [OPTIONEN] [SZENARIO...]

Rendert die Ansichten der App mit erfundenen Daten in Chromium (Handy-Größen, hell, dunkel, Schrift 200 %,
ohne Netz) und schreibt die Bilder und das Protokoll lauf.txt nach ORDNER. Ohne SZENARIO rendert es alle außer den
Bildszenarien (mehr-fassung, mehr-installieren, mehr-installiert, mehr-mitteilungen): sie scrollen Mehr zu einem
Abschnitt, damit das Bild ihn zeigt, und der Renderer meldet beim Scrollen Text unter der Statusleiste als Fehler des
Randes. Ebenso fehlen huelle und mehr-huelle (die Android-Hülle): dort registriert die App keinen Service Worker, und
der Renderer meldet den Start ohne Netz als Fehler.
Nenne sie mit Namen, um ihre Bilder zu sehen.

Beispiele:
  Alle Szenarien nach bilder/ rendern:
    node tools/rendern.mjs --hig ../p94-hig -o bilder
  Nur Wartet ohne Einträge und mit Fehler:
    node tools/rendern.mjs --hig ../p94-hig -o bilder leer fehler

Optionen:
      --hig PFAD       Klon von p94-hig mit beispiele/rendern-mobil.mjs (Vorgabe: ../p94-hig)
  -o, --ausgabe ORDNER Zielordner (Vorgabe: bilder)
      --warte MS       Pause nach dem Laden, bevor der Renderer prüft (Vorgabe: 1500; der Einstieg legt erst die Daten an)
      --liste          Szenarien und Adressen nennen und beenden
  -h, --help           diese Hilfe zeigen

Exit-Status: 0 alles PASS, 1 mindestens ein FAIL, 2 falscher Aufruf, 3 etwas nicht prüfbar (BLOCKED).
`;

let a;
try {
  a = parseArgs({ args: process.argv.slice(2), allowPositionals: true, strict: true,
    options: { hig: { type: 'string', default: '../p94-hig' }, ausgabe: { type: 'string', short: 'o', default: 'bilder' }, liste: { type: 'boolean' }, warte: { type: 'string', default: '1500' }, help: { type: 'boolean', short: 'h' } } });
} catch (e) {
  process.stderr.write(`${PROG}: Fehler: ${e.message}\nHilfe: node tools/rendern.mjs --help\n`);
  process.exit(2);
}
if (a.values.help) { process.stdout.write(HILFE); process.exit(0); }
if (a.values.liste) {
  for (const [n, liste] of Object.entries(ADRESSEN)) process.stdout.write(`${n}: ${liste.join(' ')}\n`);
  process.exit(0);
}
const szenarien = a.positionals.length ? a.positionals : Object.keys(ADRESSEN).filter((n) => !SZENARIEN[n]?.scroll && !SZENARIEN[n]?.huelle);
const unbekannt = szenarien.find((s) => !ADRESSEN[s]);
if (unbekannt) { process.stderr.write(`${PROG}: Fehler: unbekanntes Szenario „${unbekannt}“\nMögliche: ${Object.keys(ADRESSEN).join(', ')}\n`); process.exit(2); }
const renderer = join(a.values.hig, 'beispiele/rendern-mobil.mjs');
mkdirSync(a.values.ausgabe, { recursive: true });

const { server, basis } = await starteVorschau();
const lauf = (sz) => new Promise((ok) => {
  const ordner = join(a.values.ausgabe, sz);
  const urls = ADRESSEN[sz].map((adr) => `${basis}/${sz}/#${adr}`);
  const kind = spawn(process.execPath, [renderer, '-o', ordner, `--warte=${a.values.warte}`, ...urls], { stdio: ['ignore', 'pipe', 'pipe'] });
  let aus = '';
  kind.stdout.on('data', (d) => { aus += d; });
  kind.stderr.on('data', (d) => { aus += d; });
  kind.on('error', (e) => { aus += `BLOCKED  Renderer  ${e.message}\n`; ok({ code: 3, aus }); });
  kind.on('exit', (code) => ok({ code: code ?? 1, aus }));
});

let protokoll = '';
let schlimmster = 0;
const rang = { 0: 0, 3: 1, 1: 2 };
for (const sz of szenarien) {
  process.stderr.write(`${PROG}: rendere Szenario ${sz} …\n`);
  const r = await lauf(sz);
  const zeilen = r.aus.split('\n').filter((z) => /^(PASS|WARN|FAIL|SKIP|BLOCKED)/.test(z)).map((z) => `${sz}: ${z}`);
  protokoll += `${zeilen.join('\n')}\n${sz}: ${r.aus.trim().split('\n').pop()}\n`;
  if ((rang[r.code] ?? 2) > (rang[schlimmster] ?? 0)) schlimmster = r.code;
}
server.close();
writeFileSync(join(a.values.ausgabe, 'lauf.txt'), protokoll);
process.stdout.write(protokoll);
process.exitCode = schlimmster;
