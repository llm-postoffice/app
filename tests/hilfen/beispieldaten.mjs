// Erfundene, neutrale Beispieldaten für Tests, Vorschau und Wegetest: Projekte alpha, beta und gamma, Rechner rechner-a und
// rechner-b, Sitzungen mit Phantasiekennungen. Nichts davon stammt von einem echten System. Die Daten haben die Form des
// Postsystems (Pfade entries/XX/ID/…, Köpfe, Nachträge, Statusdateien); die App liest sie über den echten Abgleich aus
// der Mock-Quelle (mockquelle.mjs). Die Uhr steht fest: Samstag, 2026-11-14, 14:07 Ortszeit; so zeigt jede Ansicht dieselben Zeiten.

export const JETZT = new Date(2026, 10, 14, 14, 7, 0).getTime();
export const REPO = 'beispiel/eintraege';
export const TOKEN = 'TESTTOKEN';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** Eine ULID mit der Zeit `ms`; der Rest ist fest, damit die Dateinamen stabil sind. */
export function ulid(ms, nr = 1) {
  let t = '';
  for (let n = ms, i = 0; i < 10; i++, n = Math.floor(n / 32)) t = CROCKFORD[n % 32] + t;
  return `${t}${String(nr).padStart(16, '0')}`;
}
const iso = (ms) => new Date(ms).toISOString().replace(/:\d\d\.\d{3}Z$/, 'Z');
const min = (m) => JETZT - m * 60000;
const std = (h) => min(h * 60);
const tage = (d, h = 0, m = 0) => new Date(2026, 10, 14 - d, h, m).getTime();

const VON_A = (ms) => `session:cb56d77f, rechner-a, ${iso(ms)}`;
const VON_B = (ms) => `session:27b922d7, rechner-b, ${iso(ms)}`;
const NUTZER = (ms) => `user, handy, ${iso(ms)}`;

const kopf = (titel, felder, text = '') => `# ${titel}\n\n${felder.map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n${text}\n`;

const SCHRITTE_A = [
  ['Hilfe im Terminal mit Farbe', 'rechner-a-tool --help', 'Farbige Überschriften, keine Linien.'],
  ['Hilfe ohne Farbe', 'NO_COLOR=1 rechner-a-tool --help', 'Gleicher Text ohne Farbe.'],
  ['Ausgabe in einer Pipe', 'rechner-a-tool --help | cat', 'Keine Farbe und keine Linien in der Ausgabe.'],
  ['Fehlermeldung bei falscher Option', 'rechner-a-tool --falsch', 'Eine Zeile mit Fehler, Grund und Abhilfe; Exit 2.'],
  ['Hilfe in schmalem Fenster', 'COLUMNS=40 rechner-a-tool --help', 'Kein Wort bricht mitten im Wort.'],
  ['Hilfe in breitem Fenster', 'COLUMNS=200 rechner-a-tool --help', 'Spalten bleiben ausgerichtet.'],
  ['Vervollständigung in der Shell', 'rechner-a-tool <Tab>', 'Die Unterbefehle erscheinen.'],
  ['Version anzeigen', 'rechner-a-tool --version', 'Eine Zeile mit der Fassung.'],
  ['Beenden mit Strg+C', 'rechner-a-tool warten', 'Die Ausgabe endet sofort mit Exit 130.'],
];
const schrittText = (liste) => liste.map(([t, befehl, erwartet], i) => `${i + 1}. ${t}\n   ${befehl}\n   Erwartet: ${erwartet}`).join('\n');

const SCHRITTE_B = Array.from({ length: 12 }, (_, i) => [`Probe ${i + 1} auf dem Handy`, `Öffne die Ansicht ${i + 1}.`, `Ansicht ${i + 1} zeigt den Inhalt ohne Überlauf.`]);
const SCHRITTE_C = Array.from({ length: 6 }, (_, i) => [`Bild ${i + 1} am Fernseher`, `Wähle Bild ${i + 1}.`, `Bild ${i + 1} steht scharf.`]);

const EXTERN_TEXT = `Ein Leser meldet **drei Dinge**:

- die Seite lädt langsam
- ein Link: [Bericht](https://localhost/bericht) und [Falle](javascript:alert(1))
- Rohes HTML: <script>alert(1)</script> und <b>fett</b>

> Zitat aus dem Bericht

\`\`\`
befehl --mit-option
\`\`\`
`;

