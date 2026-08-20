"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, MapPin, Package, Pencil, Plus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Contenedor } from "@/components/comunes/layout";
import { Precio } from "@/components/comunes/precio";
import { GridProductos } from "@/components/producto/grid-productos";
import { DIRECCIONES, PEDIDOS, USUARIO } from "@/data/cuenta";
import { AVISO_SIN_PANEL, InicioSesion } from "@/components/cuenta/inicio-sesion";
import { hayLogin, puedeVerPanel, useSesion } from "@/lib/sesion";
import { PRODUCTOS } from "@/data/productos";
import { formatoFechaLarga } from "@/lib/format";
import { useTienda } from "@/store/tienda";
import type { Direccion, EstatusPedido } from "@/types";
import { NivelCliente } from "./nivel-cliente";
import { cn } from "@/lib/utils";

const COLOR_ESTATUS: Record<EstatusPedido, string> = {
  Pendiente: "bg-warning/15 text-warning",
  Pagado: "bg-gold-muted text-gold-light",
  "En camino": "bg-gold-muted text-gold-light",
  Entregado: "bg-success/15 text-success",
  Cancelado: "bg-danger/15 text-danger",
};

export function VistaCuenta() {
  const hidratado = useTienda((s) => s.hidratado);
  const favoritos = useTienda((s) => s.favoritos);
  const sesion = useSesion();
  const [avisoSinPanel, setAvisoSinPanel] = useState(false);

  // Depende del perfil, no del montaje: esta pantalla ya está montada mostrando
  // el formulario cuando se inicia sesión, así que un efecto de montaje leería la
  // marca antes de que exista. Se borra al leerla para que el aviso no reaparezca
  // en visitas posteriores a la cuenta.
  useEffect(() => {
    if (!sesion.perfil) return;
    if (sessionStorage.getItem(AVISO_SIN_PANEL)) {
      setAvisoSinPanel(true);
      sessionStorage.removeItem(AVISO_SIN_PANEL);
    }
  }, [sesion.perfil]);

  const productosFavoritos = PRODUCTOS.filter((p) => favoritos.includes(p.id));

  // Antes de leer `localStorage` no se sabe si hay sesión: pintar la pantalla
  // de acceso y quitarla medio segundo después es peor que esperar.
  if (hayLogin() && !sesion.listo) return null;

  if (hayLogin() && !sesion.perfil) {
    return (
      <Contenedor className="py-10 lg:py-16">
        <InicioSesion sesion={sesion} />
      </Contenedor>
    );
  }

  // El nombre sale de la sesión cuando la hay. Los pedidos y las direcciones
  // siguen siendo de muestra: todavía no hay dónde guardarlos.
  const nombre = sesion.perfil?.nombre || USUARIO.nombre;
  const correo = sesion.perfil?.correo || USUARIO.correo;

  return (
    <Contenedor className="py-6 lg:py-10">
      <header className="mb-7">
        <p className="eyebrow mb-2">Mi cuenta</p>
        <h1 className="font-display text-[32px] leading-tight tracking-tight lg:text-[42px]">
          Hola, {nombre.split(" ")[0]}
        </h1>
        <p className="text-fg-muted mt-2 text-sm">
          Cliente desde {formatoFechaLarga(USUARIO.desde)}
        </p>

        {avisoSinPanel && (
          <p className="border-border-soft text-fg-muted mt-3 max-w-lg rounded-md border px-3 py-2 text-sm">
            Tu cuenta no tiene acceso al panel de proveedores, así que entraste
            como cliente. Si crees que debería tenerlo, pídeselo a un
            administrador.
          </p>
        )}

        {sesion.perfil && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {puedeVerPanel(sesion.perfil) && (
              <a
                href="/radar/"
                className="text-gold-light inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold"
              >
                Ir al panel de proveedores
              </a>
            )}
            <button
              type="button"
              onClick={sesion.salir}
              className="text-fg-subtle hover:text-fg-muted inline-flex min-h-11 items-center text-sm"
            >
              Cerrar sesión
            </button>
          </div>
        )}
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
            <ul className="space-y-3">
              {PEDIDOS.map((p) => (
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
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium",
                        COLOR_ESTATUS[p.estatus],
                      )}
                    >
                      {p.estatus}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <Precio valor={p.total} moneda className="font-medium" />
                    <Button asChild variant="outline" size="touch">
                      <Link href={`/cuenta/pedidos/${p.folio}`}>
                        Ver detalle y rastreo
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 lg:mt-0">
              <NivelCliente piezas={USUARIO.piezasCompradas} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="direcciones">
          <Direcciones />
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
          <MisDatos nombre={nombre} correo={correo} />
        </TabsContent>
      </Tabs>
    </Contenedor>
  );
}

