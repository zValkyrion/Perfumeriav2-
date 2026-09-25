"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import type {
  ImagenCatalogo,
  LoteCatalogo,
  MarcaCatalogo,
  ProductoCatalogo,
  SetCatalogo,
} from "../../../../compartido/catalogo";
import { AreaTexto, Boton, Campo, Chips, Selector, Tarjeta } from "@/components/ui";
import {
  ErroresDe,
  Escala,
  Interruptor,
  aSlug,
  aTextoLista,
  deTextoLista,
  numeroOVacio,
  numeroOpcional,
} from "@/components/catalogo/comun";
import {
  autorizarImagen,
  subirImagen,
  urlImagen,
  type CatalogoAdmin,
  type ErrorCampo,
} from "@/lib/catalogo-admin";
import { fotoDeCatalogo } from "@/lib/imagen";
import { cn } from "@/lib/utils";

/**
 * Los formularios del catálogo.
 *
 * Cada uno guarda un borrador en texto —lo que se teclea— y lo convierte al
 * guardar. No valida por su cuenta más allá de lo obvio: las reglas son las
 * del servidor, que devuelve cada error con su campo y aquí se pinta debajo.
 * Así no hay dos juegos de reglas que puedan contradecirse.
 */

export interface PropsFormulario<T> {
  /** `null` es un alta. */
  inicial: T | null;
  datos: CatalogoAdmin;
  token: string;
  errores: ErrorCampo[];
  guardando: boolean;
  onGuardar: (id: string, valor: T) => void;
}

const opcionesDe = (lista: readonly string[]) => lista.map((v) => ({ valor: v, etiqueta: v }));

/** Alterna un elemento en una lista de chips de selección múltiple. */
const alternarEn = <T,>(lista: T[], x: T) =>
  lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x];

/** El siguiente código libre del PDF: 0322 después de 0321. */
function siguienteCodigo(datos: CatalogoAdmin): string {
  const numeros = [...datos.catalogo.productos, ...datos.catalogo.sets]
    .map((x) => Number(x.codigo))
    .filter((n) => Number.isInteger(n));
  return String(Math.max(0, ...numeros) + 1).padStart(4, "0");
}

function Seccion({ titulo, pista, children }: { titulo: string; pista?: string; children: React.ReactNode }) {
  return (
    <Tarjeta titulo={titulo} pista={pista}>
      <div className="grid gap-4">{children}</div>
    </Tarjeta>
  );
}

/** El botón de guardar, siempre a mano abajo. */
function BarraGuardar({ guardando, nuevo }: { guardando: boolean; nuevo: boolean }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-2xl border-t border-border-strong bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <Boton type="submit" disabled={guardando} className="w-full">
        {guardando ? "Guardando…" : nuevo ? "Dar de alta" : "Guardar cambios"}
      </Boton>
    </div>
  );
}

/* ── Foto ─────────────────────────────────────────────────────────────── */

/**
 * La foto se prepara en el teléfono y sube directo a S3 al elegirla; el
 * registro la estrena al guardar. Si no se guarda, el archivo se queda en el
 * bucket sin que nada lo use: pesa unos KB y no se publica.
 */
