"use client";

import Link from "next/link";
import { Plus, ShoppingBag, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Imagen } from "@/components/comunes/imagen";
import { NumeroAnimado } from "@/components/comunes/numero-animado";
import { Precio, PrecioAnterior } from "@/components/comunes/precio";
import { resumenCarrito } from "@/lib/carrito";
import { presentacionPrincipal } from "@/data/productos";
import { useTienda } from "@/store/tienda";
import type { Producto } from "@/types";
import { Stepper } from "./stepper";
import { BarraEscalon } from "./barra-escalon";

export function DrawerCarrito({ sugeridos }: { sugeridos: Producto[] }) {
  const abierto = useTienda((s) => s.drawerAbierto);
  const setDrawer = useTienda((s) => s.setDrawer);
  const carrito = useTienda((s) => s.carrito);
  const cupon = useTienda((s) => s.cupon);
  const cambiarCantidad = useTienda((s) => s.cambiarCantidad);
  const quitar = useTienda((s) => s.quitar);
  const agregar = useTienda((s) => s.agregar);

  const resumen = resumenCarrito(carrito, cupon);
  const enCarrito = new Set(carrito.map((i) => i.productoId));
  const complementos = sugeridos
    .filter((p) => !enCarrito.has(p.id))
    .slice(0, 6);

  return (
    <Sheet open={abierto} onOpenChange={setDrawer}>
      <SheetContent
        side="right"
        className="bg-bg/95 flex w-full flex-col gap-0 p-0 backdrop-blur-xl sm:max-w-md"
      >
        <SheetHeader className="border-border-soft border-b px-4 py-4">
          <SheetTitle className="font-display text-xl font-normal">
            Tu carrito
            {resumen.piezasTotales > 0 ? (
              <span className="text-fg-subtle ml-2 text-sm">
                {resumen.piezasTotales}{" "}
                {resumen.piezasTotales === 1 ? "pieza" : "piezas"}
              </span>
            ) : null}
          </SheetTitle>
        </SheetHeader>

        {resumen.vacio ? (
          <EstadoVacio onCerrar={() => setDrawer(false)} />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <BarraEscalon resumen={resumen} className="mb-4" />

              <ul className="divide-border-soft divide-y">
                {resumen.lineas.map((linea, i) => (
                  <li
                    key={linea.clave}
                    style={{ animationDelay: `${i * 60}ms` }}
                    className="animate-subir flex gap-3 py-3.5"
                  >
                    <Link
                      href={linea.enlace}
                      onClick={() => setDrawer(false)}
                      className="bg-surface relative size-20 shrink-0 overflow-hidden rounded"
                    >
                      <Imagen
                        src={linea.imagen}
                        alt={linea.nombre}
                        sizes="80px"
                      />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={linea.enlace}
                            onClick={() => setDrawer(false)}
                            className="font-display hover:text-gold-light block truncate text-[15px]"
                          >
                            {linea.nombre}
                          </Link>
                          <p className="text-fg-subtle text-[11px]">
                            {linea.subtitulo}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            quitar(linea.item.productoId, linea.item.ml)
                          }
                          aria-label={`Eliminar ${linea.nombre} del carrito`}
                          className="text-fg-subtle hover:text-danger -mt-1 grid size-9 shrink-0 place-items-center rounded-full transition-colors"
                        >
                          <Trash2 size={15} aria-hidden />
                        </button>
                      </div>

                      <div className="mt-2 flex items-end justify-between gap-2">
                        <Stepper
                          compacto
                          valor={linea.item.cantidad}
                          max={linea.stock}
                          etiqueta={linea.nombre}
                          onCambio={(n) =>
                            cambiarCantidad(
                              linea.item.productoId,
                              linea.item.ml,
                              n,
                            )
                          }
                        />
                        <div className="text-right">
                          {linea.unitario < linea.unitarioMenudeo ? (
                            <PrecioAnterior
                              valor={linea.unitarioMenudeo}
                              className="block text-[11px]"
                            />
                          ) : null}
                          <Precio
                            valor={linea.unitario}
                            className="block text-sm font-medium"
                          />
                          <span className="text-fg-subtle text-[11px]">c/u</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {complementos.length > 0 ? (
                <div className="border-border-soft mt-5 border-t pt-5">
                  <p className="eyebrow mb-3">Complementa tu pedido</p>
                  <div className="snap-row -mx-4 flex gap-2.5 px-4">
                    {complementos.map((p) => {
                      const pres = presentacionPrincipal(p);
                      return (
                        <div key={p.id} className="w-28 shrink-0">
                          <Link
                            href={`/producto/${p.slug}`}
                            onClick={() => setDrawer(false)}
                            className="bg-surface relative block aspect-3/4 overflow-hidden rounded"
                          >
                            <Imagen
                              src={p.imagenes[0]!}
                              alt={p.nombre}
                              sizes="112px"
                            />
                          </Link>
                          <p className="font-display mt-1.5 truncate text-[13px]">
                            {p.nombre}
                          </p>
                          <div className="mt-0.5 flex items-center justify-between gap-1">
                            <Precio
                              valor={pres.precio}
                              className="text-fg-muted text-[12px]"
                            />
                            <button
                              type="button"
                              onClick={() => agregar(p.id, pres.ml, 1)}
                              aria-label={`Agregar ${p.nombre} al carrito`}
                              className="border-border-strong hover:border-gold hover:text-gold-light grid size-7 shrink-0 place-items-center rounded-full border transition-colors"
                            >
                              <Plus size={13} aria-hidden />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-border-soft bg-bg space-y-3 border-t px-4 py-4">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Subtotal</dt>
                  <dd>
                    <Precio valor={resumen.subtotal} />
                  </dd>
                </div>
                {resumen.ahorroVolumen > 0 ? (
                  <div className="text-success flex justify-between">
                    <dt>Descuento por volumen</dt>
                    <dd>
                      −<Precio valor={resumen.ahorroVolumen} />
                    </dd>
                  </div>
                ) : null}
                {resumen.descuentoCupon > 0 ? (
                  <div className="text-success flex justify-between">
                    <dt>Cupón {resumen.cupon}</dt>
                    <dd>
                      −<Precio valor={resumen.descuentoCupon} />
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Envío</dt>
                  <dd className={resumen.envioGratis ? "text-success" : ""}>
                    {resumen.envioGratis ? "GRATIS" : <Precio valor={resumen.envio} />}
                  </dd>
                </div>
                <div className="border-border-soft flex justify-between border-t pt-2 text-base font-medium">
                  <dt>Total</dt>
                  <dd>
                    <NumeroAnimado valor={resumen.total} formato="moneda" />
                  </dd>
                </div>
              </dl>

              <div className="grid grid-cols-[auto_1fr] gap-2">
                <Button asChild variant="goldOutline" size="touch">
                  <Link href="/carrito" onClick={() => setDrawer(false)}>
                    Ver carrito
                  </Link>
                </Button>
                <Button asChild variant="gold" size="touch">
                  <Link href="/checkout" onClick={() => setDrawer(false)}>
                    Finalizar compra
                  </Link>
                </Button>
              </div>

              <p className="text-fg-subtle text-center text-[11px] leading-relaxed">
                Calidad 1:1 · Devoluciones sin costo 30 días ·
                {resumen.envioGratis ? " Envío gratis" : " Envío gratis desde 3 piezas"}
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EstadoVacio({ onCerrar }: { onCerrar: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="border-border-strong text-fg-subtle mb-5 grid size-20 place-items-center rounded-full border border-dashed">
        <ShoppingBag size={28} aria-hidden />
      </div>
      <p className="font-display mb-2 text-xl">Tu carrito está vacío</p>
      <p className="text-fg-muted mb-6 max-w-xs text-sm leading-relaxed">
        Desde 3 piezas obtienes precio de mayoreo y el envío corre por nuestra
        cuenta.
      </p>
      <Button asChild variant="gold" size="touch">
        <Link href="/catalogo" onClick={onCerrar}>
          Ver el catálogo
        </Link>
      </Button>
    </div>
  );
}