/** Ein Eintrag als { id, dateien }; `ereignisse` sind [{ ms, art: 'status'|'addendum', felder, text }]. */
function eintrag(id, titel, felder, text, ereignisse = []) {
  const dateien = { '0-entry.md': kopf(titel, felder, text) };
  ereignisse.forEach((ev, i) => {
    dateien[`${ulid(ev.ms, i + 1)}-${ev.art}.md`] = `${ev.felder.map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n${ev.text ?? ''}\n`;
  });
  return { id, dateien };
}

/** Alle Beispieleinträge. */
export function eintraege() {
  const e = [];
  e.push(eintrag('q7w2de', 'Freigabe: Release 20261113.01 von alpha',
    [['Kind', 'approval'], ['To', 'user'], ['Project', 'alpha'], ['From', VON_A(std(4))], ['Priority', '1'], ['Urgent', 'yes']],
    'Das Release 20261113.01 von alpha ist gebaut und geprüft. Tag, Push und Veröffentlichung laufen nach deinem Ja.'));
  e.push(eintrag('8k3m1x', 'Abnahme Phase 1: alpha',
    [['Kind', 'test'], ['To', 'user, host:rechner-a'], ['Project', 'alpha'], ['From', VON_A(tage(2, 22, 30))], ['Priority', '2']],
    `Prüfe die Schritte am Rechner rechner-a. Beurteile jeden mit PASS, FAIL, BLOCKED oder SKIP.\n\n${schrittText(SCHRITTE_A)}`));
  e.push(eintrag('p4m7bt', 'Proben der Ansichten auf dem Handy',
    [['Kind', 'test'], ['To', 'user, host:rechner-a'], ['Project', 'beta'], ['From', VON_A(tage(2, 18, 13))], ['Priority', '2']],
    `Prüfe die Ansichten auf dem Handy.\n\n${schrittText(SCHRITTE_B)}`,
    [{ ms: tage(1, 9, 0), art: 'addendum', felder: [['By', NUTZER(tage(1, 9, 0))], ['Verdict', 'FAIL'], ['Step', '1 PASS'], ['Step', '2 PASS'], ['Step', '3 PASS'], ['Step', '4 SKIP']], text: 'Gesamt: FAIL der Rest fehlt noch' }]));
  e.push(eintrag('h2n9vz', 'Bildproben am Fernseher',
    [['Kind', 'test'], ['To', 'user, host:rechner-b'], ['Project', 'gamma'], ['From', VON_B(tage(3, 21, 40))], ['Priority', '2']],
    `Prüfe die Bilder am Fernseher.\n\n${schrittText(SCHRITTE_C)}`));
  e.push(eintrag('m7q2ke', 'Befund: release scheitert bei Projekten ohne Eintrag',
    [['Kind', 'message'], ['To', 'user'], ['Project', 'alpha'], ['From', VON_A(std(2))], ['Priority', '2']],
    'Der Befehl release endet mit Exit 1, wenn das Projekt nicht in der Liste steht. Ich habe es nicht geändert.'));
  e.push(eintrag('r2d4vn', 'Welche Bibliothek für die Oberfläche?',
    [['Kind', 'question'], ['To', 'user'], ['Project', 'beta'], ['From', VON_A(min(20))], ['Priority', '2'],
      ['Options', 'A: Standardbibliothek (Empfehlung) | B: Zusatzpaket aus extra'], ['Blocking', 'no (A)'], ['Source', 'beta:docs/entwurf.md:120@3e1f0a2']],
    'Der Entwurf docs/entwurf.md vergleicht beide. Die Standardbibliothek braucht kein Paket und startet in weniger als 0,15 s. Das Zusatzpaket bringt fertige Eingabefelder, braucht aber ein Paket aus extra.',
    [{ ms: min(15), art: 'addendum', felder: [['By', VON_A(min(15))]], text: 'Messung: der Befehl braucht auf rechner-a 0,07 s.' }]));
  e.push(eintrag('p1cb2x', 'Eingabefelder der beiden Bibliotheken vergleichen',
    [['Kind', 'task'], ['To', 'project:beta'], ['From', VON_B(min(9))], ['Parent', 'r2d4vn'], ['Priority', '2']], 'Vergleiche die Eingabefelder.'));
  e.push(eintrag('x9k3ft', 'Rückmeldung eines Lesers',
    [['Kind', 'message'], ['To', 'user'], ['Project', 'alpha'], ['From', 'session:5fbc7a01, rechner-a, ' + iso(std(1))], ['Trust', 'external'], ['Priority', '3']], EXTERN_TEXT));
  e.push(eintrag('k7m2qa', 'Notiz: Abo der Hinweise auf rechner-a prüfen',
    [['Kind', 'note'], ['From', VON_A(std(3))], ['Priority', '3']], 'Die Hinweise kommen auf rechner-a seit gestern nicht mehr an. Bitte prüfen, ob das Abo noch besteht.'));
  e.push(eintrag('w2tn4c', 'Befund: Hook meldet eine leere Zeile',
    [['Kind', 'message'], ['From', VON_B(tage(1, 9, 12))], ['Priority', '2']], 'Der Hook schreibt bei leerem Text eine leere Zeile.'));
  const idee = (id, titel, projekt, von, ms) => eintrag(id, titel, [['Kind', 'idea'], ['To', 'user'], ['Project', projekt], ['From', von(ms)], ['Priority', '3']], `${titel}: ein Satz Begründung.`);
  e.push(idee('b3cyxm', 'Ideen an dich als Ideensammlung', 'alpha', VON_A, tage(0, 9, 30)));
  e.push(idee('x4pn8d', 'Wischgesten erst nach der Probe auf dem Handy', 'alpha', VON_B, tage(1, 20, 15)));
  e.push(idee('m8hq2s', 'Einsortieren als Taste anbieten', 'beta', VON_A, tage(2, 18, 40)));
  e.push(idee('z6bt3f', 'Regel für Listen mit Auswahl in einem Blatt', 'gamma', VON_B, tage(3, 11, 5)));
  // Suche: ein Eintrag in Arbeit, einer beantwortet, einer verworfen, einer wartet
  e.push(eintrag('tpc0e0', 'Neu adressieren: Format, Befehl und Knopf in der App',
    [['Kind', 'task'], ['To', 'project:alpha'], ['From', NUTZER(min(40))], ['Priority', '2']], 'Der Auftrag liegt bei einer Sitzung.',
    [{ ms: min(5), art: 'status', felder: [['By', VON_A(min(5))], ['Status', 'in_progress'], ['Holder', 'session:cb56d77f'], ['Until', iso(JETZT + 3 * 3600000)]] }]));
  e.push(eintrag('d5n8vk', 'Soll der Takt im Vordergrund 2 Minuten sein?',
    [['Kind', 'question'], ['To', 'user'], ['Project', 'alpha'], ['From', VON_A(tage(1, 10, 0))], ['Options', 'A: ja | B: nein']], 'Der Takt ist ein Kompromiss.',
    [{ ms: tage(1, 10, 20), art: 'status', felder: [['By', NUTZER(tage(1, 10, 20))], ['Status', 'done'], ['Result', 'Antwort: A']] }]));
  e.push(eintrag('f6s3ga', 'Doppelter Auftrag zur Suche',
    [['Kind', 'task'], ['To', 'project:alpha'], ['From', VON_A(tage(4, 8, 0))]], 'Doppelt.',
    [{ ms: tage(4, 9, 0), art: 'status', felder: [['By', NUTZER(tage(4, 9, 0))], ['Status', 'dropped'], ['Reason', 'doppelt']] }]));
  e.push(eintrag('w3a9ck', 'Folgearbeit zur Bibliothek',
    [['Kind', 'task'], ['To', 'project:beta'], ['From', VON_A(min(8))], ['Condition', 'answered:r2d4vn']], 'Beginnt, sobald die Frage beantwortet ist.'));
  return e;
}

