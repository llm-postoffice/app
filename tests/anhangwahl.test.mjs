// Dateien anhängen in Erfassen und im Blatt Antworten (js/anhangwahl.js): der Knopf, die Liste mit Größe und Entfernen, die
// Meldungen (zu groß, doppelt, über 300 KiB), der Entwurf auf dem Gerät und was die Schreibschicht bekommt.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { installiereFakeDom, suche as finde, textVon } from './hilfen/fakedom.mjs';
import { JETZT, dateien } from './hilfen/beispieldaten.mjs';
import { ANHANG_MAX, basisZuBytes } from '../js/anhaenge.js';

let aufraeumen;
let M;
before(async () => {
  aufraeumen = installiereFakeDom();
  M = { welt: await import('../js/welt.js'), wahl: await import('../js/anhangwahl.js'), erfassen: await import('../js/erfassen.js'), eintrag: await import('../js/eintrag.js'), speicher: await import('../js/speicher.js') };
});
after(() => aufraeumen());

const t = (x) => textVon(x).replaceAll('­', '');
const datei = (name, bytes, type = '') => ({ name, size: bytes.length, type, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) });
const waehle = async (x, ...dateien) => {
  const eingabe = finde(x, 'input[type="file"]')[0];
  eingabe.files = dateien;
  for (const f of eingabe.horcher.change ?? []) await f({ target: eingabe });
};
const kontext = (extra = {}) => ({ db: M.speicher.speicherDatenbank(), jetzt: () => JETZT, gehe() {}, ersetze() {}, neuZeichnen() {}, schreiben: null, ...extra });

test('Der Knopf Datei anhängen öffnet die Auswahl; die Eingabe erlaubt mehrere Dateien und bleibt unsichtbar', async () => {
  const k = kontext();
  const w = await M.wahl.anhangWahl(k, 'erfassen');
  const eingabe = finde(w.platz, 'input[type="file"]')[0];
  assert.ok(eingabe.hasAttribute('multiple'));
  assert.ok(eingabe.hidden);
  let geoeffnet = 0;
  eingabe.click = () => { geoeffnet++; };
  await finde(w.platz, 'button').find((b) => t(b) === 'Datei anhängen').klick();
  assert.equal(geoeffnet, 1);
  assert.deepEqual(w.liste(), []);
});

test('Gewählte Dateien stehen mit Größe in der Liste, Entfernen nimmt eine heraus, der Entwurf folgt auf dem Gerät', async () => {
  const k = kontext();
  const w = await M.wahl.anhangWahl(k, 'erfassen');
  await waehle(w.platz, datei('log.txt', new TextEncoder().encode('Zeile 1')), datei('bild.png', Uint8Array.from([1, 2, 3, 0, 255]), 'image/png'));
  assert.deepEqual(w.liste().map((a) => [a.name, a.groesse, a.typ]), [['log.txt', 7, 'text/plain'], ['bild.png', 5, 'image/png']]);
  assert.deepEqual([...basisZuBytes(w.liste()[1].daten)], [1, 2, 3, 0, 255]);
  assert.match(t(w.platz), /log\.txt\s*7 B/);
  assert.match(t(w.platz), /bild\.png\s*5 B/);
  assert.equal((await k.db.lies('entwuerfe', 'anhaenge/erfassen')).anhaenge.length, 2);
  await finde(w.platz, 'button').find((b) => b.getAttribute('aria-label') === 'log.txt entfernen').klick();
  assert.deepEqual(w.liste().map((a) => a.name), ['bild.png']);
  assert.match(t(w.platz), /log\.txt ist entfernt\./);
  await finde(w.platz, 'button').find((b) => b.getAttribute('aria-label') === 'bild.png entfernen').klick();
  assert.equal(await k.db.lies('entwuerfe', 'anhaenge/erfassen'), undefined, 'ohne Dateien bleibt kein Entwurf');
  assert.equal(finde(w.platz, 'li').length, 0);
});

test('Ein neuer Aufruf holt die Dateien aus dem Entwurf zurück (Zurück, Neuladen, App beendet)', async () => {
  const k = kontext();
  const erste = await M.wahl.anhangWahl(k, 'antwort/r2d4vn');
  await waehle(erste.platz, datei('a.txt', new TextEncoder().encode('x')));
  const zweite = await M.wahl.anhangWahl(k, 'antwort/r2d4vn');
  assert.deepEqual(zweite.liste().map((a) => a.name), ['a.txt']);
  assert.match(t(zweite.platz), /a\.txt/);
  await zweite.leer();
  assert.equal(await k.db.lies('entwuerfe', 'anhaenge/antwort/r2d4vn'), undefined);
});

