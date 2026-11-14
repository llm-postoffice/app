// Abnahme Schritt für Schritt: aus den Urteilen auf dem Gerät das Ergebnis rechnen. Reine Funktionen ohne Browser,
// damit node --test sie prüft. Die App baut aus den Urteilen denselben Antworttext, den das Postwerkzeug liest, und
// lässt ihn von leseAntwort (urteil.js, Teil C) auswerten: Gesamturteil, Folgeauftrag und Fehlermeldungen sind
// dieselben wie dort. Teil E sendet genau diesen Text.
import { Fehler, folgeausgang, leseAntwort, sichtbar } from './urteil.js';

export const BRAUCHT_SATZ = new Set(['FAIL', 'BLOCKED', 'SKIP']);

/** Ein Satz in einer Zeile: Umbrüche und Tabs werden zu Leerzeichen (Steuerzeichen macht sichtbar() sichtbar). */
export const einzeilig = (satz) => sichtbar(String(satz ?? '').replace(/\s+/g, ' ').trim(), true);

/** Der Schritt nach `n`, der noch kein Urteil hat; null, wenn keiner mehr offen ist. Von hinten wieder nach vorn. */
export function naechsterOffen(offen, urteile, n) {
  const frei = offen.filter((s) => !urteile[s.n]);
  return frei.find((s) => s.n > n) ?? frei[0] ?? null;
}

/** Der Antworttext aus den Urteilen: je Schritt „N: WORT Satz“, bei offenen Schritten „Gesamt: FAIL …“. */
export function antwortText(offen, urteile, anmerkung = '') {
  const zeilen = [];
  const ohne = [];
  for (const s of offen) {
    const u = urteile[s.n];
    if (!u?.wort) { ohne.push(s.n); continue; }
    zeilen.push(`${s.n}: ${u.wort}${BRAUCHT_SATZ.has(u.wort) || u.satz ? ` ${einzeilig(u.satz)}` : ''}`.trimEnd());
  }
  if (ohne.length) zeilen.push(`Gesamt: FAIL Schritt ${ohne.join(', ')} ohne Urteil`);
  const frei = String(anmerkung ?? '').trim();
  if (frei) zeilen.push('', ...(ohne.length || !zeilen.length ? [] : ['Gesamt:']), frei);
  return zeilen.join('\n');
}

/**
 * Das Ergebnis einer Abnahme aus dem Stand auf dem Gerät. `schritte` sind alle Schritte, `offen` die ohne PASS oder
 * SKIP in früheren Runden, `fruehere` die Urteile der Runden davor (Map Schritt zu Wort), `urteile` das Entwurf.
 * Ergebnis: { verdict, satz, zaehlung, nichtPass, folge, text } oder { fehler } bei einem Entwurf, den das Werkzeug ablehnt.
 */
export function ergebnisVon({ schritte, offen, fruehere, urteile, anmerkung = '' }) {
  const text = antwortText(offen, urteile, anmerkung);
  let antwort;
  try {
    antwort = leseAntwort(text, schritte, fruehere);
  } catch (e) {
    if (e instanceof Fehler) return { fehler: e.message, text };
    throw e;
  }
  const zaehlung = { PASS: 0, FAIL: 0, BLOCKED: 0, SKIP: 0, offen: 0 };
  const nichtPass = [];
  for (const s of offen) {
    const u = urteile[s.n];
    if (!u?.wort) { zaehlung.offen++; continue; }
    zaehlung[u.wort]++;
    if (u.wort !== 'PASS') nichtPass.push({ n: s.n, titel: sichtbar(s.title, true), wort: u.wort, satz: einzeilig(u.satz) });
  }
  const gescheitert = nichtPass.filter((s) => s.wort === 'FAIL' || s.wort === 'BLOCKED');
  const teile = [];
  if (gescheitert.length) teile.push(gescheitert.map((s) => `Schritt ${s.n} ist ${s.wort}`).join(', ') + '.');
  if (zaehlung.offen) teile.push(`${zaehlung.offen === 1 ? 'Ein Schritt hat' : `${zaehlung.offen} Schritte haben`} noch kein Urteil.`);
  const beurteilt = offen.length - zaehlung.offen;
  teile.push(`${beurteilt} von ${offen.length} ${offen.length === 1 ? 'Schritt ist' : 'Schritten sind'} beurteilt.`);
  return { verdict: antwort.verdict, satz: teile.join(' '), zaehlung, nichtPass, folge: folgeausgang(antwort), text };
}
