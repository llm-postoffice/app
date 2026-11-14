// Der Abgleich gegen eine Mock-Quelle: erster Abgleich, 304, neue Datei, Abbruch und Fortsetzung, Rückfall auf REST,
// 401, 403, weitere Fehler. fetch und Datenbank sind Parameter; kein Test geht ans Netz.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AbgleichFehler, abgleichen, leseStand } from '../js/abgleich.js';
import { speicherDatenbank } from '../js/speicher.js';
import { antwort, blobSha, mockQuelle } from './hilfen/mockquelle.mjs';

const QUELLE = { repo: 'org/daten', token: 'TESTTOKEN' };

/** Ein kleines Datenrepo: n Einträge je zwei Dateien, projects.md und Dateien, die die App nicht liest. */
function repo(n = 5) {
  const d = new Map([['projects.md', '# Projekte\n\n## demo\n'], ['README.md', 'Hallo'], ['bin/werkzeug', '#!/usr/bin/python3\n']]);
  for (let i = 0; i < n; i++) {
    const id = `k7m2q${'abcdefghjk'[i]}`;
    d.set(`entries/${id.slice(0, 2)}/${id}/0-entry.md`, `# Eintrag ${i}\n\n- Kind: task\n- To: user\n- From: user, geraet, 2026-11-14T08:00Z\n`);
    d.set(`entries/${id.slice(0, 2)}/${id}/01M7CQZS800000000000000001-status.md`, `- By: user\n- Status: done\n- Result: ${i}\n`);
  }
  return d;
}
const lauf = (q, db, extra = {}) => abgleichen({ fetch: q.fetch, db, quelle: QUELLE, ...extra });
const fehlerArt = async (zusage) => { try { await zusage; } catch (e) { return e; } return assert.fail('kein Fehler'); };

test('erster Abgleich: Baum, ein GraphQL-Aufruf, nur entries/ und projects.md, Fortschritt bis zur Gesamtzahl', async () => {
  const q = mockQuelle({ dateien: repo(5) });
  const db = speicherDatenbank();
  const meldungen = [];
  const r = await lauf(q, db, { bei: (z) => meldungen.push(z) });
  assert.equal(r.art, 'aktualisiert');
  assert.equal(r.dateien, 11);   // 5 * 2 + projects.md
  assert.deepEqual(r.anfragen, { baum: 1, graphql: 1, rest: 0 });
  assert.equal(r.limit.verbleibend, 4990);
  const stand = await leseStand(db);
  assert.deepEqual([...stand.pfade.keys()].filter((p) => !p.startsWith('entries/')), ['projects.md']);
  assert.equal(stand.pfade.size, 11);
  assert.equal(stand.baum.vollstaendig, true);
  assert.equal(await db.lies('baum', 'neu'), undefined);
  const dateien = meldungen.filter((m) => m.phase === 'dateien');
  assert.equal(dateien[0].fertig, 0);
  assert.equal(dateien.at(-1).fertig, 11);
  assert.ok(dateien.every((m) => m.gesamt === 11));
  assert.deepEqual(meldungen.map((m) => m.phase).filter((p, i, a) => a.indexOf(p) === i), ['baum', 'dateien', 'fertig']);
});

test('Anhänge und fremde Pfade bleiben aus dem Abgleich', async () => {
  const dateien = repo(1);
  dateien.set('entries/k7/k7m2qa/attachments/foto.png', 'PNG');
  dateien.set('entries/README.md', 'Hinweis');
  const q = mockQuelle({ dateien });
  const db = speicherDatenbank();
  await lauf(q, db);
  assert.deepEqual([...(await leseStand(db)).pfade.keys()].sort(), [
    'entries/README.md', 'entries/k7/k7m2qa/0-entry.md', 'entries/k7/k7m2qa/01M7CQZS800000000000000001-status.md', 'projects.md']);
});

