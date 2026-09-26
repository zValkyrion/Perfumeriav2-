"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  ErrorCognito,
  confirmarRegistro,
  fijarNuevaContrasena,
  hayCognito,
  iniciarSesion,
  pedirRecuperacion,
  reenviarCodigo,
  refrescar,
  registrar,
  restablecerContrasena,
  type Tokens,
} from "./cognito";

/**
 * La sesión del sitio, compartida por la tienda y el panel.
 *
 * Una sola cuenta para todos: clientes, equipo y admins entran por la misma
 * puerta y lo que cambia es el **grupo** que trae el token. `clientes` compra;
 * `proveedores` abre además el panel de proveedores; `admins` abre todo el
 * panel, incluido el catálogo de la tienda.
 *
 * Las dos apps se sirven del mismo origen (`/` y `/radar`), así que comparten
 * `localStorage`: quien inicia sesión aquí entra también allá sin volver a
 * escribir nada. Las claves llevan el prefijo `radar:` por razones históricas
 * —el panel existió primero— y se conservan a propósito: renombrarlas cerraría
 * la sesión de todos los teléfonos que ya están en la calle.
 */

const CLAVE_TOKEN = "radar:token";
const CLAVE_REFRESCO = "radar:refresco";
const CLAVE_VENCE = "radar:vence";
const CLAVE_EVALUADOR = "radar:evaluador";

export function hayLogin(): boolean {
  return hayCognito();
}

export type Perfil = {
  correo: string;
  nombre: string;
  grupos: string[];
  /**
   * El identificador estable de Cognito, el mismo con el que la API guarda el
   * carrito. Se usa el `sub` y no el correo: el correo se puede cambiar y el
   * `sub` no cambia nunca.
   */
  sub: string;
};

/**
 * Lee el token sin verificar la firma: aquí solo decide qué pintar.
 *
 * **Quien verifica de verdad es la API**, contra las claves públicas de Cognito.
 * Editar esto en el navegador no abre ninguna puerta.
 */
export function leerPerfil(idToken: string): Perfil | null {
  try {
    const carga = JSON.parse(
      atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return {
      correo: carga.email ?? "",
      nombre: carga.name ?? carga.email ?? "",
      grupos: carga["cognito:groups"] ?? [],
      sub: carga.sub ?? "",
    };
  } catch {
    return null;
  }
}

export function esAdmin(perfil: Perfil | null): boolean {
  return perfil?.grupos.includes("admins") ?? false;
}

/** ¿Su cuenta abre el panel? Admins y equipo de proveedores. */
export function puedeVerPanel(perfil: Perfil | null): boolean {
  if (!perfil) return false;
  return esAdmin(perfil) || perfil.grupos.includes("proveedores");
}

/* ── Estado compartido ──────────────────────────────────────────────────── */

/**
 * Todas las copias de `useSesion` miran el mismo perfil.
 *
 * El hook se usa en varios sitios a la vez —la cuenta, la cabecera, el
 * sincronizador del carrito— y cada uno tiene su `useState`. Al entrar o salir
 * desde una pantalla, las demás se enteran en el acto: si no, el botón del
 * panel no aparecía hasta recargar, y el carrito de quien acababa de salir se
 * quedaba en el navegador.
 */
const oyentes = new Set<() => void>();

function avisar() {
  for (const oyente of oyentes) oyente();
}

/** El perfil se recalcula solo cuando cambia el token, no en cada render. */
let cache: { token: string | null; perfil: Perfil | null } = { token: null, perfil: null };

function perfilGuardado(): Perfil | null {
  let token: string | null = null;
  try {
    token = localStorage.getItem(CLAVE_TOKEN);
  } catch {
    // Almacenamiento bloqueado: se comporta como un visitante.
  }
  if (token !== cache.token) cache = { token, perfil: token ? leerPerfil(token) : null };
  return cache.perfil;
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  // Otra pestaña entró o salió: esta se entera sin recargar.
  const alCambiar = (e: StorageEvent) => {
    if (e.key === null || e.key === CLAVE_TOKEN) oyente();
  };
  window.addEventListener("storage", alCambiar);
  return () => {
    oyentes.delete(oyente);
    window.removeEventListener("storage", alCambiar);
  };
}

function guardar(t: Tokens): Perfil {
  const p = leerPerfil(t.idToken);
  if (!p) throw new ErrorCognito("La sesión llegó dañada", "SinSesion");
  localStorage.setItem(CLAVE_TOKEN, t.idToken);
  if (t.refreshToken) localStorage.setItem(CLAVE_REFRESCO, t.refreshToken);
  localStorage.setItem(CLAVE_VENCE, String(t.vence));
  // El panel firma las fichas con este nombre.
  localStorage.setItem(CLAVE_EVALUADOR, p.nombre);
  avisar();
  return p;
}

function borrar() {
  for (const c of [CLAVE_TOKEN, CLAVE_REFRESCO, CLAVE_VENCE, CLAVE_EVALUADOR]) {
    localStorage.removeItem(c);
  }
  avisar();
}

/**
 * Un token que todavía sirve para llamar a la API, o `null` sin sesión.
 *
 * El de identidad dura una hora; se renueva con el de refresco justo antes de
 * cada llamada si está por vencer. También es lo que hace aparecer un grupo
 * recién asignado: el token nuevo ya lo trae.
 */
let renovando: Promise<string | null> | null = null;

export async function tokenVigente(): Promise<string | null> {
  const guardado = localStorage.getItem(CLAVE_TOKEN);
  if (!guardado) return null;
  const vence = Number(localStorage.getItem(CLAVE_VENCE) ?? 0);
  if (vence > Date.now() + 60_000) return guardado;
  const refresco = localStorage.getItem(CLAVE_REFRESCO);
  // Sesión del código de equipo del panel: no hay nada que renovar.
  if (!refresco) return guardado;

  // Varias llamadas a la vez comparten una sola renovación.
  renovando ??= refrescar(refresco)
    .then((t) => {
      guardar(t);
      return t.idToken;
    })
    .catch((e) => {
      // El refresco venció o lo revocaron: la sesión se acabó de verdad. Sin
      // red, en cambio, se sigue con lo que hay y la API dirá lo que tenga que
      // decir.
      if (e instanceof ErrorCognito && e.tipo === "NotAuthorizedException") {
        borrar();
        return null;
      }
      return guardado;
    })
    .finally(() => {
      renovando = null;
    });
  return renovando;
}

/* ── Acciones ───────────────────────────────────────────────────────────── */

export type Reto = { sesion: string; correo: string };

export type ResultadoEntrar =
  | { ok: true; perfil: Perfil }
  | { ok: false; error: string; sinConfirmar?: boolean }
  | { nuevaContrasena: Reto };

type Resultado = { ok: true; perfil: Perfil } | { ok: false; error: string };
type Hecho = { ok: true } | { ok: false; error: string };

function fallo(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : "Algo salió mal" };
}