export const PROJEKTE = `# Projekte

## alpha

- Remote: example/alpha
- Hosts: rechner-a

## beta

- Remote: example/beta
- Hosts: rechner-a, rechner-b

## gamma

- Remote: example/gamma
- Hosts: rechner-b
`;

/** Die Dateien des Repos als Map Pfad zu Text; `liste` darf eine Auswahl der Einträge sein. */
export function dateien(liste = eintraege()) {
  const d = new Map([['projects.md', PROJEKTE]]);
  for (const x of liste) for (const [name, text] of Object.entries(x.dateien)) d.set(`entries/${x.id.slice(0, 2)}/${x.id}/${name}`, text);
  return d;
}

/** Ein erfundenes Token von GitHub für die Prüfung vor dem Senden; zur Laufzeit verkettet, damit kein Scanner es im Quelltext findet. */
export const ERFUNDENES_TOKEN = ['gh', 'p_', 'A1b2C3d4'.repeat(4)].join('');

/** Sendungen der Warteschlange, wie die Schreibschicht (Teil E) sie anlegt: eine je Zustand. */
export function schlange() {
  const z = JETZT - 3 * 60000;
  return [
    { id: 's1', eintrag: 'r2d4vn', art: 'antwort', wahl: 'A', zustand: 'liegt', zeit: z },
    { id: 's2', eintrag: 'p4m7bt', art: 'urteil', verdict: 'FAIL', zustand: 'token', zeit: z },
    { id: 's3', eintrag: 'k7m2qa', art: 'einsortieren', ziel: 'alpha', zustand: 'liegt', zeit: z },
    { id: 's4', eintrag: 'w2tn4c', art: 'einsortieren', ziel: 'beta', zustand: 'konflikt', zeit: z, titel: 'Schon einsortiert',
      grund: 'Ein anderes Gerät hat den Eintrag um 14:09 an alpha adressiert. Dein Nachtrag an beta wurde nicht gesendet.' },
    { id: 's5', eintrag: 'm7q2ke', art: 'antwort', zustand: 'konflikt', zeit: z, titel: 'Schon beantwortet',
      grund: 'Ein anderes Gerät hat um 14:09 geantwortet. Deine Antwort wurde nicht gesendet.' },
  ];
}

