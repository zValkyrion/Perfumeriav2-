"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  ErrorCognito,
  actualizarAtributos,
  borrarAtributos,
  cambiarContrasenaConSesion,
  cerrarSesionEnTodos,
  eliminarCuenta,
  reenviarCodigoCorreo,
  verificarCorreo,
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
// El de acceso lleva su propia fecha: el panel renueva el de identidad y
// `radar:vence` sin saber de este, así que no se puede fiar de ella.
const CLAVE_ACCESO = "radar:acceso";
const CLAVE_ACCESO_VENCE = "radar:acceso_vence";

export function hayLogin(): boolean {
  return hayCognito();
}

export type Perfil = {
  correo: string;
  nombre: string;
  grupos: string[];
  /** WhatsApp a 10 dígitos, sin el +52. Vacío si no lo ha dado. */
  telefono: string;
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
      telefono: String(carga.phone_number ?? "").replace(/^\+52/, ""),
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
  if (t.accessToken) {
    localStorage.setItem(CLAVE_ACCESO, t.accessToken);
    localStorage.setItem(CLAVE_ACCESO_VENCE, String(t.vence));
  }
  // El panel firma las fichas con este nombre.
  localStorage.setItem(CLAVE_EVALUADOR, p.nombre);
  avisar();
  return p;
}

