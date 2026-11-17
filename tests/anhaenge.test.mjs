// Anhänge: Namen, Größen und Prüfungen (rein), Lesen aus dem Baum, Laden und Behalten auf dem Gerät, Anhängen beim Anlegen
// und Antworten bis in den Commit (Bytes als Base64 über die Git-Data-API), Prüfung auf Geheimnisse, Rückgängig. Die Mock-Quelle
// hält Anhänge als Bytes. Es geht nichts ins Netz.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ANHANG_MAX, ANHANG_WARNUNG, anhangPfad, anhangTexte, anhaengeVon, artVon, artWort, basisGroesse, basisZuBytes, bytesZuBasis,
  dataAdresse, groessenWort, nameGueltig, nimmAuf, saeubereName, textVon, typVon,
} from '../js/anhaenge.js';
import { AbgleichFehler, holeAnhang, leseStand } from '../js/abgleich.js';
import { Anhangholer } from '../js/anhangholer.js';
import { baueWelt } from '../js/welt.js';
import { dateien as beispiel, JETZT, ERFUNDENES_TOKEN } from './hilfen/beispieldaten.mjs';
import { aufbau } from './hilfen/schreiber.mjs';
import { antwort, blobSha } from './hilfen/mockquelle.mjs';

const BILD = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 255, 254, 0, 1]);   // Bytes mit NUL und Werten über 127
const b64 = (bytes) => bytesZuBasis(bytes);
const roh = (name, bytes, typ = '') => ({ name, groesse: bytes.length, typ, daten: b64(bytes) });
const eigene = (q) => q.commits.filter((c) => !c.fremd);
const SCHREIB = ['blobNeu', 'baumNeu', 'commitNeu', 'refNeu'];

// ---- rein

test('Namen: erlaubt sind Buchstaben, Ziffern, Leerzeichen und . _ - + ( ), bis 100 Zeichen, nicht am Rand . - oder Leerzeichen', () => {
  for (const n of ['a', 'Messung 2.txt', 'bild(1).png', 'größe-ä.pdf', '+x', 'a'.repeat(100)]) assert.equal(nameGueltig(n), true, n);
  for (const n of ['', ' a', 'a ', '.a', 'a.', '-a', 'a-', 'a/b', 'a\\b', 'a\nb', 'a:b', 'a'.repeat(101), null, 5]) assert.equal(nameGueltig(n), false, String(n));
});

test('Pfade im Baum: Anhang des Eintrags und eines Nachtrags; ein fremder Ordner oder Name zählt nicht', () => {
  const U = '01KA0000000000000000000001';
  assert.deepEqual(anhangPfad('entries/r2/r2d4vn/attachments/bild.png'), { id: 'r2d4vn', ulid: null, name: 'bild.png' });
  assert.deepEqual(anhangPfad(`entries/r2/r2d4vn/attachments/${U}/log.txt`), { id: 'r2d4vn', ulid: U, name: 'log.txt' });
  for (const p of ['entries/r2/r2d4vn/0-entry.md', 'entries/xx/r2d4vn/attachments/a.txt', 'entries/r2/r2d4vn/attachments/ordner/a.txt',
    'entries/r2/r2d4vn/attachments/.versteckt', `entries/r2/r2d4vn/attachments/${U}/x/a.txt`, 'projects.md']) assert.equal(anhangPfad(p), null, p);
});

test('Art, Typ und Wort: Raster als Bild, SVG nie, Text nach Endung, PDF und Archiv als Datei', () => {
  assert.equal(artVon('a.PNG'), 'bild');
  assert.equal(artVon('a.svg'), 'datei');
  assert.equal(artVon('log.txt'), 'text');
  assert.equal(artVon('a.pdf'), 'datei');
  assert.equal(typVon('a.jpg'), 'image/jpeg');
  assert.equal(typVon('a.html'), 'text/plain', 'HTML zeigt die App nie als Seite');
  assert.equal(typVon('a.pdf'), 'application/pdf');
  assert.equal(typVon('ohne'), 'application/octet-stream');
  assert.deepEqual(['a.png', 'a.txt', 'a.pdf', 'a.zip', 'a.xyz'].map(artWort), ['Bild', 'Text', 'PDF', 'Archiv', 'Datei']);
});

