"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  MessageCircle,
  Pencil,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  BANDERAS,
  CONCENTRACIONES,
  DECISIONES,
  PRESENTACIONES,
  TIPOS_FOTO,
  TIPOS_PRODUCTO,
  TIPOS_PROMOCION,
  TIPOS_PROVEEDOR,
  UNIDADES_PROMOCION,
} from "@/data/catalogo";
import { MapaPunto } from "@/components/mapa-punto";
import { textoHorario } from "@/components/captura/selector-horario";
import { Boton, Insignia, Tarjeta } from "@/components/ui";
import { borrarProveedor, fotosDe, leerProveedor } from "@/lib/almacen";
import { enlaceMapa } from "@/lib/geo";
import {
  COLOR_SEMAFORO,
  CRITERIOS,
  ETIQUETA_SEMAFORO,
  type Analisis,
  type Criterio,
  analizar,
  completitud,
  costoPorMl,
  escalera,
  huecosDeFicha,
  mensajeSeguimiento,
  precioReferencia,
} from "@/lib/analisis";
import type { Foto, Proveedor } from "@/lib/tipos";
import { enlaceWhatsapp, enlaceWhatsappTexto, fechaCorta } from "@/lib/utils";

export function VistaFicha() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [noExiste, setNoExiste] = useState(false);

  useEffect(() => {
    if (!id) {
      setNoExiste(true);
      return;
    }
    leerProveedor(id).then((p) => {
      if (p) setProveedor(p);
      else setNoExiste(true);
    });
    fotosDe(id).then(setFotos);
  }, [id]);

  const eliminar = async () => {
    if (!proveedor) return;
    if (
      !confirm(
        `¿Eliminar la ficha de ${proveedor.nombre || "este proveedor"}? También se borran sus ${fotos.length} foto(s). No se puede deshacer.`,
      )
    )
      return;
    await borrarProveedor(proveedor.id);
    router.push("/");
  };

  if (noExiste) {
    return (
      <main className="p-4">
        <Tarjeta className="text-center">
          <p className="text-[15px] font-medium">Esa ficha ya no existe</p>
          <p className="mt-1 text-[14px] text-fg-muted">
            Puede que se haya eliminado desde este mismo teléfono.
          </p>
          <Link href="/" className="mt-3 inline-block">
            <Boton variante="secundario">Volver a la lista</Boton>
          </Link>
        </Tarjeta>
      </main>
    );
  }

  if (!proveedor) return <p className="p-5 text-[14px] text-fg-subtle">Abriendo…</p>;

  const analisis = analizar(proveedor);
  const avance = completitud(proveedor);
  const decision = DECISIONES.find((d) => d.valor === proveedor.decision);
  const tel = proveedor.whatsapp || proveedor.telefono;
  const hayProducto =
    proveedor.tiposProducto.length +
      proveedor.concentraciones.length +
      proveedor.familias.length >
    0;

  return (
    <main className="p-4 pb-28">
      <header className="mb-3 flex items-center gap-2">
        <Link href="/">
          <Boton variante="secundario" className="px-3" aria-label="Volver">
            <ArrowLeft size={20} />
          </Boton>
        </Link>
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">
          {proveedor.nombre || "Proveedor sin nombre"}
        </p>
      </header>

      <div className="grid gap-3">
        <Encabezado
          analisis={analisis}
          proveedor={proveedor}
          avance={avance}
          decision={decision}
        />

        <Veredicto analisis={analisis} />

        {analisis.riesgos.length > 0 && (
          <div className="rounded-[var(--radius)] border border-danger bg-surface p-4">
            <p className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-danger">
              <TriangleAlert size={16} />
              Riesgos detectados
            </p>
            <ul className="grid gap-1.5 text-[14px] text-fg-muted">
              {analisis.riesgos.map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
          </div>
        )}

        {proveedor.banderas.length > 0 && (
          <Tarjeta titulo="Banderas rojas marcadas">
            <ul className="grid gap-1 text-[14px] text-fg-muted">
              {proveedor.banderas.map((b) => (
                <li key={b}>· {BANDERAS.find((x) => x.valor === b)?.etiqueta ?? b}</li>
              ))}
            </ul>
          </Tarjeta>
        )}

        <Pendientes analisis={analisis} proveedor={proveedor} />

        <Tarjeta titulo="Contacto">
          <Datos
            filas={[
              [
                "Tipo",
                TIPOS_PROVEEDOR.find((t) => t.valor === proveedor.tipo)?.etiqueta ?? null,
              ],
              ["Teléfono", proveedor.telefono],
              ["WhatsApp", proveedor.whatsapp],
              ["Contacto", proveedor.contactoNombre],
              ["Cargo", proveedor.contactoCargo],
              ["Correo", proveedor.email],
              ["Redes", proveedor.redes],
              ["Horario", textoHorario(proveedor.horario)],
              ["Razón social", proveedor.razonSocial],
            ]}
          />
          {tel && (
            <a
              href={enlaceWhatsapp(proveedor.lada, tel, proveedor.contactoNombre)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-11 items-center gap-2 text-[14px] font-medium text-info"
            >
              <MessageCircle size={16} />
              Escribir por WhatsApp
            </a>
          )}
        </Tarjeta>

        <Tarjeta titulo="Ubicación">
          {proveedor.lat !== null && proveedor.lng !== null ? (
            <div className="grid gap-2">
              <MapaPunto lat={proveedor.lat} lng={proveedor.lng} soloLectura />
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="tabular-nums text-fg-muted">
                  {proveedor.lat.toFixed(5)}, {proveedor.lng.toFixed(5)}
                  <span className="text-fg-subtle">
                    {proveedor.origenUbicacion === "manual"
                      ? " · puesto a mano"
                      : proveedor.precisionGps !== null
                        ? ` · GPS ±${proveedor.precisionGps} m`
                        : ""}
                  </span>
                </span>
                <a
                  href={enlaceMapa(proveedor.lat, proveedor.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 shrink-0 items-center gap-1 font-medium text-info"
                >
                  Abrir <ExternalLink size={14} />
                </a>
              </div>
              <Datos
                sinAviso
                filas={[
                  ["Dirección", proveedor.direccion],
                  ["Ciudad", proveedor.ciudad],
                  ["País", proveedor.pais],
                ]}
              />
            </div>
          ) : (
            <p className="text-[14px] text-fg-subtle">
              Sin punto en el mapa. Edita la ficha para agregarlo.
            </p>
          )}
        </Tarjeta>

        {(hayProducto || proveedor.origenEsencia) && (
          <Tarjeta titulo="Producto">
            <div className="grid gap-2 text-[14px]">
              <Lista
                titulo="Tipo"
                valores={proveedor.tiposProducto.map(
                  (t) => TIPOS_PRODUCTO.find((x) => x.valor === t)?.etiqueta ?? t,
                )}
              />
              <Lista
                titulo="Concentración"
                valores={proveedor.concentraciones.map(
                  (c) => CONCENTRACIONES.find((x) => x.valor === c)?.etiqueta ?? c,
                )}
              />
              <Lista titulo="Familias" valores={proveedor.familias} />
              <Lista
                titulo="Esencia"
                valores={proveedor.origenEsencia ? [proveedor.origenEsencia] : []}
              />
            </div>
          </Tarjeta>
        )}

        <Tarjeta titulo={`Precios (${proveedor.moneda})`}>
          {proveedor.precios.filter((p) => p.precio !== null).length === 0 ? (
            <p className="text-[14px] text-fg-subtle">Sin precios capturados.</p>
          ) : (
            <div className="grid gap-1.5 text-[14px]">
              {PRESENTACIONES.map((pres) => {
                const fila = proveedor.precios.find(
                  (x) => x.presentacion === pres.valor && x.precio !== null,
                );
                if (!fila) return null;
                const porMl = costoPorMl(fila);
                return (
                  <div key={pres.valor} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-fg-muted">{pres.etiqueta}</span>
                    <span className="font-semibold tabular-nums">{fila.precio}</span>
                    {fila.moq !== null && (
                      <span className="text-[13px] text-fg-subtle">MOQ {fila.moq}</span>
                    )}
                    <span className="ml-auto text-[13px] tabular-nums text-fg-subtle">
                      {porMl !== null && `${porMl.toFixed(3)} /ml`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Tarjeta>

        <Promos proveedor={proveedor} />

        {fotos.length > 0 && (
          <Tarjeta titulo={`Fotos (${fotos.length})`}>
            <div className="grid gap-3">
              {TIPOS_FOTO.map((t) => {
                const grupo = fotos.filter((f) => f.tipo === t.valor);
                if (grupo.length === 0) return null;
                return (
                  <div key={t.valor}>
                    <p className="mb-1.5 text-[13px] font-medium text-fg-muted">
                      {t.etiqueta}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {grupo.map((f) => (
                        <Miniatura key={f.id} foto={f} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Tarjeta>
        )}

        {proveedor.notas.trim() !== "" && (
          <Tarjeta titulo="Notas">
            <p className="whitespace-pre-wrap text-[14px] text-fg-muted">
              {proveedor.notas}
            </p>
          </Tarjeta>
        )}

        <Boton variante="peligro" onClick={eliminar} className="w-full">
          <Trash2 size={18} />
          Eliminar ficha
        </Boton>
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-2xl border-t border-border-strong bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link href={`/captura/?id=${proveedor.id}`}>
          <Boton className="w-full">
            <Pencil size={18} />
            Editar ficha
          </Boton>
        </Link>
      </div>
    </main>
  );
}

function Encabezado({
  analisis,
  proveedor,
  avance,
  decision,
}: {
  analisis: Analisis;
  proveedor: Proveedor;
  avance: number;
  decision?: { etiqueta: string; color: string };
}) {
  return (
    <Tarjeta>
      <div className="flex items-center gap-3">
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-[18px] font-bold tabular-nums text-white"
          style={{
            backgroundColor:
              analisis.semaforo === null
                ? "var(--color-fg-subtle)"
                : COLOR_SEMAFORO[analisis.semaforo],
          }}
        >
          {analisis.score ?? "—"}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">
            {analisis.semaforo === null
              ? "Sin evaluar"
              : ETIQUETA_SEMAFORO[analisis.semaforo]}
          </p>
          <p className="text-[13px] text-fg-subtle">
            {proveedor.evaluador} · {fechaCorta(proveedor.creadoEn)}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
          {decision && <Insignia color={decision.color}>{decision.etiqueta}</Insignia>}
          {avance < 100 && (
            <Insignia color="var(--color-warning)">{avance}% completa</Insignia>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-1.5">
        {(Object.keys(CRITERIOS) as Criterio[]).map((clave) => {
          const c = analisis.criterios[clave];
          return (
            <div key={clave} className="flex items-center gap-2 text-[12px]">
              <span className="w-24 shrink-0 text-fg-muted">
                {CRITERIOS[clave].nombre}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span
                  className="block h-full rounded-full bg-gold"
                  style={{ width: `${c.valor ?? 0}%` }}
                />
              </span>
              <span className="w-9 shrink-0 text-right tabular-nums text-fg-subtle">
                {c.valor ?? "—"}
              </span>
            </div>
          );
        })}
      </div>

      {/* La barra de cobertura es tan importante como el puntaje: dice cuánto
          pesa la opinión de arriba. */}
      <div className="mt-3 border-t border-border-soft pt-2 text-[12px] text-fg-subtle">
        Información respondida:{" "}
        <strong className="text-fg">{Math.round(analisis.cobertura * 100)}%</strong>
        {analisis.topadoPorBandera && (
          <span className="text-danger">
            {" "}
            · el puntaje está topado en 39 por una bandera crítica
          </span>
        )}
      </div>
    </Tarjeta>
  );
}

function Veredicto({ analisis }: { analisis: Analisis }) {
  return (
    <Tarjeta titulo="Análisis">
      <p className="text-[14px] text-fg-muted">{analisis.veredicto}</p>

      {analisis.fortalezas.length > 0 && (
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]">
          <ThumbsUp size={14} className="shrink-0 text-success" />
          <strong>Fuerte en:</strong>
          <span className="text-fg-muted">{analisis.fortalezas.join(", ")}</span>
        </p>
      )}
      {analisis.debilidades.length > 0 && (
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]">
          <ThumbsDown size={14} className="shrink-0 text-danger" />
          <strong>Flojo en:</strong>
          <span className="text-fg-muted">{analisis.debilidades.join(", ")}</span>
        </p>
      )}
      {analisis.fortalezas.length === 0 && analisis.debilidades.length === 0 && (
        <p className="mt-2 text-[13px] text-fg-subtle">
          Todavía no hay suficiente información en ningún criterio como para señalar
          fuertes ni flojos.
        </p>
      )}
    </Tarjeta>
  );
}

/**
 * Lo que quedó sin preguntar, con el mensaje listo para mandárselo.
 *
 * Es la diferencia entre una ficha a medias que se queda a medias para siempre y
 * una que se termina esa misma noche desde el hotel.
 */
function Pendientes({
  analisis,
  proveedor,
}: {
  analisis: Analisis;
  proveedor: Proveedor;
}) {
  const [abierto, setAbierto] = useState(false);
  const huecos = huecosDeFicha(proveedor);
  const total = analisis.pendientes.length + huecos.length;
  const tel = proveedor.whatsapp || proveedor.telefono;

  if (total === 0) {
    return (
      <Tarjeta>
        <p className="text-[14px] text-success">
          No quedan preguntas pendientes. La ficha está completa.
        </p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta
      titulo={`Faltan ${total} preguntas`}
      pista="Nadie las hizo en la visita. Se pueden mandar por mensaje sin volver al local."
    >
      <ul className="grid gap-1 text-[14px] text-fg-muted">
        {[...analisis.pendientes.map((p) => p.texto), ...huecos]
          .slice(0, abierto ? undefined : 4)
          .map((texto) => (
            <li key={texto}>· {texto}</li>
          ))}
      </ul>

      {total > 4 && (
        <button
          type="button"
          onClick={() => setAbierto(!abierto)}
          className="mt-2 min-h-11 text-[13px] font-medium text-info"
        >
          {abierto ? "Ver menos" : `Ver las ${total}`}
        </button>
      )}

      {tel && (
        <a
          href={enlaceWhatsappTexto(proveedor.lada, tel, mensajeSeguimiento(proveedor))}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block"
        >
          <Boton className="w-full">
            <Send size={18} />
            Mandarle las preguntas
          </Boton>
        </a>
      )}
    </Tarjeta>
  );
}


/**
 * La escalera de volumen traducida a lo único que importa al decidir: cuánto
 * queda por pieza. Un 15% sobre 50 piezas no dice nada por sí solo; "sale a
 * 38.25 por pieza" sí.
 */
function Promos({ proveedor }: { proveedor: Proveedor }) {
  const referencia = precioReferencia(proveedor);
  if (proveedor.promociones.length === 0) return null;

  const escalones = referencia?.precio
    ? escalera(referencia.precio, proveedor.promociones)
    : [];

  return (
    <Tarjeta
      titulo="Promociones por volumen"
      pista={
        referencia?.precio
          ? `Precio efectivo sobre ${referencia.presentacion.replace("ml", " ml")}.`
          : "Sin precio de lista capturado, no se puede calcular el efectivo."
      }
    >
      <div className="grid gap-2 text-[14px]">
        {proveedor.promociones.map((promo) => {
          const escalon = escalones.find((e) => e.promocion.id === promo.id);
          const tipo = TIPOS_PROMOCION.find((t) => t.valor === promo.tipo);
          const unidad = UNIDADES_PROMOCION.find((u) => u.valor === promo.unidad);
          return (
            <div key={promo.id} className="border-t border-border-soft pt-2 first:border-0 first:pt-0">
              <p className="font-medium">
                {promo.desde !== null
                  ? `Desde ${promo.desde} ${unidad?.etiqueta ?? ""}`
                  : "Sin mínimo indicado"}
                {" · "}
                <span className="text-fg-muted">
                  {promo.valor !== null ? `${promo.valor} ` : ""}
                  {tipo?.sufijo || tipo?.etiqueta}
                </span>
              </p>
              {escalon?.efectivo != null && (
                <p className="mt-0.5 text-[13px]">
                  Sale a{" "}
                  <strong className="tabular-nums">
                    {escalon.efectivo.toFixed(2)} {proveedor.moneda}
                  </strong>{" "}
                  por pieza
                  {escalon.ahorro != null && escalon.ahorro > 0 && (
                    <span className="text-success"> · ahorras {escalon.ahorro}%</span>
                  )}
                </p>
              )}
              {promo.nota && (
                <p className="mt-0.5 text-[13px] text-fg-subtle">{promo.nota}</p>
              )}
            </div>
          );
        })}
      </div>
    </Tarjeta>
  );
}

/** Solo pinta las filas con contenido: una ficha llena de "—" no se lee. */
function Datos({
  filas,
  sinAviso = false,
}: {
  filas: [string, string | null][];
  /** No pintar nada cuando está vacío, en vez del aviso. */
  sinAviso?: boolean;
}) {
  const conValor = filas.filter(([, v]) => v && v.trim() !== "");
  if (conValor.length === 0) {
    if (sinAviso) return null;
    return <p className="text-[14px] text-fg-subtle">Sin datos capturados.</p>;
  }
  return (
    <dl className="grid gap-1.5 text-[14px]">
      {conValor.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="flex gap-2">
          <dt className="w-28 shrink-0 text-fg-subtle">{etiqueta}</dt>
          <dd className="min-w-0 flex-1 break-words">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function Lista({ titulo, valores }: { titulo: string; valores: string[] }) {
  if (valores.length === 0) return null;
  return (
    <div className="flex gap-2">
      <span className="w-28 shrink-0 text-fg-subtle">{titulo}</span>
      <span className="min-w-0 flex-1">{valores.join(" · ")}</span>
    </div>
  );
}

function Miniatura({ foto }: { foto: Foto }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(foto.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [foto.blob]);

  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block h-24 w-24 overflow-hidden rounded-[var(--radius-md)] border border-border-strong"
    >
      {/* Blob local: `next/image` no aporta nada y en export estático no optimiza. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={foto.tipo} className="h-full w-full object-cover" />
    </a>
  );
}