/** Weitere Sendungen für die Bilder der Zustände: wird gesendet, schon gesendet (der Abgleich bringt die Datei noch), Fehler. */
export function schlangeZustaende() {
  const z = JETZT - 3 * 60000;
  return {
    sendet: { id: 's6', eintrag: 'w2tn4c', art: 'einsortieren', ziel: 'beta', zustand: 'sendet', zeit: JETZT - 20000 },
    gesendet: { id: 's7', eintrag: 'k7m2qa', art: 'einsortieren', ziel: 'alpha', satz: 'Zu den Hinweisen.', von: 'handy', zustand: 'gesendet', zeit: JETZT - 2 * 60000 },
    urteil: { id: 's8', eintrag: '8k3m1x', art: 'urteil', verdict: 'FAIL', zustand: 'liegt', zeit: z },
    verboten: { id: 's9', eintrag: 'p4m7bt', art: 'urteil', verdict: 'FAIL', zustand: 'verboten', zeit: z },
    fehler: { id: 's10', eintrag: 'm7q2ke', art: 'antwort', zustand: 'fehler', zeit: z, grund: 'GitHub lehnt die Sendung ab (Validation Failed).' },
  };
}

/** Entwürfe auf dem Gerät: Urteile einer Abnahme und ein Text. */
export function entwuerfe() {
  return [
    { schluessel: 'urteil/8k3m1x', zeit: JETZT, anmerkung: '', schritte: {
      1: { wort: 'PASS' }, 2: { wort: 'PASS' }, 3: { wort: 'FAIL', satz: 'Die Ausgabe enthält Linien, auch in der Pipe.' }, 4: { wort: 'PASS' }, 5: { wort: 'PASS' },
      6: { wort: 'PASS' }, 7: { wort: 'SKIP', satz: 'Die Shell läuft auf diesem Rechner nicht.' }, 8: { wort: 'PASS' }, 9: { wort: 'PASS' } } },
  ];
}

/**
 * Die Szenarien der Vorschau: Daten, was vor dem Start auf dem Gerät liegt (`seed`: erst abgleichen, dann ändern sich die
 * Bedingungen), wie GitHub danach antwortet (`live`) und was die Seite zusätzlich vorfindet.
 *   live: ok | haengt (der Abgleich bleibt stehen) | 503 | 401 | netz (kein Netz)
 */
