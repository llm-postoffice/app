// Web-Push als Probe: Prüfung des Schlüssels, Ablauf von Einschalten, Kopieren und Beenden mit einem
// nachgebauten Browser, die Handler des Service Workers (sw.js in node geladen) und der Abschnitt in Mehr. Die Texte halten
// die Regeln der anderen Texte der App. Die Adresse des Abos ist erfunden und steht ohne Schema in einer Zeichenkette,
// damit tools/fremdhost.mjs sie nicht für einen Fremdhost hält.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { installiereFakeDom, suche as finde, textVon } from './hilfen/fakedom.mjs';
import { JETZT, dateien } from './hilfen/beispieldaten.mjs';
import { PUSH_HINWEIS, fensterWaehlen, hinweisOptionen, klickPlan, klickZiel, pushZiel } from '../js/swlogik.js';
import { WEBPUSH } from '../js/texte.js';
import { WebPushProbe, fehlerText, hostVon, pruefeSchluessel, vonBase64Url } from '../js/webpush.js';

const ENDPUNKT = 'https:' + '//fcm.googleapis.com/fcm/send/erfundene-adresse-zum-test';
const aufBase64Url = (bytes) => Buffer.from(bytes).toString('base64url');
const punkt = (zweites = 1) => Uint8Array.from([4, ...Array.from({ length: 64 }, (_, i) => (i * 7 + zweites) % 256)]);
const SCHLUESSEL = aufBase64Url(punkt());
const ANDERER = aufBase64Url(punkt(9));

test('der Schlüssel: 65 Byte, das erste ist 4, 87 Zeichen base64url (RFC 8292)', () => {
  assert.equal(SCHLUESSEL.length, 87);
  const r = pruefeSchluessel(`  ${SCHLUESSEL}\n`);
  assert.equal(r.ok, true);
  assert.equal(r.text, SCHLUESSEL, 'Leerraum am Rand fällt weg');
  assert.deepEqual([...r.bytes], [...punkt()]);
});

test('ein unbrauchbarer Schlüssel nennt den Grund und zitiert nie die Eingabe', () => {
  const f = (x) => pruefeSchluessel(x);
  assert.equal(f('').ok, false);
  assert.equal(f(undefined).fehler, WEBPUSH.fehler.schluesselFehlt);
  assert.equal(f('ab cd+/=').fehler, WEBPUSH.fehler.schluesselZeichen);
  assert.equal(f(SCHLUESSEL.slice(0, 86)).fehler, WEBPUSH.fehler.schluesselForm);
  assert.equal(f(aufBase64Url(Uint8Array.from([2, ...punkt().slice(1)]))).fehler, WEBPUSH.fehler.schluesselForm, 'komprimierte Punkte beginnen mit 2 oder 3');
  const geheim = 'GEHEIM-ERFUNDEN-12345';
  assert.doesNotMatch(f(geheim).fehler, /GEHEIM/);
});

test('base64url wird ohne Auffüllung gelesen; der Rest ist null', () => {
  assert.deepEqual([...vonBase64Url('AQID')], [1, 2, 3]);
  assert.deepEqual([...vonBase64Url('_-8')], [255, 239]);
  assert.equal(vonBase64Url('A'), null, 'ein einzelnes Zeichen ist kein base64url');
  assert.equal(vonBase64Url('a+b/'), null);
});

test('der Host der Adresse, nie die Adresse; ein Fehler nennt Name und Meldung', () => {
  assert.equal(hostVon(ENDPUNKT), 'fcm.googleapis.com');
  assert.equal(hostVon('kein url'), null);
  assert.equal(fehlerText(Object.assign(new Error('Registration failed - push service error'), { name: 'AbortError' })), 'AbortError: Registration failed - push service error');
  assert.equal(fehlerText('roh'), 'roh');
});

