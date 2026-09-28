"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  MessageCircle,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Truck,
  XCircle,
} from "lucide-react";
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
import { Precio } from "@/components/comunes/precio";
import { MARCA } from "@/data/contenido";
import { formatoFechaLarga } from "@/lib/format";
import {
  cancelarPedidoCliente,
  ErrorRemoto,
  haySincronizacion,
  leerPedidoCliente,
} from "@/lib/cuenta-remota";
import { hayLogin, useSesion, type Perfil } from "@/lib/sesion";
import type { PedidoDetalle } from "@/types";
import { AvisoTiendaPrincipal } from "./aviso-tienda-principal";
import { FormularioFactura } from "./formulario-factura";
import {
  BloqueGuia,
  ComoPagar,
  DesgloseCifras,
  EstiloImpresion,
  InsigniaEstatus,
  LineaTiempo,
  ListaLineas,
  NotaTienda,
  enlaceWhatsApp,
  etiquetaEnvio,
  etiquetaPago,
} from "./pedido-comun";
import { useVolverAPedir } from "./volver-a-pedir";

/**
 * El detalle de un pedido de la cuenta, con su seguimiento.
 *
 * El folio viaja en la consulta (`?folio=`) y no en la ruta: el sitio es una
 * exportación estática y un folio creado después de compilar no tendría
 * página. Es el mismo problema que el panel resolvió igual, con `/ficha/?id=`.
 *
 * El pedido se lee de `GET /pedidos/{folio}`, que solo lo entrega a su dueño:
 * lo que se enseña —estatus, guía, líneas y cifras— es lo del servidor, lo
 * mismo que ve el panel, no una copia guardada en el navegador.
 */
export function VistaPedido() {
  const folio = (useSearchParams().get("folio") ?? "").trim();
  const sesion = useSesion();

  if (!folio) {
    return (
      <Aviso titulo="Falta el folio" texto="El enlace llegó incompleto. Tus pedidos están en tu cuenta.">
        <Button asChild variant="gold" size="touch-lg">
          <Link href="/cuenta">Ir a mi cuenta</Link>
        </Button>
      </Aviso>
    );
  }

  if (!hayLogin()) {
    return (
      <AvisoTiendaPrincipal
        titulo="Tus pedidos viven en la tienda principal"
        texto="Esta copia de la tienda no guarda cuentas ni pedidos. Ábrelo en la tienda principal para ver cómo va."
        ruta={`/cuenta/pedido/?folio=${encodeURIComponent(folio)}`}
        cta="Ver mi pedido"
      />
    );
  }

  if (!sesion.listo) return <Esqueleto />;

  if (!sesion.perfil) {
    return (
      <Aviso
        titulo="Entra para ver este pedido"
        texto="El detalle de un pedido solo se enseña a la cuenta con la que se hizo. Si compraste sin cuenta, puedes rastrearlo con tu folio y tu teléfono."
      >
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild variant="gold" size="touch-lg">
            <Link href="/cuenta">Entrar a mi cuenta</Link>
          </Button>
          <Button asChild variant="outline" size="touch-lg">
            <Link href={`/rastreo/?folio=${encodeURIComponent(folio)}`}>
              <Search size={16} aria-hidden />
              Rastrear sin cuenta
            </Link>
          </Button>
        </div>
      </Aviso>
    );
  }

  if (!haySincronizacion()) {
    return (
      <Aviso
        titulo="Tus pedidos no están disponibles aquí"
        texto="Esta versión de la tienda no está conectada al servidor de pedidos."
      />
    );
  }

  // `key`: otra cuenta u otro folio empiezan de cero, sin enseñar un instante
  // el pedido anterior.
  return <PedidoDeLaCuenta key={`${sesion.perfil.sub}|${folio}`} folio={folio} perfil={sesion.perfil} />;
}

type Estado =
  | { tipo: "listo"; pedido: PedidoDetalle }
  | { tipo: "noEncontrado" }
  | { tipo: "error"; mensaje: string };

