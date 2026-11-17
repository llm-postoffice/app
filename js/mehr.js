// Mehr: die ruhigen Ziele (Eingang, Ideensammlung, Suche), die Anmeldung, die Mitteilungen über ntfy, im Browser die Probe mit Web-Push, die Installation und
// der Abschnitt Dieses Gerät mit Name, Speicher, Fassung und Stand des Abgleichs. Die Ansicht ist eine Funktion von Welt
// und Zustand des Abgleichs; anzeigen.js zeichnet sie neu, wenn sich etwas ändert. Alle Texte kommen aus texte.js oder
// stehen hier; Daten gehen nur über el() in den Baum (USI-1). In der Android-Hülle fehlt der Abschnitt App installieren:
// die App ist dort schon installiert.
import { el } from './dom.js';
import { TAKTE } from './steuerung.js';
import { einstellung, setzeEinstellung } from './speicher.js';
import { UHR_WARNUNG_MS, abweichungText } from './erzeugen.js';
import { MITTEILUNGEN, MITTEILUNGEN_HUELLE, NEUE_FASSUNG, NEU_STARTET, WEBPUSH, WEITER_BEIM_OEFFNEN, abgleichZeile, fehlerAnzeige, fortschrittAnzeige, installationAnzeige, speicherAnzeige } from './texte.js';
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

/** Text mit **fett** als Knoten: die Beschriftungen der Oberfläche stehen fett (DOB-1). */
const mitFett = (text) => text.split('**').map((teil, i) => (i % 2 ? el('strong', {}, teil) : teil));

const ERGEBNIS_BAND = { ok: { ton: 'ok', symbol: 'check_circle' }, info: { ton: 'info', symbol: 'info-f' }, fehler: { ton: 'fehler', symbol: 'error-f' } };

/** Der Abschnitt Web-Push (Probe): Schlüssel eingeben, einschalten, Abo kopieren, beenden. Der genaue Fehlertext des Browsers steht
 *  sichtbar unter dem Band, denn die Probe soll zeigen, woran es scheitert. Ohne `k.webpush` (Android-Hülle) fehlt der Abschnitt. */
