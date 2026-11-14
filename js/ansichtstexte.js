// Wortlaut der Ansichten: Zeiten, Mehrzahlen, Zustandswörter und die Wörter der Warteschlange. Reine Funktionen ohne
// Browser, damit node --test den Wortlaut prüft. Die Wörter folgen den Zustandswörtern des Postwerkzeugs (Abschnitt
// „Liste und Zustandswörter“ seines Formats) und dem Entwurf der App: „wartet auf deine Antwort seit 13:47“, nie
// „bereit“ oder „aktiv“ allein (TXT-12). Zeiten rechnen sie in der Zeitzone des Geräts (TXT-6).
import { uhrzeit } from './texte.js';

const zwei = (n) => String(n).padStart(2, '0');
const tag = (d) => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
const istHeute = (ms, jetzt) => tag(new Date(ms)) === tag(new Date(jetzt));

/** seit 13:47 (heute) oder seit 2026-11-12 18:13 (ISO 8601, TXT-6); der Aufrufer setzt „seit“ davor. */
export const zeitpunkt = (ms, jetzt) => (istHeute(ms, jetzt) ? uhrzeit(ms) : `${tag(new Date(ms))} ${uhrzeit(ms)}`);

/** um 14:09 (heute) oder am 2026-11-12 (sonst). */
export const um = (ms, jetzt) => (istHeute(ms, jetzt) ? `um ${uhrzeit(ms)}` : `am ${tag(new Date(ms))}`);

/** vor 20 min, vor 3 Stunden, vor 2 Tagen (TXT-10: richtige Mehrzahl). */
export function vor(ms, jetzt) {
  const min = Math.max(0, Math.floor((jetzt - ms) / 60000));
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} min`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} ${std === 1 ? 'Stunde' : 'Stunden'}`;
  const tage = Math.floor(std / 24);
  return `vor ${tage} ${tage === 1 ? 'Tag' : 'Tagen'}`;
}

export const schritte = (n) => (n === 1 ? '1 Schritt' : `${n} Schritte`);
export const eintraege = (n) => (n === 1 ? '1 Eintrag' : `${n} Einträge`);
export const abnahmen = (n) => (n === 1 ? '1 Abnahme' : `${n} Abnahmen`);
export const ideen = (n) => (n === 1 ? '1 Idee' : `${n} Ideen`);

/** Art eines Eintrags: Farbklasse, Wort und Symbol (Entwurf, „Farben je Art und Zustand“). */
export const ARTEN = {
  question: { klasse: 'k-frage', wort: 'Frage', symbol: 'help-f' },
  approval: { klasse: 'k-freigabe', wort: 'Freigabe', symbol: 'verified_user-f' },
  test: { klasse: 'k-abnahme', wort: 'Abnahme', symbol: 'checklist-f' },
  task: { klasse: 'k-auftrag', wort: 'Auftrag', symbol: 'assignment-f' },
  plan: { klasse: 'k-auftrag', wort: 'Plan', symbol: 'assignment-f' },
  message: { klasse: 'k-nachricht', wort: 'Nachricht', symbol: 'mail-f' },
  idea: { klasse: 'k-nachricht', wort: 'Idee', symbol: 'lightbulb-f' },
  note: { klasse: 'k-nachricht', wort: 'Notiz', symbol: 'edit_note-f' },
};
export const artVon = (kind) => ARTEN[kind] ?? { klasse: 'k-nachricht', wort: 'Eintrag', symbol: 'mail-f' };

/** Wörter der Urteile je Schritt: Wort, Bedeutung, Symbol und Rolle der Farbe (Entwurf, Abnahme Schritt für Schritt). */
export const URTEILE = {
  PASS: { bedeutung: 'bestanden', symbol: 'check_circle-f', rolle: 's-ok' },
  FAIL: { bedeutung: 'nicht bestanden', symbol: 'cancel-f', rolle: 's-fehler' },
  BLOCKED: { bedeutung: 'nicht ausführbar', symbol: 'block-f', rolle: 's-warn' },
  SKIP: { bedeutung: 'absichtlich ausgelassen', symbol: 'skip_next-f', rolle: 's-neutral' },
};

/** Wer hat den Eintrag geschickt? „session:cb56d77f auf rechner-a“ oder „user, handy“. `von` ist der Wert von From. */
export function absenderText(von) {
  const teile = String(von ?? '').split(', ').map((s) => s.trim());
  const wer = teile[0];
  if (!wer) return null;
  const wo = teile[1] && !/^\d{4}-/.test(teile[1]) ? teile[1] : null;
  if (!wo) return { wer, wo: null, trenner: '' };
  return { wer, wo, trenner: wer.startsWith('session:') ? ' auf ' : ', ' };
}

/** Wohin geht ein Eintrag? Die Adressen ohne Vorsilbe: project:NAME wird NAME, host:NAME wird „an NAME“. */
export function adressText(adressen) {
  return adressen.map((a) => (a.startsWith('project:') ? a.slice(8) : a.startsWith('host:') ? `an ${a.slice(5)}` : a === 'user' ? 'dich' : a)).join(', ');
}

// ---- Warteschlange (UOF-1 bis UOF-3, Entwurf „Zustände der Warteschlange“)

/** Bezeichnung einer Sendung: „Antwort „A““, „Antwort FAIL“, „Einsortieren an dich“. */
export function sendungText(s) {
  switch (s.art) {
    case 'antwort': return s.wahl ? `Antwort „${s.wahl}“` : 'Antwort';
    case 'urteil': return `Antwort ${s.verdict ?? ''}`.trim();
    case 'erledigt': return 'Erledigt';
    case 'einsortieren': return `Einsortieren ${s.ziel === 'user' ? 'an dich' : `an ${s.ziel}`}`;
    default: return '';
  }
}

/**
 * Der Satz zur Sendung in der Karte: Symbol, Rolle der Farbe und Text. `ohneNetz` ergänzt „wartet auf Netz“.
 * Zustände: liegt, sendet, gesendet, token, konflikt; wer sie setzt, ist die Schreibschicht (Teil E).
 */
export function schlangeZeile(s, { ohneNetz = false, jetzt = Date.now() } = {}) {
  const wer = sendungText(s);
  const mit = (text) => (wer ? `${wer} ${text}` : text[0].toUpperCase() + text.slice(1));
  switch (s.zustand) {
    case 'sendet':
      return { symbol: 'sync', rolle: 's-neutral', text: `${wer || 'Eintrag'}: wird gesendet …` };
    case 'gesendet':
      return { symbol: 'check_circle-f', rolle: 's-ok', text: `gesendet ${uhrzeit(s.zeit ?? jetzt)}` };
    case 'token':
      return { symbol: 'error-f', rolle: 's-fehler', text: mit('nicht gesendet: GitHub lehnt das Token ab') };
    case 'konflikt':
      return { symbol: 'warning-f', rolle: 's-warn', text: `nicht gesendet: ${s.grund ?? 'schon bearbeitet'}` };
    default:
      return { symbol: 'cloud_upload-f', rolle: 's-warn', text: mit(`noch nicht gesendet${ohneNetz ? ', wartet auf Netz' : ''}`) };
  }
}

/** Zeile für einen Entwurf einer Abnahme: „Entwurf: 5 von 12 Schritten beurteilt, noch nicht gesendet“. */
export const entwurfZeile = (beurteilt, gesamt) => ({
  symbol: 'edit_note-f', rolle: 's-warn',
  text: `Entwurf: ${beurteilt} von ${gesamt} ${gesamt === 1 ? 'Schritt' : 'Schritten'} beurteilt, noch nicht gesendet`,
});