test('der Token geht als Bearer, der Baum mit no-store, GraphQL ohne; kein Token steht in einer Adresse', async () => {
  const q = mockQuelle({ dateien: repo(2) });
  await lauf(q, speicherDatenbank());
  const [baum, graphql] = q.protokoll;
  assert.equal(baum.cache, 'no-store');
  assert.equal(graphql.cache, undefined);
  assert.equal(graphql.methode, 'POST');
  assert.ok(q.protokoll.every((p) => p.kopf.get('authorization') === 'Bearer TESTTOKEN' && !p.url.includes('TESTTOKEN')));
  assert.doesNotMatch(graphql.body, /TESTTOKEN/);
});

test('zweiter Abgleich: 304 mit eigenem If-None-Match, nichts geladen, kein GraphQL', async () => {
  const q = mockQuelle({ dateien: repo(3) });
  const db = speicherDatenbank();
  await lauf(q, db);
  const vorher = q.protokoll.length;
  const r = await lauf(q, db, { jetzt: () => 5000 });
  assert.equal(r.art, 'unveraendert');
  assert.equal(r.neu, 0);
  assert.deepEqual(r.anfragen, { baum: 1, graphql: 0, rest: 0 });
  const baum = q.protokoll[vorher];
  assert.match(baum.kopf.get('if-none-match'), /^W\/"[0-9a-f]{40}"$/);
  assert.equal((await db.lies('baum', 'stand')).geprueft, 5000);
});

test('neue Datei: der Baum kommt neu, GraphQL holt allein die neue Prüfsumme', async () => {
  const q = mockQuelle({ dateien: repo(3) });
  const db = speicherDatenbank();
  await lauf(q, db);
  q.dateien.set('entries/k7/k7m2qa/01M7CQZS800000000000000002-addendum.md', '- By: user\n\nNeu.\n');
  const r = await lauf(q, db);
  assert.equal(r.art, 'aktualisiert');
  assert.equal(r.neu, 1);
  assert.deepEqual(r.anfragen, { baum: 1, graphql: 1, rest: 0 });
  assert.deepEqual(q.graphqlGroessen(), [7, 1]);   // erster Abgleich 7 Prüfsummen, danach eine
  assert.equal((await leseStand(db)).pfade.size, 8);
});

test('was der neue Baum nicht mehr nennt, fällt weg; gleiche Inhalte teilen eine Prüfsumme', async () => {
  const q = mockQuelle({ dateien: repo(2) });
  const db = speicherDatenbank();
  await lauf(q, db);
  const vorher = await db.schluessel('dateien');
  q.dateien.set('entries/k7/k7m2qa/01M7CQZS800000000000000009-status.md', q.dateien.get('entries/k7/k7m2qa/01M7CQZS800000000000000001-status.md'));
  q.dateien.set('projects.md', '# Projekte\n\n## demo\n\n## neu\n');
  await lauf(q, db);
  const nachher = await db.schluessel('dateien');
  assert.equal(nachher.length, vorher.length, 'eine Prüfsumme neu, die alte von projects.md weg, die doppelte Datei ohne eigene Prüfsumme');
  assert.ok(!nachher.includes(blobSha('# Projekte\n\n## demo\n')));
  const stand = await leseStand(db);
  assert.equal(stand.pfade.get('projects.md'), '# Projekte\n\n## demo\n\n## neu\n');
});

test('gleicher Inhalt unter neuer Kennung des Baums: nichts geladen', async () => {
  const q = mockQuelle({ dateien: repo(2) });
  const db = speicherDatenbank();
  await lauf(q, db);
  const stand = await db.lies('baum', 'stand');
  await db.schreibe('baum', { ...stand, etag: 'W/"alt"' });
  const r = await lauf(q, db);
  assert.equal(r.art, 'unveraendert');
  assert.deepEqual(r.anfragen, { baum: 1, graphql: 0, rest: 0 });
  assert.match((await db.lies('baum', 'stand')).etag, /^W\/"[0-9a-f]{40}"$/);
});

