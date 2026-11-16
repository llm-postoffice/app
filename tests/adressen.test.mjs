import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BEREICHE, blattTitelVon, hatZurueck, idMitStrich, normId, parse, stapelUnter, titelVon } from '../js/adressen.js';

const ID = '9f3k2a';

test('die fünf Hauptbereiche stehen in der Reihenfolge der Leiste', () => {
  assert.deepEqual(BEREICHE, ['wartet', 'alle', 'abnahmen', 'erfassen', 'mehr']);
});

// Adresse, Ansicht, Bereich in der Leiste, Stapel darunter: Entwurf (Navigation) und Nachtrag (Adressen)
const TABELLE = [
  ['#wartet', 'wartet', 'wartet', []],
  ['#alle', 'alle', 'alle', ['#wartet']],
  ['#alle/projekt', 'alle', 'alle', ['#wartet', '#alle']],
  ['#alle/sortieren', 'alle', 'alle', ['#wartet', '#alle']],
  ['#abnahmen', 'abnahmen', 'abnahmen', ['#wartet']],
  ['#erfassen', 'erfassen', 'erfassen', ['#wartet']],
  ['#mehr', 'mehr', 'mehr', ['#wartet']],
  ['#eingang', 'eingang', 'wartet', ['#wartet']],
  [`#eintrag/${ID}`, 'eintrag', 'wartet', ['#wartet']],
  [`#eintrag/${ID}/schritt/3`, 'schritt', 'wartet', ['#wartet', `#eintrag/${ID}`]],
  [`#eintrag/${ID}/einsortieren`, 'eintrag', 'wartet', ['#wartet', '#eingang', `#eintrag/${ID}`]],
  ['#ideen', 'ideen', 'mehr', ['#wartet', '#mehr']],
  ['#mehr/geraet', 'mehr', 'mehr', ['#wartet', '#mehr']],
  ['#suche', 'suche', 'wartet', ['#wartet']],
  ['#anmelden', 'anmelden', null, []],
  [`#eintrag/${ID}/antworten`, 'eintrag', 'wartet', ['#wartet', `#eintrag/${ID}`]],
  [`#eintrag/${ID}/ergebnis`, 'ergebnis', 'wartet', ['#wartet', `#eintrag/${ID}`]],
  [`#eintrag/${ID}/schritt/3/fail`, 'schritt', 'wartet', ['#wartet', `#eintrag/${ID}`, `#eintrag/${ID}/schritt/3`]],
];

for (const [adresse, ansicht, bereich, unter] of TABELLE) {
  test(`${adresse}: Ansicht ${ansicht}, Bereich ${bereich}, Stapel darunter ${unter.join(' ') || 'leer'}`, () => {
    const o = parse(adresse);
    assert.equal(o.ansicht, ansicht);
    assert.equal(o.bereich, bereich);
    assert.equal(o.adresse, adresse);
    assert.deepEqual(stapelUnter(o), unter);
  });
}

test('unbekannte oder kaputte Adressen ergeben null', () => {
  for (const a of ['', '#', '#gibtesnicht', '#eintrag', '#eintrag/', '#eintrag/a/b', `#eintrag/${ID}/schritt/0`, `#eintrag/${ID}/schritt/x`, '#wartet/x', 'wartet', '#eintrag/<script>']) {
    assert.equal(parse(a), null, a);
  }
  assert.equal(parse(undefined), null);
});

test('eine ID in der Adresse wird ohne Strich und klein geschrieben', () => {
  assert.equal(parse('#eintrag/9F3-K2A').id, ID);
  assert.equal(parse('#eintrag/9F3-K2A').adresse, `#eintrag/${ID}`);
  assert.equal(normId('K7M-2QA'), 'k7m2qa');
});

test('die ID wird mit Strich nach drei Zeichen gezeigt, andere Längen bleiben', () => {
  assert.equal(idMitStrich('k7m2qa'), 'k7m-2qa');
  assert.equal(idMitStrich('k7m-2qa'), 'k7m-2qa');
  assert.equal(idMitStrich('abc'), 'abc');
});

