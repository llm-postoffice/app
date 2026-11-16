#!/usr/bin/env node
// Erzeugt die Entwurfsseiten der Gesamtübersicht (a.html, b.html, b-blatt.html, c.html, c-filter.html) aus erfundenen Daten.
// Wegwerf-Entwurf: nicht in die App eingebunden. Die Seiten nutzen app.css, das Symbol-Sprite und die Klassen der App.
// Aufruf: node bauen.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const hier = new URL('./', import.meta.url);
const index = readFileSync(new URL('../../../../../index.html', hier), 'utf8');
const sprite = /<svg class="sprite"[\s\S]*?<\/svg>/.exec(index)[0];
// Symbole, die das App-Sprite noch nicht hat (Material-Satz, 24er Raster; im Bau aus Material Symbols Rounded holen)
const NEU = {
  'filter_list': 'M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z',
  'expand_more': 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
  'close': 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  'swap_vert': 'M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3 5 6.99h3V14h2V6.99h3L9 3z',
  'list-f': 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z',
  'list': 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z',
};
const spriteNeu = sprite.replace('</svg>', Object.entries(NEU).map(([n, d]) => `<symbol id="i-${n}" viewBox="0 0 24 24"><path d="${d}"/></symbol>`).join('') + '</svg>');

const ico = (n) => `<svg class="ico" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const ART = {
  frage: { k: 'k-frage', wort: 'Frage', s: 'help-f' }, freigabe: { k: 'k-freigabe', wort: 'Freigabe', s: 'verified_user-f' },
  abnahme: { k: 'k-abnahme', wort: 'Abnahme', s: 'checklist-f' }, auftrag: { k: 'k-auftrag', wort: 'Auftrag', s: 'assignment-f' },
  plan: { k: 'k-auftrag', wort: 'Plan', s: 'assignment-f' }, nachricht: { k: 'k-nachricht', wort: 'Nachricht', s: 'mail-f' },
  idee: { k: 'k-nachricht', wort: 'Idee', s: 'lightbulb-f' },
};
// st: dich (wartet auf dich), arbeit (in Arbeit), andere (wartet auf anderes), offen (noch nicht aufgenommen)
const E = [
  { id: 'q7w-2de', art: 'freigabe', p: 'alpha', t: 'Freigabe: Release 20261113.01 von alpha', st: 'dich', z: 'wartet auf dein Ja seit 10:07', alter: '4 Std.', rang: 1, dring: true, von: 'session:cb56d77f auf rechner-a' },
  { id: 'c5d-4qa', art: 'frage', p: 'beta', t: 'Warteschlange beim Abmelden behalten?', st: 'dich', z: 'wartet auf deine Antwort seit 09:12', alter: '5 Std.', rang: 2, von: 'session:27b922d7 auf rechner-a' },
  { id: 'h2n-9vz', art: 'abnahme', p: 'gamma', an: 'rechner-b', t: 'Bildproben am Fernseher', st: 'dich', z: 'wartet auf dein Urteil seit 2026-11-11 21:40, 6 Schritte offen', alter: '2 Tage', rang: 2, von: 'session:27b922d7 auf rechner-b' },
  { id: 'p4m-7bt', art: 'abnahme', p: 'beta', an: 'rechner-a', t: 'Proben der Ansichten auf dem Handy', st: 'dich', z: 'wartet auf dein Urteil seit 2026-11-12 18:13, 8 von 12 Schritten offen', alter: '1 Tag', rang: 2, von: 'session:cb56d77f auf rechner-a' },
  { id: '8k3-m1x', art: 'abnahme', p: 'alpha', an: 'rechner-a', t: 'Abnahme Phase 1: alpha', st: 'dich', z: 'wartet auf dein Urteil seit 2026-11-12 22:30, 9 Schritte offen', alter: '1 Tag', rang: 2, von: 'session:cb56d77f auf rechner-a' },
  { id: 'w5q-4lh', art: 'frage', p: 'gamma', t: 'Soll der Fernseher den Ton über rechner-b ausgeben?', st: 'dich', z: 'wartet auf deine Antwort seit 2026-11-12 18:02', alter: '1 Tag', rang: 3, von: 'session:27b922d7 auf rechner-b' },
  { id: 'z4t-6md', art: 'idee', p: null, t: 'Reihenfolge der Mitteilungen nach Dringlichkeit', st: 'dich', z: 'offen, in deiner Ideensammlung seit 2026-11-09', alter: '7 Tage', rang: 3, von: 'user, handy' },
  { id: 'a1s-9rf', art: 'auftrag', p: 'gamma', an: 'rechner-b', t: 'Zertifikat für die Fernseher-Ansicht erneuern', st: 'arbeit', z: 'in Arbeit bei session:27b922d7 bis 16:45', alter: '3 Std.', rang: 1, dring: true, von: 'user, handy' },
  { id: 't6r-3ks', art: 'auftrag', p: 'alpha', an: 'rechner-a', t: 'Wegetest um den Update-Weg erweitern', st: 'arbeit', z: 'in Arbeit bei session:cb56d77f bis 15:30', alter: '2 Std.', rang: 1, von: 'user, rechner-a' },
  { id: 'n7e-2ux', art: 'auftrag', p: 'beta', t: 'Release 20261120.01 vorbereiten', st: 'andere', z: 'wartet bis 2026-11-18', alter: '3 Tage', rang: 2, von: 'session:27b922d7 auf rechner-a' },
  { id: 'v2b-8nj', art: 'auftrag', p: 'beta', t: 'README auf eine Seite kürzen', st: 'andere', z: 'wartet auf p4m-7bt', alter: '1 Tag', rang: 3, von: 'user, rechner-a' },
  { id: 'm9x-5he', art: 'auftrag', p: 'gamma', t: 'Hilfe auf Form b umstellen', st: 'offen', z: 'offen, für gamma', alter: '6 Std.', rang: 2, von: 'user, rechner-a' },
  { id: 'f3k-7yp', art: 'plan', p: 'alpha', t: 'Plan: Übersicht aller offenen Einträge am Handy', st: 'offen', z: 'offen, für alpha', alter: '2 Std.', rang: 2, von: 'session:cb56d77f auf rechner-a' },
  { id: 'j8w-1cz', art: 'nachricht', p: 'gamma', t: 'Pagespeicher ist wieder erreichbar', st: 'offen', z: 'offen, für gamma', alter: '1 Tag', rang: 3, von: 'session:27b922d7 auf rechner-b' },
];
const PRIO = { 1: 'Hoch', 2: 'Normal', 3: 'Niedrig' };
const prio = (e) => `<span class="prio${e.rang === 1 ? ' hoch' : ''}">${e.dring ? 'Dringend' : PRIO[e.rang]}</span>`;
const zst = (e) => `<span class="zst${e.st === 'dich' ? ' stark' : ''}">${ico(e.st === 'arbeit' ? 'sync' : 'schedule')}<span>${esc(e.z)}</span></span>`;
const id = (e) => `<span class="id">${e.id}</span>`;
const sitz = (v) => v.replace(/(session:[0-9a-f]+)/, '<span class="sitzung">$1</span>');
const projekt = (e) => (e.p ? `<span class="projekt">${e.p}${e.an ? `<span class="rest"> · an ${e.an}</span>` : ''}</span>` : '<span class="projekt keins">ohne Projekt</span>');

// ---- Zeilen und Karten
const zeileA = (e) => `<li><a class="zeile ${ART[e.art].k}${e.dring ? ' dringend' : ''}" href="#e">
  <span class="rund">${ico(ART[e.art].s)}</span>
  <span class="mitte"><span class="t">${esc(e.t)}</span>${zst(e)}<span class="m">${id(e)}<span>· ${ART[e.art].wort}</span><span>· ${prio(e)}</span></span></span>
  <span class="rechts"><span>${e.alter}</span>${e.dring ? ico('flag-f') : ''}</span></a></li>`;
const zeileC = (e) => `<li><a class="zeile ${ART[e.art].k}${e.dring ? ' dringend' : ''}" href="#e">
  <span class="kopfz"><span class="chip-art ${ART[e.art].k}">${ico(ART[e.art].s)}${ART[e.art].wort}</span>${id(e)}${projekt(e)}</span>
  <span class="t">${esc(e.t)}</span>${zst(e)}
  <span class="m" style="grid-column:1/-1">${prio(e)}<span>· ${e.alter}</span></span></a></li>`;
const karteB = (e) => `<li><a class="karte ${ART[e.art].k}${e.dring ? ' dringend' : ''}" href="#e">
  <span class="kopfzeile"><span class="chip-art ${ART[e.art].k}">${ico(ART[e.art].s)}${ART[e.art].wort}</span>${id(e)}${projekt(e)}${e.dring ? `<span class="chip-dringend">${ico('flag-f')}Dringend</span>` : ''}</span>
  <span class="titel">${esc(e.t)}</span>${zst(e)}<span class="von">von ${sitz(esc(e.von))} · ${PRIO[e.rang]} · ${e.alter}</span></a></li>`;

// ---- Gerüst: obere Leiste, Navigation (wie index.html)
const tab = (name, wort, sym, an, plakette = '') => `<a href="#${name}"${an ? ' aria-current="page"' : ''}><span class="sym"><svg class="ico aus" aria-hidden="true"><use href="#i-${sym}"/></svg><svg class="ico an" aria-hidden="true"><use href="#i-${sym.replace('-f', '')}-f"/></svg>${plakette}</span>${wort}</a>`;
const nav = (aktiv, mitAlle) => `<nav class="leiste" aria-label="Bereiche">
  ${tab('wartet', 'Wartet', 'inbox', aktiv === 'wartet', '<span class="plakette">7</span>')}
  ${mitAlle ? tab('alle', 'Alle', 'list', aktiv === 'alle') : ''}
  ${tab('abnahmen', 'Abnahmen', 'checklist', false)}${tab('erfassen', 'Erfassen', 'add', false)}${tab('mehr', 'Mehr', 'menu', false)}
