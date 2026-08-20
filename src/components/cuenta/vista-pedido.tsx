"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Copy, MessageCircle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Contenedor } from "@/components/comunes/layout";
import { Imagen } from "@/components/comunes/imagen";
import { Precio } from "@/components/comunes/precio";
import { ETAPAS_RASTREO, etapaActual, getPedido } from "@/data/cuenta";
import { getPresentacion, getProductoPorId } from "@/data/productos";
import { MARCA } from "@/data/contenido";
import { formatoFechaLarga } from "@/lib/format";
import { haySincronizacion, leerPedidosRemotos } from "@/lib/cuenta-remota";
import { useSesion } from "@/lib/sesion";
import type { Pedido } from "@/types";
import { cn } from "@/lib/utils";

/**
 * El detalle de un pedido, con su rastreo.
 *
 * El folio viaja en la consulta (`?folio=`) y no en la ruta. Antes era
 * `/cuenta/pedidos/[folio]/` con `generateStaticParams`, que solo podía existir
 * para los pedidos de muestra: el sitio es una exportación estática, así que un
 * folio real —creado después de compilar— no tenía página y el enlace de la
 * lista acababa en 404. Es el mismo problema que el panel resolvió igual, con
 * `/ficha/?id=`.
 */
export function VistaPedido() {
  const folio = useSearchParams().get("folio") ?? "";
  const sesion = useSesion();
  const cuenta = sesion.perfil?.sub || null;
  const conCuenta = haySincronizacion() && cuenta !== null;

  const [remoto, setRemoto] = useState<{ cuenta: string; pedido: Pedido | null } | null>(
    null,
  );

  useEffect(() => {
    if (!conCuenta || !cuenta || !folio) return;
    let vivo = true;
    leerPedidosRemotos()
      .then((r) => {
        if (vivo) {
          setRemoto({ cuenta, pedido: r.pedidos.find((p) => p.folio === folio) ?? null });
        }
      })
      .catch(() => vivo && setRemoto({ cuenta, pedido: null }));
    return () => {
      vivo = false;
    };
  }, [conCuenta, cuenta, folio]);

  if (!folio) return <Aviso titulo="Falta el folio" />;

  // Sin cuenta se sigue viendo el pedido de muestra, que es lo que enseña la
  // lista en ese caso. Con cuenta, solo lo que de verdad hay en ella.
  if (!conCuenta) {
    const muestra = getPedido(folio);
    return muestra ? <Detalle pedido={muestra} /> : <Aviso titulo="No encontramos ese pedido" />;
  }

  if (remoto?.cuenta !== cuenta) {
    return (
      <Contenedor className="py-10">
        <div className="h-64 animate-pulse rounded-lg bg-white/5" />
      </Contenedor>
    );
  }

  return remoto.pedido ? (
    <Detalle pedido={remoto.pedido} />
  ) : (
    <Aviso titulo="No encontramos ese pedido" />
  );
}

function Aviso({ titulo }: { titulo: string }) {
  return (
    <Contenedor className="py-20 text-center">
      <h1 className="font-display mb-3 text-3xl">{titulo}</h1>
      <p className="text-fg-muted mb-7">
        Puede que sea de otra cuenta o que el enlace esté incompleto. Tus pedidos
        están en tu cuenta.
      </p>
      <Button asChild variant="gold" size="touch-lg">
        <Link href="/cuenta">Ir a mi cuenta</Link>
      </Button>
    </Contenedor>
  );
}