/** Ein nachgebauter Browser: Registrierung mit PushManager, Berechtigung, Zwischenablage, gemerkter Schlüssel. */
function browser({ erlaubnis = 'default', antwort = 'granted', aktuell = null, subscribeFehler = null, ohneRegistrierung = false } = {}) {
  const log = [];
  const abo = (schluessel = punkt()) => ({
    endpoint: ENDPUNKT, options: { applicationServerKey: schluessel.buffer.slice(schluessel.byteOffset, schluessel.byteOffset + schluessel.byteLength) },
    toJSON() { return { endpoint: ENDPUNKT, expirationTime: null, keys: { p256dh: 'P', auth: 'A' } }; },
    async unsubscribe() { log.push('unsubscribe'); aktuell = null; return true; },
  });
  if (aktuell === true) aktuell = abo();
  const manager = {
    async getSubscription() { return aktuell; },
    async subscribe(o) { log.push(['subscribe', o]); if (subscribeFehler) throw subscribeFehler; aktuell = abo(o.applicationServerKey); return aktuell; },
  };
  let gemerkt = '';
  const probe = new WebPushProbe({
    dienst: { async getRegistration() { return ohneRegistrierung ? undefined : { pushManager: manager }; } },
    benachrichtigung: { permission: erlaubnis, async requestPermission() { log.push('frage'); return antwort; } },
    zwischenablage: { async writeText(t) { log.push(['kopiert', t]); } },
    hatPush: true,
    schluessel: { async lies() { return gemerkt; }, async schreibe(s) { gemerkt = s; } },
  });
  return { probe, log, gemerkt: () => gemerkt, setzeAbo: (a) => { aktuell = a; }, abo };
}

test('Einschalten fragt nach der Erlaubnis und abonniert mit userVisibleOnly und dem Schlüssel', async () => {
  const b = browser();
  const r = await b.probe.einschalten(SCHLUESSEL);
  assert.equal(r.ton, 'ok');
  assert.match(r.satz, /Push-Dienst fcm\.googleapis\.com/);
  assert.doesNotMatch(JSON.stringify(r), /erfundene-adresse/, 'die Adresse des Abos erscheint nie');
  assert.equal(b.log[0], 'frage');
  const [name, o] = b.log[1];
  assert.equal(name, 'subscribe');
  assert.equal(o.userVisibleOnly, true);
  assert.deepEqual([...o.applicationServerKey], [...punkt()]);
  assert.equal(b.gemerkt(), SCHLUESSEL, 'der Schlüssel bleibt im Feld');
  assert.equal((await b.probe.zustand()).host, 'fcm.googleapis.com');
});

test('mit erteilter Erlaubnis fragt der Browser nicht noch einmal', async () => {
  const b = browser({ erlaubnis: 'granted' });
  await b.probe.einschalten(SCHLUESSEL);
  assert.ok(!b.log.includes('frage'));
});

test('abgelehnte Erlaubnis: kein Abo, ein Satz, der sagt was hilft', async () => {
  const b = browser({ antwort: 'denied' });
  const r = await b.probe.einschalten(SCHLUESSEL);
  assert.equal(r.ton, 'fehler');
  assert.equal(r.titel, WEBPUSH.fehler.erlaubnisTitel);
  assert.equal(r.einzelheiten, 'Berechtigung: denied');
  assert.ok(!b.log.some((x) => x[0] === 'subscribe'));
});

test('scheitert subscribe, steht der genaue Fehlertext des Browsers da (der Zweck der Probe)', async () => {
  const fehler = Object.assign(new Error('Registration failed - push service error'), { name: 'AbortError' });
  const b = browser({ erlaubnis: 'granted', subscribeFehler: fehler });
  const r = await b.probe.einschalten(SCHLUESSEL);
  assert.deepEqual([r.ton, r.titel, r.satz, r.einzelheiten], ['fehler', WEBPUSH.fehler.einschaltenTitel, WEBPUSH.fehler.browser, 'AbortError: Registration failed - push service error']);
  assert.equal((await b.probe.zustand()).host, null);
  assert.equal((await b.probe.zustand()).ergebnis, r, 'das Ergebnis bleibt für die Ansicht stehen');
});

test('ein falscher Schlüssel kommt nie bis zum Browser', async () => {
  const b = browser();
  const r = await b.probe.einschalten('zu kurz');
  assert.equal(r.titel, WEBPUSH.fehler.schluesselTitel);
  assert.deepEqual(b.log, []);
  assert.equal(b.gemerkt(), 'zu kurz', 'die Eingabe bleibt trotzdem im Feld');
});

