"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, UserRound } from "lucide-react";
import { Boton } from "@/components/ui";
import { Mensaje } from "@/components/catalogo/comun";
import { PuertaAdmin, pesosCentavos, usePanelAdmin } from "@/components/tienda/comun";
import { EncabezadoPagina, Panel } from "@/components/panel/piezas";
import { enlacePedido, normalizar } from "@/components/pedidos/comun";
import {
  CONTACTO_VACIO,
  EditorArticulos,
  FormContacto,
  ResumenCotizacion,
  errorContacto,
  useCotizacion,
  useOpciones,
} from "@/components/pedidos/editor-articulos";
import {
  crearPedidoAdmin,
  listarClientes,
  type ArticulosPedido,
  type ClienteAdmin,
  type ContactoPedido,
} from "@/lib/tienda-admin";
import { soloDigitos } from "@/lib/utils";

/**
 * Capturar un pedido que llegó por WhatsApp, teléfono o en persona.
 *
 * Mismo camino que una compra de la tienda: el servidor sanea, cotiza con los
 * precios de hoy, asigna el folio y lo deja «Pendiente». El historial dice
 * quién lo capturó. La clave de idempotencia se fija al abrir la pantalla:
 * un doble clic en «Crear» da el mismo pedido, no dos.
 */

const ARTICULOS_VACIOS: ArticulosPedido = { items: [], metodo: "transferencia", envio: "estandar", cupon: null };

export function VistaNuevoPedido() {
  const router = useRouter();
  // Los clientes se leen solo si se busca uno: Cognito tarda con cientos de cuentas.
  const [buscarCliente, setBuscarCliente] = useState(false);
  const c = usePanelAdmin((token) => (buscarCliente ? listarClientes(token) : Promise.resolve(null)), String(buscarCliente));
  const [contacto, setContacto] = useState<ContactoPedido>(CONTACTO_VACIO);
  const [articulos, setArticulos] = useState<ArticulosPedido>(ARTICULOS_VACIOS);
  const [clave] = useState(() => crypto.randomUUID());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const catalogo = useOpciones();
  const cotizacion = useCotizacion(c.token, articulos);

  const bloqueo = PuertaAdmin({ c, titulo: "Capturar un pedido", volver: "/pedidos/" });
  if (bloqueo) return bloqueo;

  const faltaContacto = errorContacto(contacto);
  const faltaArticulos = articulos.items.length === 0 ? "Agrega al menos un artículo" : null;
  const sinCobrar = cotizacion.cotizacion !== null && cotizacion.cotizacion.lineas.length === 0;
  const motivo = faltaContacto ?? faltaArticulos ?? (sinCobrar ? "Ningún artículo se puede cobrar" : null);

  const crear = async () => {
    if (motivo) {
      setError(motivo);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const r = await crearPedidoAdmin(c.token!, { ...articulos, contacto, clave, plazo: null });
      router.push(enlacePedido(r.folio));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el pedido");
      setEnviando(false);
    }
  };

  const total = cotizacion.cotizacion?.cifras.total;

  return (
    <main className="p-4 pb-32 sm:p-6 lg:pb-12">
      <EncabezadoPagina
        titulo="Nuevo pedido"
        subtitulo="Para lo que llega por WhatsApp, teléfono o en persona. Queda «Pendiente» hasta que confirmes el pago."
        volver={{ href: "/pedidos/", texto: "Pedidos" }}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="grid gap-4">
          <Panel
            titulo="Cliente"
            subtitulo="Nombre y teléfono son obligatorios: por ahí se cierra el cobro."
            accion={
              <button
                type="button"
                onClick={() => setBuscarCliente(true)}
                className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-info hover:underline"
              >
                <UserRound size={15} /> Cliente anterior
              </button>
            }
          >
            {buscarCliente && (
              <BuscadorCliente
                clientes={c.datos?.clientes ?? null}
                cargando={c.cargando}
                error={c.error}
                alElegir={(x) => {
                  setContacto((ct) => ({
                    ...ct,
                    nombre: x.nombre || ct.nombre,
                    telefono: x.telefono || ct.telefono,
                    correo: x.correo || ct.correo,
                    ciudad: x.ciudad || ct.ciudad,
                  }));
                  setBuscarCliente(false);
                }}
                cerrar={() => setBuscarCliente(false)}
              />
            )}
            <FormContacto valor={contacto} onChange={setContacto} />
          </Panel>

          <Panel titulo="Artículos y cobro">
            <EditorArticulos
              valor={articulos}
              onChange={setArticulos}
              opciones={catalogo.opciones}
              errorCatalogo={catalogo.error}
              reintentarCatalogo={catalogo.reintentar}
            />
          </Panel>
        </div>

        <aside className="lg:sticky lg:top-4">
          <Panel titulo="Resumen" subtitulo="Calculado por el servidor con los precios de hoy">
            <ResumenCotizacion estado={cotizacion} metodoPedido={articulos.metodo} />
            {error && (
              <div className="mt-3">
                <Mensaje tono="error">{error}</Mensaje>
              </div>
            )}
            <Boton onClick={crear} disabled={enviando} className="mt-4 hidden w-full lg:inline-flex">
              <Check size={18} />
              {enviando ? "Creando…" : "Crear pedido"}
            </Boton>
            {motivo && !error && <p className="mt-2 hidden text-center text-[12px] text-fg-subtle lg:block">{motivo}</p>}
          </Panel>
        </aside>
      </div>

      {/* Teléfono: el total y el botón siempre a la mano */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-border-strong bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] text-fg-subtle">{motivo ?? "Total"}</span>
          <span className="cifra block truncate text-[18px] font-bold">{total !== undefined ? pesosCentavos(total) : "—"}</span>
        </span>
        <Boton onClick={crear} disabled={enviando} className="shrink-0">
          <Check size={18} />
          {enviando ? "Creando…" : "Crear pedido"}
        </Boton>
      </div>
    </main>
  );
}

