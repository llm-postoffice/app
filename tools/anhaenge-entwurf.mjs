// Entwurf der Anzeige von Anhängen, nur für die Vorschau (tools/vorschau.mjs lädt ihn für Szenarien mit `anhaenge`).
// Er setzt nach dem Start der App drei Varianten in die Ansicht Eintrag ein; die App selbst kennt keine Anhänge.
//   1  Anhänge beim Text: unter dem Eintragstext und unter jedem Nachtrag, mit Vorschau; ein Tipp zeigt alles
//   2  Eigener Abschnitt „Anhänge“ am Ende des Eintrags: Zeilen, ein Tipp klappt die Zeile auf
//   3  Eine Zeile mit Zahl unter der Kopfkarte, ein Blatt mit der Liste, eine Seite je Anhang
// Zustand `offen`: null (nur die Liste), 'bild' oder 'text' (der Anhang geöffnet). Gebaut mit el() und ico() der App.
import { el, ico } from '../js/dom.js';
import { ANHAENGE, groessenWort } from '../tests/hilfen/anhangdaten.mjs';

const SYMBOLE = {
  bild: 'M120-840h720v720H120Z M200-760v560h560v-560Z M260-280l140-180 100 130 120-160 80 210Z',
  text: 'M200-880h400l200 200v600H200Z M300-480v60h360v-60Z M300-360v60h360v-60Z M300-240v60h240v-60Z',
  datei: 'M200-880h400l200 200v600H200Z M300-480v280h400v-280Z',
  laden: 'M440-760h80v320l100-100 56 56-196 196-196-196 56-56 100 100Z M240-200h480v80H240Z',
  anhang: 'M200-880h400l200 200v600H200Z M300-640v60h200v-60Z M300-480v60h400v-60Z M300-320v60h400v-60Z',
};

function symbolePruefen() {
  const sprite = document.querySelector('svg.sprite');
  for (const [name, pfad] of Object.entries(SYMBOLE)) {
    if (sprite.querySelector(`#i-a-${name}`)) continue;
    const s = document.createElementNS(sprite.namespaceURI, 'symbol');
    s.setAttribute('id', `i-a-${name}`);
    s.setAttribute('viewBox', '0 -960 960 960');
    const p = document.createElementNS(sprite.namespaceURI, 'path');
    p.setAttribute('d', pfad);
    s.append(p);
    sprite.append(s);
  }
  if (!document.querySelector('link[data-anh-css]')) {
    document.head.append(el('link', { rel: 'stylesheet', href: new URL('./anhaenge-entwurf.css', import.meta.url).href, 'data-anh-css': '' }));
  }
}

const sym = (a) => ico(`a-${a.art}`);
const wort = (a) => ({ bild: 'Bild', text: 'Text', datei: 'PDF' }[a.art]);
const meta = (a, extra = '') => `${groessenWort(a.groesse)} · ${wort(a)}${extra}`;
const alle = () => [...ANHAENGE.eintragsAnhaenge.map((a) => ({ ...a, ort: 'Eintrag' })), ...ANHAENGE.nachtragsAnhaenge.map((a) => ({ ...a, ort: `Nachtrag ${a.zeit}` }))];
const summe = () => alle().reduce((n, a) => n + a.groesse, 0);

const ladeKnopf = (a, klasse = 'anh-ik') => el('button', { type: 'button', class: klasse, 'aria-label': `${a.name} herunterladen` }, ico('a-laden'));
const namen = (a, zusatz = '') => el('span', { class: 'anh-name' }, el('b', {}, a.name), el('span', {}, meta(a, zusatz)));
/** Die ersten Zeilen eines Textes für die Vorschau; ganze Zeilen, nie ein abgeschnittenes Wort. */
const kurz = (text, zeilen = 6) => `${text.split('\n').slice(0, zeilen).join('\n')}\n…`;
const bildEl = (a) => el('img', { class: 'anh-bild', src: a.uri, alt: a.alt });
const textEl = (a) => el('pre', { class: 'anh-text' }, a.text);

