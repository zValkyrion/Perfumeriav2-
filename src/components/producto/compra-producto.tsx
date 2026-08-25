"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Heart, PackageCheck, RotateCcw, Truck, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NumeroAnimado } from "@/components/comunes/numero-animado";
import { Precio, PrecioAnterior, Descuento } from "@/components/comunes/precio";
import { Stepper } from "@/components/carrito/stepper";
import { MARCA } from "@/data/contenido";
import { precio as fmt, precioPorMl } from "@/lib/format";
import { pixel } from "@/lib/pixel";
import { ESCALONES, escalonPara, mejorPlazo, precioUnitario, siguienteEscalon } from "@/lib/volumen";
import { useTienda } from "@/store/tienda";
import type { Producto } from "@/types";
import { cn } from "@/lib/utils";

export function CompraProducto({ producto }: { producto: Producto }) {
  const router = useRouter();

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
  const modoMayoreo = useTienda((s) => s.modoMayoreo);
  const favorito = useTienda((s) => s.favoritos.includes(producto.id));
  const alternarFavorito = useTienda((s) => s.alternarFavorito);
  const expres = useTienda((s) => s.expres);
  const pedirExpres = useTienda((s) => s.pedirExpres);
  const hidratado = useTienda((s) => s.hidratado);
  // Hasta que `persist` no ha leído localStorage, el servidor y el cliente
  // pintarían cosas distintas y React se queja. Sin esto, el botón exprés
  // provoca un error de hidratación en cada ficha.
  const hayExpres = hidratado && expres !== null;

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

  /**
   * `ViewContent` para el pixel: quién miró qué ficha y por cuánto.
   *
   * Depende del producto y no de la presentación elegida: Meta agrupa por
   * artículo, y mandar un evento por cada clic en «100 ml» inflaría las vistas
   * de contenido hasta volver inútil el costo por resultado.
   */
  useEffect(() => {
    pixel("ViewContent", {
      content_ids: [producto.id],
      content_name: producto.nombre,
      content_type: "product",
      currency: "MXN",
      value: inicial.precio,
    });
  }, [producto.id, producto.nombre, inicial.precio]);

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

  function avisarPixelCarrito() {
    pixel("AddToCart", {
      content_ids: [producto.id],
      content_name: producto.nombre,
      content_type: "product",
      contents: [
        { id: producto.id, quantity: cantidad, item_price: unitario },
      ],
      currency: "MXN",
      value: unitario * cantidad,
      num_items: cantidad,
    });
  }

  /**
   * Comprar ahora: al checkout sin pasar por el carrito.
   *
   * Suma la pieza al carrito igual que el otro botón —no lo sustituye— porque
   * quien ya tenía frascos dentro no espera perderlos por pulsar aquí, y porque
   * el descuento por volumen se calcula sobre el pedido entero: vaciar el
   * carrito para «comprar solo esto» le subiría el precio a las demás piezas.
   */
  function comprarAhora() {
    agregar(producto.id, presentacion.ml, cantidad);
    avisarPixelCarrito();
    router.push("/checkout");
  }

  /**
   * Compra exprés: del frasco a revisar el pedido, en un toque.
   *
   * Solo aparece cuando ya hay una compra anterior en este navegador, porque lo
   * que salta son los pasos cuya respuesta ya se conoce: dirección, entrega y
   * forma de pago. **No salta la confirmación.** Un botón que cobra sin enseñar
   * antes el total no es rapidez, es un cargo sorpresa — y menos aún cuando el
   * contra entrega suma $400 al pedido.
   */
  function comprarExpres() {
    agregar(producto.id, presentacion.ml, cantidad);
    avisarPixelCarrito();
    pedirExpres();
    router.push("/checkout");
  }

  function alCarrito() {
    const yaEnCarrito =
      useTienda
        .getState()
        .carrito.find(
          (i) => i.productoId === producto.id && i.ml === presentacion.ml,
        )?.cantidad ?? 0;
    const cabe = Math.max(0, presentacion.stock - yaEnCarrito);

    agregar(producto.id, presentacion.ml, cantidad);
    abrirDrawer();
    avisarPixelCarrito();

    // Si el stock recorta lo que se pidió hay que decirlo. Un "agregado" que
    // añade menos de lo que dice se descubre al pagar, que es el peor momento.
    if (cabe < cantidad) {
      toast.warning(
        cabe === 0
          ? `Ya tienes las ${presentacion.stock} piezas disponibles`
          : `Solo quedaban ${cabe} ${cabe === 1 ? "pieza" : "piezas"}`,
        {
          description: `${producto.nombre} · ${presentacion.ml} ml`,
        },
      );
      return;
    }

    toast.success(`${producto.nombre} agregado`, {
      description: `${cantidad} × ${presentacion.ml} ml · ${fmt(unitario)} c/u`,
    });
  }

  return (
    <div>
      {/* Sello 1:1: lo primero que resuelve la duda de "¿huele igual?" */}
      <div className="border-gold/35 bg-gold-muted mb-6 flex items-start gap-3 rounded-md border px-3.5 py-3">
        <span className="border-gold/60 text-gold-light grid size-9 shrink-0 place-items-center rounded-full border text-[13px] font-semibold">
          1:1
        </span>
        <p className="text-fg-muted text-[13px] leading-snug">
          <strong className="text-gold-light font-medium">
            Idéntico al original.
          </strong>{" "}
          Misma pirámide olfativa, misma evolución en la piel y el mismo frasco
          en forma, peso y acabado.
        </p>
      </div>

      {/* 3 · Presentaciones, en rejilla de cajas iguales.
          Es el selector de talla de una tienda de tenis, y funciona por lo
          mismo: todas las opciones ocupan lo mismo y se comparan de un vistazo,
          en vez de píldoras de anchos distintos donde el ojo salta. */}
      {producto.presentaciones.length > 1 ? (
        <fieldset className="mb-6">
          <legend className="text-fg-muted mb-2.5 text-sm">
            Elige tu presentación
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {producto.presentaciones.map((p) => (
              <button
                key={p.ml}
                type="button"
                onClick={() => setMl(p.ml)}
                aria-pressed={p.ml === ml}
                disabled={p.stock === 0}
                className={cn(
                  "min-h-14 rounded-md border px-2 py-2 text-center transition-colors",
                  // Lo agotado se tacha en vez de solo apagarse: una caja
                  // pálida se lee como «no seleccionada», no como «no hay».
                  p.stock === 0 && "text-fg-subtle border-border-soft line-through",
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
          {/* Cuenta hasta el nuevo precio al cambiar de escalón: el usuario
              ve caer la cifra, que es justo lo que queremos que note (§6.7). */}
          <NumeroAnimado
            valor={unitario}
            formato="moneda"
            className="text-[32px] leading-none font-medium"
          />

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

        {/* El interruptor del header también manda aquí (§7.2) */}
        {modoMayoreo && elegible && escalon.descuento === 0 ? (
          <p className="text-gold-light mt-2 text-[13px] font-medium">
            Mayoreo 3+:{" "}
            <Precio valor={precioUnitario(presentacion.precio, 3)} /> c/u ·
            envío gratis
          </p>
        ) : null}
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
              {ESCALONES.map((e, i) => {
                const activo = e.nombre === escalon.nombre;
                const precioFila = precioUnitario(presentacion.precio, e.min);
                // Un escalón que no baja el precio respecto al anterior no
                // ofrece nada automático: ahí el trato se cierra por WhatsApp.
                // Repetir la misma tarifa y el mismo −30% lo hacía parecer un
                // callejón sin salida en la única tabla donde se comparan.
                const aCotizar =
                  i > 0 && e.descuento === ESCALONES[i - 1]!.descuento;
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
                      {aCotizar ? "Precio especial" : `${fmt(precioFila)} c/u`}
                    </td>
                    <td className="text-success px-3.5 py-2.5 text-right text-[12px]">
                      {aCotizar ? (
                        <a
                          href={MARCA.whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold-light underline underline-offset-4"
                        >
                          pide cotización
                        </a>
                      ) : e.descuento > 0 ? (
                        `−${Math.round(e.descuento * 100)}%`
                      ) : (
                        "—"
                      )}
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
        {/* Mismo umbral que la tarjeta del catálogo: el aviso de escasez no
            puede aparecer en un sitio y faltar en el otro para la misma pieza. */}
        {presentacion.stock <= 19 ? (
          <p className="text-danger text-[13px]">
            Solo quedan {presentacion.stock}
          </p>
        ) : null}
      </div>

      {/* Comprar ahora manda, agregar al carrito acompaña.
          El orden importa: quien entra a una ficha desde un anuncio viene a
          llevarse ese frasco, no a seguir paseando. Dejar el botón que lleva a
          pagar en segundo plano añade un paso —carrito, revisar, seguir— entre
          la decisión y la compra. */}
      <div className="mt-3 space-y-2.5">
        {hayExpres ? (
          <Button
            variant="gold"
            size="touch-lg"
            className="w-full"
            onClick={comprarExpres}
            disabled={presentacion.stock === 0}
          >
            <Zap size={17} aria-hidden />
            {presentacion.stock === 0
              ? "Agotado"
              : `Comprar en 1 toque · ${expres!.nombre.split(" ")[0]}`}
          </Button>
        ) : null}

        <Button
          variant={hayExpres ? "goldOutline" : "gold"}
          size="touch-lg"
          className="w-full"
          onClick={comprarAhora}
          disabled={presentacion.stock === 0}
        >
          {presentacion.stock === 0 ? "Agotado" : "COMPRAR AHORA"}
        </Button>
        <Button
          variant="outline"
          size="touch"
          className="w-full"
          onClick={alCarrito}
          disabled={presentacion.stock === 0}
        >
          Agregar al carrito
        </Button>

        {hayExpres ? (
          <p className="text-fg-subtle text-center text-[11px]">
            Un toque usa tu última dirección en {expres!.ciudad} y te lleva
            directo a revisar. Nada se cobra sin que lo confirmes.
          </p>
        ) : null}
      </div>

      {/* 7 · Micro-garantías junto al CTA, no en el footer (§1.2.2) */}
      <ul className="text-fg-muted mt-4 grid gap-2 text-[13px] sm:grid-cols-3">
        <li className="flex items-center gap-1.5">
          <Truck size={14} className="text-gold shrink-0" aria-hidden />
          Envío gratis 3+
        </li>
        <li className="flex items-center gap-1.5">
          <PackageCheck size={14} className="text-gold shrink-0" aria-hidden />
          Calidad 1:1
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
          {/* La barra fija repite el CTA principal, no el secundario: si al
              hacer scroll ofreciera otra cosa que el botón de arriba, la
              decisión cambiaría según dónde se pulse. */}
          <Button
            variant="gold"
            size="touch"
            onClick={comprarAhora}
            disabled={presentacion.stock === 0}
          >
            Comprar
          </Button>
        </div>
      </div>
    </div>
  );
}
