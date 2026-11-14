// Entwürfe auf dem Gerät: Eingaben, die Zurück, Neuladen und das Beenden der App überleben sollen (UEI-6). Sie liegen in
// IndexedDB im Speicher „entwuerfe“, getrennt von der Warteschlange, damit ein Entwurf nie etwas sendet. Schlüssel:
//   antwort/ID        freier Text im Blatt Deine Antwort
//   einsortieren/ID   Ziel und Satz im Blatt Einsortieren
//   urteil/ID         Urteile je Schritt einer Abnahme und die Anmerkung: { schritte: { N: { wort, satz } }, anmerkung }
//   erfassen          Art, Titel, An, Text, Rang und Dringend in Erfassen
// Ein leerer Entwurf wird gelöscht; so bleibt kein Rest, der „Entwurf“ vortäuscht.

export const schluessel = {
  antwort: (id) => `antwort/${id}`,
  einsortieren: (id) => `einsortieren/${id}`,
  urteil: (id) => `urteil/${id}`,
  erfassen: 'erfassen',
};

/** Liest einen Entwurf oder null. */
export async function liesEntwurf(db, key) {
  return (await db.lies('entwuerfe', key)) ?? null;
}

/** Speichert einen Entwurf; `leer` sagt, ob nichts Eingegebenes darin steht (dann wird er gelöscht). */
export async function speichereEntwurf(db, key, wert, leer = false, jetzt = Date.now()) {
  if (leer) { await db.entferne('entwuerfe', key); return; }
  await db.schreibe('entwuerfe', { ...wert, schluessel: key, zeit: jetzt });
}

export const loescheEntwurf = (db, key) => db.entferne('entwuerfe', key);
