// Adressen der App (UNA-4) und der Stapel darunter (UNA-3). Reine Funktionen ohne Browser, damit
// node --test sie prüft. Jede Ansicht hat eine Adresse im Fragment; ein tiefer Link baut den Stapel
// darunter nach. Die Tabellen stammen aus dem Entwurf und dem Nachtrag zur App.
import { idMitStrich as gliedern, normId as normalisiere } from './format.js';

/** Die fünf Hauptbereiche der Navigationsleiste, in der Reihenfolge der Leiste. */
export const BEREICHE = ['wartet', 'alle', 'abnahmen', 'erfassen', 'mehr'];

const TITEL = {
  wartet: 'Wartet auf dich', alle: 'Alle offenen', abnahmen: 'Abnahmen', erfassen: 'Erfassen', mehr: 'Mehr',
  eingang: 'Eingang', eintrag: 'Eintrag', ideen: 'Ideensammlung', suche: 'Suche', anmelden: 'Anmelden', ergebnis: 'Ergebnis',
};
const BLATT_TITEL = { einsortieren: 'Einsortieren', geraet: 'Gerätename', antworten: 'Deine Antwort' };
/** Die Auswahlen des Blatts in Alle: Adresse `#alle/NAME` und Titel. */
export const AUSWAHL_TITEL = { status: 'Status', projekt: 'Projekt', art: 'Art', prio: 'Priorität', sortieren: 'Sortieren nach' };

// Welcher Hauptbereich in der Leiste gewählt ist, solange die Daten nichts anderes sagen: Eintrag, Abnahme-Schritt
// und Suche gehören zu Wartet. anzeigen.js wählt für eine Abnahme Abnahmen und für eine Idee Mehr, wenn es den
// Eintrag kennt (bereichVonArt).
const BEREICH_VON = {
  wartet: 'wartet', alle: 'alle', abnahmen: 'abnahmen', erfassen: 'erfassen', mehr: 'mehr',
  eingang: 'wartet', eintrag: 'wartet', schritt: 'wartet', ergebnis: 'wartet', ideen: 'mehr', suche: 'wartet', anmelden: null,
};

/**
 * Normalisiert eine ID aus einer Adresse oder einer Eingabe wie `norm_id` im Postsystem: Striche fallen weg (auch
 * die kopierten), Großbuchstaben werden klein, `o` wird `0`, `i` und `l` werden `1`. Das ist eindeutig, weil
 * das Alphabet der IDs kein `o`, `i` und `l` kennt.
 */
export const normId = (roh) => normalisiere(String(roh));

/** Zeigt eine ID gegliedert: sechs Zeichen als `k7m-2qa`; andere Längen bleiben, wie sie sind. */
export function idMitStrich(id) {
  return gliedern(normId(id));
}

/** Die Art eines Eintrags bestimmt den Bereich der Leiste: Abnahmen unter Abnahmen, Ideen unter Mehr. */
export const bereichVonArt = (kind) => (kind === 'test' ? 'abnahmen' : kind === 'idea' ? 'mehr' : 'wartet');

