// Service Worker: speichert alle Dateien auf dem Handy, damit die App offline läuft.
importScripts('version.js', 'lib/ionic/dateien.js');
const CACHE = 'tla-' + self.APP_VERSION;

// Alle Dateien, die offline verfügbar sein müssen. Neue Dateien (z. B. content/tag-02.json) hier ergänzen.
const DATEIEN = [
  './', 'index.html', 'version.js', 'manifest.webmanifest', 'theme.css', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/leitner.js', 'js/chart.js', 'js/kurse.js',
  'js/grafiken.js', 'js/uebungen.js', 'js/util.js', 'js/icons.js', 'js/ui.js', 'js/indikatoren.js',
  'content/tage.json', 'content/tag-01.json', 'content/tag-02.json', 'content/tag-03.json',
  'content/tag-04.json', 'content/tag-05.json', 'content/tag-06.json', 'content/tag-07.json',
  'content/tag-08.json', 'content/tag-09.json', 'content/tag-10.json',
  'lib/inter/inter-latin-wght-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  ...self.IONIC_DATEIEN
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('tla-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

// Zuerst aus dem Speicher, sonst aus dem Netz (und dann merken).
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.open(CACHE).then(async c => {
      const treffer = await c.match(e.request, { ignoreSearch: true });
      if (treffer) return treffer;
      const antwort = await fetch(e.request);
      if (antwort.ok) c.put(e.request, antwort.clone());
      return antwort;
    })
  );
});
