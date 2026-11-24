// Wortlaut der Ansichten: Zeiten, Mehrzahlen, Zustandswörter und die Wörter der Warteschlange. Reine Funktionen ohne
// Browser, damit node --test den Wortlaut prüft. Die Wörter folgen den Zustandswörtern des Postwerkzeugs (Abschnitt
// „Liste und Zustandswörter“ seines Formats) und dem Entwurf der App: „wartet auf deine Antwort seit 13:47“, nie
// „bereit“ oder „aktiv“ allein (TXT-12). Zeiten rechnen sie in der Zeitzone des Geräts (TXT-6).
import { uhrzeit } from './texte.js';

const zwei = (n) => String(n).padStart(2, '0');
const tag = (d) => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
const istHeute = (ms, jetzt) => tag(new Date(ms)) === tag(new Date(jetzt));

/** 2026-11-20 10:03:12: Datum und Uhrzeit mit Sekunden in der Zeitzone des Geräts (ISO 8601, TXT-6). */
export const datumZeit = (ms) => { const d = new Date(ms); return `${tag(d)} ${zwei(d.getHours())}:${zwei(d.getMinutes())}:${zwei(d.getSeconds())}`; };

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

/** Alter in Kurzform für eine Zeile der Liste: „gerade eben“, „vor 20 min“, „vor 4 Std.“, „vor 1 Tag“, „vor 3 Wochen“, „vor 4 Mon.“. */
export function kurz(ms, jetzt) {
  const min = Math.max(0, Math.floor((jetzt - ms) / 60000));
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} min`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} Std.`;
  const tage = Math.floor(std / 24);
  if (tage < 14) return tage === 1 ? 'vor 1 Tag' : `vor ${tage} Tagen`;
  if (tage < 60) return `vor ${Math.floor(tage / 7)} Wochen`;
  return `vor ${Math.floor(tage / 30)} Mon.`;
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
  bug: { klasse: 'k-auftrag', wort: 'Bug', symbol: 'assignment-f' },
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
    case 'anlegen': return 'Neuer Eintrag';
    default: return '';
  }
}

const KONFLIKT_KURZ = { 'Schon beantwortet': 'schon beantwortet', 'Schon einsortiert': 'schon einsortiert', 'Schon erledigt': 'schon erledigt' };

/**
 * Der Satz zur Sendung in der Karte: Symbol, Rolle der Farbe und Text. `ohneNetz` ergänzt „wartet auf Netz“.
 * Zustände: liegt, sendet, gesendet, token, verboten, fehler, konflikt; wer sie setzt, ist die Schreibschicht (schreiben.js).
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
    case 'verboten':
      return { symbol: 'error-f', rolle: 's-fehler', text: mit('nicht gesendet: dem Token fehlt das Recht zum Schreiben') };
    case 'fehler':
      return { symbol: 'error-f', rolle: 's-fehler', text: mit('nicht gesendet: GitHub nimmt die Sendung nicht an') };
    case 'konflikt':
      return { symbol: 'warning-f', rolle: 's-warn', text: `nicht gesendet: ${KONFLIKT_KURZ[s.titel] ?? 'schon bearbeitet'}` };
    default:
      if (!ohneNetz && s.warteArt !== 'netz' && (s.nichtVor ?? 0) > jetzt) return { symbol: 'cloud_upload-f', rolle: 's-warn', text: mit(`noch nicht gesendet, nächster Versuch um ${uhrzeit(s.nichtVor)}`) };
      return { symbol: 'cloud_upload-f', rolle: 's-warn', text: mit(`noch nicht gesendet${ohneNetz ? ', wartet auf Netz' : ''}`) };
  }
}

/**
 * Der Zustand einer Sendung auf der Seite „Noch nicht gesendet“ und im Eintrag: Symbol, Rolle, Text und ein Satz, der sagt,
 * was geschieht oder was hilft. `neu` ist wahr, wenn die Sendung ein neuer Eintrag ist.
 */
export function sendungZustand(s, { ohneNetz = false, jetzt = Date.now() } = {}) {
  switch (s.zustand) {
    case 'sendet': return { symbol: 'sync', rolle: 's-neutral', text: 'Wird gesendet …', satz: null };
    case 'gesendet': return { symbol: 'check_circle-f', rolle: 's-ok', text: `Gesendet um ${uhrzeit(s.zeit ?? jetzt)}`, satz: null };
    case 'token': return { symbol: 'error-f', rolle: 's-fehler', text: 'Nicht gesendet: GitHub lehnt das Token ab', satz: 'Trage ein neues Token ein, dann geht sie raus. Deine Eingabe bleibt auf diesem Gerät.' };
    case 'verboten': return { symbol: 'error-f', rolle: 's-fehler', text: 'Nicht gesendet: dem Token fehlt das Recht zum Schreiben', satz: 'Trage ein Token mit dem Recht Contents mit Lesen und Schreiben ein. Deine Eingabe bleibt auf diesem Gerät.' };
    case 'fehler': return { symbol: 'error-f', rolle: 's-fehler', text: 'Nicht gesendet: GitHub nimmt die Sendung nicht an', satz: `${s.grund ?? 'GitHub hat die Sendung nicht angenommen.'} Deine Eingabe bleibt auf diesem Gerät.` };
    case 'konflikt': return { symbol: 'warning-f', rolle: 's-warn', text: `Nicht gesendet: ${KONFLIKT_KURZ[s.titel] ?? 'schon bearbeitet'}`, satz: s.grund ?? 'Ein anderes Gerät war schneller. Deine Eingabe wurde nicht gesendet.' };
    default:
      if (s.warteArt === 'netz' || ohneNetz) return { symbol: 'cloud_upload-f', rolle: 's-warn', text: 'Wartet auf Netz, geht raus, sobald du online bist', satz: null };
      if ((s.nichtVor ?? 0) > jetzt) return { symbol: 'schedule', rolle: 's-warn', text: 'Nächster Versuch', bis: s.nichtVor, jetzt, satz: s.grund ?? null };
      if (s.gewartet && !s.grund) return { symbol: 'schedule', rolle: 's-warn', text: 'Geht gleich raus', satz: null };
      return { symbol: 'schedule', rolle: 's-warn', text: 'Wartet auf einen neuen Versuch', satz: s.grund ?? null };
  }
}

