"use client";

import type {
  CatalogoAdmin,
  DatosDe,
  EstadoPublicacion,
  ImagenAutorizada,
  RegistroGuardado,
  SolicitudImagen,
} from "../../../compartido/catalogo-admin";
import type { ErrorCampo, TipoRegistro } from "../../../compartido/validar-catalogo";
import { pedir } from "@/lib/api";
import { tokenVigente } from "@/lib/sesion";

/**
 * Cliente de `/admin/*`: el catálogo de la tienda visto desde el panel.
 *
 * Los tipos vienen de `compartido/` —el mismo contrato que usa la Lambda—,
 * pero solo como tipos: el vocabulario y las reglas los pone el servidor.
 */

export type { CatalogoAdmin, EstadoPublicacion, TipoRegistro, ErrorCampo, DatosDe };

/**
 * Copia en memoria para ir y volver entre la lista y el editor sin bajar el
 * catálogo otra vez. Treinta segundos: más que eso y el panel enseñaría algo
 * que otro administrador ya cambió.
 */
let copia: { datos: CatalogoAdmin; hasta: number } | null = null;

export function olvidarCopia() {
  copia = null;
}

export async function leerCatalogoAdmin(token: string, fresco = false): Promise<CatalogoAdmin> {
  if (!fresco && copia && copia.hasta > Date.now()) return copia.datos;
  const datos = await pedir<CatalogoAdmin>("/admin/catalogo", {
    token: await tokenVigente(token),
    msCorte: 30000,
  });
  copia = { datos, hasta: Date.now() + 30_000 };
  return datos;
}

/** Error de guardado con los campos que no pasaron, para pintarlos en el formulario. */
export class ErrorGuardado extends Error {
  constructor(
    mensaje: string,
    readonly errores: ErrorCampo[] = [],
    readonly estado = 0,
  ) {
    super(mensaje);
  }
}

const BASE = process.env.NEXT_PUBLIC_API ?? "";

/**
 * Guardar y borrar necesitan la respuesta completa en caso de error —los
 * campos marcados de un 422, el 409 de «alguien más lo cambió»—, que `pedir`
 * resume en un mensaje. Por eso van con su propio `fetch`.
 */
async function escribir<T>(ruta: string, token: string, init: RequestInit): Promise<T> {
  if (!BASE) throw new ErrorGuardado("La app no tiene API configurada");
  const vigente = await tokenVigente(token);
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${BASE}${ruta}`, {
      ...init,
      signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${vigente}` },
    });
    const cuerpo = (await res.json().catch(() => null)) as
      | (T & { error?: string; errores?: ErrorCampo[] })
      | null;
    if (!res.ok) {
      throw new ErrorGuardado(
        cuerpo?.error ?? `El servidor respondió ${res.status}`,
        cuerpo?.errores ?? [],
        res.status,
      );
    }
    olvidarCopia();
    return cuerpo as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ErrorGuardado("El servidor no respondió a tiempo. Revisa la conexión y vuelve a guardar.");
    }
    throw e;
  } finally {
    clearTimeout(corte);
  }
}

export function guardarRegistro<T extends TipoRegistro>(
  token: string,
  tipo: T,
  id: string,
  datos: DatosDe<T>,
  huella: string | null,
) {
  return escribir<RegistroGuardado>(
    `/admin/catalogo/${tipo}/${encodeURIComponent(id)}`,
    token,
    { method: "PUT", body: JSON.stringify({ datos, huella }) },
  );
}

export function borrarRegistro(token: string, tipo: TipoRegistro, id: string, huella: string) {
  return escribir<{ borrado: true }>(
    `/admin/catalogo/${tipo}/${encodeURIComponent(id)}?huella=${encodeURIComponent(huella)}`,
    token,
    { method: "DELETE" },
  );
}

export async function estadoPublicacion(token: string) {
  return pedir<EstadoPublicacion>("/admin/publicacion", { token: await tokenVigente(token) });
}

export async function publicar(token: string) {
  return pedir<EstadoPublicacion>("/admin/publicar", { method: "POST", token: await tokenVigente(token) });
}

export async function autorizarImagen(token: string, solicitud: SolicitudImagen) {
  return pedir<ImagenAutorizada>("/admin/imagenes", {
    method: "POST",
    token: await tokenVigente(token),
    body: JSON.stringify(solicitud),
  });
}

/** Sube la foto directo a S3, con las cabeceras que el servidor firmó. */
export async function subirImagen(autorizada: ImagenAutorizada, blob: Blob): Promise<void> {
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(autorizada.url, {
      method: "PUT",
      body: blob,
      headers: autorizada.cabeceras,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`S3 rechazó la foto (${res.status})`);
  } finally {
    clearTimeout(corte);
  }
}

/**
 * Baja uno de los CSV del catálogo, tal como está en la tabla. Es el mismo
 * formato de `catalogo/*.csv`: se abre en Excel y, puesto en esa carpeta,
 * vuelve a cargar sin perder nada.
 */
export async function exportarCsv(
  token: string,
  archivo: "productos" | "marcas" | "sets" | "lotes",
): Promise<void> {
  if (!BASE) throw new Error("La app no tiene API configurada");
  const res = await fetch(`${BASE}/admin/exportar?archivo=${archivo}`, {
    headers: { authorization: `Bearer ${await tokenVigente(token)}` },
  });
  if (!res.ok) throw new Error(`No se pudo exportar (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${archivo}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const CDN = (process.env.NEXT_PUBLIC_IMAGENES ?? "").replace(/\/+$/, "");

/** La URL pública de una foto del catálogo; sin CDN configurado, ninguna. */
export function urlImagen(clave: string): string | null {
  return CDN ? `${CDN}/${clave}` : null;
}

export const pesos = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