function CampoFoto({
  tipo,
  codigo,
  imagenes,
  onChange,
  token,
  errores,
}: {
  tipo: "producto" | "set";
  codigo: string;
  imagenes: ImagenCatalogo[];
  onChange: (imagenes: ImagenCatalogo[]) => void;
  token: string;
  errores: ErrorCampo[];
}) {
  const [estado, setEstado] = useState<"quieto" | "preparando" | "subiendo">("quieto");
  const [previa, setPrevia] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previa) URL.revokeObjectURL(previa);
    };
  }, [previa]);

  const actual = imagenes[0];
  const url = previa ?? (actual ? urlImagen(actual.clave) : null);
  const sinCodigo = codigo.trim() === "";

  const elegir = async (archivo: File) => {
    setError(null);
    setEstado("preparando");
    try {
      const foto = await fotoDeCatalogo(archivo, tipo);
      setEstado("subiendo");
      const permiso = await autorizarImagen(token, {
        tipo,
        codigo: codigo.trim(),
        sha256: foto.sha256,
        formato: foto.formato,
      });
      await subirImagen(permiso, foto.blob);
      setPrevia(URL.createObjectURL(foto.blob));
      onChange([
        { clave: permiso.clave, ancho: foto.ancho, alto: foto.alto, blur: foto.blur },
        ...imagenes.slice(1),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto");
    } finally {
      setEstado("quieto");
    }
  };

  return (
    <div>
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "grid shrink-0 place-items-center overflow-hidden rounded-[var(--radius-md)] border border-border-soft bg-white",
            tipo === "producto" ? "h-40 w-30" : "h-30 w-40",
          )}
          style={actual && !previa ? { backgroundImage: `url(${actual.blur})`, backgroundSize: "cover" } : undefined}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- exportación estática, sin optimizador
            <img src={url} alt="Foto actual" className="h-full w-full object-contain" />
          ) : (
            <span className="px-2 text-center text-[12px] text-fg-subtle">
              {actual ? "Foto sin CDN en esta copia" : "Sin foto"}
            </span>
          )}
        </div>
        <div className="grid min-w-0 flex-1 gap-2">
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              // Vaciar permite volver a elegir el mismo archivo si falló.
              e.target.value = "";
              if (archivo) void elegir(archivo);
            }}
          />
          <Boton
            type="button"
            variante="secundario"
            disabled={sinCodigo || estado !== "quieto"}
            onClick={() => entrada.current?.click()}
          >
            <ImagePlus size={18} />
            {estado === "preparando"
              ? "Preparando…"
              : estado === "subiendo"
                ? "Subiendo…"
                : actual
                  ? "Cambiar foto"
                  : "Elegir foto"}
          </Boton>
          {actual && estado === "quieto" && (
            <Boton
              type="button"
              variante="peligro"
              onClick={() => {
                setPrevia(null);
                onChange(imagenes.slice(1));
              }}
            >
              <X size={18} />
              Quitar foto
            </Boton>
          )}
          <p className="text-[12px] text-fg-subtle">
            {sinCodigo
              ? "Escribe el código primero: la foto se guarda con él."
              : "Se recorta sola al formato de la tienda, sobre fondo blanco."}
          </p>
        </div>
      </div>
      {error && <p className="mt-2 text-[13px] font-medium text-danger">{error}</p>}
      <ErroresDe errores={errores} campo="imagenes" />
    </div>
  );
}

/* ── Perfume ──────────────────────────────────────────────────────────── */

interface BorradorProducto {
  codigo: string;
  nombre: string;
  slug: string;
  marca: string;
  linea: string;
  codigosAlternos: string;
  concentracion: string;
  genero: string;
  familia: string;
  presentaciones: { ml: string; precio: string }[];
  rebaja: string;
  salida: string;
  corazon: string;
  fondo: string;
  corta: string;
  larga: string;
  badges: string[];
  ocasion: string[];
  duracion: number;
  estela: number;
  destacado: boolean;
  anio: string;
  origen: string;
  agotado: boolean;
  visible: boolean;
  imagenes: ImagenCatalogo[];
  nota: string;
}

