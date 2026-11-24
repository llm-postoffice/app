// Die Ansichten an der Schreibschicht (Teil E): jeder Knopf, der sendet, ruft die Schreibschicht mit den richtigen Angaben;
// eine abgelehnte Eingabe zeigt ein Band und schließt nichts; der Hinweis bietet Rückgängig an. Ein winziges DOM (hilfen/fakedom.mjs)
// und ein Schreiber, der nur aufschreibt, was man ihn fragt.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { installiereFakeDom, suche as finde, textVon, Knoten } from './hilfen/fakedom.mjs';
import { JETZT, dateien, entwuerfe, schlangeZustaende } from './hilfen/beispieldaten.mjs';

let aufraeumen;
let M;
before(async () => {
  aufraeumen = installiereFakeDom();
  M = {
    welt: await import('../js/welt.js'), eintrag: await import('../js/eintrag.js'), bearbeiten: await import('../js/bearbeiten.js'), ablauf: await import('../js/ablauf.js'),
    erfassen: await import('../js/erfassen.js'), hinweis: await import('../js/hinweis.js'), speicher: await import('../js/speicher.js'),
    steuerung: await import('../js/steuerung.js'), absenden: await import('../js/absenden.js'), entwuerfe: await import('../js/entwuerfe.js'),
  };
});
after(() => aufraeumen());

const t = (x) => textVon(x).replaceAll('­', '');
const welt = (extra = {}) => M.welt.baueWelt({ pfade: dateien(), jetzt: JETZT, ...extra });
const z = () => ({ phase: 'bereit', fortschritt: null, fehler: null, ohneNetz: false, letzter: { geprueft: JETZT - 5 * 60000, dateien: 60 }, naechster: null });

/** Ein Schreiber, der Aufrufe aufschreibt und die vorgegebene Antwort gibt. */
function attrappe(antwort = { ok: true, id: 's1' }) {
  const aufrufe = [];
  const f = (name) => async (...a) => { aufrufe.push([name, ...a]); return typeof antwort === 'function' ? antwort(name, ...a) : antwort; };
  return { aufrufe, antworten: f('antworten'), urteilSenden: f('urteilSenden'), erledigen: f('erledigen'), einsortieren: f('einsortieren'), anlegen: f('anlegen'),
    senden: f('senden'), erneut: f('erneut'), verwerfen: f('verwerfen'),
    rangAendern: f('rangAendern'), neuAdressieren: f('neuAdressieren'), nachtragen: f('nachtragen'), eintragVerwerfen: f('eintragVerwerfen') };
}
async function kontext(schreiben) {
  const db = M.speicher.speicherDatenbank();
  const steuerung = new M.steuerung.Abgleichsteuerung({ db, fetch: () => { throw new Error('kein Netz im Test'); }, jetzt: () => JETZT });
  const wege = [];
  return { db, steuerung, schreiben, jetzt: () => JETZT, gehe: (a) => wege.push(['gehe', a]), ersetze: (a) => wege.push(['ersetze', a]), neuZeichnen() {}, wege };
}
const schliessen = () => { schliessen.n++; };
schliessen.n = 0;
const knopfMit = (liste, text) => finde(liste, 'button').find((b) => t(b).trim() === text);

const waehleWahl = (r) => r.klick();
const taste = (r, key) => { let verhindert = false; for (const f of r.horcher.keydown ?? []) f({ key, preventDefault() { verhindert = true; } }); return verhindert; };
const zustand = (r) => finde(r, '[role="radio"]').map((x) => [x.getAttribute('data-wahl'), x.getAttribute('aria-checked'), x.getAttribute('tabindex')]);

test('Antwortblatt: die Möglichkeiten sind eine Radiogruppe, ungewählt, mit Beschriftung aus Buchstabe und Text', async () => {
  const k = await kontext(attrappe());
  const r = await M.eintrag.antwortBlatt(welt(), k, { id: 'r2d4vn' }, schliessen);
  const gruppe = finde(r.koerper, '.antworten')[0];
  assert.equal(gruppe.getAttribute('role'), 'radiogroup');
  assert.equal(gruppe.getAttribute('aria-label'), 'Möglichkeiten');
  const zeilen = finde(r.koerper, '.wahl');
  assert.equal(zeilen.length, 2);
  assert.ok(zeilen.every((z) => z.getAttribute('role') === 'radio' && !z.hasAttribute('aria-disabled')), 'jede Zeile ist selbst das Radio');
  assert.deepEqual(zustand(r.koerper), [['A', 'false', '0'], ['B', 'false', '-1']], 'nichts gewählt; Tab erreicht die erste Zeile');
  assert.equal(finde(r.koerper, 'input[type="radio"]').length, 0, 'kein verstecktes Eingabefeld');
  assert.ok(zeilen.every((z) => finde(z, '.buchstabe').length === 1 && finde(z, '.an').length === 1), 'Zeile = Buchstabe, Text, Haken');
  assert.match(t(zeilen[0]), /^A\s*Standardbibliothek/, 'der Name der Zeile kommt aus Buchstabe und Text');
});