/** CRUD de direcciones en memoria (§13). */
function Direcciones() {
  const [direcciones, setDirecciones] = useState<Direccion[]>([...DIRECCIONES]);
  const [editando, setEditando] = useState<string | null>(null);

  function eliminar(id: string) {
    setDirecciones((d) => d.filter((x) => x.id !== id));
  }

  function predeterminar(id: string) {
    setDirecciones((d) =>
      d.map((x) => ({ ...x, predeterminada: x.id === id })),
    );
  }

  function agregar() {
    const id = `d${Date.now()}`;
    setDirecciones((d) => [
      ...d,
      {
        id,
        alias: "Nueva dirección",
        nombre: USUARIO.nombre,
        calle: "",
        colonia: "",
        cp: "",
        ciudad: "",
        estado: "",
        telefono: USUARIO.telefono,
        predeterminada: d.length === 0,
      },
    ]);
    setEditando(id);
  }

  return (
    <div>
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
                onGuardar={(nueva) => {
                  setDirecciones((lista) =>
                    lista.map((x) => (x.id === nueva.id ? nueva : x)),
                  );
                  setEditando(null);
                }}
                onCancelar={() => setEditando(null)}
              />
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{d.alias}</p>
                    {d.predeterminada ? (
                      <span className="text-gold-light text-[11px]">
                        Predeterminada
                      </span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditando(d.id)}
                      aria-label={`Editar ${d.alias}`}
                      className="text-fg-subtle hover:text-fg grid size-9 place-items-center rounded-full"
                    >
                      <Pencil size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminar(d.id)}
                      aria-label={`Eliminar ${d.alias}`}
                      className="text-fg-subtle hover:text-danger grid size-9 place-items-center rounded-full"
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
                    onClick={() => predeterminar(d.id)}
                    className="text-fg-subtle hover:text-gold-light mt-3 text-xs underline underline-offset-4"
                  >
                    Usar como predeterminada
                  </button>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>

      <Button variant="goldOutline" size="touch" className="mt-4" onClick={agregar}>
        <Plus size={16} aria-hidden />
        Agregar dirección
      </Button>
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
  const campo = (k: keyof Direccion, label: string, placeholder: string) => (
    <div>
      <Label htmlFor={`${d.id}-${k}`} className="mb-1 text-xs">
        {label}
      </Label>
      <Input
        id={`${d.id}-${k}`}
        value={String(d[k] ?? "")}
        placeholder={placeholder}
        onChange={(e) => setD({ ...d, [k]: e.target.value })}
        className="h-11"
      />
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar(d);
      }}
      className="space-y-3"
    >
      {campo("alias", "Alias", "Casa, Local…")}
      {campo("calle", "Calle y número", "Av. Insurgentes 233")}
      {campo("colonia", "Colonia", "Centro")}
      <div className="grid grid-cols-2 gap-3">
        {campo("cp", "CP", "37000")}
        {campo("ciudad", "Ciudad", "León")}
      </div>
      {campo("estado", "Estado", "Guanajuato")}
      {campo("telefono", "Teléfono", "477 123 4567")}

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

function MisDatos({ nombre, correo }: { nombre: string; correo: string }) {
  return (
    <div className="max-w-lg">
      <dl className="divide-border-soft border-border-soft divide-y border-y">
        {[
          ["Nombre", nombre],
          ["Correo", correo],
          ["WhatsApp", USUARIO.telefono],
          ["Cliente desde", formatoFechaLarga(USUARIO.desde)],
          ["Piezas compradas", String(USUARIO.piezasCompradas)],
        ].map(([k, v]) => (
          <div key={k} className="grid grid-cols-[140px_1fr] gap-4 py-3.5 text-sm">
            <dt className="text-fg-subtle">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <p className="text-fg-subtle mt-5 text-xs leading-relaxed">
        Esta es una tienda de demostración: la sesión es simulada y no hay
        autenticación real ni datos guardados en ningún servidor.
      </p>
    </div>
  );
}