export const SZENARIEN = {
  normal: { daten: dateien(), seed: true, live: 'ok' },
  schlange: { daten: dateien(), seed: true, live: 'ok', schlange: schlange(), entwuerfe: entwuerfe() },
  entwurf: { daten: dateien(), seed: true, live: 'ok', entwuerfe: entwuerfe() },
  leer: { daten: dateien([]), seed: true, live: 'ok' },
  laedt: { daten: dateien(), seed: false, live: 'haengt' },
  fehler: { daten: dateien(), seed: false, live: '503' },
  token: { daten: dateien(), seed: true, live: '401', schlange: schlange().filter((s) => s.id === 's2') },
  offline: { daten: dateien(), seed: true, live: 'netz', schlange: [schlange()[0], schlange()[2]] },
  anmeldung: { daten: dateien(), anmelden: false },
  'anmeldung-fehler': { daten: dateien(), anmelden: false, formular: { repo: 'kein-repo', token: 'ab cd', geraet: 'Pixel 8 Pro' } },
  // Teil E: Schreiben. Die Vorschau sendet nie von allein; `klick` tippt nach dem Start auf einen Knopf wie ein Nutzer.
  antworten: { daten: dateien(), seed: true, live: 'ok', klick: '#blatt [data-wahl="A"]' },
  erledigen: { daten: dateien(), seed: true, live: 'ok', klick: '#aktion [data-handlung=erledigt]' },
  'eingang-senden': { daten: dateien(), seed: true, live: 'ok', schlange: [schlange()[2], schlangeZustaende().sendet] },
  einsortiert: { daten: dateien(), seed: true, live: 'ok', schlange: [schlangeZustaende().gesendet] },
  'einsortieren-gewaehlt': { daten: dateien(), seed: true, live: 'ok', entwuerfe: [{ schluessel: 'einsortieren/k7m2qa', ziel: 'alpha', satz: 'Zu den Hinweisen.', zeit: JETZT }] },
  'einsortieren-pruefung': { daten: dateien(), seed: true, live: 'ok', klick: '#blatt-knoepfe .gefuellt',
    entwuerfe: [{ schluessel: 'einsortieren/k7m2qa', ziel: 'alpha', satz: `Zugang: ${ERFUNDENES_TOKEN}`, zeit: JETZT }] },
  'erfassen-entwurf': { daten: dateien(), seed: true, live: 'ok', entwuerfe: [{ schluessel: 'erfassen', art: 'idea', titel: 'Wischgesten erst nach der Probe auf dem Handy', an: 'user', text: '', rang: '2', dringend: false, zeit: JETZT }] },
  'erfassen-pruefung': { daten: dateien(), seed: true, live: 'ok', klick: '[data-handlung=anlegen]',
    entwuerfe: [{ schluessel: 'erfassen', art: 'task', titel: 'Zugang prüfen', an: 'alpha', text: `Das Token ist ${ERFUNDENES_TOKEN}.`, rang: '2', dringend: false, zeit: JETZT }] },
  'erfassen-senden': { daten: dateien(), seed: true, live: 'ok', klick: '[data-handlung=anlegen]',
    entwuerfe: [{ schluessel: 'erfassen', art: 'task', titel: 'Datei prüfen', an: 'alpha', text: 'Bitte bis Freitag.', rang: '1', dringend: true, zeit: JETZT }] },
  'abnahme-gesendet': { daten: dateien(), seed: true, live: 'ok', schlange: [schlangeZustaende().urteil] },
  'abnahme-pruefung': { daten: dateien(), seed: true, live: 'ok', klick: '[data-handlung=abnahme]',
    entwuerfe: [{ ...entwuerfe()[0], anmerkung: `Zugang: ${ERFUNDENES_TOKEN}` }] },
  'sendung-fehler': { daten: dateien(), seed: true, live: 'ok', schlange: [schlangeZustaende().verboten, schlangeZustaende().fehler] },
  uhr: { daten: dateien(), seed: true, live: 'ok', uhr: 3 * 60000 },
  // Teil F: ein wartender Service Worker (`neu`) und die installierte App (`installiert`) lassen sich im Renderer nicht herstellen;
  // die Vorschau setzt sie ein (tools/vorschau.mjs)
  'neue-fassung': { daten: dateien(), seed: true, live: 'ok', neu: true },
  'neue-fassung-schlange': { daten: dateien(), seed: true, live: 'ok', neu: true, schlange: schlange(), entwuerfe: entwuerfe() },
  installiert: { daten: dateien(), seed: true, live: 'ok', installiert: true },
  'mehr-installiert': { daten: dateien(), seed: true, live: 'ok', installiert: true, scroll: 'App installieren' },
  'mehr-fassung': { daten: dateien(), seed: true, live: 'ok', neu: true, scroll: 'fassung' },
  'mehr-installieren': { daten: dateien(), seed: true, live: 'ok', scroll: 'App installieren' },
  'mehr-mitteilungen': { daten: dateien(), seed: true, live: 'ok', scroll: 'Mitteilungen' },
  // Alle: die Vorschau setzt den Filter, den ein Nutzer über die Chips wählen würde (js/uebersicht.js)
  'alle-projekt': { daten: dateien(), seed: true, live: 'ok', filter: { projekt: ['beta'], sortierung: 'prioritaet' } },
  'alle-alter': { daten: dateien(), seed: true, live: 'ok', filter: { status: ['dich'], sortierung: 'alter-neu' } },
  'alle-nichts': { daten: dateien(), seed: true, live: 'ok', filter: { projekt: ['gamma'], art: ['question'] } },
  'suche-treffer': { daten: dateien(), seed: true, live: 'ok', suche: 'tpc-0e0' },
  'suche-nichts': { daten: dateien(), seed: true, live: 'ok', suche: 'zzz-999' },
};