test('Größe wie im Werkzeug (size_text) mit Dezimalkomma', () => {
  assert.deepEqual([0, 812, 1024, 48230, 1048576, 1258291].map(groessenWort), ['0 B', '812 B', '1,0 KiB', '47,1 KiB', '1,0 MiB', '1,2 MiB']);
});

test('Base64: Hin und zurück ohne Verlust, Zeilenumbrüche von GitHub fallen weg, Größe ohne Entpacken', () => {
  assert.deepEqual([...basisZuBytes(b64(BILD))], [...BILD]);
  assert.deepEqual([...basisZuBytes(`${b64(BILD).slice(0, 8)}\n${b64(BILD).slice(8)}`)], [...BILD]);
  for (const n of [0, 1, 2, 3, 4, 100, 1000]) assert.equal(basisGroesse(b64(new Uint8Array(n))), n, String(n));
  assert.equal(dataAdresse('image/png', 'QUJD\n'), 'data:image/png;base64,QUJD');
  assert.equal(textVon(new TextEncoder().encode('Grüße')), 'Grüße');
  assert.equal(textVon(BILD), null, 'NUL oder kein UTF-8 ist kein Text');
});

test('Anhängen: zu groß, doppelter Name und der Hinweis über 300 KiB sagen, was hilft', () => {
  const eins = nimmAuf([], { name: 'a.txt', groesse: 10, typ: 'text/plain', daten: 'QQ==' });
  assert.equal(eins.ok, true);
  assert.equal(eins.hinweis, null);
  const doppelt = nimmAuf(eins.liste, { name: 'a.txt', groesse: 5, daten: 'QQ==' });
  assert.equal(doppelt.ok, false);
  assert.match(doppelt.fehler, /schon angehängt/);
  const gross = nimmAuf([], { name: 'gross.bin', groesse: ANHANG_MAX + 1, daten: '' });
  assert.equal(gross.ok, false);
  assert.match(gross.fehler, /1,0 MiB/);
  const mittel = nimmAuf([], { name: 'mittel.bin', groesse: ANHANG_WARNUNG + 1, daten: '' });
  assert.equal(mittel.ok, true);
  assert.match(mittel.hinweis, /300,0 KiB/);
  assert.equal(nimmAuf([], { name: 'ohne typ.png', groesse: 1, daten: '' }).liste[0].typ, 'image/png');
});

test('Name aus dem System: Pfad und unzulässige Zeichen fallen weg', () => {
  assert.equal(saeubereName('Messung: 14:07.txt'), 'Messung_ 14_07.txt');
  assert.equal(saeubereName('ordner/a.txt'), 'a.txt');
});

test('Prüfung der Anhänge: Text geht durch die Prüfung, Binärdaten nicht, der Name nur auf Geheimnisse', () => {
  const t = anhangTexte([roh('log.txt', new TextEncoder().encode('Zeile 1\nZeile 2')), roh('bild.png', BILD)]);
  assert.deepEqual(t.map((x) => x.wo), ['Name des Anhangs', 'Anhang log.txt', 'Name des Anhangs']);
  assert.equal(t[0].nurGeheimnis, true);
  assert.equal(t[1].nurGeheimnis, undefined);
});

// ---- Baum, Laden, Behalten

/** Das Beispielrepo mit zwei Anhängen am Eintrag r2d4vn (einer am Eintrag, einer am Nachtrag) und einem verwaisten Ordner. */
function mitAnhaengen() {
  const d = beispiel();
  const nachtrag = [...d.keys()].find((p) => p.startsWith('entries/r2/r2d4vn/') && p.endsWith('-addendum.md')).split('/').pop().split('-')[0];
  const text = 'Messung rechner-a\nmittel 0,07 s\n';
  d.set('entries/r2/r2d4vn/attachments/fenster.png', BILD);
  d.set(`entries/r2/r2d4vn/attachments/${nachtrag}/messung.txt`, text);
  d.set('entries/r2/r2d4vn/attachments/01KA0000000000000000000009/verwaist.txt', 'ohne Nachtrag');
  return { d, nachtrag, text };
}

