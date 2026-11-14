// Texte des Abgleichs und des Speichers für Mehr: Wortlaut nach dem Entwurf der App (Abschnitte Zustände, Offline und
// Abgleich, Mehr) und den Regeln des Betreibers für Handy, Text und Doku (UOF-4, UOF-6, URM-3, URM-4, TXT-3 bis
// TXT-12). Reine Funktionen, damit node --test den Wortlaut prüft; Zeiten rechnen sie in der Zeitzone des Geräts.

const zwei = (n) => String(n).padStart(2, '0');
const tag = (d) => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;

/** 14:07 (24 Stunden, Ortszeit). */
export function uhrzeit(ms) {
  const d = new Date(ms);
  return `${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

/** heute um 14:07, gestern um 14:07, sonst 2026-11-12 14:07 (TXT-6). */
export function tagUndUhr(ms, jetzt) {
  const heute = new Date(jetzt);
  const gestern = new Date(jetzt);
  gestern.setDate(heute.getDate() - 1);
  const d = new Date(ms);
  if (tag(d) === tag(heute)) return `heute um ${uhrzeit(ms)}`;
  if (tag(d) === tag(gestern)) return `gestern um ${uhrzeit(ms)}`;
  return `${tag(d)} ${uhrzeit(ms)}`;
}

/** 1 Datei, 514 Dateien, keine Datei (TXT-10). */
export const dateien = (n) => (n === 0 ? 'keine Datei' : n === 1 ? '1 Datei' : `${n} Dateien`);

/** Zeile Abgleich in Mehr: wann zuletzt und wie viele Dateien. */
export function abgleichZeile(zustand, jetzt) {
  if (zustand.phase === 'ohne-anmeldung') return 'nicht angemeldet';
  if (!zustand.letzter) return 'noch nicht abgeglichen';
  return `${tagUndUhr(zustand.letzter.geprueft, jetzt)}, ${dateien(zustand.letzter.dateien)}`;
}

/** Fortschritt mit echter Gesamtzahl (URM-3): Text und Werte für den Balken; ohne Gesamtzahl unbestimmt. */
export function fortschrittAnzeige(fortschritt) {
  if (!fortschritt || fortschritt.phase !== 'dateien' || !fortschritt.gesamt) {
    return { text: 'Abgleich läuft: Dateiliste wird geholt', wert: null, max: null };
  }
  return {
    text: `Abgleich läuft: ${fortschritt.fertig} von ${dateien(fortschritt.gesamt)}`,
    wert: fortschritt.fertig, max: fortschritt.gesamt,
  };
}

/** Der Hinweis unter dem Fortschritt des ersten Abgleichs: er geht beim nächsten Öffnen weiter. */
export const WEITER_BEIM_OEFFNEN = 'Wenn der Abgleich abbricht, geht er beim nächsten Öffnen dort weiter, wo er aufgehört hat.';

/** Zeile Speicher in Mehr und eine Warnung, wenn Antworten in der Schlange liegen und der Speicher nicht gesichert ist. */
export function speicherAnzeige(speicher, art, schlange) {
  if (art === 'arbeitsspeicher') {
    return { zeile: 'nur im Arbeitsspeicher', warnung: 'Dieser Browser erlaubt keinen dauerhaften Speicher. Nach dem Schließen der App ist alles weg.' };
  }
  const dauerhaft = speicher?.dauerhaft;
  const zeile = dauerhaft === true ? 'dauerhaft gewährt' : dauerhaft === false ? 'vom Browser verwaltet' : 'nicht geprüft';
  const warnung = dauerhaft !== true && schlange > 0
    ? 'Der Browser kann den Speicher räumen. Noch nicht gesendete Antworten könnten verloren gehen.' : null;
  return { zeile, warnung };
}

/** Die ruhige Zeile oben ohne Netz (UOF-4). */
export const ohneNetzZeile = (stand) => (stand
  ? `Ohne Netz: Stand von ${uhrzeit(stand)}. Neues kommt, sobald wieder Netz da ist.`
  : 'Ohne Netz: Neues kommt, sobald wieder Netz da ist.');

/**
 * Was Mehr zu einem Fehler des Abgleichs zeigt. ton: ruhig (ein Zustand wie ohne Netz), warnung oder fehler; aktion:
 * erneut (Erneut versuchen), token (Neues Token eintragen, kommt mit der Anmeldung in Teil D) oder null.
 * `stand` ist der Zeitpunkt des letzten vollständigen Abgleichs (ms) oder null.
 */
export function fehlerAnzeige(fehler, stand) {
  const bleibt = stand ? `Dein Stand von ${uhrzeit(stand)} bleibt erhalten.` : 'Auf diesem Gerät gibt es noch keinen Stand.';
  const einzelheiten = [`Art: ${fehler.art}`, fehler.status ? `Status: ${fehler.status}` : null, `Meldung: ${fehler.message}`,
    fehler.ursache ? `Ursache: ${fehler.ursache}` : null].filter(Boolean).join('\n');
  switch (fehler.art) {
    case 'netz':
      return { ton: 'ruhig', symbol: 'cloud_off-f', titel: 'Ohne Netz', satz: `Der Abgleich läuft, sobald wieder Netz da ist. ${bleibt}`, aktion: null, einzelheiten };
    case 'limit':
      return {
        ton: 'ruhig', symbol: 'schedule', titel: 'GitHub bremst', aktion: null, einzelheiten,
        satz: `${fehler.bis ? `Der nächste Versuch läuft um ${uhrzeit(fehler.bis)}.` : 'Der nächste Versuch läuft später.'} ${bleibt}`,
      };
    case 'token':
      return {
        ton: 'warnung', symbol: 'key-f', titel: 'Token abgelaufen oder widerrufen', aktion: 'token', einzelheiten,
        satz: 'Lesen und Senden gehen erst mit einem neuen Token. Deine Antworten bleiben auf diesem Gerät in der Schlange.',
      };
    case 'verboten':
      return {
        ton: 'warnung', symbol: 'key-f', titel: 'Zugriff verweigert', aktion: 'token', einzelheiten,
        satz: `GitHub verweigert dem Token den Zugriff. Prüfe, ob es das Repo und das Recht Contents mit Lesen hat. ${bleibt}`,
      };
    case 'nicht-gefunden':
      return {
        ton: 'fehler', symbol: 'error-f', titel: 'Repo nicht gefunden', aktion: 'erneut', einzelheiten,
        satz: `GitHub kennt das Repo nicht, oder das Token hat keinen Zugriff darauf. Prüfe Eigentümer, Name und Token. ${bleibt}`,
      };
    case 'zu-gross':
      return {
        ton: 'fehler', symbol: 'error-f', titel: 'Zu viele Dateien', aktion: null, einzelheiten,
        satz: `Die Liste der Dateien ist größer, als GitHub in einer Anfrage liefert (100.000 Einträge oder 7 MB). ${bleibt}`,
      };
    case 'antwort':
      return {
        ton: 'fehler', symbol: 'cloud_off-f', titel: 'Abgleich fehlgeschlagen', aktion: 'erneut', einzelheiten,
        satz: `GitHub antwortet nicht${fehler.status ? ` (Status ${fehler.status})` : ''}. ${bleibt}`,
      };
    default:
      return {
        ton: 'fehler', symbol: 'cloud_off-f', titel: 'Abgleich fehlgeschlagen', aktion: 'erneut', einzelheiten,
        satz: `Der Abgleich ist nicht gelungen. ${bleibt}`,
      };
  }
}
