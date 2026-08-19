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
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sin service worker la app sigue funcionando con red; no hay nada que
      // avisarle al usuario en la calle.
    });
  }, []);

  return null;
}