function BuscadorCliente({
  clientes,
  cargando,
  error,
  alElegir,
  cerrar,
}: {
  clientes: ClienteAdmin[] | null;
  cargando: boolean;
  error: string | null;
  alElegir: (c: ClienteAdmin) => void;
  cerrar: () => void;
}) {
  const [q, setQ] = useState("");
  const lista = useMemo(() => {
    if (!clientes) return [];
    const n = normalizar(q.trim());
    const dig = soloDigitos(q);
    return clientes
      .filter((x) => x.nombre || x.telefono)
      .filter(
        (x) =>
          n === "" ||
          normalizar(`${x.nombre} ${x.correo} ${x.ciudad ?? ""}`).includes(n) ||
          (dig.length >= 3 && soloDigitos(x.telefono).includes(dig)),
      )
      .sort((a, b) => b.pedidos - a.pedidos)
      .slice(0, 8);
  }, [clientes, q]);

  return (
    <div className="mb-4 rounded-[var(--radius-md)] border border-border-soft bg-surface-2/40 p-3">
      <div className="flex items-center gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Buscar cliente</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, teléfono o correo"
            className="h-11 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface pl-9 pr-3"
          />
        </label>
        <button type="button" onClick={cerrar} className="min-h-11 px-2 text-[13px] font-semibold text-fg-subtle hover:text-fg">
          Cerrar
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-[13px] text-danger">No se pudieron leer los clientes: {error}</p>
      ) : !clientes ? (
        <p className="mt-2 text-[13px] text-fg-subtle">{cargando ? "Leyendo los clientes…" : ""}</p>
      ) : lista.length === 0 ? (
        <p className="mt-2 text-[13px] text-fg-subtle">Nadie coincide.</p>
      ) : (
        <ul className="mt-2 grid gap-1">
          {lista.map((x) => (
            <li key={x.clave}>
              <button
                type="button"
                onClick={() => alElegir(x)}
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--radius-md)] px-2 text-left hover:bg-surface"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">{x.nombre || x.correo || x.telefono}</span>
                  <span className="block truncate text-[12px] text-fg-subtle">
                    {[x.telefono, x.ciudad].filter(Boolean).join(" · ") || x.correo}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] text-fg-subtle">
                  {x.pedidos} {x.pedidos === 1 ? "pedido" : "pedidos"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
