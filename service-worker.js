const CACHE_VER = 'v0.0.2';
const CACHE_FILES = [
  '/',
  '/main.js',
  '/style.css',
  '/manifest.json',
  'https://cdn.yiays.com/jquery-3.6.0.min.js'
];

// Install procedure
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VER)
    .then((cache) => {
      cache.addAll(CACHE_FILES);
    })
  )
});

// Caching
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request)
    .then((res) => {
      if(res) return res;
      var url = e.request.clone();
      return fetch(url).then((nres) => {
        if(!nres || nres.status !== 200 || nres.type !== 'basic')
          return nres;
        
        if(e.request in CACHE_FILES) {
          var newfile = nres.clone();

          caches.open(CACHE_VER)
          .then((cache) => {
            cache.put(e.request, newfile);
          });
        }

        return nres;
      })
    })
  )
});

// Deleting old cache versions on update
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
    .then((keys) => {
      return Promise.all(keys.map((key, i) => {
        if(key !== CACHE_VER){
          return caches.delete(keys[i]);
        }
      }));
    })
  );
});