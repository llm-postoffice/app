#!/usr/bin/env node
// Rendert die Ansichten der App mit erfundenen Daten: startet die Vorschau (tools/vorschau.mjs) und lässt den Renderer
// rendern-mobil.mjs aus dem p94-hig-Klon jedes Szenario in beiden Größen, hell, dunkel, Schrift 200 % und ohne Netz
// prüfen. Die Bilder liegen je Szenario in einem Ordner: ORDNER/SZENARIO/ADRESSE-GROESSE-MODUS.png.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { starteVorschau } from './vorschau.mjs';
import { pruefeBilder } from './bilder.mjs';
import { ADRESSEN, SZENARIEN } from '../tests/hilfen/beispieldaten.mjs';

const PROG = 'rendern';
const JOB_MB = 1200;   // gemessen: Spitze eines Jobs (Renderer, Chromium und alle seine Prozesse, Summe PSS) bei 15 Adressen in MB
const MAX_JOBS = 6;
// Ausdruck für --bereit des Renderers: die Vorschau setzt window.fertig am Ende des Einstiegs (tools/vorschau.mjs); dazu muss im Hauptbereich Text stehen (so misst der Renderer UEW-2)
const BEREIT = 'window.fertig === true && (document.querySelector("main") ?? document.body).innerText.trim().length >= 10';
const MAX_BEFUNDE = 8;   // Zeilen je Szenario für leere oder doppelte Bilder
const KURZ = `Aufruf: node tools/rendern.mjs [OPTIONEN] [SZENARIO...]

Rendert die Ansichten der App mit erfundenen Daten in Chromium und schreibt Bilder und Protokoll nach ORDNER.

Beispiele:
  Alle Szenarien nach bilder/ rendern:
    node tools/rendern.mjs --hig ../p94-hig -o bilder
  Nur Wartet ohne Einträge und mit Fehler:
    node tools/rendern.mjs --hig ../p94-hig -o bilder leer fehler

Optionen:
      --hig PFAD       Klon von p94-hig mit beispiele/rendern-mobil.mjs (Vorgabe: ../p94-hig)
  -o, --ausgabe ORDNER Zielordner (Vorgabe: bilder)
  -j, --jobs N         Szenarien gleichzeitig (Vorgabe: nach Kernen und freiem Speicher, höchstens ${MAX_JOBS})
      --liste          Szenarien und Adressen nennen und beenden
  -h, --help           diese Hilfe zeigen; --help all zeigt alles
`;
const ALLES = `${KURZ}      --warte MS       Obergrenze, wie lange der Renderer nach dem Laden auf die gezeichnete Ansicht wartet (Vorgabe: 10000);
                       er prüft, sobald sie steht, nicht erst nach Ablauf

Danach prüft das Werkzeug jedes Bild: ein leeres Bild, ein fehlendes oder dasselbe Bild für zwei Adressen eines Szenarios ist ein FAIL
(der Renderer meldet dafür PASS, wenn die Seite nach einem Fehler beim Start nur die leere Hülle zeigt).

Jedes Szenario läuft in beiden Handy-Größen, hell, dunkel, mit Schrift 200 % und ohne Netz. Die Bilder liegen
unter ORDNER/SZENARIO/, das Protokoll in ORDNER/lauf.txt. Ohne SZENARIO rendert es alle außer diesen:
mehr-fassung, mehr-installieren, mehr-installiert und mehr-mitteilungen scrollen Mehr zu einem Abschnitt, und der
Renderer meldet beim Scrollen Text unter der Statusleiste als Fehler des Randes.
Nenne sie mit Namen, um ihre Bilder zu sehen.

Jobs: Jedes Szenario läuft in einem eigenen Renderer mit eigenem Chromium, Profil und Temp-Ordner; ein Job braucht
etwa ${JOB_MB} MB. Die Vorgabe ist die Hälfte der Kerne, höchstens ${MAX_JOBS} und höchstens so viele, wie in den freien Speicher
(MemAvailable) passen; ist CLAUDE_JOBS eine positive Zahl, nie mehr als sie. Mit --jobs 1 laufen die Szenarien nacheinander. lauf.txt steht immer in der Reihenfolge der Szenarien.

Exit-Status: 0 alles PASS, 1 mindestens ein FAIL, 2 falscher Aufruf, 3 etwas nicht prüfbar (BLOCKED).
`;

