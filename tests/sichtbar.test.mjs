// Abgleich und Sendungen zeigen ihren Stand: Fristen, das Band und die Seite der Warteschlange, die Zeilen „Zuletzt abgeglichen“.
// Uhr und Zeitgeber sind Parameter; nichts läuft von selbst.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { installiereFakeDom, suche as finde, textVon } from './hilfen/fakedom.mjs';
import { JETZT, dateien, schlangeWeiter } from './hilfen/beispieldaten.mjs';

let aufraeumen;
let M;
before(async () => {
  aufraeumen = installiereFakeDom();
  M = { welt: await import('../js/welt.js'), ansichten: await import('../js/ansichten.js'), schlange: await import('../js/schlange.js'),
    texte: await import('../js/ansichtstexte.js'), frist: await import('../js/frist.js'), dom: await import('../js/dom.js') };
});
after(() => aufraeumen());

const welt = (schlange) => M.welt.baueWelt({ pfade: dateien(), jetzt: JETZT, schlange });
const z = (teil = {}) => ({ phase: 'bereit', fortschritt: null, fehler: null, ohneNetz: false, letzter: { geprueft: JETZT - 5 * 60000, dateien: 60 }, naechster: null, fertig: true, ...teil });
const t = (x) => textVon(x).replaceAll('­', '');
const kontext = () => ({ jetzt: () => JETZT, schreiben: {}, neuZeichnen() {}, ersetze() {}, meldung: () => true });
/** Die Zeilen unter der Zahl als Text: jede Zeile in ein p gebaut, wie uebersicht() es tut. */
const zeilen = (liste) => liste.map((x) => t(M.dom.el('p', {}, x)));

test('Fristen: unter einer Minute in 5-Sekunden-Schritten, dann Minuten, dann Stunden; null heißt gleich', () => {
  const f = M.frist.fristText;
  assert.equal(f(-5), 'gleich');
  assert.equal(f(0), 'gleich');
  assert.equal(f(1), 'in etwa 5 s');
  assert.equal(f(41_000), 'in etwa 45 s');
  assert.equal(f(55_000), 'in etwa 55 s');
  assert.equal(f(58_000), 'in etwa 1 min');
  assert.equal(f(120_000), 'in etwa 2 min');
  assert.equal(f(121_000), 'in etwa 3 min');
  assert.equal(f(3_600_000), 'in etwa 1 Std');
});

test('Fristen laufen über Uhr und Zeitgeber: ohne Takt bleibt der Text stehen, mit ihm ändert sich nur der Text', () => {
  const e = { text: 'in etwa 40 s', attr: String(JETZT + 40_000), getAttribute() { return this.attr; }, get textContent() { return this.text; }, set textContent(v) { this.text = v; } };
  const wurzel = { querySelectorAll: (s) => (s === '[data-bis]' ? [e] : []) };
  let jetzt = JETZT;
  const geplant = [];
  const stopp = M.frist.starteFristen(wurzel, { jetzt: () => jetzt, zeitgeber: { setze: (f, ms) => { geplant.push([f, ms]); return geplant.length; }, loesche: (n) => geplant.push(['loesche', n]) } });
  assert.equal(geplant.length, 1);
  assert.equal(geplant[0][1], 1000);
  assert.equal(e.text, 'in etwa 40 s', 'vor dem ersten Takt ändert sich nichts');
  jetzt += 12_000;
  geplant[0][0]();
  assert.equal(e.text, 'in etwa 30 s');
  assert.equal(geplant.length, 2, 'der nächste Takt ist geplant');
  jetzt += 40_000;
  geplant[1][0]();
  assert.equal(e.text, 'gleich');
  stopp();
  assert.deepEqual(geplant.at(-1), ['loesche', 3]);
});

test('Band: wird gesendet, die anderen gehen gleich raus', () => {
  const band = M.schlange.schlangeBandKnoten(welt(schlangeWeiter().sendet), z());
  assert.match(t(band), /3 Sendungen noch nicht gesendet/);
  assert.match(t(band), /Eine wird gerade gesendet … 2 gehen gleich raus\./);
});

test('Band: nächster Versuch mit laufender Frist', () => {
  const band = M.schlange.schlangeBandKnoten(welt(schlangeWeiter().versuch), z());
  assert.match(t(band), /2 Sendungen noch nicht gesendet/);
  assert.match(t(band), /2 warten auf einen neuen Versuch\. Nächster Versuch in etwa 40 s\./);
  const frist = finde(band, '[data-bis]');
  assert.equal(frist.length, 1);
  assert.equal(frist[0].getAttribute('data-bis'), String(JETZT + 40_000));
});

