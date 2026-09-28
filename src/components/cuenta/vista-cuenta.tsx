"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Heart,
  MapPin,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Truck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Contenedor } from "@/components/comunes/layout";
import { Precio } from "@/components/comunes/precio";
import { GridProductos } from "@/components/producto/grid-productos";
import { piezasVendidas } from "@/data/cuenta";
import { InicioSesion } from "@/components/cuenta/inicio-sesion";
import { AccesoPanelCuenta } from "@/components/comunes/acceso-panel";
import { hayLogin, useSesion, type Perfil, type Sesion } from "@/lib/sesion";
import {
  ErrorRemoto,
  guardarDireccionesRemotas,
  haySincronizacion,
  leerDireccionesRemotas,
  leerPedidosCliente,
} from "@/lib/cuenta-remota";
import { PRODUCTOS } from "@/data/productos";
import { formatoFechaLarga } from "@/lib/format";
import { useTienda } from "@/store/tienda";
import type { Direccion, EstatusPedido, ResumenPedido } from "@/types";
import { ESTATUS_PEDIDO, nombrePaqueteria } from "../../../compartido/pedido";
import { NivelCliente } from "./nivel-cliente";
import { MisDatosCuenta } from "./mis-datos";
import { AvisoTiendaPrincipal } from "./aviso-tienda-principal";
import { InsigniaEstatus } from "./pedido-comun";
import { useVolverAPedir } from "./volver-a-pedir";
import { cn } from "@/lib/utils";

/**
 * «Mi cuenta».
 *
 * Tres casos, y en ninguno se inventa nada:
 * - Sin Cognito (GitHub Pages): no hay cuenta que enseñar; se manda a la
 *   tienda principal. Antes salía una cuenta de muestra sin pedir entrar.
 * - Con Cognito y sin sesión: la pantalla de acceso.
 * - Con sesión: los datos de la cuenta. Si el servidor no contesta, se dice
 *   que no contestó y se ofrece «Reintentar» — nunca «no hay pedidos».
 */
export function VistaCuenta() {
  const sesion = useSesion();

  if (!hayLogin()) {
    return (
      <AvisoTiendaPrincipal
        titulo="Tu cuenta vive en la tienda principal"
        texto="Esta copia de la tienda no guarda cuentas. Entra en la tienda principal para ver tus pedidos, tus direcciones y tu nivel de cliente."
        ruta="/cuenta/"
        cta="Ir a mi cuenta"
      />
    );
  }

  // Antes de leer `localStorage` no se sabe si hay sesión: pintar la pantalla
  // de acceso y quitarla medio segundo después es peor que esperar.
  if (!sesion.listo) return null;

  if (!sesion.perfil) {
    return (
      <Contenedor className="py-10 lg:py-16">
        <InicioSesion sesion={sesion} />
      </Contenedor>
    );
  }

  // `key`: si alguien cierra sesión y entra con otra cuenta en la misma
  // pestaña, nada de la anterior (pedidos, libreta, filtros) sobrevive.
  return <CuentaConSesion key={sesion.perfil.sub} sesion={sesion} perfil={sesion.perfil} />;
}

/* ── Pedidos ──────────────────────────────────────────────────────────── */

type EstadoPedidos =
  | { tipo: "cargando" }
  | { tipo: "sinServidor" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; pedidos: ResumenPedido[] };

/** Mensaje de un fallo al leer, que distingue «sin red» de «sesión vencida». */
function mensajeDeError(e: unknown, que: string): string {
  if (e instanceof ErrorRemoto && e.estado === 401) {
    return "Tu sesión venció. Cierra sesión y vuelve a entrar.";
  }
  if (e instanceof ErrorRemoto && e.estado === 0) {
    return `No pudimos conectar con la tienda para traer ${que}. Revisa tu conexión y vuelve a intentarlo.`;
  }
  return `La tienda no pudo traer ${que} ahora. Vuelve a intentarlo en un momento.`;
}

