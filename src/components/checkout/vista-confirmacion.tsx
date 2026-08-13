"use client";

import Link from "next/link";
import { Check, MessageCircle, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Contenedor } from "@/components/comunes/layout";
import { Imagen } from "@/components/comunes/imagen";
import { Precio } from "@/components/comunes/precio";
import { MARCA } from "@/data/contenido";
import { resumenCarrito } from "@/lib/carrito";
import { formatoFechaLarga } from "@/lib/format";
import { useTienda } from "@/store/tienda";

export function VistaConfirmacion() {
  const hidratado = useTienda((s) => s.hidratado);
  const pedido = useTienda((s) => s.ultimoPedido);

  if (!hidratado) {
    return (
      <Contenedor className="py-20">
        <div className="mx-auto h-48 max-w-lg animate-pulse rounded-lg bg-white/5" />
      </Contenedor>
    );
  }

  if (!pedido) {
    return (
      <Contenedor className="py-20 text-center">
        <h1 className="font-display mb-3 text-3xl">No hay ningún pedido reciente</h1>
        <p className="text-fg-muted mb-7">
          Si acabas de comprar, revisa tu correo. Si no, empieza por aquí.
        </p>
        <Button asChild variant="gold" size="touch-lg">
          <Link href="/catalogo">Ver el catálogo</Link>
        </Button>
      </Contenedor>
    );
  }

  // Se reutiliza el mismo motor del carrito para que el precio de cada línea
  // lleve aplicado el descuento por volumen: si no, el comprobante mostraría
  // precios de menudeo junto a un total ya rebajado y no cuadraría.
  const { lineas } = resumenCarrito(pedido.items);

  return (
    <Contenedor className="py-10 lg:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <div className="bg-success/15 text-success mx-auto mb-5 grid size-16 place-items-center rounded-full">
            <Check size={30} aria-hidden strokeWidth={2.5} />
          </div>

          <p className="eyebrow mb-2">Pedido confirmado</p>
          <h1 className="font-display text-[32px] leading-tight tracking-tight lg:text-[42px]">
            ¡Gracias, {pedido.nombre.split(" ")[0]}!
          </h1>
          <p className="text-fg-muted mt-3 text-[15px] leading-relaxed">
            Mandamos la confirmación a{" "}
            <span className="text-fg">{pedido.correo}</span>. En cuanto salga de
            bodega te llega la guía de rastreo por correo y WhatsApp.
          </p>
        </div>

        <div className="border-border-soft bg-surface mt-8 rounded-lg border">
          <div className="border-border-soft grid gap-4 border-b p-5 sm:grid-cols-2">
            <Dato etiqueta="Folio" valor={pedido.folio} destacado />
            <Dato etiqueta="Fecha" valor={formatoFechaLarga(pedido.fecha)} />
            <Dato
              etiqueta="Envío"
              valor={`${pedido.envio} · ${pedido.diasEntrega}`}
            />
            <Dato etiqueta="Pago" valor={pedido.metodoPago} />
            <Dato
              etiqueta="Entrega en"
              valor={`${pedido.ciudad}, ${pedido.estado}`}
            />
            <Dato
              etiqueta="Total"
              valor=""
              hijo={<Precio valor={pedido.total} moneda className="font-medium" />}
            />
          </div>

          <ul className="divide-border-soft divide-y px-5">
            {lineas.map((l) => (
              <li key={l.clave} className="flex items-center gap-3 py-4">
                <span className="bg-bg relative size-16 shrink-0 overflow-hidden rounded">
                  <Imagen src={l.imagen} alt="" sizes="64px" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-display block truncate">{l.nombre}</span>
                  <span className="text-fg-subtle block text-xs">
                    {l.subtitulo} · {l.item.cantidad}{" "}
                    {l.item.cantidad === 1 ? "pieza" : "piezas"}
                  </span>
                </span>
                <Precio valor={l.subtotal} className="shrink-0 text-sm" />
              </li>
            ))}
          </ul>
        </div>

        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icono: Package, titulo: "Preparamos tu pedido", texto: "Hoy mismo" },
            { icono: Truck, titulo: "Sale de bodega", texto: "Con guía de rastreo" },
            { icono: Check, titulo: "Llega a tu puerta", texto: pedido.diasEntrega },
          ].map((paso) => {
            const Icono = paso.icono;
            return (
              <li
                key={paso.titulo}
                className="border-border-soft rounded-md border px-4 py-4 text-center"
              >
                <Icono size={20} className="text-gold mx-auto mb-2" aria-hidden />
                <p className="text-sm font-medium">{paso.titulo}</p>
                <p className="text-fg-subtle mt-0.5 text-xs">{paso.texto}</p>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="gold" size="touch-lg" className="flex-1">
            <Link href="/catalogo">Seguir comprando</Link>
          </Button>
          <Button asChild variant="outline" size="touch-lg" className="flex-1">
            <a href={MARCA.whatsappLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={17} aria-hidden />
              Escribir por WhatsApp
            </a>
          </Button>
        </div>

        <p className="text-fg-subtle mt-5 text-center text-xs">
          Puedes seguir tu pedido desde{" "}
          <Link
            href="/cuenta"
            className="text-gold-light underline underline-offset-4"
          >
            Mi cuenta
          </Link>
          .
        </p>
      </div>
    </Contenedor>
  );
}

function Dato({
  etiqueta,
  valor,
  destacado,
  hijo,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
  hijo?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-fg-subtle text-[11px] tracking-[0.14em] uppercase">
        {etiqueta}
      </p>
      {hijo ?? (
        <p
          data-precio={destacado ? "" : undefined}
          className={destacado ? "text-gold-light font-medium" : "text-sm"}
        >
          {valor}
        </p>
      )}
    </div>
  );
}
