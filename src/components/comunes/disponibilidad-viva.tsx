"use client";

import { useEffect } from "react";
import { consultarDisponibilidad, useDisponibilidad } from "@/store/disponibilidad";

/**
 * Pregunta qué se vende ahora al abrir la tienda, y otra vez al volver a la
 * pestaña si pasaron más de cinco minutos: quien deja el carrito abierto una
 * tarde no debe pagar con los precios del mediodía. No pinta nada.
 */
const VIGENCIA_MS = 5 * 60_000;

export function DisponibilidadViva() {
  useEffect(() => {
    void consultarDisponibilidad();
    const alVolver = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - useDisponibilidad.getState().consultadaEn > VIGENCIA_MS) {
        void consultarDisponibilidad();
      }
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, []);
  return null;
}