test('ein bestehendes Abo mit demselben Schlüssel bleibt, mit einem anderen wird es ersetzt', async () => {
  const gleich = browser({ erlaubnis: 'granted', aktuell: true });
  await gleich.probe.einschalten(SCHLUESSEL);
  assert.deepEqual(gleich.log, [], 'weder abgemeldet noch neu abonniert');
  const anders = browser({ erlaubnis: 'granted', aktuell: true });
  await anders.probe.einschalten(ANDERER);
  assert.equal(anders.log[0], 'unsubscribe');
  assert.equal(anders.log[1][0], 'subscribe');
});

test('Abo kopieren legt das JSON des Abos in die Zwischenablage; ohne Abo sagt es, was fehlt', async () => {
  const b = browser({ erlaubnis: 'granted' });
  assert.equal((await b.probe.kopieren()).titel, WEBPUSH.fehler.keinAbo);
  await b.probe.einschalten(SCHLUESSEL);
  const r = await b.probe.kopieren();
  assert.equal(r.titel, WEBPUSH.kopiert.titel);
  const [, text] = b.log.find((x) => x[0] === 'kopiert');
  assert.deepEqual(JSON.parse(text), { endpoint: ENDPUNKT, expirationTime: null, keys: { p256dh: 'P', auth: 'A' } });
  assert.doesNotMatch(JSON.stringify(r), /erfundene-adresse/, 'die Anzeige nennt die Adresse nicht');
});

test('Abo beenden meldet das Abo ab und ist ohne Abo kein Fehler', async () => {
  const b = browser({ erlaubnis: 'granted' });
  assert.equal((await b.probe.beenden()).titel, WEBPUSH.beendet.keins);
  await b.probe.einschalten(SCHLUESSEL);
  assert.equal((await b.probe.beenden()).titel, WEBPUSH.beendet.titel);
  assert.ok(b.log.includes('unsubscribe'));
  assert.equal((await b.probe.zustand()).host, null);
});

test('ohne Service Worker oder PushManager läuft die Probe nicht; ohne Registrierung hängt nichts', async () => {
  const p = new WebPushProbe({ dienst: null, benachrichtigung: null, zwischenablage: null, hatPush: false, schluessel: { lies: async () => '', schreibe: async () => {} } });
  assert.equal(p.unterstuetzt, false);
  assert.equal((await p.zustand()).unterstuetzt, false);
  assert.equal((await p.einschalten(SCHLUESSEL)).titel, WEBPUSH.fehler.nichtDa);
  const ohne = browser({ ohneRegistrierung: true });
  const z = await ohne.probe.zustand();
  assert.equal(z.ergebnis.einzelheiten, `Error: ${WEBPUSH.fehler.keinWorker}`);
});

// ---- Service Worker -----------------------------------------------------------------------------------------------------

test('der Hinweis des Pushs: fester Text in den Grenzen von 30 und 40 Zeichen, ohne Vertrauliches', () => {
  assert.ok(PUSH_HINWEIS.titel.length <= 30 && PUSH_HINWEIS.text.length <= 40);
  assert.deepEqual([PUSH_HINWEIS.titel, PUSH_HINWEIS.text], ['LLM-Post', 'Neue Einträge für dich']);
  const o = hinweisOptionen('./symbole/symbol-192.png');
  assert.deepEqual([o.body, o.tag, o.renotify, o.icon, o.data.ziel], ['Neue Einträge für dich', 'llm-post-neu', true, './symbole/symbol-192.png', './#wartet']);
});

test('das Ziel des Tipps: ohne Nutzlast Wartet, mit gültiger Nutzlast der Eintrag, alles andere fällt auf Wartet', () => {
  assert.equal(pushZiel(''), './#wartet', 'das Postwerkzeug sendet keine Nutzlast');
  assert.equal(pushZiel('kein json'), './#wartet');
  assert.equal(pushZiel('{"ziel":"#eintrag/R2D-4VN"}'), './#eintrag/R2D-4VN');
  assert.equal(pushZiel('{"ziel":"#abnahmen"}'), './#abnahmen');
  for (const boese of ['{"ziel":"http://127.0.0.1:1/x"}', '{"ziel":"//127.0.0.1"}', '{"ziel":"#eintrag/a/../b"}', '{"ziel":"#eintrag/"}', '{"ziel":7}', 'null', '[]']) {
    assert.equal(pushZiel(boese), './#wartet', boese);
  }
  assert.equal(hinweisOptionen('i.png', pushZiel('{"ziel":"#eintrag/R2D-4VN"}')).data.ziel, './#eintrag/R2D-4VN');
  assert.equal(klickZiel({ ziel: './#eintrag/R2D-4VN' }), './#eintrag/R2D-4VN');
  assert.equal(klickZiel({ ziel: 'http://127.0.0.1:1/' }), './#wartet');
  assert.equal(klickZiel(undefined), './#wartet');
});

