// Steuerung des Abgleichs: Auslöser, ein Lauf zur Zeit, Takt, Fragen alle 10 s ohne Netz, kein Takt bei Fehlern, die nur
// der Nutzer behebt. Zeitgeber und Uhr sind Parameter; die Zeit läuft nur, wenn der Test sie vorstellt.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Abgleichsteuerung, OFFLINE_FRAGE_MS, TAKT_VORGABE_S } from '../js/steuerung.js';
import { setzeEinstellung, speicherDatenbank } from '../js/speicher.js';
import { antwort, mockQuelle } from './hilfen/mockquelle.mjs';

const dateien = () => new Map([['projects.md', '# Projekte\n'], ['entries/k7/k7m2qa/0-entry.md', '# Eintrag\n\n- Kind: task\n- To: user\n']]);

/** Ein Zeitgeber, den der Test von Hand weiterdreht. */
function falscheUhr() {
  const u = { jetzt: 1_000_000, timer: new Map(), nr: 0 };
  u.zeitgeber = {
    setze: (f, ms) => { u.nr++; u.timer.set(u.nr, { f, bei: u.jetzt + ms, ms }); return u.nr; },
    loesche: (id) => { u.timer.delete(id); },
  };
  u.uhr = () => u.jetzt;
  u.vor = async (ms) => {
    u.jetzt += ms;
    for (const [id, t] of [...u.timer]) if (t.bei <= u.jetzt) { u.timer.delete(id); t.f(); }
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
  };
  u.wartende = () => [...u.timer.values()].map((t) => t.ms);
  return u;
}

async function aufbau({ angemeldet = true, takt, quelle = {}, sichtbar = () => true } = {}) {
  const q = mockQuelle({ dateien: dateien(), ...quelle });
  const db = speicherDatenbank();
  if (angemeldet) await setzeEinstellung(db, 'anmeldung', { repo: 'org/daten', token: 'TESTTOKEN' });
  if (takt !== undefined) await setzeEinstellung(db, 'takt', takt);
  const uhr = falscheUhr();
  const s = new Abgleichsteuerung({ db, fetch: q.fetch, jetzt: uhr.uhr, zeitgeber: uhr.zeitgeber, sichtbar });
  const verlauf = [];
  s.beiAenderung((z) => verlauf.push(z.phase));
  return { q, db, uhr, s, verlauf };
}

test('Öffnen: ohne Anmeldung kein Abgleich und keine Anfrage', async () => {
  const { q, s } = await aufbau({ angemeldet: false });
  await s.start();
  assert.equal(s.zustand.phase, 'ohne-anmeldung');
  assert.equal(q.protokoll.length, 0);
});

test('Öffnen: Abgleich mit Fortschritt, danach Stand und der Takt von 120 s', async () => {
  const { q, uhr, s, verlauf } = await aufbau();
  const fortschritte = [];
  s.beiAenderung((z) => { if (z.fortschritt?.phase === 'dateien') fortschritte.push([z.fortschritt.fertig, z.fortschritt.gesamt]); });
  await s.start();
  assert.equal(s.zustand.phase, 'bereit');
  assert.deepEqual(s.zustand.letzter, { geprueft: 1_000_000, dateien: 2 });
  assert.deepEqual(verlauf.filter((p, i, a) => a[i - 1] !== p), ['laeuft', 'bereit']);
  assert.deepEqual(fortschritte.at(0), [0, 2]);
  assert.deepEqual(fortschritte.at(-1), [2, 2]);
  assert.deepEqual(uhr.wartende(), [TAKT_VORGABE_S * 1000]);
  assert.equal(q.zaehler.baum, 1);
});

test('der Takt gleicht im Vordergrund ab, im Hintergrund erst beim Sichtbarwerden', async () => {
  let vorne = true;
  const { q, uhr, s } = await aufbau({ sichtbar: () => vorne });
  await s.start();
  await uhr.vor(120_000);
  assert.equal(q.zaehler.baum, 2, 'nach 120 s der zweite Abgleich (304)');
  vorne = false;
  await uhr.vor(120_000);
  assert.equal(q.zaehler.baum, 2, 'im Hintergrund kein Abgleich');
  assert.equal(s.faellig, true);
  vorne = true;
  s.sichtbarWurde();
  await uhr.vor(0);
  assert.equal(q.zaehler.baum, 3);
  assert.equal(s.faellig, false);
});

test('der Takt ist einstellbar; 0 heißt nur mit dem Knopf', async () => {
  const eigener = await aufbau({ takt: 300 });
  await eigener.s.start();
  assert.deepEqual(eigener.uhr.wartende(), [300_000]);
  const von_hand = await aufbau({ takt: 0 });
  await von_hand.s.start();
  assert.deepEqual(von_hand.uhr.wartende(), []);
  await von_hand.s.jetztAbgleichen();
  assert.equal(von_hand.q.zaehler.baum, 2, 'der Knopf geht trotzdem');
  const ungueltig = await aufbau({ takt: 7 });
  await ungueltig.s.start();
  assert.deepEqual(ungueltig.uhr.wartende(), [120_000], 'ein unbekannter Wert fällt auf die Vorgabe zurück');
});