test('Antwortblatt: der Zustand steht in aria-checked, nur die gewählte Zeile ist gewählt und per Tab erreichbar; Pfeile und Leertaste wählen', async () => {
  const k = await kontext(attrappe());
  const r = await M.eintrag.antwortBlatt(welt(), k, { id: 'r2d4vn' }, schliessen);
  const [a, b] = finde(r.koerper, '.wahl');
  await waehleWahl(b);
  assert.deepEqual(zustand(r.koerper), [['A', 'false', '-1'], ['B', 'true', '0']]);
  assert.ok(taste(b, 'ArrowDown'), 'Pfeil wählt die nächste Zeile (zurück an den Anfang)');
  assert.deepEqual(zustand(r.koerper), [['A', 'true', '0'], ['B', 'false', '-1']]);
  taste(a, 'ArrowUp');
  assert.deepEqual(zustand(r.koerper), [['A', 'false', '-1'], ['B', 'true', '0']]);
  taste(a, ' ');
  assert.deepEqual(zustand(r.koerper), [['A', 'true', '0'], ['B', 'false', '-1']]);
  assert.equal(taste(a, 'x'), false, 'andere Tasten bleiben unberührt');
});

test('Antwortblatt: Wählen sendet nichts; Senden schickt die gewählte Möglichkeit mit dem Text und legt beides in den Entwurf', async () => {
  const s = attrappe();
  const k = await kontext(s);
  schliessen.n = 0;
  const r = await M.eintrag.antwortBlatt(welt(), k, { id: 'r2d4vn' }, schliessen);
  await waehleWahl(finde(r.koerper, '[data-wahl="B"]')[0]);
  assert.equal(s.aufrufe.length, 0, 'ein Tipp wählt nur');
  assert.deepEqual(await M.entwuerfe.liesEntwurf(k.db, 'antwort/r2d4vn').then((d) => d && { text: d.text, wahl: d.wahl }), { text: '', wahl: 'B' });
  const feld = finde(r.koerper, 'textarea')[0];
  feld.value = 'Wegen der Größe.';
  await knopfMit(r.knoepfe, 'Senden').klick();
  assert.deepEqual(s.aufrufe.map((a) => [a[0], a[1], a[2].wahl, a[2].text]), [['antworten', 'r2d4vn', 'B', 'Wegen der Größe.']]);
  assert.deepEqual(s.aufrufe[0][2].entwurf, { schluessel: 'antwort/r2d4vn', wert: { text: 'Wegen der Größe.', wahl: 'B' } });
  assert.equal(schliessen.n, 1);
});

test('Antwortblatt: eine gewählte Möglichkeit allein genügt, ohne Wahl und ohne Text geschieht nichts', async () => {
  const s = attrappe();
  const k = await kontext(s);
  const r = await M.eintrag.antwortBlatt(welt(), k, { id: 'r2d4vn' }, schliessen);
  const fehlt = finde(r.koerper, 'p.satz')[0];
  assert.ok(knopfMit(r.knoepfe, 'Senden').disabled, 'Senden bleibt gesperrt');
  assert.equal(fehlt.hidden, false);
  assert.ok(!fehlt.className.includes('still'));
  assert.match(t(fehlt), /Wähle eine Möglichkeit oder schreibe eine eigene Antwort\./);
  await knopfMit(r.knoepfe, 'Senden').klick();
  assert.equal(s.aufrufe.length, 0);
  await waehleWahl(finde(r.koerper, '[data-wahl="A"]')[0]);
  assert.equal(knopfMit(r.knoepfe, 'Senden').disabled, false);
  assert.equal(fehlt.hidden, false, 'der Satz behält seinen Platz, damit das Blatt nicht rutscht');
  assert.ok(fehlt.className.split(' ').includes('still'), 'er ist nur unsichtbar');
  await knopfMit(r.knoepfe, 'Senden').klick();
  assert.deepEqual(s.aufrufe.map((a) => [a[2].wahl, a[2].text]), [['A', '']]);
});

