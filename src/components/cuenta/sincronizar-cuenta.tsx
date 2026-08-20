"use client";

import { useEffect, useRef } from "react";
import {
  fusionarFavoritos,
  fusionarItems,
  guardarCarritoRemoto,
  haySincronizacion,
  leerCarritoRemoto,
} from "@/lib/cuenta-remota";
import { useSesion } from "@/lib/sesion";
import { useTienda } from "@/store/tienda";

/** Espera antes de subir. Se teclea una cantidad y se corrige dos veces. */
const MS_ESPERA = 1500;

/**
 * Mantiene el carrito de esta pestaña y el de la cuenta en el mismo sitio.
 *
 * No pinta nada: vive en el layout para estar montado en toda la tienda, porque
 * el carrito se toca desde el catálogo, la ficha de producto y el drawer, no
 * solo desde `/carrito`.
 *
 * ## Qué gana quién, al entrar
 *
 * Tres casos, y la diferencia entre ellos es lo único difícil de esto:
 *
 * 1. **Primera vez que esta cuenta entra en este navegador** — el carrito local
 *    es anónimo y el de la cuenta es de otro aparato. Se **fusiona sumando**
 *    (ver `fusionarItems`): quien metió tres frascos sin haber entrado no espera
 *    perderlos, y quien tenía un carrito guardado tampoco.
 * 2. **Ya se había sincronizado y nadie más lo tocó** — el carrito local *es* el
 *    de la cuenta, más lo que se haya hecho desde entonces. Manda el local. Aquí
 *    volver a fusionar sería el error: sumaría el carrito consigo mismo y las
 *    cantidades se duplicarían en cada recarga.
 * 3. **Ya se había sincronizado y otro aparato escribió después** — gana el
 *    servidor, que trae lo más reciente.
 *
 * El `sello` —el `actualizadoEn` que devuelve el servidor— es lo que distingue
 * el caso 2 del 3.
 *
 * ## Nada de esto bloquea la compra
 *
 * Si no hay red, si la sesión venció o si la API no responde, se falla en
 * silencio: el carrito sigue en `localStorage` y la tienda funciona igual.
 * Avisar de un reintento fallido a quien está eligiendo un perfume sería ruido
 * sobre un problema que no es suyo.
 */
export function SincronizarCuenta() {
  const sesion = useSesion();
  const hidratado = useTienda((s) => s.hidratado);
  const adoptarRemoto = useTienda((s) => s.adoptarRemoto);
  const marcarSello = useTienda((s) => s.marcarSello);
  const olvidarCuenta = useTienda((s) => s.olvidarCuenta);

  const cuenta = sesion.perfil?.sub || null;
  /** Para qué cuenta ya se reconcilió en esta pestaña. */
  const reconciliadoPara = useRef<string | null>(null);
  /**
   * Activo mientras se adopta el resultado de la reconciliación.
   *
   * Ese cambio de estado también lo ve la suscripción de abajo, que lo tomaría
   * por una edición del usuario y lo subiría otra vez — una petición de más en
   * cada inicio de sesión, con exactamente el mismo contenido que se acaba de
   * subir. Zustand avisa a sus suscriptores dentro del `set`, así que basta con
   * la bandera puesta alrededor.
   */
  const adoptando = useRef(false);

  // ── Al cerrar sesión, el carrito se va con quien se fue ──────────────────
  const cuentaPrevia = useRef<string | null>(null);
  useEffect(() => {
    if (cuentaPrevia.current && !cuenta) {
      reconciliadoPara.current = null;
      olvidarCuenta();
    }
    cuentaPrevia.current = cuenta;
  }, [cuenta, olvidarCuenta]);

  // ── Reconciliación al entrar ────────────────────────────────────────────
  useEffect(() => {
    if (!haySincronizacion() || !hidratado || !cuenta) return;
    if (reconciliadoPara.current === cuenta) return;
    reconciliadoPara.current = cuenta;

    let vivo = true;
    (async () => {
      try {
        const remoto = await leerCarritoRemoto();
        if (!vivo) return;

        const local = useTienda.getState();
        const marca = local.sincronizado;
        const primeraVez = marca?.cuenta !== cuenta;
        const otroAparatoEscribio =
          !primeraVez && remoto.actualizadoEn !== marca!.sello;

        let resultado;
        if (primeraVez) {
          resultado = {
            carrito: fusionarItems(local.carrito, remoto.carrito),
            guardados: fusionarItems(local.guardados, remoto.guardados),
            favoritos: fusionarFavoritos(local.favoritos, remoto.favoritos),
          };
        } else if (otroAparatoEscribio) {
          resultado = {
            carrito: remoto.carrito,
            guardados: remoto.guardados,
            favoritos: remoto.favoritos,
          };
        } else {
          resultado = {
            carrito: local.carrito,
            guardados: local.guardados,
            favoritos: local.favoritos,
          };
        }

        adoptando.current = true;
        adoptarRemoto(resultado, { cuenta, sello: remoto.actualizadoEn });
        adoptando.current = false;

        const guardado = await guardarCarritoRemoto(resultado);
        if (vivo) marcarSello(guardado.actualizadoEn);
      } catch {
        // Sin red o sin permiso: se reintenta en la siguiente visita. Quedarse
        // con el carrito local es exactamente lo que hacía la tienda antes.
        if (vivo) reconciliadoPara.current = null;
      }
    })();

    return () => {
      vivo = false;
    };
  }, [hidratado, cuenta, adoptarRemoto, marcarSello]);

  // ── Subir los cambios posteriores ───────────────────────────────────────
  useEffect(() => {
    if (!haySincronizacion() || !cuenta) return;

    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const desuscribir = useTienda.subscribe((estado, anterior) => {
      const cambio =
        estado.carrito !== anterior.carrito ||
        estado.guardados !== anterior.guardados ||
        estado.favoritos !== anterior.favoritos;
      // La reconciliación todavía no terminó: subir ahora pisaría el carrito del
      // servidor con el de esta pestaña, justo lo que la reconciliación evita.
      if (!cambio || adoptando.current || reconciliadoPara.current !== cuenta) return;

      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        const s = useTienda.getState();
        guardarCarritoRemoto({
          carrito: s.carrito,
          guardados: s.guardados,
          favoritos: s.favoritos,
        })
          // El sello se mueve con cada subida. Sin esto, la próxima visita vería
          // el servidor "más nuevo" que su última marca y creería que escribió
          // otro aparato, tirando los cambios de este.
          .then((r) => marcarSello(r.actualizadoEn))
          .catch(() => {
            // En silencio: el carrito de este navegador no se toca.
          });
      }, MS_ESPERA);
    });

    return () => {
      clearTimeout(temporizador);
      desuscribir();
    };
  }, [cuenta, marcarSello]);

  return null;
}
