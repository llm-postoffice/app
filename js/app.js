// Verbindet Datenbank, Abgleich, Navigation, Anzeige, Statusleiste, Netzzeile und Service Worker zur App. Die Teile kommen
// als Parameter: start.js setzt die echten, eine Vorschau oder ein Test setzt eigene (Datenbank, fetch, Uhr). Eine
// Schreibschicht (Teil E) kommt als `schreiben`; ohne sie liest die App nur und sagt es.
import { anzeigen, setzeKontext, setzeSuchText, suchText } from './anzeigen.js';
import { blattGeschlossen, ersetze, gehe, ort as navigationOrt, schliesseUndGehe, starten, zurueck } from './navigation.js';
import { netzZeile } from './netz.js';
import { statusleiste } from './statusleiste.js';
import { verbinde } from './steuerung.js';
import { ladeWelt, ortVon } from './welt.js';

const $ = (id) => document.getElementById(id);

export async function starteApp({ db, steuerung, schreiben = null, jetzt = () => Date.now() }) {
  statusleiste();
  $('zurueck').addEventListener('click', zurueck);

  // Blatt von unten (UDI-3): Zurück, Esc und Abbrechen schließen es, Tippen daneben auch.
  const blatt = $('blatt');
  blatt.addEventListener('close', blattGeschlossen);
  blatt.addEventListener('click', (e) => { if (e.target === blatt) blatt.close(); });

  const k = {
    db, steuerung, schreiben, jetzt, gehe, ersetze, schliesseUndGehe,
    neuZeichnen: () => anzeigen(ortJetzt(), { automatisch: true }),
    nachAnmeldung: () => ((history.state?.tiefe ?? 0) > 0 ? zurueck() : ersetze('#wartet')),
  };
  const ortJetzt = () => navigationOrt();
  setzeKontext(k);
  netzZeile($('stand'), steuerung);

  // Suche: die Eingabe steht oben in der Leiste; jede Eingabe zeichnet die Treffer neu (mit kurzer Pause)
  let pause = null;
  $('suche-eingabe').addEventListener('input', (e) => {
    setzeSuchText(e.target.value);
    clearTimeout(pause);
    pause = setTimeout(() => anzeigen(ortJetzt()), 150);
  });
  $('suche-eingabe').value = suchText();
  $('suchen').addEventListener('click', () => setTimeout(() => $('suche-eingabe').focus(), 0));

  // Der Stapel unter einem tiefen Link hängt davon ab, woher der Eintrag kommt (Eingang, Ideensammlung, Abnahmen)
  const welt0 = await ladeWelt(db, jetzt());
  if (!(await steuerung.anmeldung())) history.replaceState({ tiefe: 0 }, '', '#anmelden');
  starten((o) => anzeigen(o), { woher: (id) => ortVon(welt0, id) });

  // Der Abgleich ändert den Stand: neu zeichnen, sobald sich Phase, Fehler, Netz oder Stand ändern; Fortschritt gedrosselt
  let letzter = JSON.stringify([steuerung.zustand.phase, steuerung.zustand.fehler?.art, steuerung.zustand.ohneNetz, steuerung.zustand.letzter?.geprueft]);
  let gedrosselt = null;
  steuerung.beiAenderung((z) => {
    const jetztStand = JSON.stringify([z.phase, z.fehler?.art, z.ohneNetz, z.letzter?.geprueft]);
    if (jetztStand !== letzter) { letzter = jetztStand; k.neuZeichnen(); return; }
    if (z.phase === 'laeuft' && !gedrosselt) gedrosselt = setTimeout(() => { gedrosselt = null; k.neuZeichnen(); }, 400);
  });
  verbinde(steuerung);

  // Start ohne Netz (UOF-1): der Service Worker hält die Hülle der App.
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
  return k;
}