test('Antwortblatt: die Wahl im Entwurf ist beim Öffnen wieder gewählt', async () => {
  const k = await kontext(attrappe());
  await M.entwuerfe.speichereEntwurf(k.db, 'antwort/r2d4vn', { text: '', wahl: 'B' }, false, JETZT);
  const r = await M.eintrag.antwortBlatt(welt(), k, { id: 'r2d4vn' }, schliessen);
  assert.deepEqual(zustand(r.koerper), [['A', 'false', '-1'], ['B', 'true', '0']]);
});

test('Antwortblatt ohne Schreibschicht: die Möglichkeiten sind gesperrt', async () => {
  const k = await kontext(undefined);
  const r = await M.eintrag.antwortBlatt(welt(), k, { id: 'r2d4vn' }, schliessen);
  assert.ok(finde(r.koerper, '[role="radio"]').every((x) => x.getAttribute('aria-disabled') === 'true' && x.getAttribute('tabindex') === '-1'));
  await finde(r.koerper, '.wahl')[0].klick();
  assert.deepEqual(zustand(r.koerper).map((x) => x[1]), ['false', 'false'], 'eine gesperrte Zeile wählt nichts');
});

test('Antwortblatt: freier Text geht mit seinem Entwurf mit, damit Rückgängig ihn zurücklegt; ohne Text geschieht nichts', async () => {
  const s = attrappe();
  const k = await kontext(s);
  schliessen.n = 0;
  const r = await M.eintrag.antwortBlatt(welt(), k, { id: 'r2d4vn' }, schliessen);
  const senden = knopfMit(r.knoepfe, 'Senden');
  await senden.klick();
  assert.equal(s.aufrufe.length, 0, 'ein leeres Feld sendet nichts');
  const feld = finde(r.koerper, 'textarea')[0];
  feld.value = ' Lieber die Standardbibliothek. ';
  await senden.klick();
  assert.equal(s.aufrufe.length, 1);
  const [, id, opt] = s.aufrufe[0];
  assert.equal(id, 'r2d4vn');
  assert.equal(opt.text, 'Lieber die Standardbibliothek.');
  assert.deepEqual(opt.entwurf, { schluessel: 'antwort/r2d4vn', wert: { text: ' Lieber die Standardbibliothek. ' } });
  assert.equal(schliessen.n, 1);
});

test('Abgelehnte Eingabe: Geheimnis zeigt ein Band ohne den Wert, das Blatt bleibt offen, es gibt kein Trotzdem', async () => {
  const pruefung = { geheimnisse: [{ wo: 'in deinem Satz', zeile: 1, art: 'GitHub-Token' }], personen: [] };
  const s = attrappe({ ok: false, pruefung });
  const k = await kontext(s);
  schliessen.n = 0;
  const r = await M.eintrag.einsortierenBlatt(welt(), k, { id: 'k7m2qa' }, schliessen);
  const ziel = finde(r.koerper, 'select')[0];
  ziel.value = 'alpha'; for (const f of ziel.horcher.change) f();
  await knopfMit(r.knoepfe, 'Senden').klick();
  const text = t(r.koerper);
  assert.match(text, /Geheimnis gefunden/);
  assert.match(text, /in deinem Satz, Zeile 1 \(GitHub-Token\)/);
  assert.match(text, /Sie sendet es nicht/);
  assert.equal(finde(r.koerper, 'button').filter((b) => t(b) === 'Trotzdem senden').length, 0);
  assert.equal(schliessen.n, 0, 'das Blatt bleibt offen');
});

test('Abgelehnte Eingabe: Personendaten lassen sich mit Trotzdem senden freigeben', async () => {
  const pruefung = { geheimnisse: [], personen: [{ wo: 'im Text', zeile: 2, art: 'E-Mail' }] };
  const s = attrappe((name, id, opt) => (opt.personenErlaubt ? { ok: true, id: 's1' } : { ok: false, pruefung }));
  const k = await kontext(s);
  schliessen.n = 0;
  const r = await M.eintrag.antwortBlatt(welt(), k, { id: 'm7q2ke' }, schliessen);
  finde(r.koerper, 'textarea')[0].value = 'Schreib an jemand@beispiel.test';
  await knopfMit(r.knoepfe, 'Senden').klick();
  assert.match(t(r.koerper), /Persönliche Angaben gefunden/);
  assert.equal(schliessen.n, 0);
  await knopfMit(r.koerper, 'Trotzdem senden').klick();
  assert.equal(s.aufrufe.length, 2);
  assert.equal(s.aufrufe[1][2].personenErlaubt, true);
  assert.equal(schliessen.n, 1);
});

