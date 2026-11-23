// Senden und Warteschlange gegen die Mock-Quelle (tests/hilfen/mockquelle.mjs): ein Commit je Sendung, Schreibabstand,
// Neubau auf bewegtem Zweig, Konflikt, Token abgelehnt, Rückgängig, Uhrabweichung. Es geht nichts ins Netz.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aufbau } from './hilfen/schreiber.mjs';
import { antwort } from './hilfen/mockquelle.mjs';
import { JETZT } from './hilfen/beispieldaten.mjs';
import { sendeCommit, schreibTakt, NEUBAU_MAX } from '../js/senden.js';
import { ulidZeit } from '../js/format.js';

const eigene = (q) => q.commits.filter((c) => !c.fremd);
const pfade = (q) => [...q.dateien.keys()];
const neuePfade = (q, vorher) => pfade(q).filter((p) => !vorher.includes(p));
const schlange = (a) => a.db.alle('schlange');
const SCHREIB = ['blobNeu', 'baumNeu', 'commitNeu', 'refNeu'];
const schreibend = (q) => q.protokoll.filter((p) => SCHREIB.includes(p.art));

test('Antwort auf eine Frage: ein Commit mit Nachtrag und Status, ohne force, Nachricht wie das Werkzeug', async () => {
  const a = await aufbau();
  const vorher = pfade(a.q);
  const r = await a.schreiber.antworten('r2d4vn', { wahl: 'A', text: 'Weil es einfacher ist.' });
  assert.equal(r.ok, true);
  assert.equal(a.hinweise[0].text, 'Antwort „A“ mit Text gespeichert');
  await a.schreiber.lauf();
  assert.equal(eigene(a.q).length, 0, 'zehn Sekunden Rückgängig: noch nichts gesendet');
  await a.sende();
  const c = eigene(a.q);
  assert.equal(c.length, 1, 'ein Commit je Sendung');
  assert.equal(c[0].message, 'post: answer r2d4vn');
  const neu = neuePfade(a.q, vorher);
  assert.equal(neu.length, 2);
  assert.match(neu.find((p) => p.endsWith('-addendum.md')), /^entries\/r2\/r2d4vn\/[0-9A-Z]{26}-addendum\.md$/);
  const add = a.q.dateien.get(neu.find((p) => p.endsWith('-addendum.md')));
  assert.equal(add, '- By: user, handy-a, 2026-11-14T13:07Z\n- Answer: A: Standardbibliothek (Empfehlung)\n\nWeil es einfacher ist.\n'.replace('13:07', '13:07'));
  const protokoll = schreibend(a.q).map((p) => `${p.methode} ${p.art}`);
  assert.deepEqual(protokoll, ['POST blobNeu', 'POST blobNeu', 'POST baumNeu', 'POST commitNeu', 'PATCH refNeu']);
  const ref = a.q.protokoll.find((p) => p.art === 'refNeu');
  assert.equal(JSON.parse(ref.body).force, false, 'Ref-Update ohne force');
  assert.equal(a.q.protokoll.find((p) => p.art === 'baumNeu') && JSON.parse(a.q.protokoll.find((p) => p.art === 'baumNeu').body).base_tree.length, 40, 'Baum mit base_tree');
  // Nach dem Senden gleicht der Schreiber ab: die Frage ist beantwortet, die Sendung ist aus der Schlange
  assert.deepEqual(await schlange(a), []);
});

test('Schreibabstand: zwischen zwei schreibenden Anfragen mindestens eine Sekunde, auch über Sendungen hinweg', async () => {
  const a = await aufbau();
  await a.schreiber.antworten('r2d4vn', { wahl: 'A' });
  await a.schreiber.erledigen('m7q2ke');
  await a.sende();
  const z = a.uhrwerk.schreibzeiten;
  assert.ok(z.length >= 8, `schreibende Anfragen: ${z.length}`);
  for (let i = 1; i < z.length; i++) assert.ok(z[i] - z[i - 1] >= 1000, `Abstand ${i}: ${z[i] - z[i - 1]} ms`);
  assert.equal(eigene(a.q).length, 2, 'zwei Sendungen, zwei Commits');
});

