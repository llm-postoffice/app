// Die Dateien einer Sendung gegen die gemeinsamen Testfälle (Abschnitt write): Zeichen für Zeichen wie das Postwerkzeug.
// Dazu ULIDs, IDs, Stempel und die Prüfung vor dem Senden.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TC } from './hilfen/tc.mjs';
import { anlegenDateien, antwortDateien, erledigtDateien, normText, pruefeSendung, render, routeDateien, urteilDateien } from '../js/dateien.js';
import { NEUE_ID_RE, abweichungText, neueId, stempel, uhrAbweichung, ulidErzeuger } from '../js/erzeugen.js';
import { ulidZeit, parseZeit } from '../js/format.js';
import { baueWelt } from '../js/welt.js';
import { Fehler } from '../js/urteil.js';

const welt = (fall) => {
  const pfade = new Map([['projects.md', fall.projects]]);
  for (const [id, dateien] of Object.entries(fall.entries)) for (const [name, text] of Object.entries(dateien)) pfade.set(`entries/${id.slice(0, 2)}/${id}/${name}`, text);
  return baueWelt({ pfade, jetzt: parseZeit(fall.at) });
};

/** Setzt die Muster {ulid}, {id} und {id2} eines erwarteten Pfads ein und prüft die Form der ULID. */
function vergleiche(fall, dateien, id) {
  assert.equal(dateien.length, fall.expect.length, `${fall.name}: Zahl der Dateien`);
  const ULID = '[0-9A-HJKMNP-TV-Z]{26}';
  for (const soll of fall.expect) {
    const muster = new RegExp(`^${soll.path.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace('{ulid}', ULID).replace('{id2}', id?.slice(0, 2) ?? 'XX').replace('{id}', id ?? 'XXXXXX')}$`);
    const treffer = dateien.filter((d) => muster.test(d.pfad));
    assert.equal(treffer.length, 1, `${fall.name}: ${soll.path}`);
    assert.equal(treffer[0].inhalt, soll.content.replaceAll('{id}', id ?? ''), `${fall.name}: Inhalt von ${soll.path}`);
  }
}

/** Baut aus dem Aufruf des Postwerkzeugs im Fall die Dateien der App. */
function bauen(fall) {
  const w = welt(fall);
  const ms = parseZeit(fall.at);
  const geraet = fall.from.split(', ')[1];
  const vergeben = new Set(w.eintraege.keys());
  const ctx = { stempel: stempel(geraet, ms), ulid: ulidErzeuger(() => ms), vergeben };
  const [befehl, ...a] = fall.command;
  const opt = (name) => { const i = a.indexOf(name); return i < 0 ? null : a[i + 1]; };
  const alle = (name) => a.flatMap((x, i) => (x === name ? [a[i + 1]] : []));
  if (befehl === 'answer') {
    const e = w.eintraege.get(a[0]);
    if (e.head.get('Kind') === 'question') return antwortDateien(ctx, e, { wahl: opt('--option'), text: fall.stdin });
    return urteilDateien(ctx, e, w.buch.zustand(e), fall.stdin);
  }
  if (befehl === 'route') {
    const e = w.eintraege.get(a[0]);
    return routeDateien(ctx, e, { to: alle('--to'), project: opt('--project'), reason: opt('--reason') ?? '' });
  }
  const an = opt('--to');
  return anlegenDateien(ctx, {
    art: a[0], titel: a[1], an: an === 'user' ? 'user' : an ? an.replace(/^project:/, '') : null, text: fall.stdin,
    rang: opt('--priority') ? Number(opt('--priority')) : 2, dringend: a.includes('--urgent'),
  });
}

for (const fall of TC.write) {
  test(`TC write: ${fall.name}`, () => {
    const r = bauen(fall);
    vergleiche(fall, r.dateien, r.id ?? r.folgeId);
  });
}

test('TC write: jeder Fall der Quelle ist abgedeckt und nicht leer', () => {
  assert.ok(TC.write.length >= 13);
  for (const fall of TC.write) assert.ok(fall.expect.length >= 1, fall.name);
});