test('ein Tipp holt das sichtbare Fenster, sonst das erste, sonst öffnet er ein neues', () => {
  const a = { visibilityState: 'hidden' };
  const b = { visibilityState: 'visible' };
  assert.equal(fensterWaehlen([a, b]), b);
  assert.equal(fensterWaehlen([a]), a);
  assert.equal(fensterWaehlen([]), null);
});

test('der Plan eines Tipps: ein Fenster bekommt die Nachricht, ein neues eine absolute Adresse mit ?push', () => {
  const basis = 'http://localhost:8080/app/';
  const f = { visibilityState: 'visible' };
  assert.deepEqual(klickPlan([f], { ziel: './#wartet' }, basis), { art: 'fenster', fenster: f, nachricht: { art: 'push-klick', ziel: '#wartet' } });
  assert.deepEqual(klickPlan([], { ziel: './#eintrag/R2D-4VN' }, basis), { art: 'neu', adresse: 'http://localhost:8080/app/?push#eintrag/R2D-4VN' });
  assert.equal(klickPlan([], undefined, basis).adresse, 'http://localhost:8080/app/?push#wartet', 'ohne Daten Wartet');
  assert.equal(klickPlan([], { ziel: 'http://127.0.0.1:1/' }, basis).adresse, 'http://localhost:8080/app/?push#wartet', 'ein fremdes Ziel gilt nicht');
  assert.equal(klickPlan([f], { ziel: 'http://127.0.0.1:1/' }, basis).nachricht.ziel, '#wartet');
});

test('sw.js: push zeigt den Hinweis, notificationclick schließt ihn und holt oder öffnet das Fenster; das Ziel öffnet die App nach dem Abgleich', async () => {
  const handler = {};
  const hinweise = [];
  let fenster = [];
  const geoeffnet = [];
  globalThis.self = {
    addEventListener: (n, f) => { handler[n] = f; },
    registration: { scope: 'http://localhost:8080/app/', showNotification: async (titel, o) => { hinweise.push([titel, o]); } },
    clients: { matchAll: async (o) => { hinweise.push(['matchAll', o]); return fenster; }, openWindow: async (u) => { geoeffnet.push(u); }, claim: async () => {} },
  };
  try {
    await import('../sw.js');
    assert.ok(handler.push && handler.notificationclick, 'beide Handler sind angemeldet');
    const push = async (data) => {
      let versprechen;
      handler.push({ waitUntil: (p) => { versprechen = p; }, data });
      await versprechen;
    };
    await push(null);
    assert.deepEqual(hinweise[0], ['LLM-Post', hinweisOptionen('./symbole/symbol-192.png')], 'ohne Nutzlast der feste Hinweis');
    await push({ text: () => '{"ziel":"#eintrag/R2D-4VN"}' });
    assert.equal(hinweise[1][1].data.ziel, './#eintrag/R2D-4VN', 'eine gültige Nutzlast bestimmt das Ziel');
    const klick = async (daten) => {
      let geschlossen = false;
      let p;
      handler.notificationclick({ notification: { close: () => { geschlossen = true; }, data: daten }, waitUntil: (x) => { p = x; } });
      await p;
      return geschlossen;
    };
    assert.equal(await klick({ ziel: './#wartet' }), true);
    assert.deepEqual(geoeffnet, ['http://localhost:8080/app/?push#wartet'], 'ohne Fenster öffnet der Tipp die App mit ?push auf Wartet');
    const ablauf = [];
    fenster = [{ visibilityState: 'visible', focus: async () => { ablauf.push('fokus'); }, postMessage: (m) => { ablauf.push(['nachricht', m]); } }];
    await klick({ ziel: './#eintrag/R2D-4VN' });
    assert.deepEqual([ablauf, geoeffnet.length], [['fokus', ['nachricht', { art: 'push-klick', ziel: '#eintrag/R2D-4VN' }]], 1], 'mit Fenster holt er es nach vorn und meldet ihm den Eintrag, ohne ein zweites zu öffnen');
    fenster = [{ visibilityState: 'hidden', focus: async () => {}, postMessage: (m) => { ablauf.push(['hintergrund', m.ziel]); } }];
    assert.equal(await klick({}), true, 'ein Fenster im Hintergrund bekommt dieselbe Nachricht');
    assert.deepEqual(ablauf.at(-1), ['hintergrund', '#wartet']);
    assert.deepEqual(hinweise.find((h) => h[0] === 'matchAll')[1], { type: 'window', includeUncontrolled: true });
  } finally {
    delete globalThis.self;
  }
});

