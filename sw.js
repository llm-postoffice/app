// Service Worker: hält die Hülle der App nach Fassung, damit sie ohne Netz startet (UOF-1). Daten gehen ans
// Netz und liegen in IndexedDB (js/speicher.js), nicht hier. Die Fassung steht gleich in js/version.js; neue Dateien
// gehören in DATEIEN (tests/geruest.test.mjs prüft beides). Die Entscheidungen stehen in js/swlogik.js (rein, unter
// node --test); darum ist dieser Service Worker ein Modul (register mit type: 'module').
import { PUSH_HINWEIS, gibtFrei, hinweisOptionen, klickPlan, pushZiel, veralteteCaches } from './js/swlogik.js';

const FASSUNG = 'postfach-20261124.03';
const DATEIEN = [
  './', './index.html', './app.css', './manifest.webmanifest',
  './js/abgleich.js', './js/ablauf.js', './js/aktualisieren.js', './js/abnahme.js', './js/absenden.js', './js/adressen.js', './js/anmelden.js', './js/anmeldung.js',
  './js/anhaenge.js', './js/anhaengeansicht.js', './js/anhangholer.js', './js/anhangwahl.js', './js/ansichten.js', './js/ansichtstexte.js', './js/anzeigen.js', './js/app.js', './js/bearbeiten.js', './js/dateien.js', './js/dom.js', './js/eintrag.js',
  './js/entwuerfe.js', './js/erfassen.js', './js/erzeugen.js', './js/format.js', './js/frist.js', './js/hinweis.js', './js/karten.js', './js/markdown.js',
  './js/mehr.js', './js/navigation.js', './js/netz.js', './js/netzprobe.js', './js/pruefen.js', './js/pushklick.js', './js/pytext.js', './js/schlange.js', './js/schreiben.js', './js/senden.js',
  './js/speicher.js', './js/start.js', './js/statusleiste.js',
  './js/steuerung.js', './js/swlogik.js', './js/texte.js', './js/uebersicht.js', './js/urteil.js', './js/verkleinern.js', './js/version.js', './js/webpush.js', './js/welt.js', './js/zustand.js',
  './symbole/symbol-192.png', './symbole/symbol-512.png', './symbole/maskierbar-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' umgeht den HTTP-Cache von Pages, sonst landen alte Dateien unter der neuen Fassung
  e.waitUntil(caches.open(FASSUNG).then((c) => c.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' })))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((alle) => Promise.all(veralteteCaches(alle, FASSUNG).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Die neue Fassung wartet, bis die App sie mit „wechseln“ freigibt (UOF-5, Teil F).
self.addEventListener('message', (e) => { if (gibtFrei(e.data)) self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // Daten gehen ans Netz
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
// Web-Push als Probe: ein Push ohne Text zeigt einen festen Hinweis; ein Tipp holt das Fenster der App nach vorn oder öffnet die App; die App
// gleicht dann ab und öffnet Wartet, den neuesten neuen Eintrag oder den, den eine Nutzlast nennt. Chromium verlangt für jeden Push einen sichtbaren Hinweis
// (userVisibleOnly). Die Entscheidungen stehen in js/swlogik.js.
self.addEventListener('push', (e) => {
  const text = e.data ? e.data.text() : '';
  e.waitUntil(self.registration.showNotification(PUSH_HINWEIS.titel, hinweisOptionen('./symbole/symbol-192.png', pushZiel(text))));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (fenster) => {
    const plan = klickPlan(fenster, e.notification.data, self.registration.scope);
    if (plan.art === 'neu') return self.clients.openWindow(plan.adresse);
    await plan.fenster.focus();
    plan.fenster.postMessage(plan.nachricht);   // die App gleicht ab und öffnet dann das Ziel (js/pushklick.js)
  }));
});
