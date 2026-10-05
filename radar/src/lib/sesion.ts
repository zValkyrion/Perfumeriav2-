"use client";

import { useCallback, useEffect, useState } from "react";
import {
  esTokenCognito,
  fijarNuevaContrasena,
  hayCognito,
  iniciarSesion,
  leerPerfil,
  refrescar,
  type ResultadoAcceso,
} from "@/lib/cognito";
import { esCorreoSuperadmin } from "@/lib/superadmin";

/**
 * La sesión del panel: una cuenta de Cognito, con la identidad real y los
 * grupos dentro del token. El código compartido del equipo se retiró el
 * 2026-10-05.
 *
 * **Sin señal se sigue trabajando.** Iniciar sesión pide red una vez; después
 * la sesión queda guardada en el teléfono, se captura sin conexión y las fichas
 * suben cuando vuelve la señal. El token de refresco dura 90 días.
 */

const CLAVE_TOKEN = "radar:token";
const CLAVE_REFRESCO = "radar:refresco";
const CLAVE_VENCE = "radar:vence";
const CLAVE_EVALUADOR = "radar:evaluador";
/** La dejaba el PIN al entrar sin red. Solo se borra. */
const CLAVE_LOCAL_VIEJA = "radar:solo_local";

export type Sesion = {
  desbloqueado: boolean;
  /**
   * Hay sesión pero la cuenta no es del equipo: es un cliente de la tienda que
   * llegó aquí. Todos entran por la misma puerta, así que pasa y ve cómo pedir
   * acceso. La API lo rechazaría igual; esto solo evita enseñarle un panel vacío.
   */
  sinPermiso: boolean;
  evaluador: string | null;
  /** El ID token de Cognito que viaja a la API. */
  token: string | null;
  correo: string | null;
  grupos: string[];
  /** `admins` o superadmin. Decide qué se pinta; el permiso real lo mira la API. */
  esAdmin: boolean;
  /** El dueño: reparte los permisos desde «Equipo y cuentas». */
  esSuperadmin: boolean;
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
  salir: () => void;
};

function borrarGuardado() {
  for (const c of [
    CLAVE_TOKEN,
    CLAVE_REFRESCO,
    CLAVE_VENCE,
    CLAVE_EVALUADOR,
    CLAVE_LOCAL_VIEJA,
    // Los guarda la tienda para editar la cuenta; se van con la sesión.
    "radar:acceso",
    "radar:acceso_vence",
  ]) {
    localStorage.removeItem(c);
  }
}

export function useSesion(): Sesion {
  const [token, setToken] = useState<string | null>(null);
  const [evaluador, setEvaluador] = useState<string | null>(null);
  const [correo, setCorreo] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<string[]>([]);
  const [listo, setListo] = useState(false);

  const guardarCognito = useCallback(
    (idToken: string, refreshToken: string, vence: number) => {
      const perfil = leerPerfil(idToken);
      localStorage.setItem(CLAVE_TOKEN, idToken);
      if (refreshToken) localStorage.setItem(CLAVE_REFRESCO, refreshToken);
      localStorage.setItem(CLAVE_VENCE, String(vence));
      localStorage.setItem(CLAVE_EVALUADOR, perfil?.nombre ?? "");
      setToken(idToken);
      setEvaluador(perfil?.nombre ?? "");
      setCorreo(perfil?.correo ?? null);
      setGrupos(perfil?.grupos ?? []);
    },
    [],
  );

  useEffect(() => {
    let guardado = localStorage.getItem(CLAVE_TOKEN);
    // Una sesión del PIN retirado: la API ya no la acepta, así que se cierra
    // en vez de dejar al teléfono fallando en cada sincronización. Las fichas
    // capturadas siguen en el teléfono y suben al entrar con la cuenta.
    if (guardado && !esTokenCognito(guardado)) {
      borrarGuardado();
      guardado = null;
    }
    localStorage.removeItem(CLAVE_LOCAL_VIEJA);
    const perfil = guardado ? leerPerfil(guardado) : null;
    setToken(guardado);
    setEvaluador(guardado ? localStorage.getItem(CLAVE_EVALUADOR) : null);
    setCorreo(perfil?.correo ?? null);
    setGrupos(perfil?.grupos ?? []);
    setListo(true);

    // El token de identidad dura una hora; el de refresco, noventa días. Se
    // renueva al abrir si ya venció, para que nadie se quede fuera a media
    // jornada. Sin red no pasa nada: se sigue con lo local.
    const refresco = localStorage.getItem(CLAVE_REFRESCO);
    const vence = Number(localStorage.getItem(CLAVE_VENCE) ?? 0);
    if (guardado && refresco && vence < Date.now() + 60_000) {
      refrescar(refresco)
        .then((t) => guardarCognito(t.idToken, refresco, t.vence))
        .catch(() => {
          // Refresco vencido, acceso cortado o sin señal: la sesión guardada
          // sigue sirviendo para trabajar en local, y la API dirá que no
          // cuando toque subir.
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

  const salir = useCallback(() => {
    borrarGuardado();
    setToken(null);
    setEvaluador(null);
    setCorreo(null);
    setGrupos([]);
  }, []);

  const esSuperadmin = esCorreoSuperadmin(correo);
  const esAdmin = grupos.includes("admins") || esSuperadmin;

  return {
    desbloqueado: token !== null && evaluador !== null,
    sinPermiso: token !== null && !grupos.includes("proveedores") && !esAdmin,
    evaluador,
    token,
    correo,
    grupos,
    esAdmin,
    esSuperadmin,
    listo,
    entrarConCuenta,
    cambiarContrasena,
    salir,
  };
}

/**
 * Un token que todavía sirve para llamar a la API.
 *
 * `useSesion` renueva el de Cognito al montarse, y dura una hora: con el
 * editor del catálogo abierto más de eso, guardar daba 401 y la única salida
 * —recargar la página— perdía lo tecleado. Esto se llama justo antes de cada
 * llamada del panel y renueva sin tocar el estado de React, así que el
 * borrador sigue ahí. Si otra pestaña ya lo renovó, se usa ese.
 */
export async function tokenVigente(actual: string): Promise<string> {
  const guardado = localStorage.getItem(CLAVE_TOKEN);
  const vence = Number(localStorage.getItem(CLAVE_VENCE) ?? 0);
  if (guardado && vence > Date.now() + 60_000) return guardado;
  const refresco = localStorage.getItem(CLAVE_REFRESCO);
  if (!refresco) return actual;
  try {
    const t = await refrescar(refresco);
    localStorage.setItem(CLAVE_TOKEN, t.idToken);
    localStorage.setItem(CLAVE_VENCE, String(t.vence));
    return t.idToken;
  } catch {
    // Sin red o con el refresco vencido: que la API diga lo que tenga que decir.
    return actual;
  }
}

export { hayCognito };