/**
 * «Mis pedidos» del servidor, con el estatus de ahora.
 *
 * La respuesta se guarda junto a la clave del intento (`intento`): «Reintentar»
 * cambia la clave y la pantalla vuelve a «cargando» sin tener que borrar nada
 * dentro de un efecto.
 */
function usePedidos(): EstadoPedidos & { reintentar: () => void } {
  const [intento, setIntento] = useState(0);
  const [traido, setTraido] = useState<{ intento: number; estado: EstadoPedidos } | null>(null);
  const reintentar = () => setIntento((n) => n + 1);

  useEffect(() => {
    if (!haySincronizacion()) return;
    let vivo = true;
    leerPedidosCliente()
      .then((pedidos) => vivo && setTraido({ intento, estado: { tipo: "listo", pedidos } }))
      .catch(
        (e) =>
          vivo &&
          setTraido({ intento, estado: { tipo: "error", mensaje: mensajeDeError(e, "tus pedidos") } }),
      );
    return () => {
      vivo = false;
    };
  }, [intento]);

  if (!haySincronizacion()) return { tipo: "sinServidor", reintentar };
  if (traido?.intento !== intento) return { tipo: "cargando", reintentar };
  return { ...traido.estado, reintentar };
}

function CuentaConSesion({ sesion, perfil }: { sesion: Sesion; perfil: Perfil }) {
  const hidratado = useTienda((s) => s.hidratado);
  const favoritos = useTienda((s) => s.favoritos);
  const pedidos = usePedidos();

  const productosFavoritos = PRODUCTOS.filter((p) => favoritos.includes(p.id));
  const nombre = perfil.nombre || perfil.correo;
  // Solo cuentan piezas de pedidos vendidos: la misma regla del panel.
  const piezas = pedidos.tipo === "listo" ? piezasVendidas(pedidos.pedidos) : null;

  return (
    <Contenedor className="py-6 lg:py-10">
      {/* `useSearchParams` pide su propio límite de Suspense en la exportación
          estática; va aislado para que el resto de la cuenta no espere. */}
      <Suspense fallback={null}>
        <AvisoVolverCheckout />
      </Suspense>

      <header className="mb-7">
        <p className="eyebrow mb-2">Mi cuenta</p>
        <h1 className="font-display text-[32px] leading-tight tracking-tight lg:text-[42px]">
          Hola, {nombre.split(" ")[0]}
        </h1>
        <p className="text-fg-muted mt-2 text-sm">{perfil.correo}</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={sesion.salir}
            className="text-fg-subtle hover:text-fg-muted inline-flex min-h-11 items-center text-sm"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Solo para admins y equipo: el resto de las cuentas no lo ve. */}
        <AccesoPanelCuenta perfil={perfil} className="mt-5" />
      </header>

      <Tabs defaultValue="pedidos">
        <TabsList className="mb-7 grid h-auto w-full grid-cols-2 gap-1 sm:w-auto sm:grid-cols-4">
          <TabsTrigger value="pedidos" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <Package size={15} aria-hidden />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="direcciones" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <MapPin size={15} aria-hidden />
            Direcciones
          </TabsTrigger>
          <TabsTrigger value="favoritos" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <Heart size={15} aria-hidden />
            Favoritos
          </TabsTrigger>
          <TabsTrigger value="datos" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <User size={15} aria-hidden />
            Mis datos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos">
          <div className="lg:grid lg:grid-cols-[1fr_340px] lg:items-start lg:gap-8">
            <div className="min-w-0">
              <ListaPedidos estado={pedidos} />
            </div>
            <div className="mt-6 lg:mt-0">
              {piezas !== null ? (
                <NivelCliente piezas={piezas} />
              ) : pedidos.tipo === "cargando" ? (
                <div className="h-48 animate-pulse rounded-lg bg-white/5" />
              ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="direcciones">
          <Direcciones nombre={perfil.nombre} telefono={perfil.telefono} />
        </TabsContent>

        <TabsContent value="favoritos">
          {!hidratado ? (
            <div className="h-40 animate-pulse rounded-lg bg-white/5" />
          ) : productosFavoritos.length === 0 ? (
            <div className="border-border-soft rounded-lg border border-dashed px-6 py-14 text-center">
              <Heart size={28} className="text-fg-subtle mx-auto mb-3" aria-hidden />
              <p className="font-display mb-2 text-xl">Todavía no guardas nada</p>
              <p className="text-fg-muted mb-6 text-sm">
                Toca el corazón en cualquier perfume para guardarlo aquí.
              </p>
              <Button asChild variant="gold" size="touch">
                <Link href="/catalogo">Ver el catálogo</Link>
              </Button>
            </div>
          ) : (
            <GridProductos productos={productosFavoritos} />
          )}
        </TabsContent>

        <TabsContent value="datos">
          <MisDatosCuenta sesion={sesion} perfil={perfil} piezas={piezas} />
        </TabsContent>
      </Tabs>
    </Contenedor>
  );
}

/**
 * «Vuelve a tu compra», cuando se llegó a entrar desde el checkout
 * (`/cuenta/?volver=checkout`). No redirige solo: quien acaba de crear su
 * cuenta puede querer mirarla antes, y el carrito no se va a ningún lado.
 */
function AvisoVolverCheckout() {
  const volver = useSearchParams().get("volver") === "checkout";
  const piezas = useTienda((s) => s.carrito.reduce((n, i) => n + i.cantidad, 0));
  if (!volver || piezas === 0) return null;
  return (
    <div className="border-gold/35 bg-gold-muted mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border px-4 py-3">
      <p className="text-sm">Listo, ya entraste. Tu carrito te espera.</p>
      <Button asChild variant="gold" size="touch">
        <Link href="/checkout">
          Volver a finalizar compra
          <ArrowRight size={15} aria-hidden />
        </Link>
      </Button>
    </div>
  );
}

/** Un estado de error con «Reintentar», el mismo para pedidos y direcciones. */
function ErrorConReintento({
  titulo,
  mensaje,
  onReintentar,
}: {
  titulo: string;
  mensaje: string;
  onReintentar: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-danger/30 bg-danger/5 rounded-lg border px-6 py-10 text-center"
    >
      <p className="font-display mb-2 text-xl">{titulo}</p>
      <p className="text-fg-muted mx-auto mb-6 max-w-md text-sm leading-relaxed">{mensaje}</p>
      <Button variant="goldOutline" size="touch" onClick={onReintentar}>
        <RefreshCw size={15} aria-hidden />
        Reintentar
      </Button>
    </div>
  );
}

type Filtro = "todos" | EstatusPedido;

function ListaPedidos({ estado }: { estado: ReturnType<typeof usePedidos> }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const volverAPedir = useVolverAPedir();

  if (estado.tipo === "cargando") {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Cargando tus pedidos">
        <div className="h-28 animate-pulse rounded-md bg-white/5" />
        <div className="h-28 animate-pulse rounded-md bg-white/5" />
      </div>
    );
  }

  if (estado.tipo === "sinServidor") {
    return (
      <div className="border-border-soft rounded-lg border border-dashed px-6 py-14 text-center">
        <Package size={28} className="text-fg-subtle mx-auto mb-3" aria-hidden />
        <p className="font-display mb-2 text-xl">Tus pedidos no están disponibles aquí</p>
        <p className="text-fg-muted text-sm">
          Esta versión de la tienda no está conectada al servidor de pedidos.
        </p>
      </div>
    );
  }

  if (estado.tipo === "error") {
    return (
      <ErrorConReintento
        titulo="No pudimos cargar tus pedidos"
        mensaje={estado.mensaje}
        onReintentar={estado.reintentar}
      />
    );
  }

  const { pedidos } = estado;
  if (pedidos.length === 0) {
    return (
      <div className="border-border-soft rounded-lg border border-dashed px-6 py-14 text-center">
        <Package size={28} className="text-fg-subtle mx-auto mb-3" aria-hidden />
        <p className="font-display mb-2 text-xl">Todavía no hay pedidos</p>
        <p className="text-fg-muted mb-6 text-sm">
          Los pedidos que hagas con tu sesión iniciada aparecen aquí, con su folio
          y cómo van.
        </p>
        <div className="flex flex-col items-center gap-2">
          <Button asChild variant="gold" size="touch">
            <Link href="/catalogo">Ver el catálogo</Link>
          </Button>
          <Button asChild variant="goldGhost" size="touch">
            <Link href="/rastreo">¿Compraste sin cuenta? Rastrea tu pedido</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Solo los estatus que de verdad aparecen: seis chips para dos pedidos
  // serían ruido. «Todos» siempre.
  const conteo = new Map<EstatusPedido, number>();
  for (const p of pedidos) conteo.set(p.estatus, (conteo.get(p.estatus) ?? 0) + 1);
  const chips = ESTATUS_PEDIDO.filter((e) => conteo.has(e));
  // Si el filtro elegido se quedó sin pedidos (se canceló el último), se
  // vuelve a «Todos» en vez de enseñar una lista vacía engañosa.
  const activo: Filtro = filtro !== "todos" && !conteo.has(filtro) ? "todos" : filtro;
  const visibles = activo === "todos" ? pedidos : pedidos.filter((p) => p.estatus === activo);

  return (
    <div>
      {chips.length > 1 ? (
        <div role="group" aria-label="Filtrar por estatus" className="mb-4 flex flex-wrap gap-2">
          {(["todos", ...chips] as Filtro[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={activo === f}
              onClick={() => setFiltro(f)}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors",
                activo === f
                  ? "border-gold bg-gold-muted text-gold-light"
                  : "border-border-soft text-fg-muted hover:border-border-strong",
              )}
            >
              {f === "todos" ? "Todos" : f}
              <span data-precio className="text-fg-subtle text-xs">
                {f === "todos" ? pedidos.length : conteo.get(f)}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <ul className="space-y-3">
        {visibles.map((p) => {
          const paqueteria = nombrePaqueteria(p.paqueteria);
          return (
            <li
              key={p.folio}
              className="border-border-soft bg-surface lift rounded-md border p-4 lg:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p data-precio className="font-medium">
                    {p.folio}
                  </p>
                  <p className="text-fg-subtle mt-0.5 text-xs">
                    {formatoFechaLarga(p.fecha)} · {p.piezas}{" "}
                    {p.piezas === 1 ? "pieza" : "piezas"}
                  </p>
                </div>
                <InsigniaEstatus estatus={p.estatus} />
              </div>

              {p.guia && p.estatus === "En camino" ? (
                <p className="text-fg-muted mt-2 flex items-center gap-1.5 text-xs">
                  <Truck size={13} className="text-gold shrink-0" aria-hidden />
                  Guía <span data-precio>{p.guia}</span>
                  {paqueteria ? ` · ${paqueteria}` : ""}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <Precio valor={p.total} moneda className="font-medium" />
                <div className="flex flex-wrap gap-2">
                  {p.items.length > 0 ? (
                    <Button
                      variant="goldGhost"
                      size="touch"
                      onClick={() => volverAPedir(p.items)}
                    >
                      <RotateCcw size={15} aria-hidden />
                      Volver a pedir
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" size="touch">
                    <Link href={`/cuenta/pedido/?folio=${encodeURIComponent(p.folio)}`}>
                      Ver detalle y rastreo
                    </Link>
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Direcciones ──────────────────────────────────────────────────────── */

type EstadoLibreta =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; direcciones: Direccion[] };

/**
 * La libreta de direcciones del servidor.
 *
 * **Si no se pudo leer, no se deja editar.** La libreta se guarda entera
 * (`PUT` la sustituye), así que pintar una lista vacía tras un fallo de red y
 * dejar agregar una dirección borraba sin aviso todas las demás. Ahora el fallo
 * se dice, con «Reintentar», y los botones de edición no aparecen hasta que la
 * libreta se leyó bien.
 */
function Direcciones({ nombre, telefono }: { nombre: string; telefono: string }) {
  const [intento, setIntento] = useState(0);
  const [traido, setTraido] = useState<{ intento: number; estado: EstadoLibreta } | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  // La que se acaba de agregar y todavía no se guarda: si se cancela, se va.
  const [nueva, setNueva] = useState<string | null>(null);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  useEffect(() => {
    if (!haySincronizacion()) return;
    let vivo = true;
    leerDireccionesRemotas()
      .then(
        (r) => vivo && setTraido({ intento, estado: { tipo: "listo", direcciones: r.direcciones } }),
      )
      .catch(
        (e) =>
          vivo &&
          setTraido({
            intento,
            estado: { tipo: "error", mensaje: mensajeDeError(e, "tus direcciones") },
          }),
      );
    return () => {
      vivo = false;
    };
  }, [intento]);

  if (!haySincronizacion()) {
    return (
      <div className="border-border-soft rounded-lg border border-dashed px-6 py-12 text-center">
        <MapPin size={28} className="text-fg-subtle mx-auto mb-3" aria-hidden />
        <p className="font-display mb-2 text-xl">La libreta no está disponible aquí</p>
        <p className="text-fg-muted text-sm">
          Esta versión de la tienda no está conectada al servidor de cuentas.
        </p>
      </div>
    );
  }

  const estado: EstadoLibreta =
    traido?.intento === intento ? traido.estado : { tipo: "cargando" };

  if (estado.tipo === "cargando") {
    return <div className="h-40 animate-pulse rounded-lg bg-white/5" aria-busy="true" />;
  }
  if (estado.tipo === "error") {
    return (
      <ErrorConReintento
        titulo="No pudimos cargar tus direcciones"
        mensaje={`${estado.mensaje} Mientras tanto no se pueden editar, para no perder las que ya tienes.`}
        onReintentar={() => setIntento((n) => n + 1)}
      />
    );
  }

  const direcciones = estado.direcciones;
  const poner = (lista: Direccion[]) =>
    setTraido({ intento, estado: { tipo: "listo", direcciones: lista } });

  /**
   * Aplica un cambio y lo sube.
   *
   * Se pinta primero y se guarda después: editar una dirección no puede
   * quedarse esperando a la red. Lo que responde el servidor manda, porque es
   * quien decide cuál queda como predeterminada.
   */
  function aplicar(siguiente: Direccion[]) {
    poner(siguiente);
    setErrorGuardado(null);
    guardarDireccionesRemotas(siguiente)
      .then((r) => poner(r.direcciones))
      .catch(() =>
        setErrorGuardado(
          "No se pudo guardar en tu cuenta. Revisa la conexión y vuelve a intentarlo.",
        ),
      );
  }

  function agregar() {
    const id = `d${Date.now()}`;
    // No se sube todavía: una dirección en blanco no vale de nada guardada, y
    // se guarda sola al pulsar «Guardar» del formulario.
    poner([
      ...direcciones,
      {
        id,
        alias: "Nueva dirección",
        nombre,
        calle: "",
        colonia: "",
        cp: "",
        ciudad: "",
        estado: "",
        telefono,
        predeterminada: direcciones.length === 0,
      },
    ]);
    setEditando(id);
    setNueva(id);
  }

  return (
    <div>
      {errorGuardado ? (
        <p
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger mb-3 rounded-md border px-3 py-2 text-sm"
        >
          {errorGuardado}
        </p>
      ) : null}

      {direcciones.length === 0 ? (
        <div className="border-border-soft rounded-lg border border-dashed px-6 py-12 text-center">
          <MapPin size={28} className="text-fg-subtle mx-auto mb-3" aria-hidden />
          <p className="font-display mb-2 text-xl">Todavía no hay direcciones</p>
          <p className="text-fg-muted text-sm">
            Guarda una y la tendrás lista para el siguiente pedido, desde
            cualquier dispositivo.
          </p>
        </div>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {direcciones.map((d) => (
          <li
            key={d.id}
            className={cn(
              "bg-surface rounded-md border p-4",
              d.predeterminada ? "border-gold/40" : "border-border-soft",
            )}
          >
            {editando === d.id ? (
              <FormDireccion
                direccion={d}
                onGuardar={(guardada) => {
                  aplicar(direcciones.map((x) => (x.id === guardada.id ? guardada : x)));
                  setEditando(null);
                  setNueva(null);
                }}
                onCancelar={() => {
                  if (nueva === d.id) poner(direcciones.filter((x) => x.id !== d.id));
                  setEditando(null);
                  setNueva(null);
                }}
              />
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{d.alias}</p>
                    {d.predeterminada ? (
                      <span className="text-gold-light text-[11px]">Predeterminada</span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditando(d.id)}
                      aria-label={`Editar ${d.alias}`}
                      className="text-fg-subtle hover:text-fg grid size-11 place-items-center rounded-full"
                    >
                      <Pencil size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Eliminar la dirección «${d.alias}»?`)) {
                          aplicar(direcciones.filter((x) => x.id !== d.id));
                        }
                      }}
                      aria-label={`Eliminar ${d.alias}`}
                      className="text-fg-subtle hover:text-danger grid size-11 place-items-center rounded-full"
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                </div>

                <address className="text-fg-muted mt-2 text-sm leading-relaxed not-italic">
                  {d.nombre}
                  <br />
                  {d.calle || "—"}
                  <br />
                  {[d.colonia, d.cp].filter(Boolean).join(", ")}
                  <br />
                  {[d.ciudad, d.estado].filter(Boolean).join(", ")}
                  <br />
                  {d.telefono}
                </address>

                {!d.predeterminada ? (
                  <button
                    type="button"
                    onClick={() =>
                      aplicar(direcciones.map((x) => ({ ...x, predeterminada: x.id === d.id })))
                    }
                    className="text-fg-subtle hover:text-gold-light mt-2 inline-flex min-h-11 items-center text-xs underline underline-offset-4"
                  >
                    Usar como predeterminada
                  </button>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>

      {editando === null ? (
        <Button variant="goldOutline" size="touch" className="mt-4" onClick={agregar}>
          <Plus size={16} aria-hidden />
          Agregar dirección
        </Button>
      ) : null}
    </div>
  );
}

function FormDireccion({
  direccion,
  onGuardar,
  onCancelar,
}: {
  direccion: Direccion;
  onGuardar: (d: Direccion) => void;
  onCancelar: () => void;
}) {
  const [d, setD] = useState(direccion);
  const [aviso, setAviso] = useState<string | null>(null);
  const campo = (k: keyof Direccion, label: string, placeholder: string) => (
    <div>
      <Label htmlFor={`${d.id}-${k}`} className="mb-1 text-xs">
        {label}
      </Label>
      <Input
        id={`${d.id}-${k}`}
        value={String(d[k] ?? "")}
        placeholder={placeholder}
        onChange={(e) => {
          setD({ ...d, [k]: e.target.value });
          setAviso(null);
        }}
        className="h-11"
      />
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // Lo mínimo para que el checkout pueda usarla: sin calle ni CP la
        // dirección no sirve para mandar nada.
        if (d.calle.trim().length < 5 || !/^\d{5}$/.test(d.cp.trim())) {
          setAviso("Escribe al menos la calle con número y un código postal de 5 dígitos.");
          return;
        }
        onGuardar({ ...d, cp: d.cp.trim() });
      }}
      className="space-y-3"
    >
      {campo("alias", "Alias", "Casa, Local…")}
      {campo("nombre", "Quién recibe", "Nombre completo")}
      {campo("calle", "Calle y número", "Av. Insurgentes 233")}
      {campo("colonia", "Colonia", "Centro")}
      <div className="grid grid-cols-2 gap-3">
        {campo("cp", "CP", "37000")}
        {campo("ciudad", "Ciudad", "León")}
      </div>
      {campo("estado", "Estado", "Guanajuato")}
      {campo("telefono", "Teléfono", "477 123 4567")}

      {aviso ? (
        <p role="alert" className="text-danger text-xs">
          {aviso}
        </p>
      ) : null}

      <div className="flex gap-2 pt-1">
        <Button type="submit" variant="gold" size="touch" className="flex-1">
          Guardar
        </Button>
        <Button type="button" variant="outline" size="touch" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
