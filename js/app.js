// Verbindet Datenbank, Abgleich, Navigation, Anzeige, Statusleiste, Netzzeile und Service Worker zur App. Die Teile kommen
// als Parameter: start.js setzt die echten, eine Vorschau oder ein Test setzt eigene (Datenbank, fetch, Uhr). Eine
// Die Schreibschicht (schreiben.js) baut die App selbst, wenn ein `fetch` kommt; ein Test kann einen fertigen `schreiben`
// geben. Ohne beides liest die App nur und sagt es.
import { anzeigen, setzeKontext, setzeSuchText, suchText } from './anzeigen.js';
import { blattGeschlossen, ersetze, gehe, ort as navigationOrt, schliesseUndGehe, starten, zurueck } from './navigation.js';
import { netzZeile } from './netz.js';
import { Aktualisierung, pruefeRegelmaessig, zeigeNeuBand } from './aktualisieren.js';
import { baueHinweis } from './hinweis.js';
import { Schreiber } from './schreiben.js';
import { statusleiste } from './statusleiste.js';
import { verbinde } from './steuerung.js';
import { ladeWelt, ortVon } from './welt.js';
import { adresseAusHuelle, mitGeteiltem } from './huelle.js';
import { liesEntwurf, schluessel, speichereEntwurf } from './entwuerfe.js';

const $ = (id) => document.getElementById(id);

/**
 * `aktualisierung` und `installiert` sind für die Vorschau da: sie zeigt die Zustände „neue Fassung wartet“ und „läuft als
 * installierte App“, die ein Renderer nicht herstellen kann. Ohne sie fragt die App den Browser. `huelle` ist die Brücke zur
 * Android-Hülle oder `null` im Browser.
 */
export async function starteApp({ db, steuerung, fetch = null, schreiben = null, jetzt = () => Date.now(), zeitgeber = undefined, aktualisierung = undefined, installiert = undefined, huelle = null }) {
  statusleiste();
  $('zurueck').addEventListener('click', zurueck);

  // Blatt von unten (UDI-3): Zurück, Esc und Abbrechen schließen es, Tippen daneben auch.
  const blatt = $('blatt');
  blatt.addEventListener('close', blattGeschlossen);
  blatt.addEventListener('click', (e) => { if (e.target === blatt) blatt.close(); });

  const hinweis = baueHinweis({ zeitgeber });
  const abgleich = async () => {
    await steuerung.lauf('senden');
    const fehler = steuerung.zustand.fehler;
    return fehler ? { ok: false, fehler } : { ok: true };
  };
  if (!schreiben && fetch) {
    schreiben = new Schreiber({ db, fetch, jetzt, abgleich, anmeldung: () => steuerung.anmeldung(), hinweis: hinweis.zeige, zeitgeber, beiAenderung: () => k.neuZeichnen() });
  }
  // Neue Fassung (UOF-5): ein ruhiges Band unten und in Mehr; die App lädt nie von selbst neu
  // In der Hülle kein Service Worker: die Dateien liegen im APK, Updates kommen als APK
  const dienst = !huelle && 'serviceWorker' in navigator ? navigator.serviceWorker : null;
  const eigene = aktualisierung === undefined;
  aktualisierung ??= dienst ? new Aktualisierung({ container: dienst }) : null;
  const k = {
    db, steuerung, schreiben, jetzt, aktualisierung, installiert, huelle, gehe, ersetze, schliesseUndGehe,
    neuZeichnen: () => anzeigen(ortJetzt(), { automatisch: true }),
    // Ein neues Token: was am alten scheiterte, geht jetzt los
    nachAnmeldung: () => { schreiben?.erneutAlle(); return (history.state?.tiefe ?? 0) > 0 ? zurueck() : ersetze('#wartet'); },
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
  let neuBand = { ansicht() {} };
  starten((o) => { neuBand.ansicht(o.ansicht); return anzeigen(o); }, { woher: (id) => ortVon(welt0, id) });

  // Android-Hülle: Links llmpost://… und Text aus anderen Apps kommen über die Brücke (huelle.js).
  // Spätere Werte der Hülle (etwa Systemfarben) bekommen hier einen weiteren Empfänger.
  if (huelle) {
    huelle.verbinde({
      oeffnen: (m) => { if (navigationOrt().ansicht !== 'anmelden') gehe(adresseAusHuelle(m.adresse)); },
      teilen: async (m) => {
        const alt = (await liesEntwurf(db, schluessel.erfassen)) ?? {};
        await speichereEntwurf(db, schluessel.erfassen, mitGeteiltem(alt, { titel: m.titel, text: m.text }), false, jetzt());
        const hier = navigationOrt().ansicht;
        if (hier === 'erfassen') k.neuZeichnen(); else if (hier !== 'anmelden') gehe('#erfassen');
      },
    });
    huelle.bereit();
  }

  // Der Abgleich ändert den Stand: neu zeichnen, sobald sich Phase, Fehler, Netz oder Stand ändern; Fortschritt gedrosselt
  let letzter = JSON.stringify([steuerung.zustand.phase, steuerung.zustand.fehler?.art, steuerung.zustand.ohneNetz, steuerung.zustand.letzter?.geprueft]);
  let gedrosselt = null;
  steuerung.beiAenderung((z) => {
    const jetztStand = JSON.stringify([z.phase, z.fehler?.art, z.ohneNetz, z.letzter?.geprueft]);
    if (jetztStand !== letzter) { letzter = jetztStand; k.neuZeichnen(); return; }
    if (z.phase === 'laeuft' && !gedrosselt) gedrosselt = setTimeout(() => { gedrosselt = null; k.neuZeichnen(); }, 400);
  });
  verbinde(steuerung);

  // Schreiben: Liegengebliebenes geht beim Start los; mit Netz und nach jedem Abgleich räumt die Schlange auf
  if (schreiben) {
    let netzWar = steuerung.zustand.ohneNetz;
    steuerung.beiAenderung((z) => {
      if (z.phase === 'bereit' || z.phase === 'fehler') {
        if (netzWar && !z.ohneNetz) schreiben.weckeNetz();
        netzWar = z.ohneNetz;
        if (z.phase === 'bereit') schreiben.raeume();
      }
    });
    schreiben.aufraeumenBeimStart();
  }

  // Start ohne Netz (UOF-1): der Service Worker hält die Hülle der App. Er ist ein Modul (js/swlogik.js).
  if (aktualisierung) {
    neuBand = zeigeNeuBand(aktualisierung);
    neuBand.ansicht(ortJetzt().ansicht);
    aktualisierung.beiAenderung(() => k.neuZeichnen());
  }
  if (dienst) {
    const registriert = dienst.register('./sw.js', { type: 'module' }).catch(() => null);   // ohne Service Worker läuft die App, nur ohne Offline-Start
    if (eigene) registriert.then((r) => { if (r) { aktualisierung.beobachte(r); pruefeRegelmaessig(aktualisierung); } });
  }
  return k;
}
