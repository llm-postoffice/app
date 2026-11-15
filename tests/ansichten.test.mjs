// Die Ansichten in einem winzigen DOM (hilfen/fakedom.mjs): welcher Zustand erscheint wann (lädt, Fehler, leer, gefüllt,
// Token abgelaufen), jede Handlung hat einen Knopf (E13), Freigaben haben keine Knöpfe, fremder Text bleibt Text (USI-1)
// und der Code ruft nie innerHTML.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { installiereFakeDom, suche as finde, textVon } from './hilfen/fakedom.mjs';
import { JETZT, dateien, schlange } from './hilfen/beispieldaten.mjs';
import { AbgleichFehler } from '../js/abgleich.js';

let aufraeumen;
let M;
before(async () => {
  aufraeumen = installiereFakeDom();
  M = {
    welt: await import('../js/welt.js'), ansichten: await import('../js/ansichten.js'), eintrag: await import('../js/eintrag.js'),
    ablauf: await import('../js/ablauf.js'), erfassen: await import('../js/erfassen.js'), mehr: await import('../js/mehr.js'),
    speicher: await import('../js/speicher.js'), steuerung: await import('../js/steuerung.js'),
  };
});
after(() => aufraeumen());

const welt = (extra = {}) => M.welt.baueWelt({ pfade: dateien(), jetzt: JETZT, ...extra });
const ohne = () => M.welt.baueWelt({ pfade: null, jetzt: JETZT });
const leer = () => M.welt.baueWelt({ pfade: new Map([['projects.md', '# Projekte\n']]), jetzt: JETZT });
const z = (teil = {}) => ({ phase: 'bereit', fortschritt: null, fehler: null, ohneNetz: false, letzter: { geprueft: JETZT - 5 * 60000, dateien: 60 }, naechster: null, ...teil });
async function kontext(schreiben = null) {
  const db = M.speicher.speicherDatenbank();
  const steuerung = new M.steuerung.Abgleichsteuerung({ db, fetch: () => { throw new Error('kein Netz im Test'); }, jetzt: () => JETZT });
  return { db, steuerung, schreiben, jetzt: () => JETZT, gehe() {}, ersetze() {}, neuZeichnen() {} };
}
const t = (x) => textVon(x).replaceAll('\u00ad', '');

test('Wartet gefüllt: Ergebnis zuerst, Dringendes nennt die Zahl, Eingang darunter', async () => {
  const k = await kontext();
  const knoten = M.ansichten.wartet(welt(), z(), k);
  const text = t(knoten);
  assert.match(text, /7\s+für dich/);
  assert.match(text, /davon 1 dringend/);
  assert.match(text, /Abgeglichen um 14:02/);
  assert.match(text, /Eingang\s*2 Einträge zum Einsortieren/);
  assert.equal(finde(knoten, 'a.karte').length, 8, 'sieben Einträge und der Eingang');
  assert.ok(finde(knoten, 'a.karte.dringend').length === 1);
});

test('Wartet leer, lädt, Fehler, Token abgelaufen: jede Lage hat einen eigenen Zustand (UFA-10)', async () => {
  const k = await kontext();
  assert.match(t(M.ansichten.wartet(leer(), z(), k)), /Nichts für dich/);
  const laedt = t(M.ansichten.wartet(ohne(), z({ phase: 'laeuft', fortschritt: { phase: 'dateien', fertig: 212, gesamt: 514 }, letzter: null }), k));
  assert.match(laedt, /Einträge werden geladen/);
  assert.match(laedt, /212 von 514 Dateien/);
  const knoten503 = M.ansichten.wartet(ohne(), z({ phase: 'fehler', fehler: new AbgleichFehler('antwort', 'x', { status: 503 }), letzter: null }), k);
  assert.match(t(knoten503), /Einträge nicht geladen/);
  assert.match(t(knoten503), /Status 503/);
  assert.equal(finde(knoten503, 'button').filter((b) => t(b) === 'Erneut versuchen').length, 1);
  const token = M.ansichten.wartet(welt(), z({ phase: 'fehler', fehler: new AbgleichFehler('token', 'x', { status: 401 }) }), k);
  assert.match(t(token), /Token abgelaufen oder widerrufen/);
  assert.match(t(token), /Stand von 14:02, seitdem nicht abgeglichen/);
  assert.equal(finde(token, 'a').filter((a) => a.getAttribute('href') === '#anmelden' && t(a) === 'Neues Token eintragen').length, 1);
  assert.equal(finde(token, 'a.karte').length, 8, 'der Stand bleibt sichtbar');
});

