#!/usr/bin/env node
// Wegetest der App in Chromium (headless, frisches Profil, nur Node ab 22): Zurück (UNA-3, UNA-4), Blatt (UDI-3),
// Leiste (UNA-1, UNA-2), Statusleiste (UFA-1), Netzzeile (UOF-4), Fassung in Mehr und eine fehlerfreie Konsole
// (CSP, UPL-3). Muster: beispiele/handy/wege.mjs im p94-hig-Klon. Ein Weg je Zeile: PASS, FAIL oder BLOCKED.
// Dazu IndexedDB und der Abgleich gegen eine nachgebaute GitHub-API: Chromium fängt api.github.com ab, kein Paket
// geht ins Netz.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { VERSION } from '../js/version.js';
import { mockQuelle } from '../tests/hilfen/mockquelle.mjs';

const PROG = 'wege';
const HILFE = `Aufruf: node tools/wege.mjs [OPTIONEN]

Spielt die Wege der App in Chromium nach: Zurück-Reihenfolge, Blätter, Navigationsleiste,
Statusleiste, Netzzeile, Fassung in Mehr, IndexedDB, den Abgleich und eine Konsole ohne Fehler.
Chromium läuft headless mit einem frischen Profil in $TMPDIR (Vorgabe /tmp) und wird danach entfernt.
Die Anfragen an api.github.com fängt Chromium ab und beantwortet sie aus einem nachgebauten Repo.

Beispiele:
  Alle Wege prüfen, Chromium aus dem Pfad:
    node tools/wege.mjs
  Dazu die Zustände des Abgleichs in Mehr als Bilder schreiben:
    node tools/wege.mjs --bilder bilder/abgleich

Optionen:
  -b, --bilder ORDNER  Mehr in allen Zuständen des Abgleichs als PNG nach ORDNER schreiben
  -h, --help           diese Hilfe zeigen

Umgebung:
  CHROME  Pfad zum Browser (Vorgabe: chromium)

Exit-Status: 0 alle Wege PASS, 1 mindestens ein FAIL, 2 falscher Aufruf, 3 Chromium nicht
startbar (BLOCKED), 130 nach Strg+C, 143 nach SIGTERM.
`;
const arg = process.argv.slice(2);
if (arg.includes('-h') || arg.includes('--help')) { process.stdout.write(HILFE); process.exit(0); }
let bilderOrdner = null;
if (arg[0] === '-b' || arg[0] === '--bilder') {
  bilderOrdner = arg[1];
  if (!bilderOrdner) { process.stderr.write(`${PROG}: Fehler: ${arg[0]} braucht einen Ordner\nHilfe: node tools/wege.mjs --help\n`); process.exit(2); }
  arg.splice(0, 2);
}
if (arg.length) {
  process.stderr.write(`${PROG}: Fehler: unbekanntes Argument „${arg[0]}“\nHilfe: node tools/wege.mjs --help\n`);
  process.exit(2);
}

