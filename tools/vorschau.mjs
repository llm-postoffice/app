// Vorschau der App mit erfundenen Daten: ein kleiner Server, der die App ausliefert und unter /SZENARIO/ den Einstieg
// js/start.js durch einen Einstieg mit Beispieldaten ersetzt (tests/hilfen/beispieldaten.mjs). Der Einstieg legt Datenbank,
// Anmeldung, Warteschlange und Entwürfe an, gleicht über die Mock-Quelle ab und startet dieselbe App (js/app.js) wie die
// echte Seite; in der App selbst steht kein Hook für Attrappen. Offline lädt der Einstieg keine Beispieldaten nach und
// liest, was beim letzten Laden auf dem Gerät blieb. Genutzt von tools/rendern.mjs; zum Ansehen: node tools/vorschau.mjs.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { JETZT, SZENARIEN } from '../tests/hilfen/beispieldaten.mjs';

const wurzel = new URL('../', import.meta.url).pathname;
const TYP = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };

/** Der Einstieg eines Szenarios als Quelltext eines Moduls (liegt unter /SZENARIO/js/start.js). */
export function einstieg(name) {
  return `// Einstieg der Vorschau, Szenario ${name} (erzeugt von tools/vorschau.mjs)
import { Abgleichsteuerung } from './steuerung.js';
import { starteApp } from './app.js';
import { setzeSuchText } from './anzeigen.js';
import { SPEICHER, oeffneOderRueckfall, setzeEinstellung } from './speicher.js';

const NAME = ${JSON.stringify(name)};
const JETZT = ${JETZT};
const db = await oeffneOderRueckfall();
let fetchen = () => Promise.reject(new TypeError('Failed to fetch'));
let sz = null;
if (navigator.onLine) {
  const { SZENARIEN, REPO, TOKEN } = await import('../../tests/hilfen/beispieldaten.mjs');
  const { mockQuelle, antwort } = await import('../../tests/hilfen/mockquelle.mjs');
  sz = SZENARIEN[NAME];
  for (const speicher of Object.keys(SPEICHER)) for (const k of await db.schluessel(speicher)) await db.entferne(speicher, k);
  await setzeEinstellung(db, 'speicher', { dauerhaft: true });
  if (sz.anmelden !== false) { await setzeEinstellung(db, 'anmeldung', { repo: REPO, token: TOKEN }); await setzeEinstellung(db, 'geraet', 'handy'); }
  const quelle = (extra = {}) => mockQuelle({ dateien: sz.daten, repo: REPO, token: TOKEN, serverzeit: () => JETZT + (sz.uhr ?? 0), ...extra });
  if (sz.seed) {
    const ersteSteuerung = new Abgleichsteuerung({ db, fetch: quelle().fetch, jetzt: () => JETZT, sichtbar: () => false });
    await ersteSteuerung.lauf('vorschau');
    ersteSteuerung.stop();
  }
  for (const s of sz.schlange ?? []) await db.schreibe('schlange', s);
  for (const d of sz.entwuerfe ?? []) await db.schreibe('entwuerfe', d);
  const haengen = new Promise(() => {});
  const live = {
    ok: () => quelle(), netz: () => quelle({ amNetz: () => false }),
    haengt: () => quelle({ vorher: (a) => (a.art === 'graphql' || a.art === 'blob' ? haengen : undefined) }),
    503: () => quelle({ vorher: () => antwort(503) }), 401: () => quelle({ vorher: () => antwort(401) }),
  }[sz.live ?? 'ok'];
  fetchen = live().fetch;
  if (sz.suche) setzeSuchText(sz.suche);
}
const steuerung = new Abgleichsteuerung({ db, fetch: (...a) => fetchen(...a), jetzt: () => JETZT, sichtbar: () => true, amNetz: () => navigator.onLine });
// Szenario „neue Fassung“: eine Registrierung mit wartendem Worker, wie der Browser sie nach einem Update liefert
let aktualisierung;
if (sz?.neu) {
  const { Aktualisierung } = await import('./aktualisieren.js');
  aktualisierung = new Aktualisierung({ container: { controller: {}, addEventListener() {} }, laden: () => {} });
  aktualisierung.beobachte({ waiting: { postMessage() {} }, addEventListener() {} });
}
// Szenario „Web-Push“: ein nachgebauter Browser (Registrierung, Berechtigung, Zwischenablage); der Renderer hat weder Google Play
// Services noch einen Push-Dienst. 'fehler' lässt subscribe so scheitern, wie es ohne Push-Dienst scheitert.
let webpush;
if (sz?.webpush) {
  const { WebPushProbe } = await import('./webpush.js');
  const ENDPUNKT = 'https:' + '//fcm.googleapis.com/fcm/send/erfunden';
  const abo = { endpoint: ENDPUNKT, toJSON: () => ({ endpoint: ENDPUNKT, keys: { p256dh: 'x', auth: 'y' } }), unsubscribe: async () => true };
  let aktuell = sz.webpush === 'an' ? abo : null;
  const manager = {
    getSubscription: async () => aktuell,
    subscribe: async () => {
      if (sz.webpush === 'fehler') throw Object.assign(new Error('Registration failed - push service error'), { name: 'AbortError' });
      aktuell = abo; return abo;
    },
  };
  webpush = new WebPushProbe({
    dienst: { getRegistration: async () => ({ pushManager: manager }) },
    benachrichtigung: { permission: 'granted', requestPermission: async () => 'granted' },
    zwischenablage: { writeText: async () => {} }, hatPush: true,
    schluessel: { lies: async () => sz.schluessel ?? '', schreibe: async () => {} },
  });
}
// Die Vorschau sendet nie von allein: der Zeitgeber der Schreibschicht und des Hinweises steht still, so bleibt jeder Zustand
// (noch nicht gesendet, Hinweis mit Rückgängig) für das Bild stehen. Der Abgleich läuft mit seinem eigenen Zeitgeber.
await starteApp({ db, steuerung, fetch: (...a) => fetchen(...a), jetzt: () => JETZT, zeitgeber: { setze: () => 0, loesche: () => {} }, aktualisierung, installiert: sz?.installiert, webpush });
// Tipps, die ein Szenario braucht (ein Hinweis nach dem Senden, eine abgelehnte Eingabe): wie ein Nutzer, über die Knöpfe
for (const wahl of [].concat(sz?.klick ?? [])) {
  const erst = Date.now();
  let knopf = null;
  while (!(knopf = document.querySelector(wahl)) && Date.now() - erst < 4000) await new Promise((r) => setTimeout(r, 100));
  if (!knopf) throw new Error('Knopf fehlt: ' + wahl);
  await new Promise((r) => setTimeout(r, 400));
  knopf.click();
  await new Promise((r) => setTimeout(r, 400));
}
if (sz?.scroll) {
  // Der Renderer macht ein Bild vom sichtbaren Teil: ein Szenario kann Mehr zu einem Abschnitt scrollen (Überschrift oder id)
  const erst = Date.now();
  let ziel = null;
  while (!(ziel = [...document.querySelectorAll('main h2, #fassung')].find((e) => e.textContent === sz.scroll || e.id === sz.scroll)) && Date.now() - erst < 4000) await new Promise((r) => setTimeout(r, 100));
  if (ziel) scrollTo(0, ziel.getBoundingClientRect().top + scrollY - 90);
}
if (sz?.formular) {
  // Eingaben der Anmeldung, die die Prüfung ablehnt: so zeigt die Vorschau die Fehler am Feld
  await new Promise((r) => setTimeout(r, 200));
  const form = document.getElementById('anmelden-formular');
  for (const [feld, wert] of Object.entries(sz.formular)) {
    const i = form.querySelector('[name="' + feld + '"]');
    i.value = wert; i.dispatchEvent(new Event('input', { bubbles: true }));
  }
  form.requestSubmit();
}
`;
}