test('Antwort: eine unbekannte Möglichkeit und eine leere Antwort lehnt die App ab wie das Werkzeug', () => {
  const fall = TC.write[0];
  const w = welt(fall);
  const e = w.eintraege.get('k7m2qa');
  const ctx = { stempel: 'user, handy', ulid: ulidErzeuger(), vergeben: new Set() };
  assert.throws(() => antwortDateien(ctx, e, { wahl: 'Z' }), Fehler);
  assert.throws(() => antwortDateien(ctx, e, {}), Fehler);
  const nur = antwortDateien(ctx, e, { wahl: 'b' });
  assert.match(nur.dateien[1].inhalt, /Result: Antwort: B: nein/);
  assert.equal(nur.dateien[0].inhalt.includes('Answer: B: nein'), true);
});

test('Antwort als Nachtrag (Als Nachtrag senden) schreibt allein den Text, ohne Answer und ohne Status', () => {
  const w = welt(TC.write[0]);
  const e = w.eintraege.get('k7m2qa');
  const ctx = { stempel: 'user, handy, 2026-11-14T12:00Z', ulid: ulidErzeuger(), vergeben: new Set() };
  const r = antwortDateien(ctx, e, { wahl: 'A', text: 'Zu spät, aber so war es gedacht.', nachtrag: true });
  assert.equal(r.dateien.length, 1);
  assert.match(r.dateien[0].pfad, /-addendum\.md$/);
  assert.equal(r.dateien[0].inhalt, '- By: user, handy, 2026-11-14T12:00Z\n\nAntwort A: ja (Empfehlung)\n\nZu spät, aber so war es gedacht.\n');
});

test('Erledigt schreibt die Statusdatei done mit Ergebnis', () => {
  const w = welt(TC.write[0]);
  const e = w.eintraege.get('k7m2qa');
  const r = erledigtDateien({ stempel: 'user, handy, 2026-11-14T12:00Z', ulid: ulidErzeuger(), vergeben: new Set() }, e);
  assert.equal(r.dateien[0].inhalt, '- By: user, handy, 2026-11-14T12:00Z\n- Status: done\n- Result: Erledigt in der App\n');
  assert.match(r.dateien[0].pfad, /^entries\/k7\/k7m2qa\/[0-9A-Z]{26}-status\.md$/);
});

test('Die Antwort einer Abnahme, die das Werkzeug ablehnt, lehnt auch die App ab', () => {
  const fall = TC.write.find((f) => f.name.startsWith('Abnahme bestanden'));
  const w = welt(fall);
  const e = w.eintraege.get('q2ytn0');
  const ctx = { stempel: 'user, handy', ulid: ulidErzeuger(), vergeben: new Set() };
  assert.throws(() => urteilDateien(ctx, e, w.buch.zustand(e), '1: PASS\n'), /ohne Ergebnis: Schritt 2/);
  assert.throws(() => urteilDateien(ctx, e, w.buch.zustand(e), '1: FAIL\n2: PASS'), /braucht einen Satz/);
});

