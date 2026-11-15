// Neue Fassung (UOF-5): der Ablauf ohne Browser mit nachgebautem Service-Worker-Container. Belegt: kein Band beim ersten
// Besuch, Band erst mit wartendem Worker, Neu starten sendet „wechseln“, geladen wird erst nach controllerchange und nur
// einmal, nie wegen einer anderen Seite; ohne Netz fragt die App still; der Neustart löscht weder Schlange noch Entwürfe.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Aktualisierung, pruefeRegelmaessig, zeigeNeuBand } from '../js/aktualisieren.js';
import { speicherDatenbank } from '../js/speicher.js';
import { NEUE_FASSUNG, NEU_STARTET } from '../js/texte.js';

/** Ein Ziel für Ereignisse. */
class Ziel {
  constructor() { this.h = {}; }
  addEventListener(n, f) { (this.h[n] ??= []).push(f); }
  sende(n) { for (const f of this.h[n] ?? []) f(); }
}
const worker = () => Object.assign(new Ziel(), { nachrichten: [], state: 'installing', postMessage(m) { this.nachrichten.push(m); } });

function aufbau({ steuerung = true, netz = true } = {}) {
  const container = Object.assign(new Ziel(), { controller: steuerung ? {} : null });
  const reg = Object.assign(new Ziel(), { waiting: null, installing: null, aufrufe: 0, kaputt: false,
    async update() { this.aufrufe++; if (this.kaputt) throw new TypeError('Failed to fetch'); } });
  const lader = { n: 0 };
  const a = new Aktualisierung({ container, laden: () => { lader.n++; }, amNetz: () => netz });
  const verlauf = [];
  a.beiAenderung(() => verlauf.push(a.wartet));
  return { container, reg, a, lader, verlauf };
}

test('beim ersten Besuch gibt es nichts zu wechseln, auch wenn ein Worker wartet', () => {
  const { reg, a, verlauf } = aufbau({ steuerung: false });
  reg.waiting = worker();
  a.beobachte(reg);
  assert.equal(a.wartet, false);
  assert.deepEqual(verlauf, []);
});

test('eine neue Fassung wartet, sobald der neue Worker fertig installiert ist (updatefound, statechange)', () => {
  const { reg, a, verlauf } = aufbau();
  a.beobachte(reg);
  assert.equal(a.wartet, false);
  const neu = worker();
  reg.installing = neu;
  reg.sende('updatefound');
  assert.equal(a.wartet, false, 'solange sie installiert, nichts anzeigen');
  reg.installing = null; reg.waiting = neu; neu.state = 'installed';
  neu.sende('statechange');
  assert.equal(a.wartet, true);
  assert.deepEqual(verlauf, [true]);
});

test('ein schon wartender Worker beim Start wird angezeigt', () => {
  const { reg, a } = aufbau();
  reg.waiting = worker();
  a.beobachte(reg);
  assert.equal(a.wartet, true);
});

test('Neu starten sendet wechseln, lädt aber erst nach controllerchange und nur einmal', () => {
  const { reg, a, container, lader } = aufbau();
  const neu = worker(); reg.waiting = neu;
  a.beobachte(reg);
  assert.equal(a.neustart(), true);
  assert.deepEqual(neu.nachrichten, ['wechseln']);
  assert.equal(lader.n, 0, 'vor controllerchange wird nichts geladen');
  assert.equal(a.neustart(), false, 'ein zweiter Tipp sendet nichts mehr');
  container.sende('controllerchange'); container.sende('controllerchange');
  assert.equal(lader.n, 1, 'genau ein Neuladen');
});

test('wechselt eine andere Seite die Fassung, lädt diese Seite nicht von selbst neu (UOF-5: nie, während jemand schreibt)', () => {
  const { reg, a, container, lader } = aufbau();
  reg.waiting = worker();
  a.beobachte(reg);
  container.sende('controllerchange');
  assert.equal(lader.n, 0);
});

test('die erste Übernahme der Steuerung (clients.claim beim ersten Besuch) lädt nicht neu', () => {
  const { container, lader } = aufbau({ steuerung: false });
  container.sende('controllerchange');
  assert.equal(lader.n, 0);
});

