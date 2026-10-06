"use client";

import Link from "next/link";
import { Check, MessageCircle, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Contenedor } from "@/components/comunes/layout";
import { Imagen } from "@/components/comunes/imagen";
import { Precio } from "@/components/comunes/precio";
import { CLIP_LINK } from "@/data/pagos";
import { enlaceWhatsAppPedido } from "@/lib/aviso-pedido";
import { resumenCarrito } from "@/lib/carrito";
import { formatoFechaLarga } from "@/lib/format";
import { hayLogin, useSesion } from "@/lib/sesion";
import { useTienda } from "@/store/tienda";
import { esFolioLocal } from "@/components/cuenta/pedido-comun";

export function VistaConfirmacion() {
  const hidratado = useTienda((s) => s.hidratado);
  const pedido = useTienda((s) => s.ultimoPedido);

  if (!hidratado) {
    return (
      <Contenedor className="py-20">
        <div className="mx-auto h-48 max-w-lg animate-pulse rounded-lg bg-surface-2" />
      </Contenedor>
    );
  }

  if (!pedido) {
    return (
      <Contenedor className="py-20 text-center">
        <h1 className="font-display mb-3 text-3xl">No hay ningún pedido reciente</h1>
        {/* No se manda correo de confirmación: decir «revisa tu correo» mandaba
            a buscar algo que nunca llega. */}
        <p className="text-fg-muted mx-auto mb-7 max-w-md">
          Si acabas de comprar, consulta cómo va con tu folio y tu teléfono. Si no,
          empieza por aquí.
        </p>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild variant="gold" size="touch-lg">
            <Link href="/rastreo">Rastrear mi pedido</Link>
          </Button>
          <Button asChild variant="outline" size="touch-lg">
            <Link href="/catalogo">Ver el catálogo</Link>
          </Button>
        </div>
      </Contenedor>
    );
  }

  // Se reutiliza el mismo motor del carrito para que el precio de cada línea
  // lleve aplicado el descuento por volumen: si no, el comprobante mostraría
  // precios de menudeo junto a un total ya rebajado y no cuadraría.
  const { lineas } = resumenCarrito(pedido.items);

  /**
   * Qué falta para que este pedido se cobre, según cómo se paga.
   *
   * Ninguno de los tres métodos se cierra dentro de la tienda —no hay servidor
   * que cobre—, así que la pantalla dice exactamente qué sigue en lugar de
   * dejar al comprador esperando un correo que no va a llegar solo.
   */
  const siguientePaso = {
    clip: CLIP_LINK
      ? "Abrimos la pantalla de Clip en otra pestaña. Si se cerró, mándanos un WhatsApp y te reenviamos el enlace de cobro."
      : "Mándanos tu pedido por WhatsApp y te devolvemos el enlace de cobro de Clip para pagar con tarjeta o en efectivo.",
    transferencia:
      "Mándanos tu pedido por WhatsApp y te pasamos la CLABE y el monto exacto. Apartamos las piezas 24 horas.",
    contra:
      "Pagas en efectivo al repartidor. Mándanos tu pedido por WhatsApp y acordamos el día de entrega.",
  }[pedido.metodoId];

  const whatsapp = enlaceWhatsAppPedido(pedido);
  // Folio puesto por este navegador porque el servidor no contestó: no existe
  // en la tienda, no se puede rastrear y solo viaja por WhatsApp.
  const local = esFolioLocal(pedido.folio);

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
          {/* Nada de «te mandamos un correo»: no se manda ninguno. Lo que sí
              existe es el folio, y con él y el teléfono se rastrea. */}
          {local ? (
            <p className="text-fg-muted mt-3 text-[15px] leading-relaxed">
              No pudimos registrarlo en línea en este momento. Mándanos tu pedido
              por WhatsApp con el botón de abajo para que no se pierda.
            </p>
          ) : (
            <p className="text-fg-muted mt-3 text-[15px] leading-relaxed">
              Registramos tu pedido con el folio{" "}
              <span data-precio className="text-fg">
                {pedido.folio}
              </span>
              . En cuanto salga de bodega te mandamos la guía de rastreo por
              WhatsApp al {pedido.telefono}.
            </p>
          )}
        </div>

        {/* El paso que de verdad cierra la compra.
            Va arriba del comprobante y en dorado porque es lo único que la
            tienda necesita que ocurra: el cobro se acuerda por WhatsApp en los
            tres métodos, y un botón perdido al final de la página deja pedidos
            confirmados que nadie llega a cobrar. */}
        <div className="border-gold/35 bg-gold-muted mt-8 rounded-lg border p-5">
          <p className="mb-1.5 flex items-center gap-2 font-medium">
            <MessageCircle size={17} className="text-gold" aria-hidden />
            Falta un paso: mándanos tu pedido
          </p>
          <p className="text-fg-muted mb-4 text-sm leading-relaxed">
            {siguientePaso}
          </p>
          <Button asChild variant="gold" size="touch-lg" className="w-full">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              Enviar mi pedido por WhatsApp
            </a>
          </Button>
          <p className="text-fg-subtle mt-2.5 text-center text-[11px]">
            Se abre el chat con el folio {pedido.folio}, tus datos y la dirección
            ya escritos. Solo hay que darle enviar.
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
            {/* La comisión del cobro en destino se nombra en el comprobante:
                es la única parte del total que no salió del carrito. */}
            {pedido.comision > 0 ? (
              <Dato
                etiqueta="Cobro en destino"
                valor=""
                hijo={<Precio valor={pedido.comision} className="text-sm" />}
              />
            ) : null}
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
            // Sin «hoy mismo»: se surte cuando se confirma el pago (o, contra
            // entrega, cuando se acuerda el día), y eso no depende de la tienda.
            {
              icono: Package,
              titulo: "Preparamos tu pedido",
              texto: pedido.metodoId === "contra" ? "Al acordar la entrega" : "Al confirmar tu pago",
            },
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
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={17} aria-hidden />
              Escribir por WhatsApp
            </a>
          </Button>
        </div>

        {local ? null : (
          <SeguirPedido folio={pedido.folio} telefono={pedido.telefono} />
        )}
      </div>
    </Contenedor>
  );
}