// ---- Variante 1: beim Text

function karte1(a, offen) {
  const k = el('div', { class: `anh-karte${offen ? ' offen' : ''}`, 'data-anh-ziel': a.art });
  const kopf = el('button', { type: 'button', class: 'anh-kopf', 'aria-expanded': String(!!offen) }, el('span', { class: 'anh-sym' }, sym(a)), namen(a));
  kopf.addEventListener('click', () => {
    const auf = k.classList.toggle('offen');
    kopf.setAttribute('aria-expanded', String(auf));
    mehr?.replaceChildren(auf ? 'Weniger zeigen' : 'Ganz zeigen');
    if (a.art === 'text') vorschau.textContent = auf ? a.text : kurz(a.text);
  });
  k.append(el('div', { class: 'anh-reihe' }, kopf, ladeKnopf(a)));
  let mehr = null;
  if (a.art === 'bild') k.append(bildEl(a));
  const vorschau = textEl(a);
  if (a.art === 'text') {
    vorschau.textContent = offen ? a.text : kurz(a.text);
    k.append(vorschau);
  }
  if (a.art !== 'datei') {
    mehr = el('span', { class: 'anh-mehr' }, offen ? 'Weniger zeigen' : 'Ganz zeigen');
    const knopf = el('button', { type: 'button', class: 'anh-weiter' }, mehr, ico('expand_more'));
    knopf.addEventListener('click', () => kopf.click());
    k.append(knopf);
  }
  return k;
}

function variante1(offen) {
  const eintrag = el('div', { class: 'anh', 'data-anh': '1' },
    el('p', { class: 'anh-titel' }, ico('a-anhang'), `Anhänge zum Eintrag · ${ANHAENGE.eintragsAnhaenge.length}`),
    ANHAENGE.eintragsAnhaenge.map((a) => karte1(a, offen === a.art)));
  document.querySelector('#inhalt .text-block')?.after(eintrag);
  const nachtrag = el('div', { class: 'anh', 'data-anh': '1' },
    el('p', { class: 'anh-titel' }, ico('a-anhang'), `Anhang zum Nachtrag · ${ANHAENGE.nachtragsAnhaenge.length}`),
    ANHAENGE.nachtragsAnhaenge.map((a) => karte1(a, offen === a.art)));
  document.querySelector('#inhalt .faden li:last-child')?.append(nachtrag);
  return offen ? document.querySelector(`[data-anh-ziel="${offen}"]`) : eintrag;
}

// ---- Variante 2: eigener Abschnitt am Ende

function zeile2(a, offen) {
  const z = el('li', { class: `anh-karte${offen ? ' offen' : ''}`, 'data-anh-ziel': a.art });
  const kopf = el('button', { type: 'button', class: 'anh-kopf', 'aria-expanded': String(!!offen) },
    el('span', { class: 'anh-sym' }, sym(a)), namen(a, ` · zum ${a.ort === 'Eintrag' ? 'Eintrag' : `Nachtrag von ${a.zeit}`}`), ico('expand_more', 'anh-pfeil'));
  kopf.addEventListener('click', () => {
    kopf.setAttribute('aria-expanded', String(z.classList.toggle('offen')));
  });
  const inhalt = el('div', { class: 'anh-inhalt' },
    a.art === 'bild' ? bildEl(a) : null, a.art === 'text' ? textEl(a) : null,
    el('button', { type: 'button', class: 'tonal anh-laden' }, ico('a-laden'), 'Herunterladen'));
  z.append(kopf, inhalt);
  return z;
}

function variante2(offen) {
  const liste = alle();
  const abschnitt = el('section', { class: 'anh', 'data-anh': '2', id: 'anhaenge' },
    el('h2', {}, `Anhänge (${liste.length})`),
    el('ul', { class: 'anh-liste' }, liste.map((a) => zeile2(a, offen === a.art))));
  const quelle = [...document.querySelectorAll('#inhalt h2')].find((h) => h.textContent === 'Quelle');
  if (quelle) quelle.before(abschnitt); else document.querySelector('#inhalt').append(abschnitt);
  return abschnitt;
}