test('Ohne Netz zeigt die Karte „wartet auf Netz“ für Sendungen', async () => {
  const k = await kontext();
  const w = welt({ schlange: schlange() });
  const text = t(M.ansichten.wartet(w, z({ ohneNetz: true }), k));
  assert.match(text, /Antwort „A“ noch nicht gesendet, wartet auf Netz/);
  assert.match(text, /Zuletzt abgeglichen um 14:02/);
});

test('Abnahmen, Eingang, Ideensammlung und Suche haben je leer, lädt, Fehler und gefüllt', async () => {
  const k = await kontext();
  assert.match(t(M.ansichten.abnahmen(welt(), z(), k)), /3\s+Abnahmen[\s\S]*23 Schritte offen[\s\S]*rechner-a · 2 Abnahmen · 17 Schritte offen/);
  assert.match(t(M.ansichten.abnahmen(leer(), z(), k)), /Keine Abnahmen/);
  assert.match(t(M.ansichten.eingang(welt(), z(), k)), /2\s+zum Einsortieren/);
  assert.match(t(M.ansichten.eingang(leer(), z(), k)), /Alles einsortiert/);
  assert.match(t(M.ansichten.eingang(ohne(), z({ phase: 'laeuft', fortschritt: null, letzter: null }), k)), /Eingang wird geladen/);
  assert.match(t(M.ansichten.ideen(welt(), z(), k)), /4\s+Ideen/);
  assert.match(t(M.ansichten.ideen(leer(), z(), k)), /Keine Ideen/);
  assert.match(t(M.ansichten.ideen(ohne(), z({ phase: 'fehler', fehler: new AbgleichFehler('antwort', 'x', { status: 503 }), letzter: null }), k)), /Ideen nicht geladen/);
  assert.match(t(M.ansichten.sucheAnsicht(welt(), z(), k, '')), /Suche nach Titel oder ID/);
  assert.match(t(M.ansichten.sucheAnsicht(welt(), z(), k, 'tpc-0e0')), /1 Treffer für „tpc-0e0“/);
  assert.match(t(M.ansichten.sucheAnsicht(welt(), z(), k, 'zzz-999')), /Nichts gefunden/);
});

const aktion = async (id, schreiben = null) => {
  const k = await kontext(schreiben);
  const w = welt();
  const r = M.eintrag.eintragAnsicht(w, z(), k, { id });
  const e = w.eintraege.get(id);
  return { r, handlungen: M.welt.handlungenVon(w, { e, st: w.buch.zustand(e) }), knoepfe: finde(r.aktion ?? [], '[data-handlung]') };
};

test('E13: zu jeder Handlung einer Art gibt es genau einen Knopf, und zu jedem Knopf eine Handlung', async () => {
  for (const id of ['r2d4vn', 'm7q2ke', 'k7m2qa', '8k3m1x', 'q7w2de', 'b3cyxm', 'd5n8vk', 'tpc0e0']) {
    const { handlungen, knoepfe, r } = await aktion(id);
    assert.deepEqual(knoepfe.map((b) => b.dataset.handlung), handlungen, `${id}: Knöpfe und Handlungen`);
    if (!handlungen.length) assert.equal(r.aktion ?? null, null, `${id}: keine Leiste ohne Handlung`);
  }
});

test('Ohne Schreibschicht sind Erledigt und Senden gesperrt und ein Satz sagt warum; Antworten und Einsortieren öffnen nur das Blatt', async () => {
  const { r, knoepfe } = await aktion('m7q2ke');
  const erledigt = knoepfe.find((b) => b.dataset.handlung === 'erledigt');
  assert.equal(erledigt.disabled, true);
  assert.match(t(r.aktion), /Senden ist hier nicht eingerichtet/);
  const antworten = knoepfe.find((b) => b.dataset.handlung === 'antworten');
  assert.equal(antworten.getAttribute('href'), '#eintrag/m7q2ke/antworten');
  const mit = await aktion('m7q2ke', { erledigen: async () => {} });
  assert.equal(mit.knoepfe.find((b) => b.dataset.handlung === 'erledigt').disabled, false);
  assert.doesNotMatch(t(mit.r.aktion), /nicht eingerichtet/);
});

