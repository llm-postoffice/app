// Das Blatt Bearbeiten (`#eintrag/ID/bearbeiten`): Priorität, Dringend und Adresse eines Eintrags ändern, dazu Nachtrag,
// Erledigen mit Ergebnis und Verwerfen mit Grund. Gewählt wurde die Variante A (Entwürfe: docs/entwicklung/ansichten/bearbeiten):
// ein Blatt wie Antworten und Einsortieren. Titel und Text bleiben, wie sie sind; Übernehmen und Zurückgeben gehören Sitzungen.
// Speichern sendet nur, was sich geändert hat: Priorität und Dringend als eine Sendung, die Adresse als eine zweite.
import { el } from './dom.js';
import { adressen } from './zustand.js';
import { karteVon } from './welt.js';
import { absender } from './absenden.js';
import { aufklappbar, band, chipAuswahl, feld, knopf } from './karten.js';
import { eintragsZeile } from './eintrag.js';
import { kannSenden, SENDEN_FEHLT } from './schreiben.js';

const geschlossen = (st) => st.status === 'done' || st.status === 'dropped';
const RANG = [['1', 'Hoch'], ['2', 'Normal'], ['3', 'Niedrig']];

/** Die Adressen, die das Blatt anbietet, nach Gruppen: Du, Projekte, Rechner. Die aktuelle Adresse steht immer mit drin. */
export function adressGruppen(welt, aktuell) {
  const dazu = (liste, vorsilbe) => [...new Set([...liste, ...aktuell.filter((a) => a.startsWith(vorsilbe)).map((a) => a.slice(vorsilbe.length).split('/')[0])])];
  return [
    { titel: 'Du', optionen: [{ wert: 'user', text: 'An dich' }] },
    { titel: 'Projekte', optionen: dazu(welt.projektNamen, 'project:').map((p) => ({ wert: `project:${p}`, text: p })) },
    { titel: 'Rechner', optionen: dazu(welt.hostNamen ?? [], 'host:').map((h) => ({ wert: `host:${h}`, text: h })) },
  ].filter((g) => g.optionen.length);
}

/** Ein Abschnitt zum Aufklappen mit einem Textfeld und einem Knopf, der sendet, sobald das Feld gefüllt ist. */
function aktionsAbschnitt(k, { titel, beschriftung, knopfText, gesperrt, pflicht, senden, danach }) {
  const t = el('textarea', { name: titel.toLowerCase(), rows: 3, autocapitalize: 'sentences' });
  const { platz, los } = absender((opt) => senden(t.value.trim(), opt), danach);
  const b = knopf(knopfText, { klasse: 'tonal', gesperrt: gesperrt || pflicht, an: (ev) => los(false, ev.currentTarget) });
  t.addEventListener('input', () => { b.disabled = gesperrt || (pflicht && !t.value.trim()); });
  return aufklappbar(titel, feld({ beschriftung, steuerung: t }), platz, b);
}

