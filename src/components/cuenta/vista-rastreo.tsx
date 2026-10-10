"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Contenedor } from "@/components/comunes/layout";
import { Precio } from "@/components/comunes/precio";
import { formatearTelefono } from "@/components/checkout/esquemas";
import { consultarPedido, ErrorRemoto, haySincronizacion } from "@/lib/cuenta-remota";
import { formatoFechaLarga } from "@/lib/format";
import { hayLogin, useSesion } from "@/lib/sesion";
import { useTienda } from "@/store/tienda";
import type { PedidoPublico } from "@/types";
import { AvisoTiendaPrincipal } from "./aviso-tienda-principal";
import {
  BloqueGuia,
  ComoPagar,
  DesgloseCifras,
  InsigniaEstatus,
  LineaTiempo,
  ListaLineas,
  NotaTienda,
  esFolioLocal,
  etiquetaEnvio,
  etiquetaPago,
} from "./pedido-comun";

/**
 * Rastreo sin cuenta: folio + teléfono.
 *
 * Casi todos compran sin cuenta, y hasta ahora su único comprobante era la
 * pantalla de gracias guardada en el navegador, que se pisa con el siguiente
 * pedido. Aquí basta el folio y el teléfono con que se hizo.
 *
 * El folio puede llegar en `?folio=` (desde la confirmación o el detalle); el
 * teléfono **nunca** va en la URL: es un dato personal y la URL se queda en el
 * historial, en los registros del servidor y en cualquier enlace compartido.
 *
 * El servidor contesta igual si el folio no existe que si el teléfono no es el
 * del pedido, para no dejar adivinar folios. Y lo que devuelve no lleva la
 * dirección completa: solo el primer nombre, la ciudad y el estado.
 */
export function VistaRastreo() {
  const folioInicial = (useSearchParams().get("folio") ?? "").trim().toUpperCase();

  if (!haySincronizacion()) {
    return (
      <AvisoTiendaPrincipal
        titulo="El rastreo vive en la tienda principal"
        texto="Esta copia de la tienda no está conectada al servidor de pedidos. Consulta tu pedido en la tienda principal con tu folio y tu teléfono."
        ruta={folioInicial ? `/rastreo/?folio=${encodeURIComponent(folioInicial)}` : "/rastreo/"}
        cta="Rastrear mi pedido"
      />
    );
  }

  return <Rastreo key={folioInicial} folioInicial={folioInicial} />;
}

type Estado =
  | { tipo: "inicio" }
  | { tipo: "consultando" }
  | { tipo: "error"; mensaje: string; reintentable: boolean }
  | { tipo: "local" }
  | { tipo: "listo"; pedido: PedidoPublico };