/**
 * Das Band oben in Wartet: Zahl und was geschieht. Die Zahlen: `netz` warten auf Netz, `spaeter` auf einen neuen Versuch,
 * `gleich` gehen als Nächstes raus, `sendet` laufen gerade, `gesendet` sind eben raus, `haengend` brauchen dich. `bis` ist der
 * Zeitpunkt des nächsten Versuchs (ms), `zeit` der des letzten Sendens. Ist alles raus, nennt das Band die Uhrzeit. Die Frist
 * (`frist`) setzt der Aufrufer als laufenden Text an den Satz.
 */
export function schlangeBand({ netz = 0, spaeter = 0, gleich = 0, haengend = 0, sendet = 0, gesendet = 0, bis = null, zeit = null }) {
  const n = netz + spaeter + gleich + haengend + sendet;
  const um = zeit === null ? '' : uhrzeit(zeit);
  if (!n) return { titel: gesendet === 1 ? `Gesendet um ${um}` : `${gesendet} Sendungen gesendet um ${um}`, satz: 'Die App gleicht noch einmal ab.', frist: null };
  const titel = n === 1 ? 'Eine Sendung noch nicht gesendet' : `${n} Sendungen noch nicht gesendet`;
  const teile = [];
  if (sendet) teile.push(sendet === 1 ? 'Eine wird gerade gesendet …' : `${sendet} werden gerade gesendet …`);
  if (gesendet) teile.push(gesendet === 1 ? `Eine ist um ${um} gesendet.` : `${gesendet} sind um ${um} gesendet.`);
  if (gleich) teile.push(gleich === 1 ? 'Eine geht gleich raus.' : `${gleich} gehen gleich raus.`);
  if (netz) teile.push(netz === 1 ? 'Eine wartet auf Netz und geht raus, sobald du online bist.' : `${netz} warten auf Netz und gehen raus, sobald du online bist.`);
  if (spaeter) teile.push(spaeter === 1 ? 'Eine wartet auf einen neuen Versuch.' : `${spaeter} warten auf einen neuen Versuch.`);
  if (haengend) teile.push(haengend === 1 ? 'Eine hängt und braucht dich.' : `${haengend} hängen und brauchen dich.`);
  return { titel, satz: teile.join(' '), frist: spaeter && bis ? { text: 'Nächster Versuch', bis } : null };
}

/** Zeile für einen Entwurf einer Abnahme: „Entwurf: 5 von 12 Schritten beurteilt, noch nicht gesendet“. */
export const entwurfZeile = (beurteilt, gesamt) => ({
  symbol: 'edit_note-f', rolle: 's-warn',
  text: `Entwurf: ${beurteilt} von ${gesamt} ${gesamt === 1 ? 'Schritt' : 'Schritten'} beurteilt, noch nicht gesendet`,
});

// ---- Übersicht „Alle“: Wörter der Filter und der Sortierung

/** Status der Übersicht: Schlüssel, Wort. Die Reihenfolge ist die der Auswahl und der Gruppen. */
export const STATUS_WORTE = [
  { wert: 'dich', text: 'Wartet auf dich' }, { wert: 'arbeit', text: 'In Arbeit' },
  { wert: 'andere', text: 'Wartet auf anderes' }, { wert: 'offen', text: 'Offen' },
];
/** Priorität: Dringend ist ein eigenes Merkmal, Hoch, Normal und Niedrig stehen für den Rang 1, 2 und 3 und höher. */
export const PRIO_WORTE = [
  { wert: 'dringend', text: 'Dringend' }, { wert: 'hoch', text: 'Hoch' }, { wert: 'normal', text: 'Normal' }, { wert: 'niedrig', text: 'Niedrig' },
];
/** Sortierung: Schlüssel, Wort in der Auswahl und der Satz über der Liste („Gruppiert nach Projekt“). */
export const SORT_WORTE = [
  { wert: 'projekt', text: 'Projekt', zeile: 'Nach Projekt gruppiert' },
  { wert: 'prioritaet', text: 'Priorität', zeile: 'Nach Priorität gruppiert' },
  { wert: 'art', text: 'Art', zeile: 'Nach Art gruppiert' },
  { wert: 'status', text: 'Status', zeile: 'Nach Status gruppiert' },
  { wert: 'alter-neu', text: 'Alter, neue zuerst', zeile: 'Nach Alter, neue zuerst' },
  { wert: 'alter-alt', text: 'Alter, alte zuerst', zeile: 'Nach Alter, alte zuerst' },
];
/** Die vier Filter in der Reihenfolge der Chips: Schlüssel im Filter und Wort auf dem Chip. */
export const FILTER_WORTE = [
  { dim: 'status', text: 'Status' }, { dim: 'projekt', text: 'Projekt' }, { dim: 'art', text: 'Art' }, { dim: 'prio', text: 'Priorität' },
];
