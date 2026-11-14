// Einstieg der App: öffnet die Datenbank, baut den Abgleich mit dem echten fetch und startet die App (app.js).
import { Abgleichsteuerung } from './steuerung.js';
import { starteApp } from './app.js';
import { oeffneOderRueckfall, speicherSichern } from './speicher.js';

// Speicher auf dem Gerät: IndexedDB, bei einem Fehler der Arbeitsspeicher (Mehr sagt es). Der Browser wird gebeten,
// den Speicher dauerhaft zu halten; Chromium entscheidet nach Nutzung und Installation ohne Abfrage.
const db = await oeffneOderRueckfall();
speicherSichern(db);
const steuerung = new Abgleichsteuerung({
  db, fetch: (...a) => fetch(...a), sichtbar: () => document.visibilityState === 'visible', amNetz: () => navigator.onLine,
});
await starteApp({ db, steuerung });