function Rastreo({ folioInicial }: { folioInicial: string }) {
  const [folio, setFolio] = useState(folioInicial);
  const [telefonoEscrito, setTelefono] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "inicio" });
  const [errores, setErrores] = useState<{ folio?: string; telefono?: string }>({});

  // Quien vuelve de pagar con Clip llega aquí con su folio en la dirección. Si
  // es el pedido que este mismo navegador acaba de hacer, el teléfono ya se
  // sabe (está en su comprobante guardado): se consulta sin volver a pedirlo.
  // El teléfono sigue sin viajar en la URL.
  const hidratado = useTienda((s) => s.hidratado);
  const ultimo = useTienda((s) => s.ultimoPedido);
  const automatico = useRef(false);
  useEffect(() => {
    if (automatico.current || !hidratado) return;
    automatico.current = true;
    if (!folioInicial || ultimo?.folio !== folioInicial || !ultimo.telefono) return;
    const delPedido = formatearTelefono(ultimo.telefono);
    void (async () => {
      await Promise.resolve();
      setTelefono(delPedido);
      await consultar(delPedido);
    })();
    // Solo al hidratar: después manda lo que la persona escriba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidratado]);

  async function consultar(telefonoDado?: string) {
    const telefono = telefonoDado ?? telefonoEscrito;
    const f = folio.trim().toUpperCase();
    const nuevos: typeof errores = {};
    if (f.length < 4) nuevos.folio = "Escribe el folio completo, por ejemplo REY-2026-02001";
    if (telefono.replace(/\D/g, "").length < 10) nuevos.telefono = "El teléfono del pedido, a 10 dígitos";
    setErrores(nuevos);
    if (nuevos.folio || nuevos.telefono) return;

    // Un folio que puso el navegador cuando el servidor no contestó no existe
    // en el servidor: decirlo es mejor que un «no lo encontramos» a secas.
    if (esFolioLocal(f)) {
      setEstado({ tipo: "local" });
      return;
    }

    setEstado({ tipo: "consultando" });
    try {
      const pedido = await consultarPedido({ folio: f, telefono });
      setEstado({ tipo: "listo", pedido });
    } catch (e) {
      if (e instanceof ErrorRemoto && (e.estado === 404 || e.estado === 400)) {
        setEstado({ tipo: "error", mensaje: e.message, reintentable: false });
      } else if (e instanceof ErrorRemoto && e.estado === 0) {
        setEstado({
          tipo: "error",
          mensaje: "No pudimos conectar con la tienda. Revisa tu conexión y vuelve a intentarlo.",
          reintentable: true,
        });
      } else {
        setEstado({
          tipo: "error",
          mensaje: "La tienda no pudo consultar tu pedido ahora. Vuelve a intentarlo en un momento.",
          reintentable: true,
        });
      }
    }
  }

  if (estado.tipo === "listo") {
    return (
      <Resultado
        pedido={estado.pedido}
        onOtro={() => {
          setEstado({ tipo: "inicio" });
          setTelefono("");
        }}
      />
    );
  }

  return (
    <Contenedor className="py-10 lg:py-16">
      <div className="mx-auto max-w-md">
        <p className="eyebrow mb-2">Rastrear pedido</p>
        <h1 className="font-display text-[30px] leading-tight tracking-tight lg:text-[38px]">
          ¿Cómo va mi pedido?
        </h1>
        <p className="text-fg-muted mt-3 text-sm leading-relaxed">
          Escribe el folio que te dimos al confirmar (empieza con REY- o AUR-) y el
          teléfono que dejaste en el pedido. No hace falta cuenta.
        </p>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void consultar();
          }}
          className="border-border-soft bg-surface mt-6 space-y-4 rounded-lg border p-5"
        >
          <div>
            <Label htmlFor="rastreo-folio" className="mb-1.5">
              Folio
            </Label>
            <Input
              id="rastreo-folio"
              value={folio}
              onChange={(e) => setFolio(e.target.value.toUpperCase())}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="REY-2026-02001"
              className="h-12"
              aria-invalid={Boolean(errores.folio)}
            />
            {errores.folio ? (
              <p role="alert" className="text-danger mt-1.5 text-xs">
                {errores.folio}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="rastreo-telefono" className="mb-1.5">
              Teléfono del pedido
            </Label>
            <Input
              id="rastreo-telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={telefonoEscrito}
              onChange={(e) => setTelefono(formatearTelefono(e.target.value))}
              placeholder="477 123 4567"
              className="h-12"
              aria-invalid={Boolean(errores.telefono)}
            />
            {errores.telefono ? (
              <p role="alert" className="text-danger mt-1.5 text-xs">
                {errores.telefono}
              </p>
            ) : null}
          </div>

          {estado.tipo === "error" ? (
            <div role="alert" className="border-danger/30 bg-danger/5 rounded-md border px-4 py-3 text-sm">
              <p>{estado.mensaje}</p>
              {!estado.reintentable ? (
                <p className="text-fg-muted mt-1">
                  Revisa que el folio y el teléfono sean los del pedido. Si no
                  aparece, escríbenos por WhatsApp con tu folio.
                </p>
              ) : null}
            </div>
          ) : null}

          {estado.tipo === "local" ? (
            <div role="alert" className="border-warning/40 bg-warning/10 rounded-md border px-4 py-3 text-sm leading-relaxed">
              Ese folio se generó en tu teléfono porque en ese momento no hubo
              conexión con la tienda, así que no se puede rastrear aquí. Si ya nos
              mandaste el pedido por WhatsApp, te damos seguimiento por ahí.
            </div>
          ) : null}

          <Button
            type="submit"
            variant="gold"
            size="touch-lg"
            className="w-full"
            disabled={estado.tipo === "consultando"}
          >
            {estado.tipo === "consultando" ? (
              "Buscando…"
            ) : estado.tipo === "error" && estado.reintentable ? (
              <>
                <RefreshCw size={16} aria-hidden />
                Reintentar
              </>
            ) : (
              <>
                <Search size={16} aria-hidden />
                Ver mi pedido
              </>
            )}
          </Button>
        </form>

        {hayLogin() ? (
          <p className="text-fg-subtle mt-5 text-center text-sm">
            ¿Compraste con tu cuenta?{" "}
            <Link href="/cuenta" className="text-gold-light underline underline-offset-4">
              Tus pedidos están en Mi cuenta
            </Link>
          </p>
        ) : null}
      </div>
    </Contenedor>
  );
}

function Resultado({ pedido, onOtro }: { pedido: PedidoPublico; onOtro: () => void }) {
  const sesion = useSesion();
  const pago = etiquetaPago(pedido.metodo, pedido.plazo);
  const envio = etiquetaEnvio(pedido.envio);
  const lugar = [pedido.ciudad, pedido.estado].filter(Boolean).join(", ");

  return (
    <Contenedor className="py-6 lg:py-10">
      <header className="mb-8">
        <p className="eyebrow mb-2">Rastrear pedido</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1
            data-precio
            className="font-display text-[30px] leading-tight tracking-tight lg:text-[40px]"
          >
            {pedido.folio}
          </h1>
          <InsigniaEstatus estatus={pedido.estatus} />
        </div>
        <p className="text-fg-muted mt-2 text-sm">
          {formatoFechaLarga(pedido.fecha)}
          {pedido.nombre ? ` · A nombre de ${pedido.nombre}` : ""}
          {lugar ? ` · ${lugar}` : ""} ·{" "}
          <Precio valor={pedido.cifras.total} moneda className="text-fg" />
        </p>
        <button
          type="button"
          onClick={onOtro}
          className="text-gold-light mt-3 inline-flex min-h-11 items-center text-sm underline underline-offset-4"
        >
          Consultar otro pedido
        </button>
      </header>

      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:items-start lg:gap-10">
        <div className="min-w-0 space-y-6">
          <section className="border-border-soft bg-surface rounded-lg border p-5 lg:p-6">
            <h2 className="font-display mb-5 text-xl">Seguimiento</h2>
            <LineaTiempo estatus={pedido.estatus} historial={pedido.historial} />
            <BloqueGuia
              guia={pedido.guia}
              paqueteria={pedido.paqueteria}
              urlRastreo={pedido.urlRastreo}
            />
          </section>

          <NotaTienda nota={pedido.notaCliente} />

          <section>
            <h2 className="font-display mb-3 text-xl">Artículos</h2>
            <ListaLineas lineas={pedido.lineas} />
          </section>

          <section className="border-border-soft rounded-lg border p-5">
            <h2 className="font-display mb-3 text-xl">Resumen</h2>
            <DesgloseCifras cifras={pedido.cifras} />
            {pago || envio ? (
              <dl className="border-border-soft mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
                {pago ? (
                  <div>
                    <dt className="text-fg-subtle text-[11px] tracking-[0.14em] uppercase">
                      Forma de pago
                    </dt>
                    <dd className="mt-0.5">{pago}</dd>
                  </div>
                ) : null}
                {envio ? (
                  <div>
                    <dt className="text-fg-subtle text-[11px] tracking-[0.14em] uppercase">Envío</dt>
                    <dd className="mt-0.5">{envio}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </section>
        </div>

        <aside className="mt-8 space-y-3 lg:mt-0">
          {pedido.estatus === "Pendiente" ? (
            <ComoPagar
              folio={pedido.folio}
              metodo={pedido.metodo}
              plazo={pedido.plazo}
              total={pedido.cifras.total}
              urlPago={pedido.cobro?.url}
            />
          ) : null}

          {hayLogin() ? (
            <div className="border-border-soft bg-surface rounded-lg border p-5">
              {sesion.perfil ? (
                <>
                  <p className="text-fg-muted mb-3 text-sm leading-relaxed">
                    Si hiciste este pedido con tu sesión iniciada, en tu cuenta
                    ves también la dirección y puedes cancelarlo, repetirlo o
                    pedir factura.
                  </p>
                  <Button asChild variant="outline" size="touch" className="w-full">
                    <Link href={`/cuenta/pedido/?folio=${encodeURIComponent(pedido.folio)}`}>
                      Ver en mi cuenta
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-fg-muted mb-3 text-sm leading-relaxed">
                    Con una cuenta tus próximos pedidos quedan en tu historial:
                    los rastreas sin folio, los repites con un toque y pides
                    factura desde ahí.
                  </p>
                  <Button asChild variant="outline" size="touch" className="w-full">
                    <Link href="/cuenta">Crear cuenta o entrar</Link>
                  </Button>
                </>
              )}
            </div>
          ) : null}
        </aside>
      </div>
    </Contenedor>
  );
}