test('Rückgängig: nichts geht raus, die Eingabe liegt wieder als Entwurf da', async () => {
  const a = await aufbau();
  const entwurf = { schluessel: 'antwort/r2d4vn', wert: { text: 'meine Antwort' } };
  await a.db.schreibe('entwuerfe', { schluessel: entwurf.schluessel, text: 'meine Antwort' });
  const r = await a.schreiber.antworten('r2d4vn', { text: 'meine Antwort', entwurf });
  assert.equal(await a.db.lies('entwuerfe', entwurf.schluessel), undefined, 'beim Einreihen ist der Entwurf geleert');
  await a.hinweise[0].rueckgaengig();
  assert.deepEqual(await schlange(a), []);
  assert.equal((await a.db.lies('entwuerfe', entwurf.schluessel)).text, 'meine Antwort');
  await a.sende();
  assert.equal(eigene(a.q).length, 0);
  assert.equal(schreibend(a.q).length, 0, 'keine schreibende Anfrage');
  assert.equal(r.ok, true);
});

test('Rückgängig nach dem Senden gibt es nicht', async () => {
  const a = await aufbau();
  const { id } = await a.schreiber.erledigen('m7q2ke');
  await a.sende();
  assert.equal(await a.schreiber.rueckgaengig(id), false);
});

test('Konflikt: die Frage ist inzwischen beantwortet, die Sendung bleibt liegen und Trotzdem sendet nur einen Nachtrag', async () => {
  const a = await aufbau();
  await a.schreiber.antworten('r2d4vn', { wahl: 'B', text: 'Ich bin für B.' });
  // Ein anderes Gerät antwortet, ehe die zehn Sekunden um sind
  a.q.dateien.set('entries/r2/r2d4vn/01M7CQZS800000000000000009-status.md', '- By: user, handy-b, 2026-11-14T13:10Z\n- Status: done\n- Result: Antwort: A: Standardbibliothek (Empfehlung)\n');
  await a.sende();
  const [s] = await schlange(a);
  assert.equal(s.zustand, 'konflikt');
  assert.equal(s.titel, 'Schon beantwortet');
  assert.match(s.grund, /Die Frage ist um 11:00 beantwortet worden \(Antwort: A: Standardbibliothek \(Empfehlung\)\)\. Deine Antwort wurde nicht gesendet\./);
  assert.equal(eigene(a.q).length, 0, 'nichts gesendet');
  // Als Nachtrag senden
  const vorher = pfade(a.q);
  assert.equal(await a.schreiber.senden(s.id), true);
  await a.sende(1);
  const neu = neuePfade(a.q, vorher);
  assert.equal(neu.length, 1, 'allein ein Nachtrag, kein Status');
  assert.match(a.q.dateien.get(neu[0]), /^- By: user, handy-a, [^\n]+\n\nAntwort B: Zusatzpaket aus extra\n\nIch bin für B\.\n$/);
  assert.equal(a.q.dateien.get(neu[0]).includes('Answer:'), false);
});

