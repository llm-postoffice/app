// Ein Tipp auf die Web-Push-Mitteilung gleicht zuerst ab und öffnet dann das Ziel (js/pushklick.js): die drei Lagen der App,
// geschlossen (neues Fenster mit ?push), im Hintergrund und offen (Nachricht an das Fenster), dazu der Text, wenn der Eintrag auch
// nach dem Abgleich fehlt.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dateien, eintraege, JETZT } from './hilfen/beispieldaten.mjs';
import { baueWelt, wartetListe } from '../js/welt.js';
import { folgeTipp, idsVon, kamDurchTipp, tippZiel } from '../js/pushklick.js';
import { gueltigesZiel, klickPlan, zielAusNachricht } from '../js/swlogik.js';

const alle = eintraege();
const OHNE = 'q7w2de';   // eine Freigabe an dich: der Eintrag, den der Push meldet
const stand = (liste) => baueWelt({ pfade: dateien(liste), jetzt: JETZT });
const vorherWelt = () => stand(alle.filter((x) => x.id !== OHNE));

/** Ein Gerät, dessen Abgleich den neuen Eintrag holt; `reihenfolge` hält fest, was wann geschah. */
function geraet({ abgleichGelingt = true } = {}) {
  let aktuell = vorherWelt();
  const reihenfolge = [];
  return {
    reihenfolge,
    parameter: (ziel, vorher = null) => ({
      ziel, vorher,
      abgleichen: async () => { reihenfolge.push('abgleich'); if (abgleichGelingt) aktuell = stand(alle); },
      ladeWelt: async () => aktuell,
      oeffne: (a) => { reihenfolge.push(['oeffne', a, aktuell.eintraege.has(OHNE)]); },
    }),
  };
}

test('?push in der Adresse kennzeichnet ein Fenster, das ein Tipp geöffnet hat', () => {
  assert.equal(kamDurchTipp('?push'), true);
  assert.equal(kamDurchTipp(''), false);
  assert.equal(kamDurchTipp(undefined), false);
  assert.equal(kamDurchTipp('?x=1'), false);
});

test('das Ziel: eine Nutzlast gilt, ohne sie der neueste neue Eintrag an dich, sonst Wartet', () => {
  const vorher = idsVon(vorherWelt());
  assert.equal(tippZiel(stand(alle), vorher, '#eintrag/r2d4vn'), '#eintrag/r2d4vn', 'die Nutzlast bestimmt');
  assert.equal(tippZiel(stand(alle), vorher, '#abnahmen'), '#abnahmen');
  assert.equal(tippZiel(stand(alle), vorher, '#wartet'), `#eintrag/${OHNE}`, 'ohne Nutzlast der neue Eintrag');
  assert.equal(tippZiel(stand(alle), idsVon(stand(alle)), '#wartet'), '#wartet', 'nichts Neues: Wartet');
  assert.equal(tippZiel(vorherWelt(), vorher, '#wartet'), '#wartet', 'der Abgleich brachte nichts: Wartet');
});

test('bei mehreren neuen Einträgen gewinnt der neueste, und Ideen an dich zählen nicht', () => {
  const vorher = new Set();   // ein Gerät ohne Stand: alles ist neu
  const w = stand(alle);
  const ziel = tippZiel(w, vorher, '#wartet');
  assert.ok(wartetListe(w).length > 2);
  const neuester = [...wartetListe(w)].sort((a, b) => b.st.created - a.st.created)[0].e.id;
  assert.equal(ziel, `#eintrag/${neuester}`);
  assert.doesNotMatch(ziel, /b3cyxm|x4pn8d|m8hq2s|z6bt3f/, 'eine Idee an dich ist kein Eintrag, auf den du wartest');
});

test('App geschlossen: das neue Fenster kennt den Stand vor dem Abgleich, gleicht ab und steht dann auf dem Eintrag', async () => {
  const g = geraet();
  const plan = klickPlan([], { ziel: './#wartet' }, 'http://localhost:8080/app/');
  assert.equal(plan.art, 'neu');
  assert.equal(kamDurchTipp(new URL(plan.adresse).search), true);
  const ziel = gueltigesZiel(new URL(plan.adresse).hash);
  const adresse = await folgeTipp(g.parameter(ziel, idsVon(vorherWelt())));
  assert.equal(adresse, `#eintrag/${OHNE}`);
  assert.deepEqual(g.reihenfolge, ['abgleich', ['oeffne', `#eintrag/${OHNE}`, true]], 'zuerst abgleichen, dann öffnen, und der Eintrag liegt dann vor');
});

test('App im Hintergrund: die Nachricht an das Fenster löst denselben Weg aus, mit der Nutzlast der Mitteilung', async () => {
  const g = geraet();
  const f = { visibilityState: 'hidden' };
  const plan = klickPlan([f], { ziel: `./#eintrag/${OHNE}` }, 'http://localhost:8080/app/');
  assert.equal(plan.art, 'fenster');
  const ziel = zielAusNachricht(plan.nachricht);
  assert.equal(ziel, `#eintrag/${OHNE}`);
  await folgeTipp(g.parameter(ziel));
  assert.deepEqual(g.reihenfolge, ['abgleich', ['oeffne', `#eintrag/${OHNE}`, true]], 'auch mit Nutzlast zuerst abgleichen');
});

test('App offen auf einer anderen Ansicht: ohne Nutzlast findet der Tipp den neuen Eintrag selbst', async () => {
  const g = geraet();
  const plan = klickPlan([{ visibilityState: 'visible' }], undefined, 'http://localhost:8080/app/');
  const adresse = await folgeTipp(g.parameter(zielAusNachricht(plan.nachricht)));
  assert.equal(adresse, `#eintrag/${OHNE}`);
  assert.equal(g.reihenfolge[0], 'abgleich');
});

test('scheitert der Abgleich, öffnet das Ziel trotzdem; ohne Anmeldung öffnet nichts', async () => {
  const g = geraet({ abgleichGelingt: false });
  assert.equal(await folgeTipp(g.parameter(`#eintrag/${OHNE}`)), `#eintrag/${OHNE}`, 'die Ansicht des Eintrags sagt dann, warum er fehlt');
  assert.deepEqual(g.reihenfolge, ['abgleich', ['oeffne', `#eintrag/${OHNE}`, false]]);
  const h = geraet();
  assert.equal(await folgeTipp({ ...h.parameter('#wartet'), gesperrt: () => true }), null);
  assert.deepEqual(h.reihenfolge, ['abgleich']);
});

test('eine Nachricht, die kein Tipp ist, oder ein fremdes Ziel öffnet nichts Fremdes', () => {
  assert.equal(zielAusNachricht({ art: 'wechseln' }), null);
  assert.equal(zielAusNachricht(undefined), null);
  assert.equal(zielAusNachricht({ art: 'push-klick', ziel: 'http://127.0.0.1:1/' }), '#wartet');
  assert.equal(gueltigesZiel('#eintrag/a/../b'), '#wartet');
});
