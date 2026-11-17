// Das Schreiben gegen das Postwerkzeug selbst: die App sendet alle Arten von Sendung (Antwort, freier Text, Abnahme mit FAIL,
// Erledigen, Einsortieren, neuer Eintrag) an die Mock-Quelle, die GitHubs Git Data API nachbaut (Kopf, Blob, Baum, Commit, Zweig).
// Die Dateien, die sie annimmt, landen in einer Sandbox, die eine Kopie des Datenklons ist, und die Prüfung des Postwerkzeugs
// auf dieser Sandbox endet mit Exit 0. Der Datenklon wird nur gelesen; es geht nichts ins Netz und nichts nach GitHub.
// Der Test läuft nur, wenn die Umgebung beides benennt, sonst überspringt er sich mit SKIP:
//   POST_DATEN        Ordner des Datenklons (wird nur gelesen)
//   POST_PRUEFBEFEHL  Befehlszeile der Prüfung des Datenordners; {DATEN} steht für die Sandbox, z. B. `env DATENORDNER={DATEN} werkzeug check`
//                     (die Umgebungsvariable, die das Werkzeug für den Datenordner liest, setzt der Befehl selbst)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { aufbau } from './hilfen/schreiber.mjs';
import { PROJEKTE, dateien as beispiele } from './hilfen/beispieldaten.mjs';
import { FENSTER_PNG, MESSLAUF } from './hilfen/anhangdaten.mjs';
import { bytesZuBasis } from '../js/anhaenge.js';

const { POST_DATEN: DATEN, POST_PRUEFBEFEHL: BEFEHL } = process.env;
const grund = !DATEN || !BEFEHL ? 'POST_DATEN und POST_PRUEFBEFEHL nicht gesetzt (SKIP: kein Postwerkzeug und kein Datenklon, etwa in der CI)'
  : !existsSync(join(DATEN, 'entries')) ? `kein Datenklon unter ${DATEN} (SKIP)` : false;
if (grund) process.stderr.write(`SKIP  mockgithub.test.mjs: ${grund}\n`);

/** Text bleibt Text, Bytes (ein Anhang) bleiben Bytes, wie die Mock-Quelle es hält. */
const inhaltVon = (bytes) => { try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return new Uint8Array(bytes); } };
const gleich = (a, b) => (typeof a === 'string' || typeof b === 'string' ? a === b : Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0);
const anhang = (name, bytes, typ = '') => ({ name, groesse: bytes.length, typ, daten: bytesZuBasis(bytes) });

/** Liest Pfad zu Text aus dem Datenklon, wie der Baum von GitHub die Dateien nennt (nur projects.md und entries/). */
function liesKlon(wurzel) {
  const d = new Map([['projects.md', readFileSync(join(wurzel, 'projects.md'), 'utf8')]]);
  const geh = (rel) => {
    for (const e of readdirSync(join(wurzel, rel), { withFileTypes: true })) {
      if (e.isDirectory()) geh(`${rel}/${e.name}`); else d.set(`${rel}/${e.name}`, inhaltVon(readFileSync(join(wurzel, rel, e.name))));
    }
  };
  geh('entries');
  return d;
}

const pruefe = (sandbox) => {
  const teile = BEFEHL.replaceAll('{DATEN}', sandbox).split(/\s+/);
  return spawnSync(teile[0], teile.slice(1), { encoding: 'utf8', timeout: 120_000 });
};

