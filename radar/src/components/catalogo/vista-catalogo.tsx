"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Eye,
  EyeOff,
  ImageOff,
  Plus,
  RefreshCw,
  Search,
  StickyNote,
} from "lucide-react";
import type {
  LoteCatalogo,
  ProductoCatalogo,
  SetCatalogo,
} from "../../../../compartido/catalogo";
import { Boton, Insignia } from "@/components/ui";
import { BarraPublicacion } from "@/components/catalogo/barra-publicacion";
import {
  Mensaje,
  PuertaCatalogo,
  conGuardado,
  useCatalogoAdmin,
} from "@/components/catalogo/comun";
import {
  exportarCsv,
  guardarRegistro,
  pesos,
  urlImagen,
  type TipoRegistro,
} from "@/lib/catalogo-admin";
import { cn } from "@/lib/utils";

/**
 * El catálogo de la tienda, para editarlo desde el teléfono.
 *
 * Lo de todos los días —marcar agotado, ocultar— se hace desde la lista con un
 * toque y se guarda en el acto. Lo demás abre el editor.
 */

type Pestana = "producto" | "set" | "marca" | "lote";
type Filtro = "todos" | "agotados" | "ocultos" | "sinFoto" | "conNota";

const PESTANAS: { valor: Pestana; etiqueta: string; nuevo: string; archivo: "productos" | "sets" | "marcas" | "lotes" }[] = [
  { valor: "producto", etiqueta: "Perfumes", nuevo: "Nuevo perfume", archivo: "productos" },
  { valor: "set", etiqueta: "Sets", nuevo: "Nuevo set", archivo: "sets" },
  { valor: "marca", etiqueta: "Marcas", nuevo: "Nueva marca", archivo: "marcas" },
  { valor: "lote", etiqueta: "Lotes", nuevo: "Nuevo lote", archivo: "lotes" },
];

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "agotados", etiqueta: "Agotados" },
  { valor: "ocultos", etiqueta: "Ocultos" },
  { valor: "sinFoto", etiqueta: "Sin foto" },
  { valor: "conNota", etiqueta: "Con nota" },
];

/** Dónde se quedó la lista, para volver del editor al mismo sitio. */
const CLAVE_VISTA = "radar:catalogo:vista";

const normalizar = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const enlaceEditar = (tipo: TipoRegistro, id?: string) =>
  id ? `/catalogo/editar/?tipo=${tipo}&id=${encodeURIComponent(id)}` : `/catalogo/editar/?tipo=${tipo}&nuevo=1`;

/**
 * La vista se recuerda por pestaña del navegador: al volver del editor se
 * sigue en la misma búsqueda, no en el principio de 300 perfumes.
 */
function vistaGuardada(): { pestana?: Pestana; filtro?: Filtro; busqueda?: string } {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_VISTA) ?? "{}");
  } catch {
    return {};
  }
}