/** Die Adressen, die die Vorschau je Szenario rendert. */
export const ADRESSEN = {
  normal: ['wartet', 'alle', 'alle/status', 'alle/projekt', 'alle/art', 'alle/prio', 'alle/sortieren', 'abnahmen', 'erfassen', 'mehr', 'mehr/geraet', 'eingang', 'ideen', 'eintrag/r2d4vn', 'eintrag/r2d4vn/antworten', 'eintrag/m7q2ke',
    'eintrag/q7w2de', 'eintrag/x9k3ft', 'eintrag/8k3m1x', 'eintrag/8k3m1x/schritt/3', 'eintrag/8k3m1x/schritt/3/fail', 'eintrag/p4m7bt/ergebnis',
    'eintrag/k7m2qa', 'eintrag/k7m2qa/einsortieren', 'eintrag/b3cyxm', 'eintrag/zzzzzz'],
  schlange: ['wartet', 'eingang', 'ideen', 'eintrag/p4m7bt', 'eintrag/w2tn4c', 'eintrag/m7q2ke'],
  entwurf: ['abnahmen', 'eintrag/8k3m1x', 'eintrag/8k3m1x/ergebnis'],
  leer: ['wartet', 'alle', 'abnahmen', 'eingang', 'ideen', 'suche'],
  laedt: ['wartet', 'alle', 'eingang', 'mehr'],
  fehler: ['wartet', 'alle', 'ideen', 'mehr'],
  token: ['wartet', 'mehr'],
  offline: ['wartet', 'alle', 'eingang', 'mehr', 'eintrag/r2d4vn'],
  anmeldung: ['anmelden'],
  'anmeldung-fehler': ['anmelden'],
  'alle-projekt': ['alle', 'alle/prio'],
  'alle-alter': ['alle'],
  'alle-nichts': ['alle'],
  'suche-treffer': ['suche'],
  'suche-nichts': ['suche'],
  antworten: ['eintrag/r2d4vn/antworten'],
  erledigen: ['eintrag/m7q2ke'],
  'eingang-senden': ['eingang', 'eintrag/k7m2qa'],
  einsortiert: ['eintrag/k7m2qa'],
  'einsortieren-gewaehlt': ['eintrag/k7m2qa/einsortieren'],
  'einsortieren-pruefung': ['eintrag/k7m2qa/einsortieren'],
  'erfassen-entwurf': ['erfassen'],
  'erfassen-pruefung': ['erfassen'],
  'erfassen-senden': ['erfassen', 'wartet'],
  'abnahme-gesendet': ['abnahmen', 'eintrag/8k3m1x'],
  'abnahme-pruefung': ['eintrag/8k3m1x/ergebnis'],
  'sendung-fehler': ['eintrag/p4m7bt', 'eintrag/m7q2ke'],
  uhr: ['mehr'],
  'neue-fassung': ['wartet', 'mehr'],
  'neue-fassung-schlange': ['wartet', 'mehr'],
  installiert: ['mehr'],
  'mehr-installiert': ['mehr'],
  'mehr-fassung': ['mehr'],
  'mehr-installieren': ['mehr'],
  'mehr-mitteilungen': ['mehr'],
};
