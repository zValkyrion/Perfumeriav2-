"use client";

import {
  BANDERAS,
  CONCENTRACIONES,
  DECISIONES,
  FAMILIAS,
  MONEDAS,
  ORIGENES_ESENCIA,
  PRESENTACIONES,
  TIPOS_PRODUCTO,
} from "@/data/catalogo";
import { PREGUNTAS } from "@/data/preguntas";
import { Promociones } from "@/components/captura/promociones";
import {
  AreaTexto,
  Chips,
  Deslizador,
  SelectorAbierto,
  Tarjeta,
  Ternario,
} from "@/components/ui";
import {
  COLOR_SEMAFORO,
  CRITERIOS,
  ETIQUETA_SEMAFORO,
  type Criterio,
  analizar,
  costoPorMl,
} from "@/lib/analisis";
import type {
  Bandera,
  Concentracion,
  Decision,
  Ejes,
  Presentacion,
  Proveedor,
  TipoProducto,
} from "@/lib/tipos";

export function PasoEvaluacion({
  proveedor,
  actualizar,
}: {
  proveedor: Proveedor;
  actualizar: (cambios: Partial<Proveedor>) => void;
}) {
  const ejes = proveedor.ejes;
  const setEje = <K extends keyof Ejes>(clave: K, valor: Ejes[K]) =>
    actualizar({ ejes: { ...ejes, [clave]: valor } });

  const alternar = <T,>(lista: T[], valor: T): T[] =>
    lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];

  const analisis = analizar(proveedor);

  /** Deslizador atado a un eje; el rótulo sale del guion de preguntas. */
  const Slider = <K extends keyof Ejes>({
    clave,
    ...resto
  }: {
    clave: K;
    min?: number;
    max?: number;
    paso?: number;
    sufijo?: string;
    porDefecto?: number;
    leyendas?: [string, string];
  }) => (
    <Deslizador
      etiqueta={PREGUNTAS[clave].etiqueta}
      valor={ejes[clave] as number | null}
      onChange={(v) => setEje(clave, v as Ejes[K])}
      {...resto}
    />
  );

  const Tri = <K extends keyof Ejes>({ clave }: { clave: K }) => (
    <Ternario
      etiqueta={PREGUNTAS[clave].etiqueta}
      valor={ejes[clave] as boolean | null}
      onChange={(v) => setEje(clave, v as Ejes[K])}
    />
  );

  return (
    <div className="grid gap-3">
      <Resumen analisis={analisis} />

      <Tarjeta titulo="Qué maneja">
        <div className="grid gap-4">
          <Chips<TipoProducto>
            etiqueta="Tipo de producto"
            opciones={TIPOS_PRODUCTO}
            valor={proveedor.tiposProducto}
            onChange={(v) =>
              actualizar({ tiposProducto: alternar(proveedor.tiposProducto, v) })
            }
          />
          <Chips<Concentracion>
            etiqueta="Concentración"
            opciones={CONCENTRACIONES}
            valor={proveedor.concentraciones}
            onChange={(v) =>
              actualizar({ concentraciones: alternar(proveedor.concentraciones, v) })
            }
          />
          <Chips
            etiqueta="Familias olfativas"
            opciones={FAMILIAS.map((f) => ({ valor: f, etiqueta: f }))}
            valor={proveedor.familias}
            onChange={(v) => actualizar({ familias: alternar(proveedor.familias, v) })}
          />
          <SelectorAbierto
            etiqueta="Origen de la esencia"
            opciones={ORIGENES_ESENCIA}
            valor={proveedor.origenEsencia}
            onChange={(v) => actualizar({ origenEsencia: v })}
            placeholder="¿De dónde viene la esencia?"
            pista="En inspirados es el mejor indicador de calidad que se puede preguntar."
          />
        </div>
      </Tarjeta>

      <Precios proveedor={proveedor} actualizar={actualizar} />

      <Promociones proveedor={proveedor} actualizar={actualizar} />

      <Tarjeta titulo="Calidad del producto" pista="Lo que decide si el cliente repite.">
        <div className="grid gap-2">
          <Slider clave="similitud" leyendas={["No se parece", "Idéntico"]} />
          <Slider
            clave="fijacion_horas"
            min={0}
            max={12}
            sufijo=" h"
            porDefecto={6}
            leyendas={["Se va rápido", "Todo el día"]}
          />
          <Slider clave="consistencia_lotes" leyendas={["Cambia mucho", "Siempre igual"]} />
          <Slider clave="porcentaje_esencia" min={0} max={40} sufijo=" %" porDefecto={15} />
          <Slider clave="proyeccion" leyendas={["Pegado a la piel", "Llena el cuarto"]} />
          <Slider clave="envase" leyendas={["Corriente", "Impecable"]} />
          <Slider clave="etiqueta" leyendas={["Improvisada", "Profesional"]} />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Precio">
        <div className="grid gap-3">
          <Slider clave="competitividad_precio" leyendas={["Caro", "El más barato"]} />
          <Tri clave="precio_negociable" />
          <Tri clave="envase_incluido" />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Confianza y formalidad">
        <div className="grid gap-3">
          <Slider clave="anios_operando" min={0} max={30} sufijo=" años" porDefecto={5} />
          <Tri clave="local_fisico" />
          <Tri clave="permisos_sanitarios" />
          <Tri clave="da_factura" />
          <Tri clave="acepta_devoluciones" />
          <Tri clave="entrega_muestras" />
          <Tri clave="tiene_referencias" />
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Versatilidad"
        pista="Qué tanto se le puede pedir más allá de lo que ya vende."
      >
        <div className="grid gap-3">
          <Slider
            clave="aromas_catalogo"
            min={0}
            max={300}
            paso={10}
            sufijo=" aromas"
            porDefecto={50}
          />
          <Tri clave="marca_blanca" />
          <Tri clave="personalizacion" />
          <Tri clave="catalogo_digital" />
          <Tri clave="exporta" />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Capacidad">
        <div className="grid gap-2">
          <Slider clave="stock_inmediato" leyendas={["Bajo pedido", "Se lleva hoy"]} />
          <Slider
            clave="capacidad_mensual"
            min={0}
            max={5000}
            paso={100}
            sufijo=" pzas"
            porDefecto={500}
          />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Condiciones comerciales">
        <div className="grid gap-3">
          <Slider clave="dias_entrega" min={0} max={60} sufijo=" días" porDefecto={7} />
          <Tri clave="acepta_credito" />
          <Tri clave="cubre_flete" />
          <Tri clave="envio_internacional" />
          <Tri clave="exclusividad_zona" />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Trato">
        <div className="grid gap-2">
          <Slider clave="trato" leyendas={["Difícil", "Excelente"]} />
          <Slider
            clave="horas_respuesta"
            min={0}
            max={72}
            sufijo=" h"
            porDefecto={4}
            leyendas={["Contesta al momento", "Tarda días"]}
          />
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Banderas rojas"
        pista="Falsificaciones y precios inconsistentes topan el puntaje en 39 por sí solos."
      >
        <Chips<Bandera>
          etiqueta=""
          opciones={BANDERAS}
          valor={proveedor.banderas}
          onChange={(v) => actualizar({ banderas: alternar(proveedor.banderas, v) })}
        />
      </Tarjeta>

      <Tarjeta titulo="Cierre">
        <div className="grid gap-4">
          <Chips<Decision>
            etiqueta="Decisión"
            opciones={DECISIONES}
            valor={proveedor.decision}
            onChange={(v) =>
              actualizar({ decision: proveedor.decision === v ? null : v })
            }
          />
          <AreaTexto
            etiqueta="Notas"
            placeholder="Lo que no cabe en ningún campo: qué negociaste, qué prometió, qué te dio mala espina."
            value={proveedor.notas}
            onChange={(e) => actualizar({ notas: e.target.value })}
          />
        </div>
      </Tarjeta>
    </div>
  );
}