test('Zu groß, doppelter Name und der Hinweis über 300 KiB: jede Meldung sagt, was zu tun ist; die anderen Dateien kommen trotzdem an', async () => {
  const w = await M.wahl.anhangWahl(kontext(), 'erfassen');
  await waehle(w.platz, datei('ok.txt', new Uint8Array(10)), datei('gross.bin', { length: ANHANG_MAX + 1, buffer: new ArrayBuffer(0), byteOffset: 0 }));
  assert.deepEqual(w.liste().map((a) => a.name), ['ok.txt']);
  assert.match(t(w.platz), /gross\.bin ist 1,0 MiB groß; erlaubt sind höchstens 1,0 MiB\. Verkleinere die Datei und wähle sie noch einmal\./);
  assert.match(finde(w.platz, 'p.neben')[0].getAttribute('class'), /fehler/);
  await waehle(w.platz, datei('ok.txt', new Uint8Array(10)));
  assert.match(t(w.platz), /Eine Datei mit dem Namen ok\.txt ist schon angehängt/);
  await waehle(w.platz, datei('mittel.bin', new Uint8Array(301 * 1024)));
  assert.match(t(w.platz), /mittel\.bin ist 301,0 KiB groß/);
  assert.doesNotMatch(finde(w.platz, 'p.neben')[0].getAttribute('class'), /fehler/, 'ein Hinweis ist kein Fehler');
  assert.deepEqual(w.liste().map((a) => a.name), ['ok.txt', 'mittel.bin']);
});

test('Ohne Schreibschicht ist der Knopf gesperrt', async () => {
  const w = await M.wahl.anhangWahl(kontext(), 'erfassen', { gesperrt: true });
  assert.equal(finde(w.platz, 'button')[0].disabled, true);
});

test('Erfassen: der Abschnitt steht zwischen Text und Priorität, und Anlegen gibt die Anhänge an die Schreibschicht', async () => {
  const aufrufe = [];
  const schreiben = { anlegen: async (o) => { aufrufe.push(o); return { ok: true, id: 'x' }; }, antworten: async (id, o) => { aufrufe.push({ id, ...o }); return { ok: true, id: 'y' }; } };
  const k = kontext({ schreiben });
  const welt = M.welt.baueWelt({ pfade: dateien(), jetzt: JETZT });
  const r = await M.erfassen.erfassenAnsicht(welt, { phase: 'bereit' }, k);
  const form = r.inhalt[0];
  const rubriken = finde(form, 'legend, .anhangwahl, textarea').map((x) => (x.tag === 'legend' ? t(x) : x.tag === 'textarea' ? 'Text' : 'Anhang'));
  assert.deepEqual(rubriken, ['Art', 'Text', 'Anhang', 'Priorität']);
  await waehle(form, datei('log.txt', new TextEncoder().encode('Zeile 1')));
  finde(form, 'input[name="titel"]')[0].value = 'Mit Anhang';
  finde(form, 'input[name="titel"]')[0].horcher.input[0]();
  await r.aktion[0].klick();
  assert.equal(aufrufe.length, 1);
  assert.deepEqual(aufrufe[0].anhaenge.map((a) => a.name), ['log.txt']);
});

test('Antworten: der Abschnitt steht unter dem Textfeld, und ein Tipp auf eine Möglichkeit sendet die Anhänge mit', async () => {
  const aufrufe = [];
  const schreiben = { antworten: async (id, o) => { aufrufe.push({ id, ...o }); return { ok: true, id: 'y' }; } };
  const k = kontext({ schreiben });
  const welt = M.welt.baueWelt({ pfade: dateien(), jetzt: JETZT });
  const blatt = await M.eintrag.antwortBlatt(welt, k, { id: 'r2d4vn' }, () => {});
  const wahlen = finde(blatt.koerper, 'button[data-wahl]');
  assert.ok(wahlen.length >= 2);
  assert.equal(finde(blatt.koerper, '.anhangwahl').length, 1);
  await waehle(blatt.koerper, datei('log.txt', new TextEncoder().encode('Zeile 1')));
  await wahlen[0].klick();
  assert.equal(aufrufe[0].wahl, 'A');
  assert.deepEqual(aufrufe[0].anhaenge.map((a) => a.name), ['log.txt']);
});