test('Konflikt beim Einsortieren: schon einsortiert, Trotzdem senden schreibt den Nachtrag; der letzte To gilt', async () => {
  const a = await aufbau();
  await a.schreiber.einsortieren('k7m2qa', { ziel: 'beta', satz: 'Gehört zu beta.' });
  a.q.dateien.set('entries/k7/k7m2qa/01M7CQZS800000000000000009-addendum.md', '- By: user, handy-b, 2026-11-14T13:10Z\n- To: project:alpha\n- Project: alpha\n');
  await a.sende();
  const [s] = await schlange(a);
  assert.equal(s.zustand, 'konflikt');
  assert.equal(s.titel, 'Schon einsortiert');
  assert.match(s.grund, /an alpha adressiert worden\. Dein Nachtrag an beta wurde nicht gesendet\./);
  await a.schreiber.senden(s.id);
  await a.sende(1);
  const neu = [...a.q.dateien].filter(([p]) => p.startsWith('entries/k7/k7m2qa/') && p.endsWith('-addendum.md') && !p.includes('01M7CQZS8'));
  assert.equal(neu.length, 1);
  assert.equal(neu[0][1], '- By: user, handy-a, 2026-11-14T13:07Z\n- To: project:beta\n- Project: beta\n\nGehört zu beta.\n'.replace('13:07', neu[0][1].match(/T(\d\d:\d\d)Z/)[1]));
});

test('Token abgelehnt (401) beim Schreiben: die Sendung bleibt in der Schlange mit Zustand token, nichts geht verloren', async () => {
  const a = await aufbau({ quelle: { vorher: (an) => (an.art === 'baumNeu' ? antwort(401) : undefined) } });
  await a.schreiber.erledigen('m7q2ke');
  await a.sende();
  const [s] = await schlange(a);
  assert.equal(s.zustand, 'token');
  assert.equal(s.dateien.length, 1);
  assert.equal(eigene(a.q).length, 0);
});

test('Token ohne Schreibrecht (403): Zustand verboten; nach einem Neustart der Sendung geht sie raus', async () => {
  let darf = false;
  const a = await aufbau({ quelle: { vorher: (an) => (an.art === 'blobNeu' && !darf ? antwort(403, {}, { message: 'Resource not accessible by personal access token' }) : undefined) } });
  await a.schreiber.erledigen('m7q2ke');
  await a.sende();
  assert.equal((await schlange(a))[0].zustand, 'verboten');
  darf = true;
  await a.schreiber.erneutAlle();
  await a.sende(1);
  assert.equal(eigene(a.q).length, 1);
  assert.deepEqual(await schlange(a), []);
});

test('Ohne Netz bleibt die Sendung liegen und geht beim nächsten Lauf raus', async () => {
  let netz = false;
  const a = await aufbau({ quelle: { amNetz: () => netz } });
  netz = true; await a.abgleich(); netz = false;
  await a.schreiber.erledigen('m7q2ke');
  await a.sende();
  assert.equal((await schlange(a))[0].zustand, 'liegt');
  netz = true;
  await a.schreiber.weckeNetz();
  assert.equal(eigene(a.q).length, 1);
});

test('Meldet das Gerät kein Netz, zeigt die Sendung nie „wird gesendet“ und wartet gleich auf Netz', async () => {
  let netz = false;
  const zustaende = [];
  const a = await aufbau({ schreiber: { amNetz: () => netz } });
  const alt = a.db.schreibe.bind(a.db);
  a.db.schreibe = async (speicher, wert) => { if (speicher === 'schlange') zustaende.push(wert.zustand); return alt(speicher, wert); };
  await a.schreiber.erledigen('m7q2ke');
  const vorher = a.q.protokoll.length;
  await a.sende();
  assert.equal(a.q.protokoll.length, vorher, 'keine Anfrage');
  assert.equal(zustaende.includes('sendet'), false);
  const s = (await schlange(a))[0];
  assert.equal(s.zustand, 'liegt');
  assert.equal(s.warteArt, 'netz');
  assert.equal(a.meldungen.length, 1);
  netz = true;
  await a.schreiber.weckeNetz();
  assert.equal(eigene(a.q).length, 1);
});

