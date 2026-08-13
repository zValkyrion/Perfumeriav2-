"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Plus } from "lucide-react";
import { toast } from "sonner";
import { Imagen } from "@/components/comunes/imagen";
import { Precio, PrecioAnterior, Descuento } from "@/components/comunes/precio";
import { RatingCompacto } from "@/components/comunes/estrellas";
import { MARCAS_POR_SLUG } from "@/data/marcas";
import { presentacionPrincipal } from "@/data/productos";
import { precio as fmt } from "@/lib/format";
import { mejorPlazo, precioUnitario } from "@/lib/volumen";
import { useTienda } from "@/store/tienda";
import type { Producto } from "@/types";
import { cn } from "@/lib/utils";

/** Umbral a partir del cual mostramos escasez. Es stock real del dataset. */
const STOCK_BAJO = 15;

export function TarjetaProducto({
  producto,
  prioridad = false,
  className,
}: {
  producto: Producto;
  prioridad?: boolean;
  className?: string;
}) {
  const principal = presentacionPrincipal(producto);
  const [ml, setMl] = useState(principal.ml);
  const presentacion =
    producto.presentaciones.find((p) => p.ml === ml) ?? principal;

  const modoMayoreo = useTienda((s) => s.modoMayoreo);
  const favorito = useTienda((s) => s.favoritos.includes(producto.id));
  const alternarFavorito = useTienda((s) => s.alternarFavorito);
  const agregar = useTienda((s) => s.agregar);
  const abrirDrawer = useTienda((s) => s.abrirDrawer);

  const marca = MARCAS_POR_SLUG.get(producto.marca)?.nombre ?? producto.marca;
  const descuento = presentacion.precioAnterior
    ? 1 - presentacion.precio / presentacion.precioAnterior
    : 0;

  const mayoreo = precioUnitario(presentacion.precio, 3);
  const msi = mejorPlazo(presentacion.precio);
  const bajo = presentacion.stock <= STOCK_BAJO;

  function agregarAlCarrito() {
    agregar(producto.id, presentacion.ml, 1);
    abrirDrawer();
    toast.success(`${producto.nombre} agregado`, {
      description: `${presentacion.ml} ml · ${fmt(presentacion.precio)} MXN`,
    });
  }

  return (
    <article
      className={cn(
        "group border-border-soft bg-surface lift relative flex flex-col overflow-hidden rounded-md border",
        className,
      )}
    >
      <div className="bg-bg relative aspect-3/4 overflow-hidden">
        <Link
          href={`/producto/${producto.slug}`}
          className="absolute inset-0 z-10"
          aria-label={`Ver ${producto.nombre} de ${marca}`}
        />

        <Imagen
          src={producto.imagenes[0]!}
          alt={`${producto.nombre}, ${producto.concentracion} de ${marca}`}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 25vw, 20vw"
          priority={prioridad}
          className="transition-opacity duration-500 group-hover:opacity-0"
        />
        {/* Segunda toma al hover; en táctil simplemente no se dispara. */}
        <Imagen
          src={producto.imagenes[1]!}
          alt=""
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 25vw, 20vw"
          className="scale-105 opacity-0 transition-all duration-500 group-hover:scale-100 group-hover:opacity-100"
        />

        {producto.badges.length > 0 ? (
          <ul className="absolute top-2.5 left-2.5 z-20 flex flex-col items-start gap-1.5">
            {producto.badges.slice(0, 2).map((b) => (
              <li
                key={b}
                className={cn(
                  "rounded-full px-2 py-1 text-[10px] font-medium tracking-wide uppercase backdrop-blur-sm",
                  b === "3x2"
                    ? "bg-gold-gradient text-bg"
                    : b === "Últimas piezas"
                      ? "bg-danger/85 text-white"
                      : "bg-bg/80 text-fg-muted border-border-strong border",
                )}
              >
                {b}
              </li>
            ))}
          </ul>
        ) : null}

        <button
          type="button"
          onClick={() => {
            alternarFavorito(producto.id);
            toast(favorito ? "Quitado de favoritos" : "Guardado en favoritos");
          }}
          aria-pressed={favorito}
          aria-label={
            favorito
              ? `Quitar ${producto.nombre} de favoritos`
              : `Guardar ${producto.nombre} en favoritos`
          }
          className="bg-bg/70 text-fg-muted hover:text-gold-light absolute top-2 right-2 z-20 grid size-11 place-items-center rounded-full backdrop-blur-sm transition-colors"
        >
          <Heart
            size={17}
            aria-hidden
            className={cn(favorito && "fill-gold text-gold")}
          />
        </button>

        {/* CTA: siempre visible en móvil, aparece al hover en escritorio. */}
        <div className="absolute inset-x-2.5 bottom-2.5 z-20 lg:translate-y-2 lg:opacity-0 lg:transition-all lg:duration-300 lg:group-hover:translate-y-0 lg:group-hover:opacity-100">
          <button
            type="button"
            onClick={agregarAlCarrito}
            disabled={presentacion.stock === 0}
            className="bg-gold-gradient text-bg flex h-11 w-full items-center justify-center gap-1.5 rounded-full text-[13px] font-medium transition-[filter] hover:brightness-110 disabled:opacity-50"
          >
            <Plus size={15} aria-hidden />
            {presentacion.stock === 0 ? "Agotado" : "Agregar"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3 lg:p-3.5">
        <p className="text-fg-subtle text-[10px] tracking-[0.16em] uppercase">
          {marca}
        </p>

        <h3 className="font-display mt-1 line-clamp-2 text-[15px] leading-snug lg:text-base">
          <Link href={`/producto/${producto.slug}`} className="hover:text-gold-light">
            {producto.nombre}
          </Link>
        </h3>

        {producto.presentaciones.length > 1 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {producto.presentaciones.map((p) => (
              <button
                key={p.ml}
                type="button"
                onClick={() => setMl(p.ml)}
                aria-pressed={p.ml === ml}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                  p.ml === ml
                    ? "border-gold text-gold-light"
                    : "border-border-strong text-fg-subtle hover:text-fg",
                )}
              >
                {p.ml} ml
              </button>
            ))}
          </div>
        ) : (
          <p className="text-fg-subtle mt-2 text-[11px]">
            {principal.ml} ml · {producto.concentracion}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Precio valor={presentacion.precio} className="text-[17px] font-medium" />
          {presentacion.precioAnterior ? (
            <>
              <PrecioAnterior valor={presentacion.precioAnterior} />
              <Descuento fraccion={descuento} />
            </>
          ) : null}
        </div>

        {modoMayoreo && producto.esMayoreoElegible ? (
          <p className="text-gold-light mt-1.5 text-[12px] font-medium">
            Mayoreo 3+: <Precio valor={mayoreo} /> c/u
          </p>
        ) : msi ? (
          <p className="text-fg-subtle mt-1.5 text-[11px]">
            o {msi.plazo} pagos de <Precio valor={msi.pago} />
          </p>
        ) : null}

        <div className="mt-auto pt-2.5">
          <RatingCompacto valor={producto.rating} total={producto.totalReseñas} />

          {bajo ? (
            <div className="mt-2">
              <div className="bg-surface-2 h-1 overflow-hidden rounded-full">
                <div
                  className="bg-danger/70 h-full rounded-full"
                  style={{
                    width: `${Math.max(8, (presentacion.stock / STOCK_BAJO) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-danger mt-1 text-[11px]">
                Solo quedan {presentacion.stock}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