function PedidoDeLaCuenta({ folio, perfil }: { folio: string; perfil: Perfil }) {
  const [intento, setIntento] = useState(0);
  const [traido, setTraido] = useState<{ intento: number; estado: Estado } | null>(null);
  const recargar = () => setIntento((n) => n + 1);

  useEffect(() => {
    let vivo = true;
    leerPedidoCliente(folio)
      .then((pedido) => vivo && setTraido({ intento, estado: { tipo: "listo", pedido } }))
      .catch((e) => {
        if (!vivo) return;
        if (e instanceof ErrorRemoto && e.estado === 404) {
          setTraido({ intento, estado: { tipo: "noEncontrado" } });
          return;
        }
        const mensaje =
          e instanceof ErrorRemoto && e.estado === 401
            ? "Tu sesión venció. Vuelve a entrar desde Mi cuenta."
            : e instanceof ErrorRemoto && e.estado === 0
              ? "No pudimos conectar con la tienda. Revisa tu conexión y vuelve a intentarlo."
              : "La tienda no pudo traer tu pedido ahora. Vuelve a intentarlo en un momento.";
        setTraido({ intento, estado: { tipo: "error", mensaje } });
      });
    return () => {
      vivo = false;
    };
  }, [folio, intento]);

  // Mientras se recarga se sigue viendo el pedido anterior: tras cancelar o
  // un 409, parpadear a un esqueleto sería peor que esperar un momento.
  // Un error o un «no encontrado» sí se quitan al reintentar: si se quedaran,
  // el botón parecería no hacer nada.
  if (!traido || (traido.intento !== intento && traido.estado.tipo !== "listo")) {
    return <Esqueleto />;
  }
  const { estado } = traido;

  if (estado.tipo === "noEncontrado") {
    return (
      <Aviso
        titulo="No encontramos ese pedido en tu cuenta"
        texto="Puede que se haya hecho sin iniciar sesión o con otra cuenta. Con el folio y el teléfono del pedido puedes rastrearlo igual."
      >
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild variant="gold" size="touch-lg">
            <Link href={`/rastreo/?folio=${encodeURIComponent(folio)}`}>
              <Search size={16} aria-hidden />
              Rastrear con folio y teléfono
            </Link>
          </Button>
          <Button asChild variant="outline" size="touch-lg">
            <Link href="/cuenta">Ir a mi cuenta</Link>
          </Button>
        </div>
      </Aviso>
    );
  }

  if (estado.tipo === "error") {
    return (
      <Aviso titulo="No pudimos cargar tu pedido" texto={estado.mensaje}>
        <Button variant="goldOutline" size="touch-lg" onClick={recargar}>
          <RefreshCw size={16} aria-hidden />
          Reintentar
        </Button>
      </Aviso>
    );
  }

  return (
    <Detalle
      pedido={estado.pedido}
      perfil={perfil}
      recargando={traido.intento !== intento}
      onActualizado={(pedido) => setTraido({ intento, estado: { tipo: "listo", pedido } })}
      onRecargar={recargar}
    />
  );
}

function Esqueleto() {
  return (
    <Contenedor className="py-10">
      <div className="h-64 animate-pulse rounded-lg bg-white/5" aria-busy="true" />
    </Contenedor>
  );
}

function Aviso({
  titulo,
  texto,
  children,
}: {
  titulo: string;
  texto: string;
  children?: React.ReactNode;
}) {
  return (
    <Contenedor className="py-20 text-center">
      <h1 className="font-display mb-3 text-3xl">{titulo}</h1>
      <p className="text-fg-muted mx-auto mb-7 max-w-lg leading-relaxed">{texto}</p>
      {children}
    </Contenedor>
  );
}