/** Das Blatt; gesperrt ohne Schreibschicht, wie die anderen Blätter. */
export async function bearbeitenBlatt(welt, k, o, schliessen) {
  const e = welt.eintraege.get(o.id);
  if (!e) return { koerper: [el('p', {}, 'Der Eintrag liegt nicht auf diesem Gerät.')], knoepfe: [knopf('Schließen', { klasse: 'text', an: schliessen })] };
  const st = welt.buch.zustand(e);
  const art = karteVon(welt, { e, st }).art;
  const koerper = [eintragsZeile(art.wort, e.id)];
  if (geschlossen(st)) {
    koerper.push(el('p', {}, 'Der Eintrag ist schon abgeschlossen. Du kannst ihn nicht mehr ändern.'));
    return { koerper, knoepfe: [knopf('Schließen', { klasse: 'text', an: schliessen })], klasse: art.klasse };
  }
  const gesperrt = !kannSenden(k);
  if (gesperrt) koerper.push(band({ ton: 'info', symbol: 'info-f', satz: SENDEN_FEHLT }));

  const rang = chipAuswahl({ name: 'rang', wert: String(Math.min(st.priority, 3)), optionen: RANG.map(([wert, text]) => ({ wert, text })) });
  const dringend = el('input', { type: 'checkbox', name: 'dringend' });
  dringend.checked = Boolean(st.urgent);

  const jetzt = adressen(e);
  const aktuell = jetzt.length === 1 ? jetzt[0] : null;   // bei mehreren Adressen steht keine vorgewählt
  const gruppen = adressGruppen(welt, jetzt).map((g) => el('fieldset', { class: 'feld' }, el('legend', {}, g.titel),
    chipAuswahl({ name: 'an', wert: aktuell, optionen: g.optionen })));
  const satz = el('textarea', { name: 'satz', rows: 3, autocapitalize: 'sentences' });

  const gewaehlt = (x) => [...x.querySelectorAll('input')].find((i) => i.checked)?.value ?? null;
  const lies = () => ({
    rang: Number(gewaehlt(rang) ?? st.priority),
    dringend: dringend.checked,
    an: gruppen.map(gewaehlt).find(Boolean) ?? null,
  });
  const aenderung = () => {
    const w = lies();
    return { rang: w.rang !== Math.min(st.priority, 3) || w.dringend !== Boolean(st.urgent), adresse: w.an !== null && w.an !== aktuell };
  };

  const speichern = knopf('Speichern', { klasse: 'gefuellt', gesperrt: true, an: async () => {
    const a = aenderung();
    speichern.disabled = true;
    if (a.rang) {
      const r = await rangPlatz.los(false);
      if (!r.ok) { speichern.disabled = false; return; }
    }
    if (a.adresse) {
      const r = await adressPlatz.los(false);
      if (!r.ok) { speichern.disabled = false; return; }
    }
    schliessen();
  } });
  const zeigeSpeichern = () => {
    const a = aenderung();
    speichern.disabled = gesperrt || !(a.rang || a.adresse);
    hinweis.className = a.rang || a.adresse ? 'neben satz still' : 'neben satz';
  };
  const hinweis = el('p', { class: 'neben satz', hidden: gesperrt }, 'Ändere die Priorität oder die Adresse, dann kannst du speichern.');
  const rangPlatz = absender((opt) => k.schreiben.rangAendern(e.id, { rang: lies().rang, dringend: lies().dringend, ...opt }), () => {});
  const adressPlatz = absender((opt) => k.schreiben.neuAdressieren(e.id, { an: [lies().an], satz: satz.value.trim(), ...opt }), () => {});
  for (const x of [rang, ...gruppen]) x.addEventListener('change', zeigeSpeichern);
  dringend.addEventListener('change', zeigeSpeichern);

  const fertig = () => { schliessen(); k.ersetze('#wartet'); };
  koerper.push(
    el('fieldset', { class: 'feld' }, el('legend', {}, 'Priorität'), rang),
    el('label', { class: 'haken' }, dringend, 'Dringend: meldet auch zwischen 22 und 7 Uhr'),
    el('h3', {}, 'Wohin geht der Eintrag?'), ...gruppen,
    feld({ beschriftung: 'Satz zur neuen Adresse (freiwillig)', steuerung: satz }),
    rangPlatz.platz, adressPlatz.platz, hinweis,
    aktionsAbschnitt(k, { titel: 'Nachtrag', beschriftung: 'Dein Nachtrag', knopfText: 'Nachtrag senden', gesperrt, pflicht: true,
      senden: (text, opt) => k.schreiben.nachtragen(e.id, { text, ...opt }), danach: () => schliessen() }),
    aktionsAbschnitt(k, { titel: 'Erledigen', beschriftung: 'Ergebnis (freiwillig)', knopfText: 'Erledigt senden', gesperrt, pflicht: false,
      senden: (text, opt) => k.schreiben.erledigen(e.id, { ergebnis: text || undefined, ...opt }), danach: fertig }),
    aktionsAbschnitt(k, { titel: 'Verwerfen', beschriftung: 'Grund', knopfText: 'Verwerfen senden', gesperrt, pflicht: true,
      senden: (grund, opt) => k.schreiben.eintragVerwerfen(e.id, { grund, ...opt }), danach: fertig }),
  );
  return { koerper, knoepfe: [knopf('Abbrechen', { klasse: 'text', an: schliessen }), speichern], klasse: art.klasse };
}
