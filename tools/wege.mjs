#!/usr/bin/env node
// Wegetest der App in Chromium (headless, frisches Profil, nur Node ab 22): Anmeldung, Zurück (UNA-3, UNA-4), Blatt
// (UDI-3), Leiste (UNA-1, UNA-2), ein Knopf je Handlung (E13), eine linke Kante je Ansicht (GAN-3), Entwürfe (UEI-6),
// Statusleiste (UFA-1), Netzzeile (UOF-4), Fassung in Mehr und eine fehlerfreie Konsole (CSP, UPL-3). Muster: beispiele/handy/wege.mjs im p94-hig-Klon. Ein Weg je Zeile: PASS, FAIL oder BLOCKED.
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
import { ERFUNDENES_TOKEN, REPO, SZENARIEN, TOKEN, eintraege, entwuerfe } from '../tests/hilfen/beispieldaten.mjs';

const PROG = 'wege';
const HILFE = `Aufruf: node tools/wege.mjs [OPTIONEN]

Spielt die Wege der App in Chromium nach: Anmeldung, alle Zurück-Wege der Tabelle, Blätter,
Navigationsleiste, einen Knopf zu jeder Handlung (E13), eine linke Kante je Ansicht (GAN-3), Entwürfe
über Neuladen, Statusleiste, Netzzeile, Fassung in Mehr, IndexedDB, den Abgleich und eine Konsole ohne
Fehler. Die Daten sind erfunden (tests/hilfen/beispieldaten.mjs).
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
let abgefangen = null;   // Antwortet auf Anfragen an api.github.com aus der Quelle, die der Weg gerade nachbaut
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

// Chromium fängt api.github.com ab und beantwortet die Anfragen aus der Mock-Quelle q (wirft sie, fällt das Netz aus).
// Es geht nichts ins Netz; die Anfragen stehen in q.protokoll.
const CORS = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'etag, retry-after, date, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset' };
const fange = (q) => async (m) => {
  const { requestId, request } = m.params;
  const kopf = (o) => Object.entries(o).map(([name, value]) => ({ name, value: String(value) }));
  if (request.method === 'OPTIONS') {
    await senden('Fetch.fulfillRequest', { requestId, responseCode: 204, responseHeaders: kopf({ ...CORS,
      'access-control-allow-headers': 'authorization, content-type, if-none-match', 'access-control-allow-methods': 'GET, POST, PATCH', 'access-control-max-age': '600' }) }, m.sessionId);
    return;
  }
  const eigene = Object.fromEntries(Object.entries(request.headers).map(([k, v]) => [k.toLowerCase(), v]));
  let antwort;
  try { antwort = await q.fetch(request.url, { method: request.method, headers: eigene, body: request.postData }); } catch {
    await senden('Fetch.failRequest', { requestId, errorReason: 'InternetDisconnected' }, m.sessionId);   // wirft die Quelle, fällt das Netz aus
    return;
  }
  const koerper = Buffer.from(await antwort.arrayBuffer()).toString('base64');
  await senden('Fetch.fulfillRequest', { requestId, responseCode: antwort.status, responseHeaders: kopf({ ...Object.fromEntries(antwort.headers), ...CORS }), ...(koerper ? { body: koerper } : {}) }, m.sessionId);
};
// Die Standardquelle: die erfundenen Einträge des Szenarios „normal“ (tests/hilfen/beispieldaten.mjs)
const standardQuelle = () => mockQuelle({ dateien: SZENARIEN.normal.daten, repo: REPO, token: TOKEN, serverzeit: () => Date.now() });
let aktuell = null;   // die zuletzt geöffnete Seite; die nächste schließt sie, damit alte Seiten nicht weiter abgleichen

/**
 * Öffnet eine Seite in einem Fenster der Größe breite × hoehe. Sie startet mit dem, was auf dem Gerät liegt (vorbereiten legt
 * Anmeldung und Stand ab); die Anfragen an api.github.com beantwortet `abgefangen`.
 */
async function seite(url, breite = 360, hoehe = 800) {
  if (aktuell) { await aktuell(); aktuell = null; }
  const { result: { targetId } } = await senden('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId: s } } = await senden('Target.attachToTarget', { targetId, flatten: true });
  await senden('Emulation.setDeviceMetricsOverride', { width: breite, height: hoehe, deviceScaleFactor: 2, mobile: true }, s);
  await senden('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, s);
  await senden('Page.enable', {}, s);
  await senden('Network.enable', {}, s);
  await senden('Fetch.enable', { patterns: [{ urlPattern: 'https://api.github.com/*' }] }, s);
  await senden('Page.addScriptToEvaluateOnNewDocument', { source: WAECHTER }, s);
  await senden('Page.navigate', { url }, s); await pause(700);
  const werte = async (x) => (await senden('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }, s)).result?.result?.value;
  const tippe = async (sel) => {
    const [x, y] = await werte(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    await senden('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }, s);
    await senden('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, s); await pause(400);
  };
  const taste = async (key, code, kc) => {
    for (const type of ['keyDown', 'keyUp']) await senden('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: kc }, s);
    await pause(500);
  };
  // Text eintippen wie auf dem Handy: Feld fokussieren, den Inhalt wählen, Text einfügen (löst input aus)
  const schreibe = async (sel, text) => {
    await werte(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.focus(); e.select?.(); })()`);
    await senden('Input.insertText', { text }, s); await pause(200);
  };
  const zurueck = async () => { await werte('history.back()'); await pause(500); };
  const medien = async (modus) => { await senden('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: modus }] }, s); await pause(300); };
  const netz = async (an) => {
    await senden('Network.emulateNetworkConditions', { offline: !an, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, s); await pause(400);
  };
  const quelle = async (q) => { abgefangen = fange(q); };
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
  aktuell = schliesse;
  const stand = async () => werte(`[location.hash, document.getElementById('titel').textContent, document.getElementById('zurueck').hidden ? 'ohne Pfeil' : 'mit Pfeil'].join(' | ')`);
  return { werte, tippe, schreibe, taste, zurueck, medien, netz, quelle, bild, warte, schliesse, stand, hash: () => werte('location.hash'), draussen: async () => await werte('location.href') === 'about:blank' };
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
  const ID = 'r2d4vn';        // eine Frage an dich: liegt unter Wartet
  const EINGANG = 'k7m2qa';   // eine Notiz ohne Ziel: liegt im Eingang
  const ABNAHME = '8k3m1x';   // eine Abnahme mit neun Schritten

  // 0. Was auf dem Gerät liegt: Anmeldung, Gerätename und der Stand des ersten Abgleichs. Eine eigene Seite legt es ab
  //    (dieselbe IndexedDB wie bei allen folgenden Seiten) und wartet, bis die Einträge da sind.
  abgefangen = fange(standardQuelle());
  const vorbereiten = async () => {
    const v = await seite(t('#anmelden'));
    await v.werte(`(async () => { const { oeffneDatenbank, setzeEinstellung, SPEICHER } = await import('/js/speicher.js'); const db = await oeffneDatenbank();
      for (const n of Object.keys(SPEICHER)) for (const k of await db.schluessel(n)) await db.entferne(n, k);
      await setzeEinstellung(db, 'anmeldung', { repo: ${JSON.stringify(REPO)}, token: ${JSON.stringify(TOKEN)} }); await setzeEinstellung(db, 'geraet', 'handy'); db.schliesse(); })()`);
    await v.werte("location.hash = '#wartet'; location.reload()"); await pause(600);
    const da = await v.warte(`document.querySelectorAll('main .karte').length > 3`, 15000);
    await v.schliesse();
    return da;
  };
  melde(await vorbereiten(), 'der erste Start mit Anmeldung gleicht ab und zeigt Einträge in Wartet', 'keine Karten nach 15 s');
  const vergessen = (seiteP) => seiteP.werte(`(async () => { const { oeffneDatenbank } = await import('/js/speicher.js'); const db = await oeffneDatenbank(); await db.entferne('einstellungen', 'anmeldung'); db.schliesse(); })()`);

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
  melde(await p.werte('!document.getElementById("zurueck").hidden && document.querySelector("main .id").textContent') === 'r2d-4vn', 'ein Eintrag zeigt Pfeil Zurück und die ID mit Strich', await p.stand());
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
  p = await seite(t(`#eintrag/${EINGANG}/einsortieren`));
  melde(await p.werte('document.getElementById("blatt").open && document.getElementById("blatt-titel").textContent') === 'Einsortieren', 'ein tiefer Link zum Blatt Einsortieren öffnet das Blatt', await p.stand());
  await p.taste('Escape', 'Escape', 27);
  melde(!await p.werte('document.getElementById("blatt").open') && await p.hash() === `#eintrag/${EINGANG}`, 'Esc schließt zuerst das Blatt, der Eintrag bleibt', `${await p.stand()}, Blatt ${await p.werte('document.getElementById("blatt").open') ? 'offen' : 'zu'}`);
  await p.zurueck();
  melde(await p.hash() === '#eingang', 'Zurück vom Eintrag unter Einsortieren führt in den Eingang', await p.stand());
  await p.zurueck();
  melde(await p.hash() === '#wartet', 'Zurück aus dem Eingang führt nach Wartet', await p.stand());
  p = await seite(t(`#eintrag/${EINGANG}/einsortieren`));
  await p.zurueck();
  melde(!await p.werte('document.getElementById("blatt").open') && await p.hash() === `#eintrag/${EINGANG}`, 'der Zurück-Eintrag im Verlauf schließt das Blatt, ohne eine Ebene zu überspringen', `${await p.stand()}, Blatt ${await p.werte('document.getElementById("blatt").open') ? 'offen' : 'zu'}`);
  p = await seite(t('#mehr/geraet'));
  await p.tippe('#blatt-knoepfe button.text');
  melde(!await p.werte('document.getElementById("blatt").open') && await p.hash() === '#mehr', 'Abbrechen schließt das Blatt Gerätename und bleibt in Mehr', await p.stand());

  // 4. Weitere Ebenen
  p = await seite(t('#ideen'));
  melde(await p.werte('document.querySelector("#leiste [aria-current=page]").dataset.bereich') === 'mehr', 'unter der Ideensammlung ist Mehr in der Leiste gewählt', 'anderer Bereich');
  await p.zurueck(); const ideenHoch = await p.hash();
  await p.zurueck();
  melde(ideenHoch === '#mehr' && await p.hash() === '#wartet', 'Zurück aus der Ideensammlung führt über Mehr nach Wartet', `${ideenHoch}, danach ${await p.hash()}`);
  p = await seite(t(`#eintrag/${ABNAHME}/schritt/2`));
  const schritt = await p.stand();
  await p.zurueck(); const schrittHoch = await p.hash();
  await p.zurueck();
  melde(schritt.includes('Schritt 2') && schrittHoch === `#eintrag/${ABNAHME}` && await p.hash() === '#abnahmen', 'Zurück aus einem Schritt führt zum Eintrag, dann zu den Abnahmen', `${schritt}, ${schrittHoch}, danach ${await p.hash()}`);
  p = await seite(t('#wartet'));
  await p.tippe('#suchen');
  melde(await p.hash() === '#suche' && await p.werte('!document.getElementById("zurueck").hidden'), 'das Symbol Suchen öffnet die Suche mit Pfeil Zurück', await p.stand());
  await p.zurueck();
  melde(await p.hash() === '#wartet', 'Zurück aus der Suche führt dorthin, woher du kamst', await p.stand());
  // Anmeldung und Gerätename: ohne Anmeldung öffnet jede Adresse die Anmeldung (E7), Zurück verlässt die App
  p = await seite(t('#mehr')); await vergessen(p); await p.schliesse();
  p = await seite(t('#wartet'));
  melde(await p.hash() === '#anmelden' && await p.werte('document.getElementById("leiste").hidden && document.getElementById("zurueck").hidden'), 'ohne Anmeldung öffnet jede Adresse die Anmeldung, ohne Navigationsleiste und ohne Pfeil Zurück', await p.stand());
  await p.zurueck();
  melde(await p.draussen(), 'Zurück aus der Anmeldung verlässt die App', await p.werte('location.href'));
  p = await seite(t('#wartet'));
  const gespeichert = () => p.werte(`(async () => { const { oeffneDatenbank, einstellung } = await import('/js/speicher.js'); const db = await oeffneDatenbank();
    const r = { anmeldung: await einstellung(db, 'anmeldung'), geraet: await einstellung(db, 'geraet') }; db.schliesse(); return r; })()`);
  await p.tippe('#anmelden-knopf');
  melde(await p.werte('document.querySelectorAll("#anmelden-formular [aria-invalid=true]").length') === 2 && await p.hash() === '#anmelden'
    && await p.werte('document.activeElement?.name') === 'repo' && (await gespeichert()).anmeldung === null,
  'Anmelden ohne Repo und Token zeigt zwei Fehler am Feld, setzt den Fokus auf das erste und speichert nichts', `${await p.stand()}, Fehler ${await p.werte('document.querySelectorAll("#anmelden-formular [aria-invalid=true]").length')}`);
  await p.schreibe('[name=repo]', REPO); await p.schreibe('[name=token]', TOKEN);
  await p.schreibe('[name=geraet]', 'Pixel 8 Pro');
  await p.tippe('#anmelden-knopf');
  melde(await p.werte('document.querySelectorAll("#anmelden-formular [aria-invalid=true]").length') === 1 && (await gespeichert()).anmeldung === null
    && await p.werte('[...document.querySelectorAll("#anmelden-formular button")].some((b) => b.textContent.trim() === "pixel-8-pro übernehmen")'),
  'ein ungültiger Gerätename zeigt den Fehler und einen Vorschlag zum Übernehmen', await p.werte('document.getElementById("anmelden-formular").innerText'));
  await p.tippe('#anmelden-formular button.text');
  melde(await p.werte('document.querySelector("[name=geraet]").value') === 'pixel-8-pro' && await p.werte('document.querySelector("[name=repo]").value') === REPO,
    'der Vorschlag ersetzt den Namen und die anderen Eingaben bleiben', await p.werte('document.getElementById("anmelden-formular").innerText'));
  await p.schreibe('[name=token]', TOKEN);
  await p.tippe('#anmelden-knopf');
  const nachAnmeldung = await gespeichert();
  melde(await p.warte('location.hash === "#wartet"', 4000) && nachAnmeldung.anmeldung?.repo === REPO && nachAnmeldung.anmeldung?.token === TOKEN && nachAnmeldung.geraet === 'pixel-8-pro',
    'mit gültigen Eingaben speichert Anmelden Repo, Token und Gerätename und öffnet Wartet', `${await p.stand()}, ${JSON.stringify({ ...nachAnmeldung, anmeldung: nachAnmeldung.anmeldung && { repo: nachAnmeldung.anmeldung.repo } })}`);
  melde(await p.warte(`document.querySelectorAll('main .karte').length > 3`, 15000)
    && !await p.werte(`document.body.innerText.includes(${JSON.stringify(TOKEN)}) || location.href.includes(${JSON.stringify(TOKEN)})`),
  'danach zeigt Wartet die Einträge, und das Token steht weder in der Adresse noch im Text der Seite', await p.stand());
  p = await seite(t('#gibtesnicht'));
  melde(await p.hash() === '#wartet', 'eine unbekannte Adresse zeigt Wartet', await p.stand());
  p = await seite(t('#eintrag/R2D-4VN'));
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

  // 6b. Alle Zurück-Wege der Tabelle (UNA-3): von jeder Adresse aus Schritt für Schritt zurück, bis die App endet.
  //     Ein Blatt zählt als eigene Stufe über der Ansicht, ein tiefer Link baut den Stapel darunter.
  const TABELLE = [
    ['#wartet', []], ['#abnahmen', ['#wartet']], ['#erfassen', ['#wartet']], ['#mehr', ['#wartet']], ['#mehr/geraet', ['#mehr', '#wartet']],
    ['#eingang', ['#wartet']], ['#ideen', ['#mehr', '#wartet']], ['#suche', ['#wartet']],
    [`#eintrag/${ID}`, ['#wartet']], [`#eintrag/${ID}/antworten`, [`#eintrag/${ID}`, '#wartet']],
    [`#eintrag/${EINGANG}`, ['#eingang', '#wartet']], [`#eintrag/${EINGANG}/einsortieren`, [`#eintrag/${EINGANG}`, '#eingang', '#wartet']],
    ['#eintrag/b3cyxm', ['#ideen', '#mehr', '#wartet']],
    [`#eintrag/${ABNAHME}`, ['#abnahmen', '#wartet']], [`#eintrag/${ABNAHME}/schritt/3`, [`#eintrag/${ABNAHME}`, '#abnahmen', '#wartet']],
    [`#eintrag/${ABNAHME}/schritt/3/fail`, [`#eintrag/${ABNAHME}/schritt/3`, `#eintrag/${ABNAHME}`, '#abnahmen', '#wartet']],
    ['#eintrag/p4m7bt/ergebnis', ['#eintrag/p4m7bt', '#abnahmen', '#wartet']],
    ['#eintrag/q7w2de', ['#wartet']], ['#eintrag/zzzzzz', ['#wartet']],
  ];
  for (const [adr, kette] of TABELLE) {
    p = await seite(t(adr));
    const ist = [await p.hash()];
    for (let i = 0; i <= kette.length; i++) { await p.zurueck(); ist.push(await p.draussen() ? 'außerhalb' : await p.hash()); if (ist.at(-1) === 'außerhalb') break; }
    const soll = [adr, ...kette, 'außerhalb'];
    melde(ist.join(' → ') === soll.join(' → '), `Zurück ab ${adr}: ${kette.length ? kette.join(' → ') : 'die App endet'}`, ist.join(' → '));
  }

  // 6c. E13: zu jeder Handlung eines Eintrags gibt es einen Knopf in der Aktionsleiste, zu jedem Knopf eine Handlung;
  //     Freigaben tragen keinen Knopf, sondern den Satz, dass Freigeben erst in Phase 4 geht.
  p = await seite(t('#wartet'));
  const e13 = await p.werte(`(async () => {
    const { oeffneDatenbank } = await import('/js/speicher.js');
    const { ladeWelt, handlungenVon } = await import('/js/welt.js');
    const db = await oeffneDatenbank(); const w = await ladeWelt(db); db.schliesse();
    const fehler = []; let mitKnopf = 0;
    for (const [id, e] of w.eintraege) {
      location.hash = '#eintrag/' + id;
      await new Promise((r) => setTimeout(r, 220));
      const knoepfe = [...document.querySelectorAll('#aktion [data-handlung]')].map((b) => b.dataset.handlung);
      const soll = handlungenVon(w, { e, st: w.buch.zustand(e) });
      if (knoepfe.join() !== soll.join()) fehler.push(id + ': Knöpfe ' + (knoepfe.join() || 'keine') + ', Handlungen ' + (soll.join() || 'keine'));
      if (soll.length) mitKnopf++;
      if (e.head.get('Kind') === 'approval') {
        const satz = /Freigeben und Ablehnen gehen erst in Phase 4/.test(document.getElementById('inhalt').innerText);
        if (document.querySelectorAll('#inhalt button, #aktion button').length || !satz) fehler.push(id + ': Freigabe mit Knopf oder ohne Satz');
      }
    }
    return { n: w.eintraege.size, mitKnopf, fehler };
  })()`);
  melde(e13 && e13.fehler.length === 0 && e13.n > 15 && e13.mitKnopf > 3, `E13: in allen ${e13?.n} Einträgen hat jede Handlung einen Knopf und jeder Knopf eine Handlung (${e13?.mitKnopf} Einträge mit Knöpfen)`, JSON.stringify(e13));

  // 6d. Eine linke Kante je Ansicht (GAN-3): der Inhalt beginnt überall bei derselben x-Stelle, höchstens 1 px Streuung.
  //     Hüllen ohne eigene Fläche (ul, li, form) zählen nicht; ihre Kinder schon.
  const KANTE = `(() => {
    // UL und FORM sind Hüllen; ein LI nur, wenn es weder Rand noch Innenabstand noch Fläche hat (sonst ist es die Karte)
    const dient = (e) => {
      if (e.tagName === 'UL' || e.tagName === 'FORM') return true;
      if (e.tagName !== 'LI') return false;
      const c = getComputedStyle(e);
      return parseFloat(c.paddingLeft) === 0 && parseFloat(c.borderLeftWidth) === 0 && c.backgroundColor === 'rgba(0, 0, 0, 0)';
    };
    const sicht = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    const liste = [];
    const geh = (e) => {
      if (!sicht(e)) return;
      if (dient(e)) { for (const c of e.children) geh(c); return; }
      liste.push([e.tagName.toLowerCase() + (e.classList[0] ? '.' + e.classList[0] : ''), Math.round(e.getBoundingClientRect().left * 10) / 10]);
    };
    // Der Titel der oberen Leiste gehört dazu, solange kein Zurück-Pfeil davor steht (dann beginnt er hinter dem Pfeil)
    const h1 = document.getElementById('titel');
    if (sicht(h1) && document.getElementById('zurueck').hidden) liste.push(['kopf-titel', Math.round(h1.getBoundingClientRect().left * 10) / 10]);
    for (const c of document.querySelector('main').children) geh(c);
    const x = liste.map((l) => l[1]);
    return { n: liste.length, min: Math.min(...x), max: Math.max(...x), ab: liste.filter((l) => l[1] !== Math.min(...x)).slice(0, 4).map((l) => l.join('@')) };
  })()`;
  const KANTE_ANSICHTEN = ['#wartet', '#abnahmen', '#erfassen', '#mehr', '#eingang', '#ideen', '#suche', '#anmelden', `#eintrag/${ID}`, '#eintrag/m7q2ke', '#eintrag/q7w2de',
    '#eintrag/x9k3ft', `#eintrag/${ABNAHME}`, `#eintrag/${EINGANG}`, '#eintrag/b3cyxm', `#eintrag/${ABNAHME}/schritt/3`, '#eintrag/p4m7bt/ergebnis', '#eintrag/zzzzzz'];
  const kanten = [];
  p = await seite(t('#wartet'));
  for (const a of KANTE_ANSICHTEN) {
    await p.werte(`location.hash = ${JSON.stringify(a)}`); await pause(500);
    const k = await p.werte(KANTE);
    if (!k || k.n === 0 || k.max - k.min > 1) kanten.push(`${a}: ${k ? `${k.min}..${k.max} px (${k.ab.join(', ')})` : 'kein Inhalt'}`);
  }
  melde(kanten.length === 0, `eine linke Kante in allen ${KANTE_ANSICHTEN.length} Ansichten bei 360 px Breite, Streuung höchstens 1 px (GAN-3)`, kanten.join('; '));

  // 6d2. Blätter bei Text 200 %: Feld und Knöpfe überlagern sich nie, das Blatt scrollt bis zum letzten Knopf, Felder bleiben
  //      mindestens 48 px hoch (UPL-4, UPL-5, UAN-4)
  const BLATT = `(async () => {
    const b = document.getElementById('blatt'); const inh = b.querySelector('.blatt-inhalt'); const kn = document.getElementById('blatt-knoepfe');
    const r = (e) => e.getBoundingClientRect(); const fehler = [];
    if (!b.open) return ['Blatt nicht offen'];
    const kr = r(kn); const ir = r(inh); const br = r(b);
    if (ir.bottom > kr.top + 0.5) fehler.push('Inhalt reicht ' + Math.round(ir.bottom - kr.top) + ' px unter die Knöpfe');
    if (br.top < -0.5 || br.bottom > innerHeight + 0.5) fehler.push('Blatt ragt aus dem Fenster');
    for (const f of inh.querySelectorAll('input:not([type=radio]):not([type=checkbox]), select, textarea')) if (r(f).height < 47.5) fehler.push(f.name + ' nur ' + Math.round(r(f).height) + ' px hoch');
    const knoepfe = [...kn.querySelectorAll('button')].map(r);
    for (let i = 0; i < knoepfe.length; i++) for (let j = i + 1; j < knoepfe.length; j++) {
      const a = knoepfe[i]; const c = knoepfe[j];
      if (a.left < c.right - 0.5 && c.left < a.right - 0.5 && a.top < c.bottom - 0.5 && c.top < a.bottom - 0.5) fehler.push('Knöpfe überlagern sich');
    }
    // Das Blatt scrollt als Ganzes: am Ende ist der letzte Knopf ganz zu sehen
    b.scrollTop = b.scrollHeight;
    await new Promise((x) => setTimeout(x, 100));
    const letzter = knoepfe.length ? [...kn.querySelectorAll('button')].map(r).at(-1) : null;
    if (letzter && letzter.bottom > r(b).bottom + 1) fehler.push('der letzte Knopf ist nicht erreichbar');
    return fehler;
  })()`;
  const BLAETTER = [[`#eintrag/${ID}/antworten`, 'Antwortblatt'], [`#eintrag/${EINGANG}/einsortieren`, 'Einsortieren'], [`#eintrag/${ABNAHME}/schritt/3/fail`, 'Satz zu FAIL'], ['#mehr/geraet', 'Gerätename']];
  const ueberlagert = [];
  for (const [a, name] of BLAETTER) {
    p = await seite(t(a));
    await p.warte('document.getElementById("blatt").open');
    await p.werte(`document.documentElement.style.setProperty('font-size', '200%', 'important')`); await pause(400);
    const f = await p.werte(BLATT);
    if (!f || f.length) ueberlagert.push(`${name}: ${f ? f.join(', ') : 'keine Messung'}`);
  }
  melde(ueberlagert.length === 0, `kein Blatt überlagert Felder und Knöpfe bei Text 200 % (${BLAETTER.length} Blätter)`, ueberlagert.join('; '));

  // 6e. Entwürfe überstehen Zurück, Neuladen und den Wechsel der Ansicht (UEI-6); ein geleertes Feld löscht den Entwurf.
  p = await seite(t('#erfassen'));
  const entwurf = (key) => p.werte(`(async () => { const { oeffneDatenbank } = await import('/js/speicher.js'); const db = await oeffneDatenbank(); const d = await db.lies('entwuerfe', ${JSON.stringify(key)}); db.schliesse(); return d; })()`);
  await p.schreibe('[name=titel]', 'Wegetest: Eintrag in Arbeit');
  melde((await entwurf('erfassen'))?.titel === 'Wegetest: Eintrag in Arbeit', 'Erfassen sichert den Titel beim Tippen als Entwurf auf dem Gerät', JSON.stringify(await entwurf('erfassen')));
  await p.tippe('#leiste a[href="#mehr"]'); await p.tippe('#leiste a[href="#erfassen"]');
  melde(await p.werte('document.querySelector("[name=titel]")?.value') === 'Wegetest: Eintrag in Arbeit', 'der Entwurf steht nach dem Wechsel in einen anderen Bereich und zurück wieder im Feld', await p.stand());
  await p.werte('location.reload()'); await pause(900);
  melde(await p.werte('document.querySelector("[name=titel]")?.value') === 'Wegetest: Eintrag in Arbeit', 'der Entwurf steht nach Neuladen wieder im Feld', await p.stand());
  melde(await p.werte('document.querySelector("#aktion button[data-handlung=anlegen]")?.disabled') === false
    && !/nicht eingerichtet/.test(await p.werte('document.getElementById("aktion").innerText')), 'Eintrag anlegen ist bedienbar, die Schreibschicht ist angeschlossen', await p.werte('document.getElementById("aktion").innerText'));
  await p.werte('(() => { const i = document.querySelector("[name=titel]"); i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); })()'); await pause(300);
  melde(await entwurf('erfassen') == null, 'ein geleertes Formular löscht den Entwurf', JSON.stringify(await entwurf('erfassen')));
  p = await seite(t(`#eintrag/${ID}/antworten`));
  await p.schreibe('#blatt textarea', 'Mein Entwurf einer Antwort');
  await p.werte('location.reload()'); await pause(900);
  melde(await p.werte('document.querySelector("#blatt textarea")?.value') === 'Mein Entwurf einer Antwort', 'der Text im Antwortblatt steht nach Neuladen wieder da', await p.stand());
  await p.werte('document.getElementById("blatt").close()'); await pause(300);
  melde((await entwurf(`antwort/${ID}`))?.text === 'Mein Entwurf einer Antwort', 'der Entwurf bleibt auch nach dem Schließen des Blatts auf dem Gerät', JSON.stringify(await entwurf(`antwort/${ID}`)));
  await p.werte(`(async () => { const { oeffneDatenbank } = await import('/js/speicher.js'); const db = await oeffneDatenbank(); await db.entferne('entwuerfe', 'antwort/${ID}'); db.schliesse(); })()`);
  p = await seite(t(`#eintrag/${ABNAHME}/schritt/4/fail`));
  await p.schreibe('#blatt textarea', 'Die Ausgabe bricht in der Pipe um.');
  await p.tippe('#blatt-knoepfe .gefuellt');
  const urteil = await entwurf(`urteil/${ABNAHME}`);
  melde(urteil?.schritte?.[4]?.wort === 'FAIL' && urteil.schritte[4].satz === 'Die Ausgabe bricht in der Pipe um.' && /schritt\/5$/.test(await p.hash()),
    'Speichern im Satzblatt legt das Urteil als Entwurf ab und geht zum nächsten Schritt', `${await p.stand()}, ${JSON.stringify(urteil?.schritte?.[4])}`);
  await p.werte('location.reload()'); await pause(900);
  p = await seite(t(`#eintrag/${ABNAHME}/ergebnis`));
  melde(/Die Ausgabe bricht in der Pipe um\./.test(await p.werte('document.getElementById("inhalt").innerText')), 'das Ergebnis zeigt nach Neuladen das gesicherte Urteil mit seinem Satz', await p.stand());
  await p.werte(`(async () => { const { oeffneDatenbank } = await import('/js/speicher.js'); const db = await oeffneDatenbank(); await db.entferne('entwuerfe', 'urteil/${ABNAHME}'); db.schliesse(); })()`);

  // 6f. Teil E, Schreiben: ein Mock-GitHub nimmt die Commits an (Kopf, Blob, Baum, Commit, Zweig). Die Wege laufen in Echtzeit:
  //     zehn Sekunden Rückgängig, mindestens eine Sekunde zwischen schreibenden Anfragen. Es geht nichts nach GitHub.
  const geheim = ERFUNDENES_TOKEN;
  let netzAn = true; let ausfallE = null;
  const qs = mockQuelle({ dateien: new Map(SZENARIEN.normal.daten), repo: REPO, token: TOKEN, serverzeit: () => Date.now(), amNetz: () => netzAn, vorher: (a) => ausfallE?.(a) });
  abgefangen = fange(qs);
  melde(await vorbereiten(), 'Teil E: der Start mit dem schreibenden Mock-Repo gleicht ab', 'keine Karten nach 15 s');
  const db = (f) => `(async () => { const { oeffneDatenbank } = await import('/js/speicher.js'); const db = await oeffneDatenbank(); try { return await (${f})(db); } finally { db.schliesse(); } })()`;
  const schlangeJetzt = (pp) => pp.werte(db('(db) => db.alle("schlange")'));
  const eigeneCommits = () => qs.commits.filter((c) => !c.fremd);
  const schreibend = () => qs.protokoll.filter((a) => ['blobNeu', 'baumNeu', 'commitNeu', 'refNeu'].includes(a.art)).length;
  const hinweis = (pp) => pp.werte('document.getElementById("hinweis").hidden ? null : document.getElementById("hinweis-text").textContent');
  const waehle = (pp, sel, wert) => pp.werte(`(() => { const s = document.querySelector(${JSON.stringify(sel)}); s.value = ${JSON.stringify(wert)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);

  // Antwort: ein Tipp, Hinweis mit Rückgängig, Rückgängig nimmt zurück, nichts geht raus
  p = await seite(t(`#eintrag/${ID}/antworten`));
  await p.warte('document.getElementById("blatt").open');
  await p.tippe('#blatt [data-wahl="A"]');
  melde(await p.warte('!document.getElementById("blatt").open') && await p.hash() === `#eintrag/${ID}`
    && /^Antwort „A“ gespeichert$/.test(await hinweis(p) ?? '') && await p.werte('!document.getElementById("hinweis-knopf").hidden && document.getElementById("hinweis-knopf").textContent') === 'Rückgängig',
  'ein Tipp auf eine Möglichkeit schließt das Blatt und zeigt „Antwort „A“ gespeichert“ mit Rückgängig', `${await p.stand()}, Hinweis ${await hinweis(p)}`);
  melde(await p.warte('/noch nicht gesendet/.test(document.querySelector("main .kopfkarte").innerText)', 3000), 'der Eintrag sagt in Worten „noch nicht gesendet“', await p.werte('document.querySelector("main .kopfkarte")?.innerText'));
  const zahlVor = schreibend();
  await p.tippe('#hinweis-knopf');
  await pause(500);
  melde((await schlangeJetzt(p)).length === 0 && /Zurückgenommen/.test(await hinweis(p) ?? '') && schreibend() === zahlVor,
    'Rückgängig nimmt die Antwort aus der Schlange, der Hinweis sagt es, und es geht keine schreibende Anfrage raus', `${JSON.stringify(await schlangeJetzt(p))}, ${await hinweis(p)}`);
  await pause(11000);
  melde(schreibend() === zahlVor && eigeneCommits().length === 0, 'auch nach Ablauf der zehn Sekunden bleibt das Zurückgenommene zurückgenommen', `${schreibend() - zahlVor} Anfragen, ${eigeneCommits().length} Commits`);

  // Senden: Antwort, Einsortieren und neuer Eintrag in einer Sitzung; je ein Commit, mindestens eine Sekunde Abstand
  p = await seite(t(`#eintrag/${ID}/antworten`));
  await p.warte('document.getElementById("blatt").open');
  await p.tippe('#blatt [data-wahl="A"]');
  p = await seite(t(`#eintrag/${EINGANG}/einsortieren`));
  await p.warte('document.getElementById("blatt").open');
  melde(await p.werte('document.querySelector("#blatt-knoepfe .gefuellt").disabled') === true, 'Einsortieren: Senden bleibt gesperrt, bis ein Ziel gewählt ist', 'Senden frei');
  await waehle(p, '#blatt select[name=ziel]', 'alpha'); await pause(200);
  await p.schreibe('#blatt textarea', 'Zu den Hinweisen.');
  await p.tippe('#blatt-knoepfe .gefuellt');
  melde(await p.warte('!document.getElementById("blatt").open') && /^Eintrag k7m-2qa an alpha einsortiert\.$/.test(await hinweis(p) ?? ''), 'Einsortieren schließt das Blatt und zeigt den Hinweis „an alpha einsortiert“', `${await p.stand()}, ${await hinweis(p)}`);
  await p.werte('location.hash = "#eingang"'); await pause(600);
  melde(await p.werte('[...document.querySelectorAll("main .karte")].some((k) => /k7m-2qa/.test(k.innerText) && /Einsortieren an alpha noch nicht gesendet/.test(k.innerText))'),
    'die Karte bleibt im Eingang und sagt „Einsortieren an alpha noch nicht gesendet“, bis die Sendung angekommen ist', await p.werte('document.querySelector("main").innerText'));
  p = await seite(t('#erfassen'));
  await p.schreibe('[name=titel]', 'Wegetest: neuer Auftrag');
  await p.tippe('#aktion button[data-handlung=anlegen]');
  melde(await p.warte('/^Eintrag [a-z0-9]{3}-[a-z0-9]{3} gespeichert$/.test(document.getElementById("hinweis").hidden ? "" : document.getElementById("hinweis-text").textContent)', 3000) && await p.warte('document.querySelector("[name=titel]")?.value === ""', 3000)
    && await p.werte(db('(db) => db.lies("entwuerfe", "erfassen")')) == null, 'Eintrag anlegen zeigt den Hinweis, leert das Formular und löscht den Entwurf', `${await hinweis(p)}, Titel „${await p.werte('document.querySelector("[name=titel]")?.value')}“`);
  melde(await p.werte(db('async (db) => (await db.alle("schlange")).map((s) => s.zustand).join()')) !== '', 'die Sendung liegt in der Schlange', 'Schlange leer');
  // Alle drei Sendungen sind in der Schlange; die Seite bleibt offen, bis sie angekommen sind
  const angekommen = async () => p.warte(`(async () => { const { oeffneDatenbank } = await import('/js/speicher.js'); const db = await oeffneDatenbank(); const n = await db.zaehle('schlange'); db.schliesse(); return n === 0; })()`, 70000);
  const raus = await angekommen();
  melde(raus && eigeneCommits().length === 3, 'nach den zehn Sekunden gehen alle drei Sendungen raus, je ein Commit, und die Schlange ist leer', `${eigeneCommits().length} Commits, Schlange ${JSON.stringify((await schlangeJetzt(p)).map((s) => s.zustand))}`);
  const msgs = eigeneCommits().map((c) => c.message);
  melde(msgs.some((m) => m === `post: answer ${ID}: A`) || msgs.some((m) => m.startsWith(`post: answer ${ID}`)), 'der Commit der Antwort trägt die Nachricht des Postwerkzeugs', msgs.join(' | '));
  melde(msgs.some((m) => m.startsWith(`post: route ${EINGANG}`)) && msgs.some((m) => /^post: new [a-z][a-z0-9]{5}: Wegetest: neuer Auftrag$/.test(m)), 'Einsortieren und neuer Eintrag tragen die Nachrichten des Postwerkzeugs', msgs.join(' | '));
  const neuePfade = [...qs.dateien.keys()].filter((x) => !SZENARIEN.normal.daten.has(x));
  melde(neuePfade.length >= 4 && neuePfade.every((x) => x.startsWith('entries/')), 'die Dateien liegen unter entries/, nirgends sonst', neuePfade.join(', '));
  melde(qs.protokoll.filter((a) => a.methode === 'PATCH' || a.url.includes('/git/refs/')).every((a) => !String(a.body ?? '').includes('"force":true')), 'der Zweig wird nie mit force verschoben', 'force gefunden');
  await p.werte('location.hash = "#eingang"'); await pause(800);
  melde(!(await p.werte('[...document.querySelectorAll("main .karte")].some((k) => /k7m-2qa/.test(k.innerText))')), 'nach dem Abgleich ist der Eintrag aus dem Eingang verschwunden', await p.werte('document.querySelector("main").innerText'));

  // Abnahme: alle Urteile liegen als Entwurf da; Antwort senden bringt Nachtrag, Status und Folgeauftrag in einem Commit
  await p.werte(db('(db) => db.schreibe("entwuerfe", ' + JSON.stringify(entwuerfe()[0]) + ')'));
  const vorAbnahme = eigeneCommits().length;
  p = await seite(t(`#eintrag/${ABNAHME}/ergebnis`));
  await p.warte('document.querySelector("#aktion [data-handlung=abnahme]")');
  await p.tippe('#aktion [data-handlung=abnahme]');
  melde(await p.warte('location.hash === "#wartet"') && /^Antwort zur Abnahme 8k3-m1x gespeichert$/.test(await hinweis(p) ?? '')
    && await p.werte(db('async (db) => (await db.lies("entwuerfe", "urteil/' + ABNAHME + '")) == null')), 'Antwort senden geht zu Wartet, zeigt den Hinweis und räumt den Entwurf der Urteile auf', `${await p.stand()}, ${await hinweis(p)}`);
  melde(await p.warte(`(async () => { const { oeffneDatenbank } = await import('/js/speicher.js'); const db = await oeffneDatenbank(); const n = await db.zaehle('schlange'); db.schliesse(); return n === 0; })()`, 40000)
    && eigeneCommits().length === vorAbnahme + 1 && new RegExp(`^post: answer ${ABNAHME}: FAIL, new [a-z0-9]{6}$`).test(eigeneCommits().at(-1).message),
  'die Abnahme mit FAIL geht in einem Commit raus: Antwort und Folgeauftrag', `${eigeneCommits().length - vorAbnahme} Commits, ${eigeneCommits().at(-1)?.message}`);

  // Prüfung vor dem Senden: ein Geheimnis kommt nie in die Schlange, das Band steht im Blickfeld
  p = await seite(t('#erfassen'));
  await p.schreibe('[name=titel]', 'Zugang prüfen');
  await p.schreibe('[name=text]', `Das Token ist ${geheim}.`);
  const vorPruefung = schreibend();
  await p.tippe('#aktion button[data-handlung=anlegen]');
  melde(await p.warte('document.querySelector(".ablehnung .band strong")?.textContent === "Geheimnis gefunden"', 3000)
    && !(await p.werte('document.getElementById("hinweis-knopf").offsetParent !== null')) && (await schlangeJetzt(p)).length === 0 && schreibend() === vorPruefung,
  'ein Geheimnis im Text zeigt „Geheimnis gefunden“, nichts kommt in die Schlange und nichts geht raus', `${await p.werte('document.querySelector(".ablehnung")?.innerText')}`);
  melde(await p.werte(`(() => { const r = document.querySelector('.ablehnung .band').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()`), 'das Band steht im Blickfeld, ohne dass du suchen musst', 'Band außerhalb');
  melde(!(await p.werte(`document.body.innerText.includes(${JSON.stringify(geheim)}) && document.querySelector('.ablehnung').innerText.includes(${JSON.stringify(geheim)})`)), 'das Band nennt Ort und Art, nie den Wert', await p.werte('document.querySelector(".ablehnung")?.innerText'));
  await p.werte(db('(db) => db.entferne("entwuerfe", "erfassen")'));

  // Ohne Netz: die Antwort bleibt in der Schlange und sagt „wartet auf Netz“; mit Netz geht sie von allein raus
  const vorOffline = eigeneCommits().length;
  p = await seite(t('#eintrag/m7q2ke/antworten'));
  await p.warte('document.getElementById("blatt").open');
  netzAn = false; await p.netz(false);
  await p.schreibe('#blatt textarea', 'Danke, ich kümmere mich darum.');
  await p.tippe('#blatt-knoepfe .gefuellt');
  melde(await p.warte('!document.getElementById("blatt").open') && /gespeichert/.test(await hinweis(p) ?? ''), 'ohne Netz speichert die Antwort und zeigt den Hinweis', `${await p.stand()}, ${await hinweis(p)}`);
  melde(await p.warte('/noch nicht gesendet, wartet auf Netz/.test(document.querySelector("main .kopfkarte")?.innerText ?? "")', 30000),
    'ohne Netz steht am Eintrag „noch nicht gesendet, wartet auf Netz“', await p.werte('document.querySelector("main .kopfkarte")?.innerText'));
  melde(eigeneCommits().length === vorOffline, 'ohne Netz geht nichts raus', `${eigeneCommits().length - vorOffline} Commits`);
  netzAn = true; await p.netz(true);
  melde(await p.warte(`(async () => { const { oeffneDatenbank } = await import('/js/speicher.js'); const db = await oeffneDatenbank(); const n = await db.zaehle('schlange'); db.schliesse(); return n === 0; })()`, 50000)
    && eigeneCommits().length === vorOffline + 1, 'mit Netz geht die Antwort von allein raus und die Schlange leert sich', `${eigeneCommits().length - vorOffline} Commits, ${JSON.stringify((await schlangeJetzt(p)).map((s) => s.zustand))}`);

  // Token abgelehnt: die Eingabe bleibt in der Schlange, der Eintrag zeigt das Band mit dem Weg zum neuen Token
  p = await seite(t('#eintrag/x9k3ft'));
  ausfallE = () => new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401, headers: { 'content-type': 'application/json' } });
  await p.tippe('#aktion [data-handlung=erledigt]');
  melde(await p.warte('/Token abgelaufen oder widerrufen/.test(document.querySelector("main .band")?.innerText ?? "")', 40000)
    && (await schlangeJetzt(p)).length === 1 && (await schlangeJetzt(p))[0].zustand === 'token',
  'ein abgelehntes Token lässt die Eingabe in der Schlange und zeigt das Band „Token abgelaufen oder widerrufen“', `${JSON.stringify((await schlangeJetzt(p)).map((s) => s.zustand))}, ${await p.werte('document.querySelector("main")?.innerText.slice(0, 300)')}`);
  ausfallE = null;
  abgefangen = fange(standardQuelle());
  await vorbereiten();   // Anmeldung und Stand der Beispieldaten wiederherstellen, Schlange und Entwürfe leer

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
  melde(await p.werte(`/^heute um \\d\\d:\\d\\d, \\d+ Dateien$/.test(document.getElementById("abgleich").textContent)`)
    && await p.werte('document.querySelector("#abgleich-stand button")?.textContent') === 'Jetzt abgleichen', 'nach der Anmeldung steht der Stand des Abgleichs in Mehr und der Knopf Jetzt abgleichen da', await p.werte('document.getElementById("abgleich-stand").textContent'));
  melde(await p.werte('[...document.getElementById("takt").options].map((o) => o.textContent).join("|")') === 'jede Minute|alle 2 Minuten|alle 5 Minuten|alle 15 Minuten|nur mit dem Knopf'
    && await p.werte('document.getElementById("takt").selectedOptions[0].textContent') === 'alle 2 Minuten', 'der Takt im Vordergrund steht in Mehr und beginnt bei alle 2 Minuten', await p.werte('document.getElementById("takt").value'));
  await p.bild('mit-stand');
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
    const { SPEICHER } = await import('/js/speicher.js');
    for (const n of Object.keys(SPEICHER).filter((x) => x !== 'einstellungen')) for (const k of await db.schluessel(n)) await db.entferne(n, k);
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
  abgefangen = fange(standardQuelle());
  await vorbereiten();   // Anmeldung und Stand der Beispieldaten wiederherstellen

  // 8. Konsole: keine Verstöße gegen die CSP, keine Fehler im Skript, in keiner Ansicht
  const ansichten = ['#wartet', '#abnahmen', '#erfassen', '#mehr', '#eingang', `#eintrag/${ID}`, `#eintrag/${ID}/schritt/2`, `#eintrag/${ID}/einsortieren`, '#ideen', '#mehr/geraet', '#suche', '#anmelden', `#eintrag/${ID}/antworten`, `#eintrag/${EINGANG}/einsortieren`, `#eintrag/${ABNAHME}/schritt/3/fail`, `#eintrag/${ABNAHME}/ergebnis`];
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