test('Abnahme in Runde 2: Runde und Folgeauftrag zählen weiter, Priorität des Eintrags geht in den Folgeauftrag', () => {
  const fall = TC.write.find((f) => f.name.startsWith('Abnahme mit FAIL'));
  const pfade = new Map([['projects.md', fall.projects]]);
  const e0 = fall.entries.q2ytn0['0-entry.md'].replace('- Project: demo\n', '- Project: demo\n- Priority: 1\n');
  pfade.set('entries/q2/q2ytn0/0-entry.md', e0);
  pfade.set('entries/q2/q2ytn0/01M7CQZS800000000000000001-addendum.md', '- By: user, handy-a, 2026-11-13T10:00Z\n- Verdict: FAIL\n- Round: 1\n- Step: 1 PASS\n- Step: 2 FAIL\n\nAbnahme Runde 1: FAIL\n');
  const w = baueWelt({ pfade, jetzt: parseZeit(fall.at) });
  const e = w.eintraege.get('q2ytn0');
  const ctx = { stempel: stempel('handy-a', parseZeit(fall.at)), ulid: ulidErzeuger(), vergeben: new Set(['q2ytn0']) };
  const r = urteilDateien(ctx, e, w.buch.zustand(e), '2: FAIL Noch immer Farbe.');
  assert.equal(r.runde, 2);
  const folge = r.dateien.find((d) => d.pfad.endsWith('0-entry.md')).inhalt;
  assert.match(folge, /^# Abnahme q2ytn0, Runde 2: Schritt 2 nicht bestanden: Abnahme der Liste\n/);
  assert.match(folge, /- Priority: 1\n- Parent: q2ytn0\n/);
  assert.match(r.dateien.at(-1).inhalt, /Note: Runde 2: FAIL, Folgeauftrag [a-z0-9]{6}\n$/);
});

test('Neuer Eintrag: Titel und Text wie das Werkzeug, Rang 2 und kein Dringend bleiben weg', () => {
  const ctx = { stempel: 'user, handy, 2026-11-14T12:00Z', ulid: ulidErzeuger(), vergeben: new Set() };
  const r = anlegenDateien(ctx, { art: 'note', titel: ' Ein Satz ', an: 'alpha', text: 'Text\r\nzweite Zeile\n', rang: 2 });
  assert.equal(r.dateien[0].inhalt, '# Ein Satz\n\n- Kind: note\n- To: project:alpha\n- Project: alpha\n- From: user, handy, 2026-11-14T12:00Z\n\nText\nzweite Zeile\n');
  assert.match(r.dateien[0].pfad, /^entries\/[a-z0-9]{2}\/[a-z0-9]{6}\/0-entry\.md$/);
  assert.equal(r.nachricht, `post: new ${r.id}: Ein Satz`);
  assert.throws(() => anlegenDateien(ctx, { art: 'task', titel: '' }), /Titel/);
  assert.throws(() => anlegenDateien(ctx, { art: 'task', titel: 'x'.repeat(121) }), /120/);
  assert.throws(() => anlegenDateien(ctx, { art: 'message', titel: 'ohne Text' }), /Text/);
  const ohneText = anlegenDateien(ctx, { art: 'task', titel: 'Nur ein Titel' });
  assert.ok(ohneText.dateien[0].inhalt.endsWith('From: user, handy, 2026-11-14T12:00Z\n'));
});

test('Neu adressieren: gleiche Adressen und gleiches Projekt schreiben nichts (wie das Werkzeug)', () => {
  const fall = TC.write.find((f) => f.name === 'Neu adressieren ohne Projekt lässt das Projekt stehen');
  const w = welt(fall);
  const e = w.eintraege.get('q8s2vb');
  const ctx = { stempel: 'user, handy', ulid: ulidErzeuger(), vergeben: new Set() };
  const r = routeDateien(ctx, e, { to: ['project:demo'] });
  assert.equal(r.unveraendert, true);
  assert.equal(r.dateien.length, 0);
  assert.throws(() => routeDateien(ctx, e, { to: ['all'] }), Fehler);
});

test('ULID: 26 Zeichen, Zeit vorn, 80 Bit Zufall, in einer Millisekunde aufsteigend', () => {
  const ms = Date.UTC(2026, 10, 14, 12, 0);
  const u = ulidErzeuger(() => ms);
  const [a, b, c] = [u(), u(), u()];
  for (const x of [a, b, c]) { assert.match(x, /^[0-9A-HJKMNP-TV-Z]{26}$/); assert.equal(ulidZeit(x), ms); }
  assert.ok(a < b && b < c, 'Dateinamen ordnen sich in der Reihenfolge der Entstehung');
  const spaeter = ulidErzeuger(() => ms + 5)();
  assert.ok(c < spaeter);
  assert.notEqual(ulidErzeuger(() => ms)(), ulidErzeuger(() => ms)(), 'der Zufallsteil ist zufällig');
  // Die Zeit läuft nie rückwärts, auch wenn die Uhr zurückspringt
  let t = ms + 1000;
  const v = ulidErzeuger(() => t);
  const x1 = v(); t = ms; const x2 = v();
  assert.ok(x1 < x2);
});

test('ULID: der Zufallsteil kommt aus den Zufallsbytes (feste Folge, feste ULID)', () => {
  const ms = 1700000000000;
  const fest = () => Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  const u = ulidErzeuger(() => ms, fest);
  assert.equal(u().slice(10), '0000000000000001');
  assert.equal(u().slice(10), '0000000000000002');
});

test('Neue ID: nach NEUE_ID_RE, nie vergeben; was die Regel verletzt, wird verworfen und neu gezogen', () => {
  const vergeben = new Set();
  for (let i = 0; i < 300; i++) { const id = neueId(vergeben); assert.match(id, NEUE_ID_RE); }
  assert.equal(vergeben.size, 300);
  // Die ersten Bytes ergeben eine Ziffer vorn: wird verworfen, dann kommt die zweite Folge
  const folgen = [Uint8Array.from([1, 2, 3, 4, 5, 6]), Uint8Array.from([10, 11, 12, 13, 14, 15])];
  assert.equal(neueId(new Set(), () => folgen.shift()), 'abcdef');
});

test('Stempel: user, GERÄT, ZEIT in UTC auf die Minute', () => {
  assert.equal(stempel('handy-a', Date.UTC(2026, 10, 14, 12, 0, 59)), 'user, handy-a, 2026-11-14T12:00Z');
});

test('Uhrabweichung: unter zwei Sekunden zählt nichts, sonst die Differenz; Text mit vor und nach', () => {
  assert.equal(uhrAbweichung(1_000_500, 1_000_000), 0);
  assert.equal(uhrAbweichung(1_000_000 + 600_000, 1_000_000), 600_000);
  assert.equal(uhrAbweichung(Number.NaN, 1), null);
  assert.equal(abweichungText(-5 * 60_000), '5 min vor');
  assert.equal(abweichungText(2 * 3600_000), '2 Stunden nach');
  assert.equal(abweichungText(-30_000), '30 s vor');
});

test('Prüfung: Geheimnis blockiert immer und nennt den Ort, nie den Wert; Personendaten getrennt', () => {
  const ctx = { stempel: 'user, handy, 2026-11-14T12:00Z', ulid: ulidErzeuger(), vergeben: new Set() };
  const token = ['gh', 'p_', 'A'.repeat(36)].join('');
  const mit = anlegenDateien(ctx, { art: 'note', titel: 'Notiz', text: `eins\nzwei ${token}\ndrei` });
  const p = pruefeSendung(mit);
  assert.deepEqual(p.geheimnisse.map((t) => [t.wo, t.zeile, t.art]), [['im Text', 2, 'GitHub-Token']]);
  assert.equal(JSON.stringify(p).includes(token), false);
  const mail = anlegenDateien(ctx, { art: 'note', titel: 'Notiz', text: 'Schreib an max.muster@beispiel-firma.org bitte' });
  const q = pruefeSendung(mail);
  assert.equal(q.geheimnisse.length, 0);
  assert.deepEqual(q.personen.map((t) => [t.wo, t.art]), [['im Text', 'E-Mail']]);
  const sauber = pruefeSendung(anlegenDateien(ctx, { art: 'note', titel: 'Notiz', text: 'nichts' }));
  assert.deepEqual(sauber, { geheimnisse: [], personen: [] });
});

test('Prüfung: ein Geheimnis im Titel steht im Titel; Zeilen des Texts zählen im Text ab 1', () => {
  const ctx = { stempel: 'user, handy, 2026-11-14T12:00Z', ulid: ulidErzeuger(), vergeben: new Set() };
  const token = ['gh', 'p_', 'B'.repeat(36)].join('');
  const p = pruefeSendung(anlegenDateien(ctx, { art: 'note', titel: `Schlüssel ${token}` }));
  assert.equal(p.geheimnisse[0].wo, 'im Titel');
});

test('normText und render: Zeilenenden \\n, Umbrüche an den Enden weg, Text nach einer Leerzeile', () => {
  assert.equal(normText('\r\n a\r\nb \n\n'), ' a\nb ');
  assert.equal(render({ title: null, fields: [['By', 'x']], body: 'Text' }), '- By: x\n\nText\n');
  assert.equal(render({ title: 'T', fields: [], body: 'Text' }), '# T\n\n\nText\n');
});