test('Band: eben gesendet nennt die Uhrzeit und sagt, dass noch abgeglichen wird; danach verschwindet es', () => {
  const raus = schlangeWeiter().raus;
  const band = M.schlange.schlangeBandKnoten(welt(raus), z());
  assert.match(t(band), /2 Sendungen gesendet um 14:06/);
  assert.match(t(band), /Die App gleicht noch einmal ab\./);
  assert.match(band.getAttribute('class'), /ok/);
  assert.match(t(M.schlange.schlangeBandKnoten(welt([raus[1]]), z())), /Gesendet um 14:06/);
  const alt = welt(raus.map((s) => ({ ...s, zeit: JETZT - 61_000 })));
  assert.equal(M.schlange.schlangeBandKnoten(alt, z()), null, 'nach einer Minute zeigt eine liegengebliebene Sendung nichts mehr');
});

test('Eine frische Sendung ohne Wartezeit zeigt kein Band, auch nicht beim Senden und danach', () => {
  for (const zustand of ['sendet', 'gesendet']) {
    const s = { id: 'f1', eintrag: 'r2d4vn', art: 'antwort', wahl: 'A', zustand, zeit: JETZT - 1000 };
    assert.equal(M.schlange.schlangeBandKnoten(welt([s]), z()), null, zustand);
  }
  const bereit = { id: 'f2', eintrag: 'r2d4vn', art: 'antwort', wahl: 'A', zustand: 'liegt', zeit: JETZT - 20_000, sendenAb: JETZT - 10_000 };
  assert.equal(M.schlange.schlangeBandKnoten(welt([bereit]), z()), null);
});

test('Seite: jede Sendung nennt ihren Zustand in Worten mit Frist oder Uhrzeit', () => {
  const sicht = (liste) => finde(M.schlange.schlangeAnsicht(welt(liste), z(), kontext()), '.sendung').map(t);
  const a = sicht(schlangeWeiter().sendet);
  assert.equal(a.length, 3);
  assert.match(a[0], /Wird gesendet …/);
  assert.match(a[1], /Geht gleich raus/);
  const b = sicht(schlangeWeiter().versuch);
  assert.match(b[0], /Nächster Versuch in etwa 40 s/);
  assert.match(b[0], /GitHub antwortet mit Status 503\./);
  const c = sicht(schlangeWeiter().raus);
  assert.match(c[0], /Gesendet um 14:06/);
  const netz = M.schlange.schlangeAnsicht(welt([{ id: 'n1', eintrag: 'r2d4vn', art: 'antwort', wahl: 'A', zustand: 'liegt', zeit: JETZT, warteArt: 'netz', gewartet: true }]), z({ ohneNetz: true }), kontext());
  assert.match(t(netz), /Wartet auf Netz, geht raus, sobald du online bist/);
});

test('Zeilen unter der Zahl: Abgleich läuft, nächster Abgleich mit Frist, ohne Netz, Fehler, nur von Hand', () => {
  const s = (zst) => zeilen(M.ansichten.standZeile(zst, JETZT));
  assert.deepEqual(s(z({ phase: 'laeuft' })), ['Gleicht gerade ab …', 'Zuletzt abgeglichen um 14:02']);
  assert.deepEqual(s(z({ naechster: JETZT + 120_000 })), ['Abgeglichen um 14:02', 'Nächster Abgleich in etwa 2 min']);
  assert.deepEqual(s(z({ ohneNetz: true, phase: 'fehler' })), ['Zuletzt abgeglichen um 14:02', 'Beim nächsten Netz gleicht die App ab.']);
  assert.deepEqual(s(z({ phase: 'laeuft', ohneNetz: true })), ['Gleicht gerade ab …', 'Zuletzt abgeglichen um 14:02'], 'mit Netz läuft der Abgleich, auch wenn der letzte am Netz scheiterte');
  assert.deepEqual(s(z({ phase: 'fehler', naechster: JETZT + 60_000 })), ['Stand von 14:02, seitdem nicht abgeglichen', 'Nächster Versuch in etwa 1 min']);
  assert.deepEqual(s(z({ phase: 'fehler' })), ['Stand von 14:02, seitdem nicht abgeglichen']);
  assert.deepEqual(s(z()), ['Abgeglichen um 14:02', 'Der nächste Abgleich läuft nur von Hand.']);
  assert.deepEqual(s(z({ fertig: false })), ['Abgeglichen um 14:02'], 'vor dem ersten Abgleich dieser Sitzung steht noch kein Satz über den nächsten');
  assert.deepEqual(M.ansichten.standZeile(z({ letzter: null }), JETZT), []);
});

test('Karten: nächster Versuch steht mit Uhrzeit in der Zeile', () => {
  const s = schlangeWeiter().versuch[0];
  assert.equal(M.texte.schlangeZeile(s, { jetzt: JETZT }).text, 'Antwort „A“ noch nicht gesendet, nächster Versuch um 14:07');
});
