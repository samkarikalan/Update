/* =============================================
   CLUB Scheduler — Service Worker
   Caches app shell for offline use
   ============================================= */

const CACHE_NAME = 'club-scheduler-v17';

const ASSETS = [
  '/SCSWork/KariBRRApp.html',
  '/SCSWork/BRRStyle1.css',
  '/SCSWork/BRRStyle2.css',
  '/SCSWork/BRRStyle3.css',
  '/SCSWork/Export.css',
  '/SCSWork/HomeStyle.css',
  '/SCSWork/HomeStyle-new.css',
  '/SCSWork/main.js',
  '/SCSWork/HomeScreen.js',

  '/SCSWork/settings.js',
  '/SCSWork/players.js',
  '/SCSWork/rounds.js',
  '/SCSWork/games.js',
  '/SCSWork/summary.js',
  '/SCSWork/dashboard.js',
  '/SCSWork/viewer.js',
  '/SCSWork/profile.js',
  '/SCSWork/supabase.js',
  '/SCSWork/importPlayers.js',
  '/SCSWork/competitive_algorithm.js',
  '/SCSWork/engjap.js',
  '/SCSWork/ExportCSS.js',
  '/SCSWork/github.js',
  '/SCSWork/help.js',
  '/SCSWork/male.png',
  '/SCSWork/female.png',
  '/SCSWork/win-cup.png',
  '/SCSWork/lock.png',
  '/SCSWork/unlock.png',
  '/SCSWork/power.png',
  '/SCSWork/cs.PNG',
  '/SCSWork/timer.mp3',
  '/SCSWork/help_en.json',
  '/SCSWork/help_jp.json',
  '/SCSWork/help_kr.json',
  '/SCSWork/help_zh.json',
  '/SCSWork/help_vi.json'
];

/* ── Install: cache all assets ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

/* ── Activate: clean up old caches ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/* ── Fetch: serve from cache, fall back to network ── */
self.addEventListener('fetch', function(event) {
  // Skip Supabase API calls — always go to network
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        // Cache new valid responses
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    }).catch(function() {
      // Offline fallback — return cached HTML
      if (event.request.destination === 'document') {
        return caches.match('/SCSWork/KariBRRApp.html');
      }
    })
  );
});