test('Abbruch und Fortsetzung: die geladenen Stapel bleiben, der nächste Lauf holt nur den Rest', async () => {
  const netzWeg = () => { throw new TypeError('Failed to fetch'); };
  const q = mockQuelle({ dateien: repo(6), vorher: (a) => (a.art === 'blob' || (a.art === 'graphql' && a.n >= 3) ? netzWeg() : undefined) });
  const db = speicherDatenbank();
  // Ab dem dritten Stapel scheitern GraphQL und der Rückfall am Netz: Stapel 1 und 2 (je 4 Prüfsummen) sind da
  const f = await fehlerArt(lauf(q, db, { stapel: 4 }));
  assert.equal(f.art, 'netz');
  assert.equal((await db.lies('baum', 'neu')).vollstaendig, false);
  assert.equal(await db.lies('baum', 'stand'), undefined);
  assert.equal(await leseStand(db), null, 'aus einem unvollständigen Baum wird nicht gelesen');
  assert.equal(await db.zaehle('dateien'), 8);

  const meldungen = [];
  const q2 = mockQuelle({ dateien: q.dateien });
  const r = await lauf(q2, db, { stapel: 4, bei: (m) => meldungen.push(m) });
  assert.equal(r.art, 'aktualisiert');
  assert.equal(r.neu, 5, '13 Dateien in 13 Prüfsummen, 8 schon da');
  assert.deepEqual(q2.graphqlGroessen(), [4, 1]);
  const erster = meldungen.find((m) => m.phase === 'dateien');
  assert.equal(erster.fertig, 8, 'die Anzeige beginnt bei dem, was schon da ist');
  assert.equal(await db.lies('baum', 'neu'), undefined);
  assert.equal((await leseStand(db)).pfade.size, 13);
});

test('Abbruch durch den Aufrufer zwischen den Stapeln', async () => {
  const q = mockQuelle({ dateien: repo(6) });
  const db = speicherDatenbank();
  const abbruch = new AbortController();
  const f = await fehlerArt(lauf(q, db, { stapel: 4, signal: abbruch.signal, bei: (m) => { if (m.phase === 'dateien' && m.fertig === 4) abbruch.abort(); } }));
  assert.equal(f.art, 'abgebrochen');
  assert.equal(await db.zaehle('dateien'), 4);
  assert.ok(await db.lies('baum', 'neu'));
});

test('GraphQL fällt aus: Rückfall auf REST-Blobs, höchstens vier gleichzeitig', async () => {
  const q = mockQuelle({ dateien: repo(10), verzoegerung: 3, vorher: (a) => (a.art === 'graphql' ? antwort(502, {}, { message: 'Bad Gateway' }) : undefined) });
  const db = speicherDatenbank();
  const r = await lauf(q, db, { stapel: 5 });
  assert.equal(r.art, 'aktualisiert');
  assert.equal(r.anfragen.graphql, 1, 'nach dem ersten Fehler geht der Rest dieses Abgleichs ohne GraphQL');
  assert.equal(r.anfragen.rest, 21);
  assert.equal(q.hoechstensGleichzeitig, 4);
  assert.equal((await leseStand(db)).pfade.size, 21);
});

test('GraphQL liefert ein Objekt nicht: genau dieses kommt per REST', async () => {
  const q = mockQuelle({ dateien: repo(3) });
  // die Antwort von GraphQL lässt das erste Objekt leer, wie bei einer Prüfsumme, die GitHub nicht auflöst
  const fetchOhneA0 = async (url, init) => {
    const res = await q.fetch(url, init);
    if (!String(url).endsWith('/graphql')) return res;
    const j = await res.json();
    j.data.repository.a0 = null;
    return new Response(JSON.stringify(j), { status: 200, headers: res.headers });
  };
  const db = speicherDatenbank();
  const r = await abgleichen({ fetch: fetchOhneA0, db, quelle: QUELLE });
  assert.deepEqual(r.anfragen, { baum: 1, graphql: 1, rest: 1 });
  assert.equal((await leseStand(db)).pfade.size, 7);
});

test('401: Token abgelaufen oder widerrufen, der Stand bleibt', async () => {
  const q = mockQuelle({ dateien: repo(2) });
  const db = speicherDatenbank();
  await lauf(q, db);
  const f = await fehlerArt(abgleichen({ fetch: q.fetch, db, quelle: { ...QUELLE, token: 'FALSCH' } }));
  assert.equal(f.art, 'token');
  assert.equal(f.status, 401);
  assert.equal((await leseStand(db)).pfade.size, 5);
});

