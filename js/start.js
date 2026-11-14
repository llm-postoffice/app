// Einstieg der App: verbindet Datenbank, Abgleich, Navigation, Anzeige, Statusleiste, Netzzeile und Service Worker.
import { Abgleichsteuerung, verbinde } from './steuerung.js';
import { anzeigen, setzeKontext } from './anzeigen.js';
import { blattGeschlossen, starten, zurueck } from './navigation.js';
import { netzZeile } from './netz.js';
import { oeffneOderRueckfall, speicherSichern } from './speicher.js';
import { statusleiste } from './statusleiste.js';

const $ = (id) => document.getElementById(id);

statusleiste();
$('zurueck').addEventListener('click', zurueck);

// Blatt von unten (UDI-3): Zurück, Esc und Abbrechen schließen es, Tippen daneben auch.
const blatt = $('blatt');
blatt.addEventListener('close', blattGeschlossen);
blatt.addEventListener('click', (e) => { if (e.target === blatt) blatt.close(); });
$('blatt-abbrechen').addEventListener('click', () => blatt.close());

// Speicher auf dem Gerät: IndexedDB, bei einem Fehler der Arbeitsspeicher (Mehr sagt es). Der Browser wird gebeten,
// den Speicher dauerhaft zu halten; Chromium entscheidet nach Nutzung und Installation ohne Abfrage.
const db = await oeffneOderRueckfall();
speicherSichern(db);
const steuerung = new Abgleichsteuerung({
  db, fetch: (...a) => fetch(...a), sichtbar: () => document.visibilityState === 'visible', amNetz: () => navigator.onLine,
});
setzeKontext({ steuerung, db });
netzZeile($('stand'), steuerung);
starten(anzeigen);
verbinde(steuerung);

// Start ohne Netz (UOF-1): der Service Worker hält die Hülle der App.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
