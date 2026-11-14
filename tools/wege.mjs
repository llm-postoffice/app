#!/usr/bin/env node
// Wegetest der App in Chromium (headless, frisches Profil, nur Node ab 22): Zurück (UNA-3, UNA-4), Blatt (UDI-3),
// Leiste (UNA-1, UNA-2), Statusleiste (UFA-1), Netzzeile (UOF-4), Fassung in Mehr und eine fehlerfreie Konsole
// (CSP, UPL-3). Muster: beispiele/handy/wege.mjs im p94-hig-Klon. Ein Weg je Zeile: PASS, FAIL oder BLOCKED.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { VERSION } from '../js/version.js';

const PROG = 'wege';
const HILFE = `Aufruf: node tools/wege.mjs [OPTIONEN]

Spielt die Wege der App in Chromium nach: Zurück-Reihenfolge, Blätter, Navigationsleiste,
Statusleiste, Netzzeile, Fassung in Mehr und eine Konsole ohne Fehler. Chromium läuft headless
mit einem frischen Profil in $TMPDIR (Vorgabe /tmp) und wird danach entfernt.

Beispiel:
  Alle Wege prüfen, Chromium aus dem Pfad:
    node tools/wege.mjs

Optionen:
  -h, --help  diese Hilfe zeigen

Umgebung:
  CHROME  Pfad zum Browser (Vorgabe: chromium)

Exit-Status: 0 alle Wege PASS, 1 mindestens ein FAIL, 2 falscher Aufruf, 3 Chromium nicht
startbar (BLOCKED), 130 nach Strg+C, 143 nach SIGTERM.
`;
const arg = process.argv.slice(2);
if (arg.includes('-h') || arg.includes('--help')) { process.stdout.write(HILFE); process.exit(0); }
if (arg.length) {
  process.stderr.write(`${PROG}: Fehler: unbekanntes Argument „${arg[0]}“\nHilfe: node tools/wege.mjs --help\n`);
  process.exit(2);
}