function borradorProducto(p: ProductoCatalogo | null, codigo: string): BorradorProducto {
  return {
    codigo: p?.codigo ?? codigo,
    nombre: p?.nombre ?? "",
    slug: p?.slug ?? "",
    marca: p?.marca ?? "",
    linea: p?.linea ?? "",
    codigosAlternos: aTextoLista(p?.codigosAlternos ?? []),
    concentracion: p?.concentracion ?? "Eau de Parfum",
    genero: p?.genero ?? "",
    familia: p?.familia ?? "",
    presentaciones: (p?.presentaciones ?? [{ ml: 100, precio: 0 }]).map((v) => ({
      ml: String(v.ml),
      precio: v.precio ? String(v.precio) : "",
    })),
    // En el formulario va en porcentaje: «25», no «0.25».
    rebaja: p?.rebaja ? String(Math.round(p.rebaja * 1000) / 10) : "",
    salida: aTextoLista(p?.salida ?? []),
    corazon: aTextoLista(p?.corazon ?? []),
    fondo: aTextoLista(p?.fondo ?? []),
    corta: p?.corta ?? "",
    larga: p?.larga && p.larga !== p.corta ? p.larga : "",
    badges: [...(p?.badges ?? [])],
    ocasion: [...(p?.ocasion ?? [])],
    duracion: p?.duracion ?? 3,
    estela: p?.estela ?? 3,
    destacado: p?.destacado ?? false,
    anio: p?.anio ? String(p.anio) : "",
    origen: p?.origen ?? "",
    agotado: p?.agotado ?? false,
    visible: p?.visible ?? true,
    imagenes: p?.imagenes ?? [],
    nota: p?.nota ?? "",
  };
}

function productoDe(b: BorradorProducto): ProductoCatalogo {
  const rebaja = numeroOpcional(b.rebaja, 100);
  const anio = numeroOpcional(b.anio);
  // El servidor revisa cada campo; aquí solo se pasa del texto a la forma.
  return {
    codigo: b.codigo.trim(),
    codigosAlternos: deTextoLista(b.codigosAlternos),
    slug: b.slug.trim(),
    nombre: b.nombre,
    marca: b.marca,
    ...(b.linea.trim() ? { linea: b.linea } : {}),
    concentracion: b.concentracion,
    genero: b.genero,
    familia: b.familia,
    presentaciones: b.presentaciones
      .filter((v) => v.ml.trim() !== "" || v.precio.trim() !== "")
      .map((v) => ({ ml: Number(v.ml), precio: numeroOVacio(v.precio) ?? 0 })),
    ...(rebaja !== undefined ? { rebaja } : {}),
    salida: deTextoLista(b.salida),
    corazon: deTextoLista(b.corazon),
    fondo: deTextoLista(b.fondo),
    corta: b.corta,
    larga: b.larga,
    badges: b.badges,
    duracion: b.duracion,
    estela: b.estela,
    ocasion: b.ocasion,
    destacado: b.destacado,
    ...(anio !== undefined ? { anio } : {}),
    ...(b.origen.trim() ? { origen: b.origen } : {}),
    agotado: b.agotado,
    visible: b.visible,
    imagenes: b.imagenes,
    ...(b.nota.trim() ? { nota: b.nota } : {}),
  } as ProductoCatalogo;
}