function Resumen({ analisis }: { analisis: ReturnType<typeof analizar> }) {
  const { score, cobertura, criterios, pendientes } = analisis;

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
          {score ?? "—"}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">
            {analisis.semaforo === null
              ? "Sin evaluar"
              : ETIQUETA_SEMAFORO[analisis.semaforo]}
          </p>
          <p className="text-[13px] text-fg-subtle">
            {Math.round(cobertura * 100)}% de la ficha respondida
            {pendientes.length > 0 && ` · faltan ${pendientes.length} preguntas`}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-1.5">
        {(Object.keys(CRITERIOS) as Criterio[]).map((clave) => {
          const c = criterios[clave];
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
      <p className="mt-2 text-[12px] text-fg-subtle">
        Solo se puntúa lo que se preguntó. Lo que quede en «—» no cuenta ni a favor ni
        en contra.
      </p>
    </Tarjeta>
  );
}

function Precios({
  proveedor,
  actualizar,
}: {
  proveedor: Proveedor;
  actualizar: (cambios: Partial<Proveedor>) => void;
}) {
  const valorDe = (p: Presentacion) =>
    proveedor.precios.find((x) => x.presentacion === p);

  const fijar = (presentacion: Presentacion, campo: "precio" | "moq", bruto: string) => {
    const valor = bruto === "" ? null : Number(bruto);
    const resto = proveedor.precios.filter((x) => x.presentacion !== presentacion);
    const actual = valorDe(presentacion) ?? { presentacion, precio: null, moq: null };
    actualizar({ precios: [...resto, { ...actual, [campo]: valor }] });
  };

  return (
    <Tarjeta
      titulo="Precios"
      pista="El costo por ml es lo único comparable entre proveedores que venden en presentaciones distintas."
    >
      <div className="mb-3">
        <Chips
          etiqueta="Moneda"
          opciones={MONEDAS.map((m) => ({ valor: m, etiqueta: m }))}
          valor={proveedor.moneda}
          onChange={(v) => actualizar({ moneda: v })}
        />
      </div>
      <div className="grid gap-2">
        {PRESENTACIONES.map((pres) => {
          const fila = valorDe(pres.valor);
          const porMl = fila ? costoPorMl(fila) : null;
          return (
            <div key={pres.valor} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-[13px] font-medium">
                {pres.etiqueta}
              </span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="Precio"
                aria-label={`Precio ${pres.etiqueta}`}
                value={fila?.precio ?? ""}
                onChange={(e) => fijar(pres.valor, "precio", e.target.value)}
                className="h-12 w-24 rounded-[var(--radius-md)] border border-border-strong bg-surface px-2 text-right tabular-nums"
              />
              <input
                type="number"
                inputMode="numeric"
                placeholder="MOQ"
                aria-label={`Mínimo de compra ${pres.etiqueta}`}
                value={fila?.moq ?? ""}
                onChange={(e) => fijar(pres.valor, "moq", e.target.value)}
                className="h-12 w-20 rounded-[var(--radius-md)] border border-border-strong bg-surface px-2 text-right tabular-nums"
              />
              <span className="flex-1 text-right text-[12px] tabular-nums text-fg-subtle">
                {porMl !== null && `${porMl.toFixed(3)} /ml`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-fg-subtle">
        ¿Trae lista de precios impresa? Fotografíala en el paso de{" "}
        <strong>Fotos</strong> en vez de teclearla.
      </p>
    </Tarjeta>
  );
}
