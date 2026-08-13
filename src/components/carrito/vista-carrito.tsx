"use client";

import Link from "next/link";
import { Bookmark, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Imagen } from "@/components/comunes/imagen";
import { Precio, PrecioAnterior } from "@/components/comunes/precio";
import { Contenedor } from "@/components/comunes/layout";
import { GridSkeleton } from "@/components/producto/grid-productos";
import { resumenCarrito } from "@/lib/carrito";
import { useTienda } from "@/store/tienda";
import { BarraEscalon } from "./barra-escalon";
import { ResumenPedido } from "./resumen-pedido";
import { Stepper } from "./stepper";

export function VistaCarrito() {
  const hidratado = useTienda((s) => s.hidratado);
  const carrito = useTienda((s) => s.carrito);
  const guardados = useTienda((s) => s.guardados);
  const cupon = useTienda((s) => s.cupon);
  const cambiarCantidad = useTienda((s) => s.cambiarCantidad);
  const quitar = useTienda((s) => s.quitar);
  const guardarParaDespues = useTienda((s) => s.guardarParaDespues);
  const regresarAlCarrito = useTienda((s) => s.regresarAlCarrito);
  const quitarGuardado = useTienda((s) => s.quitarGuardado);

  const resumen = resumenCarrito(carrito, cupon);
  const resumenGuardados = resumenCarrito(guardados, null);

  // Hasta que localStorage se lee, el servidor y el cliente deben coincidir.
  if (!hidratado) {
    return (
      <Contenedor className="py-10">
        <div className="h-9 w-48 rounded bg-white/5" />
        <div className="mt-8">
          <GridSkeleton cantidad={3} />
        </div>
      </Contenedor>
    );
  }

  if (resumen.vacio) {
    return (
      <Contenedor className="py-16 lg:py-24">
        <div className="mx-auto max-w-md text-center">
          <div className="border-border-strong text-fg-subtle mx-auto mb-6 grid size-20 place-items-center rounded-full border border-dashed">
            <ShoppingBag size={30} aria-hidden />
          </div>
          <h1 className="font-display mb-3 text-3xl">Tu carrito está vacío</h1>
          <p className="text-fg-muted mb-7 text-[15px] leading-relaxed">
            Desde 3 piezas bajas 15% y el envío corre por nuestra cuenta. Con 12
            llegas a precio de distribuidor.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild variant="gold" size="touch-lg">
              <Link href="/catalogo">Ver el catálogo</Link>
            </Button>
            <Button asChild variant="goldOutline" size="touch-lg">
              <Link href="/lotes">Ver lotes de mayoreo</Link>
            </Button>
          </div>
        </div>
      </Contenedor>
    );
  }

  return (
    <Contenedor className="py-6 lg:py-10">
      <h1 className="font-display mb-6 text-[32px] leading-tight tracking-tight lg:text-[42px]">
        Tu carrito
      </h1>

      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-10">
        <div className="min-w-0">
          <BarraEscalon resumen={resumen} className="mb-5" />

          <ul className="divide-border-soft border-border-soft divide-y border-y">
            {resumen.lineas.map((linea) => (
              <li key={linea.clave} className="flex gap-4 py-5">
                <Link
                  href={linea.enlace}
                  className="bg-surface relative size-24 shrink-0 overflow-hidden rounded sm:size-28"
                >
                  <Imagen
                    src={linea.imagen}
                    alt={linea.nombre}
                    sizes="112px"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={linea.enlace}
                        className="font-display hover:text-gold-light text-lg leading-snug"
                      >
                        {linea.nombre}
                      </Link>
                      <p className="text-fg-subtle mt-0.5 text-xs">
                        {linea.subtitulo}
                      </p>
                      {linea.unitario < linea.unitarioMenudeo ? (
                        <p className="text-success mt-1 text-xs">
                          Precio {resumen.escalon.nombre} aplicado
                        </p>
                      ) : null}
                    </div>

                    <div className="shrink-0 text-right">
                      {linea.unitario < linea.unitarioMenudeo ? (
                        <PrecioAnterior
                          valor={linea.unitarioMenudeo}
                          className="block text-xs"
                        />
                      ) : null}
                      <Precio
                        valor={linea.unitario}
                        className="block font-medium"
                      />
                      <span className="text-fg-subtle text-[11px]">c/u</span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <Stepper
                      compacto
                      valor={linea.item.cantidad}
                      max={linea.stock}
                      etiqueta={linea.nombre}
                      onCambio={(n) =>
                        cambiarCantidad(linea.item.productoId, linea.item.ml, n)
                      }
                    />

                    <div className="flex items-center gap-1">
                      {linea.tipo === "producto" ? (
                        <button
                          type="button"
                          onClick={() =>
                            guardarParaDespues(
                              linea.item.productoId,
                              linea.item.ml,
                            )
                          }
                          className="text-fg-subtle hover:text-fg inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors"
                        >
                          <Bookmark size={13} aria-hidden />
                          Guardar para después
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          quitar(linea.item.productoId, linea.item.ml)
                        }
                        aria-label={`Eliminar ${linea.nombre}`}
                        className="text-fg-subtle hover:text-danger grid size-9 place-items-center rounded-full transition-colors"
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </div>

                    <p className="ml-auto text-sm">
                      <span className="text-fg-subtle mr-1.5 text-xs">
                        Subtotal
                      </span>
                      <Precio valor={linea.subtotal} className="font-medium" />
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {resumenGuardados.lineas.length > 0 ? (
            <section className="mt-10">
              <h2 className="font-display mb-4 text-xl">Guardado para después</h2>
              <ul className="divide-border-soft border-border-soft divide-y border-y">
                {resumenGuardados.lineas.map((linea) => (
                  <li key={linea.clave} className="flex items-center gap-4 py-4">
                    <Link
                      href={linea.enlace}
                      className="bg-surface relative size-16 shrink-0 overflow-hidden rounded"
                    >
                      <Imagen
                        src={linea.imagen}
                        alt={linea.nombre}
                        sizes="64px"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={linea.enlace}
                        className="font-display hover:text-gold-light block truncate"
                      >
                        {linea.nombre}
                      </Link>
                      <p className="text-fg-subtle text-xs">{linea.subtitulo}</p>
                    </div>
                    <Precio
                      valor={linea.unitarioMenudeo}
                      className="text-fg-muted shrink-0 text-sm"
                    />
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-full px-3"
                        onClick={() =>
                          regresarAlCarrito(linea.item.productoId, linea.item.ml)
                        }
                      >
                        Mover al carrito
                      </Button>
                      <button
                        type="button"
                        onClick={() =>
                          quitarGuardado(linea.item.productoId, linea.item.ml)
                        }
                        aria-label={`Quitar ${linea.nombre} de guardados`}
                        className="text-fg-subtle hover:text-danger grid size-9 place-items-center rounded-full"
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="mt-8 lg:sticky lg:top-24 lg:mt-0">
          <ResumenPedido resumen={resumen}>
            <Button asChild variant="gold" size="touch-lg" className="w-full">
              <Link href="/checkout">Finalizar compra</Link>
            </Button>
            <Button
              asChild
              variant="goldGhost"
              size="touch"
              className="mt-2 w-full"
            >
              <Link href="/catalogo">Seguir comprando</Link>
            </Button>
          </ResumenPedido>
        </div>
      </div>
    </Contenedor>
  );
}
