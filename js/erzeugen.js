// Kennungen und Zeit für neue Dateien: ULIDs, neue IDs und der Stempel „user, GERÄT, ZEIT“. Reine Funktionen; der
// Zufall kommt aus crypto.getRandomValues und ist als Parameter austauschbar, damit node --test feste Werte prüft.
// Port von ulid() und new_id() aus dem Postsystem (docs/format.md dort, Abschnitt „IDs, Aliase, ULIDs“).
import { ID_RE, zeitText } from './format.js';
import { einstellung, setzeEinstellung } from './speicher.js';

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ID_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
/** Neue IDs beginnen mit einem Buchstaben und haben nie mehr als zwei Ziffern in Folge (NEW_ID_RE im Postsystem). */
export const NEUE_ID_RE = /^(?=[a-hjkmnp-tv-z])(?!.*[0-9]{3})[0-9a-hjkmnp-tv-z]{6}$/;

/** Zufallsbytes: crypto.getRandomValues, im Test durch eine feste Folge ersetzbar. */
export const zufallsbytes = (n) => crypto.getRandomValues(new Uint8Array(n));

/** Zeit als 10 Zeichen Crockford-Base32 (ms seit 1970). */
function zeitTeil(ms) {
  let rest = Math.floor(ms);
  let aus = '';
  for (let i = 0; i < 10; i++) { aus = ULID_ALPHABET[rest % 32] + aus; rest = Math.floor(rest / 32); }
  return aus;
}

/**
 * Ein Erzeuger für ULIDs: 10 Zeichen Zeit und 16 Zeichen Zufall (80 Bit). Innerhalb derselben Millisekunde wächst der
 * Zufallsteil um 1, so ordnen sich die Dateien einer Sendung in der Reihenfolge, in der sie entstehen (die Reihenfolge
 * der Dateien ist die Reihenfolge der Namen). `zeit()` liefert die Uhr in ms (schon um die Abweichung korrigiert).
 */
export function ulidErzeuger(zeit = () => Date.now(), zufall = zufallsbytes) {
  let letzteMs = -1;
  let letzter = 0n;
  return () => {
    const ms = Math.max(zeit(), letzteMs);
    let rest;
    if (ms === letzteMs) {
      rest = letzter + 1n;
      if (rest >= 1n << 80n) throw new Error('ULID-Überlauf');
    } else {
      rest = 0n;
      for (const b of zufall(10)) rest = (rest << 8n) | BigInt(b);
    }
    letzteMs = ms;
    letzter = rest;
    let aus = '';
    for (let i = 0, r = rest; i < 16; i++, r >>= 5n) aus = ULID_ALPHABET[Number(r & 31n)] + aus;
    return zeitTeil(ms) + aus;
  };
}

/**
 * Zieht eine freie ID nach NEUE_ID_RE und merkt sie in `vergeben`. Gleichverteilt aus allen 32^6 Folgen; was die Regel
 * verletzt, fällt weg, so bleibt jede gültige ID gleich wahrscheinlich.
 */
export function neueId(vergeben, zufall = zufallsbytes) {
  for (;;) {
    let wert = '';
    for (const b of zufall(6)) wert += ID_ALPHABET[b & 31];
    if (NEUE_ID_RE.test(wert) && ID_RE.test(wert) && !vergeben.has(wert)) { vergeben.add(wert); return wert; }
  }
}

/** Der Stempel `user, GERÄT, ZEIT` für By und From (ohne Signatur, Annahme 8). */
export const stempel = (geraet, ms) => `user, ${geraet}, ${zeitText(ms)}`;

// ---- Uhr des Geräts

/**
 * Wie weit weicht die Uhr des Geräts von der von GitHub ab? `serverzeit` ist der Date-Kopf einer Antwort (ms), `lokal`
 * die Uhr des Geräts, als die Antwort ankam. Der Kopf hat Sekunden, die Antwort brauchte etwas Zeit: Abweichungen unter
 * zwei Sekunden zählen als null. Ergebnis in ms; positiv heißt, die Uhr des Geräts geht nach.
 */
export function uhrAbweichung(serverzeit, lokal) {
  if (!Number.isFinite(serverzeit)) return null;
  const d = serverzeit - lokal;
  return Math.abs(d) < 2000 ? 0 : d;
}

/** Ab dieser Abweichung warnt Mehr: 60 s. Darunter korrigiert die App still, weil es nichts ordnet. */
export const UHR_WARNUNG_MS = 60_000;

/** „3 min vor“, „2 Stunden nach“ für die Anzeige; `ms` ist serverzeit minus lokal. */
export function abweichungText(ms) {
  const betrag = Math.abs(ms);
  const min = Math.round(betrag / 60000);
  const was = betrag < 90_000 ? `${Math.max(1, Math.round(betrag / 1000))} s`
    : min < 90 ? `${min} min` : betrag < 36 * 3600_000 ? `${Math.round(betrag / 3600_000)} ${Math.round(betrag / 3600_000) === 1 ? 'Stunde' : 'Stunden'}`
      : `${Math.round(betrag / 86400_000)} Tage`;
  return `${was} ${ms < 0 ? 'vor' : 'nach'}`;
}

/** Merkt die Abweichung der Uhr aus dem Date-Kopf einer Antwort (Einstellung „uhr“); ohne Kopf bleibt der alte Wert. */
export async function merkeUhr(db, serverzeit, lokal) {
  const abweichung = uhrAbweichung(serverzeit, lokal);
  if (abweichung === null) return;
  await setzeEinstellung(db, 'uhr', { abweichung, gemessen: lokal });
}

/** Die Uhr des Geräts, auf die Zeit von GitHub umgerechnet: so entstehen ULIDs und Stempel (die Uhr ordnet die Dateien). */
export async function korrigierteZeit(db, lokal) {
  return lokal + ((await einstellung(db, 'uhr'))?.abweichung ?? 0);
}
