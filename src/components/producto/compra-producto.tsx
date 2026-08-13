"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Eye, Heart, PackageCheck, RotateCcw, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Precio, PrecioAnterior, Descuento } from "@/components/comunes/precio";
import { Stepper } from "@/components/carrito/stepper";
import { precio as fmt, precioPorMl } from "@/lib/format";
import { ESCALONES, escalonPara, mejorPlazo, precioUnitario, siguienteEscalon } from "@/lib/volumen";
import { useTienda } from "@/store/tienda";
import type { Producto } from "@/types";
import { cn } from "@/lib/utils";

export function CompraProducto({ producto }: { producto: Producto }) {
  const router = useRouter();
  const reducido = useReducedMotion();

  const inicial =
    producto.presentaciones.find((p) => p.ml === 100) ??
    producto.presentaciones[producto.presentaciones.length - 1]!;

  const [ml, setMl] = useState(inicial.ml);
  const [cantidad, setCantidad] = useState(1);
  const [ctaVisible, setCtaVisible] = useState(true);
  const sentinela = useRef<HTMLDivElement>(null);

  const presentacion =
    producto.presentaciones.find((p) => p.ml === ml) ?? inicial;

  const agregar = useTienda((s) => s.agregar);
  const abrirDrawer = useTienda((s) => s.abrirDrawer);
  const favorito = useTienda((s) => s.favoritos.includes(producto.id));
  const alternarFavorito = useTienda((s) => s.alternarFavorito);

  const elegible = producto.esMayoreoElegible;
  const escalon = elegible ? escalonPara(cantidad) : ESCALONES[0]!;
  const unitario = elegible
    ? precioUnitario(presentacion.precio, cantidad)
    : presentacion.precio;
  const siguiente = elegible
    ? siguienteEscalon(cantidad, presentacion.precio, presentacion.precio * cantidad)
    : null;

  const descuentoRebaja = presentacion.precioAnterior
    ? 1 - presentacion.precio / presentacion.precioAnterior
    : 0;
  const msi = mejorPlazo(unitario * cantidad);

  // El CTA sticky de móvil aparece solo cuando el botón real sale de pantalla.
  useEffect(() => {
    const nodo = sentinela.current;
    if (!nodo) return;
    const obs = new IntersectionObserver(
      ([entrada]) => setCtaVisible(entrada?.isIntersecting ?? true),
      { rootMargin: "-72px 0px 0px 0px" },
    );
    obs.observe(nodo);
    return () => obs.disconnect();
  }, []);

  function alCarrito() {
    agregar(producto.id, presentacion.ml, cantidad);
    abrirDrawer();
    toast.success(`${producto.nombre} agregado`, {
      description: `${cantidad} × ${presentacion.ml} ml · ${fmt(unitario)} c/u`,
    });
  }

  return (
    <div>
      {/* 3 · Presentaciones */}
      {producto.presentaciones.length > 1 ? (
        <fieldset className="mb-6">
          <legend className="text-fg-muted mb-2.5 text-sm">
            Elige tu presentación
          </legend>
          <div className="flex flex-wrap gap-2">
            {producto.presentaciones.map((p) => (
              <button
                key={p.ml}
                type="button"
                onClick={() => setMl(p.ml)}
                aria-pressed={p.ml === ml}
                disabled={p.stock === 0}
                className={cn(
                  "min-h-11 rounded-full border px-4 py-2 text-left transition-colors disabled:opacity-40",
                  p.ml === ml
                    ? "border-gold bg-gold-muted"
                    : "border-border-strong hover:border-fg-subtle",
                )}
              >
                <span className="block text-sm font-medium">{p.ml} ml</span>
                <span
                  data-precio
                  className={cn(
                    "block text-[11px]",
                    p.ml === ml ? "text-gold-light" : "text-fg-subtle",
                  )}
                >
                  {p.stock === 0 ? "Agotado" : fmt(p.precio)}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {/* 4 · Bloque de precio */}
      <div className="mb-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={unitario}
              initial={reducido ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducido ? undefined : { opacity: 0, y: -8, position: "absolute" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <Precio
                valor={unitario}
                moneda
                className="text-[32px] leading-none font-medium"
              />
            </motion.span>
          </AnimatePresence>

          {presentacion.precioAnterior && escalon.descuento === 0 ? (
            <>
              <PrecioAnterior valor={presentacion.precioAnterior} />
              <Descuento fraccion={descuentoRebaja} />
            </>
          ) : null}

          {escalon.descuento > 0 ? (
            <>
              <PrecioAnterior valor={presentacion.precio} />
              <Descuento fraccion={escalon.descuento} />
            </>
          ) : null}
        </div>

        <p className="text-fg-subtle mt-2 text-[13px]">
          {precioPorMl(unitario, presentacion.ml)}
          {cantidad > 1 ? (
            <>
              {" · "}
              <span className="text-fg-muted">
                Total <Precio valor={unitario * cantidad} />
              </span>
            </>
          ) : null}
          {msi ? (
            <>
              {" · "}
              <span className="text-fg-muted">
                o {msi.plazo} pagos de <Precio valor={msi.pago} />
              </span>
            </>
          ) : null}
        </p>
      </div>

      {/* 5 · Tabla de mayoreo interactiva */}
      {elegible ? (
        <div className="border-border-soft mb-5 overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <caption className="bg-surface text-fg-muted border-border-soft border-b px-3.5 py-2.5 text-left text-[13px]">
              Entre más piezas, menor el precio por frasco
            </caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Piezas</th>
                <th scope="col">Precio por pieza</th>
                <th scope="col">Ahorro</th>
              </tr>
            </thead>
            <tbody className="divide-border-soft divide-y">
              {ESCALONES.map((e) => {
                const activo = e.nombre === escalon.nombre;
                const precioFila = precioUnitario(presentacion.precio, e.min);
                return (
                  <tr
                    key={e.nombre}
                    className={cn(
                      "transition-colors",
                      activo ? "bg-gold-muted" : "hover:bg-surface",
                    )}
                  >
                    <td className="px-3.5 py-2.5">
                      <button
                        type="button"
                        onClick={() => setCantidad(Math.max(cantidad, e.min))}
                        className="text-left"
                      >
                        <span
                          data-precio
                          className={cn(
                            "font-medium",
                            activo && "text-gold-light",
                          )}
                        >
                          {e.max === null ? `${e.min}+` : `${e.min} – ${e.max}`}
                        </span>
                        <span className="text-fg-subtle block text-[11px]">
                          {e.nombre}
                        </span>
                      </button>
                    </td>
                    <td
                      data-precio
                      className={cn(
                        "px-3.5 py-2.5 text-right",
                        activo ? "text-gold-light font-medium" : "text-fg-muted",
                      )}
                    >
                      {fmt(precioFila)} c/u
                    </td>
                    <td className="text-success px-3.5 py-2.5 text-right text-[12px]">
                      {e.descuento > 0 ? `−${Math.round(e.descuento * 100)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {siguiente && siguiente.faltan > 0 ? (
            <p className="border-border-soft bg-surface border-t px-3.5 py-2.5 text-[13px]">
              <span className="text-gold-light font-medium">
                Agrega {siguiente.faltan}{" "}
                {siguiente.faltan === 1 ? "pieza más" : "piezas más"}
              </span>{" "}
              <span className="text-fg-muted">
                y baja a <Precio valor={siguiente.nuevoUnitario} /> c/u —
              </span>{" "}
              <span className="text-success">
                ahorras <Precio valor={siguiente.ahorroAdicional} />
              </span>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="border-border-soft text-fg-muted mb-5 rounded-md border px-3.5 py-3 text-[13px]">
          Edición limitada: no participa en los precios de mayoreo por volumen.
        </p>
      )}

      {/* 6 · Cantidad y acciones */}
      <div ref={sentinela} className="flex items-center gap-3">
        <Stepper
          valor={cantidad}
          onCambio={setCantidad}
          max={presentacion.stock}
          etiqueta={producto.nombre}
        />
        <button
          type="button"
          onClick={() => alternarFavorito(producto.id)}
          aria-pressed={favorito}
          aria-label={favorito ? "Quitar de favoritos" : "Guardar en favoritos"}
          className="border-border-strong hover:border-gold text-fg-muted hover:text-gold-light grid size-11 shrink-0 place-items-center rounded-full border transition-colors"
        >
          <Heart size={18} aria-hidden className={cn(favorito && "fill-gold text-gold")} />
        </button>
        {presentacion.stock <= 15 ? (
          <p className="text-danger text-[13px]">
            Solo quedan {presentacion.stock}
          </p>
        ) : null}
      </div>

      <div className="mt-3 space-y-2.5">
        <Button
          variant="gold"
          size="touch-lg"
          className="w-full"
          onClick={alCarrito}
          disabled={presentacion.stock === 0}
        >
          {presentacion.stock === 0 ? "Agotado" : "Agregar al carrito"}
        </Button>
        <Button
          variant="goldOutline"
          size="touch"
          className="w-full"
          disabled={presentacion.stock === 0}
          onClick={() => {
            agregar(producto.id, presentacion.ml, cantidad);
            router.push("/checkout");
          }}
        >
          Comprar ahora
        </Button>
      </div>

      {/* 7 · Micro-garantías junto al CTA, no en el footer (§1.2.2) */}
      <ul className="text-fg-muted mt-4 grid gap-2 text-[13px] sm:grid-cols-3">
        <li className="flex items-center gap-1.5">
          <Truck size={14} className="text-gold shrink-0" aria-hidden />
          Envío gratis 3+
        </li>
        <li className="flex items-center gap-1.5">
          <PackageCheck size={14} className="text-gold shrink-0" aria-hidden />
          100% original
        </li>
        <li className="flex items-center gap-1.5">
          <RotateCcw size={14} className="text-gold shrink-0" aria-hidden />
          Devolución 30 días
        </li>
      </ul>

      {/* 14 · Urgencia sutil, con un valor estable por producto */}
      <p className="text-fg-subtle mt-4 flex items-center gap-1.5 text-[12px]">
        <Eye size={13} aria-hidden />
        {producto.viendoAhora} personas están viendo este perfume
      </p>

      {/* CTA sticky de móvil (§10.6) */}
      <div
        className={cn(
          "border-border-soft bg-bg/95 fixed inset-x-0 bottom-16 z-30 border-t px-4 py-3 backdrop-blur-xl transition-transform duration-300 md:hidden",
          ctaVisible ? "translate-y-[130%]" : "translate-y-0",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px]">{producto.nombre}</p>
            <p className="text-gold-light text-sm font-medium">
              <Precio valor={unitario} /> · {presentacion.ml} ml
            </p>
          </div>
          <Button
            variant="gold"
            size="touch"
            onClick={alCarrito}
            disabled={presentacion.stock === 0}
          >
            Agregar
          </Button>
        </div>
      </div>
    </div>
  );
}