function Detalle({ pedido }: { pedido: Pedido }) {
  const etapa = etapaActual(pedido.estatus);
  const cancelado = pedido.estatus === "Cancelado";

  return (
    <Contenedor className="py-6 lg:py-10">
      <Breadcrumb className="mb-5">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Inicio</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/cuenta">Mi cuenta</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{pedido.folio}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mb-8">
        <p className="eyebrow mb-2">Pedido</p>
        <h1
          data-precio
          className="font-display text-[30px] leading-tight tracking-tight lg:text-[40px]"
        >
          {pedido.folio}
        </h1>
        <p className="text-fg-muted mt-2 text-sm">
          {formatoFechaLarga(pedido.fecha)} · {pedido.piezas}{" "}
          {pedido.piezas === 1 ? "pieza" : "piezas"} ·{" "}
          <Precio valor={pedido.total} moneda className="text-fg" />
        </p>
      </header>

      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:items-start lg:gap-10">
        <div>
          {/* Timeline de rastreo */}
          <section className="border-border-soft bg-surface rounded-lg border p-5 lg:p-6">
            <h2 className="font-display mb-5 text-xl">Rastreo</h2>

            {cancelado ? (
              <p className="border-danger/30 bg-danger/10 text-danger rounded-md border px-4 py-3 text-sm">
                Este pedido fue cancelado. Si el cargo aparece en tu estado de
                cuenta, escríbenos y lo revisamos el mismo día.
              </p>
            ) : (
              <ol className="relative">
                {ETAPAS_RASTREO.map((nombre, i) => {
                  const hecho = i <= etapa;
                  const actual = i === etapa;
                  return (
                    <li key={nombre} className="flex gap-4 pb-6 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-full border transition-colors",
                            hecho
                              ? "bg-gold-gradient border-transparent"
                              : "border-border-strong",
                          )}
                        >
                          {hecho ? (
                            <Check size={14} className="text-bg" aria-hidden />
                          ) : (
                            <span className="bg-border-strong size-1.5 rounded-full" />
                          )}
                        </span>
                        {i < ETAPAS_RASTREO.length - 1 ? (
                          <span
                            aria-hidden
                            className={cn(
                              "mt-1 w-px flex-1",
                              i < etapa ? "bg-gold/50" : "bg-border-soft",
                            )}
                          />
                        ) : null}
                      </div>

                      <div className="-mt-0.5 pb-1">
                        <p
                          className={cn(
                            "text-sm",
                            actual ? "text-gold-light font-medium" : hecho ? "" : "text-fg-subtle",
                          )}
                        >
                          {nombre}
                        </p>
                        {actual ? (
                          <p className="text-fg-muted mt-0.5 text-xs">
                            Estado actual de tu pedido
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {pedido.guia ? (
              <div className="border-border-soft mt-5 border-t pt-4">
                <p className="text-fg-subtle text-[11px] tracking-[0.14em] uppercase">
                  Guía de rastreo
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <p data-precio className="font-medium">
                    {pedido.guia}
                  </p>
                  <span className="text-fg-muted text-sm">
                    · {pedido.paqueteria}
                  </span>
                </div>
                <p className="text-fg-subtle mt-1.5 flex items-center gap-1.5 text-xs">
                  <Copy size={12} aria-hidden />
                  Cópiala en el sitio de {pedido.paqueteria} para ver el detalle
                </p>
              </div>
            ) : null}
          </section>

          {/* Artículos */}
          <section className="mt-6">
            <h2 className="font-display mb-3 text-xl">Artículos</h2>
            <ul className="divide-border-soft border-border-soft divide-y border-y">
              {pedido.items.map((item) => {
                const producto = getProductoPorId(item.productoId);
                if (!producto) return null;
                const pres = getPresentacion(producto, item.ml);
                return (
                  <li
                    key={`${item.productoId}-${item.ml}`}
                    className="flex items-center gap-4 py-4"
                  >
                    <Link
                      href={`/producto/${producto.slug}`}
                      className="bg-surface relative size-16 shrink-0 overflow-hidden rounded"
                    >
                      <Imagen
                        src={producto.imagenes[0]!}
                        alt={producto.nombre}
                        sizes="64px"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/producto/${producto.slug}`}
                        className="font-display hover:text-gold-light block truncate"
                      >
                        {producto.nombre}
                      </Link>
                      <p className="text-fg-subtle text-xs">
                        {pres.ml} ml · {item.cantidad}{" "}
                        {item.cantidad === 1 ? "pieza" : "piezas"}
                      </p>
                    </div>
                    <Precio
                      valor={pres.precio * item.cantidad}
                      className="shrink-0 text-sm"
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className="mt-8 space-y-3 lg:mt-0">
          <div className="border-border-soft bg-surface rounded-lg border p-5">
            <h2 className="font-display mb-3 text-lg">¿Algo no cuadra?</h2>
            <p className="text-fg-muted mb-4 text-sm leading-relaxed">
              Escríbenos con tu folio y lo resolvemos. Te atiende una persona,
              normalmente en menos de una hora.
            </p>
            <Button asChild variant="gold" size="touch" className="w-full">
              <a
                href={MARCA.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={16} aria-hidden />
                Escribir por WhatsApp
              </a>
            </Button>
            <Button asChild variant="goldGhost" size="touch" className="mt-1 w-full">
              <Link href="/devoluciones">Ver política de devoluciones</Link>
            </Button>
          </div>

          <div className="border-border-soft rounded-lg border p-5">
            <p className="text-fg-muted flex items-start gap-2.5 text-sm leading-relaxed">
              <Truck size={16} className="text-gold mt-0.5 shrink-0" aria-hidden />
              Los pedidos de 3 piezas o más siempre viajan con envío gratis y
              seguro de paquetería incluido.
            </p>
          </div>
        </aside>
      </div>
    </Contenedor>
  );
}
