"use client";

import { useCallback, useEffect, useState } from "react";
import { acceso } from "@/lib/api";
import {
  fijarNuevaContrasena,
  hayCognito,
  iniciarSesion,
  leerPerfil,
  refrescar,
  type ResultadoAcceso,
} from "@/lib/cognito";

/**
 * La sesión del panel.
 *
 * Conviven dos formas de entrar mientras dura la transición:
 *
 * 1. **Cognito** — correo y contraseña, con la identidad real y los grupos
 *    dentro del token. Es lo definitivo.
 * 2. **El código de equipo** — el PIN compartido de siempre. Sigue aquí porque
 *    el equipo está en la calle y no se le puede cortar el acceso a mitad de una
 *    gira; se retira cuando todos tengan cuenta.
 *
 * **Modo sin conexión.** Si al entrar no hay red se permite trabajar igual: las
 * fichas viven en el teléfono y no sale nada de él hasta sincronizar. Bloquear la
 * captura por falta de señal sería inaceptable donde esto se usa.
 */

const CLAVE_TOKEN = "radar:token";
const CLAVE_REFRESCO = "radar:refresco";
const CLAVE_VENCE = "radar:vence";
const CLAVE_EVALUADOR = "radar:evaluador";
const CLAVE_LOCAL = "radar:solo_local";

export type Sesion = {
  desbloqueado: boolean;
  evaluador: string | null;
  /** Token que viaja a la API. De Cognito o del PIN, según cómo se entró. */
  token: string | null;
  /** Grupos de Cognito. Vacío si se entró con el código de equipo. */
  grupos: string[];
  soloLocal: boolean;
  listo: boolean;
  /** Correo y contraseña contra Cognito. */
  entrarConCuenta: (
    correo: string,
    contrasena: string,
  ) => Promise<
    { ok: true } | { ok: false; error: string } | { nuevaContrasena: ResultadoAcceso }
  >;
  /** Segundo paso cuando la cuenta es nueva y trae contraseña temporal. */
  cambiarContrasena: (
    reto: { sesion: string; correo: string },
    nueva: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** El código compartido de siempre. Se irá. */
  entrarConCodigo: (
    pin: string,
    evaluador: string,
  ) => Promise<{ ok: boolean; sinRed?: boolean; error?: string }>;
  conectar: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  salir: () => void;
};

export function useSesion(): Sesion {
  const [token, setToken] = useState<string | null>(null);
  const [evaluador, setEvaluador] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<string[]>([]);
  const [soloLocal, setSoloLocal] = useState(false);
  const [listo, setListo] = useState(false);

  const guardarCognito = useCallback(
    (idToken: string, refreshToken: string, vence: number) => {
      const perfil = leerPerfil(idToken);
      localStorage.setItem(CLAVE_TOKEN, idToken);
      if (refreshToken) localStorage.setItem(CLAVE_REFRESCO, refreshToken);
      localStorage.setItem(CLAVE_VENCE, String(vence));
      localStorage.setItem(CLAVE_EVALUADOR, perfil?.nombre ?? "");
      localStorage.removeItem(CLAVE_LOCAL);
      setToken(idToken);
      setEvaluador(perfil?.nombre ?? "");
      setGrupos(perfil?.grupos ?? []);
      setSoloLocal(false);
    },
    [],
  );

  useEffect(() => {
    const guardado = localStorage.getItem(CLAVE_TOKEN);
    setToken(guardado);
    setEvaluador(localStorage.getItem(CLAVE_EVALUADOR));
    setSoloLocal(localStorage.getItem(CLAVE_LOCAL) === "si");
    if (guardado) setGrupos(leerPerfil(guardado)?.grupos ?? []);
    setListo(true);

    // El token de identidad dura una hora; el de refresco, noventa días. Se
    // renueva al abrir si ya venció, para que nadie se quede fuera a media
    // jornada. Sin red no pasa nada: se sigue con lo local.
    const refresco = localStorage.getItem(CLAVE_REFRESCO);
    const vence = Number(localStorage.getItem(CLAVE_VENCE) ?? 0);
    if (refresco && vence < Date.now() + 60_000) {
      refrescar(refresco)
        .then((t) => guardarCognito(t.idToken, refresco, t.vence))
        .catch(() => {
          // Refresco vencido o sin señal: la sesión guardada sigue sirviendo
          // para trabajar en local, y la API dirá que no cuando toque subir.
        });
    }
  }, [guardarCognito]);

  const entrarConCuenta = useCallback(
    async (correo: string, contrasena: string) => {
      try {
        const r = await iniciarSesion(correo.trim(), contrasena);
        if (r.tipo === "nueva_contrasena") return { nuevaContrasena: r };
        guardarCognito(r.tokens.idToken, r.tokens.refreshToken, r.tokens.vence);
        return { ok: true as const };
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : "No se pudo entrar",
        };
      }
    },
    [guardarCognito],
  );

  const cambiarContrasena = useCallback(
    async (reto: { sesion: string; correo: string }, nueva: string) => {
      try {
        const t = await fijarNuevaContrasena(reto.correo, reto.sesion, nueva);
        guardarCognito(t.idToken, t.refreshToken, t.vence);
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "No se pudo guardar la contraseña",
        };
      }
    },
    [guardarCognito],
  );

  const entrarConCodigo = useCallback(async (pin: string, nombre: string) => {
    const limpio = nombre.trim();
    try {
      const r = await acceso(pin, limpio);
      localStorage.setItem(CLAVE_TOKEN, r.token);
      localStorage.setItem(CLAVE_EVALUADOR, r.evaluador);
      localStorage.removeItem(CLAVE_LOCAL);
      setToken(r.token);
      setEvaluador(r.evaluador);
      setGrupos([]);
      setSoloLocal(false);
      return { ok: true };
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "Falló el acceso";
      // Un código equivocado es un "no" del servidor. Que no haya red es otra
      // cosa, y confundirlas dejaría al equipo pensando que se equivocó.
      if (motivo.includes("código")) return { ok: false, error: motivo };

      localStorage.setItem(CLAVE_EVALUADOR, limpio);
      localStorage.setItem(CLAVE_LOCAL, "si");
      setEvaluador(limpio);
      setSoloLocal(true);
      return { ok: true, sinRed: true };
    }
  }, []);

  const conectar = useCallback(
    async (pin: string) => {
      if (!evaluador) return { ok: false, error: "Falta saber quién eres" };
      const r = await entrarConCodigo(pin, evaluador);
      return r.sinRed ? { ok: false, error: "Sigue sin haber conexión" } : r;
    },
    [evaluador, entrarConCodigo],
  );

  const salir = useCallback(() => {
    for (const c of [
      CLAVE_TOKEN,
      CLAVE_REFRESCO,
      CLAVE_VENCE,
      CLAVE_EVALUADOR,
      CLAVE_LOCAL,
    ]) {
      localStorage.removeItem(c);
    }
    setToken(null);
    setEvaluador(null);
    setGrupos([]);
    setSoloLocal(false);
  }, []);

  return {
    desbloqueado: (token !== null || soloLocal) && evaluador !== null,
    evaluador,
    token,
    grupos,
    soloLocal,
    listo,
    entrarConCuenta,
    cambiarContrasena,
    entrarConCodigo,
    conectar,
    salir,
  };
}

export { hayCognito };
