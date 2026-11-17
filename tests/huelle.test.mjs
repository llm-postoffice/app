// Brücke zur Android-Hülle (js/huelle.js) ohne Hülle: ein nachgebautes Objekt `llmpost` antwortet über onmessage, ein
// Zeitgeber löst die Wartezeit von Hand aus. Belegt: Fragen und Antworten nach nr, gesammelte Nachrichten bis verbinde,
// neue Arten über einen weiteren Empfänger, das Token nur in der Hülle, der geteilte Text im Entwurf, Adressen aus Links.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Huelle, huelleVon, mitTresor, mitGeteiltem, mitGeteiltenDateien, adresseAusHuelle } from '../js/huelle.js';
import { speicherDatenbank, einstellung, setzeEinstellung } from '../js/speicher.js';
import { vertrag } from './hilfen/speichervertrag.mjs';

const TOKEN = 'tok' + 'en-1';

/** Ein nachgebautes Objekt der Hülle; `antwort(n)` gibt die Antwort auf eine Nachricht oder undefined. */
function attrappe(antwort = () => undefined) {
  const o = {
    gesendet: [],
    onmessage: null,
    postMessage(s) {
      const n = JSON.parse(s);
      o.gesendet.push(n);
      const a = antwort(n);
      if (a !== undefined) queueMicrotask(() => o.onmessage({ data: JSON.stringify(a) }));
    },
    schicke(n) { o.onmessage({ data: typeof n === 'string' ? n : JSON.stringify(n) }); },
  };
  return o;
}

/** Eine Hülle mit Tresor: merkt das Token wie die Kotlin-Seite. */
function tresorAttrappe({ setzen = 'ok' } = {}) {
  let gespeichert = null;
  return attrappe((n) => {
    if (n.art === 'token-holen') return { nr: n.nr, art: 'token', token: gespeichert };
    if (n.art === 'token-setzen') { if (setzen === 'ok') gespeichert = n.token; return { nr: n.nr, art: setzen }; }
    return undefined;
  });
}

const zaehle = (o, art) => o.gesendet.filter((n) => n.art === art).length;

test('huelleVon findet die Hülle nur mit einem Objekt, das postMessage hat', () => {
  assert.equal(huelleVon({}), null);
  assert.equal(huelleVon({ llmpost: { onmessage: null } }), null);
  assert.ok(huelleVon({ llmpost: attrappe() }) instanceof Huelle);
});

test('frage zählt nr hoch und nimmt nur die Antwort mit derselben nr', async () => {
  const o = attrappe();
  const h = new Huelle(o, { zeitgeber: { setze: () => 0, loesche() {} } });
  const erste = h.frage('token-holen');
  const zweite = h.frage('token-holen');
  assert.deepEqual(o.gesendet, [{ nr: 1, art: 'token-holen' }, { nr: 2, art: 'token-holen' }]);
  o.schicke({ nr: 9, art: 'token', token: 'x' });
  o.schicke({ nr: 2, art: 'token', token: 'b' });
  o.schicke({ nr: 1, art: 'token', token: 'a' });
  assert.equal((await erste).token, 'a');
  assert.equal((await zweite).token, 'b');
});

test('ohne Antwort lehnt frage nach der Wartezeit ab', async () => {
  const uhren = [];
  const h = new Huelle(attrappe(), { zeitgeber: { setze: (f) => { uhren.push(f); return uhren.length; }, loesche() {} } });
  const p = h.frage('token-holen');
  uhren[0]();
  await assert.rejects(p, { message: 'Die Hülle antwortet nicht.' });
});

test('speichern wartet auf den Dialog der Hülle: die Wartezeit ist der dritte Parameter, die Antwort kommt nach nr', async () => {
  const zeiten = [];
  const o = attrappe((n) => (n.art === 'speichern' ? { nr: n.nr, art: 'abgebrochen' } : undefined));
  const h = new Huelle(o, { zeitgeber: { setze: (f, ms) => { zeiten.push(ms); return 1; }, loesche() {} } });
  assert.deepEqual(await h.frage('speichern', { name: 'a.pdf', typ: 'application/pdf', daten: 'QQ==' }, 600_000), { nr: 1, art: 'abgebrochen' });
  assert.deepEqual(o.gesendet[0], { nr: 1, art: 'speichern', name: 'a.pdf', typ: 'application/pdf', daten: 'QQ==' });
  assert.deepEqual(zeiten, [600_000]);
  h.frage('token-holen');
  assert.equal(zeiten.at(-1), 5000, 'ohne dritten Parameter gilt die Wartezeit von fünf Sekunden');
});

