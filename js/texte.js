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

const SENDUNG_WORT = {
  antwort: ['eine Antwort', 'Antworten'], urteil: ['ein Urteil', 'Urteile'], anlegen: ['ein neuer Eintrag', 'neue Einträge'],
  erledigt: ['eine Erledigung', 'Erledigungen'], einsortieren: ['eine Einsortierung', 'Einsortierungen'],
};

/** „eine Antwort und 2 neue Einträge“: was noch nicht gesendet ist, nach Art der Sendung (`sendungen` sind Sendungen oder ihre Arten). */
export function wartendText(sendungen) {
  const zahl = new Map();
  for (const s of sendungen) { const a = typeof s === 'string' ? s : s.art; zahl.set(a, (zahl.get(a) ?? 0) + 1); }
  const teile = [...zahl].map(([a, n]) => { const w = SENDUNG_WORT[a] ?? ['eine Sendung', 'Sendungen']; return n === 1 ? w[0] : `${n} ${w[1]}`; });
  return teile.length > 1 ? `${teile.slice(0, -1).join(', ')} und ${teile.at(-1)}` : (teile[0] ?? '');
}

/**
 * Zeile Speicher in Mehr und eine Warnung, wenn Sendungen in der Schlange liegen und der Speicher nicht gesichert ist.
 * `schlange` sind die Sendungen, die noch nicht gesendet sind.
 */
export function speicherAnzeige(speicher, art, schlange = []) {
  const wartet = wartendText(schlange);
  if (art === 'arbeitsspeicher') {
    return { zeile: 'nur im Arbeitsspeicher', warnung: 'Dieser Browser erlaubt keinen dauerhaften Speicher. Nach dem Schließen der App ist alles weg.' };
  }
  const dauerhaft = speicher?.dauerhaft;
  const zeile = dauerhaft === true ? 'dauerhaft gewährt' : dauerhaft === false ? 'vom Browser verwaltet' : 'nicht geprüft';
  const warnung = dauerhaft !== true && wartet
    ? `Der Browser kann den Speicher räumen. Noch nicht gesendet: ${wartet}. Das könnte verloren gehen.` : null;
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

// ---- Web-Push als Probe ---------------------------------------------------------------------------------------------------
// Nur im Browser mit Service Worker. Text mit **fett** markiert Beschriftungen und Befehle; Sätze in
// Bändern sind reiner Text.

export const WEBPUSH = {
  titel: 'Web-Push (Probe)',
  absaetze: [
    'Eine Probe: Hinweise ohne ntfy, über den Push-Dienst von Google. Das geht im Browser, wenn die Google Play Services auf diesem Gerät laufen. ntfy bleibt der Standard.',
  ],
  schritte: { titel: 'So schaltest du es ein', liste: [
    'Führe auf dem Rechner **claude-post webpush setup** aus und kopiere den Schlüssel, den es zeigt.',
    'Füge den Schlüssel hier ein und tippe **Einschalten**.',
    'Erlaube Mitteilungen, wenn der Browser fragt.',
    'Tippe **Abo kopieren**, führe **claude-post webpush setup** noch einmal aus und füge das Abo ein.',
    'Prüfe es mit **claude-post webpush test**.',
  ] },
  neben: ['Der Push trägt keinen Text: der Hinweis lautet immer „Neue Einträge für dich“. Ein Tipp darauf öffnet **Wartet**.'],
  stand: {
    aus: 'Web-Push ist aus.',
    an: (host) => `Web-Push ist an. Push-Dienst: ${host}.`,
    nichtUnterstuetzt: 'Dieser Browser kann kein Web-Push. Hinweise kommen über ntfy.',
    gesperrt: 'Mitteilungen sind für diese Seite gesperrt. Erlaube sie in den Einstellungen des Browsers.',
  },
  feld: { beschriftung: 'Öffentlicher Schlüssel', hinweis: 'Aus dem Befehl claude-post webpush setup auf dem Rechner, 87 Zeichen.' },
  knoepfe: { an: 'Einschalten', kopieren: 'Abo kopieren', beenden: 'Abo beenden' },
  ok: { titel: 'Eingeschaltet', satz: (host) => `Das Abo besteht beim Push-Dienst ${host}. Tippe jetzt auf Abo kopieren und füge es am Rechner ein.` },
  kopiert: { titel: 'Abo kopiert', satz: 'Füge es am Rechner bei claude-post webpush setup ein. Es enthält die Adresse zum Zustellen: gib es nicht weiter.' },
  beendet: {
    titel: 'Abo beendet', keins: 'Es gab kein Abo',
    satz: 'Der Rechner sendet weiter, bis du claude-post webpush off ausführst. ntfy ist unverändert.',
  },
  fehler: {
    schluesselTitel: 'Schlüssel nicht brauchbar',
    schluesselFehlt: 'Füge zuerst den öffentlichen Schlüssel ein, den claude-post webpush setup auf dem Rechner zeigt.',
    schluesselZeichen: 'Der Schlüssel enthält Zeichen, die es in base64url nicht gibt. Kopiere ihn noch einmal, ohne Leerzeichen und Zeilenumbrüche.',
    schluesselForm: 'Das ist kein öffentlicher VAPID-Schlüssel: er muss 87 Zeichen lang sein. Kopiere die Zeile, die claude-post webpush setup zeigt, ganz.',
    nichtDa: 'Web-Push fehlt',
    nichtDaSatz: 'Dieser Browser hat keinen Service Worker, keine Mitteilungen oder keinen PushManager.',
    erlaubnisTitel: 'Mitteilungen nicht erlaubt',
    erlaubnisSatz: 'Ohne Erlaubnis gibt es kein Abo. Erlaube Mitteilungen in den Einstellungen des Browsers für diese Seite und tippe Einschalten noch einmal.',
    einschaltenTitel: 'Einschalten gescheitert',
    kopierenTitel: 'Kopieren gescheitert',
    beendenTitel: 'Beenden gescheitert',
    abfrage: 'Abo nicht lesbar',
    keinAbo: 'Es gibt kein Abo',
    keinAboSatz: 'Tippe zuerst auf Einschalten.',
    keinWorker: 'Kein Service Worker registriert',
    browser: 'Der Browser meldet:',
  },
};
