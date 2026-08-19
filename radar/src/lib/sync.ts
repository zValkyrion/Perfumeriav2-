"use client";

import {
  borrarProveedor,
  fotosDe,
  guardarFoto,
  guardarProveedor,
  leerProveedor,
  listarProveedores,
} from "@/lib/almacen";
import { listarRemoto, subirFoto, subirProveedor, urlDeSubida } from "@/lib/api";
import { normalizar, type Proveedor } from "@/lib/tipos";

/**
 * Sincronización con AWS.
 *
 * El teléfono es la fuente de verdad mientras el equipo está en la calle: aquí
 * solo se empuja lo pendiente. Tres decisiones que sostienen todo:
 *
 * 1. **Cada ficha se sube por separado y se marca en cuanto responde.** Si la
 *    señal se cae en la número siete, las seis anteriores ya están a salvo; el
 *    siguiente intento arranca donde se quedó, no desde cero.
 * 2. **Un fallo no detiene la fila.** Se acumulan los errores y se reportan al
 *    final, porque una ficha corrupta no puede bloquear a las otras veinte.
 * 3. **Las fotos van después de su ficha.** Si la ficha nunca llegó, subir sus
 *    fotos sería dejar huérfanos en S3 que nadie va a limpiar.
 */

export type ResultadoSync = {
  fichas: number;
  fotos: number;
  fallos: string[];
};

/**
 * Sincroniza sin que nadie esté mirando ni esperando.
 *
 * Se dispara al cerrar una ficha y al abrir la app. No se espera el resultado a
 * propósito: en la calle, con señal mala, subir tres fotos puede tardar un
 * minuto y bloquear al capturista mientras tanto sería peor que el problema que
 * resuelve. Si falla, la ficha se queda marcada como pendiente y la barra de la
 * lista lo sigue diciendo — no se pierde nada, solo se reintenta después.
 */
export function sincronizarDeFondo(token: string | null): void {
  if (!token) return;
  void sincronizar(token).catch(() => {
    // El estado pendiente ya es el aviso; no hay a quién avisar aquí.
  });
}

export async function sincronizar(
  token: string,
  alProgreso?: (hecho: number, total: number) => void,
): Promise<ResultadoSync> {
  const todos = await listarProveedores();
  const pendientes = todos.filter((p) => p.estado !== "sincronizado");
  const resultado: ResultadoSync = { fichas: 0, fotos: 0, fallos: [] };

  let hecho = 0;
  for (const proveedor of pendientes) {
    try {
      await subirProveedor(token, proveedor);
      await guardarProveedor({ ...proveedor, estado: "sincronizado" });
      resultado.fichas++;

      resultado.fotos += await subirFotosDe(token, proveedor);
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "error desconocido";
      resultado.fallos.push(`${proveedor.nombre || "Sin nombre"}: ${motivo}`);
    }
    alProgreso?.(++hecho, pendientes.length);
  }

  return resultado;
}

async function subirFotosDe(token: string, proveedor: Proveedor): Promise<number> {
  const fotos = await fotosDe(proveedor.id);
  let subidas = 0;

  for (const foto of fotos) {
    if (foto.subida) continue;
    const { url } = await urlDeSubida(token, {
      proveedorId: proveedor.id,
      fotoId: foto.id,
      tipo: foto.tipo,
      contentType: foto.blob.type || "image/webp",
      tomadaEn: foto.tomadaEn,
      lat: foto.lat,
      lng: foto.lng,
    });
    await subirFoto(url, foto.blob);
    // La marca va después de que S3 confirma: si se corta antes, la próxima
    // vuelta la reintenta en vez de darla por subida.
    await guardarFoto({ ...foto, subida: true });
    subidas++;
  }

  return subidas;
}

/**
 * Trae del servidor lo que no está en este teléfono.
 *
 * Sirve para dos casos reales: un compañero se suma a la gira con el teléfono en
 * blanco, o alguien pierde el suyo y hay que reconstruirlo. Gana siempre la
 * versión más reciente por `actualizadoEn` — con dos personas editando la misma
 * ficha desde ciudades distintas, la última en tocarla es la que sabe más.
 *
 * Las fotos NO bajan: viven en S3 y pesan; la ficha de un dispositivo nuevo
 * muestra los datos y las fotos se consultan desde el panel.
 */
/** Lo que cambió al bajar: cuántas llegaron y cuántas desaparecieron. */
export type ResultadoDescarga = { traidos: number; borrados: number };

export async function descargar(token: string): Promise<ResultadoDescarga> {
  const { proveedores } = await listarRemoto(token);
  let traidos = 0;

  for (const remoto of proveedores) {
    if (!remoto?.id) continue;
    const local = await leerProveedor(remoto.id);
    if (local && local.actualizadoEn >= remoto.actualizadoEn) continue;
    await guardarProveedor({ ...normalizar(remoto), estado: "sincronizado" });
    traidos++;
  }

  const borrados = await propagarBorrados(proveedores.map((p) => p.id));
  return { traidos, borrados };
}

/**
 * Borra en este teléfono lo que ya no está en el servidor.
 *
 * Sin esto, un borrado no viajaba: quien eliminaba una ficha la veía desaparecer
 * de su teléfono, pero seguía viva para siempre en los de sus compañeros. Cada
 * uno acababa mirando una lista distinta, que es lo contrario de "todos ven lo de
 * todos".
 *
 * **Solo se tocan las fichas marcadas `sincronizado`**: esas estuvieron en el
 * servidor alguna vez, así que su ausencia significa que alguien las borró. Una
 * ficha en borrador o pendiente nunca llegó a subir; que no esté allá arriba es
 * lo normal, y borrarla aquí destruiría el trabajo de la mañana.
 */
async function propagarBorrados(idsRemotos: string[]): Promise<number> {
  const enServidor = new Set(idsRemotos);
  const locales = await listarProveedores();
  let borrados = 0;

  for (const local of locales) {
    if (local.estado !== "sincronizado") continue;
    if (enServidor.has(local.id)) continue;
    await borrarProveedor(local.id);
    borrados++;
  }

  return borrados;
}