test('Nachrichten vor verbinde kommen bei verbinde in Reihenfolge an, neue Arten über einen weiteren Empfänger', () => {
  const o = attrappe();
  const h = new Huelle(o, { zeitgeber: { setze: () => 0, loesche() {} } });
  o.schicke({ art: 'oeffnen', adresse: '#wartet' });
  o.schicke('kein json');
  o.schicke({ titel: 'ohne art' });
  o.schicke({ art: 'farben', hell: '#fff' });
  o.schicke({ art: 'teilen', titel: 'T', text: 'X' });
  const an = [];
  h.verbinde({ oeffnen: (n) => an.push(n), teilen: (n) => an.push(n) });
  assert.deepEqual(an, [{ art: 'oeffnen', adresse: '#wartet' }, { art: 'teilen', titel: 'T', text: 'X' }]);
  o.schicke({ art: 'oeffnen', adresse: '#alle' });
  assert.deepEqual(an.at(-1), { art: 'oeffnen', adresse: '#alle' });
  o.schicke({ art: 'farben', hell: '#fff' });
  assert.equal(an.length, 3);
  const farben = [];
  h.verbinde({ farben: (n) => farben.push(n) });
  o.schicke({ art: 'farben', hell: '#fff' });
  assert.deepEqual(farben, [{ art: 'farben', hell: '#fff' }]);
  h.bereit();
  assert.deepEqual(o.gesendet, [{ art: 'bereit' }]);
  h.weiter();
  assert.deepEqual(o.gesendet.at(-1), { art: 'weiter' });
});

test('mitTresor hält den Vertrag der Speicher-Schnittstelle', async () => {
  assert.deepEqual(await vertrag(mitTresor(speicherDatenbank(), new Huelle(tresorAttrappe()))), []);
});

test('die Anmeldung steht ohne Token im Speicher, das Token kommt aus der Hülle und wird einmal gefragt', async () => {
  const db = speicherDatenbank();
  const o = tresorAttrappe();
  await setzeEinstellung(mitTresor(db, new Huelle(o)), 'anmeldung', { repo: 'a/b', token: TOKEN, ablauf: null });
  assert.deepEqual(await einstellung(db, 'anmeldung'), { repo: 'a/b', ablauf: null });
  assert.deepEqual(o.gesendet.find((n) => n.art === 'token-setzen'), { token: TOKEN, nr: 1, art: 'token-setzen' });
  const frisch = new Huelle(o);
  const t = mitTresor(db, frisch);
  assert.equal((await einstellung(t, 'anmeldung')).token, TOKEN);
  assert.equal((await einstellung(t, 'anmeldung')).token, TOKEN);
  assert.equal(zaehle(o, 'token-holen'), 1);
});

test('lehnt die Hülle das Token ab, wirft schreibe und der Speicher bleibt leer', async () => {
  const db = speicherDatenbank();
  const t = mitTresor(db, new Huelle(tresorAttrappe({ setzen: 'fehler' })));
  await assert.rejects(setzeEinstellung(t, 'anmeldung', { repo: 'a/b', token: TOKEN, ablauf: null }),
    { message: 'Das Token ließ sich auf diesem Gerät nicht sicher ablegen.' });
  assert.equal(await db.zaehle('einstellungen'), 0);
});

test('ohne Token kein token-setzen, entferne löscht das Token, aendere auf der Anmeldung wirft', async () => {
  const db = speicherDatenbank();
  const o = tresorAttrappe();
  const t = mitTresor(db, new Huelle(o));
  assert.equal(await einstellung(t, 'anmeldung'), null);
  assert.equal(zaehle(o, 'token-holen'), 0);
  await setzeEinstellung(t, 'anmeldung', { repo: 'a/b', ablauf: null });
  assert.equal(zaehle(o, 'token-setzen'), 0);
  await t.entferne('einstellungen', 'anmeldung');
  assert.deepEqual(o.gesendet.at(-1), { token: null, nr: 1, art: 'token-setzen' });
  assert.equal(await db.lies('einstellungen', 'anmeldung'), undefined);
  await assert.rejects(t.aendere([{ speicher: 'einstellungen', setze: { name: 'anmeldung', wert: {} } }]),
    { message: 'Die Anmeldung geht nur über schreibe.' });
  await assert.rejects(t.aendere([{ speicher: 'einstellungen', entferne: 'anmeldung' }]));
  await t.aendere([{ speicher: 'einstellungen', setze: { name: 'geraet', wert: 'rechner-a' } }]);
  assert.equal(await einstellung(db, 'geraet'), 'rechner-a');
});

