// Verbindet Datenbank, Abgleich, Navigation, Anzeige, Statusleiste, Netzzeile und Service Worker zur App. Die Teile kommen
// als Parameter: start.js setzt die echten, eine Vorschau oder ein Test setzt eigene (Datenbank, fetch, Uhr). Eine
// Die Schreibschicht (schreiben.js) baut die App selbst, wenn ein `fetch` kommt; ein Test kann einen fertigen `schreiben`
// geben. Ohne beides liest die App nur und sagt es.
import { anzeigen, setzeKontext, setzeSuchText, suchText } from './anzeigen.js';
import { blattGeschlossen, ersetze, gehe, geheUeberWartet, ort as navigationOrt, schliesseUndGehe, starten, zurueck } from './navigation.js';
import { netzZeile } from './netz.js';
import { starteFristen } from './frist.js';
import { Aktualisierung, pruefeRegelmaessig, zeigeNeuBand } from './aktualisieren.js';
import { baueHinweis } from './hinweis.js';
import { Anhangholer } from './anhangholer.js';
import { Schreiber } from './schreiben.js';
import { einstellung, setzeEinstellung } from './speicher.js';
import { statusleiste } from './statusleiste.js';
import { verbinde } from './steuerung.js';
import { folgeTipp as tippFolgen, idsVon, kamDurchTipp } from './pushklick.js';
import { gueltigesZiel, zielAusNachricht } from './swlogik.js';
import { browserProbe } from './webpush.js';
import { ladeWelt, ortVon } from './welt.js';
import { adresseAusHuelle, mitGeteiltem, mitGeteiltenDateien } from './huelle.js';
import { verkleinereBild } from './verkleinern.js';
import { systemfarbenVon } from './farben.js';
import { liesEntwurf, schluessel, speichereEntwurf } from './entwuerfe.js';
import { anhangSchluessel } from './anhangwahl.js';

const $ = (id) => document.getElementById(id);

/**
 * `aktualisierung` und `installiert` sind für die Vorschau da: sie zeigt die Zustände „neue Fassung wartet“ und „läuft als
 * installierte App“, die ein Renderer nicht herstellen kann. Ohne sie fragt die App den Browser. `huelle` ist die Brücke zur
 * Android-Hülle oder `null` im Browser. `webpush` ersetzt die Probe mit Web-Push (js/webpush.js), etwa in der Vorschau; ohne sie baut
 * die App die Probe im Browser und lässt sie in der Hülle weg (dort gibt es keinen Service Worker und kein Push); `null` lässt den
 * Abschnitt in Mehr weg.
 */
