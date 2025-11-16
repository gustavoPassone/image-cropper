const CACHE_NAME = "voxscan-cache-v1";
const urlsToCache = [
  "./",
  "./index.html",
  "./style/style.css",
  "./js/script.js",
  "https://cdn.tailwindcss.com",
  "https://docs.opencv.org/4.9.0/opencv.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://unpkg.com/lucide@latest",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache");
      // Usar requisições com 'no-cors' para recursos de terceiros pode evitar respostas opacas.
      // No entanto, addAll lida com isso de forma transparente na maioria dos casos.
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit - retorna a resposta do cache
      if (response) {
        return response;
      }

      // Não está no cache - busca na rede
      return fetch(event.request)
        .then((networkResponse) => {
          // Verifica se recebemos uma resposta válida
          if (
            !networkResponse ||
            (networkResponse.status !== 200 &&
              networkResponse.type !== "opaque")
          ) {
            return networkResponse;
          }

          // Clona a resposta. Uma resposta é um stream e só pode ser consumida uma vez.
          // Precisamos cloná-la para que tanto o navegador quanto o cache possam usá-la.
          const responseToCache = networkResponse.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch((error) => {
          console.error("Fetching failed:", error);
          // Opcional: Retornar uma página offline personalizada aqui
        });
    })
  );
});

self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Deleta caches antigos
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
