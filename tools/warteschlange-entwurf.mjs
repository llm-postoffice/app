// Entwurf der Anzeige der Warteschlange, nur für die Vorschau (tools/vorschau.mjs lädt ihn für Szenarien mit `warteschlange`).
// Er setzt nach dem Start der App drei Varianten in die Ansichten ein; die App selbst zeigt die Schlange bisher nur als Zeile
// an der Karte und im Eintrag.
//   1  Band oben in Wartet, das eine eigene Seite „Noch nicht gesendet“ öffnet
//   2  Abschnitt „Noch nicht gesendet“ in Mehr, dazu eine Plakette an Mehr in der Leiste
//   3  Neue Einträge als eigene Karten oben in Wartet; Erneut senden und Verwerfen stehen im Eintrag
// Zustand `seite`: 'einstieg' (der Ort, an dem man es sieht), 'liste' (die Verwaltung) oder 'eintrag' (der offline angelegte Eintrag).
// Gebaut mit el() und ico() der App.
import { el, ico } from '../js/dom.js';
import { ARTEN } from '../js/ansichtstexte.js';
import { band, chipArt, chipZustand, gruppentitel, idSpan, knopf, kopfkarte, projektSpan, zustandsZeile } from '../js/karten.js';
import { textBlock } from '../js/eintrag.js';

const WARTET = { symbol: 'cloud_upload-f', rolle: 's-warn', text: 'Wartet auf Netz, geht danach raus' };
const HAENGT = { symbol: 'error-f', rolle: 's-fehler', text: 'Nicht gesendet: GitHub nimmt die Sendung nicht an' };

/** Die Sendungen des Szenarios, so wie die Schreibschicht sie ablegt; der Titel des Eintrags kommt aus den Beispieldaten. */
const SENDUNGEN = [
  { id: 'w4', was: 'Antwort', titel: 'Befund: release scheitert bei Projekten ohne Eintrag', zustand: HAENGT, grund: 'GitHub lehnt die Sendung ab (Validation Failed).', hang: true, ziel: 'm7q2ke' },
  { id: 'w1', was: 'Antwort „A“', titel: 'Welche Bibliothek für die Oberfläche?', zustand: WARTET, ziel: 'r2d4vn' },
  { id: 'w2', was: 'Neuer Eintrag', titel: 'Eingabefelder prüfen', zustand: WARTET, neu: true, ziel: 'n9x4kt' },
  { id: 'w3', was: 'Einsortieren an alpha', titel: 'Notiz: Abo der Hinweise auf rechner-a prüfen', zustand: WARTET, ziel: 'k7m2qa' },
];
const NEU = SENDUNGEN.find((s) => s.neu);
const wartend = SENDUNGEN.filter((s) => !s.hang).length;

const SATZ_ALLE = `${wartend} warten auf Netz und gehen raus, sobald du online bist. Eine hängt und braucht dich.`;
const titelAlle = `${SENDUNGEN.length} Sendungen noch nicht gesendet`;

function css() {
  if (document.querySelector('link[data-ws-css]')) return;
  document.head.append(el('link', { rel: 'stylesheet', href: new URL('./warteschlange-entwurf.css', import.meta.url).href, 'data-ws-css': '' }));
}

// ---- Bausteine

const verwerfen = () => knopf('Verwerfen', { klasse: 'text' });

/** Eine Zeile der Liste: was, Eintrag, Zustand, Knöpfe; ein Tipp auf den Kopf öffnet den Eintrag (Neuer Eintrag: die lokale Seite). */
function zeile(s) {
  const kopf = el('button', { type: 'button', class: 'ws-kopf', 'data-ws-ziel': s.ziel },
    el('span', { class: 'ws-was' }, s.was),
    el('b', {}, s.titel),
    ico('chevron_right'));
  kopf.addEventListener('click', () => (s.neu ? neuerEintrag() : (location.hash = `#eintrag/${s.ziel}`)));
  return el('li', { class: `ws-zeile${s.hang ? ' haengt' : ''}` }, kopf, chipZustand(s.zustand),
    s.grund ? el('p', { class: 'ws-grund' }, `${s.grund} Deine Eingabe bleibt auf diesem Gerät.`) : null,
    el('div', { class: 'zeilenknoepfe' }, s.hang ? knopf('Erneut senden') : null, verwerfen()));
}

const liste = () => el('ul', { class: 'ws-liste' }, SENDUNGEN.map(zeile));

/** Ganze Seite über der App, wie ein Eintrag mit Zurück. */
function seite(titel, ...inhalt) {
  const zu = el('button', { type: 'button', class: 'symbol', 'aria-label': 'Zurück' }, ico('arrow_back'));
  const voll = el('div', { class: 'ws-voll', 'data-ws': 'seite' },
    el('div', { class: 'ws-voll-kopf' }, zu, el('h2', {}, titel)),
    el('div', { class: 'ws-voll-koerper' }, ...inhalt));
  zu.addEventListener('click', () => voll.remove());
  document.body.append(voll);
  return voll;
}