// ---- Variante 3: Zeile mit Zahl, Blatt, Seite

function seite3(a) {
  const zu = el('button', { type: 'button', class: 'symbol', 'aria-label': 'Zurück' }, ico('arrow_back'));
  zu.addEventListener('click', () => voll.remove());
  const voll = el('div', { class: 'anh-voll', 'data-anh': '3', 'data-anh-ziel': a.art },
    el('div', { class: 'anh-voll-kopf' }, zu, namen(a), ladeKnopf(a, 'symbol')),
    el('div', { class: 'anh-voll-koerper' }, a.art === 'bild' ? bildEl(a) : textEl(a)));
  document.body.append(voll);
}

function blatt3() {
  const blatt = document.getElementById('blatt');
  document.getElementById('blatt-titel').replaceChildren(ico('a-anhang'), `Anhänge (${alle().length})`);
  const gruppe = (titel, liste) => [el('p', { class: 'anh-titel' }, titel), el('ul', { class: 'anh-liste' }, liste.map((a) => {
    const b = el('button', { type: 'button', class: 'anh-kopf' }, el('span', { class: 'anh-sym' }, sym(a)), namen(a), ico('chevron_right'));
    b.addEventListener('click', () => { blatt.close(); seite3(a); });
    return el('li', { class: 'anh-karte' }, b);
  }))];
  document.getElementById('blatt-koerper').replaceChildren(
    ...gruppe('Zum Eintrag', ANHAENGE.eintragsAnhaenge.map((a) => ({ ...a }))),
    ...gruppe(`Zum Nachtrag von ${ANHAENGE.nachtragsAnhaenge[0].zeit}`, ANHAENGE.nachtragsAnhaenge));
  const schliessen = el('button', { type: 'button', class: 'text' }, 'Schließen');
  schliessen.addEventListener('click', () => blatt.close());
  document.getElementById('blatt-knoepfe').replaceChildren(schliessen);
  if (!blatt.open) blatt.showModal();
}

function variante3(offen) {
  const n = alle().length;
  const zeile = el('button', { type: 'button', class: 'anh-zeile', 'data-anh': '3' },
    el('span', { class: 'anh-sym' }, ico('a-anhang')),
    el('span', { class: 'anh-name' }, el('b', {}, `${n} Anhänge`), el('span', {}, `${groessenWort(summe())} · Bild, PDF, Text`)),
    ico('chevron_right'));
  zeile.addEventListener('click', blatt3);
  document.querySelector('#inhalt .kopfkarte')?.after(zeile);
  if (offen === 'liste') blatt3();
  if (offen === 'bild' || offen === 'text') seite3(alle().find((a) => a.art === offen));
  return null;   // Blatt und Seite liegen über der Ansicht, die Zeile steht oben
}

// ---- Einstieg

const VARIANTEN = { 1: variante1, 2: variante2, 3: variante3 };

/** Setzt die Variante in die Ansicht Eintrag ein; die App zeichnet bei jedem Abgleich neu, darum beobachtet es den Inhalt. */
export function zeigeAnhaenge({ variante, offen = null }) {
  symbolePruefen();
  const inhalt = document.getElementById('inhalt');
  let fertig = false;
  const versuche = () => {
    if (fertig || !inhalt.querySelector('.kopfkarte') || !inhalt.querySelector('.faden')) return;
    if (document.querySelector('[data-anh]')) return;
    fertig = true;
    beobachter.disconnect();
    const ziel = VARIANTEN[variante](offen);
    requestAnimationFrame(() => {
      ziel?.scrollIntoView({ block: 'start' });
      beobachter.observe(inhalt, { childList: true, subtree: true });
      fertig = false;
    });
  };
  const beobachter = new MutationObserver(versuche);
  beobachter.observe(inhalt, { childList: true, subtree: true });
  versuche();
}