test('Einsortieren: Senden wartet auf ein Ziel, dann geht Ziel und Satz mit dem Entwurf an die Schreibschicht', async () => {
  const s = attrappe();
  const k = await kontext(s);
  schliessen.n = 0;
  const r = await M.eintrag.einsortierenBlatt(welt(), k, { id: 'k7m2qa' }, schliessen);
  const senden = knopfMit(r.knoepfe, 'Senden');
  assert.equal(senden.disabled, true, 'ohne Ziel gesperrt');
  const ziel = finde(r.koerper, 'select')[0];
  ziel.value = 'beta'; for (const f of ziel.horcher.change) f();
  assert.equal(senden.disabled, false);
  finde(r.koerper, 'textarea')[0].value = '  Gehört zur Bibliothek. ';
  await senden.klick();
  const [, id, opt] = s.aufrufe[0];
  assert.equal(id, 'k7m2qa');
  assert.equal(opt.ziel, 'beta');
  assert.equal(opt.satz, 'Gehört zur Bibliothek.');
  assert.equal(opt.entwurf.schluessel, 'einsortieren/k7m2qa');
  assert.equal(schliessen.n, 1);
});

test('Einsortieren: An dich ist ein Ziel wie ein Projekt', async () => {
  const k = await kontext(attrappe());
  const r = await M.eintrag.einsortierenBlatt(welt(), k, { id: 'k7m2qa' }, schliessen);
  const werte = finde(r.koerper, 'option').map((o) => o.getAttribute('value'));
  assert.deepEqual(werte, ['', 'user', 'alpha', 'beta', 'gamma']);
});

test('Erledigt sendet über die Schreibschicht und geht danach zu Wartet; eine Ablehnung zeigt das Band im Eintrag', async () => {
  const s = attrappe();
  const k = await kontext(s);
  const w = welt();
  const r = M.eintrag.eintragAnsicht(w, z(), k, { id: 'm7q2ke' });
  const erledigt = finde(r.aktion, '[data-handlung="erledigt"]')[0];
  assert.equal(erledigt.disabled, false);
  await erledigt.klick();
  assert.deepEqual(s.aufrufe, [['erledigen', 'm7q2ke']]);
  assert.deepEqual(k.wege, [['ersetze', '#wartet']]);
  const nein = attrappe({ ok: false, fehler: 'Ein Eintrag mit der ID m7q-2ke liegt nicht auf diesem Gerät' });
  const k2 = await kontext(nein);
  const r2 = M.eintrag.eintragAnsicht(w, z(), k2, { id: 'm7q2ke' });
  await finde(r2.aktion, '[data-handlung="erledigt"]')[0].klick();
  assert.deepEqual(k2.wege, []);
  assert.match(t(r2.inhalt), /Nicht gespeichert/);
});

test('Erfassen: Titel ist Pflicht, eine Nachricht braucht Text; sonst geht alles mit dem Entwurf an die Schreibschicht', async () => {
  const s = attrappe();
  const k = await kontext(s);
  const e = await M.erfassen.erfassenAnsicht(welt(), z(), k);
  const anlegen = finde(e.aktion, '[data-handlung="anlegen"]')[0];
  await anlegen.klick();
  assert.equal(s.aufrufe.length, 0, 'ohne Titel nichts');
  assert.match(t(e.inhalt), /Gib einen Titel ein\./);
  const titel = finde(e.inhalt, 'input[name="titel"]')[0];
  titel.value = '  Datei prüfen ';
  for (const f of titel.horcher.input) f();
  await anlegen.klick();
  assert.equal(s.aufrufe.length, 1);
  const [name, opt] = s.aufrufe[0];
  assert.equal(name, 'anlegen');
  assert.deepEqual({ art: opt.art, titel: opt.titel, an: opt.an, text: opt.text, rang: opt.rang, dringend: opt.dringend },
    { art: 'task', titel: 'Datei prüfen', an: null, text: '', rang: 2, dringend: false });
  assert.equal(opt.entwurf.schluessel, 'erfassen');
  assert.deepEqual(M.erfassen.pruefeEintrag({ art: 'message', titel: 'x', text: ' ' }), { fehler: { text: 'Eine Nachricht braucht einen Text.' } });
  assert.deepEqual(M.erfassen.pruefeEintrag({ art: 'note', titel: 'x', text: '' }), { ok: true });
});