/** Der Eintrag, den dieses Gerät offline angelegt hat: er steht nur in der Schlange, GitHub kennt ihn noch nicht. */
function neuerEintrag() {
  const m = { art: ARTEN.task, dringend: false, idText: 'n9x-4kt', projekt: 'beta', an: '', titel: NEU.titel, von: null, zustand: { ...WARTET, stark: true } };
  return seite('Neuer Eintrag',
    kopfkarte(m, { rangText: 'Priorität Normal' }),
    band({ ton: 'warn', symbol: 'cloud_upload-f', titel: 'Noch nicht gesendet',
      satz: 'Der Eintrag liegt auf diesem Gerät und geht raus, sobald du online bist.', knoepfe: [verwerfen()] }),
    textBlock('Bitte bis Freitag. Die Eingabefelder beider Bibliotheken vergleichen, Messwerte im Anhang.'));
}

/** Seite „Noch nicht gesendet“ mit allen Zeilen. */
const listenSeite = () => seite('Noch nicht gesendet', el('p', { class: 'neben' }, 'Ohne Netz bleiben deine Eingaben auf diesem Gerät. Was hängt, geht erst nach Erneut senden raus.'), liste());

// ---- Varianten

function einstieg1() {
  const inhalt = document.getElementById('inhalt');
  if (document.querySelector('[data-ws="band"]')) return;
  const b = band({ ton: 'warn', symbol: 'cloud_upload-f', titel: titelAlle, satz: SATZ_ALLE, knoepfe: [knopf('Anzeigen', { klasse: 'tonal', an: listenSeite })] });
  b.dataset.ws = 'band';
  inhalt.prepend(b);
}

function einstieg2() {
  const sym = document.querySelector('#leiste a[data-bereich="mehr"] .sym');
  if (sym && !sym.querySelector('.plakette')) sym.append(el('span', { class: 'plakette', 'data-ws': 'plakette' }, String(SENDUNGEN.length)));
  const inhalt = document.getElementById('inhalt');
  if (!inhalt.querySelector('.mehr-liste') || inhalt.querySelector('[data-ws="abschnitt"]')) return;
  const a = el('section', { class: 'ws-abschnitt', 'data-ws': 'abschnitt' },
    el('h2', {}, `Noch nicht gesendet (${SENDUNGEN.length})`),
    el('p', { class: 'neben' }, SATZ_ALLE), liste());
  inhalt.prepend(a);
}

function einstieg3() {
  const inhalt = document.getElementById('inhalt');
  if (document.querySelector('[data-ws="gruppe"]') || !inhalt.querySelector('.uebersicht')) return;
  const art = ARTEN.task;
  const karte = el('li', {}, el('button', { type: 'button', class: `karte ${art.klasse} ws-karte`, 'data-ws-ziel': NEU.ziel },
    el('span', { class: 'kopfzeile' }, chipArt(art), idSpan('n9x-4kt'), projektSpan('beta')),
    el('span', { class: 'titel' }, NEU.titel),
    zustandsZeile({ ...WARTET, chip: true })));
  karte.firstChild.addEventListener('click', neuerEintrag);
  const gruppe = el('div', { 'data-ws': 'gruppe' }, gruppentitel('Neu auf diesem Gerät, noch nicht gesendet'), el('ul', { class: 'karten' }, karte), gruppentitel('Wartet auf dich'));
  inhalt.querySelector('.uebersicht').after(gruppe);
}

/** Im Eintrag, auf den eine wartende Antwort geht: Band mit Verwerfen (Variante 3 hält die Verwaltung im Eintrag). */
function eintragBand3() {
  const inhalt = document.getElementById('inhalt');
  if (document.querySelector('[data-ws="eintragband"]') || !inhalt.querySelector('.kopfkarte') || inhalt.querySelector('.band')) return;
  const b = band({ ton: 'warn', symbol: 'cloud_upload-f', titel: 'Antwort „A“ noch nicht gesendet', satz: 'Sie wartet auf Netz und geht raus, sobald du online bist.', knoepfe: [verwerfen()] });
  b.dataset.ws = 'eintragband';
  inhalt.querySelector('.kopfkarte').after(b);
}

const EINSTIEG = { 1: einstieg1, 2: einstieg2, 3: einstieg3 };

/** Setzt die Variante in die Ansicht ein; die App zeichnet bei jedem Abgleich neu, darum beobachtet es den Inhalt. */
export function zeigeWarteschlange({ variante, seite: was }) {
  css();
  const inhalt = document.getElementById('inhalt');
  let beschaeftigt = false;
  const versuche = () => {
    if (beschaeftigt || !inhalt.firstElementChild) return;
    beschaeftigt = true;
    beobachter.disconnect();
    try {
      EINSTIEG[variante]();
      if (variante === 3) eintragBand3();
    } finally {
      requestAnimationFrame(() => { beobachter.observe(inhalt, { childList: true, subtree: true }); beschaeftigt = false; });
    }
  };
  const beobachter = new MutationObserver(versuche);
  beobachter.observe(inhalt, { childList: true, subtree: true });
  versuche();
  if (was === 'liste' && variante === 1) listenSeite();
  if (was === 'eintrag') neuerEintrag();
}