test('Der Hinweis nach der Antwort nennt eigenen Text und Anhänge', async () => {
  const a = await aufbau();
  const bild = { name: 'a.png', groesse: 4, typ: 'image/png', daten: 'AAAA' };
  await a.schreiber.antworten('r2d4vn', { wahl: 'A' });
  await a.schreiber.antworten('r2d4vn', { wahl: 'B', text: 'Weil es einfacher ist.', anhaenge: [bild] });
  await a.schreiber.antworten('r2d4vn', { text: 'Nur Text', anhaenge: [bild, { ...bild, name: 'b.png' }] });
  assert.deepEqual(a.hinweise.map((h) => h.text), ['Antwort „A“ gespeichert', 'Antwort „B“ mit Text und 1 Anhang gespeichert', 'Antwort mit Text und 2 Anhängen gespeichert']);
});

test('Entwurf verwerfen: Text und Anhänge sind weg, Rückgängig stellt sie wieder her, solange nichts Neues im Entwurf steht', async () => {
  const a = await aufbau();
  assert.deepEqual(await a.schreiber.verwirfEntwurf('erfassen'), { ok: false }, 'ohne Entwurf gibt es nichts zu verwerfen');
  assert.equal(a.hinweise.length, 0);
  const text = { schluessel: 'erfassen', titel: 'Datei prüfen', art: 'idea', an: 'user', text: 'Bis Freitag.', rang: '1', dringend: true, zeit: JETZT };
  const anhang = { schluessel: 'anhaenge/erfassen', anhaenge: [{ name: 'a.txt', groesse: 3, typ: 'text/plain', daten: 'YWJj' }], zeit: JETZT };
  await a.db.schreibe('entwuerfe', text);
  await a.db.schreibe('entwuerfe', anhang);
  assert.deepEqual(await a.schreiber.verwirfEntwurf('erfassen'), { ok: true });
  assert.equal(await a.db.lies('entwuerfe', 'erfassen'), undefined);
  assert.equal(await a.db.lies('entwuerfe', 'anhaenge/erfassen'), undefined);
  assert.equal(a.hinweise.at(-1).text, 'Entwurf verworfen');
  assert.equal(await a.hinweise.at(-1).rueckgaengig(), true);
  assert.deepEqual(await a.db.lies('entwuerfe', 'erfassen'), text, 'Titel, Text, Wahl bleiben, wie sie waren');
  assert.deepEqual(await a.db.lies('entwuerfe', 'anhaenge/erfassen'), anhang);
  // Steht nach dem Verwerfen schon etwas Neues im Entwurf, bleibt es
  await a.schreiber.verwirfEntwurf('erfassen');
  const neu = { schluessel: 'erfassen', titel: 'Etwas anderes', art: 'task', an: '', text: '', rang: '2', dringend: false, zeit: JETZT };
  await a.db.schreibe('entwuerfe', neu);
  assert.equal(await a.hinweise.at(-1).rueckgaengig(), false);
  assert.deepEqual(await a.db.lies('entwuerfe', 'erfassen'), neu);
  assert.equal(eigene(a.q).length, 0);
  assert.equal(schreibend(a.q).length, 0, 'ein Entwurf sendet nie etwas');
});

test('Ohne Netz sagt die App nach dem Ende von Rückgängig einmal, dass die Sendung wartet', async () => {
  let netz = false;
  const a = await aufbau({ quelle: { amNetz: () => netz } });
  netz = true; await a.abgleich(); netz = false;
  await a.schreiber.erledigen('m7q2ke');
  assert.deepEqual(a.meldungen, [], 'vor dem Ablauf von Rückgängig sagt der Hinweis mit Knopf alles');
  await a.sende();
  assert.deepEqual(a.meldungen, ['Erledigt wartet auf Netz und geht raus, sobald du online bist.']);
  await a.sende(11_000);
  assert.equal(a.meldungen.length, 1, 'die nächsten Versuche schweigen');
  netz = true;
  await a.schreiber.weckeNetz();
  assert.equal(eigene(a.q).length, 1);
  assert.match(a.meldungen.at(-1), /^Erledigt gesendet um \d\d:\d\d\.$/, 'was gewartet hatte, meldet nach dem Senden die Uhrzeit');
  assert.equal(a.meldungen.length, 2);
});