export function FormProducto({
  inicial,
  datos,
  token,
  errores,
  guardando,
  onGuardar,
}: PropsFormulario<ProductoCatalogo>) {
  const nuevo = inicial === null;
  const [b, setB] = useState(() => borradorProducto(inicial, siguienteCodigo(datos)));
  // En un alta el slug se arma solo con marca y nombre hasta que alguien lo toque.
  const [slugTocado, setSlugTocado] = useState(!nuevo);
  const poner = <K extends keyof BorradorProducto>(k: K, v: BorradorProducto[K]) =>
    setB((x) => ({ ...x, [k]: v }));
  const v = datos.vocabulario;
  const slug = slugTocado ? b.slug : aSlug(`${b.marca} ${b.nombre}`);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar(b.codigo.trim(), productoDe({ ...b, slug }));
      }}
    >
      <Seccion titulo="Qué es">
        <Campo
          etiqueta="Código del catálogo"
          value={b.codigo}
          disabled={!nuevo}
          inputMode="text"
          onChange={(e) => poner("codigo", e.target.value)}
          pista={nuevo ? "El número del PDF. Es su identificador: no se cambia después." : "El número del PDF. No se cambia."}
        />
        <ErroresDe errores={errores} campo="codigo" />
        <div>
          <Campo etiqueta="Nombre" value={b.nombre} onChange={(e) => poner("nombre", e.target.value)} pista="Sin la marca: «Yara», no «Lattafa Yara»." />
          <ErroresDe errores={errores} campo="nombre" />
        </div>
        <div>
          <Selector
            etiqueta="Marca"
            opciones={datos.catalogo.marcas.map((m) => ({ valor: m.slug, etiqueta: m.nombre }))}
            valor={b.marca || null}
            onChange={(x) => poner("marca", x ?? "")}
            vacio="Elige la marca"
          />
          <ErroresDe errores={errores} campo="marca" />
        </div>
        <div>
          <Campo
            etiqueta="Dirección en la tienda"
            value={slug}
            disabled={!nuevo}
            onChange={(e) => {
              setSlugTocado(true);
              poner("slug", e.target.value);
            }}
            pista={nuevo ? `Quedará en /producto/${slug || "…"}/` : "No se cambia: el enlace viejo daría error y se perdería lo ganado en Google."}
          />
          <ErroresDe errores={errores} campo="slug" />
        </div>
        <div>
          <Campo etiqueta="Línea (opcional)" value={b.linea} onChange={(e) => poner("linea", e.target.value)} />
          <ErroresDe errores={errores} campo="linea" />
        </div>
        <div>
          <Campo etiqueta="Otros códigos (opcional)" value={b.codigosAlternos} onChange={(e) => poner("codigosAlternos", e.target.value)} pista="Si aparece con otro número en el PDF. Separados por coma." />
          <ErroresDe errores={errores} campo="codigosAlternos" />
        </div>
      </Seccion>

      <Seccion titulo="Venta" pista="Agotado y precios cuentan en la tienda en un minuto.">
        <Interruptor etiqueta="Existencias" valor={b.agotado} onChange={(x) => poner("agotado", x)} textos={["Agotado", "Disponible"]} peligroSi pista="Agotado se ve, pero no se puede comprar." />
        <Interruptor etiqueta="Publicado" valor={b.visible} onChange={(x) => poner("visible", x)} textos={["Visible", "Oculto"]} pista="Oculto deja de venderse en un minuto y sale de la tienda al publicar." />
        <div>
          <span className="mb-1 block text-[13px] font-medium text-fg-muted">Tamaños y precios de lista</span>
          <div className="grid gap-2">
            {b.presentaciones.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <label className="flex h-12 flex-1 items-center rounded-[var(--radius-md)] border border-border-strong bg-surface px-3">
                  <input aria-label="Mililitros" inputMode="numeric" value={p.ml} onChange={(e) => poner("presentaciones", b.presentaciones.map((x, j) => (j === i ? { ...x, ml: e.target.value } : x)))} className="w-full min-w-0 bg-transparent" />
                  <span className="text-[13px] text-fg-subtle">ml</span>
                </label>
                <label className="flex h-12 flex-[1.4] items-center rounded-[var(--radius-md)] border border-border-strong bg-surface px-3">
                  <span className="text-[13px] text-fg-subtle">$</span>
                  <input aria-label="Precio" inputMode="decimal" value={p.precio} onChange={(e) => poner("presentaciones", b.presentaciones.map((x, j) => (j === i ? { ...x, precio: e.target.value } : x)))} className="w-full min-w-0 bg-transparent pl-1" />
                </label>
                <button type="button" aria-label="Quitar tamaño" disabled={b.presentaciones.length === 1} onClick={() => poner("presentaciones", b.presentaciones.filter((_, j) => j !== i))} className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--radius-md)] border border-border-strong text-fg-subtle disabled:opacity-40">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          {b.presentaciones.length < 6 && (
            <button type="button" onClick={() => poner("presentaciones", [...b.presentaciones, { ml: "", precio: "" }])} className="mt-2 inline-flex min-h-11 items-center gap-1 text-[14px] font-medium text-gold">
              <Plus size={16} /> Agregar tamaño
            </button>
          )}
          <ErroresDe errores={errores} campo="presentaciones" />
        </div>
        <div>
          <Campo etiqueta="Rebaja (%)" inputMode="decimal" value={b.rebaja} onChange={(e) => poner("rebaja", e.target.value)} pista="Vacío = sin precio tachado. Con 25, la tienda tacha un precio anterior del que el actual es 25% menos." />
          <ErroresDe errores={errores} campo="rebaja" />
        </div>
        <Chips etiqueta="Etiquetas" opciones={opcionesDe(v.badges)} valor={b.badges} onChange={(x) => poner("badges", alternarEn(b.badges, x))} />
        <p className="-mt-2 text-[12px] text-fg-subtle">«Edición limitada» no entra al mayoreo; «3x2» entra a la promoción.</p>
        <Interruptor etiqueta="Destacado en la portada" valor={b.destacado} onChange={(x) => poner("destacado", x)} />
      </Seccion>

      <Seccion titulo="Foto">
        <CampoFoto tipo="producto" codigo={b.codigo} imagenes={b.imagenes} onChange={(x) => poner("imagenes", x)} token={token} errores={errores} />
      </Seccion>

      <Seccion titulo="Cómo es" pista="De esto dependen las categorías y los filtros de la tienda.">
        <div>
          <Chips etiqueta="Concentración" opciones={opcionesDe(v.concentraciones)} valor={b.concentracion} onChange={(x) => poner("concentracion", x)} />
          <ErroresDe errores={errores} campo="concentracion" />
        </div>
        <div>
          <Chips etiqueta="Para" opciones={opcionesDe(v.generos)} valor={b.genero} onChange={(x) => poner("genero", x)} />
          <ErroresDe errores={errores} campo="genero" />
        </div>
        <div>
          <Chips etiqueta="Familia olfativa" opciones={opcionesDe(v.familias)} valor={b.familia} onChange={(x) => poner("familia", x)} />
          <ErroresDe errores={errores} campo="familia" />
        </div>
        <Chips etiqueta="Ocasión" opciones={opcionesDe(v.ocasiones)} valor={b.ocasion} onChange={(x) => poner("ocasion", alternarEn(b.ocasion, x))} />
        <Escala etiqueta="Duración" valor={b.duracion} onChange={(x) => poner("duracion", x)} leyendas={["Poca", "Todo el día"]} />
        <Escala etiqueta="Estela" valor={b.estela} onChange={(x) => poner("estela", x)} leyendas={["Íntima", "Llena el cuarto"]} />
        <div>
          <Campo etiqueta="Notas de salida" value={b.salida} onChange={(e) => poner("salida", e.target.value)} pista="Separadas por coma: bergamota, pimienta rosa" />
          <ErroresDe errores={errores} campo="salida" />
        </div>
        <div>
          <Campo etiqueta="Notas de corazón" value={b.corazon} onChange={(e) => poner("corazon", e.target.value)} />
          <ErroresDe errores={errores} campo="corazon" />
        </div>
        <div>
          <Campo etiqueta="Notas de fondo" value={b.fondo} onChange={(e) => poner("fondo", e.target.value)} />
          <ErroresDe errores={errores} campo="fondo" />
        </div>
        <div>
          <AreaTexto etiqueta="Descripción corta" value={b.corta} onChange={(e) => poner("corta", e.target.value)} />
          <ErroresDe errores={errores} campo="corta" />
        </div>
        <div>
          <AreaTexto etiqueta="Descripción larga (opcional)" value={b.larga} placeholder="Vacía, la ficha usa la corta" onChange={(e) => poner("larga", e.target.value)} />
          <ErroresDe errores={errores} campo="larga" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Campo etiqueta="Año (opcional)" inputMode="numeric" value={b.anio} onChange={(e) => poner("anio", e.target.value)} />
            <ErroresDe errores={errores} campo="anio" />
          </div>
          <div>
            <Campo etiqueta="Origen (opcional)" value={b.origen} onChange={(e) => poner("origen", e.target.value)} />
            <ErroresDe errores={errores} campo="origen" />
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Nota interna" pista="Solo para el equipo: no se publica.">
        <div>
          <AreaTexto etiqueta="Nota" value={b.nota} placeholder="De dónde salió el dato, qué falta confirmar…" onChange={(e) => poner("nota", e.target.value)} />
          <ErroresDe errores={errores} campo="nota" />
        </div>
      </Seccion>

      <BarraGuardar guardando={guardando} nuevo={nuevo} />
    </form>
  );
}

