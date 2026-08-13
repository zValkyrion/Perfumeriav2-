"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SearchX } from "lucide-react";
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
import { GridProductos } from "@/components/producto/grid-productos";
import {
  aplicarFiltros,
  chipsActivos,
  contarActivos,
  leerFiltros,
  ordenar,
  type ParamsBusqueda,
} from "@/lib/filtros";
import type { Producto } from "@/types";
import {
  BarraCatalogo,
  BotonMostrarMas,
  ChipsActivos,
  PanelFiltros,
} from "./filtros";

export interface Miga {
  label: string;
  href?: string;
}

function searchParamsToRecord(searchParams: URLSearchParams): ParamsBusqueda {
  const res: ParamsBusqueda = {};
  searchParams.forEach((val, key) => {
    if (res[key]) {
      if (Array.isArray(res[key])) {
        (res[key] as string[]).push(val);
      } else {
        res[key] = [res[key] as string, val];
      }
    } else {
      res[key] = val;
    }
  });
  return res;
}

export function VistaCatalogo({
  base,
  titulo,
  eyebrow,
  descripcion,
  migas = [],
  params,
  vacioPersonalizado,
}: {
  base: Producto[];
  titulo: string;
  eyebrow?: string;
  descripcion?: string;
  migas?: Miga[];
  params?: ParamsBusqueda;
  vacioPersonalizado?: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="py-10 text-center">Cargando...</div>}>
      <VistaCatalogoContenido
        base={base}
        titulo={titulo}
        eyebrow={eyebrow}
        descripcion={descripcion}
        migas={migas}
        initialParams={params}
        vacioPersonalizado={vacioPersonalizado}
      />
    </Suspense>
  );
}

function VistaCatalogoContenido({
  base,
  titulo,
  eyebrow,
  descripcion,
  migas = [],
  initialParams,
  vacioPersonalizado,
}: {
  base: Producto[];
  titulo: string;
  eyebrow?: string;
  descripcion?: string;
  migas?: Miga[];
  initialParams?: ParamsBusqueda;
  vacioPersonalizado?: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const params = initialParams ?? (searchParams ? searchParamsToRecord(searchParams) : {});

  const filtros = leerFiltros(params);
  const filtrados = ordenar(aplicarFiltros(base, filtros), filtros.orden);
  const visibles = filtrados.slice(0, filtros.mostrar);
  const chips = chipsActivos(filtros);
  const activos = contarActivos(filtros);

  return (
    <Contenedor className="py-6 lg:py-10">
      <Breadcrumb className="mb-5">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Inicio</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {migas.map((m) => (
            <span key={m.label} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {m.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={m.href}>{m.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{m.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <header className="mb-6 max-w-2xl lg:mb-8">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="font-display text-[32px] leading-[1.05] tracking-tight text-balance lg:text-[44px]">
          {titulo}
        </h1>
        {descripcion ? (
          <p className="text-fg-muted mt-3 text-[15px] leading-relaxed">
            {descripcion}
          </p>
        ) : null}
      </header>

      <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-10">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2 pb-6">
            <p className="eyebrow mb-2">Filtrar</p>
            <Suspense fallback={null}>
              <PanelFiltros />
            </Suspense>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="space-y-3">
            <Suspense fallback={<div className="h-11" />}>
              <BarraCatalogo total={filtrados.length} activos={activos} />
            </Suspense>
            <Suspense fallback={null}>
              <ChipsActivos chips={chips} />
            </Suspense>
          </div>

          <div className="mt-5 lg:mt-7">
            {visibles.length > 0 ? (
              <>
                <GridProductos productos={visibles} prioritarios={4} />
                <Suspense fallback={null}>
                  <BotonMostrarMas
                    mostrando={visibles.length}
                    total={filtrados.length}
                  />
                </Suspense>
              </>
            ) : (
              (vacioPersonalizado ?? <EstadoVacio conFiltros={activos > 0} />)
            )}
          </div>
        </div>
      </div>
    </Contenedor>
  );
}

/** Vacío con salida, nunca un callejón sin salida (§9). */
export function EstadoVacio({
  conFiltros,
  titulo = "No encontramos nada con esos filtros",
  texto,
}: {
  conFiltros: boolean;
  titulo?: string;
  texto?: string;
}) {
  return (
    <div className="border-border-soft rounded-lg border border-dashed px-6 py-16 text-center">
      <SearchX size={30} className="text-fg-subtle mx-auto mb-4" aria-hidden />
      <p className="font-display mb-2 text-xl">{titulo}</p>
      <p className="text-fg-muted mx-auto mb-7 max-w-sm text-sm leading-relaxed">
        {texto ??
          (conFiltros
            ? "Prueba quitando alguno de los filtros activos, o mira estas alternativas."
            : "Mira estas alternativas mientras tanto.")}
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        {[
          { label: "Más vendidos", href: "/catalogo?orden=vendidos" },
          { label: "En 3x2", href: "/promociones" },
          { label: "Menos de $1,000", href: "/catalogo?precioMax=1000" },
          { label: "Todo el catálogo", href: "/catalogo" },
        ].map((a) => (
          <Button key={a.href} asChild variant="outline" size="touch">
            <Link href={a.href}>{a.label}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
