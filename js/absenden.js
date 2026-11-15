// Gemeinsamer Weg der Ansichten zur Schreibschicht: eine Eingabe einreihen, bei einer Ablehnung das Band zeigen. Die
// Schreibschicht antwortet mit { ok: true, id }, { ok: false, fehler } (das Werkzeug nähme die Eingabe nicht an) oder
// { ok: false, pruefung } (Geheimnis oder Personendaten); sie nennt Ort und Art, nie den Wert (USI, SCH-3). Bei Personendaten
// kann der Nutzer trotzdem senden, ein Geheimnis geht nie raus.
import { el } from './dom.js';
import { band, knopf } from './karten.js';

const ZAHL = ['', 'ein', 'zwei', 'drei'];
const mehrere = (n, eins, viele) => (n === 1 ? eins : `${ZAHL[n] || n} ${viele}`);

/** „im Text, Zeile 2 (Zugangsdaten)“ für die ersten Funde; weitere zählt der Satz mit. */
const ort = (liste) => liste.slice(0, 3).map((t) => `${t.wo}${t.zeile ? `, Zeile ${t.zeile}` : ''} (${t.art})`).join('; ');

/** Der Satz zur Ablehnung durch die Prüfung. */
export function pruefungSatz(pruefung) {
  const g = pruefung.geheimnisse ?? [];
  if (g.length) {
    return { titel: 'Geheimnis gefunden', satz: `Die App findet ${mehrere(g.length, 'ein Geheimnis', 'Geheimnisse')}: ${ort(g)}. Sie sendet es nicht. Entferne es und sende noch einmal.` };
  }
  const p = pruefung.personen ?? [];
  return { titel: 'Persönliche Angaben gefunden', satz: `Die App findet persönliche Angaben: ${ort(p)}. Entferne sie, oder sende trotzdem, wenn du sie hier brauchst.` };
}

/** Das Band zu einer abgelehnten Einreihung; `trotzdem` sendet noch einmal mit freigegebenen Personendaten. */
export function ablehnungBand(r, trotzdem) {
  if (r.pruefung) {
    const { titel, satz } = pruefungSatz(r.pruefung);
    const nurPersonen = !(r.pruefung.geheimnisse ?? []).length;
    return band({ ton: nurPersonen ? 'warn' : 'fehler', symbol: nurPersonen ? 'warning-f' : 'error-f', titel, satz,
      knoepfe: nurPersonen && trotzdem ? [knopf('Trotzdem senden', { klasse: 'text', an: trotzdem })] : [] });
  }
  return band({ ton: 'fehler', symbol: 'error-f', titel: 'Nicht gespeichert', satz: `${r.fehler ?? 'Die App konnte die Eingabe nicht speichern.'} Deine Eingabe bleibt auf diesem Gerät.` });
}

/**
 * Baut den Platz für die Ablehnung und die Funktion, die eine Eingabe einreiht. `aufruf({ personenErlaubt })` ruft die
 * Schreibschicht; `danach(r)` läuft nur, wenn die Sendung in der Warteschlange liegt. `platz` gehört in die Ansicht.
 */
export function absender(aufruf, danach) {
  const platz = el('div', { class: 'ablehnung', role: 'status' });
  const los = async (personenErlaubt = false, knopfAus = null) => {
    platz.replaceChildren();
    if (knopfAus) knopfAus.disabled = true;
    let r;
    try { r = await aufruf({ personenErlaubt }); } catch (e) { r = { ok: false, fehler: `Beim Speichern ist ein Fehler aufgetreten (${String(e?.message ?? e)}).` }; }
    if (knopfAus) knopfAus.disabled = false;
    if (r.ok) { await danach(r); return r; }
    platz.replaceChildren(ablehnungBand(r, () => los(true)));
    platz.scrollIntoView?.({ block: 'nearest' });
    return r;
  };
  return { platz, los };
}