test('Abgleich: Name und Größe aus dem Baum, der Inhalt wird nicht geladen; nur Anhänge eines Nachtrags, der da ist', async () => {
  const { d, nachtrag, text } = mitAnhaengen();
  const a = await aufbau({ daten: d });
  const stand = await leseStand(a.db);
  assert.equal(stand.baum.anhaenge.length, 3);
  const welt = baueWelt({ pfade: stand.pfade, baum: stand.baum, jetzt: JETZT });
  const liste = anhaengeVon(welt.baum, welt.eintraege.get('r2d4vn'));
  assert.deepEqual(liste.map((x) => [x.name, x.ulid, x.groesse, x.art]), [['fenster.png', null, BILD.length, 'bild'], ['messung.txt', nachtrag, text.length, 'text']]);
  assert.ok(liste[1].zeit > 0);
  assert.equal(a.q.zaehler.blob ?? 0, 0, 'kein Blob geladen');
  assert.ok(!a.q.protokoll.some((p) => p.art === 'graphql' && p.body.includes(blobSha(BILD))), 'GraphQL fragt keinen Anhang');
});

test('Laden: beim ersten Öffnen aus GitHub, danach vom Gerät ohne Anfrage; die Bytes bleiben gleich', async () => {
  const { d } = mitAnhaengen();
  const a = await aufbau({ daten: d });
  const stand = await leseStand(a.db);
  const bild = stand.baum.anhaenge.find((x) => x.name === 'fenster.png');
  const holer = new Anhangholer({ db: a.db, fetch: a.q.fetch, anmeldung: async () => a.quelle, jetzt: a.jetzt });
  assert.equal(await holer.gespeichert(bild.sha), false);
  const r = await holer.inhalt(bild);
  assert.equal(r.ok, true);
  assert.equal(r.vomGeraet, false);
  assert.deepEqual([...basisZuBytes(r.daten)], [...BILD]);
  const vorher = a.q.protokoll.length;
  const offline = new Anhangholer({ db: a.db, fetch: async () => { throw new TypeError('Failed to fetch'); }, anmeldung: async () => a.quelle, jetzt: a.jetzt });
  const noch = await offline.inhalt(bild);
  assert.equal(noch.ok, true);
  assert.equal(noch.vomGeraet, true);
  assert.equal(a.q.protokoll.length, vorher);
});

test('Laden ohne Netz, ohne Anmeldung, mit abgelehntem Token und über 1 MiB sagt die Art des Fehlers', async () => {
  const { d } = mitAnhaengen();
  const a = await aufbau({ daten: d });
  const bild = (await leseStand(a.db)).baum.anhaenge.find((x) => x.name === 'fenster.png');
  const kein = new Anhangholer({ db: a.db, fetch: async () => { throw new TypeError('Failed to fetch'); }, anmeldung: async () => a.quelle, jetzt: a.jetzt });
  assert.equal((await kein.inhalt(bild)).art, 'netz');
  assert.equal((await new Anhangholer({ db: a.db, fetch: a.q.fetch, anmeldung: async () => null, jetzt: a.jetzt }).inhalt(bild)).art, 'anmeldung');
  const abgelehnt = new Anhangholer({ db: a.db, fetch: async () => antwort(401), anmeldung: async () => a.quelle, jetzt: a.jetzt });
  assert.equal((await abgelehnt.inhalt(bild)).art, 'token');
  const riese = new Anhangholer({ db: a.db, fetch: a.q.fetch, anmeldung: async () => a.quelle, jetzt: a.jetzt });
  assert.equal((await riese.inhalt({ sha: 'f'.repeat(40), groesse: ANHANG_MAX + 1 })).art, 'zu-gross');
  await assert.rejects(holeAnhang({ fetch: async () => antwort(200, {}, { sha: 'a'.repeat(40), size: ANHANG_MAX + 1, encoding: 'base64', content: '' }), quelle: a.quelle, sha: 'a'.repeat(40), jetzt: a.jetzt }), (e) => e instanceof AbgleichFehler && e.art === 'zu-gross');
});

