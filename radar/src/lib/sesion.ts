"use client";

import { useCallback, useEffect, useState } from "react";
import { acceso } from "@/lib/api";

/**
 * Acceso al equipo.
 *
 * El PIN ya **no vive en el cliente**: lo valida la Lambda contra el secreto en
 * SSM (`Elrey_pin`) y devuelve un JWT de 90 días con el nombre de quien captura
 * dentro. Antes estaba escrito en este archivo y cualquiera que abriera la URL
 * podía leerlo en el JavaScript.
 *
 * **Modo sin conexión.** Si al entrar no hay señal, se permite trabajar igual:
 * las fichas viven en el teléfono y no sale nada de él hasta sincronizar. Lo que
 * no se puede hacer sin token es subir — y para eso se vuelve a pedir el código
 * cuando haya red. Bloquear la captura por falta de señal sería inaceptable en
 * la calle, que es donde esto se usa.
 */

const CLAVE_TOKEN = "radar:token";
const CLAVE_EVALUADOR = "radar:evaluador";
const CLAVE_LOCAL = "radar:solo_local";

export type Sesion = {
  /** Puede usar la app. */
  desbloqueado: boolean;
  /** Quién captura. Firma cada ficha. */
  evaluador: string | null;
  /** JWT para hablar con la API. `null` en modo sin conexión. */
  token: string | null;
  /** Entró sin haber podido validar el PIN contra el servidor. */
  soloLocal: boolean;
  /** Ya se leyó `localStorage`; antes de esto no hay que pintar nada. */
  listo: boolean;
  entrar: (
    pin: string,
    evaluador: string,
  ) => Promise<{ ok: boolean; sinRed?: boolean; error?: string }>;
  /** Reintenta la validación para conseguir token sin perder lo capturado. */
  conectar: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  salir: () => void;
};

export function useSesion(): Sesion {
  const [token, setToken] = useState<string | null>(null);
  const [evaluador, setEvaluador] = useState<string | null>(null);
  const [soloLocal, setSoloLocal] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem(CLAVE_TOKEN));
    setEvaluador(localStorage.getItem(CLAVE_EVALUADOR));
    setSoloLocal(localStorage.getItem(CLAVE_LOCAL) === "si");
    setListo(true);
  }, []);

  const guardarSesion = useCallback((nuevoToken: string, nombre: string) => {
    localStorage.setItem(CLAVE_TOKEN, nuevoToken);
    localStorage.setItem(CLAVE_EVALUADOR, nombre);
    localStorage.removeItem(CLAVE_LOCAL);
    setToken(nuevoToken);
    setEvaluador(nombre);
    setSoloLocal(false);
  }, []);

  const entrar = useCallback(
    async (pin: string, nombre: string) => {
      const limpio = nombre.trim();
      try {
        const r = await acceso(pin, limpio);
        guardarSesion(r.token, r.evaluador);
        return { ok: true };
      } catch (e) {
        const motivo = e instanceof Error ? e.message : "Falló el acceso";
        // Un PIN equivocado es un "no" del servidor y hay que decirlo. Que no
        // haya red es otra cosa completamente distinta, y confundirlas dejaría
        // al equipo pensando que se equivocó de código.
        if (motivo.includes("código")) return { ok: false, error: motivo };

        localStorage.setItem(CLAVE_EVALUADOR, limpio);
        localStorage.setItem(CLAVE_LOCAL, "si");
        setEvaluador(limpio);
        setSoloLocal(true);
        return { ok: true, sinRed: true };
      }
    },
    [guardarSesion],
  );

  const conectar = useCallback(
    async (pin: string) => {
      if (!evaluador) return { ok: false, error: "Falta saber quién eres" };
      try {
        const r = await acceso(pin, evaluador);
        guardarSesion(r.token, r.evaluador);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Falló el acceso" };
      }
    },
    [evaluador, guardarSesion],
  );

  /** Cierra el acceso en este dispositivo. Las fichas guardadas no se tocan. */
  const salir = useCallback(() => {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_EVALUADOR);
    localStorage.removeItem(CLAVE_LOCAL);
    setToken(null);
    setEvaluador(null);
    setSoloLocal(false);
  }, []);

  return {
    desbloqueado: (token !== null || soloLocal) && evaluador !== null,
    evaluador,
    token,
    soloLocal,
    listo,
    entrar,
    conectar,
    salir,
  };
}