test('Freigabe: keine Knöpfe, aber der Satz, dass Freigeben erst in Phase 4 geht (E5)', async () => {
  const { r } = await aktion('q7w2de');
  assert.equal(r.aktion ?? null, null);
  assert.match(t(r.inhalt), /Freigeben und Ablehnen gehen erst in Phase 4/);
  assert.equal(finde(r.inhalt, 'button').length, 0);
});

test('Eintrag: Kopfkarte mit Art, ID, Projekt; Frage mit Möglichkeiten, Annahme, Faden und Quelle', async () => {
  const { r } = await aktion('r2d4vn');
  const text = t(r.inhalt);
  assert.match(text, /Frage[\s\S]*r2d-4vn/);
  assert.match(text, /beta\s*·\s*Rang 2/);
  assert.match(text, /von session:cb56d77f auf rechner-a/);
  assert.match(text, /Ohne deine Antwort arbeitet die Sitzung mit Annahme A weiter\./);
  assert.match(text, /A\s*Standardbibliothek\s*Empfehlung/);
  assert.match(text, /Faden[\s\S]*Messung: der Befehl braucht auf rechner-a 0,07 s\./);
  assert.match(text, /Quelle\s*beta:docs\/entwurf\.md:120@3e1f0a2/);
});

test('Eintrag im Eingang sagt, dass er kein Ziel hat und bietet Einsortieren an', async () => {
  const { r, knoepfe } = await aktion('k7m2qa');
  assert.match(t(r.inhalt), /Der Eintrag hat kein Ziel\. Er bleibt im Eingang, bis du ihn einsortierst\./);
  assert.deepEqual(knoepfe.map((b) => b.getAttribute('href')), ['#eintrag/k7m2qa/einsortieren']);
});

test('Unbekannter Eintrag und fehlender Stand haben einen Zustand statt eines leeren Bildschirms', async () => {
  const k = await kontext();
  assert.match(t(M.eintrag.eintragAnsicht(welt(), z(), k, { id: 'zzzzzz' }).inhalt), /Eintrag nicht gefunden/);
  assert.match(t(M.eintrag.eintragAnsicht(ohne(), z({ phase: 'laeuft', letzter: null }), k, { id: 'r2d4vn' }).inhalt), /Eintrag wird geladen/);
});

test('Fremder Text: Titel und Text sind nur Text, Rohes HTML bleibt sichtbar, Links nur mit https (USI-1)', async () => {
  const pfade = new Map(dateien());
  pfade.set('entries/ab/ab3cde/0-entry.md', '# <img src=x onerror=alert(1)> Titel\n\n- Kind: message\n- To: user\n- From: session:5fbc7a01, rechner-a, 2026-11-14T13:00Z\n\n<script>alert(1)</script> **fett** [Falle](javascript:alert(1)) [gut](https://localhost/x)\n');
  const w = M.welt.baueWelt({ pfade, jetzt: JETZT });
  const k = await kontext();
  const r = M.eintrag.eintragAnsicht(w, z(), k, { id: 'ab3cde' });
  assert.match(t(r.inhalt), /<img src=x onerror=alert\(1\)> Titel/);
  assert.match(t(r.inhalt), /<script>alert\(1\)<\/script>/);
  assert.equal(finde(r.inhalt, 'script').length + finde(r.inhalt, 'img').length, 0);
  const links = finde(r.inhalt, 'a').filter((a) => (a.getAttribute('href') ?? '').startsWith('http') || (a.getAttribute('href') ?? '').startsWith('javascript'));
  assert.deepEqual(links.map((a) => a.getAttribute('href')), ['https://localhost/x']);
  assert.equal(links[0].getAttribute('rel'), 'noopener noreferrer');
  const extern = M.eintrag.eintragAnsicht(w, z(), k, { id: 'x9k3ft' });
  assert.equal(finde(extern.inhalt, 'blockquote.zitat').length >= 1, true, 'Text von außen steht als Zitat');
  assert.match(t(extern.inhalt), /stammt von außen/);
});

test('Abnahme als Eintrag: Schritte mit Urteil, Gesamt-Hinweis und der Weg weiter', async () => {
  const k = await kontext();
  const w = welt();
  const r = M.eintrag.eintragAnsicht(w, z(), k, { id: '8k3m1x' });
  assert.equal(finde(r.inhalt, 'a.schritt').length, 9);
  assert.match(t(r.inhalt), /Gesamt wird FAIL, solange ein Schritt ohne Urteil bleibt\./);
  assert.equal(finde(r.aktion, 'a')[0].getAttribute('href'), '#eintrag/8k3m1x/schritt/1');
  const b = M.eintrag.eintragAnsicht(w, z(), k, { id: 'p4m7bt' });
  assert.match(t(b.inhalt), /Runde 2: 8 von 12 Schritten offen/);
  assert.equal(finde(b.aktion, 'a')[0].getAttribute('href'), '#eintrag/p4m7bt/schritt/5', 'Schritt 1 bis 4 haben ein früheres Ergebnis (PASS, SKIP)');
});