const wurzel = new URL('../', import.meta.url).pathname;
const TYP = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = createServer(async (q, a) => {
  try {
    const pfad = decodeURIComponent(new URL(q.url, 'http://localhost').pathname);
    const p = normalize(join(wurzel, pfad.endsWith('/') ? `${pfad}index.html` : pfad));
    if (!p.startsWith(wurzel)) { a.writeHead(403); a.end(); return; }
    a.writeHead(200, { 'content-type': TYP[extname(p)] || 'application/octet-stream' });
    a.end(await readFile(p));
  } catch { a.writeHead(404); a.end(); }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const basis = `http://127.0.0.1:${server.address().port}/index.html`;

const profil = await mkdtemp(join(tmpdir(), 'wege-'));
const chrome = spawn(process.env.CHROME || 'chromium', ['--headless', '--remote-debugging-pipe', '--no-first-run', `--user-data-dir=${profil}`, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
let gestartet = true;
chrome.on('error', () => { gestartet = false; });
for (const i of [3, 4]) chrome.stdio[i]?.on('error', () => {});   // Chromium endet vorzeitig: das meldet BLOCKED

let id = 0; let puffer = ''; const offen = new Map();
chrome.stdio[4]?.on('data', (d) => {
  puffer += d; let i;
  while ((i = puffer.indexOf('\0')) >= 0) {
    const m = JSON.parse(puffer.slice(0, i)); puffer = puffer.slice(i + 1);
    if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); }
  }
});
// Antwortet Chromium nicht (die Seite lädt gerade neu), gilt die Antwort nach 8 s als leer.
const senden = (method, params = {}, sessionId) => new Promise((r) => {
  if (chrome.exitCode !== null || chrome.signalCode !== null) { r({}); return; }
  const n = ++id; offen.set(n, r); setTimeout(() => { if (offen.delete(n)) r({}); }, 8000);
  try { chrome.stdio[3].write(JSON.stringify({ id: n, method, params, sessionId }) + '\0'); } catch { r({}); }
});
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

let fehler = 0;
const melde = (ok, weg, ist) => { if (!ok) fehler++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${weg}${ok ? '' : `: ${ist}`}`); };

async function aufraeumen() {
  try { await senden('Browser.close'); } catch { /* schon beendet */ }
  server.close();
  if (chrome.exitCode === null) { chrome.kill('SIGTERM'); await Promise.race([new Promise((r) => chrome.once('exit', r)), pause(3000)]); }
  await rm(profil, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.on(sig, async () => { await aufraeumen(); process.exit(code); });
}

// Zeichnet Verstöße gegen die CSP und Fehler im Skript auf, ehe die Seite läuft.
const WAECHTER = `window.__melde = [];
  document.addEventListener('securitypolicyviolation', (e) => __melde.push('CSP ' + e.violatedDirective + ' ' + e.blockedURI), true);
  addEventListener('error', (e) => __melde.push('Fehler ' + e.message));
  addEventListener('unhandledrejection', (e) => __melde.push('Zusage abgelehnt ' + e.reason));`;

async function seite(url, breite = 360, hoehe = 800) {
  const { result: { targetId } } = await senden('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId: s } } = await senden('Target.attachToTarget', { targetId, flatten: true });
  await senden('Emulation.setDeviceMetricsOverride', { width: breite, height: hoehe, deviceScaleFactor: 2, mobile: true }, s);
  await senden('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, s);
  await senden('Page.enable', {}, s);
  await senden('Network.enable', {}, s);
  await senden('Page.addScriptToEvaluateOnNewDocument', { source: WAECHTER }, s);
  await senden('Page.navigate', { url }, s); await pause(700);
  const werte = async (x) => (await senden('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }, s)).result?.result?.value;
  const tippe = async (sel) => {
    const [x, y] = await werte(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    await senden('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }, s);
    await senden('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, s); await pause(400);
  };
  const taste = async (key, code, kc) => {
    for (const type of ['keyDown', 'keyUp']) await senden('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: kc }, s);
    await pause(500);
  };
  const zurueck = async () => { await werte('history.back()'); await pause(500); };
  const medien = async (modus) => { await senden('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: modus }] }, s); await pause(300); };
  const netz = async (an) => {
    await senden('Network.emulateNetworkConditions', { offline: !an, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, s); await pause(400);
  };
  const stand = async () => werte(`[location.hash, document.getElementById('titel').textContent, document.getElementById('zurueck').hidden ? 'ohne Pfeil' : 'mit Pfeil'].join(' | ')`);
  return { werte, tippe, taste, zurueck, medien, netz, stand, hash: () => werte('location.hash'), draussen: async () => await werte('location.href') === 'about:blank' };
}

// Startet Chromium nicht, ist das BLOCKED und kein FAIL (TXT-14): der Test konnte nicht laufen.
const bereit = gestartet && (await senden('Browser.getVersion')).result;
if (!bereit) {
  await aufraeumen();
  console.log('BLOCKED  Wegetest nicht ausführbar: Chromium startet nicht. Installiere Chromium, setze CHROME=PFAD oder kürze $TMPDIR (Chromium bricht bei einem langen Pfad ab).');
  process.exit(3);
}

try {
  const t = (x) => `${basis}${x}`;
  const ID = '9f3k2a';

  // 1. Hauptbereiche: kein Pfeil, Zurück führt nach Wartet, aus Wartet hinaus
  let p = await seite(t('#wartet'));
  melde(await p.hash() === '#wartet' && await p.werte('document.getElementById("zurueck").hidden'), 'Wartet startet ohne Pfeil Zurück', await p.stand());
  melde(await p.werte('!document.getElementById("suchen").hidden'), 'Wartet zeigt das Symbol Suchen', 'Symbol fehlt');
  await p.tippe('#leiste a[href="#abnahmen"]');
  melde(await p.hash() === '#abnahmen' && await p.werte('document.getElementById("zurueck").hidden'), 'ein Hauptbereich zeigt keinen Pfeil Zurück', await p.stand());
  await p.tippe('#leiste a[href="#mehr"]'); await p.zurueck();
  melde(await p.hash() === '#wartet', 'Zurück aus einem Hauptbereich führt nach Wartet, auch nach einem Wechsel zwischen Bereichen', await p.stand());
  await p.zurueck();
  melde(await p.draussen(), 'Zurück aus Wartet verlässt die App', await p.werte('location.href'));

  // 2. Tiefer Link: der Stapel darunter wird aufgebaut
  p = await seite(t(`#eintrag/${ID}`));
  melde(await p.werte('!document.getElementById("zurueck").hidden && document.querySelector("main .id").textContent') === '9f3-k2a', 'ein Eintrag zeigt Pfeil Zurück und die ID mit Strich', await p.stand());
  melde(await p.werte('document.querySelector("#leiste [aria-current=page]").dataset.bereich') === 'wartet', 'unter einem Eintrag ist Wartet in der Leiste gewählt', 'anderer Bereich');
  await p.zurueck();
  melde(await p.hash() === '#wartet', 'Zurück aus einem tiefen Link führt nach Wartet', await p.stand());
  await p.zurueck();
  melde(await p.draussen(), 'danach verlässt Zurück die App', await p.werte('location.href'));
  // Neuladen darf den Stapel nicht noch einmal aufbauen
  p = await seite(t(`#eintrag/${ID}`));
  await p.werte('location.reload()'); await pause(800);
  await p.zurueck(); const nachReload = await p.hash();
  await p.zurueck();
  melde(nachReload === '#wartet' && await p.draussen(), 'nach Neuladen bleibt der Stapel gleich tief', `${nachReload}, danach ${await p.werte('location.href')}`);
  // Eintrag, dann ein Hauptbereich: der Stapel wird abgebaut
  p = await seite(t(`#eintrag/${ID}`));
  await p.tippe('#leiste a[href="#mehr"]');
  melde(await p.hash() === '#mehr', 'ein Hauptbereich aus der Tiefe öffnet seine Ansicht', await p.stand());
  await p.zurueck();
  melde(await p.hash() === '#wartet', 'Zurück aus einem Hauptbereich nach einem Eintrag führt nach Wartet', await p.stand());

  // 3. Blatt Einsortieren: Zurück schließt zuerst das Blatt, dann geht es eine Ebene nach der anderen hoch
  p = await seite(t(`#eintrag/${ID}/einsortieren`));
  melde(await p.werte('document.getElementById("blatt").open && document.getElementById("blatt-titel").textContent') === 'Einsortieren', 'ein tiefer Link zum Blatt Einsortieren öffnet das Blatt', await p.stand());
  await p.taste('Escape', 'Escape', 27);
  melde(!await p.werte('document.getElementById("blatt").open') && await p.hash() === `#eintrag/${ID}`, 'Esc schließt zuerst das Blatt, der Eintrag bleibt', `${await p.stand()}, Blatt ${await p.werte('document.getElementById("blatt").open') ? 'offen' : 'zu'}`);
  await p.zurueck();
  melde(await p.hash() === '#eingang', 'Zurück vom Eintrag unter Einsortieren führt in den Eingang', await p.stand());
  await p.zurueck();
  melde(await p.hash() === '#wartet', 'Zurück aus dem Eingang führt nach Wartet', await p.stand());
  p = await seite(t(`#eintrag/${ID}/einsortieren`));
  await p.zurueck();
  melde(!await p.werte('document.getElementById("blatt").open') && await p.hash() === `#eintrag/${ID}`, 'der Zurück-Eintrag im Verlauf schließt das Blatt, ohne eine Ebene zu überspringen', `${await p.stand()}, Blatt ${await p.werte('document.getElementById("blatt").open') ? 'offen' : 'zu'}`);
  p = await seite(t('#mehr/geraet'));
  await p.tippe('#blatt-abbrechen');
  melde(!await p.werte('document.getElementById("blatt").open') && await p.hash() === '#mehr', 'Abbrechen schließt das Blatt Gerätename und bleibt in Mehr', await p.stand());

  // 4. Weitere Ebenen
  p = await seite(t('#ideen'));
  melde(await p.werte('document.querySelector("#leiste [aria-current=page]").dataset.bereich') === 'mehr', 'unter der Ideensammlung ist Mehr in der Leiste gewählt', 'anderer Bereich');
  await p.zurueck(); const ideenHoch = await p.hash();
  await p.zurueck();
  melde(ideenHoch === '#mehr' && await p.hash() === '#wartet', 'Zurück aus der Ideensammlung führt über Mehr nach Wartet', `${ideenHoch}, danach ${await p.hash()}`);
  p = await seite(t(`#eintrag/${ID}/schritt/2`));
  const schritt = await p.stand();
  await p.zurueck(); const schrittHoch = await p.hash();
  await p.zurueck();
  melde(schritt.includes('Schritt 2') && schrittHoch === `#eintrag/${ID}` && await p.hash() === '#wartet', 'Zurück aus einem Schritt führt zum Eintrag, dann nach Wartet', `${schritt}, ${schrittHoch}, danach ${await p.hash()}`);
  p = await seite(t('#wartet'));
  await p.tippe('#suchen');
  melde(await p.hash() === '#suche' && await p.werte('!document.getElementById("zurueck").hidden'), 'das Symbol Suchen öffnet die Suche mit Pfeil Zurück', await p.stand());
  await p.zurueck();
  melde(await p.hash() === '#wartet', 'Zurück aus der Suche führt dorthin, woher du kamst', await p.stand());
  p = await seite(t('#anmelden'));
  melde(await p.werte('document.getElementById("leiste").hidden && document.getElementById("zurueck").hidden'), 'die Anmeldung zeigt weder Navigationsleiste noch Pfeil Zurück', await p.stand());
  await p.zurueck();
  melde(await p.draussen(), 'Zurück aus der Anmeldung verlässt die App', await p.werte('location.href'));
  p = await seite(t('#gibtesnicht'));
  melde(await p.hash() === '#wartet', 'eine unbekannte Adresse zeigt Wartet', await p.stand());
  p = await seite(t('#eintrag/9F3-K2A'));
  melde(await p.hash() === `#eintrag/${ID}`, 'eine ID in der Adresse wird ohne Strich und klein geschrieben', await p.stand());

  // 5. Fassung, Netzzeile, Statusleiste
  p = await seite(t('#mehr'));
  melde(await p.werte('document.getElementById("fassung").textContent') === VERSION, 'Mehr zeigt die Fassung aus js/version.js', await p.werte('document.getElementById("fassung").textContent'));
  const zeile = 'document.getElementById("stand").hidden';
  melde(await p.werte(zeile) === true, 'mit Netz fehlt die Zeile „Ohne Netz“', 'Zeile da');
  await p.netz(false);
  melde(await p.werte(zeile) === false, 'ohne Netz steht die Zeile „Ohne Netz“ oben', 'Zeile fehlt');
  await p.netz(true);
  melde(await p.werte(zeile) === true, 'mit Netz verschwindet die Zeile wieder', 'Zeile bleibt');
  const gleich = `(() => { const c = document.createElement('canvas').getContext('2d'); const t = document.querySelectorAll('meta[name=theme-color]');
    c.fillStyle = t[0].content; const a = c.fillStyle; c.fillStyle = getComputedStyle(document.querySelector('.kopf')).backgroundColor; return t.length === 1 && a === c.fillStyle ? 'ok ' + a : t.length + ' Tags, ' + t[0].content + ' statt ' + c.fillStyle; })()`;
  const verlauf = [];
  for (const modus of ['light', 'dark', 'light', 'dark']) { await p.medien(modus); verlauf.push(`${modus}: ${await p.werte(gleich)}`); }
  melde(verlauf.every((v) => v.includes(': ok ')) && new Set(verlauf.map((v) => v.split(': ')[1])).size === 2, 'die Statusleiste folgt dem Wechsel Hell, Dunkel, Hell, Dunkel mit der Farbe der oberen Leiste', verlauf.join('; '));

  // 6. Breite Fenster: die Leiste steht an der Seite (UAN-5)
  p = await seite(t('#wartet'), 800, 700);
  const raender = await p.werte(`(() => { const l = document.getElementById('leiste').getBoundingClientRect(); const m = document.querySelector('main').getBoundingClientRect(); return [l.left, l.right, m.left]; })()`);
  melde(raender && raender[0] === 0 && raender[1] <= 96 && raender[2] >= raender[1], 'ab 600 px Breite steht die Navigationsleiste links und deckt den Inhalt nicht', JSON.stringify(raender));

  // 7. Konsole: keine Verstöße gegen die CSP, keine Fehler im Skript, in keiner Ansicht
  const ansichten = ['#wartet', '#abnahmen', '#erfassen', '#mehr', '#eingang', `#eintrag/${ID}`, `#eintrag/${ID}/schritt/2`, `#eintrag/${ID}/einsortieren`, '#ideen', '#mehr/geraet', '#suche', '#anmelden'];
  const meldungen = [];
  for (const a of ansichten) {
    p = await seite(t(a));
    const m = await p.werte('window.__melde');
    if (m && m.length) meldungen.push(`${a}: ${m.join(', ')}`);
  }
  melde(meldungen.length === 0, `die Konsole bleibt in allen ${ansichten.length} Ansichten frei von CSP-Verstößen und Skriptfehlern`, meldungen.join('; '));
} catch (e) {
  await aufraeumen();
  process.stderr.write(`${PROG}: Fehler: ${e.message}\n`);
  process.exit(1);
}
await aufraeumen();
console.log(fehler ? `${fehler} FAIL` : 'alle Wege PASS');
process.exit(fehler ? 1 : 0);
