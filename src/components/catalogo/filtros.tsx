"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MARCAS } from "@/data/marcas";
import { CATEGORIAS_CATALOGO } from "@/data/navegacion";
import {
  CONCENTRACIONES,
  FAMILIAS,
  GENEROS,
  OCASIONES,
  ORDENES,
  TAMANOS,
} from "@/data/taxonomia";
import { PRECIO_MAX, PRECIO_MIN, type ChipActivo, type Conteos } from "@/lib/filtros";
import { precio as fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Los filtros viven en la URL, no en estado de React.
 *
 * Así el filtrado ocurre en el servidor (el catálogo no viaja al cliente), la
 * URL es compartible y el botón "atrás" del navegador funciona como el usuario
 * espera. Cada cambio reinicia la paginación a 24.
 */
function useFiltrosUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const navegar = useCallback(
    (siguiente: URLSearchParams, reiniciarPagina = true) => {
      // Cambiar un filtro devuelve la lista a la primera página; paginar no.
      if (reiniciarPagina) siguiente.delete("n");
      const q = siguiente.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const valores = useCallback(
    (clave: string) => (params.get(clave) ?? "").split(",").filter(Boolean),
    [params],
  );

  const alternar = useCallback(
    (clave: string, valor: string) => {
      const actuales = valores(clave);
      const nuevos = actuales.includes(valor)
        ? actuales.filter((v) => v !== valor)
        : [...actuales, valor];

      const siguiente = new URLSearchParams(params.toString());
      if (nuevos.length) siguiente.set(clave, nuevos.join(","));
      else siguiente.delete(clave);
      navegar(siguiente);
    },
    [navegar, params, valores],
  );

  const asignar = useCallback(
    (clave: string, valor: string | null) => {
      const siguiente = new URLSearchParams(params.toString());
      if (valor === null) siguiente.delete(clave);
      else siguiente.set(clave, valor);
      navegar(siguiente);
    },
    [navegar, params],
  );

  /** Varios parámetros de una sola vez, en una única navegación. */
  const asignarVarios = useCallback(
    (entradas: Record<string, string | null>) => {
      const siguiente = new URLSearchParams(params.toString());
      for (const [clave, valor] of Object.entries(entradas)) {
        if (valor === null) siguiente.delete(clave);
        else siguiente.set(clave, valor);
      }
      navegar(siguiente);
    },
    [navegar, params],
  );

  /** Paginación: conserva `n` en vez de reiniciarlo. */
  const paginar = useCallback(
    (n: number) => {
      const siguiente = new URLSearchParams(params.toString());
      siguiente.set("n", String(n));
      navegar(siguiente, false);
    },
    [navegar, params],
  );

  const quitarChip = useCallback(
    (chip: ChipActivo) => {
      if (chip.clave === "precio") {
        const siguiente = new URLSearchParams(params.toString());
        siguiente.delete("precioMin");
        siguiente.delete("precioMax");
        navegar(siguiente);
        return;
      }
      if (chip.clave === "stock") {
        asignar(chip.clave, null);
        return;
      }
      alternar(chip.clave, chip.valor);
    },
    [alternar, asignar, navegar, params],
  );

  const limpiarTodo = useCallback(() => {
    const siguiente = new URLSearchParams();
    const orden = params.get("orden");
    const q = params.get("q");
    if (orden) siguiente.set("orden", orden);
    if (q) siguiente.set("q", q);
    const s = siguiente.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return {
    params,
    valores,
    alternar,
    asignar,
    asignarVarios,
    paginar,
    quitarChip,
    limpiarTodo,
  };
}

function GrupoCasillas({
  titulo,
  clave,
  opciones,
  valorDe = (o: string) => o,
  conteo,
}: {
  titulo: string;
  clave: string;
  opciones: readonly string[];
  valorDe?: (o: string) => string;
  /** Cuántos productos tiene cada opción con los demás filtros puestos. */
  conteo?: ReadonlyMap<string, number>;
}) {
  const { valores, alternar } = useFiltrosUrl();
  const activos = valores(clave);
  // Las opciones que dejarían la lista vacía no se enseñan (salvo la que ya
  // está marcada, para poder quitarla). Sin conteos, todas.
  const visibles = conteo
    ? opciones.filter((o) => (conteo.get(valorDe(o)) ?? 0) > 0 || activos.includes(valorDe(o)))
    : opciones;
  if (visibles.length === 0) return null;

  return (
    <AccordionItem value={clave} className="border-border-soft">
      <AccordionTrigger className="py-3.5 text-sm hover:no-underline">
        {titulo}
        {activos.length ? (
          <span className="bg-gold-muted text-gold-light ml-2 rounded-full px-1.5 text-[10px]">
            {activos.length}
          </span>
        ) : null}
      </AccordionTrigger>
      <AccordionContent className="pb-3">
        <ul className="space-y-0.5">
          {visibles.map((o) => {
            const valor = valorDe(o);
            const id = `${clave}-${valor}`;
            const n = conteo?.get(valor);
            return (
              <li key={valor}>
                <label
                  htmlFor={id}
                  className="hover:text-fg text-fg-muted flex min-h-9 cursor-pointer items-center gap-2.5 text-sm transition-colors"
                >
                  <Checkbox
                    id={id}
                    checked={activos.includes(valor)}
                    onCheckedChange={() => alternar(clave, valor)}
                  />
                  <span className="min-w-0 flex-1">{o}</span>
                  {n !== undefined && (
                    <span className="text-fg-subtle shrink-0 text-xs tabular-nums">{n}</span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}

function FiltroPrecio() {
  const { params, asignarVarios } = useFiltrosUrl();
  const min = Number(params.get("precioMin") ?? PRECIO_MIN);
  const max = Number(params.get("precioMax") ?? PRECIO_MAX);

  // Solo se guarda el valor mientras se arrastra; el resto del tiempo el
  // slider se deriva de la URL. Así no hace falta un efecto que sincronice
  // estado con props, y si el filtro se limpia desde un chip el slider
  // vuelve solo a su sitio.
  const [arrastre, setArrastre] = useState<number[] | null>(null);
  const rango = arrastre ?? [min, max];

  return (
    <AccordionItem value="precio" className="border-border-soft">
      <AccordionTrigger className="py-3.5 text-sm hover:no-underline">
        Precio
      </AccordionTrigger>
      <AccordionContent className="pt-2 pb-4">
        <Slider
          value={rango}
          min={PRECIO_MIN}
          max={PRECIO_MAX}
          step={50}
          minStepsBetweenThumbs={1}
          onValueChange={setArrastre}
          onValueCommit={(v) => {
            setArrastre(null);
            // Un solo cambio de URL para ambos extremos: dos `asignar`
            // seguidos se pisarían, porque el segundo lee la URL anterior.
            const tocado = v[0] !== PRECIO_MIN || v[1] !== PRECIO_MAX;
            asignarVarios({
              precioMin: tocado ? String(v[0]) : null,
              precioMax: tocado ? String(v[1]) : null,
            });
          }}
          aria-label="Rango de precio"
        />
        <div className="text-fg-muted mt-3 flex justify-between text-xs">
          <span data-precio>{fmt(rango[0]!)}</span>
          <span data-precio>{fmt(rango[1]!)}</span>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * «En 3x2» y «En rebaja». Se esconde si ninguna de las dos tiene productos.
 * (Aquí iba «Calificación mínima»: filtraba por estrellas que no venían de
 * ninguna reseña, sino de un número al azar por producto.)
 */
function FiltroPromocion({ conteo }: { conteo?: ReadonlyMap<string, number> }) {
  return (
    <GrupoCasillas
      titulo="Promoción"
      clave="promo"
      opciones={["En 3x2", "En rebaja"]}
      valorDe={(o) => (o === "En 3x2" ? "3x2" : "rebaja")}
      conteo={conteo}
    />
  );
}

/**
 * «Solo en existencia», como interruptor y a la vista (antes era una casilla
 * escondida al fondo de «Promoción y disponibilidad»). Encendido, la lista
 * deja fuera lo agotado —con los agotados en vivo del panel— y los filtros
 * esconden las opciones que se quedan sin nada.
 */
export function InterruptorExistencia({
  disponibles,
  compacto = false,
}: {
  /** Cuántos quedarían encendido, con los demás filtros puestos. */
  disponibles?: number;
  /** Versión corta para la barra superior. */
  compacto?: boolean;
}) {
  const { params, asignar } = useFiltrosUrl();
  const encendido = params.get("stock") === "1";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={encendido}
      onClick={() => asignar("stock", encendido ? null : "1")}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border text-left text-sm font-medium transition-colors",
        compacto ? "h-11 px-3.5" : "min-h-12 w-full justify-between px-4",
        encendido
          ? "border-success/60 bg-success/10 text-fg"
          : "border-border-strong text-fg-muted hover:text-fg",
      )}
    >
      <span className="min-w-0">
        <span className="block whitespace-nowrap">{compacto ? "En existencia" : "Solo en existencia"}</span>
        {!compacto && disponibles !== undefined && (
          <span className="text-fg-subtle block text-xs font-normal">
            {disponibles} {disponibles === 1 ? "perfume disponible" : "perfumes disponibles"}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors",
          encendido ? "bg-success" : "bg-border-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]",
            encendido ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

/** «Borrar filtros»: quita todo menos el orden y la búsqueda. */
function BotonBorrarTodo({ activos, className }: { activos: number; className?: string }) {
  const { limpiarTodo } = useFiltrosUrl();
  if (activos === 0) return null;
  return (
    <button
      type="button"
      onClick={limpiarTodo}
      className={cn(
        "text-gold-light hover:text-gold inline-flex min-h-9 items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline",
        className,
      )}
    >
      <X size={14} aria-hidden />
      Borrar filtros ({activos})
    </button>
  );
}

/** Cuerpo de filtros, compartido por la barra lateral y el drawer móvil. */
/**
 * Categorías del catálogo, arriba de los filtros.
 *
 * Son exactamente las mismas seis de la barra de navegación y de los círculos
 * de la home: quien llega aquí desde cualquiera de los dos sitios reconoce la
 * lista y sabe dónde está. "Mayoreo surtido" es el catálogo sin ningún filtro.
 */
function CategoriasCatalogo() {
  const ruta = usePathname();

  return (
    <nav aria-label="Categorías" className="mb-6">
      <p className="eyebrow mb-2.5">Categorías</p>
      <ul className="space-y-0.5">
        {CATEGORIAS_CATALOGO.map((c) => {
          const activa = ruta === c.href;
          return (
            <li key={c.href}>
              <Link
                href={c.href}
                aria-current={activa ? "page" : undefined}
                className={cn(
                  "flex min-h-9 items-center text-[14px] font-semibold transition-colors",
                  activa ? "text-gold-light" : "text-fg-muted hover:text-fg",
                )}
              >
                {c.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PanelFiltros({
  conteos,
  activos = 0,
  sinCategorias = false,
}: {
  conteos?: Conteos;
  activos?: number;
  /** En el filtro del teléfono las categorías estorban: ya están en el menú. */
  sinCategorias?: boolean;
}) {
  return (
    <>
      {!sinCategorias && <CategoriasCatalogo />}

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="eyebrow">Filtrar</p>
        <BotonBorrarTodo activos={activos} />
      </div>

      <InterruptorExistencia disponibles={conteos?.stock.get("1")} />

      <Accordion
        type="multiple"
        defaultValue={["genero", "familia", "precio"]}
        className="mt-2 w-full"
      >
        <GrupoCasillas titulo="Género" clave="genero" opciones={GENEROS} conteo={conteos?.genero} />
        <GrupoCasillas
          titulo="Familia olfativa"
          clave="familia"
          opciones={FAMILIAS.map((f) => f.nombre)}
          conteo={conteos?.familia}
        />
        <FiltroPrecio />
        <GrupoCasillas
          titulo="Marca"
          clave="marca"
          opciones={MARCAS.map((m) => m.nombre)}
          valorDe={(nombre) =>
            MARCAS.find((m) => m.nombre === nombre)?.slug ?? nombre
          }
          conteo={conteos?.marca}
        />
        <GrupoCasillas
          titulo="Concentración"
          clave="conc"
          opciones={CONCENTRACIONES}
          conteo={conteos?.conc}
        />
        <GrupoCasillas
          titulo="Tamaño"
          clave="ml"
          opciones={TAMANOS.map((t) => `${t} ml`)}
          valorDe={(o) => o.replace(" ml", "")}
          conteo={conteos?.ml}
        />
        <GrupoCasillas titulo="Ocasión" clave="ocasion" opciones={OCASIONES} conteo={conteos?.ocasion} />
        <FiltroPromocion conteo={conteos?.promo} />
      </Accordion>
    </>
  );
}

/** Barra superior: contador, orden y acceso a filtros en móvil. */
export function BarraCatalogo({
  total,
  activos,
  conteos,
}: {
  total: number;
  activos: number;
  conteos?: Conteos;
}) {
  const { params, asignar, limpiarTodo } = useFiltrosUrl();
  const [abierto, setAbierto] = useState(false);
  // Un enlace viejo con un orden que ya no existe (?orden=rating) deja el
  // selector en el de siempre en vez de en blanco; el servidor hace lo mismo.
  const pedido = params.get("orden");
  const orden = ORDENES.some((o) => o.valor === pedido) ? pedido! : "relevancia";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-fg-muted text-sm" aria-live="polite">
        <span data-precio className="text-fg font-medium">
          {total}
        </span>{" "}
        {total === 1 ? "producto" : "productos"}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {/* El interruptor a la mano en el teléfono, sin abrir el filtro. En
            computadora ya está arriba del panel de la izquierda. */}
        <span className="lg:hidden">
          <InterruptorExistencia compacto />
        </span>
        <Sheet open={abierto} onOpenChange={setAbierto}>
          <Button
            variant="outline"
            size="touch"
            className="lg:hidden"
            onClick={() => setAbierto(true)}
          >
            <SlidersHorizontal size={16} aria-hidden />
            Filtrar
            {activos > 0 ? (
              <span className="bg-gold-gradient text-bg ml-1 rounded-full px-1.5 text-[10px] font-semibold">
                {activos}
              </span>
            ) : null}
          </Button>

          <SheetContent
            side="bottom"
            className="bg-bg flex h-[85dvh] flex-col gap-0 p-0"
          >
            <SheetHeader className="border-border-soft border-b px-4 py-4">
              <SheetTitle className="font-display text-lg font-normal">
                Filtrar
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 pt-4">
              <PanelFiltros conteos={conteos} activos={activos} sinCategorias />
            </div>

            <div className="border-border-soft flex gap-2 border-t px-4 py-3">
              <Button
                variant="outline"
                size="touch"
                className="flex-1"
                disabled={activos === 0}
                onClick={limpiarTodo}
              >
                Borrar todo
              </Button>
              <Button
                variant="gold"
                size="touch"
                className="flex-[2]"
                onClick={() => setAbierto(false)}
              >
                Ver {total} {total === 1 ? "producto" : "productos"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <Select
          value={orden}
          onValueChange={(v) => asignar("orden", v === "relevancia" ? null : v)}
        >
          <SelectTrigger
            className="h-11 w-auto min-w-[9.5rem] rounded-full"
            aria-label="Ordenar resultados"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDENES.map((o) => (
              <SelectItem key={o.valor} value={o.valor}>
                {o.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** Chips de filtros activos, cada uno con su ✕ y un "Limpiar todo". */
export function ChipsActivos({ chips }: { chips: ChipActivo[] }) {
  const { quitarChip, limpiarTodo } = useFiltrosUrl();
  if (!chips.length) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <li key={`${c.clave}-${c.valor}`}>
          <button
            type="button"
            onClick={() => quitarChip(c)}
            className="border-border-strong text-fg-muted hover:border-gold hover:text-gold-light inline-flex items-center gap-1.5 rounded-full border py-1.5 pr-2 pl-3 text-xs transition-colors"
          >
            {c.etiqueta}
            <X size={13} aria-hidden />
            <span className="sr-only">Quitar filtro {c.etiqueta}</span>
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={limpiarTodo}
          className="text-gold-light hover:text-gold inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold underline underline-offset-4"
        >
          <X size={13} aria-hidden />
          Borrar todo
        </button>
      </li>
    </ul>
  );
}

/** Paginación por "Mostrar más": suma 24 al parámetro `n` (§9). */
export function BotonMostrarMas({
  mostrando,
  total,
}: {
  mostrando: number;
  total: number;
}) {
  const { paginar } = useFiltrosUrl();
  if (mostrando >= total) return null;

  return (
    <div className="mt-10 flex flex-col items-center gap-3">
      <p className="text-fg-subtle text-xs">
        Mostrando {mostrando} de {total}
      </p>
      <Button
        variant="goldOutline"
        size="touch"
        onClick={() => paginar(mostrando + 24)}
      >
        Mostrar más
      </Button>
    </div>
  );
}
