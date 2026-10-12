const CACHE='ciliu-v5';
const FILES=['./','./index.html','./style.css','./app.js','./core.js','./memory.js','./data/words.json','./data/LICENSE.txt','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png'];
// A new cache must not be populated from still-fresh old HTTP/CDN responses.
// Store fresh, versioned network downloads under canonical offline URLs.
self.addEventListener('install',e=>{e.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await Promise.all(FILES.map(async file=>{
  const canonical=new URL(file,self.registration.scope),download=new URL(canonical);
  download.searchParams.set('__ciliu_release',CACHE);
  const response=await fetch(download,{cache:'reload'});
  if(!response.ok)throw Error(`Could not cache ${file}: ${response.status}`);
  await cache.put(canonical,response);
 }));
 await self.skipWaiting();
})());});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
 const keys=await caches.keys(),old=keys.filter(k=>k.startsWith('ciliu-')&&k!==CACHE);
 await Promise.all(old.map(k=>caches.delete(k)));
 await self.clients.claim();
 // Legacy clients have no controllerchange listener. Reload them once after
 // upgrading; IndexedDB (saved assessment, words and check-ins) is untouched.
 // Do not await navigation inside activate: its requests wait for activation.
 if(old.length){const windows=await self.clients.matchAll({type:'window'});for(const client of windows)client.navigate(client.url).catch(()=>{});}
})());});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.open(CACHE).then(c=>c.match(e.request)).then(cached=>cached||fetch(e.request)));});