test('Schritt: Aktion, Befehl, Erwartetes und vier Urteile; Ergebnis mit Folgeauftrag', async () => {
  const k = await kontext();
  await k.db.schreibe('entwuerfe', { schluessel: 'urteil/8k3m1x', anmerkung: '', schritte: { 1: { wort: 'PASS' }, 3: { wort: 'FAIL', satz: 'Linien in der Pipe.' } } });
  const w = M.welt.baueWelt({ pfade: dateien(), jetzt: JETZT, entwuerfe: await k.db.alle('entwuerfe') });
  const s = await M.ablauf.schrittAnsicht(w, z(), k, { id: '8k3m1x', schritt: 3 });
  const text = t(s.inhalt);
  assert.match(text, /Schritt 3 von 9/);
  assert.match(text, /2 von 9 beurteilt, an rechner-a/);
  assert.match(text, /Aktion\s*Ausgabe in einer Pipe/);
  assert.match(text, /rechner-a-tool --help \| cat/);
  assert.match(text, /Erwartet\s*Keine Farbe und keine Linien/);
  assert.deepEqual(finde(s.inhalt, 'button[data-urteil]').map((b) => b.getAttribute('data-urteil')), ['PASS', 'FAIL', 'BLOCKED', 'SKIP']);
  assert.equal(finde(s.inhalt, 'button[aria-pressed="true"]').length, 1);
  assert.match(text, /FAIL: Linien in der Pipe\./);
  const e = await M.ablauf.ergebnisAnsicht(w, z(), k, { id: '8k3m1x' });
  assert.match(t(e.inhalt), /Gesamt: FAIL/);
  assert.match(t(e.inhalt), /Schritt 3 ist FAIL\./);
  assert.match(t(e.inhalt), /Folgeauftrag für alpha/);
  assert.equal(finde(e.aktion, 'button').length, 1);
  assert.equal(finde(e.aktion, 'button')[0].disabled, true);
});

test('Erfassen: Formular mit Art, Titel, An, Text, Rang, Dringend; Entwurf bleibt; Prüfung des Titels', async () => {
  const k = await kontext();
  const e = await M.erfassen.erfassenAnsicht(welt(), z(), k);
  assert.equal(finde(e.inhalt, 'input[name="art"]').length, 4);
  assert.equal(finde(e.inhalt, 'input[name="rang"]').length, 3);
  assert.equal(finde(e.inhalt, 'select[name="an"]').length, 1);
  assert.equal(finde(e.aktion, 'button')[0].disabled, true);
  assert.deepEqual(M.erfassen.pruefeEintrag({ titel: '' }), { fehler: { titel: 'Gib einen Titel ein.' } });
  assert.deepEqual(M.erfassen.pruefeEintrag({ titel: 'x'.repeat(121) }).fehler.titel.slice(0, 15), 'Der Titel hat 1');
  assert.deepEqual(M.erfassen.pruefeEintrag({ titel: 'ok' }), { ok: true });
  const titel = finde(e.inhalt, 'input[name="titel"]')[0];
  titel.value = 'Mein Titel';
  for (const f of titel.horcher.input) f();
  await new Promise((r) => setImmediate(r));
  assert.equal((await k.db.lies('entwuerfe', 'erfassen')).titel, 'Mein Titel');
  const wieder = await M.erfassen.erfassenAnsicht(welt(), z(), k);
  assert.equal(finde(wieder.inhalt, 'input[name="titel"]')[0].value, 'Mein Titel', 'der Entwurf überlebt das Neuzeichnen');
});