/* ── Marca ────────────────────────────────────────────────────────────── */

export function FormMarca({ inicial, errores, guardando, onGuardar }: PropsFormulario<MarcaCatalogo>) {
  const nuevo = inicial === null;
  const [b, setB] = useState({
    nombre: inicial?.nombre ?? "",
    slug: inicial?.slug ?? "",
    pais: inicial?.pais ?? "",
    fundada: inicial?.fundada ? String(inicial.fundada) : "",
    firma: inicial?.firma ?? "",
    descripcion: inicial?.descripcion ?? "",
  });
  const poner = (k: keyof typeof b, v: string) => setB((x) => ({ ...x, [k]: v }));
  const slug = nuevo && b.slug === "" ? aSlug(b.nombre) : b.slug;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fundada = numeroOpcional(b.fundada);
        // Un año mal tecleado viaja como texto para que el servidor lo rechace.
        onGuardar(slug, {
          slug,
          nombre: b.nombre,
          pais: b.pais,
          ...(fundada !== undefined ? { fundada } : {}),
          firma: b.firma,
          descripcion: b.descripcion,
        } as MarcaCatalogo);
      }}
    >
      <Seccion titulo="La casa">
        <div>
          <Campo etiqueta="Nombre" value={b.nombre} onChange={(e) => poner("nombre", e.target.value)} />
          <ErroresDe errores={errores} campo="nombre" />
        </div>
        <div>
          <Campo etiqueta="Identificador" value={slug} disabled={!nuevo} onChange={(e) => poner("slug", e.target.value)} pista={nuevo ? `Su página quedará en /marca/${slug || "…"}/` : "No se cambia: los perfumes apuntan a él."} />
          <ErroresDe errores={errores} campo="slug" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Campo etiqueta="País" value={b.pais} onChange={(e) => poner("pais", e.target.value)} />
            <ErroresDe errores={errores} campo="pais" />
          </div>
          <div>
            <Campo etiqueta="Fundada (opcional)" inputMode="numeric" value={b.fundada} onChange={(e) => poner("fundada", e.target.value)} />
            <ErroresDe errores={errores} campo="fundada" />
          </div>
        </div>
        <div>
          <Campo etiqueta="Firma" value={b.firma} onChange={(e) => poner("firma", e.target.value)} pista="Una línea: por qué es conocida." />
          <ErroresDe errores={errores} campo="firma" />
        </div>
        <div>
          <AreaTexto etiqueta="Descripción" value={b.descripcion} onChange={(e) => poner("descripcion", e.target.value)} />
          <ErroresDe errores={errores} campo="descripcion" />
        </div>
      </Seccion>
      <BarraGuardar guardando={guardando} nuevo={nuevo} />
    </form>
  );
}