test('Zwei gleichzeitige Öffnungen teilen sich eine Anfrage', async () => {
  const { d } = mitAnhaengen();
  const a = await aufbau({ daten: d });
  const bild = (await leseStand(a.db)).baum.anhaenge.find((x) => x.name === 'fenster.png');
  const holer = new Anhangholer({ db: a.db, fetch: a.q.fetch, anmeldung: async () => a.quelle, jetzt: a.jetzt });
  const vorher = a.q.zaehler.blob ?? 0;
  await Promise.all([holer.inhalt(bild), holer.inhalt(bild)]);
  assert.equal((a.q.zaehler.blob ?? 0) - vorher, 1);
});

test('Ein Anhang, der aus dem Baum verschwindet, verschwindet auch vom Gerät', async () => {
  const { d } = mitAnhaengen();
  const a = await aufbau({ daten: d });
  const bild = (await leseStand(a.db)).baum.anhaenge.find((x) => x.name === 'fenster.png');
  await new Anhangholer({ db: a.db, fetch: a.q.fetch, anmeldung: async () => a.quelle, jetzt: a.jetzt }).inhalt(bild);
  assert.deepEqual(await a.db.schluessel('anhaenge'), [bild.sha]);
  a.q.dateien.delete('entries/r2/r2d4vn/attachments/fenster.png');
  assert.equal((await a.abgleich()).ok, true);
  assert.deepEqual(await a.db.schluessel('anhaenge'), []);
});

test('Ein Abgleich mit Stand aus der alten Fassung (ohne Anhänge im Baum) lädt den Baum neu, auch bei gleichem ETag', async () => {
  const { d } = mitAnhaengen();
  const a = await aufbau({ daten: d });
  const stand = await a.db.lies('baum', 'stand');
  delete stand.anhaenge;
  await a.db.schreibe('baum', stand);
  assert.equal((await a.abgleich()).ok, true);
  assert.equal((await a.db.lies('baum', 'stand')).anhaenge.length, 3);
});

// ---- Anhängen

test('Neuer Eintrag mit Anhängen: ein Commit, Bytes unverändert unter attachments/NAME, Base64 im Blob, Eintragsdatei ohne Feld', async () => {
  const a = await aufbau();
  const vorher = [...a.q.dateien.keys()];
  const text = new TextEncoder().encode('Zeile 1\nZeile 2\n');
  const r = await a.schreiber.anlegen({ art: 'task', titel: 'Mit Anhang', text: 'Siehe Anhang.', anhaenge: [roh('fenster.png', BILD, 'image/png'), roh('log (1).txt', text)] });
  assert.equal(r.ok, true);
  await a.sende();
  assert.equal(eigene(a.q).length, 1);
  assert.match(eigene(a.q)[0].message, /^post: new [0-9a-z]{6}: Mit Anhang$/);
  const neu = [...a.q.dateien.keys()].filter((p) => !vorher.includes(p));
  const id = neu.find((p) => p.endsWith('/0-entry.md')).split('/')[2];
  assert.deepEqual(neu.sort(), [`entries/${id.slice(0, 2)}/${id}/0-entry.md`, `entries/${id.slice(0, 2)}/${id}/attachments/fenster.png`, `entries/${id.slice(0, 2)}/${id}/attachments/log (1).txt`].sort());
  assert.deepEqual([...a.q.dateien.get(`entries/${id.slice(0, 2)}/${id}/attachments/fenster.png`)], [...BILD]);
  assert.equal(a.q.dateien.get(`entries/${id.slice(0, 2)}/${id}/attachments/log (1).txt`), 'Zeile 1\nZeile 2\n');
  assert.doesNotMatch(a.q.dateien.get(`entries/${id.slice(0, 2)}/${id}/0-entry.md`), /Attachments/);
  const blobs = a.q.protokoll.filter((p) => p.art === 'blobNeu').map((p) => JSON.parse(p.body).encoding);
  assert.deepEqual(blobs.sort(), ['base64', 'base64', 'utf-8']);
  assert.deepEqual(a.q.protokoll.filter((p) => SCHREIB.includes(p.art)).map((p) => p.art), ['blobNeu', 'blobNeu', 'blobNeu', 'baumNeu', 'commitNeu', 'refNeu']);
});