test('Eine Sendung ohne Wartezeit meldet nach dem Senden nichts zusätzlich', async () => {
  const a = await aufbau();
  await a.schreiber.erledigen('m7q2ke');
  await a.sende();
  assert.deepEqual(a.meldungen, []);
});

test('Zweig bewegt sich (422 beim Verschieben): Baum und Commit werden auf dem neuen Kopf neu gebaut, die Blobs bleiben', async () => {
  let einmal = true;
  const a = await aufbau({ quelle: { vorher: (an) => {
    if (an.art === 'refNeu' && einmal) { einmal = false; a.q.dateien.set('entries/zz/zzzzzz/0-entry.md', '# Fremd\n\n- Kind: note\n- From: session:aaaa0000, rechner-a, 2026-11-14T13:00Z\n\nfremd\n'); }
    return undefined;
  } } });
  await a.schreiber.antworten('r2d4vn', { wahl: 'A' });
  await a.sende();
  assert.equal(eigene(a.q).length, 1);
  const refs = a.q.protokoll.filter((p) => p.art === 'refNeu');
  assert.equal(refs.length, 2, 'erst abgelehnt, dann angenommen');
  assert.equal(a.q.protokoll.filter((p) => p.art === 'blobNeu').length, 2, 'die Blobs nicht noch einmal');
  assert.equal(a.q.protokoll.filter((p) => p.art === 'baumNeu').length, 2);
  assert.ok(a.q.dateien.has('entries/zz/zzzzzz/0-entry.md'), 'der fremde Push bleibt erhalten');
  assert.ok([...a.q.dateien.keys()].some((p) => p.startsWith('entries/r2/r2d4vn/') && p.endsWith('-status.md') && !p.includes('01M7CQ')));
  assert.deepEqual(await schlange(a), []);
});

test('Neubau bei 409: derselbe Weg wie bei 422', async () => {
  let einmal = true;
  const a = await aufbau({ quelle: { vorher: (an) => {
    if (an.art === 'refNeu' && einmal) { einmal = false; a.q.dateien.set('entries/zz/zzzzzz/0-entry.md', '# Fremd\n\n- Kind: note\n- From: session:aaaa0000, rechner-a, 2026-11-14T13:00Z\n\nfremd\n'); return antwort(409, {}, { message: 'Conflict' }); }
    return undefined;
  } } });
  await a.schreiber.erledigen('m7q2ke');
  await a.sende();
  assert.equal(eigene(a.q).length, 1);
  assert.equal(a.q.protokoll.filter((p) => p.art === 'refNeu').length, 2);
});

test('Lehnt GitHub das Verschieben ab, ohne dass der Zweig sich bewegt hat, gibt es keinen Neubau-Kreis', async () => {
  const a = await aufbau({ quelle: { vorher: (an) => (an.art === 'refNeu' ? antwort(422, {}, { message: 'kaputt' }) : undefined) } });
  await a.schreiber.erledigen('m7q2ke');
  await a.sende();
  assert.equal(a.q.protokoll.filter((p) => p.art === 'refNeu').length, 1);
  const [s] = await schlange(a);
  assert.equal(s.zustand, 'fehler');
  assert.match(s.grund, /lehnt die Sendung ab/);
});

test('Ein Zweig, der sich immer weiter bewegt, endet nach höchstens fünf Versuchen', async () => {
  let n = 0;
  const a = await aufbau({ quelle: { vorher: (an) => {
    if (an.art === 'refNeu') a.q.dateien.set(`entries/zz/zzzzz${n++ % 9}/0-entry.md`, `# Fremd ${n}\n\n- Kind: note\n- From: s\n\nx\n`);
    return undefined;
  } } });
  await a.schreiber.erledigen('m7q2ke');
  await a.sende();
  assert.equal(a.q.protokoll.filter((p) => p.art === 'refNeu').length, NEUBAU_MAX);
  assert.equal((await schlange(a))[0].zustand, 'fehler');
});