function webpushAbschnitt(w, k) {
  const stand = !w.unterstuetzt ? WEBPUSH.stand.nichtUnterstuetzt : w.berechtigung === 'denied' ? WEBPUSH.stand.gesperrt : w.host ? WEBPUSH.stand.an(w.host) : WEBPUSH.stand.aus;
  const danach = (aktion) => async () => { await aktion(); k.neuZeichnen(); };
  const e = w.ergebnis;
  const ergebnis = e ? band({ ...ERGEBNIS_BAND[e.ton], titel: e.titel, satz: e.satz }) : null;
  if (ergebnis && e.einzelheiten) ergebnis.querySelector('div').append(el('pre', {}, e.einzelheiten));
  let bedienung = [];
  if (w.unterstuetzt && w.host) {
    bedienung = [el('div', { class: 'zeilenknoepfe' },
      knopf(WEBPUSH.knoepfe.kopieren, { id: 'webpush-kopieren', klasse: 'tonal', an: danach(() => k.webpush.kopieren()) }),
      knopf(WEBPUSH.knoepfe.beenden, { id: 'webpush-beenden', klasse: 'text', an: danach(() => k.webpush.beenden()) }))];
  } else if (w.unterstuetzt) {
    const eingabe = el('input', { type: 'text', name: 'webpush-schluessel', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
    eingabe.value = w.schluessel;
    eingabe.addEventListener('input', () => k.webpush.merke(eingabe.value));   // überlebt das Neuzeichnen und das Beenden durch das System
    bedienung = [feld({ beschriftung: WEBPUSH.feld.beschriftung, steuerung: eingabe, hinweis: WEBPUSH.feld.hinweis }),
      el('div', { class: 'zeilenknoepfe' }, knopf(WEBPUSH.knoepfe.an, { id: 'webpush-an', klasse: 'gefuellt', an: danach(() => k.webpush.einschalten(eingabe.value)) }))];
  }
  // Ohne Unterstützung steht nur der Stand (ein Satz): die Anleitung hülfe hier nicht
  if (!w.unterstuetzt) return abschnitt(WEBPUSH.titel, el('p', { id: 'webpush-stand' }, stand));
  return abschnitt(WEBPUSH.titel,
    ...WEBPUSH.absaetze.map((a) => el('p', {}, mitFett(a))),
    el('details', {}, el('summary', {}, WEBPUSH.schritte.titel), el('ol', { class: 'ablauf-schritte' }, WEBPUSH.schritte.liste.map((t) => el('li', {}, mitFett(t))))),
    el('p', { id: 'webpush-stand' }, stand),
    ...bedienung, ergebnis,
    ...WEBPUSH.neben.map((a) => el('p', { class: 'neben' }, mitFett(a))));
}

/** Die Ansicht Mehr. */
export async function mehrAnsicht(welt, z, k) {
  const c = zaehler(welt);
  const a = await ladeAnmeldung(k.db);
  const speicher = speicherAnzeige(await einstellung(k.db, 'speicher'), k.db.art, (await k.db.alle('schlange')).filter((s) => s.zustand !== 'gesendet'), Boolean(k.huelle));
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
  // Die Uhr des Geräts ordnet neue Dateien; weicht sie von der Zeit von GitHub ab, nimmt die App die Zeit von GitHub (E, Uhrabweichung)
  const uhr = await einstellung(k.db, 'uhr');
  const uhrBand = uhr && Math.abs(uhr.abweichung) >= UHR_WARNUNG_MS
    ? band({ ton: 'warn', symbol: 'schedule', titel: 'Die Uhr dieses Geräts geht falsch', satz: `Sie geht ${abweichungText(uhr.abweichung)}. Neue Einträge tragen die Zeit von GitHub, damit sie richtig geordnet sind. Stelle die Uhr in den Einstellungen des Geräts auf automatisch.` })
    : null;
  const webpush = k.webpush && !k.huelle ? webpushAbschnitt(await k.webpush.zustand(), k) : [];
  const installiert = k.installiert ?? globalThis.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const inst = installationAnzeige(installiert);
  const mit = k.huelle ? MITTEILUNGEN_HUELLE : MITTEILUNGEN;
  // Wartet eine neue Fassung, steht das Band bei Fassung; es lädt nie von selbst neu (UOF-5)
  const neu = k.aktualisierung?.wartet
    ? band({ ton: 'info', symbol: 'info-f', titel: NEUE_FASSUNG.mehr.titel, satz: k.aktualisierung.startet ? NEU_STARTET : NEUE_FASSUNG.mehr.satz,
      knoepfe: k.aktualisierung.startet ? [] : [knopf(NEUE_FASSUNG.knopf, { klasse: 'gefuellt', an: () => k.aktualisierung.neustart() })] })
    : null;
  const werte = el('dl', { class: 'werte' },
    el('div', { class: 'mit-knopf' }, el('dt', {}, 'Gerät'), el('dd', {}, a.geraet ?? 'noch ohne Namen'), linkKnopf('Ändern …', '#mehr/geraet', { klasse: 'text' })),
    el('div', {}, el('dt', {}, 'Speicher'), el('dd', { id: 'speicher' }, speicher.zeile)),
    el('div', {}, el('dt', {}, 'Fassung'), el('dd', { id: 'fassung' }, VERSION)),
    el('div', {}, el('dt', {}, 'Abgleich'), el('dd', { id: 'abgleich' }, abgleichZeile(z, welt.jetzt))),
    el('div', {}, el('dt', {}, 'Takt im Vordergrund'), el('dd', {}, taktWahl)));
  return [
    speicher.warnung ? band({ ton: 'warn', symbol: 'warning-f', satz: speicher.warnung }) : null,
    uhrBand,
    el('ul', { class: 'mehr-liste' },
      ruhigeKarte({ symbol: 'inbox-f', titel: 'Eingang', zeile: c.eingang ? `${c.eingang} ${c.eingang === 1 ? 'Eintrag' : 'Einträge'} zum Einsortieren` : 'nichts zum Einsortieren', href: '#eingang' }),
      ruhigeKarte({ symbol: 'lightbulb', titel: 'Ideensammlung', weich: true, zeile: `${c.ideen ? ideenText(c.ideen) : 'keine Ideen'}, sie warten nicht auf dich`, href: '#ideen' }),
      ruhigeKarte({ symbol: 'search', titel: 'Suche und Archiv', zeile: 'auch erledigte und verworfene Einträge', href: '#suche' })),
    ...abschnitt('Anmeldung', ...anmeldung),
    ...abschnitt('Mitteilungen',
      ...mit.absaetze.map((a) => el('p', {}, mitFett(a))),
      el('details', {}, el('summary', {}, mit.abo.titel), el('ol', { class: 'ablauf-schritte' }, mit.abo.schritte.map((t) => el('li', {}, mitFett(t))))),
      ...mit.neben.map((a) => el('p', { class: 'neben' }, mitFett(a)))),
    ...webpush,
    ...(k.huelle ? [] : abschnitt('App installieren',
      el('p', {}, inst.satz),
      inst.schritte.length ? el('ol', { class: 'ablauf-schritte' }, inst.schritte.map((t) => el('li', {}, mitFett(t)))) : null,
      ...inst.hinweise.map((h) => el('p', { class: 'neben' }, mitFett(h))))),
    ...abschnitt('Dieses Gerät', werte, neu, el('div', { id: 'abgleich-stand' }, stand(z, k))),
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