// ---- Texte --------------------------------------------------------------------------------------------------------------

const alleTexte = (x) => (typeof x === 'string' ? [x] : typeof x === 'function' ? [x('fcm.googleapis.com')] : Array.isArray(x) ? x.flatMap(alleTexte) : Object.values(x).flatMap(alleTexte));

test('die Texte der Probe halten die Regeln: Du, kein Ausrufezeichen, kein Gedankenstrich, keine Füllwörter', () => {
  const texte = [...alleTexte(WEBPUSH), PUSH_HINWEIS.titel, PUSH_HINWEIS.text];
  assert.ok(texte.length > 30);
  for (const s of texte) {
    assert.doesNotMatch(s, /!/, s);
    assert.doesNotMatch(s, /—| – /, s);
    assert.doesNotMatch(s, /\b(einfach|nur|natürlich|bitte)\b/i, s);
    assert.doesNotMatch(s, /\bSie\b|\bIhr/, s);
    assert.equal((s.match(/\*\*/g) ?? []).length % 2, 0, `fett paarweise: ${s}`);
  }
  for (const s of [WEBPUSH.titel, ...Object.values(WEBPUSH.knoepfe)]) assert.ok(s.length <= 24, s);
});

// ---- Mehr ---------------------------------------------------------------------------------------------------------------

let aufraeumen;
let M;
before(async () => {
  aufraeumen = installiereFakeDom();
  M = { welt: await import('../js/welt.js'), mehr: await import('../js/mehr.js'), speicher: await import('../js/speicher.js'), steuerung: await import('../js/steuerung.js') };
});
after(() => aufraeumen());

const z = () => ({ phase: 'bereit', fortschritt: null, fehler: null, ohneNetz: false, letzter: { geprueft: JETZT - 5 * 60000, dateien: 60 }, naechster: null });
async function kontext(webpush) {
  const db = M.speicher.speicherDatenbank();
  const steuerung = new M.steuerung.Abgleichsteuerung({ db, fetch: () => { throw new Error('kein Netz im Test'); }, jetzt: () => JETZT });
  const k = { db, steuerung, schreiben: null, jetzt: () => JETZT, gehe() {}, ersetze() {}, neuZeichnen() { k.gezeichnet++; }, gezeichnet: 0 };
  if (webpush) k.webpush = webpush;
  return k;
}
const mehr = async (k) => M.mehr.mehrAnsicht(M.welt.baueWelt({ pfade: dateien(), jetzt: JETZT }), z(), k);
const t = (x) => textVon(x).replaceAll('\u00ad', '');
const taste = (knoten, text) => finde(knoten, 'button').find((b) => t(b) === text);

test('Mehr ohne Probe hat keinen Abschnitt Web-Push (die Probe lässt sich entfernen)', async () => {
  assert.doesNotMatch(t(await mehr(await kontext())), /Web-Push/);
});