let a;
try {
  a = parseArgs({ args: process.argv.slice(2), allowPositionals: true, strict: true,
    options: { hig: { type: 'string', default: '../p94-hig' }, ausgabe: { type: 'string', short: 'o', default: 'bilder' }, liste: { type: 'boolean' }, jobs: { type: 'string', short: 'j' }, warte: { type: 'string', default: '10000' }, help: { type: 'boolean', short: 'h' } } });
} catch (e) {
  process.stderr.write(`${PROG}: Fehler: ${e.message}\nHilfe: node tools/rendern.mjs --help\n`);
  process.exit(2);
}
if (a.values.help) { process.stdout.write(a.positionals[0] === 'all' ? ALLES : KURZ); process.exit(0); }
if (a.values.liste) {
  for (const [n, liste] of Object.entries(ADRESSEN)) process.stdout.write(`${n}: ${liste.join(' ')}\n`);
  process.exit(0);
}
const szenarien = a.positionals.length ? a.positionals : Object.keys(ADRESSEN).filter((n) => !SZENARIEN[n]?.scroll);
const unbekannt = szenarien.find((s) => !ADRESSEN[s]);
if (unbekannt) { process.stderr.write(`${PROG}: Fehler: unbekanntes Szenario „${unbekannt}“\nMögliche: ${Object.keys(ADRESSEN).join(', ')}\n`); process.exit(2); }
const renderer = join(a.values.hig, 'beispiele/rendern-mobil.mjs');
const fehler = (text) => { process.stderr.write(`${PROG}: Fehler: ${text}\nHilfe: node tools/rendern.mjs --help\n`); process.exit(2); };
// Ein Renderer vor p94-hig 20261121.01 kennt --bereit nicht und lehnte den Aufruf mit Exit 2 ab: das melden wir vorher klar
if (existsSync(renderer) && !readFileSync(renderer, 'utf8').includes('--bereit')) fehler(`${renderer} kennt --bereit nicht; der Klon von p94-hig muss mindestens Fassung 20261121.01 haben (git pull im Klon)`);

/** Speicher, der für neue Prozesse frei ist (MemAvailable), in MB; null, wenn /proc/meminfo fehlt. */
function freierSpeicherMB() {
  try { return Math.floor(Number(/^MemAvailable:\s+(\d+) kB/m.exec(readFileSync('/proc/meminfo', 'utf8'))[1]) / 1024); } catch { return null; }
}
const frei = freierSpeicherMB();
let jobs;
if (a.values.jobs !== undefined) {
  if (!/^[1-9]\d*$/.test(a.values.jobs)) fehler(`--jobs verlangt eine ganze Zahl ab 1, nicht „${a.values.jobs}“`);
  jobs = Number(a.values.jobs);
} else {
  jobs = Math.max(1, Math.min(MAX_JOBS, Math.floor(availableParallelism() / 2), frei === null ? MAX_JOBS : Math.floor(frei / JOB_MB)));
  // CLAUDE_JOBS (positive ganze Zahl) ist der Anteil, den der Aufrufer diesem Lauf zugesteht; alles andere gilt als nicht gesetzt
  if (/^[1-9]\d*$/.test(process.env.CLAUDE_JOBS ?? '')) jobs = Math.min(jobs, Number(process.env.CLAUDE_JOBS));
}
jobs = Math.min(jobs, szenarien.length);
mkdirSync(a.values.ausgabe, { recursive: true });

