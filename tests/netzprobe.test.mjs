// Netzprobe: onLine false sofort offline, sonst HEAD-Probe mit Zeitgrenze, Abstände 5 bis 60 s, Verbindung zu Steuerung und Schreiber.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ABSTAENDE_MS, FRISCH_MS, Netzpruefer, PROBE_ZEIT_MS, verbindePruefer } from '../js/netzprobe.js';
import { Abgleichsteuerung } from '../js/steuerung.js';
import { setzeEinstellung, speicherDatenbank } from '../js/speicher.js';
import { mockQuelle } from './hilfen/mockquelle.mjs';

function uhr() {
  const u = { jetzt: 1_000_000, timer: new Map(), nr: 0 };
  u.zeitgeber = {
    setze: (f, ms) => { u.nr++; u.timer.set(u.nr, { f, bei: u.jetzt + ms, ms }); return u.nr; },
    loesche: (id) => { u.timer.delete(id); },
  };
  u.uhr = () => u.jetzt;
  u.vor = async (ms) => {
    u.jetzt += ms;
    for (const [id, t] of [...u.timer].sort((a, b) => a[1].bei - b[1].bei)) if (t.bei <= u.jetzt) { u.timer.delete(id); t.f(); }
    for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));
  };
  u.wartende = () => [...u.timer.values()].map((t) => t.ms);
  return u;
}

/** Ein fetch, dessen Verhalten der Test wählt: 'ok', 'fehler' (TypeError) oder 'haengt' (bis zum Abbruch). */
function probenFetch() {
  const f = { art: 'ok', aufrufe: [] };
  f.fetch = (url, opt) => {
    f.aufrufe.push({ url, methode: opt.method, cache: opt.cache });
    if (f.art === 'ok') return Promise.resolve({ ok: true, status: 200 });
    if (f.art === 'fehler') return Promise.reject(new TypeError('Failed to fetch'));
    return new Promise((_, nein) => opt.signal.addEventListener('abort', () => nein(new DOMException('aborted', 'AbortError'))));
  };
  return f;
}

function aufbau(o = {}) {
  const u = uhr();
  const f = probenFetch();
  const zustand = { onLine: true, sichtbar: true };
  const p = new Netzpruefer({ fetch: f.fetch, adresse: 'http://localhost/js/version.js', onLine: () => zustand.onLine, sichtbar: () => zustand.sichtbar, jetzt: u.uhr, zeitgeber: u.zeitgeber, ...o });
  const meldungen = [];
  p.beiAenderung((da) => meldungen.push(da));
  return { u, f, p, zustand, meldungen };
}

test('onLine false gilt sofort als offline, ohne Anfrage', async () => {
  const { f, p, zustand, meldungen } = aufbau();
  zustand.onLine = false;
  assert.equal(p.amNetz(), false);
  assert.equal(await p.pruefe(), false);
  assert.equal(f.aufrufe.length, 0);
  assert.deepEqual(meldungen, []);   // kein Wechsel gegenüber amNetz() vorher
});

test('Probe: HEAD auf den eigenen Ursprung, no-store, mit Zahl gegen Zwischenspeicher', async () => {
  const { f, p } = aufbau();
  assert.equal(await p.pruefe(), true);
  assert.equal(f.aufrufe.length, 1);
  assert.equal(f.aufrufe[0].methode, 'HEAD');
  assert.equal(f.aufrufe[0].cache, 'no-store');
  assert.match(f.aufrufe[0].url, /^http:\/\/localhost\/js\/version\.js\?netz=\d+$/);
});

test('onLine true, aber die Probe scheitert: offline, und die Zeitgrenze bricht nach 3 s ab', async () => {
  const { u, f, p, meldungen } = aufbau();
  f.art = 'haengt';
  const frage = p.pruefe();
  assert.deepEqual(u.wartende(), [PROBE_ZEIT_MS]);
  await u.vor(PROBE_ZEIT_MS);
  assert.equal(await frage, false);
  assert.equal(p.amNetz(), false);
  assert.deepEqual(meldungen, [false]);
});

test('eine frische gelungene Probe gilt FRISCH_MS lang, danach fragt pruefe() neu', async () => {
  const { u, f, p } = aufbau();
  await p.pruefe();
  await p.pruefe();
  assert.equal(f.aufrufe.length, 1);
  await u.vor(FRISCH_MS);
  await p.pruefe();
  assert.equal(f.aufrufe.length, 2);
});

test('offline: Wiederholung nach 5, 10, 20, 40, 60, 60 s; bei Erfolg Meldung „Netz da“ und Abstand zurück', async () => {
  const { u, f, p, meldungen } = aufbau();
  f.art = 'fehler';
  await p.pruefe();
  const gesehen = [];
  for (let i = 0; i < 6; i++) {
    gesehen.push(u.wartende()[0]);
    await u.vor(u.wartende()[0]);
  }
  assert.deepEqual(gesehen, [5000, 10_000, 20_000, 40_000, 60_000, 60_000]);
  assert.deepEqual(ABSTAENDE_MS, [5000, 10_000, 20_000, 40_000, 60_000]);
  assert.equal(f.aufrufe.length, 7);
  f.art = 'ok';
  await u.vor(60_000);
  assert.equal(p.amNetz(), true);
  assert.deepEqual(meldungen, [false, true]);
  assert.deepEqual(u.wartende(), []);   // kein Zeitgeber mehr
  f.art = 'fehler';
  await p.pruefe({ erzwingen: true });
  assert.deepEqual(u.wartende(), [5000]);
});

