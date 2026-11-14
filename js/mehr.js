// Mehr, Abschnitt Dieses Gerät: Speicher, Fassung, Stand des Abgleichs, Takt im Vordergrund und der Knopf Jetzt
// abgleichen. Die Ansicht folgt dem Zustand der Abgleichsteuerung (steuerung.js) und zeichnet nur, was sich ändert.
// Alle Texte kommen aus texte.js; Daten gehen nur über textContent in den Baum (USI-1).
import { vorlage } from './dom.js';
import { TAKTE } from './steuerung.js';
import { einstellung, setzeEinstellung } from './speicher.js';
import { WEITER_BEIM_OEFFNEN, abgleichZeile, fehlerAnzeige, fortschrittAnzeige, speicherAnzeige } from './texte.js';
import { VERSION } from './version.js';

const TAKT_TEXT = { 60: 'jede Minute', 120: 'alle 2 Minuten', 300: 'alle 5 Minuten', 900: 'alle 15 Minuten', 0: 'nur mit dem Knopf' };

function fortschritt(z) {
  const t = vorlage('t-fortschritt');
  const a = fortschrittAnzeige(z.fortschritt);
  t.querySelector('p').textContent = a.text;
  const balken = t.querySelector('progress');
  if (a.max !== null) { balken.max = a.max; balken.value = a.wert; }   // ohne Gesamtzahl bleibt er unbestimmt (URM-3)
  if (!z.letzter) {
    const hinweis = t.querySelector('p.neben');
    hinweis.textContent = WEITER_BEIM_OEFFNEN;
    hinweis.hidden = false;
  }
  return t;
}

function band(a, steuerung) {
  const t = vorlage('t-band');
  const wurzel = t.querySelector('.band');
  wurzel.classList.add(a.ton);
  if (a.ton === 'fehler') wurzel.setAttribute('role', 'alert');
  t.querySelector('use').setAttribute('href', `#i-${a.symbol}`);
  t.querySelector('strong').textContent = a.titel;
  t.querySelector('p').textContent = a.satz;
  // Neues Token eintragen (a.aktion === 'token') kommt mit der Anmeldung in Teil D.
  if (a.aktion === 'erneut') {
    const k = document.createElement('button');
    k.type = 'button';
    k.className = 'tonal';
    k.textContent = 'Erneut versuchen';
    k.addEventListener('click', () => steuerung.jetztAbgleichen());
    t.querySelector('.zeilenknoepfe').append(k);
  }
  const d = t.querySelector('details');
  d.hidden = false;
  d.querySelector('pre').textContent = a.einzelheiten;
  return t;
}

/** Baut den Abschnitt Dieses Gerät und hält ihn aktuell, solange er im Dokument steht. */
export function mehr({ steuerung, db, jetzt = () => Date.now() }) {
  const teil = vorlage('t-mehr');
  // Die Elemente werden gleich gemerkt: ist der Teil im Dokument, ist das Fragment leer.
  const e = Object.fromEntries(['speicher', 'speicher-warnung', 'fassung', 'abgleich', 'takt', 'abgleich-stand']
    .map((id) => [id, teil.getElementById(id)]));
  e.fassung.textContent = VERSION;
  const takt = e.takt;
  for (const s of TAKTE) takt.append(new Option(TAKT_TEXT[s], String(s)));
  const stand = e['abgleich-stand'];

  async function zeichneSpeicher() {
    const a = speicherAnzeige(await einstellung(db, 'speicher'), db.art, await db.zaehle('schlange'));
    e.speicher.textContent = a.zeile;
    const w = e['speicher-warnung'];
    w.hidden = !a.warnung;
    w.textContent = a.warnung ?? '';
  }

  function zeichne(z) {
    e.abgleich.textContent = abgleichZeile(z, jetzt());
    const knoepfe = [];
    let zeile = null;
    if (z.phase === 'laeuft') {
      zeile = fortschritt(z);
    } else if (z.phase === 'ohne-anmeldung') {
      zeile = document.createElement('p');
      zeile.className = 'neben';
      zeile.textContent = 'Der Abgleich beginnt, sobald du dich angemeldet hast.';
    } else if (z.phase === 'fehler') {
      const a = fehlerAnzeige(z.fehler, z.letzter?.geprueft ?? null);
      zeile = band(a, steuerung);
      if (!a.aktion) knoepfe.push('jetzt');
    } else {
      knoepfe.push('jetzt');
    }
    const kinder = zeile ? [zeile] : [];
    if (knoepfe.includes('jetzt')) {
      const k = document.createElement('button');
      k.type = 'button';
      k.className = 'gefuellt';
      k.textContent = 'Jetzt abgleichen';
      k.addEventListener('click', () => steuerung.jetztAbgleichen());
      kinder.push(k);
    }
    stand.replaceChildren(...kinder);
  }

  steuerung.takt().then((t) => { takt.value = String(t); });
  takt.addEventListener('change', async () => {
    await setzeEinstellung(db, 'takt', Number(takt.value));
    await steuerung.plane();
  });
  const abmelden = steuerung.beiAenderung((z) => {
    if (!e.abgleich.isConnected) { abmelden(); return; }   // die Ansicht ist weg, der Horcher geht mit
    zeichne(z);
  });
  zeichne(steuerung.zustand);
  zeichneSpeicher();
  return teil;
}
