// Adressen der App (UNA-4) und der Stapel darunter (UNA-3). Reine Funktionen ohne Browser, damit
// node --test sie prüft. Jede Ansicht hat eine Adresse im Fragment; ein tiefer Link baut den Stapel
// darunter nach. Die Tabellen stammen aus dem Entwurf und dem Nachtrag zur App.

/** Die vier Hauptbereiche der Navigationsleiste, in der Reihenfolge der Leiste. */
export const BEREICHE = ['wartet', 'abnahmen', 'erfassen', 'mehr'];

const TITEL = {
  wartet: 'Wartet auf dich', abnahmen: 'Abnahmen', erfassen: 'Erfassen', mehr: 'Mehr',
  eingang: 'Eingang', eintrag: 'Eintrag', ideen: 'Ideensammlung', suche: 'Suche', anmelden: 'Anmelden',
};
const BLATT_TITEL = { einsortieren: 'Einsortieren', geraet: 'Gerätename' };

// Welcher Hauptbereich in der Leiste gewählt ist. Eintrag, Abnahme-Schritt und Suche gehören bis Teil D
// zu Wartet; die Daten entscheiden später, ob eine Abnahme unter Abnahmen steht.
const BEREICH_VON = {
  wartet: 'wartet', abnahmen: 'abnahmen', erfassen: 'erfassen', mehr: 'mehr',
  eingang: 'wartet', eintrag: 'wartet', schritt: 'wartet', ideen: 'mehr', suche: 'wartet', anmelden: null,
};

/** Normalisiert eine ID aus einer Adresse: ohne Striche, klein. Aliase und Verwechslungen kommen mit Teil D. */
export function normId(roh) {
  return String(roh).replaceAll('-', '').toLowerCase();
}

/** Zeigt eine ID gegliedert: sechs Zeichen als `k7m-2qa`; andere Längen bleiben, wie sie sind. */
export function idMitStrich(id) {
  const s = normId(id);
  return s.length === 6 ? `${s.slice(0, 3)}-${s.slice(3)}` : s;
}

const ID = '([0-9A-Za-z-]{1,32})';
const MUSTER = [
  [/^#(wartet|abnahmen|erfassen|mehr|eingang|ideen|suche|anmelden)$/, (m) => ({ ansicht: m[1] })],
  [/^#mehr\/geraet$/, () => ({ ansicht: 'mehr', blatt: 'geraet' })],
  [new RegExp(`^#eintrag/${ID}$`), (m) => ({ ansicht: 'eintrag', id: normId(m[1]) })],
  [new RegExp(`^#eintrag/${ID}/einsortieren$`), (m) => ({ ansicht: 'eintrag', id: normId(m[1]), blatt: 'einsortieren' })],
  [new RegExp(`^#eintrag/${ID}/schritt/([1-9][0-9]{0,2})$`), (m) => ({ ansicht: 'schritt', id: normId(m[1]), schritt: Number(m[2]) })],
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
  if (o.ansicht === 'schritt') return `#eintrag/${o.id}/schritt/${o.schritt}`;
  if (o.ansicht === 'eintrag') return `#eintrag/${o.id}${o.blatt ? `/${o.blatt}` : ''}`;
  if (o.ansicht === 'mehr' && o.blatt) return `#mehr/${o.blatt}`;
  return `#${o.ansicht}`;
}

/** Titel der oberen Leiste, höchstens 20 Zeichen (UTX-3). */
export function titelVon(o) {
  return o.ansicht === 'schritt' ? `Schritt ${o.schritt}` : TITEL[o.ansicht];
}

/** Titel des Blatts, das über der Ansicht offen ist, sonst null. */
export function blattTitelVon(o) {
  return o.blatt ? BLATT_TITEL[o.blatt] : null;
}

/** Zeigt die obere Leiste einen Pfeil Zurück? Nur unterhalb der obersten Ebene (UNA-2). */
export function hatZurueck(o) {
  return !BEREICHE.includes(o.ansicht) && o.ansicht !== 'anmelden';
}

/**
 * Adressen, die unter dieser Ansicht auf dem Stapel liegen, von unten nach oben (UNA-3). Das Blatt
 * einer Ansicht liegt als eigene Adresse obenauf; die Ansicht darunter steht hier mit.
 */
export function stapelUnter(o) {
  switch (o.ansicht) {
    case 'wartet': case 'anmelden': return [];
    case 'ideen': return ['#wartet', '#mehr'];
    case 'mehr': return o.blatt ? ['#wartet', '#mehr'] : ['#wartet'];
    case 'eintrag': return o.blatt === 'einsortieren' ? ['#wartet', '#eingang', `#eintrag/${o.id}`] : ['#wartet'];
    case 'schritt': return ['#wartet', `#eintrag/${o.id}`];
    default: return ['#wartet'];   // abnahmen, erfassen, eingang, suche
  }
}