test('Erfassen: Entwurf verwerfen steht rechts von Anlegen, nur mit Inhalt, und ruft die Schreibschicht', async () => {
  const s = attrappe();
  s.verwirfEntwurf = async (key) => { s.aufrufe.push(['verwirfEntwurf', key]); return { ok: true }; };
  const k = await kontext(s);
  const e = await M.erfassen.erfassenAnsicht(welt(), z(), k);
  const verwerfen = finde(e.aktion, '[data-handlung="entwurf-verwerfen"]')[0];
  assert.equal(t(verwerfen).trim(), 'Entwurf verwerfen');
  assert.equal(verwerfen.hidden, true, 'ein leerer Entwurf hat nichts zu verwerfen');
  assert.deepEqual(e.aktion.slice(0, 2).map((b) => b.dataset.handlung), ['anlegen', 'entwurf-verwerfen']);
  const titel = finde(e.inhalt, 'input[name="titel"]')[0];
  titel.value = 'Datei prüfen'; for (const f of titel.horcher.input) f();
  assert.equal(verwerfen.hidden, false, 'mit Titel erscheint der Knopf');
  titel.value = ''; for (const f of titel.horcher.input) f();
  assert.equal(verwerfen.hidden, true, 'ein geleerter Titel nimmt ihn wieder weg');
  const chips = finde(e.inhalt, 'div.chips')[0];
  for (const f of chips.horcher.change) f({ target: { value: 'note' } });
  assert.equal(verwerfen.hidden, false, 'auch eine andere Art ist ein Entwurf');
  await verwerfen.klick();
  assert.deepEqual(s.aufrufe, [['verwirfEntwurf', 'erfassen']]);
  // Mit gemerktem Entwurf steht der Knopf von Anfang an da
  await k.db.schreibe('entwuerfe', { schluessel: 'erfassen', titel: 'Alt', art: 'task', an: '', text: '', rang: '2', dringend: false, zeit: JETZT });
  const e2 = await M.erfassen.erfassenAnsicht(welt(), z(), k);
  assert.equal(finde(e2.aktion, '[data-handlung="entwurf-verwerfen"]')[0].hidden, false);
});

test('Erfassen: bei einer Idee ist An dich vorbelegt, bei einer anderen Art wieder der Eingang (N3)', async () => {
  const k = await kontext(attrappe());
  const e = await M.erfassen.erfassenAnsicht(welt(), z(), k);
  const an = finde(e.inhalt, 'select[name="an"]')[0];
  assert.deepEqual(finde(an, 'option').map((o) => o.getAttribute('value')).slice(0, 2), ['', 'user']);
  const chips = finde(e.inhalt, 'div.chips')[0];
  const wechsle = (art) => { for (const f of chips.horcher.change) f({ target: { value: art } }); };
  wechsle('idea');
  assert.equal(an.value, 'user');
  wechsle('note');
  assert.equal(an.value, '');
  wechsle('idea');
  an.value = 'alpha'; for (const f of an.horcher.change) f();
  wechsle('task');
  assert.equal(an.value, 'alpha', 'ein gewähltes Projekt bleibt');
});

test('Ergebnis einer Abnahme: Antwort senden reicht Text und Entwurf ein und geht zu Wartet', async () => {
  const s = attrappe();
  const k = await kontext(s);
  await k.db.schreibe('entwuerfe', entwuerfe()[0]);
  const w = M.welt.baueWelt({ pfade: dateien(), jetzt: JETZT, entwuerfe: await k.db.alle('entwuerfe') });
  const r = await M.ablauf.ergebnisAnsicht(w, z(), k, { id: '8k3m1x' });
  const senden = finde(r.aktion, '[data-handlung="abnahme"]')[0];
  assert.equal(senden.disabled, false);
  await senden.klick();
  const [name, id, opt] = s.aufrufe[0];
  assert.equal(name, 'urteilSenden');
  assert.equal(id, '8k3m1x');
  assert.match(opt.text, /FAIL/);
  assert.equal(opt.entwurf.schluessel, 'urteil/8k3m1x');
  assert.equal(Object.keys(opt.entwurf.wert.schritte).length, 9);
  assert.deepEqual(k.wege, [['ersetze', '#wartet']]);
});

test('Sendungen, die nicht durchgingen, haben ein Band mit der Wahl des Nutzers: Recht fehlt, Fehler, Konflikt', async () => {
  const s = attrappe();
  const k = await kontext(s);
  const z0 = schlangeZustaende();
  const mit = (sendung, id) => M.eintrag.eintragAnsicht(welt({ schlange: [sendung] }), z(), k, { id });
  const verboten = mit(z0.verboten, 'p4m7bt');
  assert.match(t(verboten.inhalt), /Token darf nicht schreiben/);
  assert.equal(finde(verboten.inhalt, 'a').filter((a) => a.getAttribute('href') === '#anmelden').length, 1);
  const fehler = mit(z0.fehler, 'm7q2ke');
  assert.match(t(fehler.inhalt), /Nicht gesendet[\s\S]*GitHub lehnt die Sendung ab \(Validation Failed\)/);
  await knopfMit(fehler.inhalt, 'Erneut senden').klick();
  await knopfMit(fehler.inhalt, 'Verwerfen').klick();
  assert.deepEqual(s.aufrufe, [['erneut', 's10'], ['verwerfen', 's10']]);
  const konflikt = mit({ id: 's5', eintrag: 'm7q2ke', art: 'antwort', zustand: 'konflikt', zeit: JETZT, titel: 'Schon beantwortet', grund: 'Jemand war schneller.' }, 'm7q2ke');
  await knopfMit(konflikt.inhalt, 'Als Nachtrag senden').klick();
  assert.deepEqual(s.aufrufe.at(-1), ['senden', 's5']);
});