test('Titel der oberen Leiste haben höchstens 20 Zeichen (UTX-3)', () => {
  for (const [adresse] of TABELLE) assert.ok(titelVon(parse(adresse)).length <= 20, adresse);
  assert.equal(titelVon(parse(`#eintrag/${ID}/schritt/12`)), 'Schritt 12');
  assert.equal(titelVon(parse('#wartet')), 'Wartet auf dich');
});

test('der Pfeil Zurück steht nur unterhalb der obersten Ebene und nie in der Anmeldung (UNA-2)', () => {
  for (const [adresse, ansicht] of TABELLE) {
    const erwartet = !BEREICHE.includes(ansicht) && ansicht !== 'anmelden';
    assert.equal(hatZurueck(parse(adresse)), erwartet, adresse);
  }
});

test('Blätter haben einen Titel, Ansichten ohne Blatt keinen', () => {
  assert.equal(blattTitelVon(parse(`#eintrag/${ID}/einsortieren`)), 'Einsortieren');
  assert.equal(blattTitelVon(parse('#mehr/geraet')), 'Gerätename');
  assert.equal(blattTitelVon(parse('#mehr')), null);
});

test('der Stapel unter einem Eintrag hängt davon ab, woher er kommt (UNA-4)', () => {
  const woher = (ort) => () => ort;
  const eintrag = parse(`#eintrag/${ID}`);
  assert.deepEqual(stapelUnter(eintrag, woher('eingang')), ['#wartet', '#eingang']);
  assert.deepEqual(stapelUnter(eintrag, woher('ideen')), ['#wartet', '#mehr', '#ideen']);
  assert.deepEqual(stapelUnter(eintrag, woher('abnahmen')), ['#wartet', '#abnahmen']);
  assert.deepEqual(stapelUnter(eintrag, woher(null)), ['#wartet']);
  assert.deepEqual(stapelUnter(parse(`#eintrag/${ID}/schritt/2`), woher('abnahmen')), ['#wartet', '#abnahmen', `#eintrag/${ID}`]);
  assert.deepEqual(stapelUnter(parse(`#eintrag/${ID}/ergebnis`), woher('abnahmen')), ['#wartet', '#abnahmen', `#eintrag/${ID}`]);
  assert.deepEqual(stapelUnter(parse(`#eintrag/${ID}/schritt/2/skip`), woher('abnahmen')), ['#wartet', '#abnahmen', `#eintrag/${ID}`, `#eintrag/${ID}/schritt/2`]);
  assert.deepEqual(stapelUnter(parse(`#eintrag/${ID}/antworten`), woher(null)), ['#wartet', `#eintrag/${ID}`]);
});

test('Titel und Blätter der neuen Adressen', () => {
  assert.equal(blattTitelVon(parse(`#eintrag/${ID}/antworten`)), 'Deine Antwort');
  assert.equal(blattTitelVon(parse(`#eintrag/${ID}/schritt/3/blocked`)), 'BLOCKED für Schritt 3');
  assert.equal(titelVon(parse(`#eintrag/${ID}/ergebnis`)), 'Ergebnis');
  assert.equal(parse(`#eintrag/${ID}/schritt/3/FAIL`), null);
});

test('Alle: die Auswahlen sind Blätter mit eigener Adresse und Titel; eine unbekannte Auswahl ergibt null', () => {
  for (const [welche, titel] of [['status', 'Status'], ['projekt', 'Projekt'], ['art', 'Art'], ['prio', 'Priorität'], ['sortieren', 'Sortieren nach']]) {
    const o = parse(`#alle/${welche}`);
    assert.equal(o.blatt, 'auswahl');
    assert.equal(o.welche, welche);
    assert.equal(blattTitelVon(o), titel);
    assert.ok(titel.length <= 30);
  }
  assert.equal(parse('#alle/farbe'), null);
  assert.equal(blattTitelVon(parse('#alle')), null);
  assert.equal(titelVon(parse('#alle')), 'Alle offenen');
  assert.equal(hatZurueck(parse('#alle')), false, 'Alle ist ein Hauptbereich');
  assert.equal(hatZurueck(parse('#alle/status')), false, 'das Blatt ist ein dialog über dem Hauptbereich');
});