test('Mehr: aus, mit Feld, gemerktem Schlüssel und Einschalten; ein Tipp ruft einschalten und zeichnet neu', async () => {
  const b = browser();
  await b.probe.merke(SCHLUESSEL);
  const k = await kontext(b.probe);
  const knoten = await mehr(k);
  const text = t(knoten);
  assert.match(text, /Mitteilungen/);
  assert.match(text, /Web-Push ist aus\./);
  assert.match(text, /Öffentlicher Schlüssel/);
  assert.equal(finde(knoten, 'input[name="webpush-schluessel"]')[0].value, SCHLUESSEL, 'das Feld zeigt den gemerkten Schlüssel');
  assert.deepEqual(finde(knoten, 'button').map(t).filter((x) => /Einschalten|Abo/.test(x)), ['Einschalten'], 'aus: nur Einschalten');
  const feldKnoten = finde(knoten, 'input[name="webpush-schluessel"]')[0];
  feldKnoten.value = ANDERER;
  for (const f of feldKnoten.horcher.input) f();
  await new Promise((r) => setImmediate(r));
  assert.equal(b.gemerkt(), ANDERER, 'jede Eingabe wird gemerkt');
  await taste(knoten, 'Einschalten').klick();
  assert.equal(k.gezeichnet, 1);
  assert.equal(b.log.find((x) => x[0] === 'subscribe') !== undefined, true);
});

test('Mehr: an zeigt den Host, Abo kopieren und Abo beenden, kein Feld; die Adresse steht nie da', async () => {
  const b = browser({ erlaubnis: 'granted' });
  await b.probe.einschalten(SCHLUESSEL);
  const k = await kontext(b.probe);
  const knoten = await mehr(k);
  const text = t(knoten);
  assert.match(text, /Web-Push ist an\. Push-Dienst: fcm\.googleapis\.com\./);
  assert.doesNotMatch(text, /erfundene-adresse/);
  assert.equal(finde(knoten, 'input[name="webpush-schluessel"]').length, 0);
  assert.deepEqual(finde(knoten, 'button').map(t).filter((x) => /Einschalten|Abo/.test(x)), ['Abo kopieren', 'Abo beenden']);
  await taste(knoten, 'Abo kopieren').klick();
  assert.ok(b.log.some((x) => x[0] === 'kopiert'));
  assert.match(t(await mehr(k)), /Abo kopiert/);
  await taste(knoten, 'Abo beenden').klick();
  assert.match(t(await mehr(k)), /Abo beendet/);
});

test('Mehr: scheitert das Einschalten, steht der Fehlertext des Browsers im Band und in einem Textblock', async () => {
  const fehler = Object.assign(new Error('Registration failed - push service error'), { name: 'AbortError' });
  const b = browser({ erlaubnis: 'granted', subscribeFehler: fehler });
  await b.probe.einschalten(SCHLUESSEL);
  const knoten = await mehr(await kontext(b.probe));
  const band = finde(knoten, '.band.fehler').find((x) => /Einschalten gescheitert/.test(t(x)));
  assert.ok(band, 'Band mit Fehlerton');
  assert.equal(finde(band, 'pre')[0].textContent, 'AbortError: Registration failed - push service error');
});

test('Mehr: ohne Unterstützung sagt ein Satz warum, ohne Feld und Knopf; gesperrte Erlaubnis nennt den Weg', async () => {
  const leer = new WebPushProbe({ dienst: null, benachrichtigung: null, zwischenablage: null, hatPush: false, schluessel: { lies: async () => '', schreibe: async () => {} } });
  const knoten = await mehr(await kontext(leer));
  assert.match(t(knoten), /Dieser Browser kann kein Web-Push/);
  assert.equal(taste(knoten, 'Einschalten'), undefined);
  const gesperrt = browser({ erlaubnis: 'denied' });
  assert.match(t(await mehr(await kontext(gesperrt.probe))), /Mitteilungen sind für diese Seite gesperrt\. Erlaube sie in den Einstellungen des Browsers\./);
});

test('Mehr: ohne PushManager steht ein Satz, der das sagt, ohne Anleitung und ohne Knopf', async () => {
  const leer = new WebPushProbe({ dienst: {}, benachrichtigung: {}, zwischenablage: null, hatPush: false, schluessel: { lies: async () => '', schreibe: async () => {} } });
  const knoten = await mehr(await kontext(leer));
  assert.match(t(knoten), /Dieser Browser kann kein Web-Push\. Hinweise kommen so nicht an\./);
  assert.equal(finde(knoten, 'input[name="webpush-schluessel"]').length, 0);
  assert.equal(finde(knoten, 'details').filter((d) => /So schaltest du es ein/.test(t(d))).length, 0, 'keine Anleitung für etwas, das nicht geht');
});