// ---- Hinweis

function attrappeSeite() {
  const knoten = { hinweis: new Knoten('div'), text: new Knoten('span'), knopf: new Knoten('button') };
  knoten.hinweis.hidden = true; knoten.knopf.hidden = true;
  return { knoten, wurzel: { getElementById: (id) => ({ hinweis: knoten.hinweis, 'hinweis-text': knoten.text, 'hinweis-knopf': knoten.knopf })[id] } };
}
function zeitgeber() {
  const liste = [];
  return { liste, setze: (f, ms) => { liste.push({ f, ms, an: true }); return liste.length - 1; }, loesche: (n) => { if (liste[n]) liste[n].an = false; } };
}

test('Hinweis: zeigt den Satz zehn Sekunden mit Rückgängig, nimmt zurück und räumt danach auf', async () => {
  const { knoten, wurzel } = attrappeSeite();
  const zg = zeitgeber();
  const h = M.hinweis.baueHinweis({ zeitgeber: zg, wurzel });
  let zurueck = 0;
  h.zeige({ text: 'Antwort „A“ gespeichert', rueckgaengig: async () => { zurueck++; return true; } });
  assert.equal(knoten.hinweis.hidden, false);
  assert.equal(knoten.text.textContent, 'Antwort „A“ gespeichert');
  assert.equal(knoten.knopf.hidden, false);
  assert.equal(zg.liste[0].ms, 10_000);
  await knoten.knopf.onclick();
  assert.equal(zurueck, 1);
  assert.match(knoten.text.textContent, /Zurückgenommen/);
  assert.equal(knoten.knopf.hidden, true, 'danach gibt es nichts mehr zurückzunehmen');
  zg.liste.at(-1).f();
  assert.equal(knoten.hinweis.hidden, true);
});

test('Hinweis: läuft die Frist ab, verschwindet er; ein neuer Hinweis ersetzt den alten', async () => {
  const { knoten, wurzel } = attrappeSeite();
  const zg = zeitgeber();
  const h = M.hinweis.baueHinweis({ zeitgeber: zg, wurzel });
  h.zeige({ text: 'Eins', rueckgaengig: async () => true });
  h.zeige({ text: 'Zwei', rueckgaengig: async () => true });
  assert.equal(knoten.text.textContent, 'Zwei');
  assert.equal(zg.liste[0].an, false, 'der alte Zeitgeber ist gelöscht');
  zg.liste[1].f();
  assert.equal(knoten.hinweis.hidden, true);
});

test('Hinweis: eine Meldung steht ohne Knopf, weicht aber einem offenen Rückgängig nicht', async () => {
  const { knoten, wurzel } = attrappeSeite();
  const zg = zeitgeber();
  const h = M.hinweis.baueHinweis({ zeitgeber: zg, wurzel });
  assert.equal(h.meldung('Antwort wartet auf Netz.'), true);
  assert.equal(knoten.text.textContent, 'Antwort wartet auf Netz.');
  assert.equal(knoten.knopf.hidden, true);
  h.zeige({ text: 'Eintrag gespeichert', rueckgaengig: async () => true });
  assert.equal(h.meldung('Etwas anderes'), true, 'der Satz ist zugesagt');
  assert.equal(knoten.text.textContent, 'Eintrag gespeichert', 'der Hinweis mit Rückgängig bleibt stehen');
});

test('Hinweis: eine Meldung während Rückgängig erscheint, sobald die Frist endet, ohne zweiten Anlauf', async () => {
  const { knoten, wurzel } = attrappeSeite();
  const zg = zeitgeber();
  const h = M.hinweis.baueHinweis({ zeitgeber: zg, wurzel });
  h.zeige({ text: 'Antwort „A“ gespeichert', rueckgaengig: async () => true });
  assert.equal(h.meldung('Antwort wartet auf Netz und geht raus, sobald du online bist.'), true);
  zg.liste[0].f();   // die Frist endet
  assert.equal(knoten.hinweis.hidden, false);
  assert.equal(knoten.text.textContent, 'Antwort wartet auf Netz und geht raus, sobald du online bist.');
  assert.equal(knoten.knopf.hidden, true, 'ein Satz ohne Rückgängig');
});