const wurzel = new URL('../', import.meta.url).pathname;
const TYP = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
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
let abgefangen = null;   // Antwortet auf Anfragen an api.github.com, solange ein Weg eine Quelle nachbaut
chrome.stdio[4]?.on('data', (d) => {
  puffer += d; let i;
  while ((i = puffer.indexOf('\0')) >= 0) {
    const m = JSON.parse(puffer.slice(0, i)); puffer = puffer.slice(i + 1);
    if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); }
    else if (m.method === 'Fetch.requestPaused') abgefangen?.(m);
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
  // Chromium fängt api.github.com ab und beantwortet die Anfragen aus der Mock-Quelle q (wirft sie, fällt das Netz
  // aus). Es geht nichts ins Netz; die Anfragen stehen in q.protokoll.
  const quelle = async (q) => {
    await senden('Fetch.enable', { patterns: [{ urlPattern: 'https://api.github.com/*' }] }, s);
    const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'etag, retry-after, date, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset' };
    abgefangen = async (m) => {
      const { requestId, request } = m.params;
      const kopf = (o) => Object.entries(o).map(([name, value]) => ({ name, value: String(value) }));
      if (request.method === 'OPTIONS') {
        await senden('Fetch.fulfillRequest', { requestId, responseCode: 204, responseHeaders: kopf({ ...cors,
          'access-control-allow-headers': 'authorization, content-type, if-none-match', 'access-control-allow-methods': 'GET, POST', 'access-control-max-age': '600' }) }, m.sessionId);
        return;
      }
      const eigene = Object.fromEntries(Object.entries(request.headers).map(([k, v]) => [k.toLowerCase(), v]));
      let antwort;
      try { antwort = await q.fetch(request.url, { method: request.method, headers: eigene, body: request.postData }); } catch {
        await senden('Fetch.failRequest', { requestId, errorReason: 'InternetDisconnected' }, m.sessionId);   // wirft die Quelle, fällt das Netz aus
        return;
      }
      const koerper = Buffer.from(await antwort.arrayBuffer()).toString('base64');
      await senden('Fetch.fulfillRequest', { requestId, responseCode: antwort.status, responseHeaders: kopf({ ...Object.fromEntries(antwort.headers), ...cors }), ...(koerper ? { body: koerper } : {}) }, m.sessionId);
    };
  };
  // Bilder von Mehr: hell, dunkel, Text 200 % (UEW-2); nur mit --bilder
  const bild = async (name) => {
    if (!bilderOrdner) return;
    await mkdir(bilderOrdner, { recursive: true });
    const schreibe = async (ende) => {
      const r = await senden('Page.captureScreenshot', { format: 'png' }, s);
      await writeFile(join(bilderOrdner, `${name}-${ende}.png`), Buffer.from(r.result.data, 'base64'));
    };
    await medien('light'); await schreibe('hell');
    await medien('dark'); await schreibe('dunkel');
    await medien('light');
    // Text 200 % über die Wurzel, wie der Browser die Schriftgröße des Systems umsetzt; CSSOM statt <style>, die CSP bleibt an
    await werte(`document.documentElement.style.setProperty('font-size', '200%', 'important')`);
    await werte('scrollTo(0, document.body.scrollHeight)'); await pause(300);
    await schreibe('text200');
    await werte(`document.documentElement.style.removeProperty('font-size'); scrollTo(0, 0)`);
  };
  const warte = async (bedingung, ms = 5000) => {
    for (let t = 0; t < ms; t += 100) { if (await werte(bedingung)) return true; await pause(100); }
    return false;
  };
  const schliesse = () => senden('Target.closeTarget', { targetId });
  const stand = async () => werte(`[location.hash, document.getElementById('titel').textContent, document.getElementById('zurueck').hidden ? 'ohne Pfeil' : 'mit Pfeil'].join(' | ')`);
  return { werte, tippe, taste, zurueck, medien, netz, quelle, bild, warte, schliesse, stand, hash: () => werte('location.hash'), draussen: async () => await werte('location.href') === 'about:blank' };
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

  // 7. IndexedDB und Abgleich: das Schema in Chromium, die Bitte um dauerhaften Speicher, dann ein Abgleich gegen ein
  //    nachgebautes Repo mit allen Zuständen aus Mehr. Das Token ist ein Testwert; Chromium beantwortet die Anfragen.
  p = await seite(t('#mehr'));
  const vertragFehler = await p.werte(`(async () => {
    const { oeffneDatenbank } = await import('/js/speicher.js');
    const { vertrag } = await import('/tests/hilfen/speichervertrag.mjs');
    const name = 'postfach-wege-' + Date.now();
    const db = await oeffneDatenbank(indexedDB, name);
    const f = await vertrag(db);
    db.schliesse();
    const neu = await oeffneDatenbank(indexedDB, name);
    if (await neu.zaehle('einstellungen') !== 1) f.push('das Schema und die Daten überstehen das Schließen nicht');
    neu.schliesse();
    indexedDB.deleteDatabase(name);
    return f;
  })()`);
  melde(Array.isArray(vertragFehler) && vertragFehler.length === 0, 'IndexedDB erfüllt den Vertrag der Schnittstelle und behält Schema und Daten nach dem Schließen', JSON.stringify(vertragFehler));
  const gesichert = await p.werte(`(async () => { const { oeffneDatenbank, einstellung } = await import('/js/speicher.js'); const db = await oeffneDatenbank(); const e = await einstellung(db, 'speicher'); db.schliesse(); return e; })()`);
  const speicherText = await p.werte('document.getElementById("speicher").textContent');
  melde([true, false, null].includes(gesichert?.dauerhaft) && typeof gesichert?.geprueft === 'number'
    && speicherText === { true: 'dauerhaft gewährt', false: 'vom Browser verwaltet', null: 'nicht geprüft' }[gesichert.dauerhaft],
  `die App bittet beim Start um dauerhaften Speicher, Mehr zeigt das Ergebnis (hier: „${speicherText}“)`, `${JSON.stringify(gesichert)}, Mehr: ${speicherText}`);
  melde(await p.werte('document.getElementById("abgleich").textContent') === 'nicht angemeldet'
    && await p.werte('!document.querySelector("#abgleich-stand button")'), 'ohne Anmeldung steht „nicht angemeldet“ in Mehr und es gibt keinen Knopf Jetzt abgleichen', await p.werte('document.getElementById("abgleich-stand").textContent'));
  melde(await p.werte('[...document.getElementById("takt").options].map((o) => o.textContent).join("|")') === 'jede Minute|alle 2 Minuten|alle 5 Minuten|alle 15 Minuten|nur mit dem Knopf'
    && await p.werte('document.getElementById("takt").selectedOptions[0].textContent') === 'alle 2 Minuten', 'der Takt im Vordergrund steht in Mehr und beginnt bei alle 2 Minuten', await p.werte('document.getElementById("takt").value'));
  await p.bild('ohne-anmeldung');
  await p.schliesse();

  // Ein Repo mit 150 Einträgen zu je zwei Dateien: 301 Dateien, also zwei GraphQL-Aufrufe (250 und 51)
  const daten = new Map([['projects.md', '# Projekte\n\n## demo\n']]);
  for (let i = 0; i < 150; i++) {
    const kenn = `k7${String(i).padStart(4, '0')}`;
    daten.set(`entries/${kenn.slice(0, 2)}/${kenn}/0-entry.md`, `# Eintrag ${i}\n\n- Kind: task\n- To: user\n- From: user, geraet, 2026-11-14T08:00Z\n`);
    daten.set(`entries/${kenn.slice(0, 2)}/${kenn}/01M7CQZS800000000000000001-status.md`, `- By: user\n- Status: done\n- Result: ${i}\n`);
  }
  let ausfall = null;
  const q = mockQuelle({ dateien: daten, repo: 'org/daten', token: 'TESTTOKEN', verzoegerung: 1500, vorher: (a) => ausfall?.(a) });
  const hh = '\\\\d\\\\d:\\\\d\\\\d';   // in den ausgewerteten Quelltext gelangt \\d, im RegExp wird daraus \d
  p = await seite(t('#mehr'));
  await p.quelle(q);
  await p.werte(`(async () => { const { oeffneDatenbank, setzeEinstellung } = await import('/js/speicher.js'); const db = await oeffneDatenbank();
    await setzeEinstellung(db, 'anmeldung', { repo: 'org/daten', token: 'TESTTOKEN' }); db.schliesse(); })()`);
  await p.werte('location.reload()');
  const text = () => p.werte('document.getElementById("abgleich-stand").textContent');
  melde(await p.warte(`/^Abgleich läuft: \\d+ von 301 Dateien/.test(document.getElementById("abgleich-stand").textContent.trim()) && document.querySelector("#abgleich-stand progress")?.max === 301`),
    'der erste Abgleich zeigt „N von 301 Dateien“ mit einem Balken, der bis 301 reicht', await text());
  await p.bild('abgleich-laeuft');
  melde(await p.warte(`new RegExp('^heute um ${hh}, 301 Dateien$').test(document.getElementById("abgleich").textContent)`, 15000),
    'danach zeigt Mehr „heute um HH:MM, 301 Dateien“', await p.werte('document.getElementById("abgleich").textContent'));
  q.verzoegerung = 50;   // der Rest der Wege soll nicht auf die Quelle warten
  melde(q.zaehler.baum === 1 && q.graphqlGroessen().join() === '250,51' && q.zaehler.blob === 0, 'der Abgleich brauchte einen Baum und zwei GraphQL-Aufrufe (250 und 51), keinen Blob', `${JSON.stringify(q.zaehler)}, ${q.graphqlGroessen()}`);
  melde(q.protokoll.every((a) => a.url.startsWith('https://api.github.com/')), 'alle Anfragen gehen an api.github.com', q.protokoll.find((a) => !a.url.startsWith('https://api.github.com/'))?.url);
  melde(await p.werte('document.querySelector("#abgleich-stand button")?.textContent') === 'Jetzt abgleichen', 'nach dem Abgleich steht der Knopf Jetzt abgleichen da', await text());
  await p.bild('abgleich-fertig');

  const vorher = { ...q.zaehler };
  await p.tippe('#abgleich-stand button');
  await p.warte(`document.querySelector("#abgleich-stand button")`, 3000); await pause(400);
  melde(q.zaehler.baum === vorher.baum + 1 && q.zaehler.graphql === vorher.graphql && q.zaehler.blob === vorher.blob, 'Jetzt abgleichen ohne Änderung fragt nur den Baum und bekommt 304', `${JSON.stringify(vorher)} -> ${JSON.stringify(q.zaehler)}`);
  melde(q.protokoll.at(-1).kopf.get('if-none-match') !== null, 'die Anfrage trägt If-None-Match', 'ohne If-None-Match');

  daten.set('entries/zz/zzzzzz/0-entry.md', '# Neu\n\n- Kind: task\n- To: user\n- From: user, geraet, 2026-11-14T09:00Z\n');
  await p.tippe('#abgleich-stand button');
  melde(await p.warte(`new RegExp('^heute um ${hh}, 302 Dateien$').test(document.getElementById("abgleich").textContent)`, 8000),
    'eine neue Datei im Repo erscheint beim nächsten Abgleich: 302 Dateien', await p.werte('document.getElementById("abgleich").textContent'));
  melde(q.zaehler.graphql === vorher.graphql + 1 && q.graphqlGroessen().at(-1) === 1, 'dafür genügte ein GraphQL-Aufruf für die eine neue Datei', `${q.graphqlGroessen()}`);

  await p.werte(`(() => { const s = document.getElementById('takt'); s.value = '60'; s.dispatchEvent(new Event('change')); })()`); await pause(400);
  melde(await p.werte(`(async () => { const { oeffneDatenbank, einstellung } = await import('/js/speicher.js'); const db = await oeffneDatenbank(); const t = await einstellung(db, 'takt'); db.schliesse(); return t; })()`) === 60,
    'der gewählte Takt liegt in der Datenbank', 'nicht 60');

  // Fehler: 401, Limit, kein Netz. Der Stand auf dem Gerät bleibt, der Text sagt, was geschieht (UOF-4, UOF-6).
  ausfall = () => new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401, headers: { 'content-type': 'application/json' } });
  await p.tippe('#abgleich-stand button');
  melde(await p.warte(`document.querySelector("#abgleich-stand .band strong")?.textContent === 'Token abgelaufen oder widerrufen'`, 5000),
    'ein abgelehntes Token zeigt „Token abgelaufen oder widerrufen“', await text());
  melde(await p.werte(`!document.querySelector("#abgleich-stand button.gefuellt") && /Antworten bleiben auf diesem Gerät in der Schlange/.test(document.querySelector("#abgleich-stand .band").textContent)
    && new RegExp('^heute um ${hh}, 302 Dateien$').test(document.getElementById("abgleich").textContent)`),
    'beim 401 gibt es keinen Knopf Jetzt abgleichen, der Stand bleibt in Mehr stehen', await text());
  await p.bild('token-abgelaufen');

  const ende = Math.floor(Date.now() / 1000) + 3600;
  ausfall = () => new Response(JSON.stringify({ message: 'API rate limit exceeded' }), { status: 403, headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(ende) } });
  await p.werte('location.reload()'); await p.warte(`document.querySelector("#abgleich-stand .band")`, 6000);
  melde(await p.warte(`document.querySelector("#abgleich-stand .band strong")?.textContent === 'GitHub bremst'`, 3000)
    && await p.werte(`new RegExp('Der nächste Versuch läuft um ${hh}\\\\.').test(document.querySelector("#abgleich-stand .band p").textContent)`),
  'ein ausgeschöpftes Limit zeigt „GitHub bremst“ mit der Zeit des nächsten Versuchs', await text());
  await p.bild('github-bremst');

  ausfall = () => { throw new TypeError('Failed to fetch'); };
  await p.tippe('#abgleich-stand button');
  melde(await p.warte(`document.querySelector("#abgleich-stand .band strong")?.textContent === 'Ohne Netz' && !document.getElementById("stand").hidden`, 5000),
    'fällt das Netz aus, zeigt Mehr „Ohne Netz“ und oben steht die ruhige Zeile', await text());
  melde(await p.werte(`new RegExp('^Ohne Netz: Stand von ${hh}\\\\. Neues kommt, sobald wieder Netz da ist\\\\.$').test(document.getElementById("stand").textContent.trim())`),
    'die Zeile oben nennt den Stand und was als Nächstes geschieht', await p.werte('document.getElementById("stand").textContent'));
  await p.bild('ohne-netz');
  ausfall = null;
  melde(await p.warte('document.getElementById("stand").hidden && !document.querySelector("#abgleich-stand .band")', 16000),
    'ohne Netz fragt die App alle 10 s erneut und zeigt den Stand wieder, sobald das Netz zurück ist (UOF-4)', await text());
  await p.werte(`(async () => { const { oeffneDatenbank } = await import('/js/speicher.js'); const db = await oeffneDatenbank(); await db.entferne('einstellungen', 'anmeldung'); db.schliesse(); })()`);
  await p.schliesse();
  abgefangen = null;

  // 8. Konsole: keine Verstöße gegen die CSP, keine Fehler im Skript, in keiner Ansicht
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