/** Startet den Server auf einem freien Port von 127.0.0.1; gibt { server, basis } zurück. */
export async function starteVorschau() {
  const server = createServer(async (q, a) => {
    try {
      let pfad = decodeURIComponent(new URL(q.url, 'http://localhost').pathname);
      const m = /^\/([a-z-]+)(\/.*)$/.exec(pfad);
      const name = m && Object.hasOwn(SZENARIEN, m[1]) ? m[1] : null;
      if (name) pfad = m[2];
      if (name && pfad === '/js/start.js') {
        a.writeHead(200, { 'content-type': TYP['.js'], 'cache-control': 'no-store' });
        a.end(einstieg(name));
        return;
      }
      if (name && pfad === '/sw.js') {
        // Der Einstieg lädt die Beispieldaten nach; ohne Netz müssen sie in der Hülle liegen, sonst bricht der Start ab,
        // sobald der Renderer den Service Worker vom Netz trennt und eine weitere Adresse öffnet.
        const sw = (await readFile(join(wurzel, 'sw.js'), 'utf8')).replace("'./',", "'./', '../tests/hilfen/beispieldaten.mjs', '../tests/hilfen/mockquelle.mjs',");
        a.writeHead(200, { 'content-type': TYP['.js'], 'cache-control': 'no-store' });
        a.end(sw);
        return;
      }
      const p = normalize(join(wurzel, pfad.endsWith('/') ? `${pfad}index.html` : pfad));
      if (!p.startsWith(wurzel)) { a.writeHead(403); a.end(); return; }
      a.writeHead(200, { 'content-type': TYP[extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
      a.end(await readFile(p));
    } catch { a.writeHead(404); a.end(); }
  }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  return { server, basis: `http://127.0.0.1:${server.address().port}` };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { basis } = await starteVorschau();
  process.stdout.write(`Vorschau läuft: ${Object.keys(SZENARIEN).map((n) => `${basis}/${n}/#wartet`).join('\n  ')}\nBeenden mit Strg+C.\n`);
}
