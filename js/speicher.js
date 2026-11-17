// Speicher der App auf dem Gerät: IndexedDB mit festem Schema, dazu eine Datenbank im Arbeitsspeicher mit derselben
// Schnittstelle (für node --test und als Rückfall, wenn der Browser IndexedDB verweigert, etwa in einem privaten
// Fenster). Der Abgleich und die Warteschlange kennen nur die Schnittstelle, nie IndexedDB selbst.
//
// Schema (Fassung 2; Fassung 1 hatte den Speicher anhaenge noch nicht, ein Update legt ihn an und lässt alles andere).
// Teil C füllt dateien, baum und einstellungen; schlange und entwuerfe legt es an, Teil E füllt sie.
//   dateien        Schlüssel sha       { sha, text }                 Inhalt einer Datei nach Git-Prüfsumme (Blob)
//   baum           Schlüssel name      { name, sha, etag, eintraege, vollstaendig, zeit, geprueft }
//                                        name 'stand': der zuletzt vollständig geladene Baum, aus ihm wird gelesen
//                                        name 'neu':   ein Baum, der noch lädt; der Abgleich setzt dort fort
//                                        eintraege: [{ pfad, sha }] nur entries/ und projects.md
//                                        anhaenge: [{ id, ulid, name, sha, groesse }] die Anhänge im Baum (ohne Inhalt)
//   schlange       Schlüssel id        { id, zustand, ... }          Antworten und Einträge, die noch nicht gesendet
//                                        sind (Teil E); Index zustand
//   entwuerfe      Schlüssel schluessel { schluessel, ... }          Eingaben, die ein Neuladen überleben sollen
//                                        (Teil E); getrennt von der Schlange, damit ein Entwurf nichts sendet
//   einstellungen  Schlüssel name      { name, wert }                Anmeldung, Gerät, Takt, Speicher
//   anhaenge       Schlüssel sha       { sha, daten, zeit }          Inhalt eines Anhangs (Base64), den der Nutzer geöffnet hat;
//                                        der Abgleich räumt weg, was der Baum nicht mehr nennt
//
// Das Token liegt unverschlüsselt in einstellungen (Anmeldung); A9 der Proben ergab keinen besseren Ort für eine
// Web-App ohne Passkey. Wer Skript in der App ausführt, liest es; dagegen stehen CSP, keine Fremdskripte und der PR-Fluss.

export const DB_NAME = 'postfach';
export const DB_FASSUNG = 2;

/** Die Speicher mit Schlüsselfeld und Indizes. */
export const SPEICHER = {
  dateien: { schluessel: 'sha' },
  baum: { schluessel: 'name' },
  schlange: { schluessel: 'id', indizes: ['zustand'] },
  entwuerfe: { schluessel: 'schluessel' },
  einstellungen: { schluessel: 'name' },
  anhaenge: { schluessel: 'sha' },
};

/**
 * Eine Datenbank im Arbeitsspeicher mit der Schnittstelle der IndexedDB-Fassung. Werte werden beim Schreiben und Lesen
 * kopiert (structuredClone), wie IndexedDB es tut; so sieht ein Test dasselbe wie der Browser.
 */
export function speicherDatenbank() {
  const tabellen = new Map(Object.keys(SPEICHER).map((n) => [n, new Map()]));
  const tabelle = (name) => {
    const t = tabellen.get(name);
    if (!t) throw new Error(`Speicher ${name} gibt es nicht`);
    return t;
  };
  const schluesselVon = (name, wert) => wert[SPEICHER[name].schluessel];
  return {
    art: 'arbeitsspeicher',
    async lies(name, schluessel) { const v = tabelle(name).get(schluessel); return v === undefined ? undefined : structuredClone(v); },
    async alle(name) { return [...tabelle(name).values()].map((v) => structuredClone(v)); },
    async schluessel(name) { return [...tabelle(name).keys()]; },
    async zaehle(name) { return tabelle(name).size; },
    async schreibe(name, wert) { tabelle(name).set(schluesselVon(name, wert), structuredClone(wert)); },
    async entferne(name, schluessel) { tabelle(name).delete(schluessel); },
    /** Mehrere Schreibvorgänge zusammen: ops sind { speicher, setze } oder { speicher, entferne }; alles oder nichts. */
    async aendere(ops) {
      for (const op of ops) tabelle(op.speicher);
      for (const op of ops) {
        if ('setze' in op) tabelle(op.speicher).set(schluesselVon(op.speicher, op.setze), structuredClone(op.setze));
        else tabelle(op.speicher).delete(op.entferne);
      }
    },
    schliesse() {},
  };
}

