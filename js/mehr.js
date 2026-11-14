// Mehr: die ruhigen Ziele (Eingang, Ideensammlung, Suche), die Anmeldung, die Mitteilungen über ntfy, die Installation und
// der Abschnitt Dieses Gerät mit Name, Speicher, Fassung und Stand des Abgleichs. Die Ansicht ist eine Funktion von Welt
// und Zustand des Abgleichs; anzeigen.js zeichnet sie neu, wenn sich etwas ändert. Alle Texte kommen aus texte.js oder
// stehen hier; Daten gehen nur über el() in den Baum (USI-1).
import { el } from './dom.js';
import { TAKTE } from './steuerung.js';
import { einstellung, setzeEinstellung } from './speicher.js';
import { WEITER_BEIM_OEFFNEN, abgleichZeile, fehlerAnzeige, fortschrittAnzeige, speicherAnzeige } from './texte.js';
import { VERSION } from './version.js';
import { band, feld, knopf, linkKnopf, ruhigeKarte } from './karten.js';
import { zaehler } from './welt.js';
import { ablaufAnzeige, pruefeGeraet } from './anmeldung.js';
import { fehlerKnoepfe } from './ansichten.js';
import { ladeAnmeldung } from './anmelden.js';
import { eintraege as eintraegeText, ideen as ideenText } from './ansichtstexte.js';

const TAKT_TEXT = { 60: 'jede Minute', 120: 'alle 2 Minuten', 300: 'alle 5 Minuten', 900: 'alle 15 Minuten', 0: 'nur mit dem Knopf' };
const BAND_TON = { ruhig: 'info', warnung: 'warn', fehler: 'fehler' };

const abschnitt = (titel, ...kinder) => [el('h2', {}, titel), ...kinder];

function fortschritt(z) {
  const a = fortschrittAnzeige(z.fortschritt);
  return el('div', { class: 'fortschritt' },
    el('p', {}, a.text),
    el('progress', { max: a.max ?? false, value: a.max !== null ? a.wert : false, 'aria-label': 'Fortschritt des Abgleichs' }),
    z.letzter ? null : el('p', { class: 'neben' }, WEITER_BEIM_OEFFNEN));
}

function stand(z, k) {
  if (z.phase === 'laeuft') return [fortschritt(z)];
  if (z.phase === 'ohne-anmeldung') return [el('p', { class: 'neben' }, 'Der Abgleich beginnt, sobald du dich angemeldet hast.')];
  const jetzt = knopf('Jetzt abgleichen', { klasse: 'tonal', an: () => k.steuerung.jetztAbgleichen() });
  if (z.phase === 'fehler') {
    const a = fehlerAnzeige(z.fehler, z.letzter?.geprueft ?? null);
    const knoepfe = fehlerKnoepfe(a, k);
    return [band({
      ton: BAND_TON[a.ton], symbol: a.symbol, titel: a.titel, satz: a.satz, knoepfe,
    }), el('details', {}, el('summary', {}, 'Einzelheiten'), el('pre', {}, a.einzelheiten)), ...(a.aktion ? [] : [jetzt])];
  }
  return [jetzt];
}

const NTFY = [
  'Öffne die App ntfy.', 'Tippe auf +.',
  'Gib das Thema ein, das das Postsystem auf deinem Rechner verwendet. Das Thema steht in keiner Datei dieser App.',
  'Bestätige das Abo in ntfy.',
];

