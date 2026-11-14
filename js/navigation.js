// Navigation mit der History API (UNA-3, UNA-4, UNA-5). Jede Ebene ist ein Eintrag im Verlauf; der Eintrag
// trägt seine Tiefe im state. Ein tiefer Link baut den Stapel darunter nach, ein Hauptbereich baut ihn ab
// (wie popUpTo der Android-Navigation), und ein Blatt ist ein dialog mit eigener Adresse: Zurück schließt es
// als Schließanforderung zuerst und nimmt dann seinen Eintrag aus dem Verlauf.
import { BEREICHE, parse, stapelUnter } from './adressen.js';

const WARTET = parse('#wartet');
const stand = new Map();     // Rollposition je Adresse (UNA-5)
let zeigen = () => {};
let ueberspringen = false;   // der Abbau des Stapels vor einem Hauptbereich zeigt nichts zwischendurch

const tiefe = () => history.state?.tiefe ?? 0;
/** Die Ansicht der aktuellen Adresse; eine unbekannte Adresse zeigt Wartet. */
export const ort = () => parse(location.hash) ?? WARTET;

function anzeigen() {
  zeigen(ort());
  scrollTo(0, stand.get(location.hash) ?? 0);
}

/** Springt zu einer Adresse: ein Hauptbereich baut den Stapel bis Wartet ab, alles andere legt eine Ebene obenauf. */
export function gehe(adresse) {
  const ziel = parse(adresse);
  if (!ziel || ziel.adresse === ort().adresse) return;
  stand.set(location.hash, scrollY);
  if (BEREICHE.includes(ziel.ansicht) && !ziel.blatt) {
    const t = tiefe();
    const danach = () => {
      ueberspringen = false;
      if (ziel.adresse !== WARTET.adresse) history.pushState({ tiefe: 1 }, '', ziel.adresse);
      anzeigen();
    };
    if (t > 0) { ueberspringen = true; addEventListener('popstate', danach, { once: true }); history.go(-t); }
    else danach();
    return;
  }
  history.pushState({ tiefe: tiefe() + 1 }, '', ziel.adresse);
  anzeigen();
}

/** Der Pfeil Zurück der oberen Leiste: eine Ebene hoch, auf der obersten Ebene zu Wartet. */
export function zurueck() {
  if (tiefe() > 0) history.back();
  else { history.replaceState({ tiefe: 0 }, '', WARTET.adresse); anzeigen(); }
}

/**
 * Meldet, dass ein Blatt geschlossen wurde (Zurück, Esc, Abbrechen, Tippen daneben). Steht die Adresse noch
 * auf dem Blatt, nimmt das den Eintrag des Blatts aus dem Verlauf; hat schon Zurück im Verlauf die Adresse
 * gewechselt, bleibt alles, wie es ist.
 */
export function blattGeschlossen() {
  if (ort().blatt) history.back();
}

/** Startet die Navigation: baut bei einem frischen Start oder tiefen Link den Stapel auf und zeigt die Ansicht. */
export function starten(anzeige) {
  zeigen = anzeige;
  history.scrollRestoration = 'manual';
  const o = ort();
  if (history.state?.tiefe === undefined) {
    const adressen = [...stapelUnter(o), o.adresse];
    history.replaceState({ tiefe: 0 }, '', adressen[0]);
    adressen.slice(1).forEach((a, i) => history.pushState({ tiefe: i + 1 }, '', a));
  } else if (location.hash !== o.adresse) {
    history.replaceState(history.state, '', o.adresse);
  }
  addEventListener('popstate', () => { if (!ueberspringen) anzeigen(); });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    gehe(a.getAttribute('href'));
  });
  anzeigen();
}