async function entrar(correo: string, contrasena: string): Promise<ResultadoEntrar> {
  try {
    const r = await iniciarSesion(correo.trim(), contrasena);
    if (r.tipo === "nueva_contrasena") {
      return { nuevaContrasena: { sesion: r.sesion, correo: r.correo } };
    }
    return { ok: true, perfil: guardar(r.tokens) };
  } catch (e) {
    return {
      ...fallo(e),
      sinConfirmar: e instanceof ErrorCognito && e.tipo === "UserNotConfirmedException",
    };
  }
}

async function cambiarContrasena(reto: Reto, nueva: string): Promise<Resultado> {
  try {
    return { ok: true, perfil: guardar(await fijarNuevaContrasena(reto.correo, reto.sesion, nueva)) };
  } catch (e) {
    return fallo(e);
  }
}

async function crearCuenta(nombre: string, correo: string, contrasena: string): Promise<Hecho> {
  try {
    await registrar(nombre.trim(), correo.trim(), contrasena);
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
}

/**
 * Confirma el correo y, si se tiene la contraseña a mano, entra de una vez.
 *
 * La contraseña solo vive en la memoria de la pantalla de registro: quien se
 * registra y confirma sin cerrar la página no tiene que volver a escribirla. Si
 * recargó en medio, se confirma igual y se le pide entrar.
 */
async function confirmar(
  correo: string,
  codigo: string,
  contrasena?: string,
): Promise<Resultado | { ok: true; perfil: null }> {
  try {
    await confirmarRegistro(correo.trim(), codigo.trim());
  } catch (e) {
    return fallo(e);
  }
  if (!contrasena) return { ok: true, perfil: null };
  const r = await entrar(correo, contrasena);
  return "ok" in r && r.ok ? r : { ok: true, perfil: null };
}

async function reenviar(correo: string): Promise<Hecho> {
  try {
    await reenviarCodigo(correo.trim());
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
}

async function recuperar(correo: string): Promise<Hecho> {
  try {
    await pedirRecuperacion(correo.trim());
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
}

/** Fija la contraseña nueva con el código del correo y entra con ella. */
async function restablecer(
  correo: string,
  codigo: string,
  nueva: string,
): Promise<Resultado | { ok: true; perfil: null }> {
  try {
    await restablecerContrasena(correo.trim(), codigo.trim(), nueva);
  } catch (e) {
    return fallo(e);
  }
  const r = await entrar(correo, nueva);
  return "ok" in r && r.ok ? r : { ok: true, perfil: null };
}

const acciones = {
  entrar,
  cambiarContrasena,
  crearCuenta,
  confirmar,
  reenviar,
  recuperar,
  restablecer,
  salir: borrar,
};

export type Sesion = typeof acciones & {
  perfil: Perfil | null;
  /** `false` hasta leer `localStorage`: antes no se sabe si hay sesión. */
  listo: boolean;
};

export function useSesion(): Sesion {
  // En el servidor —y durante la hidratación— no hay `localStorage`: el
  // `undefined` es lo que dice «todavía no se sabe».
  const perfil = useSyncExternalStore<Perfil | null | undefined>(
    suscribir,
    perfilGuardado,
    () => undefined,
  );

  // Renueva al abrir si ya venció. Así, además, los grupos del perfil son los
  // de ahora y no los de hace una hora.
  useEffect(() => {
    tokenVigente().catch(() => {});
  }, []);

  return { perfil: perfil ?? null, listo: perfil !== undefined, ...acciones };
}
