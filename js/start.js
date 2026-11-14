// Einstieg der App: verbindet Navigation, Anzeige, Statusleiste, Netzzeile und Service Worker.
import { anzeigen } from './anzeigen.js';
import { blattGeschlossen, starten, zurueck } from './navigation.js';
import { netzZeile } from './netz.js';
import { statusleiste } from './statusleiste.js';

const $ = (id) => document.getElementById(id);

statusleiste();
netzZeile($('stand'));
$('zurueck').addEventListener('click', zurueck);

// Blatt von unten (UDI-3): Zurück, Esc und Abbrechen schließen es, Tippen daneben auch.
const blatt = $('blatt');
blatt.addEventListener('close', blattGeschlossen);
blatt.addEventListener('click', (e) => { if (e.target === blatt) blatt.close(); });
$('blatt-abbrechen').addEventListener('click', () => blatt.close());

starten(anzeigen);

// Start ohne Netz (UOF-1): der Service Worker hält die Hülle der App.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