test('Was die App an die Mock-Quelle sendet, besteht die Prüfung des Postwerkzeugs auf einer Kopie des Datenklons', { skip: grund }, async () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'postfach-sandbox-'));
  try {
    // Ausgangslage: der Datenklon, dazu die erfundenen Einträge der Beispieldaten samt ihren Projekten (alpha, beta, gamma)
    const klon = liesKlon(DATEN);
    const daten = new Map(klon);
    // Trägt ein erfundener Eintrag zufällig die ID eines echten, gilt der echte (die erfundenen IDs sind kurz, 32^6 Möglichkeiten)
    const echte = new Set([...klon.keys()].map((p) => p.split('/')[2]));
    for (const [pfad, text] of beispiele()) if (pfad.startsWith('entries/') && !echte.has(pfad.split('/')[2])) daten.set(pfad, text);
    daten.set('projects.md', `${klon.get('projects.md').replace(/\n+$/, '')}\n${PROJEKTE.replace(/^# Projekte\n/, '')}`);
    for (const [pfad, text] of daten) { mkdirSync(dirname(join(sandbox, pfad)), { recursive: true }); writeFileSync(join(sandbox, pfad), text); }
    const vorab = pruefe(sandbox);
    assert.equal(vorab.status, 0, `schon die Ausgangslage besteht die Prüfung nicht: ${vorab.stdout}${vorab.stderr}`);

    const a = await aufbau({ daten });
    const vorher = new Set(a.q.dateien.keys());
    const sende = [
      () => a.schreiber.antworten('r2d4vn', { wahl: 'A' }),                                            // Antwort mit Möglichkeit
      () => a.schreiber.antworten('m7q2ke', { text: 'Danke für den Befund.\n\nIch kümmere mich darum.', anhaenge: [anhang('fenster (1).png', FENSTER_PNG, 'image/png')] }), // freier Text mit Anhang an eine Nachricht
      () => a.schreiber.urteilSenden('h2n9vz', { text: '1: PASS\n2: FAIL Das Bild ist unscharf.\n3: PASS\n4: PASS\n5: PASS\n6: PASS' }), // FAIL mit Folgeauftrag
      () => a.schreiber.erledigen('x9k3ft'),                                                           // Erledigen
      () => a.schreiber.einsortieren('k7m2qa', { ziel: 'alpha', satz: 'Zu den Hinweisen.' }),          // Einsortieren
      () => a.schreiber.einsortieren('w2tn4c', { ziel: 'user' }),                                      // Einsortieren an den Nutzer
      () => a.schreiber.anlegen({ art: 'task', titel: 'Datei prüfen', an: 'alpha', text: 'Bitte bis Freitag.', rang: 1, dringend: true }), // neuer Eintrag
      () => a.schreiber.anlegen({ art: 'idea', titel: 'Ideen an dich', an: 'user', text: '' }),        // neue Idee ohne Text
      () => a.schreiber.anlegen({ art: 'task', titel: 'Bild und Messlauf prüfen', an: 'beta', text: 'Siehe Anhang.',
        anhaenge: [anhang('eingabefelder-standard.png', FENSTER_PNG, 'image/png'), anhang('messlauf-rechner-a.txt', new TextEncoder().encode(MESSLAUF))] }),   // Eintrag mit Anhängen
    ];
    for (const f of sende) {
      const r = await f();
      assert.equal(r.ok, true, JSON.stringify(r));
      await a.sende();
      const stecken = (await a.db.alle('schlange')).filter((x) => x.zustand !== 'gesendet' || !x.dateien);
      assert.deepEqual(stecken.map((x) => `${x.art} ${x.eintrag}: ${x.zustand} ${x.titel ?? ''} ${x.grund ?? ''}`), [], 'jede Sendung ging raus');
    }
    const eigene = a.q.commits.filter((c) => !c.fremd);
    assert.equal(eigene.length, sende.length, 'ein Commit je Sendung');
    const neu = [...a.q.dateien.keys()].filter((p) => !vorher.has(p));
    assert.ok(neu.length >= sende.length, `neue Dateien: ${neu.length}`);
    assert.ok(neu.every((p) => p.startsWith('entries/')), 'die App schreibt nur unter entries/');

    // Die angenommenen Dateien kommen in die Sandbox; der Rest der Sandbox ist unverändert
    for (const p of neu) { mkdirSync(dirname(join(sandbox, p)), { recursive: true }); writeFileSync(join(sandbox, p), a.q.dateien.get(p)); }
    for (const [pfad, text] of a.q.dateien) if (vorher.has(pfad)) assert.ok(gleich(text, daten.get(pfad)), `${pfad} blieb unverändert`);
    const r = pruefe(sandbox);
    assert.equal(r.status, 0, `die Prüfung des Postwerkzeugs endet mit Exit ${r.status}:\n${r.stdout}${r.stderr}`);
    assert.doesNotMatch(`${r.stdout}${r.stderr}`, /: Fehler:/, 'keine Zeile der Prüfung meldet einen Fehler');
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
