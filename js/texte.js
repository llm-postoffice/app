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

// ---- Teil F: neue Fassung, Installation, Mitteilungen --------------------------------------------------------------
// Text mit **fett** markiert Beschriftungen der Oberfläche (DOB-1); mehr.js macht daraus <strong>.

/** Die Zeile unten und das Band in Mehr, wenn eine neue Fassung wartet (UOF-5). Die Regel nennt den Knopf „Neu laden“; der
 *  Auftrag und der Entwurf der App nennen ihn **Neu starten**, weil die App die Seite wirklich neu startet (Abweichung von UOF-5). */
export const NEUE_FASSUNG = {
  satz: 'Neue Fassung geladen.',
  knopf: 'Neu starten',
  mehr: {
    titel: 'Neue Fassung geladen',
    satz: 'Die neue Fassung läuft erst nach dem Neustart. Entwürfe und noch nicht gesendete Sendungen bleiben auf diesem Gerät.',
  },
};
export const NEU_STARTET = 'Neue Fassung startet …';

/** Der Abschnitt App installieren (UPL-2). Schritte: Ort vor Aktion, ein Schritt je Zeile (DAN-1 bis DAN-4). */
export function installationAnzeige(installiert) {
  const anmeldung = 'Nach der Installation gilt die Anmeldung der App, nicht die eines Browsertabs. Links aus anderen Apps öffnen LLM-Post in einem Tab ohne diese Anmeldung; öffne die App zum Arbeiten vom Startbildschirm.';
  if (installiert) {
    return { satz: 'LLM-Post läuft als installierte App.', schritte: [], hinweise: [anmeldung] };
  }
  return {
    satz: 'LLM-Post läuft im Browser. Installiert startet die App ohne Browserleiste, wie jede App vom Startbildschirm.',
    schritte: [
      'Öffne im Browser das Menü ⋮.',
      'Tippe im Menü auf **Install and create shortcut**.',
      'Bestätige die Frage des Browsers.',
      'Öffne LLM-Post danach vom Startbildschirm.',
      'Trage das Token dort ein, falls die App danach fragt.',
    ],
    hinweise: [
      'So heißt der Eintrag in Vanadium mit englischer Oberfläche, in Chrome meist **Install app**. Bei deutscher Oberfläche heißt er vermutlich **App installieren** (nicht geprüft).',
      anmeldung,
    ],
  };
}

/** Der Abschnitt Mitteilungen. Abweichung von UMI-3: Ein Tipp öffnet nicht die Ansicht des Eintrags, sondern die App ntfy,
 *  weil das Format des Postwerkzeugs keinen Click-Kopf kennt. Abweichung von UMI-4: Die App verspricht kein Öffnen der App;
 *  Vanadium öffnet Links aus anderen Apps in einem Tab ohne Anmeldung (Befund 2026-11-14). */
export const MITTEILUNGEN = {
  absaetze: [
    'Hinweise kommen über die App ntfy. Ein Tipp auf den Hinweis öffnet ntfy, nicht diese App.',
    '**ID kopieren** im Hinweis legt die ID des Eintrags in die Zwischenablage und schließt den Hinweis. Füge die ID in der Suche dieser App ein.',
  ],
  abo: { titel: 'Abo in ntfy anlegen', schritte: [
    'Öffne die App ntfy.', 'Tippe auf **+**, nicht auf einen Link.',
    'Gib das Thema ein, das das Postsystem auf deinem Rechner verwendet. Das Thema steht in keiner Datei dieser App.',
    'Bestätige das Abo in ntfy.',
  ] },
  neben: ['Ein Abo über einen Link empfängt nichts. Fehlt der Knopf **ID kopieren** im Hinweis, ist ntfy älter als Fassung 1.23.0; die ID steht dann im Text des Hinweises.'],
};

/** Der Abschnitt Mitteilungen in der Android-Hülle: Ein Tipp öffnet den Eintrag, wenn das Postsystem die Adresse mitschickt. */
export const MITTEILUNGEN_HUELLE = {
  ...MITTEILUNGEN,
  absaetze: ['Hinweise kommen über die App ntfy. Ein Tipp auf den Hinweis öffnet den Eintrag in dieser App, wenn das Postsystem die Adresse dazu mitschickt; sonst öffnet er ntfy.', MITTEILUNGEN.absaetze[1]],
};