/* ── Set de regalo ────────────────────────────────────────────────────── */

export function FormSet({ inicial, datos, token, errores, guardando, onGuardar }: PropsFormulario<SetCatalogo>) {
  const nuevo = inicial === null;
  const [b, setB] = useState({
    codigo: inicial?.codigo ?? siguienteCodigo(datos),
    nombre: inicial?.nombre ?? "",
    slug: inicial?.slug ?? "",
    marca: inicial?.marca ?? "",
    precio: inicial?.precio ? String(inicial.precio) : "",
    precioAnterior: inicial?.precioAnterior ? String(inicial.precioAnterior) : "",
    incluye: aTextoLista(inicial?.incluye ?? []),
    descripcion: inicial?.descripcion ?? "",
    agotado: inicial?.agotado ?? false,
    visible: inicial?.visible ?? true,
    imagenes: inicial?.imagenes ?? [],
    nota: inicial?.nota ?? "",
  });
  const poner = <K extends keyof typeof b>(k: K, v: (typeof b)[K]) => setB((x) => ({ ...x, [k]: v }));
  const slug = nuevo && b.slug === "" ? aSlug(`set ${b.nombre}`) : b.slug;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const precioAnterior = numeroOpcional(b.precioAnterior);
        onGuardar(b.codigo.trim(), {
          codigo: b.codigo.trim(),
          slug,
          nombre: b.nombre,
          marca: b.marca,
          precio: numeroOVacio(b.precio) ?? 0,
          ...(precioAnterior !== undefined ? { precioAnterior } : {}),
          incluye: deTextoLista(b.incluye),
          descripcion: b.descripcion,
          agotado: b.agotado,
          visible: b.visible,
          imagenes: b.imagenes,
          ...(b.nota.trim() ? { nota: b.nota } : {}),
          // Un precio anterior mal tecleado viaja como texto para que el
          // servidor lo rechace.
        } as SetCatalogo);
      }}
    >
      <Seccion titulo="El set">
        <div>
          <Campo etiqueta="Código del catálogo" value={b.codigo} disabled={!nuevo} onChange={(e) => poner("codigo", e.target.value)} />
          <ErroresDe errores={errores} campo="codigo" />
        </div>
        <div>
          <Campo etiqueta="Nombre" value={b.nombre} onChange={(e) => poner("nombre", e.target.value)} />
          <ErroresDe errores={errores} campo="nombre" />
        </div>
        <div>
          <Campo etiqueta="Dirección" value={slug} disabled={!nuevo} onChange={(e) => poner("slug", e.target.value)} />
          <ErroresDe errores={errores} campo="slug" />
        </div>
        <div>
          <Selector etiqueta="Marca (opcional)" opciones={datos.catalogo.marcas.map((m) => ({ valor: m.slug, etiqueta: m.nombre }))} valor={b.marca || null} onChange={(x) => poner("marca", x ?? "")} vacio="Varias / sin marca" />
          <ErroresDe errores={errores} campo="marca" />
        </div>
      </Seccion>
      <Seccion titulo="Venta">
        <Interruptor etiqueta="Existencias" valor={b.agotado} onChange={(x) => poner("agotado", x)} textos={["Agotado", "Disponible"]} peligroSi />
        <Interruptor etiqueta="Publicado" valor={b.visible} onChange={(x) => poner("visible", x)} textos={["Visible", "Oculto"]} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Campo etiqueta="Precio" inputMode="decimal" value={b.precio} onChange={(e) => poner("precio", e.target.value)} />
            <ErroresDe errores={errores} campo="precio" />
          </div>
          <div>
            <Campo etiqueta="Precio anterior" inputMode="decimal" value={b.precioAnterior} onChange={(e) => poner("precioAnterior", e.target.value)} pista="Opcional, tachado." />
            <ErroresDe errores={errores} campo="precioAnterior" />
          </div>
        </div>
      </Seccion>
      <Seccion titulo="Foto">
        <CampoFoto tipo="set" codigo={b.codigo} imagenes={b.imagenes} onChange={(x) => poner("imagenes", x)} token={token} errores={errores} />
      </Seccion>
      <Seccion titulo="Qué trae">
        <div>
          <Campo etiqueta="Incluye" value={b.incluye} onChange={(e) => poner("incluye", e.target.value)} pista="Separado por coma: perfume 100 ml, desodorante 150 ml" />
          <ErroresDe errores={errores} campo="incluye" />
        </div>
        <div>
          <AreaTexto etiqueta="Descripción" value={b.descripcion} onChange={(e) => poner("descripcion", e.target.value)} />
          <ErroresDe errores={errores} campo="descripcion" />
        </div>
        <AreaTexto etiqueta="Nota interna (no se publica)" value={b.nota} onChange={(e) => poner("nota", e.target.value)} />
        <ErroresDe errores={errores} campo="nota" />
      </Seccion>
      <BarraGuardar guardando={guardando} nuevo={nuevo} />
    </form>
  );
}

