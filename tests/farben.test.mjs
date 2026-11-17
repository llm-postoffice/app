// Systemfarben der Hülle (js/farben.js) ohne Browser: gültige Werte landen auf der Wurzel, ungültige und unbekannte Rollen
// fallen weg, ein Wechsel von hell und dunkel wirkt ohne neue Nachricht, und die Brücke reicht die Nachricht an den Empfänger.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Huelle } from '../js/huelle.js';
import { ROLLEN, Systemfarben, pruefeFarben, systemfarbenVon } from '../js/farben.js';

const hell = { akzent: '#006e18', 'auf-akzent': '#ffffff', grund: '#F8FEF7', 'hinweis-knopf': '#7cdc78' };
const dunkel = { akzent: '#7cdc78', grund: '#191d18' };

/** Eine Wurzel und eine Abfrage zum Auslösen von Hand. */
function umgebung(istDunkel = false) {
  const werte = new Map();
  const hoerer = [];
  const stil = { setProperty: (k, v) => werte.set(k, v), removeProperty: (k) => werte.delete(k) };
  const abfrage = { matches: istDunkel, addEventListener: (_, f) => hoerer.push(f) };
  return { werte, stil, abfrage, wechsle: (d) => { abfrage.matches = d; for (const f of hoerer) f(); } };
}

test('pruefeFarben behält nur gültige Werte bekannter Rollen, kleingeschrieben', () => {
  const f = pruefeFarben({ art: 'farben', hell: { ...hell, text: 'rot', linie: '#12345', neben: '#1234567', tonal: 7, boese: '#000000', frage: '#000000' }, dunkel });
  assert.deepEqual(f.hell, { akzent: '#006e18', 'auf-akzent': '#ffffff', grund: '#f8fef7', 'hinweis-knopf': '#7cdc78' });
  assert.deepEqual(f.dunkel, dunkel);
});

test('pruefeFarben gibt null, wenn nichts Gültiges dasteht', () => {
  for (const n of [null, undefined, 'x', 7, [], {}, { hell: 'rot' }, { hell: [], dunkel: null }, { hell: { akzent: 'blau' } }, { hell: { frage: '#000000' } }]) {
    assert.equal(pruefeFarben(n), null, JSON.stringify(n));
  }
});

test('die Rollen sind zwölf, ohne Arten, Zustände und Kennung', () => {
  assert.equal(ROLLEN.length, 12);
  assert.equal(new Set(ROLLEN).size, ROLLEN.length);
  for (const fest of ['frage', 'freigabe', 'abnahme', 'auftrag', 'nachricht', 'f-', 'w-', 'ok-', 'id']) assert.ok(!ROLLEN.some((r) => r.startsWith(fest)), fest);
});

test('uebernimm setzt die Variablen des Schemas, das gerade gilt', () => {
  const u = umgebung(false);
  const s = new Systemfarben({ stil: u.stil, dunkel: u.abfrage });
  assert.equal(s.uebernimm({ art: 'farben', hell, dunkel }), true);
  assert.equal(u.werte.get('--akzent'), '#006e18');
  assert.equal(u.werte.get('--grund'), '#f8fef7');
  assert.equal(u.werte.get('--text'), undefined);
});

test('ein Wechsel von hell zu dunkel wirkt ohne neue Nachricht, fehlende Rollen fallen auf app.css zurück', () => {
  const u = umgebung(false);
  const s = new Systemfarben({ stil: u.stil, dunkel: u.abfrage });
  s.uebernimm({ hell, dunkel });
  u.wechsle(true);
  assert.equal(u.werte.get('--akzent'), '#7cdc78');
  assert.equal(u.werte.get('--grund'), '#191d18');
  assert.equal(u.werte.has('--auf-akzent'), false, 'im Dunkel fehlt auf-akzent: der feste Wert aus app.css gilt');
  u.wechsle(false);
  assert.equal(u.werte.get('--auf-akzent'), '#ffffff');
});

test('eine ungültige Nachricht ändert nichts, eine spätere gültige ersetzt die alte', () => {
  const u = umgebung(false);
  const s = new Systemfarben({ stil: u.stil, dunkel: u.abfrage });
  assert.equal(s.uebernimm({ hell: { akzent: 'blau' } }), false);
  assert.equal(u.werte.size, 0);
  s.uebernimm({ hell });
  assert.equal(s.uebernimm({ hell: { akzent: 'zwei' } }), false);
  assert.equal(u.werte.get('--akzent'), '#006e18');
  s.uebernimm({ hell: { akzent: '#974900' } });
  assert.equal(u.werte.get('--akzent'), '#974900');
  assert.equal(u.werte.has('--grund'), false);
});

test('systemfarbenVon braucht Wurzel und Abfrage, sonst null', () => {
  assert.equal(systemfarbenVon({}), null);
  assert.equal(systemfarbenVon({ document: { documentElement: { style: {} } } }), null);
  const u = umgebung();
  assert.ok(systemfarbenVon({ document: { documentElement: { style: u.stil } }, matchMedia: () => u.abfrage }) instanceof Systemfarben);
});

test('die Brücke reicht die Art farben an ihren Empfänger, auch eine vor verbinde gesammelte', () => {
  const o = { postMessage() {}, onmessage: null };
  const h = new Huelle(o);
  o.onmessage({ data: JSON.stringify({ art: 'farben', hell }) });
  const u = umgebung();
  const s = new Systemfarben({ stil: u.stil, dunkel: u.abfrage });
  h.verbinde({ farben: (m) => s.uebernimm(m) });
  assert.equal(u.werte.get('--akzent'), '#006e18');
  o.onmessage({ data: JSON.stringify({ art: 'farben', hell: { akzent: '#974900' } }) });
  assert.equal(u.werte.get('--akzent'), '#974900');
  o.onmessage({ data: '{"art":"farben","hell":' });   // kein JSON
  o.onmessage({ data: JSON.stringify({ art: 'farben', hell: { akzent: 'kaputt' } }) });
  assert.equal(u.werte.get('--akzent'), '#974900');
});