/**
 * Cómo seguir el pedido después de cerrar esta pantalla.
 *
 * Esta pantalla vive en el navegador y se pisa con el siguiente pedido, así
 * que el folio tiene que quedar a un toque del rastreo. A quien compró sin
 * cuenta se le invita a crearla —sus siguientes pedidos quedarán en su
 * historial—, sin prometer que este se le vaya a ligar: el servidor no lo hace.
 */
function SeguirPedido({ folio, telefono }: { folio: string; telefono: string }) {
  const sesion = useSesion();
  const rastreo = `/rastreo/?folio=${encodeURIComponent(folio)}`;

  return (
    <section className="border-border-soft mt-8 rounded-lg border p-5">
      <h2 className="font-display mb-1.5 text-lg">Sigue tu pedido</h2>
      {sesion.perfil ? (
        <>
          <p className="text-fg-muted mb-4 text-sm leading-relaxed">
            Quedó en tu cuenta: ahí ves cómo va, la guía cuando salga, y puedes
            repetirlo o pedir factura.
          </p>
          <Button asChild variant="outline" size="touch" className="w-full sm:w-auto">
            <Link href={`/cuenta/pedido/?folio=${encodeURIComponent(folio)}`}>
              Ver mi pedido en Mi cuenta
            </Link>
          </Button>
        </>
      ) : (
        <>
          <p className="text-fg-muted mb-4 text-sm leading-relaxed">
            Guarda tu folio <span data-precio className="text-fg">{folio}</span>:
            con él y el teléfono {telefono} consultas cómo va, sin cuenta.
          </p>
          <Button asChild variant="outline" size="touch" className="w-full sm:w-auto">
            <Link href={rastreo}>Rastrear mi pedido</Link>
          </Button>
          {hayLogin() && sesion.listo ? (
            <p className="text-fg-subtle border-border-soft mt-4 border-t pt-4 text-sm leading-relaxed">
              ¿Compras seguido?{" "}
              <Link href="/cuenta" className="text-gold-light underline underline-offset-4">
                Crea tu cuenta
              </Link>{" "}
              y tus próximos pedidos quedarán en tu historial: los rastreas sin
              folio y los repites con un toque.
            </p>
          ) : null}
        </>
      )}
    </section>
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