/* ── Lote para revender ───────────────────────────────────────────────── */

export function FormLote({ inicial, datos, errores, guardando, onGuardar }: PropsFormulario<LoteCatalogo>) {
  const nuevo = inicial === null;
  const [b, setB] = useState({
    nombre: inicial?.nombre ?? "",
    slug: inicial?.slug ?? "",
    tema: inicial?.tema ?? "",
    piezas: inicial?.piezas ? String(inicial.piezas) : "",
    precio: inicial?.precio ? String(inicial.precio) : "",
    modelos: aTextoLista(inicial?.modelos ?? []),
    descripcion: inicial?.descripcion ?? "",
    incluye: aTextoLista(inicial?.incluye ?? []),
    masVendido: inicial?.masVendido ?? false,
  });
  const poner = <K extends keyof typeof b>(k: K, v: (typeof b)[K]) => setB((x) => ({ ...x, [k]: v }));
  const slug = nuevo && b.slug === "" ? aSlug(b.nombre) : b.slug;
  const porCodigo = new Map(datos.catalogo.productos.map((p) => [p.codigo, p]));
  const modelos = deTextoLista(b.modelos);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar(slug, {
          slug,
          nombre: b.nombre,
          tema: b.tema,
          piezas: numeroOVacio(b.piezas) ?? 0,
          precio: numeroOVacio(b.precio) ?? 0,
          modelos,
          descripcion: b.descripcion,
          incluye: deTextoLista(b.incluye),
          masVendido: b.masVendido,
        });
      }}
    >
      <Seccion titulo="El lote">
        <div>
          <Campo etiqueta="Nombre" value={b.nombre} onChange={(e) => poner("nombre", e.target.value)} />
          <ErroresDe errores={errores} campo="nombre" />
        </div>
        <div>
          <Campo etiqueta="Dirección" value={slug} disabled={!nuevo} onChange={(e) => poner("slug", e.target.value)} pista={nuevo ? `Quedará en /lotes/${slug || "…"}/` : undefined} />
          <ErroresDe errores={errores} campo="slug" />
        </div>
        <div>
          <Campo etiqueta="Tema" value={b.tema} placeholder="Mixto" onChange={(e) => poner("tema", e.target.value)} />
          <ErroresDe errores={errores} campo="tema" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Campo etiqueta="Piezas" inputMode="numeric" value={b.piezas} onChange={(e) => poner("piezas", e.target.value)} />
            <ErroresDe errores={errores} campo="piezas" />
          </div>
          <div>
            <Campo etiqueta="Precio del paquete" inputMode="decimal" value={b.precio} onChange={(e) => poner("precio", e.target.value)} />
            <ErroresDe errores={errores} campo="precio" />
          </div>
        </div>
        <div>
          <Campo etiqueta="Modelos (códigos)" value={b.modelos} onChange={(e) => poner("modelos", e.target.value)} pista="Separados por coma. Las piezas se reparten entre ellos." />
          <ErroresDe errores={errores} campo="modelos" />
          {modelos.length > 0 && (
            <ul className="mt-2 grid gap-1 text-[13px]">
              {modelos.map((m) => {
                const p = porCodigo.get(m);
                return (
                  <li key={m} className={cn(!p || p.agotado || !p.visible ? "text-danger" : "text-fg-muted")}>
                    {m} · {p ? `${p.nombre}${p.agotado ? " (agotado)" : !p.visible ? " (oculto)" : ""}` : "no existe"}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Interruptor etiqueta="Más vendido" valor={b.masVendido} onChange={(x) => poner("masVendido", x)} />
        <div>
          <Campo etiqueta="Incluye" value={b.incluye} onChange={(e) => poner("incluye", e.target.value)} pista="Separado por coma." />
          <ErroresDe errores={errores} campo="incluye" />
        </div>
        <div>
          <AreaTexto etiqueta="Descripción" value={b.descripcion} onChange={(e) => poner("descripcion", e.target.value)} />
          <ErroresDe errores={errores} campo="descripcion" />
        </div>
      </Seccion>
      <BarraGuardar guardando={guardando} nuevo={nuevo} />
    </form>
  );
}
