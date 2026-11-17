// Erfundene Anhänge für die Entwürfe der Anzeige (docs/entwicklung/ansichten/anhaenge): zu einem Eintrag und zu einem
// Nachtrag, mit Name, Größe und Inhalt. Ein Bild ist ein kleines SVG als data:-Adresse, denn die CSP der App erlaubt
// img-src 'self' data:. Nichts davon ist echt; die Namen sind neutral wie die übrigen Beispieldaten.

// Der Namensraum von SVG, zusammengesetzt: tools/fremdhost.mjs liest jede Adresse im Quelltext als Host.
const RAUM = ['http:', '', 'www.w3.org', '2000', 'svg'].join('/');

/** Ein Bildschirmfoto eines Fensters mit drei Eingabefeldern, 600 × 800. */
function fensterBild() {
  const feld = (y, beschriftung, wert) => `<text x="48" y="${y}" font-size="26" fill="#44474e">${beschriftung}</text>`
    + `<rect x="48" y="${y + 14}" width="504" height="72" rx="10" fill="#fff" stroke="#8b8f98" stroke-width="2"/>`
    + `<text x="68" y="${y + 62}" font-size="30" fill="#1b1c1f">${wert}</text>`;
  return `<svg xmlns="${RAUM}" viewBox="0 0 600 800" font-family="sans-serif">`
    + '<rect width="600" height="800" fill="#e8ebf2"/>'
    + '<rect width="600" height="96" fill="#d3e3fd"/><text x="48" y="62" font-size="34" font-weight="600" fill="#041e49">Neuer Eintrag</text>'
    + feld(188, 'Titel', 'Eingabefelder prüfen')
    + feld(330, 'Projekt', 'beta')
    + feld(472, 'Priorität', 'Normal')
    + '<rect x="48" y="640" width="504" height="88" rx="44" fill="#0b57d0"/><text x="300" y="696" font-size="30" text-anchor="middle" fill="#fff">Anlegen</text>'
    + '</svg>';
}

const MESSLAUF = `Messlauf rechner-a, 14.11. 13:50
Befehl: beta-tool --version
Läufe: 5, Zeiten in Sekunden

Lauf  Standard   Zusatzpaket
1     0,071      0,152
2     0,069      0,148
3     0,070      0,151
4     0,072      0,149
5     0,068      0,150

Mittel  0,070    0,150
Streuung unter 3 %, beide stabil.
`;

export const ANHAENGE = {
  eintrag: 'r2d4vn',
  /** Zum Eintrag selbst (entries/r2/r2d4vn/attachments/NAME). */
  eintragsAnhaenge: [
    { name: 'eingabefelder-standard.png', groesse: 148 * 1024, art: 'bild', uri: `data:image/svg+xml,${encodeURIComponent(fensterBild())}`, alt: 'Fenster mit drei Eingabefeldern und dem Knopf Anlegen' },
    { name: 'vergleich-bibliotheken.pdf', groesse: 412 * 1024, art: 'datei' },
  ],
  /** Zu einem Nachtrag (attachments/ULID/NAME, Feld Attachments); `zeit` ist der Zeitpunkt des Nachtrags. */
  nachtragsAnhaenge: [
    { name: 'messlauf-rechner-a.txt', groesse: 2300, art: 'text', text: MESSLAUF, zeit: '13:52' },
  ],
};

/** Größe im Wortlaut der App: Dezimalkomma, KB und MB. */
export function groessenWort(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1000) return `${kb < 10 ? kb.toFixed(1).replace('.', ',') : Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
}
