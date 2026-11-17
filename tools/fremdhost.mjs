#!/usr/bin/env node
// Prüft, dass im Code kein Fremdhost steht (UPL-3): Die App darf nur api.github.com und ntfy.sh nennen; die
// Werkzeuge und Tests dürfen zusätzlich den eigenen Rechner (127.0.0.1, localhost) nennen. Gesucht wird in
// HTML, CSS, JavaScript, Manifest und JSON; Markdown und Lizenztexte sind kein Code.
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ERLAUBT_APP = ['api.github.com', 'ntfy.sh'];
export const ERLAUBT_WERKZEUG = [...ERLAUBT_APP, '127.0.0.1', 'localhost'];
const ENDUNGEN = new Set(['.html', '.css', '.js', '.mjs', '.webmanifest', '.json']);
const AUSLASSEN = new Set(['.git', 'node_modules', 'bilder', 'LICENSES', 'build', '.gradle', '.kotlin']);
const MUSTER = [
  /\b(?:https?|wss?|ftp):\/\/(\[[0-9a-f:]+\]|[A-Za-z0-9._-]+)/gi,
  /(?:\b(?:src|href|action|poster|srcset)\s*=\s*["']?|url\(\s*["']?|@import\s+["'])\/\/([A-Za-z0-9._-]+)/gi,
];

/** Liefert die Hosts, die ein Text nennt, mit der Zeilennummer (ab 1). */
export function hostsIn(text) {
  const funde = [];
  text.split('\n').forEach((zeile, i) => {
    for (const muster of MUSTER) for (const m of zeile.matchAll(muster)) funde.push({ host: m[1].toLowerCase(), zeile: i + 1 });
  });
  return funde;
}

async function dateien(ordner) {
  const liste = [];
  for (const e of await readdir(ordner, { withFileTypes: true })) {
    if (AUSLASSEN.has(e.name)) continue;
    const pfad = join(ordner, e.name);
    if (e.isDirectory()) liste.push(...await dateien(pfad));
    else if (ENDUNGEN.has(extname(e.name))) liste.push(pfad);
  }
  return liste;
}

const HILFE = `Aufruf: node tools/fremdhost.mjs [OPTIONEN]

Prüft, dass im Code kein Fremdhost steht. Die App (index.html, app.css, sw.js, manifest.webmanifest, js/) darf
nur ${ERLAUBT_APP.join(' und ')} nennen, tools/ und tests/ dürfen zusätzlich 127.0.0.1 und localhost nennen.

Beispiel:
  Den ganzen Arbeitsbaum prüfen:
    node tools/fremdhost.mjs

Optionen:
  -h, --help  diese Hilfe zeigen

Exit-Status: 0 kein Fremdhost, 1 mindestens ein Fremdhost, 2 falscher Aufruf.
`;

async function main() {
  const arg = process.argv.slice(2);
  if (arg.includes('-h') || arg.includes('--help')) { process.stdout.write(HILFE); return 0; }
  if (arg.length) {
    process.stderr.write(`fremdhost: Fehler: unbekanntes Argument „${arg[0]}“\nHilfe: node tools/fremdhost.mjs --help\n`);
    return 2;
  }
  const wurzel = fileURLToPath(new URL('../', import.meta.url));
  const alle = await dateien(wurzel);
  let fehler = 0;
  for (const datei of alle) {
    const rel = relative(wurzel, datei);
    const werkzeug = rel.startsWith('tools/') || rel.startsWith('tests/');
    const erlaubt = werkzeug ? ERLAUBT_WERKZEUG : ERLAUBT_APP;
    for (const f of hostsIn(await readFile(datei, 'utf8'))) {
      if (erlaubt.includes(f.host)) continue;
      fehler++;
      console.log(`FAIL  ${rel}:${f.zeile}: Host „${f.host}“ ist nicht erlaubt (erlaubt: ${erlaubt.join(', ')})`);
    }
  }
  console.log(fehler ? `${fehler} FAIL` : `PASS  ${alle.length} Dateien geprüft, kein Fremdhost`);
  return fehler ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(await main());
