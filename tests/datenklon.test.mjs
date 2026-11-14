// Prüfung gegen den echten Datenbestand und das Postwerkzeug selbst. Beides liegt auf dem Rechner des Betreibers und
// nicht im Repo; die Tests laufen nur, wenn die Umgebung sie benennt, sonst überspringen sie:
//   POST_DATEN      Ordner des Datenklons (wird nur gelesen)
//   POST_BEFEHL     Befehlszeile, die alle Einträge als JSON druckt (`--all --json --status all` des Werkzeugs, mit
//                   gesetztem Datenordner und ohne Abgleich); {JETZT} steht für die Zeit JJJJ-MM-TTTHH:MMZ, auf die
//                   das Werkzeug die Zustände rechnet
//   POST_WERKZEUG   Pfad der Python-Datei des Werkzeugs, für den Vergleich der Prüfmuster
// Der Datenklon ist eine Mock-Quelle: der Abgleich läuft gegen ihn wie gegen GitHub, die Zustände rechnet die App aus dem
// Ergebnis und vergleicht sie Feld für Feld mit dem Werkzeug.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { abgleichen, leseStand } from '../js/abgleich.js';
import { parseZeit, zeitText } from '../js/format.js';
import { geheimnisTreffer, personenTreffer } from '../js/pruefen.js';
import { speicherDatenbank } from '../js/speicher.js';
import {
  Hauptbuch, dateienNachId, eintragJson, imEingang, ladeEintraege, ladeProjekte, wartetAufDich,
} from '../js/zustand.js';
import { mockQuelle } from './hilfen/mockquelle.mjs';

const { POST_DATEN: DATEN, POST_BEFEHL: BEFEHL, POST_WERKZEUG: WERKZEUG } = process.env;

/** Liest die Dateien des Datenklons so, wie der Baum von GitHub sie nennt: Pfad zu Text. */
function liesKlon() {
  const dateien = new Map();
  dateien.set('projects.md', readFileSync(join(DATEN, 'projects.md'), 'utf8'));
  for (const a of readdirSync(join(DATEN, 'entries'), { withFileTypes: true })) {
    if (!a.isDirectory()) continue;
    for (const b of readdirSync(join(DATEN, 'entries', a.name), { withFileTypes: true })) {
      if (!b.isDirectory()) continue;
      for (const f of readdirSync(join(DATEN, 'entries', a.name, b.name), { withFileTypes: true })) {
        if (f.isFile()) dateien.set(`entries/${a.name}/${b.name}/${f.name}`, readFileSync(join(DATEN, 'entries', a.name, b.name, f.name), 'utf8'));
      }
    }
  }
  return dateien;
}
const abdruck = (dateien) => createHash('sha256').update(JSON.stringify([...dateien].sort())).digest('hex');
const jetztMinute = () => zeitText(Date.now());

test('Zustände aller Einträge des Datenklons gleich dem Werkzeug (Status, ready, Rang, Adressen, Bedingungen, Zeiten)',
  { skip: DATEN && BEFEHL ? false : 'POST_DATEN und POST_BEFEHL nicht gesetzt' }, async (t) => {
    // Andere Sitzungen schreiben in den Klon: gelesen wird vor und nach dem Aufruf des Werkzeugs, bei Änderung neu.
    let dateien; let ausgabe; let jetzt;
    for (let versuch = 0; versuch < 6; versuch++) {
      jetzt = jetztMinute();
      const vorher = liesKlon();
      const teile = BEFEHL.replaceAll('{JETZT}', jetzt).split(/\s+/);
      ausgabe = JSON.parse(execFileSync(teile[0], teile.slice(1), { encoding: 'utf8', maxBuffer: 1 << 28 }));
      if (abdruck(vorher) === abdruck(liesKlon()) && jetzt === jetztMinute()) { dateien = vorher; break; }
    }
    assert.ok(dateien, 'der Datenklon änderte sich in sechs Versuchen jedes Mal während des Vergleichs');

    // Der Abgleich läuft gegen den Klon, wie er gegen GitHub liefe
    const quelle = mockQuelle({ dateien });
    const db = speicherDatenbank();
    const r = await abgleichen({ fetch: quelle.fetch, db, quelle: { repo: 'org/daten', token: 'TESTTOKEN' }, stapel: 250 });
    const stand = await leseStand(db);
    assert.equal(stand.pfade.size, dateien.size - [...dateien.keys()].filter((p) => p.split('/').length > 4).length);
    const eintraege = ladeEintraege(dateienNachId(stand.pfade));
    const buch = new Hauptbuch(eintraege, parseZeit(jetzt));
    t.diagnostic(`${eintraege.size} Einträge, ${r.dateien} Dateien, ${r.anfragen.graphql} GraphQL-Aufrufe, ${ladeProjekte(stand.pfade.get('projects.md')).size} Projektnamen`);

    const unterschiede = [];
    assert.deepEqual([...eintraege.keys()].sort(), ausgabe.map((e) => e.id).sort(), 'dieselben Einträge');
    for (const soll of ausgabe) {
      const e = eintraege.get(soll.id);
      const st = buch.zustand(e);
      const ist = eintragJson(e, st);
      for (const [k, v] of Object.entries(soll)) {
        if (k === 'local') continue;   // der lokale Speicher des Werkzeugs gehört nicht in den Bestand
        if (JSON.stringify(ist[k]) !== JSON.stringify(v)) unterschiede.push(`${soll.id}.${k}: App ${JSON.stringify(ist[k])}, Werkzeug ${JSON.stringify(v)}`);
      }
      // Eingang und "wartet auf dich" stehen nicht in --json, folgen aber aus ihm
      const eingang = soll.to.length === 0 && soll.project === null;
      const wartet = soll.ready && soll.to.includes('user') && !(soll.kind === 'idea');
      if (imEingang(e) !== eingang) unterschiede.push(`${soll.id}.inbox: App ${imEingang(e)}, aus --json ${eingang}`);
      if (wartetAufDich(e, st) !== wartet) unterschiede.push(`${soll.id}.for_user: App ${wartetAufDich(e, st)}, aus --json ${wartet}`);
    }
    assert.deepEqual(unterschiede.slice(0, 20), [], `${unterschiede.length} Unterschiede bei ${ausgabe.length} Einträgen`);
  });