/** Die Ansicht Mehr. */
export async function mehrAnsicht(welt, z, k) {
  const c = zaehler(welt);
  const a = await ladeAnmeldung(k.db);
  const speicher = speicherAnzeige(await einstellung(k.db, 'speicher'), k.db.art, await k.db.zaehle('schlange'));
  const takt = await k.steuerung.takt();
  const taktWahl = el('select', { name: 'takt', id: 'takt' }, TAKTE.map((s) => el('option', { value: String(s), selected: s === takt }, TAKT_TEXT[s])));
  taktWahl.addEventListener('change', async () => {
    await setzeEinstellung(k.db, 'takt', Number(taktWahl.value));
    await k.steuerung.plane();
  });
  const ablauf = a.ablauf ? ablaufAnzeige(a.ablauf, welt.jetzt) : null;
  const anmeldung = a.token
    ? [el('p', {}, `Angemeldet mit einem Token für ${a.repo}. ${ablauf ? ablauf.text : 'Ohne Ablaufdatum: die App warnt nicht vor dem Ablauf.'}`),
      ablauf?.warnung ? band({ ton: 'warn', symbol: 'key-f', titel: ablauf.abgelaufen ? 'Token abgelaufen' : 'Token läuft bald ab', satz: 'Erstelle ein neues Token und trage es ein, ehe GitHub das alte ablehnt.' }) : null,
      linkKnopf('Token ersetzen …', '#anmelden', { klasse: 'tonal' })]
    : [el('p', {}, 'Dieses Gerät ist nicht angemeldet.'), linkKnopf('Anmelden', '#anmelden', { klasse: 'gefuellt' })];
  const installiert = globalThis.matchMedia?.('(display-mode: standalone)').matches;
  const werte = el('dl', { class: 'werte' },
    el('div', { class: 'mit-knopf' }, el('dt', {}, 'Gerät'), el('dd', {}, a.geraet ?? 'noch ohne Namen'), linkKnopf('Ändern …', '#mehr/geraet', { klasse: 'text' })),
    el('div', {}, el('dt', {}, 'Speicher'), el('dd', { id: 'speicher' }, speicher.zeile)),
    el('div', {}, el('dt', {}, 'Fassung'), el('dd', { id: 'fassung' }, VERSION)),
    el('div', {}, el('dt', {}, 'Abgleich'), el('dd', { id: 'abgleich' }, abgleichZeile(z, welt.jetzt))),
    el('div', {}, el('dt', {}, 'Takt im Vordergrund'), el('dd', {}, taktWahl)));
  return [
    speicher.warnung ? band({ ton: 'warn', symbol: 'warning-f', satz: speicher.warnung }) : null,
    el('ul', { class: 'mehr-liste' },
      ruhigeKarte({ symbol: 'inbox-f', titel: 'Eingang', zeile: c.eingang ? `${c.eingang} ${c.eingang === 1 ? 'Eintrag' : 'Einträge'} zum Einsortieren` : 'nichts zum Einsortieren', href: '#eingang' }),
      ruhigeKarte({ symbol: 'lightbulb', titel: 'Ideensammlung', weich: true, zeile: `${c.ideen ? ideenText(c.ideen) : 'keine Ideen'}, sie warten nicht auf dich`, href: '#ideen' }),
      ruhigeKarte({ symbol: 'search', titel: 'Suche und Archiv', zeile: 'auch erledigte und verworfene Einträge', href: '#suche' })),
    ...abschnitt('Anmeldung', ...anmeldung),
    ...abschnitt('Mitteilungen',
      el('p', {}, 'Hinweise kommen über die App ntfy. Ein Tipp auf den Hinweis öffnet ntfy, nicht diese App. Tippe im Hinweis auf ', el('strong', {}, 'ID kopieren'), ' und füge die ID in der Suche ein.'),
      el('details', {}, el('summary', {}, 'Abo in ntfy anlegen'), el('ol', { class: 'ablauf-schritte' }, NTFY.map((s) => el('li', {}, s)))),
      el('p', { class: 'neben' }, 'Ein Abo über einen Link empfängt nichts. Fehlt der Knopf ', el('strong', {}, 'ID kopieren'), ' im Hinweis, ist ntfy älter als Fassung 1.23.0; die ID steht dann im Text des Hinweises.')),
    ...abschnitt('App installieren', el('p', {}, installiert
      ? 'Das Postfach läuft als installierte App.'
      : 'Das Postfach läuft im Browser. Öffne das Menü des Browsers und wähle App installieren, damit es ohne Browserleiste startet.')),
    ...abschnitt('Dieses Gerät', werte, el('div', { id: 'abgleich-stand' }, stand(z, k))),
    welt.hatStand ? el('p', { class: 'neben' }, `Auf diesem Gerät liegen ${eintraegeText(welt.eintraege.size)}.`) : null,
  ];
}

/** Blatt Gerätename: der Name steht in jedem gesendeten Eintrag und in Abnahmen für host:NAME. */
export async function geraetBlatt(k, schliessen) {
  const alt = (await einstellung(k.db, 'geraet')) ?? '';
  const eingabe = el('input', { type: 'text', name: 'geraet', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
  eingabe.value = alt;
  let f = feld({ beschriftung: 'Name dieses Geräts', steuerung: eingabe, hinweis: 'Erlaubt sind Kleinbuchstaben, Ziffern und Bindestrich. Nachträge, die schon in der Schlange liegen, behalten den alten Namen.' });
  const speichern = knopf('Speichern', { klasse: 'gefuellt', an: async () => {
    const r = pruefeGeraet(eingabe.value);
    if (!r.ok) {
      const neu = feld({ beschriftung: 'Name dieses Geräts', steuerung: eingabe, fehler: r.fehler, hinweis: r.vorschlag ? `Vorschlag: ${r.vorschlag}` : null });
      f.replaceWith(neu); f = neu; eingabe.focus();
      return;
    }
    await setzeEinstellung(k.db, 'geraet', r.name);
    schliessen();
  } });
  return { koerper: [f], knoepfe: [knopf('Abbrechen', { klasse: 'text', an: schliessen }), speichern] };
}
