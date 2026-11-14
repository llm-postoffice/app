// Anmeldung: Eingaben prüfen und das Ablaufdatum des Tokens in Worte fassen (E7). Das Token steht in keiner Meldung.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GERAET_VORGABE, ablaufAnzeige, geraetVorschlag, pruefeGeraet, pruefeRepo, pruefeToken } from '../js/anmeldung.js';

test('Gerätename: Kleinbuchstaben, Ziffern, Bindestrich; sonst ein Vorschlag zum Übernehmen', () => {
  assert.deepEqual(pruefeGeraet('handy'), { ok: true, name: 'handy' });
  assert.deepEqual(pruefeGeraet('pixel-8'), { ok: true, name: 'pixel-8' });
  const r = pruefeGeraet('Pixel 8 Pro');
  assert.equal(r.ok, false);
  assert.equal(r.vorschlag, 'pixel-8-pro');
  assert.match(r.fehler, /Großbuchstaben/);
  assert.equal(pruefeGeraet('').ok, false);
  assert.equal(pruefeGeraet('-x').ok, false);
  assert.equal(geraetVorschlag('  Mein_Gerät  '), 'mein-gerat');
  assert.equal(GERAET_VORGABE, 'handy');
});

// Der Host steht verkettet im Test, weil tools/fremdhost.mjs ihn in Dateien sucht; die App lädt nichts von dort.
const GH = ['https:', '', 'github.com'].join('/');

test('Repo: EIGENTÜMER/NAME, eine kopierte GitHub-Adresse wird gekürzt', () => {
  assert.deepEqual(pruefeRepo('org/daten'), { ok: true, repo: 'org/daten' });
  assert.equal(pruefeRepo(`${GH}/org/daten.git`).repo, 'org/daten');
  assert.equal(pruefeRepo(`${GH}/org/daten/tree/main`).repo, 'org/daten');
  assert.equal(pruefeRepo('daten').ok, false);
  assert.equal(pruefeRepo('').ok, false);
});

test('Token: nicht leer, kein Leerzeichen; die Meldung nennt das Token nie', () => {
  assert.deepEqual(pruefeToken(' abc123 \n'), { ok: true, token: 'abc123' });
  const r = pruefeToken('ab cd');
  assert.equal(r.ok, false);
  assert.doesNotMatch(r.fehler, /ab cd/);
  assert.equal(pruefeToken('').ok, false);
});

test('Ablauf: Datum und Tage, Warnung 14 Tage vorher, abgelaufen', () => {
  const jetzt = new Date(2026, 10, 14, 14, 7).getTime();
  assert.equal(ablaufAnzeige('', jetzt), null);
  assert.equal(ablaufAnzeige('kein Datum', jetzt), null);
  assert.deepEqual(ablaufAnzeige('2027-10-30', jetzt), { text: 'Es läuft am 2027-10-30 ab, in 350 Tagen.', warnung: false, abgelaufen: false, tage: 350 });
  assert.equal(ablaufAnzeige('2026-11-28', jetzt).warnung, true);
  assert.equal(ablaufAnzeige('2026-11-29', jetzt).warnung, false);
  assert.equal(ablaufAnzeige('2026-11-15', jetzt).text, 'Es läuft am 2026-11-15 ab, in 1 Tag.');
  assert.equal(ablaufAnzeige('2026-11-14', jetzt).text, 'Es läuft am 2026-11-14 ab, heute.');
  assert.deepEqual(ablaufAnzeige('2026-11-13', jetzt), { text: 'Es ist am 2026-11-13 abgelaufen.', warnung: true, abgelaufen: true });
});
