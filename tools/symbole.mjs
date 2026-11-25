#!/usr/bin/env node
// Erzeugt aus tools/symbol.svg die Bilder des Symbols: symbole/symbol-192.png, symbol-512.png und maskierbar-512.png
// für die Web-App.
// Braucht rsvg-convert aus librsvg. Aufruf: make symbole. Exit 0 bei Erfolg, 1 bei Fehler.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROG = 'symbole';
const VOLL = 'viewBox="0 0 108 108"';
const BLAU = '<rect width="108" height="108" fill="#0B57D0"/>';

const ZIELE = [
  { datei: 'symbole/symbol-192.png', n: 192, aendern: (s) => s.replace(VOLL, 'viewBox="14 14 80 80"') },
  { datei: 'symbole/symbol-512.png', n: 512, aendern: (s) => s.replace(VOLL, 'viewBox="14 14 80 80"') },
  { datei: 'symbole/maskierbar-512.png', n: 512, aendern: (s) => s.replace(VOLL, 'viewBox="9.5 9.5 89 89"') },
];

const anzahl = (s, teil) => s.split(teil).length - 1;

function main() {
  const wurzel = fileURLToPath(new URL('../', import.meta.url));
  const quelle = readFileSync(join(wurzel, 'tools/symbol.svg'), 'utf8');
  if (anzahl(quelle, VOLL) !== 1 || anzahl(quelle, BLAU) !== 1) {
    process.stderr.write(`${PROG}: Fehler: tools/symbol.svg hat nicht den erwarteten Aufbau (viewBox 0 0 108 108, ein blaues Rechteck)\n`);
    return 1;
  }
  const ordner = mkdtempSync(join(tmpdir(), 'symbole-'));
  try {
    for (const [i, z] of ZIELE.entries()) {
      const svg = join(ordner, `${i}.svg`);
      writeFileSync(svg, z.aendern(quelle));
      const n = String(z.n);
      execFileSync('rsvg-convert', ['-w', n, '-h', n, '-o', join(wurzel, z.datei), svg], { stdio: ['ignore', 'ignore', 'inherit'] });
      process.stdout.write(`${PROG}: ${z.datei} (${z.n} × ${z.n})\n`);
    }
  } catch (e) {
    if (e.code === 'ENOENT') {
      process.stderr.write(`${PROG}: Fehler: rsvg-convert fehlt\nInstallier librsvg, dann noch einmal: make symbole\n`);
    } else {
      process.stderr.write(`${PROG}: Fehler: rsvg-convert brach ab (${e.status ?? e.message})\n`);
    }
    return 1;
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
