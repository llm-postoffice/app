// Der Abschnitt Anhänge am Eintrag in einem winzigen DOM (hilfen/fakedom.mjs): Überschrift mit Zahl, Zeilen zum Aufklappen,
// Bild, Text, Datei, die Zustände (lädt, ohne Netz, zu groß, Token) und Herunterladen über die Hülle; fremder Text bleibt Text.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { installiereFakeDom, suche as finde, textVon } from './hilfen/fakedom.mjs';
import { JETZT, dateien } from './hilfen/beispieldaten.mjs';
import { bytesZuBasis } from '../js/anhaenge.js';

let aufraeumen;
let M;
before(async () => {
  aufraeumen = installiereFakeDom();
  M = { welt: await import('../js/welt.js'), eintrag: await import('../js/eintrag.js'), speicher: await import('../js/speicher.js') };
});
after(() => aufraeumen());

const t = (x) => textVon(x).replaceAll('\u00ad', '');
const PNG = bytesZuBasis(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2]));
const TEXT = bytesZuBasis(new TextEncoder().encode('Zeile <b>1</b>\nZeile 2\n'));

function weltMit() {
  const pfade = dateien();
  const nachtrag = [...pfade.keys()].find((p) => p.startsWith('entries/r2/r2d4vn/') && p.endsWith('-addendum.md')).split('/').pop().split('-')[0];
  const baum = {
    sha: 'x', etag: null, eintraege: [],
    anhaenge: [
      { id: 'r2d4vn', ulid: null, name: 'fenster.png', sha: 'a'.repeat(40), groesse: 150_000 },
      { id: 'r2d4vn', ulid: nachtrag, name: 'messung.txt', sha: 'b'.repeat(40), groesse: 24 },
      { id: 'r2d4vn', ulid: null, name: 'bericht.pdf', sha: 'c'.repeat(40), groesse: 420_000 },
    ],
  };
  return M.welt.baueWelt({ pfade, baum, jetzt: JETZT });
}
const daten = { [`a`.repeat(40)]: PNG, [`b`.repeat(40)]: TEXT, [`c`.repeat(40)]: bytesZuBasis(Uint8Array.from([0x25, 0x50, 0x44, 0x46])) };
const kontext = (extra = {}) => ({
  db: M.speicher.speicherDatenbank(), jetzt: () => JETZT, gehe() {}, ersetze() {}, neuZeichnen() {}, schreiben: null,
  anhaenge: { inhalt: async (a) => ({ ok: true, daten: daten[a.sha], vomGeraet: false }) }, ...extra,
});
const abschnitt = async (k) => {
  const r = await M.eintrag.eintragAnsicht(weltMit(), { phase: 'bereit' }, k, { id: 'r2d4vn' });
  return r.inhalt;
};
const zeilen = (x) => finde(x, 'li.anhang');
const kopf = (zeile) => finde(zeile, 'button.anhang-kopf')[0];

test('Ein Eintrag mit drei Anhängen: Überschrift mit Zahl, drei geschlossene Zeilen mit Name, Größe, Art und Herkunft', async () => {
  const x = await abschnitt(kontext());
  assert.ok(finde(x, 'h2').some((h) => t(h) === 'Anhänge (3)'));
  const z = zeilen(x);
  assert.equal(z.length, 3);
  assert.match(t(z[0]), /bericht\.pdf\s*410,2 KiB · PDF · vom Eintrag/);
  assert.match(t(z[1]), /fenster\.png\s*146,5 KiB · Bild · vom Eintrag/);
  assert.match(t(z[2]), /messung\.txt\s*24 B · Text · vom Nachtrag von \d\d:\d\d/);
  for (const zeile of z) {
    assert.equal(kopf(zeile).getAttribute('aria-expanded'), 'false');
    assert.equal(finde(zeile, '.anhang-inhalt')[0].hidden, true);
  }
});

test('Ein Eintrag ohne Anhänge hat keinen Abschnitt', async () => {
  const r = await M.eintrag.eintragAnsicht(M.welt.baueWelt({ pfade: dateien(), jetzt: JETZT }), { phase: 'bereit' }, kontext(), { id: 'r2d4vn' });
  assert.ok(!finde(r.inhalt, 'h2').some((h) => /Anhänge/.test(t(h))));
});

test('Aufklappen: ein Bild erscheint als data-Adresse mit Beschreibung, nichts davon vorher geladen', async () => {
  let geladen = 0;
  const k = kontext({ anhaenge: { inhalt: async (a) => { geladen++; return { ok: true, daten: daten[a.sha] }; } } });
  const z = zeilen(await abschnitt(k))[1];
  assert.equal(geladen, 0);
  await kopf(z).klick();
  assert.equal(geladen, 1);
  assert.equal(kopf(z).getAttribute('aria-expanded'), 'true');
  const bild = finde(z, 'img.anhang-bild')[0];
  assert.match(bild.getAttribute('src'), /^data:image\/png;base64,/);
  assert.equal(bild.getAttribute('alt'), 'fenster.png');
  assert.ok(finde(z, 'button').some((b) => t(b) === 'Herunterladen'));
  await kopf(z).klick();
});