</nav>`;
const seite = (titel, kopf, haupt, unten, extra = '', inert = '') => `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="text-scale" content="scale"><meta name="color-scheme" content="light dark">
<title>${titel}</title>
<link rel="stylesheet" href="../../../../../app.css"><link rel="stylesheet" href="varianten.css"></head>
<body>${spriteNeu}
<header class="kopf"${inert}><h1>${kopf}</h1>${ico_knopf('search', 'Suchen')}</header>
<main${inert}>${haupt}</main>
<div class="unten"${inert}>${unten}</div>${extra}
</body></html>
`;
const ico_knopf = (n, l) => `<a class="symbol" href="#s" aria-label="${l}">${ico(n)}</a>`;

const dichFuer = E.filter((e) => e.st === 'dich').length;
const gruppen = (liste) => { const m = new Map(); for (const e of liste) { const k = e.p ?? 'ohne Projekt'; m.set(k, [...(m.get(k) ?? []), e]); } return [...m]; };

// ---- A: Reiter „Alle“, Gruppen nach Projekt, Auswahl-Chips mit Ausklapp
const menuChip = (text, an = false) => `<button class="fchip${an ? ' an' : ''}" type="button">${an ? ico('check') : ''}${text}${ico('expand_more')}</button>`;
const A = seite('Entwurf A: Alle', 'Alle offenen',
  `<p class="summe"><b>${E.length} offen</b> · ${dichFuer} für dich · ${E.filter((e) => e.dring).length} dringend</p>