const PYTHON = `
import glob, importlib.machinery, importlib.util, json, random, sys
loader = importlib.machinery.SourceFileLoader('werkzeug', sys.argv[1])
spec = importlib.util.spec_from_loader('werkzeug', loader)
w = importlib.util.module_from_spec(spec)
loader.exec_module(w)
texte = [open(p, encoding='utf-8').read() for p in sorted(glob.glob(sys.argv[2] + '/entries/*/*/*.md'))]
random.seed(94)
bausteine = ['token', 'TOKEN=', 'password: ', 'secret', 'api_key', 'x_token_y', ' ', '\\n', '"', "'", ':', '=', '$', '<', '(', 'Ab3dE5gH7jK9',
  'abcdefghij', '12345678', 'ghp_', 'github_pat_', 'sk-', 'sk-ant-', 'AKIA', 'glpat-', 'xoxb-', 'ht' + 'tp://u:pw123456789@h', 'ä', 'ß', 'ſ', 'K',
  'İ', 'ı', '٣', '١٢٣', '²', '③', '½', '\\u00a0', '\\u2028', '\\x1c', '+49 170 1234567', '0170 1234567', 'DE89 3704 0044 0532 0130 00',
  'geb. 12.03.1980', 'Geburtsdatum 1980-03-12', 'Personalnummer: 12345', 'pers.-nr. 123', 'Aktenzeichen: AB 123/45', 'az. 12 3',
  'a.b@c.de', 'noreply@x.org', 'x@example.com', 'y@users.noreply.github.com', 'Ab3d', 'xyz', '12', '1', '+', '00', '-', '/', '.', 'a', 'Z', '_']
sonst = [chr(c) for c in list(range(0x80, 0x300)) + list(range(0x2000, 0x2070)) + list(range(0x2460, 0x2500)) + list(range(0xff00, 0xff60))]
for _ in range(8000):
    texte.append(''.join(random.choice(bausteine) if random.random() < 0.75 else random.choice(sonst) for _ in range(random.randint(1, 9))))
print(json.dumps([[t, [list(h) for h in w.secret_hits(t)], [list(h) for h in w.personal_hits(t)]] for t in texte], ensure_ascii=False))
`;

test('Prüfmuster für Geheimnisse und Personendaten treffen wie im Werkzeug (Text des Datenklons und 8000 Zufallstexte)',
  { skip: DATEN && WERKZEUG ? false : 'POST_DATEN und POST_WERKZEUG nicht gesetzt' }, (t) => {
    const korpus = JSON.parse(execFileSync('python3', ['-I', '-c', PYTHON, WERKZEUG, DATEN], { encoding: 'utf8', maxBuffer: 1 << 28 }));
    const abweichungen = [];
    for (const [text, geheimnisse, personen] of korpus) {
      const ist = JSON.stringify([geheimnisTreffer(text), personenTreffer(text)]);
      if (ist !== JSON.stringify([geheimnisse, personen])) abweichungen.push(`${JSON.stringify(text.slice(0, 60))}: App ${ist}, Werkzeug ${JSON.stringify([geheimnisse, personen])}`);
    }
    t.diagnostic(`${korpus.length} Texte verglichen`);
    assert.deepEqual(abweichungen.slice(0, 10), [], `${abweichungen.length} Abweichungen`);
  });
