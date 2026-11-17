// Der Hinweis unten (Snackbar, UDI-1, URM-2): sagt in einem Satz, was die App gerade gespeichert hat, und bietet zehn Sekunden
// lang **Rückgängig** an. Er steht über der Aktionsleiste in `#hinweis`, außerhalb des Inhalts: ein Wechsel der Ansicht oder
// das Schließen des Blatts nimmt ihn nicht weg. Es gibt höchstens einen Hinweis; ein neuer ersetzt den alten (dessen
// Sendung geht dann nach ihrer Frist raus). Der Zeitgeber ist ein Parameter, damit eine Vorschau den Hinweis stehen lässt.
import { RUECKGAENGIG_MS } from './schreiben.js';

const DANACH_MS = 5_000;
const MELDUNG_MS = 8_000;

/**
 * Baut die Anzeige auf die Elemente der Seite und gibt `zeige({ text, rueckgaengig })` zurück. `rueckgaengig` ist die
 * Funktion, die die Sendung zurücknimmt und `true` meldet, wenn es gelang; danach zeigt der Hinweis einen Satz ohne Knopf.
 */
export function baueHinweis({ zeitgeber = { setze: (f, ms) => setTimeout(f, ms), loesche: (t) => clearTimeout(t) }, ms = RUECKGAENGIG_MS, wurzel = document } = {}) {
  const kasten = wurzel.getElementById('hinweis');
  const text = wurzel.getElementById('hinweis-text');
  const knopf = wurzel.getElementById('hinweis-knopf');
  let timer = null;
  let aktuell = null;
  const weg = () => { zeitgeber.loesche(timer); timer = null; aktuell = null; kasten.hidden = true; knopf.hidden = true; text.textContent = ''; };
  const zeige = ({ text: satz, rueckgaengig }) => {
    zeitgeber.loesche(timer);
    const mein = {};
    aktuell = mein;
    text.textContent = satz;
    knopf.hidden = false;
    kasten.hidden = false;
    knopf.onclick = async () => {
      if (aktuell !== mein) return;
      knopf.hidden = true;
      zeitgeber.loesche(timer);
      const ok = await rueckgaengig();
      if (aktuell !== mein) return;
      text.textContent = ok ? 'Zurückgenommen. Deine Eingabe liegt wieder als Entwurf auf diesem Gerät.' : 'Die Sendung ist schon unterwegs und lässt sich nicht mehr zurücknehmen.';
      timer = zeitgeber.setze(weg, DANACH_MS);
    };
    timer = zeitgeber.setze(weg, ms);
  };
  /**
   * Ein Satz ohne Knopf, etwa „wartet auf Netz“. Steht gerade ein Hinweis mit Rückgängig, bleibt er; dann gibt es `false`
   * zurück und der Aufrufer meldet später noch einmal.
   */
  const meldung = (satz) => {
    if (aktuell && !knopf.hidden) return false;
    zeitgeber.loesche(timer);
    aktuell = {};
    text.textContent = satz;
    knopf.hidden = true;
    kasten.hidden = false;
    timer = zeitgeber.setze(weg, MELDUNG_MS);
    return true;
  };
  return { zeige, weg, meldung };
}
