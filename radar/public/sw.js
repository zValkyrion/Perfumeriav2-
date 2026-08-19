/**
 * Service worker de la app de campo.
 *
 * Sin esto, "funciona sin señal" era mentira a medias: los datos sí vivían en
 * IndexedDB, pero al cerrar el navegador sin red la página no volvía a abrir —
 * no había de dónde sacar el HTML ni el JavaScript. Esto guarda el armazón de la
 * app en el propio dispositivo, así que abre igual en un sótano que en la calle.
 *
 * Lo que NO cachea: las teselas del mapa (política de uso de OpenStreetMap; el
 * caché normal del navegador ya guarda las que se hayan visto) y Nominatim.
 */

const CACHE = "radar-v1";

// El armazón mínimo para arrancar. Los chunks de JavaScript se van sumando solos
// conforme se visitan, porque llevan hash en el nombre y no se pueden listar aquí.
const ARMAZON = ["/", "/captura/", "/ficha/", "/manifest.webmanifest", "/icono-192.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      // `reload` evita guardar una copia ya vieja del caché HTTP del navegador.
      .then((c) => c.addAll(ARMAZON.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);
  // Solo lo servido por esta app. El mapa y el geocodificador se dejan pasar
  // tal cual: cachearlos sería contra las reglas de OSM y engordaría el caché.
  if (url.origin !== self.location.origin) return;

  // Navegación: primero la red (para recibir despliegues nuevos), y si no hay,
  // la copia guardada. Es lo que hace que la app abra sin señal.
  if (peticion.mode === "navigate") {
    evento.respondWith(
      fetch(peticion)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(peticion, copia));
          return res;
        })
        .catch(() =>
          caches
            .match(peticion)
            .then((guardado) => guardado || caches.match("/")),
        ),
    );
    return;
  }

  // Recursos con hash en el nombre: si están guardados, no hay razón para
  // volver a pedirlos. Ahorra datos en roaming además de funcionar offline.
  evento.respondWith(
    caches.match(peticion).then((guardado) => {
      if (guardado) return guardado;
      return fetch(peticion).then((res) => {
        if (res.ok && res.type === "basic") {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(peticion, copia));
        }
        return res;
      });
    }),
  );
});