test('ein Lauf zur Zeit: Knopf, Netz und Takt während eines Laufs starten keinen zweiten', async () => {
  const { q, s } = await aufbau({ quelle: { verzoegerung: 5 } });
  const erster = s.start();
  s.jetztAbgleichen();
  s.netzDa();
  s.takten();
  await erster;
  assert.equal(q.zaehler.baum, 1);
  assert.equal(q.hoechstensGleichzeitig, 1);
});

test('Rückkehr ins Netz gleicht sofort ab', async () => {
  const { q, s } = await aufbau();
  await s.start();
  s.netzDa();
  await s.laufend;
  assert.equal(q.zaehler.baum, 2);
});

test('ohne Netz: Zustand statt Fehler, alle 10 s eine neue Frage, nach der Antwort wieder Takt', async () => {
  let netz = false;
  const { q, uhr, s } = await aufbau({ quelle: { vorher: () => { if (!netz) throw new TypeError('Failed to fetch'); return undefined; } } });
  await s.start();
  assert.equal(s.zustand.ohneNetz, true);
  assert.equal(s.zustand.fehler.art, 'netz');
  assert.deepEqual(uhr.wartende(), [OFFLINE_FRAGE_MS]);
  await uhr.vor(10_000);
  assert.equal(q.zaehler.baum, 2, 'nach 10 s fragt die App erneut');
  netz = true;
  await uhr.vor(10_000);
  assert.equal(s.zustand.ohneNetz, false);
  assert.equal(s.zustand.fehler, null);
  assert.deepEqual(uhr.wartende(), [TAKT_VORGABE_S * 1000]);
});

test('eine Ablehnung des Servers hebt "ohne Netz" auf', async () => {
  let modus = 'netz';
  const { s, uhr } = await aufbau({ quelle: { vorher: () => { if (modus === 'netz') throw new TypeError('x'); return antwort(503); } } });
  await s.start();
  assert.equal(s.zustand.ohneNetz, true);
  await uhr.vor(10_000);
  modus = 'server';
  await uhr.vor(10_000);
  assert.equal(s.zustand.ohneNetz, false);
  assert.equal(s.zustand.fehler.art, 'antwort');
});

test('401 und 403 ohne Limit: kein Takt, bis der Nutzer handelt; 403 mit Limit: neuer Versuch nach dem Zeitpunkt', async () => {
  const token = await aufbau({ quelle: { vorher: () => antwort(401) } });
  await token.s.start();
  assert.equal(token.s.zustand.fehler.art, 'token');
  assert.deepEqual(token.uhr.wartende(), []);
  const recht = await aufbau({ quelle: { vorher: () => antwort(403, { 'x-ratelimit-remaining': '9' }, { message: 'Resource not accessible' }) } });
  await recht.s.start();
  assert.deepEqual(recht.uhr.wartende(), []);
  const bremse = await aufbau({ quelle: { vorher: () => antwort(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(1000 + 600) }) } });
  await bremse.s.start();   // Uhr steht auf 1.000.000 ms = 1000 s; Zurücksetzen bei 1600 s, also in 600 s
  assert.equal(bremse.s.zustand.fehler.art, 'limit');
  assert.deepEqual(bremse.uhr.wartende(), [601_000], 'nicht vor dem Zeitpunkt aus der Kopfzeile, eine Sekunde danach');
});

test('eine Antwort ohne JSON ist ein Fehler der Art antwort', async () => {
  const { s } = await aufbau({ quelle: { vorher: () => new Response('<html>Proxy</html>', { status: 200 }) } });
  await s.start();
  assert.equal(s.zustand.phase, 'fehler');
  assert.equal(s.zustand.fehler.art, 'antwort');
});

test('eine Antwort ohne Dateiliste räumt den Stand nicht weg', async () => {
  const { db, q, s } = await aufbau();
  await s.start();
  const vorher = await db.zaehle('dateien');
  const ohneListe = new Abgleichsteuerung({ db, fetch: async () => new Response(JSON.stringify({ sha: 'x', truncated: false }), { status: 200 }), jetzt: () => 1, zeitgeber: falscheUhr().zeitgeber });
  await ohneListe.jetztAbgleichen();
  assert.equal(ohneListe.zustand.fehler.art, 'antwort');
  assert.equal(await db.zaehle('dateien'), vorher);
  assert.ok(q);
});

test('Fehler im eigenen Code werden zum Zustand und nicht zur abgelehnten Zusage', async () => {
  const kaputt = { get status() { throw new Error('kaputt'); }, headers: new Headers() };
  const { s } = await aufbau({ quelle: { vorher: () => kaputt } });
  await s.start();
  assert.equal(s.zustand.phase, 'fehler');
  assert.equal(s.zustand.fehler.art, 'intern');
});

test('der Zeitgeber der Vorgabe ruft setTimeout und clearTimeout ohne Empfänger (im Browser sonst Illegal invocation)', async () => {
  const s = new Abgleichsteuerung({ db: speicherDatenbank(), fetch: async () => { throw new Error('nicht gerufen'); } });
  assert.notEqual(s.zeitgeber.setze, setTimeout);
  assert.notEqual(s.zeitgeber.loesche, clearTimeout);
  let gerufen = false;
  const t = s.zeitgeber.setze.call({}, () => { gerufen = true; }, 1_000_000);
  s.zeitgeber.loesche.call({}, t);
  assert.equal(gerufen, false);
});