test('offline und pruefe() ohne erzwingen fragt nicht jedes Mal neu', async () => {
  const { f, p } = aufbau();
  f.art = 'fehler';
  await p.pruefe();
  await p.pruefe();
  await p.pruefe();
  assert.equal(f.aufrufe.length, 1);
});

test('unsichtbar: keine Wiederholung, sichtbarWurde prüft sofort', async () => {
  const { u, f, p, zustand } = aufbau();
  zustand.sichtbar = false;
  f.art = 'fehler';
  await p.pruefe();
  assert.deepEqual(u.wartende(), []);
  f.art = 'ok';
  zustand.sichtbar = true;
  await p.sichtbarWurde();
  assert.equal(p.amNetz(), true);
});

test('das Ereignis online prüft sofort, auch wenn die Probe vorher gescheitert war', async () => {
  const { f, p, zustand, meldungen } = aufbau();
  zustand.onLine = false;
  await p.pruefe();
  zustand.onLine = true;
  f.art = 'ok';
  await p.ereignis();
  assert.equal(p.amNetz(), true);
  assert.deepEqual(meldungen, [true]);
});

test('ohne Adresse (Hülle) zählt nur onLine, es geht keine Anfrage raus', async () => {
  const { f, p, zustand } = aufbau({ adresse: null });
  assert.equal(await p.pruefe({ erzwingen: true }), true);
  zustand.onLine = false;
  assert.equal(await p.pruefe(), false);
  assert.equal(f.aufrufe.length, 0);
});

test('verbindePruefer hängt online, offline und Sichtbarkeit an und prüft beim Start', async () => {
  const { f, p } = aufbau();
  const ereignisse = {};
  const ziel = { addEventListener: (n, h) => { ereignisse[n] = h; } };
  const dokument = { visibilityState: 'visible', addEventListener: (n, h) => { ereignisse[n] = h; } };
  verbindePruefer(p, ziel, dokument);
  await new Promise((r) => setImmediate(r));
  assert.equal(f.aufrufe.length, 1);
  assert.deepEqual(Object.keys(ereignisse).sort(), ['offline', 'online', 'visibilitychange']);
});

// ---- Zusammenspiel mit der Steuerung: Flugmodus unter einem VPN (onLine bleibt true, die Anfragen hängen)

async function mitSteuerung() {
  const u = uhr();
  const f = probenFetch();
  const q = mockQuelle({ dateien: new Map([['projects.md', '# Projekte\n'], ['entries/k7/k7m2qa/0-entry.md', '# Eintrag\n\n- Kind: task\n- To: user\n']]) });
  const db = speicherDatenbank();
  await setzeEinstellung(db, 'anmeldung', { repo: 'org/daten', token: 'TESTTOKEN' });
  const p = new Netzpruefer({ fetch: f.fetch, adresse: 'http://localhost/js/version.js', jetzt: u.uhr, zeitgeber: u.zeitgeber });
  let synchron = 0;
  const s = new Abgleichsteuerung({
    db, fetch: (...a) => { synchron++; return q.fetch(...a); }, jetzt: u.uhr, zeitgeber: u.zeitgeber,
    amNetz: () => p.amNetz(), pruefeNetz: () => p.pruefe(), beiNetzFehler: () => { p.pruefe({ erzwingen: true }); },
  });
  p.beiAenderung((da) => (da ? s.netzDa() : s.netzWeg()));
  return { u, f, p, s, q, zaehler: () => synchron };
}

test('Steuerung: erster Abgleich, Probe gelingt, Abgleich läuft', async () => {
  const { s, f } = await mitSteuerung();
  await s.start();
  assert.equal(s.zustand.phase, 'bereit');
  assert.equal(f.aufrufe.length, 1);
});

test('Steuerung: Flugmodus unter VPN: die Probe scheitert nach 3 s, kein Abgleich geht ans Netz, ohneNetz gleich gesetzt', async () => {
  const { u, s, f, zaehler } = await mitSteuerung();
  await s.start();            // erst online, damit ein Stand da ist
  f.art = 'haengt';
  await u.vor(FRISCH_MS);     // die Probe ist veraltet
  const vorher = zaehler();
  const lauf = s.jetztAbgleichen();
  for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));   // bis die Probe läuft
  assert.ok(u.wartende().includes(PROBE_ZEIT_MS));
  await u.vor(PROBE_ZEIT_MS);
  await lauf;
  assert.equal(zaehler(), vorher);   // der Abgleich ging nie ans Netz
  assert.equal(s.zustand.ohneNetz, true);
  assert.equal(s.zustand.phase, 'fehler');
});

test('Steuerung: kommt das Netz zurück, meldet die Probe es und der Abgleich läuft von selbst', async () => {
  const { u, s, f, p, zaehler } = await mitSteuerung();
  await s.start();
  f.art = 'fehler';
  await u.vor(FRISCH_MS);
  await s.jetztAbgleichen();
  assert.equal(s.zustand.ohneNetz, true);
  f.art = 'ok';
  const vorher = zaehler();
  await u.vor(60_000);
  await u.vor(60_000);
  assert.equal(p.amNetz(), true);
  assert.ok(zaehler() > vorher);
  assert.equal(s.zustand.ohneNetz, false);
});
