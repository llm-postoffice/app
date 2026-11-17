// Der Hinweis unten (Snackbar, UDI-1, URM-2): sagt in einem Satz, was die App gerade gespeichert hat, und bietet zehn Sekunden
// lang **Rückgängig** an. Er steht über der Aktionsleiste in `#hinweis`, außerhalb des Inhalts: ein Wechsel der Ansicht oder
// das Schließen des Blatts nimmt ihn nicht weg. Es gibt höchstens einen Hinweis; ein neuer ersetzt den alten (dessen
// Sendung geht dann nach ihrer Frist raus). Eine Meldung, die während Rückgängig kommt (das Senden scheitert genau am Ende der
// Frist, oft ein paar Millisekunden vor dem Hinweis), wartet und erscheint, sobald Rückgängig endet; ein neuer Hinweis oder
// **Rückgängig** verwirft sie. Der Zeitgeber ist ein Parameter, damit eine Vorschau den Hinweis stehen lässt.
import { RUECKGAENGIG_MS } from './schreiben.js';

const DANACH_MS = 5_000;
const MELDUNG_MS = 8_000;

/**
 * Baut die Anzeige auf die Elemente der Seite und gibt `zeige({ text, rueckgaengig, nicht })` zurück. `rueckgaengig` ist die
 * Funktion, die die Sendung zurücknimmt und `true` meldet, wenn es gelang; danach zeigt der Hinweis einen Satz ohne Knopf.
 */
export function baueHinweis({ zeitgeber = { setze: (f, ms) => setTimeout(f, ms), loesche: (t) => clearTimeout(t) }, ms = RUECKGAENGIG_MS, wurzel = document } = {}) {
  const kasten = wurzel.getElementById('hinweis');
  const text = wurzel.getElementById('hinweis-text');
  const knopf = wurzel.getElementById('hinweis-knopf');
  let timer = null;
  let aktuell = null;
  let spaeter = null;   // der Satz, der nach dem Ende von Rückgängig kommt
  const weg = () => { zeitgeber.loesche(timer); timer = null; aktuell = null; kasten.hidden = true; knopf.hidden = true; text.textContent = ''; };
  const zeige = ({ text: satz, rueckgaengig, nicht = 'Die Sendung ist schon unterwegs und lässt sich nicht mehr zurücknehmen.' }) => {
    zeitgeber.loesche(timer);
    spaeter = null;
    const mein = {};
    aktuell = mein;
    text.textContent = satz;
    knopf.hidden = false;
    kasten.hidden = false;
    knopf.onclick = async () => {
      if (aktuell !== mein) return;
      knopf.hidden = true;
      spaeter = null;
      zeitgeber.loesche(timer);
      const ok = await rueckgaengig();
      if (aktuell !== mein) return;
      text.textContent = ok ? 'Zurückgenommen. Deine Eingabe liegt wieder als Entwurf auf diesem Gerät.' : nicht;
      timer = zeitgeber.setze(weg, DANACH_MS);
    };
    timer = zeitgeber.setze(() => { const satz2 = spaeter; spaeter = null; weg(); if (satz2) meldung(satz2); }, ms);
  };
  /**
   * Ein Satz ohne Knopf, etwa „wartet auf Netz“. Steht gerade ein Hinweis mit Rückgängig, bleibt er und der Satz folgt, wenn
   * Rückgängig endet; eine Rückgängig-Zeile kommt nie dazwischen. Gibt `true` zurück, der Satz ist also zugesagt.
   */
  const meldung = (satz) => {
    if (aktuell && !knopf.hidden) { spaeter = satz; return true; }
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