test('403 mit erschöpftem Limit: GitHub bremst, mit dem Zeitpunkt aus der Kopfzeile', async () => {
  const q = mockQuelle({ dateien: repo(2), vorher: () => antwort(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1900000000' }, { message: 'API rate limit exceeded' }) });
  const f = await fehlerArt(lauf(q, speicherDatenbank()));
  assert.equal(f.art, 'limit');
  assert.equal(f.bis, 1900000000 * 1000);
});

test('403 mit Hinweis auf das zweite Limit und 429 mit Retry-After: GitHub bremst', async () => {
  const sekundaer = mockQuelle({ dateien: repo(2), vorher: () => antwort(403, { 'x-ratelimit-remaining': '4000' }, { message: 'You have exceeded a secondary rate limit.' }) });
  assert.equal((await fehlerArt(lauf(sekundaer, speicherDatenbank()))).art, 'limit');
  const zu_viel = mockQuelle({ dateien: repo(2), vorher: () => antwort(429, { 'retry-after': '30' }) });
  const f = await fehlerArt(lauf(zu_viel, speicherDatenbank(), { jetzt: () => 1000 }));
  assert.equal(f.art, 'limit');
  assert.equal(f.bis, 31000);
});

test('403 ohne Limit ist ein Rechtefehler, kein Bremsen', async () => {
  const q = mockQuelle({ dateien: repo(2), vorher: () => antwort(403, { 'x-ratelimit-remaining': '4000' }, { message: 'Resource not accessible by personal access token' }) });
  assert.equal((await fehlerArt(lauf(q, speicherDatenbank()))).art, 'verboten');
});

test('weitere Fehler: 404, 503, Netz, abgeschnittener Baum, ungültige Einstellung', async () => {
  const mit = (vorher) => mockQuelle({ dateien: repo(2), vorher });
  assert.equal((await fehlerArt(lauf(mit(() => antwort(404)), speicherDatenbank()))).art, 'nicht-gefunden');
  const f503 = await fehlerArt(lauf(mit(() => antwort(503)), speicherDatenbank()));
  assert.deepEqual([f503.art, f503.status], ['antwort', 503]);
  assert.equal((await fehlerArt(lauf(mit(() => { throw new TypeError('Failed to fetch'); }), speicherDatenbank()))).art, 'netz');
  const abgeschnitten = mit((a) => (a.art === 'baum' ? antwort(200, {}, { sha: 'x', tree: [], truncated: true }) : undefined));
  assert.equal((await fehlerArt(lauf(abgeschnitten, speicherDatenbank()))).art, 'zu-gross');
  const q = mit();
  for (const quelle of [{ ...QUELLE, repo: 'ohne-schraegstrich' }, { ...QUELLE, repo: 'a/b"c' }, { ...QUELLE, zweig: 'ma in' }, { ...QUELLE, token: '' }]) {
    const f = await fehlerArt(abgleichen({ fetch: q.fetch, db: speicherDatenbank(), quelle }));
    assert.ok(f instanceof AbgleichFehler);
    assert.equal(f.art, 'einstellung');
  }
  assert.equal(q.protokoll.length, 0, 'bei einer ungültigen Einstellung geht keine Anfrage raus');
});

test('ein Fehler mitten im Lauf lässt den bisherigen Stand unberührt', async () => {
  const q = mockQuelle({ dateien: repo(3) });
  const db = speicherDatenbank();
  await lauf(q, db);
  const vorher = await leseStand(db);
  q.dateien.set('entries/k7/k7m2qa/01M7CQZS800000000000000002-addendum.md', 'neu');
  const kaputt = mockQuelle({ dateien: q.dateien, vorher: (a) => (a.art === 'graphql' ? antwort(401) : undefined) });
  await fehlerArt(lauf(kaputt, db));
  const nachher = await leseStand(db);
  assert.deepEqual([...nachher.pfade], [...vorher.pfade]);
  assert.equal((await db.lies('baum', 'neu')).vollstaendig, false);
});