export async function starteApp({ db, steuerung, fetch = null, schreiben = null, jetzt = () => Date.now(), zeitgeber = undefined, aktualisierung = undefined, installiert = undefined, huelle = null, webpush = undefined }) {
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
    schreiben = new Schreiber({ db, fetch, jetzt, abgleich, anmeldung: () => steuerung.anmeldung(), amNetz: () => steuerung.amNetz(), pruefeNetz: () => steuerung.pruefeNetz(), hinweis: hinweis.zeige, meldung: hinweis.meldung, zeitgeber, beiAenderung: () => k.neuZeichnen() });
  }
  // Neue Fassung (UOF-5): ein ruhiges Band unten und in Mehr; die App lädt nie von selbst neu
  // In der Hülle kein Service Worker: die Dateien liegen im APK, Updates kommen als APK
  const dienst = !huelle && 'serviceWorker' in navigator ? navigator.serviceWorker : null;
  const eigene = aktualisierung === undefined;
  aktualisierung ??= dienst ? new Aktualisierung({ container: dienst }) : null;
  if (webpush === undefined) {   // `null` ist gewollt (Vorschau, Test): kein Abschnitt
    webpush = huelle ? null : browserProbe({
      lies: async () => (await einstellung(db, 'webpush'))?.schluessel ?? '',
      schreibe: (schluessel) => setzeEinstellung(db, 'webpush', { schluessel }),
    });
  }
  const k = {
    db, steuerung, schreiben, jetzt, meldung: hinweis.meldung, aktualisierung, anhaenge: fetch ? new Anhangholer({ db, fetch, anmeldung: () => steuerung.anmeldung(), jetzt }) : null, installiert, huelle, webpush, gehe, ersetze, schliesseUndGehe,
    neuZeichnen: () => anzeigen(ortJetzt(), { automatisch: true }),
    // Ein neues Token: was am alten scheiterte, geht jetzt los
    nachAnmeldung: () => { schreiben?.erneutAlle(); return (history.state?.tiefe ?? 0) > 0 ? zurueck() : ersetze('#wartet'); },
  };
  const ortJetzt = () => navigationOrt();
  setzeKontext(k);
  netzZeile($('stand'), steuerung);
  starteFristen($('inhalt'), { jetzt, zeitgeber });   // Fristen („Nächster Abgleich in etwa 40 s“) laufen im Text mit; Uhr und Zeitgeber sind die der App

  // Suche: die Eingabe steht oben in der Leiste; jede Eingabe zeichnet die Treffer neu (mit kurzer Pause)
  let pause = null;
  $('suche-eingabe').addEventListener('input', (e) => {
    setzeSuchText(e.target.value);
    clearTimeout(pause);
    pause = setTimeout(() => anzeigen(ortJetzt()), 150);
  });
  $('suche-eingabe').value = suchText();
  $('suchen').addEventListener('click', () => setTimeout(() => $('suche-eingabe').focus(), 0));

  // Ein Tipp auf die Web-Push-Mitteilung (js/pushklick.js): erst abgleichen, dann das Ziel öffnen. Ein neues Fenster kommt mit `?push`
  // in der Adresse (die Kennung fällt hier weg, sonst bliebe sie an jeder späteren Adresse), ein offenes bekommt eine Nachricht.
  const tippStart = kamDurchTipp(globalThis.location?.search);
  if (tippStart) history.replaceState(history.state, '', `${location.pathname}${location.hash}`);
  const folgeTipp = (ziel, vorher = null) => tippFolgen({
    ziel, vorher, abgleichen: () => steuerung.lauf('push'), ladeWelt: () => ladeWelt(db, jetzt()),
    gesperrt: () => navigationOrt().ansicht === 'anmelden', oeffne: geheUeberWartet,
  });

  // Der Stapel unter einem tiefen Link hängt davon ab, woher der Eintrag kommt (Eingang, Ideensammlung, Abnahmen)
  const welt0 = await ladeWelt(db, jetzt());
  if (!(await steuerung.anmeldung())) history.replaceState({ tiefe: 0 }, '', '#anmelden');
  let neuBand = { ansicht() {} };
  starten((o) => { neuBand.ansicht(o.ansicht); return anzeigen(o); }, { woher: (id) => ortVon(welt0, id) });

  // Android-Hülle: Links llmpost://… und Text aus anderen Apps kommen über die Brücke (huelle.js).
  // Die Systemfarben (Material You) setzen die Rollen von app.css auf :root (farben.js); ein weiterer Wert der Hülle bekommt hier
  // einen weiteren Empfänger.
  if (huelle) {
    let teilenKette = Promise.resolve();
    const farben = systemfarbenVon();
    huelle.verbinde({
      farben: (m) => { farben?.uebernimm(m); },
      oeffnen: (m) => { if (navigationOrt().ansicht !== 'anmelden') gehe(adresseAusHuelle(m.adresse)); },
      // Ein Teilen kommt als mehrere Nachrichten (huelle.js); sie laufen nacheinander, und jede ist erst mit `weiter` quittiert, wenn sie im Entwurf liegt
      teilen: (m) => {
        teilenKette = teilenKette.then(async () => {
          try {
            const alt = (await liesEntwurf(db, schluessel.erfassen)) ?? {};
            const dateien = await mitGeteiltenDateien(await liesEntwurf(db, anhangSchluessel(schluessel.erfassen)), m, verkleinereBild);
            if (!dateien || m.titel || m.text) await speichereEntwurf(db, schluessel.erfassen, mitGeteiltem(alt, { titel: m.titel, text: m.text }), false, jetzt());
            if (dateien) await speichereEntwurf(db, anhangSchluessel(schluessel.erfassen), dateien, false, jetzt());
            const hier = navigationOrt().ansicht;
            if (hier === 'erfassen') k.neuZeichnen(); else if (hier !== 'anmelden') gehe('#erfassen');
          } catch { /* die Hülle wartet auf weiter, auch wenn diese Nachricht scheiterte */ }
          huelle.weiter();
        });
      },
    });
    huelle.bereit();
  }

  // Der Abgleich ändert den Stand: neu zeichnen, sobald sich Phase, Fehler, Netz oder Stand ändern; Fortschritt gedrosselt
  const stand = (z) => JSON.stringify([z.phase, z.fehler?.art, z.ohneNetz, z.letzter?.geprueft, z.naechster]);
  let letzter = stand(steuerung.zustand);
  let gedrosselt = null;
  steuerung.beiAenderung((z) => {
    const jetztStand = stand(z);
    if (jetztStand !== letzter) { letzter = jetztStand; k.neuZeichnen(); return; }
    if (z.phase === 'laeuft' && !gedrosselt) gedrosselt = setTimeout(() => { gedrosselt = null; k.neuZeichnen(); }, 400);
  });
  verbinde(steuerung);
  if (tippStart) folgeTipp(gueltigesZiel(location.hash), idsVon(welt0));
  if (dienst) {
    dienst.addEventListener('message', (m) => { const ziel = zielAusNachricht(m.data); if (ziel) folgeTipp(ziel); });
    dienst.startMessages?.();
  }

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
    globalThis.addEventListener?.('online', () => schreiben.weckeNetz());
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