test('Hinweis: Rückgängig verwirft die wartende Meldung', async () => {
  const { knoten, wurzel } = attrappeSeite();
  const zg = zeitgeber();
  const h = M.hinweis.baueHinweis({ zeitgeber: zg, wurzel });
  h.zeige({ text: 'Antwort gespeichert', rueckgaengig: async () => true });
  h.meldung('Antwort wartet auf Netz.');
  await knoten.knopf.onclick();
  zg.liste.at(-1).f();
  assert.equal(knoten.hinweis.hidden, true, 'nach Rückgängig gibt es nichts mehr zu sagen');
});

test('Hinweis: ein Satz mit eigener Antwort auf Rückgängig, die nicht gelingt', async () => {
  const { knoten, wurzel } = attrappeSeite();
  const h = M.hinweis.baueHinweis({ zeitgeber: zeitgeber(), wurzel });
  h.zeige({ text: 'Entwurf verworfen', rueckgaengig: async () => false, nicht: 'Der Entwurf ist schon ersetzt.' });
  await knoten.knopf.onclick();
  assert.equal(knoten.text.textContent, 'Der Entwurf ist schon ersetzt.');
});

test('Hinweis: ist die Sendung schon unterwegs, sagt er es, statt Erfolg vorzutäuschen', async () => {
  const { knoten, wurzel } = attrappeSeite();
  const h = M.hinweis.baueHinweis({ zeitgeber: zeitgeber(), wurzel });
  h.zeige({ text: 'Eintrag gespeichert', rueckgaengig: async () => false });
  await knoten.knopf.onclick();
  assert.match(knoten.text.textContent, /schon unterwegs/);
});

test('Prüfung der Ablehnung: Sätze nennen Ort und Art, nie den Wert, und zählen mehrere Funde', () => {
  const g = M.absenden.pruefungSatz({ geheimnisse: [{ wo: 'im Text', zeile: 1, art: 'GitHub-Token' }, { wo: 'im Titel', zeile: 1, art: 'API-Schlüssel' }], personen: [] });
  assert.equal(g.titel, 'Geheimnis gefunden');
  assert.match(g.satz, /zwei Geheimnisse: im Text, Zeile 1 \(GitHub-Token\); im Titel, Zeile 1 \(API-Schlüssel\)\./);
  const p = M.absenden.pruefungSatz({ geheimnisse: [], personen: [{ wo: 'im Text', zeile: 3, art: 'IBAN' }] });
  assert.equal(p.titel, 'Persönliche Angaben gefunden');
  assert.doesNotMatch(`${g.satz}${p.satz}`, /!/);
});

const waehleInput = (wurzel, name, wert) => {
  const alle = finde(wurzel, `input[name="${name}"]`);
  for (const i of alle) i.checked = i.getAttribute('value') === wert;
  const i = alle.find((x) => x.getAttribute('value') === wert);
  let c = i.eltern;
  while (c && !c.horcher.change) c = c.eltern;
  for (const f of c.horcher.change) f({ target: i });
};

test('Bearbeiten: Speichern bleibt gesperrt, bis sich Priorität oder Adresse ändert; dann geht je eine Sendung mit nur dem Geänderten raus', async () => {
  const s = attrappe();
  const k = await kontext(s);
  schliessen.n = 0;
  const r = await M.bearbeiten.bearbeitenBlatt(welt(), k, { id: 'm7q2ke' }, schliessen);
  const speichern = knopfMit(r.knoepfe, 'Speichern');
  assert.equal(speichern.disabled, true, 'ohne Änderung nichts zu speichern');
  assert.deepEqual(finde(r.koerper, 'legend').map(t), ['Priorität', 'Du', 'Projekte', 'Rechner']);
  assert.equal(finde(r.koerper, 'input[name="rang"]').filter((i) => i.checked).length, 1, 'die aktuelle Priorität ist gewählt');
  waehleInput(r.koerper, 'rang', '1');
  assert.equal(speichern.disabled, false);
  await speichern.klick();
  assert.deepEqual(s.aufrufe.map((a) => [a[0], a[1], a[2].rang, a[2].dringend]), [['rangAendern', 'm7q2ke', 1, false]], 'keine Adressänderung ohne Wahl');
  assert.equal(schliessen.n, 1);
});