const wartetAuf = (anfrage) => new Promise((ok, fehler) => {
  anfrage.onsuccess = () => ok(anfrage.result);
  anfrage.onerror = () => fehler(anfrage.error);
});

/** Öffnet IndexedDB und legt das Schema an (oder erweitert es); `fabrik` ist indexedDB, zur Prüfung austauschbar. */
export async function oeffneDatenbank(fabrik = globalThis.indexedDB, name = DB_NAME) {
  if (!fabrik) throw new Error('IndexedDB ist nicht verfügbar');
  const anfrage = fabrik.open(name, DB_FASSUNG);
  anfrage.onupgradeneeded = () => {
    const db = anfrage.result;
    for (const [n, def] of Object.entries(SPEICHER)) {
      if (db.objectStoreNames.contains(n)) continue;
      const s = db.createObjectStore(n, { keyPath: def.schluessel });
      for (const i of def.indizes ?? []) s.createIndex(i, i);
    }
  };
  const db = await wartetAuf(anfrage);
  const gib = (n, modus) => db.transaction(n, modus).objectStore(n);
  const fertig = (tx) => new Promise((ok, fehler) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => fehler(tx.error);
    tx.onabort = () => fehler(tx.error ?? new Error('Schreibvorgang abgebrochen'));
  });
  return {
    art: 'indexeddb',
    lies: (n, k) => wartetAuf(gib(n, 'readonly').get(k)),
    alle: (n) => wartetAuf(gib(n, 'readonly').getAll()),
    schluessel: (n) => wartetAuf(gib(n, 'readonly').getAllKeys()),
    zaehle: (n) => wartetAuf(gib(n, 'readonly').count()),
    async schreibe(n, wert) { const tx = db.transaction(n, 'readwrite'); tx.objectStore(n).put(wert); await fertig(tx); },
    async entferne(n, k) { const tx = db.transaction(n, 'readwrite'); tx.objectStore(n).delete(k); await fertig(tx); },
    async aendere(ops) {
      if (!ops.length) return;
      const tx = db.transaction([...new Set(ops.map((o) => o.speicher))], 'readwrite');
      for (const op of ops) {
        if ('setze' in op) tx.objectStore(op.speicher).put(op.setze); else tx.objectStore(op.speicher).delete(op.entferne);
      }
      await fertig(tx);
    },
    schliesse() { db.close(); },
  };
}

/**
 * Öffnet die Datenbank der App: IndexedDB, bei einem Fehler (privates Fenster, gesperrte Websitedaten) der Speicher im
 * Arbeitsspeicher. Die App läuft dann, aber nichts übersteht ein Neuladen; `art` sagt es, Mehr zeigt es an.
 */
export async function oeffneOderRueckfall(fabrik = globalThis.indexedDB) {
  try {
    return await oeffneDatenbank(fabrik);
  } catch {
    return speicherDatenbank();
  }
}

// ---- Einstellungen

/** Liest eine Einstellung; `vorgabe`, wenn es sie nicht gibt. */
export async function einstellung(db, name, vorgabe = null) {
  const e = await db.lies('einstellungen', name);
  return e === undefined ? vorgabe : e.wert;
}

export const setzeEinstellung = (db, name, wert) => db.schreibe('einstellungen', { name, wert });

// ---- Speicher sichern

/**
 * Bittet den Browser, den Speicher dauerhaft zu halten (navigator.storage.persist). Chromium entscheidet nach einer
 * Heuristik (installierte App, Lesezeichen, Nutzung) ohne Abfrage. Ergebnis: true, false oder null, wenn die
 * Schnittstelle fehlt oder scheitert. Das Ergebnis liegt unter der Einstellung 'speicher'.
 */
export async function speicherSichern(db, speicher = globalThis.navigator?.storage, jetzt = () => Date.now()) {
  let dauerhaft = null;
  try {
    if (speicher?.persist) dauerhaft = (await speicher.persisted?.()) || (await speicher.persist());
  } catch {
    dauerhaft = null;
  }
  await setzeEinstellung(db, 'speicher', { dauerhaft, geprueft: jetzt() });
  return dauerhaft;
}