test('mitGeteiltem füllt Titel und Text und lässt alle anderen Felder', () => {
  const leer = { art: 'task', titel: '', an: 'project:alpha', text: '', rang: 2, dringend: false, prio: 'P2' };
  const e = mitGeteiltem(leer, { titel: ' Seite  mit\nUmbruch ', text: 'Text' });
  assert.equal(e.titel, 'Seite mit Umbruch');
  assert.equal(e.text, 'Text');
  for (const k of ['art', 'an', 'rang', 'dringend', 'prio']) assert.equal(e[k], leer[k]);
  assert.equal(mitGeteiltem({ ...leer, titel: 'Alt' }, { titel: 'Neu' }).titel, 'Alt');
  assert.equal(mitGeteiltem({ ...leer, text: 'Alt\n' }, { text: 'Neu' }).text, 'Alt\n\nNeu');
  assert.equal(mitGeteiltem(leer, { titel: 'x'.repeat(200) }).titel.length, 120);
  assert.equal(mitGeteiltem({}, { text: 'a' }).titel, '');
});

test('adresseAusHuelle normt bekannte Adressen, alles andere öffnet Wartet', () => {
  assert.equal(adresseAusHuelle('#eintrag/K7M-2QA'), '#eintrag/k7m2qa');
  assert.equal(adresseAusHuelle('#erfassen'), '#erfassen');
  for (const a of ['', 'javascript:alert(1)', undefined]) assert.equal(adresseAusHuelle(a), '#wartet');
});

test('teilen mit Dateien erreicht den Empfänger unverändert; Dateien ohne Text sind eine Nachricht wie jede andere', () => {
  const o = attrappe();
  const h = new Huelle(o, { zeitgeber: { setze: () => 0, loesche() {} } });
  const an = [];
  h.verbinde({ teilen: (n) => an.push(n) });
  const n = { art: 'teilen', titel: '', text: '', dateien: [{ name: 'a.pdf', typ: 'application/pdf', groesse: 1, daten: 'QQ==' }, { name: 'b.png', typ: 'image/png', groesse: 3000000, fehler: 'zu-gross' }], mehr: 1 };
  o.schicke(n);
  assert.deepEqual(an, [n]);
});

test('mitGeteiltenDateien: nichts geteilt gibt null, geteilt ergibt Anhänge und Sätze; ein vorhandener Entwurf bleibt, Sätze sammeln sich', async () => {
  assert.equal(await mitGeteiltenDateien(null, {}), null);
  assert.equal(await mitGeteiltenDateien({ anhaenge: [] }, { dateien: [], mehr: 0 }), null);
  const eins = await mitGeteiltenDateien(null, { dateien: [{ name: 'a.txt', typ: 'text/plain', groesse: 1, daten: 'eA==' }] });
  assert.deepEqual(eins.anhaenge.map((a) => a.name), ['a.txt']);
  assert.deepEqual([eins.fehler, eins.hinweise], [[], []]);
  const zwei = await mitGeteiltenDateien(eins, { dateien: [{ name: 'b.txt', typ: 'text/plain', groesse: 1, daten: 'eQ==' }, { name: 'a.txt', typ: 'text/plain', groesse: 1, daten: 'eA==' }], mehr: 0 });
  assert.deepEqual(zwei.anhaenge.map((a) => a.name), ['a.txt', 'b.txt']);
  assert.equal(zwei.fehler.length, 1);
  assert.match(zwei.fehler[0], /Eine Datei mit dem Namen a\.txt ist schon angehängt/);
  // dieselbe Ablehnung noch einmal: der Satz steht nur einmal da; ein neuer Satz kommt dazu
  const drei = await mitGeteiltenDateien(zwei, { dateien: [{ name: 'a.txt', typ: 'text/plain', groesse: 1, daten: 'eA==' }, { name: 'gross.pdf', typ: 'application/pdf', groesse: 3000000, fehler: 'zu-gross', grenze: 1048576 }] });
  assert.equal(drei.fehler.length, 2);
  assert.match(drei.fehler[1], /gross\.pdf ist 2,9 MiB groß/);
  const nurMehr = await mitGeteiltenDateien(null, { dateien: [], mehr: 4 });
  assert.deepEqual(nurMehr.anhaenge, []);
  assert.match(nurMehr.fehler[0], /4 weitere Dateien sind nicht dabei/);
});
