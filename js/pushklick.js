// Ein Tipp auf die Web-Push-Mitteilung: die App gleicht zuerst ab und öffnet dann das Ziel, damit ein neuer Eintrag schon da ist
// (sonst stünde dort „nicht gefunden“, bis der Takt fällig ist). Rein und unter node --test; app.js verbindet es mit dem Browser.
import { wartetListe } from './welt.js';

/** Kam die Seite durch einen Tipp (`?push` in der Adresse eines neuen Fensters)? */
export const kamDurchTipp = (suche = '') => new URLSearchParams(suche).has('push');

/**
 * Wohin führt der Tipp nach dem Abgleich? Eine Nutzlast nennt das Ziel (Eintrag, Abnahmen). Ohne sie (das Postwerkzeug sendet
 * keine) der neueste Eintrag an dich, den der Stand vor dem Abgleich (`vorher`, Menge der IDs) noch nicht kannte; gibt es keinen,
 * Wartet. Ein Eintrag, den ein früherer Abgleich schon holte, gilt als gesehen.
 */
export function tippZiel(welt, vorher, ziel) {
  if (ziel !== '#wartet') return ziel;
  const neu = wartetListe(welt).filter(({ e }) => !vorher.has(e.id)).sort((a, b) => b.st.created - a.st.created);
  return neu.length ? `#eintrag/${neu[0].e.id}` : '#wartet';
}

const idsVon = (welt) => new Set(welt.liste.map(({ e }) => e.id));

/**
 * Der Ablauf nach einem Tipp: den Stand vor dem Abgleich merken (`vorher`, sonst jetzt aus `ladeWelt`), abgleichen, den Stand neu
 * lesen und das Ziel öffnen. Der Abgleich läuft immer zuerst; scheitert er, öffnet das Ziel trotzdem (die Ansicht des Eintrags sagt dann
 * warum er fehlt). Mit `gesperrt` (etwa vor der Anmeldung) öffnet nichts. Gibt die geöffnete Adresse zurück.
 */
export async function folgeTipp({ ziel, vorher = null, abgleichen, ladeWelt, oeffne, gesperrt = () => false }) {
  vorher ??= idsVon(await ladeWelt());
  await abgleichen();
  if (gesperrt()) return null;
  const adresse = tippZiel(await ladeWelt(), vorher, ziel);
  oeffne(adresse);
  return adresse;
}
export { idsVon };