export function VistaCatalogo() {
  const c = useCatalogoAdmin();
  const [inicial] = useState(vistaGuardada);
  const [pestana, setPestana] = useState<Pestana>(inicial.pestana ?? "producto");
  const [filtro, setFiltro] = useState<Filtro>(inicial.filtro ?? "todos");
  const [busqueda, setBusqueda] = useState(inicial.busqueda ?? "");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_VISTA, JSON.stringify({ pestana, filtro, busqueda }));
    } catch {
      // No pasa nada: solo se pierde el recordatorio.
    }
  }, [pestana, filtro, busqueda]);

  const datos = c.datos;
  const marcas = useMemo(
    () => new Map((datos?.catalogo.marcas ?? []).map((m) => [m.slug, m.nombre])),
    [datos],
  );

  const q = normalizar(busqueda.trim());
  const coincide = (...textos: (string | undefined)[]) =>
    q === "" || normalizar(textos.filter(Boolean).join(" ")).includes(q);

  const productos = (datos?.catalogo.productos ?? []).filter((p) => {
    if (filtro === "agotados" && !p.agotado) return false;
    if (filtro === "ocultos" && p.visible) return false;
    if (filtro === "sinFoto" && p.imagenes.length > 0) return false;
    if (filtro === "conNota" && !p.nota) return false;
    return coincide(p.codigo, p.nombre, marcas.get(p.marca), p.slug, ...p.codigosAlternos);
  });

  const bloqueo = PuertaCatalogo({ c });
  if (bloqueo) return bloqueo;

  const alternar = async (
    tipo: "producto" | "set",
    registro: ProductoCatalogo | SetCatalogo,
    cambio: { agotado?: boolean; visible?: boolean },
  ) => {
    if (!datos || !c.token) return;
    const clave = `${tipo}:${registro.codigo}`;
    const estado = datos.registros[clave];
    if (!estado) return;
    const nuevo = { ...registro, ...cambio };
    setOcupado(clave);
    setAviso(null);
    try {
      const r =
        tipo === "producto"
          ? await guardarRegistro(c.token, "producto", registro.codigo, nuevo as ProductoCatalogo, estado.huella)
          : await guardarRegistro(c.token, "set", registro.codigo, nuevo as SetCatalogo, estado.huella);
      c.setDatos((d) => (d ? conGuardado(d, tipo, registro.codigo, r) : d));
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setOcupado(null);
    }
  };

  const exportar = async () => {
    if (!c.token) return;
    setExportando(true);
    try {
      await exportarCsv(c.token, PESTANAS.find((p) => p.valor === pestana)!.archivo);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setExportando(false);
    }
  };

  const cat = datos?.catalogo;
  const actual = PESTANAS.find((p) => p.valor === pestana)!;

  return (
    <main className="p-4 pb-28">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-fg-subtle"
          >
            <ArrowLeft size={15} />
            Proveedores
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Catálogo de la tienda</h1>
          <p className="text-[13px] text-fg-subtle">
            {cat
              ? `${cat.productos.filter((p) => p.visible).length} perfumes publicados · ` +
                `${cat.productos.filter((p) => p.agotado).length} agotados · ` +
                `${cat.productos.filter((p) => !p.visible).length} ocultos`
              : c.error
                ? "No se pudo leer"
                : "Cargando…"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Boton
            variante="secundario"
            onClick={c.recargar}
            className="px-3"
            aria-label="Volver a leer el catálogo"
          >
            <RefreshCw size={18} />
          </Boton>
          <Boton
            variante="secundario"
            onClick={exportar}
            disabled={!datos || exportando}
            className="px-3"
            aria-label={`Exportar ${actual.archivo}.csv`}
            title={`Exportar ${actual.archivo}.csv para Excel`}
          >
            <Download size={18} />
          </Boton>
        </div>
      </header>

      {c.error && (
        <div className="mb-3">
          <Mensaje tono="error">{c.error}</Mensaje>
        </div>
      )}

      {datos && c.token && (
        <div className="mb-3">
          <BarraPublicacion token={c.token} inicial={datos.publicacion} />
        </div>
      )}

      {aviso && (
        <div className="mb-3">
          <Mensaje tono="error">{aviso}</Mensaje>
        </div>
      )}

      <nav className="mb-3 grid grid-cols-4 gap-1 rounded-[var(--radius-md)] bg-surface-2 p-1">
        {PESTANAS.map((p) => (
          <button
            key={p.valor}
            type="button"
            onClick={() => setPestana(p.valor)}
            aria-pressed={pestana === p.valor}
            className={cn(
              "min-h-11 rounded-[var(--radius-sm)] text-[14px] font-semibold",
              pestana === p.valor ? "bg-surface text-fg shadow-sm" : "text-fg-subtle",
            )}
          >
            {p.etiqueta}
          </button>
        ))}
      </nav>

      <div className="relative mb-2">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
        />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por código, nombre o marca"
          className="h-12 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface pl-10 pr-3 placeholder:text-fg-subtle"
        />
      </div>

      {pestana === "producto" && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setFiltro(f.valor)}
              aria-pressed={filtro === f.valor}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-4 text-[13px] font-medium",
                filtro === f.valor
                  ? "border-gold-deep bg-gold-gradient text-white"
                  : "border-border-strong bg-surface text-fg-muted",
              )}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
      )}

      {!cat ? (
        !c.error && <p className="text-[14px] text-fg-subtle">Cargando el catálogo…</p>
      ) : pestana === "producto" ? (
        <Lista vacia={productos.length === 0}>
          {productos.map((p) => (
            <FilaVendible
              key={p.codigo}
              tipo="producto"
              registro={p}
              subtitulo={`${p.codigo} · ${marcas.get(p.marca) ?? p.marca} · ${pesos(Math.min(...p.presentaciones.map((v) => v.precio)))}`}
              ocupado={ocupado === `producto:${p.codigo}`}
              onAlternar={(cambio) => alternar("producto", p, cambio)}
            />
          ))}
        </Lista>
      ) : pestana === "set" ? (
        <Lista vacia={cat.sets.length === 0}>
          {cat.sets
            .filter((s) => coincide(s.codigo, s.nombre, marcas.get(s.marca)))
            .map((s) => (
              <FilaVendible
                key={s.codigo}
                tipo="set"
                registro={s}
                subtitulo={`${s.codigo} · ${pesos(s.precio)}`}
                ocupado={ocupado === `set:${s.codigo}`}
                onAlternar={(cambio) => alternar("set", s, cambio)}
              />
            ))}
        </Lista>
      ) : pestana === "marca" ? (
        <Lista vacia={cat.marcas.length === 0}>
          {cat.marcas
            .filter((m) => coincide(m.slug, m.nombre, m.pais))
            .map((m) => (
              <FilaSimple
                key={m.slug}
                href={enlaceEditar("marca", m.slug)}
                titulo={m.nombre}
                subtitulo={`${m.pais || "Sin país"} · ${cat.productos.filter((p) => p.marca === m.slug).length} perfumes`}
              />
            ))}
        </Lista>
      ) : (
        <Lista vacia={cat.lotes.length === 0}>
          {cat.lotes
            .filter((l) => coincide(l.slug, l.nombre, l.tema))
            .map((l: LoteCatalogo) => (
              <FilaSimple
                key={l.slug}
                href={enlaceEditar("lote", l.slug)}
                titulo={l.nombre}
                subtitulo={`${l.piezas} piezas · ${pesos(l.precio)} · ${l.modelos.length} modelos`}
              />
            ))}
        </Lista>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-2xl border-t border-border-strong bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link href={enlaceEditar(pestana)} className="block">
          <Boton className="w-full">
            <Plus size={20} />
            {actual.nuevo}
          </Boton>
        </Link>
      </div>
    </main>
  );
}

