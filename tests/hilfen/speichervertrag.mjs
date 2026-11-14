// Der Vertrag der Datenbank-Schnittstelle (js/speicher.js): derselbe Prüflauf gilt für den Speicher im Arbeitsspeicher
// (node --test) und für IndexedDB (tools/wege.mjs in Chromium). Er braucht kein assert, damit er im Browser läuft:
// das Ergebnis ist die Liste der Abweichungen, leer heißt bestanden.
export async function vertrag(db) {
  const fehler = [];
  const soll = (ok, was) => { if (!ok) fehler.push(was); };
  const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const wirft = async (f) => { try { await f(); return false; } catch { return true; } };

  soll(await db.lies('dateien', 'gibt-es-nicht') === undefined, 'ein fehlender Schlüssel liest undefined');
  await db.schreibe('dateien', { sha: 'a1', text: 'Hallo' });
  const gelesen = await db.lies('dateien', 'a1');
  soll(gleich(gelesen, { sha: 'a1', text: 'Hallo' }), 'schreibe, dann lies gibt den Wert zurück');
  gelesen.text = 'verändert';
  soll((await db.lies('dateien', 'a1')).text === 'Hallo', 'der gelesene Wert ist eine Kopie');
  await db.schreibe('dateien', { sha: 'a1', text: 'Neu' });
  soll((await db.lies('dateien', 'a1')).text === 'Neu' && await db.zaehle('dateien') === 1, 'schreiben mit gleichem Schlüssel ersetzt');

  await db.aendere([
    { speicher: 'dateien', setze: { sha: 'b2', text: 'B' } },
    { speicher: 'baum', setze: { name: 'neu', etag: 'x', eintraege: [{ pfad: 'projects.md', sha: 'b2' }] } },
    { speicher: 'dateien', entferne: 'a1' },
  ]);
  soll(gleich(await db.schluessel('dateien'), ['b2']), 'aendere setzt und entfernt in einem Zug, auch über mehrere Speicher');
  soll((await db.lies('baum', 'neu'))?.etag === 'x', 'aendere schreibt in den zweiten Speicher');
  soll(gleich((await db.alle('dateien')).map((d) => d.text), ['B']), 'alle liefert die Werte');

  const davor = await db.zaehle('dateien');
  soll(await wirft(() => db.aendere([{ speicher: 'dateien', setze: { sha: 'c3', text: 'C' } }, { speicher: 'gibt-es-nicht', setze: { x: 1 } }])),
    'ein unbekannter Speicher ist ein Fehler');
  soll(await db.zaehle('dateien') === davor, 'ein Fehler in aendere schreibt nichts');
  await db.aendere([]);

  await db.entferne('dateien', 'b2');
  await db.entferne('dateien', 'gibt-es-nicht');
  soll(await db.zaehle('dateien') === 0, 'entferne nimmt den Eintrag weg und verzeiht einen fehlenden');

  await db.schreibe('schlange', { id: '01', zustand: 'wartet' });
  await db.schreibe('entwuerfe', { schluessel: 'antwort/k7m2qa', text: 'Entwurf' });
  await db.schreibe('einstellungen', { name: 'geraet', wert: 'handy' });
  soll(await db.zaehle('schlange') === 1 && await db.zaehle('entwuerfe') === 1 && await db.zaehle('einstellungen') === 1, 'alle fünf Speicher des Schemas gibt es');
  return fehler;
}