test('Antwort mit Anhang: Nachtrag mit Feld Attachments nach Answer, Dateien unter attachments/ULID/, die Statusdatei ohne Anhang', async () => {
  const a = await aufbau();
  const vorher = [...a.q.dateien.keys()];
  const r = await a.schreiber.antworten('r2d4vn', { wahl: 'A', text: 'Mit Bild.', anhaenge: [roh('fenster.png', BILD, 'image/png')] });
  assert.equal(r.ok, true);
  await a.sende();
  assert.equal(eigene(a.q).length, 1);
  assert.equal(eigene(a.q)[0].message, 'post: answer r2d4vn');
  const neu = [...a.q.dateien.keys()].filter((p) => !vorher.includes(p));
  const add = neu.find((p) => p.endsWith('-addendum.md'));
  const ulid = add.split('/').pop().split('-')[0];
  assert.deepEqual(neu.sort(), [add, `entries/r2/r2d4vn/attachments/${ulid}/fenster.png`, neu.find((p) => p.endsWith('-status.md'))].sort());
  assert.equal(a.q.dateien.get(add), '- By: user, handy-a, 2026-11-14T13:07Z\n- Answer: A: Standardbibliothek (Empfehlung)\n- Attachments: fenster.png\n\nMit Bild.\n');
  assert.doesNotMatch(a.q.dateien.get(neu.find((p) => p.endsWith('-status.md'))), /Attachments/);
  assert.deepEqual([...a.q.dateien.get(`entries/r2/r2d4vn/attachments/${ulid}/fenster.png`)], [...BILD]);
  // Nach dem Abgleich zeigt der Eintrag den Anhang unter seinem Nachtrag
  const stand = await leseStand(a.db);
  const welt = baueWelt({ pfade: stand.pfade, baum: stand.baum, jetzt: a.jetzt() });
  assert.deepEqual(anhaengeVon(welt.baum, welt.eintraege.get('r2d4vn')).map((x) => [x.name, x.ulid]), [['fenster.png', ulid]]);
});

test('Antwort nur als Text bleibt ohne Feld Attachments', async () => {
  const a = await aufbau();
  await a.schreiber.antworten('r2d4vn', { text: 'Nur Text.' });
  await a.sende();
  const add = [...a.q.dateien.keys()].filter((p) => p.endsWith('-addendum.md')).map((p) => a.q.dateien.get(p));
  assert.ok(add.some((t) => t.includes('Nur Text.')));
  assert.ok(!add.some((t) => t.includes('Attachments')));
});

test('Zulässigkeit wie im Werkzeug: Name, doppelter Name und 1 MiB lehnt die Schreibschicht ab, ohne etwas einzureihen', async () => {
  const a = await aufbau();
  const klein = new Uint8Array(4);
  const fall = [
    [[roh('../x.txt', klein)], /Dateiname ist nicht zulässig/],
    [[roh('a.txt', klein), roh('a.txt', klein)], /kommt zweimal vor/],
    [[roh('gross.bin', new Uint8Array(ANHANG_MAX + 1))], /1,0 MiB/],
  ];
  for (const [anhaenge, muster] of fall) {
    const r = await a.schreiber.anlegen({ art: 'task', titel: 'T', anhaenge });
    assert.equal(r.ok, false);
    assert.match(r.fehler, muster);
  }
  assert.deepEqual(await a.db.alle('schlange'), []);
  const genau = await a.schreiber.anlegen({ art: 'task', titel: 'T', anhaenge: [roh('genau.bin', new Uint8Array(ANHANG_MAX))] });
  assert.equal(genau.ok, true, 'genau 1 MiB geht');
});