<div class="fleiste"><div class="reihe">${menuChip('Status')}${menuChip('Projekt')}${menuChip('Art')}${menuChip('Priorität')}</div>
<div class="sortzeile"><span>Nach Projekt gruppiert</span><button type="button">${ico('swap_vert')}Sortieren${ico('expand_more')}</button></div></div>
${gruppen(E).map(([p, l]) => `<div class="gruppenkopf"><b>${p}</b><span>${l.length} offen${l.some((e) => e.st === 'dich') ? ` · ${l.filter((e) => e.st === 'dich').length} für dich` : ''}</span></div><ul class="gruppe">${l.map(zeileA).join('')}</ul>`).join('')}`,
  nav('alle', true));

// ---- B: Reiter „Alle“, Karten wie in Wartet, Filter und Sortierung in einem Blatt
const gefiltert = E.filter((e) => e.st !== 'dich');
const aktiv = (t) => `<button class="fchip an" type="button">${t}${ico('close')}</button>`;
const kopfB = `<p class="summe"><b>${gefiltert.length} von ${E.length}</b> Einträgen · nicht für dich</p>
<div class="fleiste"><div class="reihe"><button class="fchip kurz" type="button">${ico('filter_list')}Filtern</button><button class="fchip kurz" type="button">${ico('swap_vert')}Alter, neu zuerst</button></div>
<div class="aktiv" style="margin-top:8px">${aktiv('Wartet auf anderes')}${aktiv('In Arbeit')}${aktiv('Offen')}</div></div>`;
const B = seite('Entwurf B: Alle', 'Alle offenen', `${kopfB}<ul class="karten">${gefiltert.map(karteB).join('')}</ul>`, nav('alle', true));
const w = (t, an = false) => `<button class="fchip${an ? ' an' : ''}" type="button">${an ? ico('check') : ''}${t}</button>`;
const wArt = (a, an = false) => `<button class="fchip ${ART[a].k}${an ? ' an' : ''}" type="button">${an ? ico('check') : `<span class="art-ico">${ico(ART[a].s)}</span>`}${ART[a].wort}</button>`;
const blattB = `<div class="dimm"></div><section class="blatt-v" aria-label="Filtern und sortieren"><div class="griff"></div><div class="koerper">
<h2>Filtern und sortieren</h2>
<h3>Sortieren nach</h3><div class="chips-v">${w('Alter', true)}${w('Priorität')}${w('Projekt')}${w('Art')}${w('Status')}</div>
<h3>Status</h3><div class="chips-v">${w('Wartet auf dich')}${w('In Arbeit', true)}${w('Wartet auf anderes', true)}${w('Offen', true)}</div>
<h3>Projekt</h3><div class="chips-v">${w('alpha')}${w('beta')}${w('gamma')}${w('ohne Projekt')}</div>
<h3>Art</h3><div class="chips-v">${wArt('frage')}${wArt('freigabe')}${wArt('abnahme')}${wArt('auftrag')}${wArt('nachricht')}</div>
<h3>Priorität</h3><div class="chips-v">${w('Dringend')}${w('Hoch')}${w('Normal')}${w('Niedrig')}</div>
</div><div class="knoepfe"><button class="text" type="button">Zurücksetzen</button><button class="gefuellt" type="button">${gefiltert.length} Einträge zeigen</button></div></section>`;
const Bblatt = seite('Entwurf B: Blatt', 'Alle offenen', `${kopfB}<ul class="karten">${gefiltert.map(karteB).join('')}</ul>`, nav('alle', true), blattB, ' inert');

// ---- C: Umschalter auf der Startansicht, Liste mit Trennlinien, Filter als Formular
const segment = `<div class="segment" role="group" aria-label="Anzeige"><button type="button" aria-pressed="false">Für dich ${dichFuer}</button><button type="button" aria-pressed="true">Alle ${E.length}</button></div>`;
const sel = (l, opts, breit = false) => `<label${breit ? ' class="breit"' : ''}>${l}<select>${opts.map((o) => `<option>${o}</option>`).join('')}</select></label>`;
const formular = `<div class="formular">${sel('Status', ['Alle', 'Wartet auf dich', 'In Arbeit', 'Wartet auf anderes', 'Offen'])}${sel('Projekt', ['Alle', 'alpha', 'beta', 'gamma'])}${sel('Art', ['Alle', 'Frage', 'Freigabe', 'Abnahme', 'Auftrag'])}${sel('Priorität', ['Alle', 'Dringend', 'Hoch', 'Normal', 'Niedrig'])}${sel('Sortieren nach', ['Alter, neu zuerst', 'Alter, alt zuerst', 'Priorität', 'Projekt', 'Art'], true)}</div>`;
const filterfeld = `<button class="filterfeld" type="button" style="width:100%;border:0;text-align:left;color:inherit">${ico('filter_list')}<span class="wert"><b>Keine Filter</b>Alter, neu zuerst</span>${ico('expand_more')}</button>`;
const C = seite('Entwurf C: Segment', 'Alle offenen', `${segment}${filterfeld}<ul class="liste-c">${E.map(zeileC).join('')}</ul>`, nav('wartet', false));
const Cfilter = seite('Entwurf C: Filter', 'Alle offenen', `${segment}<button class="filterfeld" type="button" style="width:100%;border:0;text-align:left;color:inherit">${ico('filter_list')}<span class="wert"><b>Filtern und sortieren</b></span>${ico('expand_more')}</button>${formular}<ul class="liste-c">${E.slice(0, 2).map(zeileC).join('')}</ul>`, nav('wartet', false));

for (const [n, h] of Object.entries({ a: A, b: B, 'b-blatt': Bblatt, c: C, 'c-filter': Cfilter })) writeFileSync(new URL(`${n}.html`, hier), h);
process.stdout.write('a.html b.html b-blatt.html c.html c-filter.html geschrieben\n');