const ID = '([0-9A-Za-z-]{1,32})';
const MUSTER = [
  [/^#(wartet|alle|abnahmen|erfassen|mehr|eingang|ideen|suche|anmelden)$/, (m) => ({ ansicht: m[1] })],
  [/^#alle\/(status|projekt|art|prio|sortieren)$/, (m) => ({ ansicht: 'alle', blatt: 'auswahl', welche: m[1] })],
  [/^#mehr\/geraet$/, () => ({ ansicht: 'mehr', blatt: 'geraet' })],
  [new RegExp(`^#eintrag/${ID}$`), (m) => ({ ansicht: 'eintrag', id: normId(m[1]) })],
  [new RegExp(`^#eintrag/${ID}/einsortieren$`), (m) => ({ ansicht: 'eintrag', id: normId(m[1]), blatt: 'einsortieren' })],
  [new RegExp(`^#eintrag/${ID}/antworten$`), (m) => ({ ansicht: 'eintrag', id: normId(m[1]), blatt: 'antworten' })],
  [new RegExp(`^#eintrag/${ID}/ergebnis$`), (m) => ({ ansicht: 'ergebnis', id: normId(m[1]) })],
  [new RegExp(`^#eintrag/${ID}/schritt/([1-9][0-9]{0,2})$`), (m) => ({ ansicht: 'schritt', id: normId(m[1]), schritt: Number(m[2]) })],
  [new RegExp(`^#eintrag/${ID}/schritt/([1-9][0-9]{0,2})/(fail|blocked|skip)$`), (m) => ({
    ansicht: 'schritt', id: normId(m[1]), schritt: Number(m[2]), blatt: 'satz', wort: m[3].toUpperCase(),
  })],
];

/**
 * Liest eine Adresse (location.hash). Ergebnis: ansicht, bereich (Leiste), adresse (die genormte Form)
 * und je nach Ansicht id, schritt, blatt. Eine leere oder unbekannte Adresse ergibt null.
 */
export function parse(hash) {
  for (const [muster, bauen] of MUSTER) {
    const m = muster.exec(hash || '');
    if (!m) continue;
    const o = bauen(m);
    o.bereich = BEREICH_VON[o.ansicht];
    o.adresse = adresseVon(o);
    return o;
  }
  return null;
}

/** Baut die genormte Adresse einer Ansicht. */
export function adresseVon(o) {
  if (o.ansicht === 'schritt') return `#eintrag/${o.id}/schritt/${o.schritt}${o.blatt ? `/${o.wort.toLowerCase()}` : ''}`;
  if (o.ansicht === 'ergebnis') return `#eintrag/${o.id}/ergebnis`;
  if (o.ansicht === 'eintrag') return `#eintrag/${o.id}${o.blatt ? `/${o.blatt}` : ''}`;
  if (o.ansicht === 'mehr' && o.blatt) return `#mehr/${o.blatt}`;
  if (o.ansicht === 'alle' && o.blatt) return `#alle/${o.welche}`;
  return `#${o.ansicht}`;
}

/** Titel der oberen Leiste, höchstens 20 Zeichen (UTX-3). */
export function titelVon(o) {
  return o.ansicht === 'schritt' ? `Schritt ${o.schritt}` : TITEL[o.ansicht];
}

/** Titel des Blatts, das über der Ansicht offen ist, sonst null. */
export function blattTitelVon(o) {
  if (o.blatt === 'satz') return `${o.wort} für Schritt ${o.schritt}`;
  if (o.blatt === 'auswahl') return AUSWAHL_TITEL[o.welche];
  return o.blatt ? BLATT_TITEL[o.blatt] : null;
}

/** Zeigt die obere Leiste einen Pfeil Zurück? Nur unterhalb der obersten Ebene (UNA-2). */
export function hatZurueck(o) {
  return !BEREICHE.includes(o.ansicht) && o.ansicht !== 'anmelden';
}

/**
 * Adressen, die unter dieser Ansicht auf dem Stapel liegen, von unten nach oben (UNA-3). Das Blatt
 * einer Ansicht liegt als eigene Adresse obenauf; die Ansicht darunter steht hier mit. `ort(id)` darf sagen,
 * woher ein Eintrag kommt (eingang, ideen, abnahmen); ohne Auskunft liegt er unter Wartet.
 */
export function stapelUnter(o, ort = () => null) {
  const unterEintrag = (id, vorgabe = null) => {
    switch (ort(id) ?? vorgabe) {
      case 'eingang': return ['#wartet', '#eingang'];
      case 'ideen': return ['#wartet', '#mehr', '#ideen'];
      case 'abnahmen': return ['#wartet', '#abnahmen'];
      default: return ['#wartet'];
    }
  };
  switch (o.ansicht) {
    case 'wartet': case 'anmelden': return [];
    case 'alle': return o.blatt ? ['#wartet', '#alle'] : ['#wartet'];
    case 'ideen': return ['#wartet', '#mehr'];
    case 'mehr': return o.blatt ? ['#wartet', '#mehr'] : ['#wartet'];
    case 'eintrag': {
      // Einsortieren gibt es nur im Eingang: das Blatt allein sagt es schon
      const unten = unterEintrag(o.id, o.blatt === 'einsortieren' ? 'eingang' : null);
      return o.blatt ? [...unten, `#eintrag/${o.id}`] : unten;
    }
    case 'schritt': {
      const unten = [...unterEintrag(o.id), `#eintrag/${o.id}`];
      return o.blatt ? [...unten, `#eintrag/${o.id}/schritt/${o.schritt}`] : unten;
    }
    case 'ergebnis': return [...unterEintrag(o.id), `#eintrag/${o.id}`];
    default: return ['#wartet'];   // abnahmen, erfassen, eingang, suche
  }
}
