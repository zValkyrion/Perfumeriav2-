"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Tarjeta } from "@/components/ui";
import { hayApi } from "@/lib/api";
import type { RegistroGuardado } from "../../../../compartido/catalogo-admin";
import {
  leerCatalogoAdmin,
  type CatalogoAdmin,
  type ErrorCampo,
  type TipoRegistro,
} from "@/lib/catalogo-admin";
import { useSesion } from "@/lib/sesion";
import { cn } from "@/lib/utils";

/**
 * El catálogo completo para el panel, con su recarga.
 *
 * Mismo patrón que la vista de conjunto: el efecto solo toca el estado después
 * de un `await`, y recargar es mover `intento`, no llamar a la consulta.
 */
export function useCatalogoAdmin() {
  const sesion = useSesion();
  const esAdmin = sesion.grupos.includes("admins");
  const token = sesion.token;
  const [datos, setDatos] = useState<CatalogoAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!sesion.listo || !esAdmin || !token || !hayApi()) return;
    let vivo = true;
    (async () => {
      try {
        const d = await leerCatalogoAdmin(token, intento > 0);
        if (!vivo) return;
        setDatos(d);
        setError(null);
      } catch (e) {
        if (!vivo) return;
        setError(e instanceof Error ? e.message : "No se pudo leer el catálogo");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [sesion.listo, esAdmin, token, intento]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  return { sesion, esAdmin, token, datos, setDatos, error, recargar };
}

/**
 * Lo que se enseña mientras no se puede editar: sin sesión, sin permiso o sin
 * API. `null` cuando sí se puede.
 *
 * **La puerta de verdad está en la Lambda** (`/admin/*` exige el grupo
 * `admins`). Esto solo evita enseñar un formulario que el servidor va a
 * rechazar.
 */
export function PuertaCatalogo({
  c,
  volver = "/",
}: {
  c: ReturnType<typeof useCatalogoAdmin>;
  volver?: string;
}) {
  if (!c.sesion.listo) return <main className="p-4" />;
  if (!c.sesion.desbloqueado || !c.token) {
    return (
      <Aviso titulo="Hay que iniciar sesión" volver={volver}>
        El catálogo se edita con una cuenta del equipo. Entra desde la portada del panel.
      </Aviso>
    );
  }
  if (!c.esAdmin) {
    return (
      <Aviso titulo="Tu cuenta no edita el catálogo" volver={volver}>
        Lo que se cambia aquí se cobra y se publica en la tienda, así que es del grupo{" "}
        <strong>admins</strong> y pide cuenta propia: el código de equipo no sirve. Si
        necesitas editarlo, pídele a un administrador que te agregue al grupo.
      </Aviso>
    );
  }
  if (!hayApi()) {
    return (
      <Aviso titulo="Sin servidor" volver={volver}>
        Esta copia del panel no tiene API configurada, así que no puede leer ni guardar el
        catálogo.
      </Aviso>
    );
  }
  return null;
}

export function Aviso({
  titulo,
  children,
  volver = "/",
}: {
  titulo: string;
  children: React.ReactNode;
  volver?: string;
}) {
  return (
    <main className="p-4">
      <Link
        href={volver}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-fg-subtle"
      >
        <ArrowLeft size={15} />
        Volver
      </Link>
      <Tarjeta className="mt-3">
        <p className="text-[15px] font-medium">{titulo}</p>
        <p className="mt-1 text-[14px] text-fg-muted">{children}</p>
      </Tarjeta>
    </main>
  );
}

/** Sí/no de dos botones: lo agotado y lo visible no tienen un tercer estado. */
export function Interruptor({
  etiqueta,
  valor,
  onChange,
  textos = ["Sí", "No"],
  pista,
  peligroSi = false,
}: {
  etiqueta: string;
  valor: boolean;
  onChange: (v: boolean) => void;
  textos?: [string, string];
  pista?: string;
  /** El «sí» es la opción delicada (agotado): se pinta en rojo. */
  peligroSi?: boolean;
}) {
  const opciones = [
    { v: true, texto: textos[0], activo: peligroSi ? "border-danger bg-danger text-white" : "border-success bg-success text-white" },
    { v: false, texto: textos[1], activo: peligroSi ? "border-success bg-success text-white" : "border-border-strong bg-surface-2 text-fg" },
  ];
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium">{etiqueta}</span>
        {pista && <span className="block text-[12px] text-fg-subtle">{pista}</span>}
      </span>
      <div
        role="radiogroup"
        aria-label={etiqueta}
        className="flex shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-border-strong"
      >
        {opciones.map((o) => (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={valor === o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              "min-h-11 border-l px-3 text-[13px] font-semibold first:border-l-0",
              valor === o.v ? o.activo : "border-border-strong bg-surface text-fg-subtle",
            )}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Del 1 al 5, siempre con valor. El `Deslizador` de la captura distingue «sin
 * preguntar»; aquí no hay tal cosa: un perfume sin dato se queda en 3.
 */
export function Escala({
  etiqueta,
  valor,
  onChange,
  leyendas,
}: {
  etiqueta: string;
  valor: number;
  onChange: (v: number) => void;
  leyendas: [string, string];
}) {
  return (
    <div className="py-1">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-medium">{etiqueta}</span>
        <span className="text-[15px] font-semibold tabular-nums text-gold">{valor} de 5</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={valor}
        aria-label={etiqueta}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="flex justify-between text-[12px] text-fg-subtle">
        <span>{leyendas[0]}</span>
        <span>{leyendas[1]}</span>
      </div>
    </div>
  );
}

/** Los errores del servidor para un campo, debajo de él. */
export function ErroresDe({ errores, campo }: { errores: ErrorCampo[]; campo: string }) {
  const propios = errores.filter((e) => e.campo === campo);
  if (propios.length === 0) return null;
  return (
    <p className="mt-1 text-[13px] font-medium text-danger">
      {propios.map((e) => e.mensaje).join(" · ")}
    </p>
  );
}

export function Mensaje({
  tono,
  children,
}: {
  tono: "error" | "ok" | "aviso";
  children: React.ReactNode;
}) {
  const estilos = {
    error: "border-danger/40 bg-danger/10",
    ok: "border-success/40 bg-success/10",
    aviso: "border-warning/40 bg-warning/10",
  }[tono];
  return (
    <div
      role={tono === "error" ? "alert" : "status"}
      className={cn("rounded-[var(--radius-md)] border p-3 text-[14px] text-fg", estilos)}
    >
      {children}
    </div>
  );
}

/**
 * La copia local del catálogo con un registro recién guardado (o dado de
 * alta), para no volver a bajarlo entero después de cada toque.
 */
export function conGuardado(
  d: CatalogoAdmin,
  tipo: TipoRegistro,
  id: string,
  { datos, huella, editadoEn, editadoPor }: RegistroGuardado,
): CatalogoAdmin {
  const poner = <T,>(lista: T[], clave: (x: T) => string): T[] => {
    const i = lista.findIndex((x) => clave(x) === id);
    return i === -1 ? [...lista, datos as T] : lista.map((x, j) => (j === i ? (datos as T) : x));
  };
  const c = d.catalogo;
  const k = `${tipo}:${id}`;
  return {
    ...d,
    catalogo: {
      ...c,
      productos: tipo === "producto" ? poner(c.productos, (p) => p.codigo) : c.productos,
      marcas: tipo === "marca" ? poner(c.marcas, (m) => m.slug) : c.marcas,
      sets: tipo === "set" ? poner(c.sets, (s) => s.codigo) : c.sets,
      lotes: tipo === "lote" ? poner(c.lotes, (l) => l.slug) : c.lotes,
    },
    // Un alta del panel no vino del CSV; una edición conserva lo que era.
    registros: {
      ...d.registros,
      [k]: { ...(d.registros[k] ?? { deCsv: false }), huella, editadoEn, editadoPor },
    },
    publicacion: { ...d.publicacion, pendiente: true },
  };
}

export function sinRegistro(d: CatalogoAdmin, tipo: TipoRegistro, id: string): CatalogoAdmin {
  const c = d.catalogo;
  const registros = { ...d.registros };
  delete registros[`${tipo}:${id}`];
  return {
    ...d,
    catalogo: {
      ...c,
      productos: tipo === "producto" ? c.productos.filter((p) => p.codigo !== id) : c.productos,
      marcas: tipo === "marca" ? c.marcas.filter((m) => m.slug !== id) : c.marcas,
      sets: tipo === "set" ? c.sets.filter((s) => s.codigo !== id) : c.sets,
      lotes: tipo === "lote" ? c.lotes.filter((l) => l.slug !== id) : c.lotes,
    },
    registros,
    publicacion: { ...d.publicacion, pendiente: true },
  };
}

/**
 * «Lattafa Yara» → `lattafa-yara`. La misma regla que `aSlug` de
 * `compartido/validar-catalogo.ts`, que es la que valida el servidor.
 */
export function aSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** «pimienta rosa, bergamota» ⇄ `["pimienta rosa", "bergamota"]`. */
export const aTextoLista = (lista: readonly string[]) => lista.join(", ");
export const deTextoLista = (texto: string) =>
  texto
    .split(/[,|\n]/)
    .map((x) => x.trim())
    .filter((x) => x !== "");

/** Un número del formulario, o `undefined` si se dejó vacío. */
export const numeroOVacio = (texto: string): number | undefined => {
  const limpio = texto.replace(/[$,\s]/g, "");
  return limpio === "" ? undefined : Number(limpio);
};

/**
 * Un número opcional: vacío no se manda, y uno mal tecleado («25..») se manda
 * tal cual para que el servidor responda «tiene que ser un número» debajo del
 * campo. Descartarlo lo borraría en silencio —y con él, un valor que ya
 * existía— mientras el formulario lo sigue enseñando.
 */
export function numeroOpcional(texto: string, dividir = 1): number | string | undefined {
  const n = numeroOVacio(texto);
  if (n === undefined || n === 0) return undefined;
  return Number.isFinite(n) ? n / dividir : texto.trim();
}