const { server, basis } = await starteVorschau();
const lauf = (sz) => new Promise((ok) => {
  const ordner = join(a.values.ausgabe, sz);
  const urls = ADRESSEN[sz].map((adr) => `${basis}/${sz}/#${adr}`);
  // Jeder Renderer legt sein Profil und seinen Server selbst an (mkdtemp, Port 0): Jobs stoßen sich nicht
  const kind = spawn(process.execPath, [renderer, '-o', ordner, `--warte=${a.values.warte}`, `--bereit=${BEREIT}`, ...urls], { stdio: ['ignore', 'pipe', 'pipe'] });
  let aus = '';
  kind.stdout.on('data', (d) => { aus += d; });
  kind.stderr.on('data', (d) => { aus += d; });
  kind.on('error', (e) => { aus += `BLOCKED  Renderer  ${e.message}\n`; ok({ code: 3, aus }); });
  kind.on('exit', (code) => ok({ code: code ?? 1, aus }));
});

const URTEIL = { 0: 'PASS', 3: 'BLOCKED' };
process.stderr.write(`${PROG}: ${szenarien.length} Szenarien, ${jobs} ${jobs === 1 ? 'Job' : 'Jobs'}${frei === null ? '' : `, ${frei} MB Speicher frei`}\n`);
const ergebnis = new Array(szenarien.length);
// Die größten Szenarien zuerst, damit am Ende kein langes allein läuft; das Protokoll bleibt in der Reihenfolge der Eingabe
const warteschlange = szenarien.map((sz, i) => i).sort((x, y) => ADRESSEN[szenarien[y]].length - ADRESSEN[szenarien[x]].length);
let fertig = 0;
async function arbeiter() {
  for (let i; (i = warteschlange.shift()) !== undefined;) {
    const sz = szenarien[i];
    let r;
    try { r = await lauf(sz); } catch (e) { r = { code: 3, aus: `BLOCKED  Renderer  ${e.message}\n` }; }
    ergebnis[i] = r;
    fertig += 1;
    process.stderr.write(`${PROG}: ${sz}: ${URTEIL[r.code] ?? 'FAIL'} (${fertig}/${szenarien.length})\n`);
  }
}
await Promise.all(Array.from({ length: jobs }, arbeiter));

let protokoll = '';
let schlimmster = 0;
const rang = { 0: 0, 3: 1, 1: 2 };
szenarien.forEach((sz, i) => {
  const r = ergebnis[i];
  const zeilen = r.aus.split('\n').filter((z) => /^(PASS|WARN|FAIL|SKIP|BLOCKED)/.test(z)).map((z) => `${sz}: ${z}`);
  // Der Renderer prüft den Aufbau der Seite; ob die Bilder etwas zeigen, prüft erst dieser Schritt (tools/bilder.mjs)
  let summe = r.aus.trim().split('\n').pop();
  if (r.code === 0 || r.code === 1) {
    const befunde = pruefeBilder(join(a.values.ausgabe, sz), ADRESSEN[sz]);
    if (befunde.length) {
      zeilen.push(...befunde.slice(0, MAX_BEFUNDE).map((t) => `${sz}: FAIL     Bilder  ${t}`));
      if (befunde.length > MAX_BEFUNDE) zeilen.push(`${sz}: FAIL     Bilder  und ${befunde.length - MAX_BEFUNDE} weitere`);
      summe = `${summe}, 1 FAIL (Bilder)`;
      r.code = 1;
    } else zeilen.push(`${sz}: PASS     Bilder  alle Bilder zeigen etwas und unterscheiden sich je Adresse`);
  }
  protokoll += `${zeilen.join('\n')}\n${sz}: ${summe}\n`;
  if ((rang[r.code] ?? 2) > (rang[schlimmster] ?? 0)) schlimmster = r.code;
});
server.close();
writeFileSync(join(a.values.ausgabe, 'lauf.txt'), protokoll);
process.stdout.write(protokoll);
process.exitCode = schlimmster;