test('Mehr: Ziele, Anmeldung, Mitteilungen und Dieses Gerät; Fehler des Abgleichs mit Einzelheiten', async () => {
  const k = await kontext();
  await M.speicher.setzeEinstellung(k.db, 'anmeldung', { repo: 'org/daten', token: 'GEHEIMNIS', ablauf: '2027-10-30' });
  await M.speicher.setzeEinstellung(k.db, 'geraet', 'handy');
  const knoten = await M.mehr.mehrAnsicht(welt(), z(), k);
  const text = t(knoten);
  assert.match(text, /Eingang\s*2 Einträge zum Einsortieren/);
  assert.match(text, /Ideensammlung\s*4 Ideen, sie warten nicht auf dich/);
  assert.match(text, /Suche und Archiv/);
  assert.match(text, /Angemeldet mit einem Token für org\/daten\. Es läuft am 2027-10-30 ab, in 350 Tagen\./);
  assert.doesNotMatch(text, /GEHEIMNIS/, 'das Token steht nie in der Anzeige');
  assert.match(text, /Hinweise kommen über die App ntfy/);
  assert.match(text, /Gerät\s*handy/);
  assert.equal(finde(knoten, 'a').filter((a) => a.getAttribute('href') === '#anmelden').length, 1);
  const fehler = await M.mehr.mehrAnsicht(welt(), z({ phase: 'fehler', fehler: new AbgleichFehler('token', 'x', { status: 401 }) }), k);
  assert.match(t(fehler), /Token abgelaufen oder widerrufen/);
  assert.match(t(fehler), /Einzelheiten/);
});

test('Mehr: eine wartende neue Fassung steht als Band bei Fassung mit Neu starten (UOF-5)', async () => {
  const k = await kontext();
  const aufrufe = [];
  k.aktualisierung = { wartet: true, startet: false, neustart: () => aufrufe.push('neustart') };
  const knoten = await M.mehr.mehrAnsicht(welt(), z(), k);
  assert.match(t(knoten), /Neue Fassung geladen\s*Die neue Fassung läuft erst nach dem Neustart/);
  const knopf = finde(knoten, 'button').find((b) => t(b) === 'Neu starten');
  assert.ok(knopf, 'Knopf Neu starten');
  await knopf.klick();
  assert.deepEqual(aufrufe, ['neustart']);
  k.aktualisierung = { wartet: true, startet: true, neustart() {} };
  const startet = t(await M.mehr.mehrAnsicht(welt(), z(), k));
  assert.match(startet, /Neue Fassung startet/);
  assert.doesNotMatch(startet, /Neu starten/, 'nach dem Tipp kein zweiter Knopf');
  k.aktualisierung = { wartet: false, startet: false, neustart() {} };
  assert.doesNotMatch(t(await M.mehr.mehrAnsicht(welt(), z(), k)), /Neue Fassung geladen/, 'ohne wartende Fassung kein Band');
});

test('Mehr: App installieren als nummerierte Liste im Browser, ein Satz in der installierten App', async () => {
  const k = await kontext();
  k.installiert = false;
  const browser = await M.mehr.mehrAnsicht(welt(), z(), k);
  const liste = finde(browser, 'ol').find((o) => finde(o, 'li').some((l) => /Install and create shortcut/.test(t(l))));
  assert.ok(liste, 'nummerierte Liste der Installation');
  assert.equal(finde(liste, 'li').length, 5);
  assert.equal(finde(liste, 'strong')[0].textContent, 'Install and create shortcut', 'der Wortlaut steht fett');
  assert.doesNotMatch(t(browser), /läuft als installierte App/);
  k.installiert = true;
  const app = t(await M.mehr.mehrAnsicht(welt(), z(), k));
  assert.match(app, /Das Postfach läuft als installierte App\./);
  assert.doesNotMatch(app, /Install and create shortcut/);
  assert.match(app, /Anmeldung der App, nicht die eines Browsertabs/);
});

test('Mehr: Mitteilungen sagen in Worten, was ID kopieren tut und was ein Tipp öffnet', async () => {
  const text = t(await M.mehr.mehrAnsicht(welt(), z(), await kontext()));
  assert.match(text, /ID kopieren im Hinweis legt die ID des Eintrags in die Zwischenablage und schließt den Hinweis/);
  assert.match(text, /Ein Tipp auf den Hinweis öffnet ntfy, nicht diese App/);
  assert.match(text, /Tippe auf \+, nicht auf einen Link/);
});

test('Der Code ruft nie innerHTML auf (USI-1)', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  for (const f of await readdir(new URL('../js/', import.meta.url))) {
    assert.doesNotMatch((await readFile(new URL(`../js/${f}`, import.meta.url), 'utf8')).replace(/\/\/.*$/gm, ''), /innerHTML|outerHTML|insertAdjacentHTML/, f);
  }
});
