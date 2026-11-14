// Service Worker: hält die Hülle der App nach Fassung, damit sie ohne Netz startet (UOF-1). Daten gehen ans
// Netz und liegen in IndexedDB (js/speicher.js), nicht hier. Die Fassung steht gleich in js/version.js; neue Dateien
// gehören in DATEIEN (tests/geruest.test.mjs prüft beides).
const FASSUNG = 'postfach-20261114.01';
const DATEIEN = [
  './', './index.html', './app.css', './manifest.webmanifest',
  './js/abgleich.js', './js/adressen.js', './js/anzeigen.js', './js/dom.js', './js/format.js', './js/navigation.js', './js/netz.js', './js/pruefen.js', './js/pytext.js', './js/speicher.js', './js/start.js', './js/statusleiste.js', './js/steuerung.js', './js/urteil.js', './js/version.js', './js/zustand.js',
  './symbole/symbol-192.png', './symbole/symbol-512.png', './symbole/maskierbar-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' umgeht den HTTP-Cache von Pages, sonst landen alte Dateien unter der neuen Fassung
  e.waitUntil(caches.open(FASSUNG).then((c) => c.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' })))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((alle) => Promise.all(alle.filter((k) => k !== FASSUNG).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Die neue Fassung wartet, bis die App sie mit „wechseln“ freigibt (UOF-5, Teil F).
self.addEventListener('message', (e) => { if (e.data === 'wechseln') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // Daten gehen ans Netz
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