test('Ein Geheimnis in einem Textanhang geht nie raus; Personendaten nur nach Trotzdem senden; der Wert steht nie in der Meldung', async () => {
  const a = await aufbau();
  const geheim = new TextEncoder().encode(`Notiz\ntoken = ${ERFUNDENES_TOKEN}\n`);
  const r = await a.schreiber.anlegen({ art: 'task', titel: 'T', anhaenge: [roh('notiz.txt', geheim)] });
  assert.equal(r.ok, false);
  assert.equal(r.pruefung.geheimnisse[0].wo, 'im Anhang notiz.txt');
  assert.equal(r.pruefung.geheimnisse[0].zeile, 2);
  assert.ok(!JSON.stringify(r).includes(ERFUNDENES_TOKEN));
  const trotz = await a.schreiber.anlegen({ art: 'task', titel: 'T', anhaenge: [roh('notiz.txt', geheim)], personenErlaubt: true });
  assert.equal(trotz.ok, false, 'ein Geheimnis lässt sich nicht freigeben');
  const nameGeheim = await a.schreiber.anlegen({ art: 'task', titel: 'T', anhaenge: [roh(`${ERFUNDENES_TOKEN}.txt`, new Uint8Array(2))] });
  assert.equal(nameGeheim.ok, false);
  assert.equal(nameGeheim.pruefung.geheimnisse[0].wo, 'im Namen eines Anhangs');
  assert.deepEqual(await a.db.alle('schlange'), []);
  // Binärdaten prüft die App nicht nach Inhalt, auch wenn Bytes wie ein Geheimnis aussehen
  const bin = Uint8Array.from([0, ...new TextEncoder().encode(ERFUNDENES_TOKEN)]);
  assert.equal((await a.schreiber.anlegen({ art: 'task', titel: 'T', anhaenge: [roh('daten.bin', bin)] })).ok, true);
});

test('Die Warteschlange hält den Inhalt der Anhänge auf dem Gerät: ohne Netz bleibt die Sendung liegen, mit Netz geht sie raus', async () => {
  let netz = false;
  const a = await aufbau({ quelle: { amNetz: () => netz } });
  netz = true;
  await a.abgleich();
  netz = false;
  await a.schreiber.antworten('r2d4vn', { wahl: 'B', anhaenge: [roh('fenster.png', BILD, 'image/png')] });
  const s = (await a.db.alle('schlange'))[0];
  assert.equal(s.anhaenge[0].name, 'fenster.png');
  assert.ok(s.dateien.some((d) => d.base64 === b64(BILD)));
  await a.sende();
  assert.equal(eigene(a.q).length, 0);
  assert.equal((await a.db.alle('schlange')).length, 1, 'bleibt liegen');
  netz = true;
  a.uhrwerk.jetzt += 60_000;
  await a.schreiber.lauf();
  assert.equal(eigene(a.q).length, 1);
  assert.deepEqual(await a.db.alle('schlange'), []);
  assert.ok([...a.q.dateien.keys()].some((p) => /attachments\/[0-9A-Z]{26}\/fenster\.png$/.test(p)));
});

test('Rückgängig legt die Anhänge zurück in den Entwurf; Einreihen leert ihn', async () => {
  const a = await aufbau();
  const entwurf = { schluessel: 'antwort/r2d4vn', wert: { text: 'meine Antwort' } };
  const anhaenge = [roh('fenster.png', BILD, 'image/png')];
  await a.db.schreibe('entwuerfe', { schluessel: 'anhaenge/antwort/r2d4vn', anhaenge });
  await a.schreiber.antworten('r2d4vn', { text: 'meine Antwort', anhaenge, entwurf });
  assert.equal(await a.db.lies('entwuerfe', 'anhaenge/antwort/r2d4vn'), undefined);
  await a.hinweise[0].rueckgaengig();
  assert.deepEqual(await a.db.alle('schlange'), []);
  assert.deepEqual((await a.db.lies('entwuerfe', 'anhaenge/antwort/r2d4vn')).anhaenge, anhaenge);
  assert.equal((await a.db.lies('entwuerfe', 'antwort/r2d4vn')).text, 'meine Antwort');
  await a.sende();
  assert.equal(eigene(a.q).length, 0);
});