test('die Prüfung fragt den Browser und bleibt ohne Netz oder bei einem Fehler still', async () => {
  const mit = aufbau();
  mit.a.beobachte(mit.reg);
  assert.equal(await mit.a.pruefe(), true);
  assert.equal(mit.reg.aufrufe, 1);
  const ohne = aufbau({ netz: false });
  ohne.a.beobachte(ohne.reg);
  assert.equal(await ohne.a.pruefe(), false);
  assert.equal(ohne.reg.aufrufe, 0, 'ohne Netz kein Aufruf');
  const kaputt = aufbau();
  kaputt.a.beobachte(kaputt.reg); kaputt.reg.kaputt = true;
  assert.equal(await kaputt.a.pruefe(), false, 'ein Fehler wirft nicht');
  assert.equal(await new Aktualisierung({ container: null }).pruefe(), false, 'ohne Registrierung nichts');
});

test('geprüft wird beim Öffnen und bei jeder Rückkehr in den Vordergrund, nicht im Hintergrund', async () => {
  const { reg, a } = aufbau();
  a.beobachte(reg);
  const dok = Object.assign(new Ziel(), { visibilityState: 'visible' });
  pruefeRegelmaessig(a, dok);
  await new Promise((r) => setImmediate(r));
  assert.equal(reg.aufrufe, 1, 'beim Öffnen');
  dok.visibilityState = 'hidden'; dok.sende('visibilitychange');
  dok.visibilityState = 'visible'; dok.sende('visibilitychange');
  await new Promise((r) => setImmediate(r));
  assert.equal(reg.aufrufe, 2, 'nur die Rückkehr zählt');
});

test('der Neustart löscht weder die Schlange noch Entwürfe, sie liegen in der Datenbank (UOF-5)', async () => {
  const db = speicherDatenbank();
  await db.schreibe('schlange', { id: 's1', zustand: 'wartet', art: 'antwort' });
  await db.schreibe('entwuerfe', { schluessel: 'erfassen', titel: 'Noch nicht fertig' });
  const { reg, a, container, lader } = aufbau();
  reg.waiting = worker(); a.beobachte(reg);
  a.neustart(); container.sende('controllerchange');
  assert.equal(lader.n, 1);
  assert.equal(await db.zaehle('schlange'), 1);
  assert.equal((await db.lies('entwuerfe', 'erfassen')).titel, 'Noch nicht fertig');
});

/** Ein Dokument mit den drei Elementen des Bands. */
function dokument() {
  const kasten = { hidden: true };
  const text = { textContent: '' };
  const knopf = { hidden: false, h: {}, addEventListener(n, f) { this.h[n] = f; } };
  return { kasten, text, knopf, getElementById: (id) => ({ neu: kasten, 'neu-text': text, 'neu-knopf': knopf })[id] };
}

test('das Band unten erscheint nur bei wartender Fassung, Neu starten geht an den Worker und der Knopf verschwindet', () => {
  const { reg, a } = aufbau();
  const d = dokument();
  zeigeNeuBand(a, d);
  assert.equal(d.kasten.hidden, true);
  const neu = worker(); reg.waiting = neu; a.beobachte(reg);
  assert.equal(d.kasten.hidden, false);
  assert.equal(d.text.textContent, NEUE_FASSUNG.satz);
  d.knopf.h.click();
  assert.deepEqual(neu.nachrichten, ['wechseln']);
  assert.equal(d.text.textContent, NEU_STARTET);
  assert.equal(d.knopf.hidden, true);
});

test('in Mehr steht das Band bei Fassung, die Snackbar unten bleibt dort weg', () => {
  const { reg, a } = aufbau();
  const d = dokument();
  const band = zeigeNeuBand(a, d);
  reg.waiting = worker(); a.beobachte(reg);
  assert.equal(d.kasten.hidden, false);
  band.ansicht('mehr');
  assert.equal(d.kasten.hidden, true);
  band.ansicht('wartet');
  assert.equal(d.kasten.hidden, false);
});