function Lista({ vacia, children }: { vacia: boolean; children: React.ReactNode }) {
  if (vacia) return <p className="py-8 text-center text-[14px] text-fg-subtle">Sin resultados.</p>;
  return <ul className="grid gap-2">{children}</ul>;
}

function Miniatura({ registro }: { registro: ProductoCatalogo | SetCatalogo }) {
  const img = registro.imagenes[0];
  const url = img ? urlImagen(img.clave) : null;
  return (
    <span
      className="grid h-14 w-11 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-sm)] border border-border-soft bg-white"
      style={img ? { backgroundImage: `url(${img.blur})`, backgroundSize: "cover" } : undefined}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- exportación estática, sin optimizador
        <img src={url} alt="" loading="lazy" className="h-full w-full object-contain" />
      ) : (
        !img && <ImageOff size={16} className="text-fg-subtle" />
      )}
    </span>
  );
}

function FilaVendible({
  tipo,
  registro,
  subtitulo,
  ocupado,
  onAlternar,
}: {
  tipo: "producto" | "set";
  registro: ProductoCatalogo | SetCatalogo;
  subtitulo: string;
  ocupado: boolean;
  onAlternar: (cambio: { agotado?: boolean; visible?: boolean }) => void;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius)] border border-border-soft bg-surface p-2",
        !registro.visible && "bg-surface-2",
        ocupado && "opacity-60",
      )}
    >
      <Link
        href={enlaceEditar(tipo, registro.codigo)}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <Miniatura registro={registro} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{registro.nombre}</span>
          <span className="block truncate text-[13px] text-fg-subtle">{subtitulo}</span>
          {(!registro.visible || registro.nota) && (
            <span className="mt-0.5 flex gap-1">
              {!registro.visible && <Insignia>oculto</Insignia>}
              {registro.nota && (
                <Insignia color="var(--color-warning)">
                  <StickyNote size={11} />
                  nota
                </Insignia>
              )}
            </span>
          )}
        </span>
      </Link>
      <button
        type="button"
        disabled={ocupado}
        onClick={() => onAlternar({ agotado: !registro.agotado })}
        aria-label={registro.agotado ? `Marcar ${registro.nombre} disponible` : `Marcar ${registro.nombre} agotado`}
        className={cn(
          "min-h-11 shrink-0 rounded-full border px-3 text-[12px] font-semibold",
          registro.agotado
            ? "border-danger bg-danger text-white"
            : "border-success/50 bg-success/10 text-success",
        )}
      >
        {registro.agotado ? "Agotado" : "Disponible"}
      </button>
      <button
        type="button"
        disabled={ocupado}
        onClick={() => onAlternar({ visible: !registro.visible })}
        aria-label={registro.visible ? `Ocultar ${registro.nombre}` : `Publicar ${registro.nombre}`}
        title={registro.visible ? "Publicado: tocar para ocultar" : "Oculto: tocar para publicar"}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border-strong text-fg-muted"
      >
        {registro.visible ? <Eye size={18} /> : <EyeOff size={18} className="text-fg-subtle" />}
      </button>
    </li>
  );
}

function FilaSimple({ href, titulo, subtitulo }: { href: string; titulo: string; subtitulo: string }) {
  return (
    <li>
      <Link
        href={href}
        className="block rounded-[var(--radius)] border border-border-soft bg-surface p-3"
      >
        <span className="block truncate text-[15px] font-semibold">{titulo}</span>
        <span className="block truncate text-[13px] text-fg-subtle">{subtitulo}</span>
      </Link>
    </li>
  );
}