test('Bearbeiten: eine andere Adresse und der Satz gehen an neuAdressieren; eine abgelehnte Eingabe zeigt ein Band und schließt nichts', async () => {
  const s = attrappe((name) => (name === 'neuAdressieren' ? { ok: false, fehler: 'Das Werkzeug nähme die Eingabe nicht an.' } : { ok: true, id: 's1' }));
  const k = await kontext(s);
  schliessen.n = 0;
  const r = await M.bearbeiten.bearbeitenBlatt(welt(), k, { id: 'm7q2ke' }, schliessen);
  waehleInput(r.koerper, 'an', 'host:rechner-a');
  finde(r.koerper, 'textarea[name="satz"]')[0].value = 'Gehört auf diesen Rechner.';
  await knopfMit(r.knoepfe, 'Speichern').klick();
  assert.deepEqual(s.aufrufe.map((a) => [a[0], a[2].an, a[2].satz]), [['neuAdressieren', ['host:rechner-a'], 'Gehört auf diesen Rechner.']]);
  assert.equal(schliessen.n, 0, 'abgelehnt: das Blatt bleibt');
  assert.match(t(r.koerper), /Nicht gespeichert/);
});

test('Bearbeiten: Nachtrag, Erledigen mit Ergebnis und Verwerfen mit Grund; Verwerfen und Nachtrag brauchen Text', async () => {
  const s = attrappe();
  const k = await kontext(s);
  const r = await M.bearbeiten.bearbeitenBlatt(welt(), k, { id: 'm7q2ke' }, schliessen);
  const abschnitt = (titel) => finde(r.koerper, 'details').find((d) => t(finde(d, 'summary')[0]) === titel);
  const nachtrag = abschnitt('Nachtrag'); const erledigen = abschnitt('Erledigen'); const verwerfen = abschnitt('Verwerfen');
  assert.equal(knopfMit(nachtrag, 'Nachtrag senden').disabled, true);
  assert.equal(knopfMit(verwerfen, 'Verwerfen senden').disabled, true);
  assert.equal(knopfMit(erledigen, 'Erledigt senden').disabled, false, 'das Ergebnis ist freiwillig');
  const tippe = (a, text) => { const f = finde(a, 'textarea')[0]; f.value = text; for (const h of f.horcher.input ?? []) h({}); };
  tippe(nachtrag, 'Noch ein Gedanke.'); await knopfMit(nachtrag, 'Nachtrag senden').klick();
  tippe(erledigen, 'Behoben in der Fassung.'); await knopfMit(erledigen, 'Erledigt senden').klick();
  tippe(verwerfen, 'Dublette'); await knopfMit(verwerfen, 'Verwerfen senden').klick();
  assert.deepEqual(s.aufrufe.map((a) => [a[0], a[2].text ?? a[2].ergebnis ?? a[2].grund]),
    [['nachtragen', 'Noch ein Gedanke.'], ['erledigen', 'Behoben in der Fassung.'], ['eintragVerwerfen', 'Dublette']]);
  assert.deepEqual(k.wege.filter(([, a]) => a === '#wartet').length, 2, 'nach Erledigen und Verwerfen geht es nach Wartet');
});

test('Bearbeiten: ohne Schreibschicht sind alle Knöpfe gesperrt und ein Satz sagt warum; ein abgeschlossener Eintrag lässt sich nicht ändern', async () => {
  const k = await kontext(null);
  const r = await M.bearbeiten.bearbeitenBlatt(welt(), k, { id: 'm7q2ke' }, schliessen);
  assert.match(t(r.koerper), /Senden ist hier nicht eingerichtet/);
  assert.ok(finde(r, 'button').every((b) => b.disabled || t(b) === 'Abbrechen'));
  const zu = await M.bearbeiten.bearbeitenBlatt(welt(), await kontext(attrappe()), { id: 'd5n8vk' }, schliessen);
  assert.match(t(zu.koerper), /schon abgeschlossen/);
  assert.equal(finde(zu.koerper, 'input').length, 0);
});

test('Bearbeiten: die Adressen kommen aus Projekten und Rechnern der Welt und enthalten die aktuelle Adresse', async () => {
  const g = M.bearbeiten.adressGruppen(welt(), ['host:rechner-z', 'project:alpha']);
  assert.deepEqual(g.map((x) => x.titel), ['Du', 'Projekte', 'Rechner']);
  assert.ok(g[1].optionen.some((o) => o.wert === 'project:alpha'));
  assert.ok(g[2].optionen.some((o) => o.wert === 'host:rechner-z'), 'eine fremde aktuelle Adresse bleibt wählbar');
  assert.ok(g[2].optionen.some((o) => o.wert === 'host:rechner-a'));
});