function borrar() {
  for (const c of [
    CLAVE_TOKEN,
    CLAVE_REFRESCO,
    CLAVE_VENCE,
    CLAVE_EVALUADOR,
    CLAVE_ACCESO,
    CLAVE_ACCESO_VENCE,
  ]) {
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
let renovando: Promise<Tokens | null> | null = null;

/**
 * Pide tokens nuevos con el de refresco. `null` si no se pudo.
 *
 * Varias llamadas a la vez comparten una sola renovación. Si el refresco venció
 * o lo revocaron, la sesión se acabó de verdad y se cierra; sin red, en cambio,
 * se sigue con lo que hay.
 */
function renovar(): Promise<Tokens | null> {
  const refresco = localStorage.getItem(CLAVE_REFRESCO);
  // Sesión del código de equipo del panel: no hay nada que renovar.
  if (!refresco) return Promise.resolve(null);

  renovando ??= refrescar(refresco)
    .then((t) => {
      guardar(t);
      return t;
    })
    .catch((e) => {
      if (e instanceof ErrorCognito && e.tipo === "NotAuthorizedException") borrar();
      return null;
    })
    .finally(() => {
      renovando = null;
    });
  return renovando;
}

export async function tokenVigente(): Promise<string | null> {
  const guardado = localStorage.getItem(CLAVE_TOKEN);
  if (!guardado) return null;
  const vence = Number(localStorage.getItem(CLAVE_VENCE) ?? 0);
  if (vence > Date.now() + 60_000) return guardado;
  const t = await renovar();
  if (t) return t.idToken;
  // Sin red se sigue con el que había; si la sesión se cerró, ya no hay token.
  return localStorage.getItem(CLAVE_TOKEN);
}

/** El token de acceso vigente, el que pide Cognito para tocar la cuenta. */
async function accesoVigente(): Promise<string> {
  const guardado = localStorage.getItem(CLAVE_ACCESO);
  const vence = Number(localStorage.getItem(CLAVE_ACCESO_VENCE) ?? 0);
  // El panel inicia y cierra sesión sin tocar esta clave: lo guardado puede ser
  // de otra persona que usó este navegador. Solo vale si es de la cuenta actual.
  const propio = guardado !== null && leerPerfil(guardado)?.sub === perfilGuardado()?.sub;
  if (guardado && propio && vence > Date.now() + 60_000) return guardado;
  const t = await renovar();
  if (t?.accessToken) return t.accessToken;
  throw new ErrorCognito("Tu sesión venció. Vuelve a iniciar sesión.", "SinSesion");
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

/* ── La cuenta, con sesión iniciada ─────────────────────────────────────── */

/**
 * Hace algo con el token de acceso y trae un token de identidad nuevo, para
 * que el perfil que se pinta refleje el cambio en el acto.
 */
async function conAcceso(fn: (acceso: string) => Promise<void>): Promise<Hecho> {
  try {
    await fn(await accesoVigente());
    await renovar();
    return { ok: true };
  } catch (e) {
    return fallo(e);
  }
}

/** Nombre y WhatsApp. El teléfono vacío se borra de la cuenta. */
async function actualizarPerfil(datos: { nombre: string; telefono: string }): Promise<Hecho> {
  const nombre = datos.nombre.trim();
  const telefono = datos.telefono.replace(/\D/g, "");
  if (!nombre) return { ok: false, error: "Escribe tu nombre" };
  if (telefono && telefono.length !== 10) {
    return { ok: false, error: "El WhatsApp debe tener 10 dígitos" };
  }
  return conAcceso(async (acceso) => {
    await actualizarAtributos(acceso, [{ Name: "name", Value: nombre }]);
    if (telefono) {
      await actualizarAtributos(acceso, [{ Name: "phone_number", Value: `+52${telefono}` }]);
    } else if (perfilGuardado()?.telefono) {
      await borrarAtributos(acceso, ["phone_number"]);
    }
  });
}

/**
 * Pide cambiar el correo. Llega un código al correo nuevo, y hasta confirmarlo
 * se sigue entrando con el de antes.
 */
function cambiarCorreo(nuevo: string): Promise<Hecho> {
  return conAcceso((acceso) =>
    actualizarAtributos(acceso, [{ Name: "email", Value: nuevo.trim() }]),
  );
}

function confirmarCorreo(codigo: string): Promise<Hecho> {
  return conAcceso((acceso) => verificarCorreo(acceso, codigo.trim()));
}

function reenviarCodigoDeCorreo(): Promise<Hecho> {
  return conAcceso((acceso) => reenviarCodigoCorreo(acceso));
}

async function cambiarMiContrasena(actual: string, nueva: string): Promise<Hecho> {
  const r = await conAcceso((acceso) => cambiarContrasenaConSesion(acceso, actual, nueva));
  // Aquí «no autorizado» solo puede ser una cosa.
  if (!r.ok && r.error === "Correo o contraseña incorrectos") {
    return { ok: false, error: "La contraseña actual no es correcta" };
  }
  return r;
}

/** Cierra la sesión en todos los dispositivos, este incluido. */
async function salirDeTodos(): Promise<Hecho> {
  try {
    await cerrarSesionEnTodos(await accesoVigente());
  } catch (e) {
    return fallo(e);
  }
  borrar();
  return { ok: true };
}

/**
 * Elimina la cuenta. Pide la contraseña otra vez: es lo único que no se puede
 * deshacer, y una sesión olvidada abierta en otro equipo no debe bastar.
 *
 * Los datos de la tienda en el servidor los borra antes quien llama
 * (`borrarDatosRemotos`), porque después ya no habría token con qué hacerlo.
 */
async function eliminarMiCuenta(
  contrasena: string,
  antes?: () => Promise<unknown>,
): Promise<Hecho> {
  const correo = perfilGuardado()?.correo;
  if (!correo) return { ok: false, error: "No hay sesión" };
  try {
    const r = await iniciarSesion(correo, contrasena);
    if (r.tipo !== "entrado") return { ok: false, error: "No se pudo comprobar la contraseña" };
    guardar(r.tokens);
    await antes?.();
    await eliminarCuenta(r.tokens.accessToken);
  } catch (e) {
    const f = fallo(e);
    return f.error === "Correo o contraseña incorrectos"
      ? { ok: false, error: "La contraseña no es correcta" }
      : f;
  }
  borrar();
  return { ok: true };
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
  actualizarPerfil,
  cambiarCorreo,
  confirmarCorreo,
  reenviarCodigoDeCorreo,
  cambiarMiContrasena,
  salirDeTodos,
  eliminarMiCuenta,
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
