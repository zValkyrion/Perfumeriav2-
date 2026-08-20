"use client";

import { useEffect } from "react";

/**
 * Registra el service worker que permite abrir la app sin señal.
 *
 * Solo en producción: en desarrollo se pelearía con la recarga en caliente y
 * serviría archivos viejos, que es la peor forma de perder una tarde.
 */
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    void limpiarRegistroViejo();

    // El ámbito del service worker es la carpeta desde la que se sirve: registrado
    // en /radar/sw.js controla /radar/** y nada más, que es justo lo que se quiere
    // — la tienda vive en la misma distribución y no debe verse afectada.
    navigator.serviceWorker.register("/radar/sw.js").catch(() => {
      // Sin service worker la app sigue funcionando con red; no hay nada que
      // avisarle al usuario en la calle.
    });
  }, []);

  return null;
}

/**
 * Da de baja el service worker que la app dejó cuando vivía en la raíz.
 *
 * Los teléfonos del equipo ya lo tienen instalado con ámbito `/`, y ese ámbito
 * ahora cubre la tienda: un service worker pensado para la app de campo acabaría
 * interceptando y cacheando páginas de la tienda, que no es asunto suyo.
 *
 * Desregistrarlo no borra nada capturado: las fichas viven en IndexedDB, no en la
 * caché del service worker.
 */
async function limpiarRegistroViejo(): Promise<void> {
  try {
    const registros = await navigator.serviceWorker.getRegistrations();
    const raiz = `${location.origin}/`;
    await Promise.all(
      registros
        .filter((r) => r.scope === raiz)
        .map(async (r) => {
          await r.unregister();
          // La caché del registro viejo se queda huérfana: se va con él.
          await caches.delete("radar-v1");
          await caches.delete("radar-v2");
        }),
    );
  } catch {
    // Si el navegador no deja enumerar registros, no hay nada que hacer aquí.
  }
}