test('Uhrabweichung: das Gerät geht 10 Minuten vor, die Dateien tragen die Zeit von GitHub', async () => {
  const ECHT = Date.UTC(2026, 10, 14, 13, 7, 0);   // 14:07 Ortszeit in Berlin im Winter, UTC 13:07
  const a = await aufbau({ uhr: ECHT + 10 * 60_000, quelle: { serverzeit: () => ECHT } });
  assert.equal((await a.db.lies('einstellungen', 'uhr')).wert.abweichung, -10 * 60_000);
  await a.schreiber.antworten('r2d4vn', { wahl: 'A' });
  await a.sende();
  const add = [...a.q.dateien].find(([p, t]) => p.startsWith('entries/r2/r2d4vn/') && p.endsWith('-addendum.md') && t.startsWith('- By: user, handy-a'));
  assert.ok(add, 'Nachtrag gesendet');
  assert.match(add[1], /^- By: user, handy-a, 2026-11-14T13:07Z\n/);
  const zeit = ulidZeit(add[0].split('/').pop());
  assert.ok(Math.abs(zeit - ECHT) < 15_000, `ULID-Zeit ${new Date(zeit).toISOString()}`);
});

test('Uhr stimmt: keine Korrektur, die Zeit ist die des Geräts', async () => {
  const a = await aufbau({ uhr: Date.UTC(2026, 10, 14, 13, 7, 0), quelle: { serverzeit: () => Date.UTC(2026, 10, 14, 13, 7, 1) } });
  assert.equal((await a.db.lies('einstellungen', 'uhr')).wert.abweichung, 0);
});

test('Prüfung vor dem Senden: ein Geheimnis kommt nie in die Schlange', async () => {
  const a = await aufbau();
  const token = ['gh', 'p_', 'C'.repeat(36)].join('');
  const r = await a.schreiber.antworten('r2d4vn', { text: `Hier: ${token}` });
  assert.equal(r.ok, false);
  assert.equal(r.pruefung.geheimnisse.length, 1);
  assert.equal(JSON.stringify(r).includes(token), false);
  assert.deepEqual(await schlange(a), []);
  const mail = await a.schreiber.antworten('r2d4vn', { text: 'schreib an max.muster@beispiel-firma.org' });
  assert.equal(mail.ok, false);
  assert.equal(mail.pruefung.personen.length, 1);
  const erlaubt = await a.schreiber.antworten('r2d4vn', { text: 'schreib an max.muster@beispiel-firma.org', personenErlaubt: true });
  assert.equal(erlaubt.ok, true);
});

test('Eine Abnahme mit FAIL: Nachtrag, Folgeauftrag und Status gehen in einem Commit raus', async () => {
  const a = await aufbau();
  const vorher = pfade(a.q);
  const r = await a.schreiber.urteilSenden('h2n9vz', { text: '1: PASS\n2: FAIL Das Bild ist unscharf.\n3: PASS\n4: PASS\n5: PASS\n6: PASS' });
  assert.equal(r.ok, true, JSON.stringify(r));
  await a.sende();
  assert.equal(eigene(a.q).length, 1);
  const neu = neuePfade(a.q, vorher);
  assert.equal(neu.length, 3);
  assert.ok(neu.some((p) => p.endsWith('0-entry.md')));
  assert.match(eigene(a.q)[0].message, /^post: answer h2n9vz: FAIL, new [a-z0-9]{6}$/);
});

