// Einstieg der App: öffnet die Datenbank, baut den Abgleich mit dem echten fetch und startet die App (app.js).
import { Abgleichsteuerung } from './steuerung.js';
import { starteApp } from './app.js';
import { oeffneOderRueckfall, speicherSichern } from './speicher.js';
import { Netzpruefer, verbindePruefer } from './netzprobe.js';

// Speicher auf dem Gerät: IndexedDB, bei einem Fehler der Arbeitsspeicher (Mehr sagt es). Der Browser wird gebeten,
// den Speicher dauerhaft zu halten; Chromium entscheidet nach Nutzung und Installation ohne Abfrage.
const db = await oeffneOderRueckfall();
speicherSichern(db);
// Netz: navigator.onLine allein täuscht unter einem VPN im Flugmodus; die Probe geht an die eigene Herkunft (js/netzprobe.js).
const sichtbar = () => document.visibilityState === 'visible';
const pruefer = new Netzpruefer({
  fetch: (...a) => fetch(...a), adresse: new URL('./js/version.js', location.href).href, onLine: () => navigator.onLine, sichtbar,
});
const steuerung = new Abgleichsteuerung({
  db, fetch: (...a) => fetch(...a), sichtbar, amNetz: () => pruefer.amNetz(),
  pruefeNetz: () => pruefer.pruefe(), beiNetzFehler: () => { pruefer.pruefe({ erzwingen: true }); },
});
pruefer.beiAenderung((da) => (da ? steuerung.netzDa() : steuerung.netzWeg()));
verbindePruefer(pruefer);
await starteApp({ db, steuerung, fetch: (...a) => fetch(...a) });
