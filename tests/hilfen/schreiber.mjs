// Aufbau für die Tests der Schreibschicht: eine Datenbank im Arbeitsspeicher, die Mock-Quelle mit Schreibwegen, ein
// Schreiber mit fester Uhr und ein Abgleich gegen dieselbe Quelle. Nichts davon geht ins Netz.
import { abgleichen } from '../../js/abgleich.js';
import { schreibTakt } from '../../js/senden.js';
import { Schreiber } from '../../js/schreiben.js';
import { merkeUhr } from '../../js/erzeugen.js';
import { setzeEinstellung, speicherDatenbank } from '../../js/speicher.js';
import { JETZT, REPO, TOKEN, dateien } from './beispieldaten.mjs';
import { mockQuelle } from './mockquelle.mjs';

/** Ein Aufbau mit eigener Kopie der Beispieldaten; `optionen` gehen an die Mock-Quelle und den Schreiber. */
export async function aufbau({ daten = dateien(), quelle: qo = {}, schreiber: so = {}, uhr = JETZT } = {}) {
  const db = speicherDatenbank();
  const uhrwerk = { jetzt: uhr, wartezeiten: [], monoton: 0 };
  // Der Server geht standardmäßig richtig: seine Zeit ist die des Geräts; ein Test setzt eine andere (serverzeit)
  const q = mockQuelle({ dateien: new Map(daten), repo: REPO, token: TOKEN, serverzeit: () => uhrwerk.jetzt, ...qo });
  const jetzt = () => uhrwerk.jetzt;
  const anm = { repo: REPO, token: TOKEN };
  await setzeEinstellung(db, 'anmeldung', anm);
  await setzeEinstellung(db, 'geraet', 'handy-a');
  const abgleich = async () => {
    try {
      const r = await abgleichen({ fetch: q.fetch, db, quelle: anm, jetzt });
      await merkeUhr(db, r.serverzeit, jetzt());
      return { ok: true };
    } catch (e) { return { ok: false, fehler: e }; }
  };
  // Eine Uhr für den Abstand der schreibenden Anfragen: warten rückt sie vor, jede Anfrage steht im Protokoll
  const takt = schreibTakt({ uhr: () => uhrwerk.monoton, warte: async (ms) => { uhrwerk.wartezeiten.push(ms); uhrwerk.monoton += ms; } });
  const hinweise = [];
  const meldungen = [];
  const schreiber = new Schreiber({
    db, fetch: async (url, init) => { if ((init?.method ?? 'GET') !== 'GET') uhrwerk.schreibzeiten = [...(uhrwerk.schreibzeiten ?? []), uhrwerk.monoton]; return q.fetch(url, init); },
    jetzt, abgleich, anmeldung: async () => anm, hinweis: (h) => hinweise.push(h), meldung: (t) => { meldungen.push(t); return true; },
    zeitgeber: { setze: () => 0, loesche: () => {} }, takt, ...so,
  });
  await abgleich();
  /** Lässt die zehn Sekunden Rückgängig verstreichen und sendet. */
  const sende = async (ms = 10_001) => { uhrwerk.jetzt += ms; await schreiber.lauf(); };
  return { db, q, schreiber, uhrwerk, hinweise, meldungen, abgleich, sende, jetzt, quelle: anm };
}
