const CACHE='chill-pros-pwa-20260825';
const CORE=['./launch.html','./index.html','./styles.css','./standalone-workflows.css','./standalone-workflows.js','./app.js','./manifest.webmanifest','./cp-app-icon.jpg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).catch(()=>null));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>null);return response;}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./launch.html'))));});