test('Ein neuer Eintrag: Datei im Datenbestand, Nachricht wie das Werkzeug, danach steht er auf dem Gerät', async () => {
  const a = await aufbau();
  const r = await a.schreiber.anlegen({ art: 'task', titel: 'Datei prüfen', an: 'alpha', text: 'Bitte bis Freitag.', rang: 1, dringend: true });
  await a.sende();
  const c = eigene(a.q)[0];
  assert.match(c.message, /^post: new [a-z][a-z0-9]{5}: Datei prüfen$/);
  const p = pfade(a.q).find((x) => x.endsWith('0-entry.md') && x.includes(c.message.split(' ')[2].replace(':', '')));
  assert.match(a.q.dateien.get(p), /- Kind: task\n- To: project:alpha\n- Project: alpha\n- From: user, handy-a, [^\n]+\n- Priority: 1\n- Urgent: yes\n\nBitte bis Freitag\.\n$/);
  assert.equal(r.ok, true);
  const w = await a.db.lies('baum', 'stand');
  assert.ok(w.eintraege.some((x) => x.pfad === p), 'der Abgleich nach dem Senden kennt die Datei');
});

test('Nach einem Neustart mitten im Senden liegt die Sendung wieder; kam sie an, wird sie nicht doppelt geschrieben', async () => {
  const a = await aufbau();
  const { id } = await a.schreiber.erledigen('m7q2ke');
  // Der Commit ging raus, die App endete vor der Antwort: die Sendung steht noch auf „sendet“
  const s = await a.db.lies('schlange', id);
  await sendeCommit({ fetch: a.q.fetch, quelle: a.quelle, dateien: s.dateien, nachricht: s.nachricht, takt: schreibTakt({ uhr: () => 0, warte: async () => {} }) });
  await a.db.schreibe('schlange', { ...s, zustand: 'sendet' });
  assert.equal(eigene(a.q).length, 1);
  await a.schreiber.aufraeumenBeimStart();
  await a.sende();
  assert.equal(eigene(a.q).length, 1, 'kein zweiter Commit mit denselben Dateien');
  assert.deepEqual(await schlange(a), []);
});

test('sendeCommit allein: Fehler ohne Anmeldung und ohne Dateien, Abstand auch bei der Vorlage des Taktes', async () => {
  await assert.rejects(sendeCommit({ fetch: async () => {}, quelle: { repo: 'kaputt', token: 'x' }, dateien: [{ pfad: 'a', inhalt: 'b' }] }), { art: 'einstellung' });
  await assert.rejects(sendeCommit({ fetch: async () => {}, quelle: { repo: 'a/b', token: 'x' }, dateien: [] }), { art: 'einstellung' });
  const t = schreibTakt({ uhr: () => 0, warte: async () => {} });
  await t.vorSchreiben(); t.nachSchreiben(); await t.vorSchreiben();
  assert.equal(JETZT > 0, true);
});

test('Ohne Netz fragt der Schreiber erst nach zehn Sekunden wieder (kein Zeitgeber ohne Pause); Netz weckt die Sendung früher', async () => {
  let netz = false;
  const wartezeiten = [];
  const a = await aufbau({ quelle: { amNetz: () => netz }, schreiber: { zeitgeber: { setze: (f, ms) => { wartezeiten.push(ms); return 0; }, loesche: () => {} } } });
  netz = true; await a.abgleich(); netz = false;
  await a.schreiber.erledigen('m7q2ke');
  assert.equal(wartezeiten.at(-1), 10_000, 'die Frist für Rückgängig');
  await a.sende();
  const s = (await schlange(a))[0];
  assert.equal(s.zustand, 'liegt');
  assert.equal(s.warteArt, 'netz');
  assert.equal(wartezeiten.at(-1), 10_000, 'die nächste Frage kommt nach zehn Sekunden, nicht sofort');
  await a.sende(5000);
  assert.equal(eigene(a.q).length, 0, 'nach fünf Sekunden fragt der Schreiber noch nicht wieder');
  netz = true;
  await a.schreiber.weckeNetz();
  assert.equal(eigene(a.q).length, 1, 'Netz weckt die Sendung, auch vor der Frist');
});