test('Text steht als Text im Baum, auch wenn er wie HTML aussieht; andere Dateien bekommen nur Herunterladen', async () => {
  const x = await abschnitt(kontext());
  const [pdf, , txt] = zeilen(x);
  await kopf(txt).klick();
  const pre = finde(txt, 'pre.anhang-text')[0];
  assert.equal(pre.textContent, 'Zeile <b>1</b>\nZeile 2\n');
  assert.equal(finde(finde(txt, '.anhang-inhalt'), 'b').length, 0, 'kein Element aus dem Text');
  await kopf(pdf).klick();
  assert.equal(finde(pdf, 'pre, img').length, 0);
  assert.match(t(pdf), /zeigt die App nicht an/);
  assert.ok(finde(pdf, 'button').some((b) => t(b) === 'Herunterladen'));
  await kopf(pdf).klick();
  await kopf(txt).klick();
});

test('Zuklappen und noch einmal aufklappen lädt aus dem Speicher des Holers, nicht neu; die Zeile bleibt nach dem Neuzeichnen offen', async () => {
  const x = await abschnitt(kontext());
  const z = zeilen(x)[1];
  await kopf(z).klick();
  await kopf(z).klick();
  assert.equal(kopf(z).getAttribute('aria-expanded'), 'false');
  await kopf(z).klick();
  const neu = zeilen(await abschnitt(kontext())).find((zz) => /fenster/.test(t(zz)));
  assert.equal(kopf(neu).getAttribute('aria-expanded'), 'true', 'geöffnete Zeilen merkt sich die Seite');
  await kopf(neu).klick();   // zuklappen räumt auf
});

test('Zustände: ohne Netz sagt, was hilft, zu groß nennt die Grenze, Token abgelaufen führt zur Anmeldung, jeder Fehler hat Erneut versuchen', async () => {
  const fall = async (r) => {
    const z = zeilen(await abschnitt(kontext({ anhaenge: { inhalt: async () => r } })))[1];
    await kopf(z).klick();
    await kopf(z).klick();   // wieder zu, damit die Zeile für den nächsten Fall nicht offen bleibt
    return z;
  };
  const netz = await fall({ ok: false, art: 'netz' });
  assert.match(t(netz), /Ohne Netz/);
  assert.match(t(netz), /Öffne ihn einmal mit Netz, danach bleibt er hier/);
  assert.ok(finde(netz, 'button').some((b) => t(b) === 'Erneut versuchen'));
  const gross = await fall({ ok: false, art: 'zu-gross' });
  assert.match(t(gross), /Zu groß für die App/);
  assert.match(t(gross), /höchstens 1,0 MiB/);
  const token = await fall({ ok: false, art: 'token' });
  assert.ok(finde(token, 'a').some((a) => a.getAttribute('href') === '#anmelden'));
  const andere = await fall({ ok: false, art: 'antwort', status: 503 });
  assert.match(t(andere), /Status 503/);
  assert.ok(finde(andere, 'button').some((b) => t(b) === 'Erneut versuchen'));
});

test('Erneut versuchen lädt noch einmal und zeigt dann den Inhalt', async () => {
  let n = 0;
  const k = kontext({ anhaenge: { inhalt: async (a) => (++n === 1 ? { ok: false, art: 'netz' } : { ok: true, daten: daten[a.sha] }) } });
  const z = zeilen(await abschnitt(k))[2];
  await kopf(z).klick();
  await finde(z, 'button').find((b) => t(b) === 'Erneut versuchen').klick();
  assert.equal(finde(z, 'pre.anhang-text').length, 1);
  await kopf(z).klick();
});

test('Herunterladen in der Hülle: Nachricht speichern mit Name, Typ und Base64; ok, abgebrochen und Fehler bekommen je ein Wort', async () => {
  const gesendet = [];
  const antworten = [{ art: 'ok' }, { art: 'abgebrochen' }, { art: 'fehler' }];
  const huelle = { frage: async (art, d, warte) => { gesendet.push({ art, d, warte }); return antworten.shift(); } };
  const z = zeilen(await abschnitt(kontext({ huelle })))[0];
  await kopf(z).klick();
  const laden = finde(z, 'button').find((b) => t(b) === 'Herunterladen');
  await laden.klick();
  assert.deepEqual(gesendet[0].d, { name: 'bericht.pdf', typ: 'application/pdf', daten: daten['c'.repeat(40)] });
  assert.equal(gesendet[0].art, 'speichern');
  assert.ok(gesendet[0].warte >= 60_000, 'der Dialog wartet auf den Nutzer');
  assert.match(t(z), /Gespeichert\./);
  await laden.klick();
  assert.match(t(z), /Nicht gespeichert\./);
  await laden.klick();
  assert.match(t(z), /Speichern ging nicht\. Versuche es noch einmal\./);
  assert.equal(laden.disabled, false, 'der Knopf ist danach wieder frei');
  await kopf(z).klick();
});