function Detalle({
  pedido,
  perfil,
  recargando,
  onActualizado,
  onRecargar,
}: {
  pedido: PedidoDetalle;
  perfil: Perfil;
  recargando: boolean;
  onActualizado: (p: PedidoDetalle) => void;
  onRecargar: () => void;
}) {
  const volverAPedir = useVolverAPedir();
  const [factura, setFactura] = useState(false);
  // Vive aquí y no en «Cancelar»: tras un 409 el pedido se recarga, deja de
  // ser cancelable y ese botón desaparece — con él se iría la explicación.
  const [aviso, setAviso] = useState<string | null>(null);
  const c = pedido.contacto;
  const pago = etiquetaPago(pedido.metodo, pedido.plazo);
  const envio = etiquetaEnvio(pedido.envio);
  const tieneDireccion = Boolean(c.calle || c.ciudad);
  const items = pedido.lineas.map((l) => ({
    productoId: l.productoId,
    ml: l.ml,
    cantidad: l.cantidad,
  }));
  const nombres = new Map(pedido.lineas.map((l) => [`${l.productoId}|${l.ml}`, l.nombre]));

  return (
    <Contenedor className="py-6 lg:py-10">
      <EstiloImpresion />
      <div data-comprobante>
        <Breadcrumb className="mb-5 print:hidden">
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

        {/* Solo en papel: de quién es el comprobante. En pantalla lo dice la
            cabecera de la tienda, que no se imprime. */}
        <p className="mb-4 hidden text-sm print:block">
          {MARCA.nombre} · Comprobante de pedido · WhatsApp {MARCA.whatsapp}
        </p>

        <header className="mb-8">
          <p className="eyebrow mb-2">Pedido</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1
              data-precio
              className="font-display text-[30px] leading-tight tracking-tight lg:text-[40px]"
            >
              {pedido.folio}
            </h1>
            <InsigniaEstatus estatus={pedido.estatus} />
            {recargando ? (
              <span className="text-fg-subtle text-xs" aria-live="polite">
                Actualizando…
              </span>
            ) : null}
          </div>
          <p className="text-fg-muted mt-2 text-sm">
            {formatoFechaLarga(pedido.fecha)} · {pedido.cifras.piezas}{" "}
            {pedido.cifras.piezas === 1 ? "pieza" : "piezas"} ·{" "}
            <Precio valor={pedido.cifras.total} moneda className="text-fg" />
          </p>
          {pedido.heredado ? (
            <p className="border-border-soft text-fg-muted mt-4 rounded-md border px-4 py-3 text-sm leading-relaxed">
              Este pedido es de antes de que guardáramos el desglose: aquí está lo
              que se registró. Si necesitas el detalle de precios, escríbenos con
              tu folio.
            </p>
          ) : null}
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
              <ListaLineas lineas={pedido.lineas} heredado={pedido.heredado} />
            </section>

            <section className="border-border-soft rounded-lg border p-5">
              <h2 className="font-display mb-3 text-xl">Resumen</h2>
              <DesgloseCifras cifras={pedido.cifras} heredado={pedido.heredado} />
            </section>

            {tieneDireccion || pago || envio ? (
              <section className="border-border-soft grid gap-5 rounded-lg border p-5 sm:grid-cols-2">
                {tieneDireccion ? (
                  <div>
                    <h2 className="text-fg-subtle mb-1.5 text-[11px] tracking-[0.14em] uppercase">
                      Entrega en
                    </h2>
                    <address className="text-sm leading-relaxed not-italic">
                      {c.nombre}
                      <br />
                      {c.calle}
                      {c.colonia ? (
                        <>
                          <br />
                          {c.colonia}
                        </>
                      ) : null}
                      <br />
                      {[c.cp, c.ciudad].filter(Boolean).join(" ")}
                      {c.estado ? `, ${c.estado}` : ""}
                      {c.referencias ? (
                        <>
                          <br />
                          <span className="text-fg-muted">Referencias: {c.referencias}</span>
                        </>
                      ) : null}
                      {c.telefono ? (
                        <>
                          <br />
                          <span className="text-fg-muted">Tel. {c.telefono}</span>
                        </>
                      ) : null}
                    </address>
                  </div>
                ) : null}
                <dl className="grid content-start gap-3 text-sm">
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
                      <dt className="text-fg-subtle text-[11px] tracking-[0.14em] uppercase">
                        Envío
                      </dt>
                      <dd className="mt-0.5">{envio}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}
          </div>

          <aside className="mt-8 space-y-3 lg:mt-0 print:hidden">
            {aviso ? (
              <p
                role="status"
                className="border-warning/40 bg-warning/10 rounded-md border px-4 py-3 text-sm leading-relaxed"
              >
                {aviso}
              </p>
            ) : null}

            {pedido.estatus === "Pendiente" ? (
              <ComoPagar
                folio={pedido.folio}
                metodo={pedido.metodo}
                plazo={pedido.plazo}
                total={pedido.cifras.total}
              />
            ) : null}

            <div className="border-border-soft bg-surface grid gap-2 rounded-lg border p-5">
              <h2 className="font-display mb-1 text-lg">Acciones</h2>
              {items.length > 0 ? (
                <Button
                  variant="goldOutline"
                  size="touch"
                  className="w-full"
                  onClick={() => volverAPedir(items, nombres)}
                >
                  <RotateCcw size={15} aria-hidden />
                  Volver a pedir
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="touch"
                className="w-full"
                onClick={() => window.print()}
              >
                <Printer size={15} aria-hidden />
                Imprimir comprobante
              </Button>
              {pedido.estatus !== "Cancelado" && !pedido.heredado ? (
                <Button
                  variant="outline"
                  size="touch"
                  className="w-full"
                  aria-expanded={factura}
                  onClick={() => setFactura((v) => !v)}
                >
                  <FileText size={15} aria-hidden />
                  Solicitar factura
                </Button>
              ) : null}
              {pedido.cancelable ? (
                <Cancelar
                  folio={pedido.folio}
                  onCancelado={(p) => {
                    setAviso("Cancelamos tu pedido. Si hiciste algún pago, escríbenos y lo revisamos.");
                    onActualizado(p);
                  }}
                  onYaNoSePuede={(mensaje) => {
                    setAviso(mensaje);
                    onRecargar();
                  }}
                />
              ) : null}
            </div>

            {factura ? (
              <FormularioFactura
                folio={pedido.folio}
                inicial={{
                  nombre: c.nombre || perfil.nombre,
                  telefono: c.telefono || perfil.telefono,
                  correo: perfil.correo || c.correo,
                }}
                onCerrar={() => setFactura(false)}
              />
            ) : null}

            <div className="border-border-soft bg-surface rounded-lg border p-5">
              <h2 className="font-display mb-3 text-lg">¿Algo no cuadra?</h2>
              <p className="text-fg-muted mb-4 text-sm leading-relaxed">
                Escríbenos con tu folio y lo resolvemos. Te atiende una persona.
              </p>
              <Button asChild variant="gold" size="touch" className="w-full">
                <a
                  href={enlaceWhatsApp(`Hola, tengo una duda sobre mi pedido ${pedido.folio}.`)}
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
                Cuando tu pedido sale te mandamos la guía por WhatsApp, y aparece
                aquí mismo con el enlace para rastrearla.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </Contenedor>
  );
}

/**
 * «Cancelar pedido», con confirmación en el mismo sitio.
 *
 * Solo aparece mientras el pedido está «Pendiente», pero el servidor es quien
 * decide: si mientras tanto la tienda registró el pago, contesta 409 y aquí se
 * explica y se recarga el pedido para enseñar su estatus de ahora.
 */
function Cancelar({
  folio,
  onCancelado,
  onYaNoSePuede,
}: {
  folio: string;
  onCancelado: (p: PedidoDetalle) => void;
  /** 409: el pedido ya cambió (se pagó, o ya estaba cancelado). */
  onYaNoSePuede: (mensaje: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancelar() {
    setEnviando(true);
    setError(null);
    try {
      const pedido = await cancelarPedidoCliente(folio);
      setAbierto(false);
      onCancelado(pedido);
    } catch (e) {
      if (e instanceof ErrorRemoto && e.estado === 409) {
        setAbierto(false);
        // El servidor ya lo explica («ya no se puede cancelar: está
        // "Pagado"…»); el pedido se recarga para que se vea su estatus.
        onYaNoSePuede(e.message);
      } else if (e instanceof ErrorRemoto && e.estado === 0) {
        setError("No pudimos conectar con la tienda. El pedido no se canceló; vuelve a intentarlo.");
      } else {
        setError(
          e instanceof ErrorRemoto ? e.message : "No se pudo cancelar. Vuelve a intentarlo.",
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="border-border-soft mt-1 border-t pt-3">
      {error ? (
        <p role="alert" className="text-danger mb-2 text-sm">
          {error}
        </p>
      ) : null}
      {!abierto ? (
        <Button
          variant="ghost"
          size="touch"
          className="text-danger w-full"
          onClick={() => {
            setAbierto(true);
            setError(null);
          }}
        >
          <XCircle size={15} aria-hidden />
          Cancelar pedido
        </Button>
      ) : (
        <div className="border-danger/30 bg-danger/5 rounded-md border p-3">
          <p className="mb-3 text-sm leading-relaxed">
            ¿Cancelar el pedido {folio}? Se libera lo que apartamos y ya no se
            puede reactivar: tendrías que hacer uno nuevo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" size="touch" disabled={enviando} onClick={cancelar}>
              {enviando ? "Cancelando…" : "Sí, cancelar"}
            </Button>
            <Button
              variant="ghost"
              size="touch"
              disabled={enviando}
              onClick={() => setAbierto(false)}
            >
              No, conservarlo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
