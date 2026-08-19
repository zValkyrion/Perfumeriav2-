"use client";

import { Plus, Trash2 } from "lucide-react";
import { TIPOS_PROMOCION, UNIDADES_PROMOCION } from "@/data/catalogo";
import { Boton, Campo, Selector, Tarjeta } from "@/components/ui";
import { escalera, precioReferencia } from "@/lib/analisis";
import type { Promocion, Proveedor, TipoPromocion, UnidadPromocion } from "@/lib/tipos";

/**
 * La escalera de volumen.
 *
 * Es el dato que más veces cambia la decisión y el que peor se captura: si vive
 * en las notas ("me dijo que en 50 piezas hace 3x2"), no se puede calcular nada
 * con él. Estructurado, la app baja cada promoción a **precio por pieza** y ahí
 * se ve lo que de verdad importa: un proveedor con el frasco a 45 y 3x2 sale a
 * 30, más barato que otro que lo da a 38 sin promoción.
 */
export function Promociones({
  proveedor,
  actualizar,
}: {
  proveedor: Proveedor;
  actualizar: (cambios: Partial<Proveedor>) => void;
}) {
  const referencia = precioReferencia(proveedor);
  const base = referencia?.precio ?? null;
  const escalones = base ? escalera(base, proveedor.promociones) : [];

  const agregar = () =>
    actualizar({
      promociones: [
        ...proveedor.promociones,
        {
          id: crypto.randomUUID(),
          desde: null,
          unidad: "piezas",
          tipo: "descuento",
          valor: null,
          nota: "",
        },
      ],
    });

  const cambiar = (id: string, cambios: Partial<Promocion>) =>
    actualizar({
      promociones: proveedor.promociones.map((p) =>
        p.id === id ? { ...p, ...cambios } : p,
      ),
    });

  const quitar = (id: string) =>
    actualizar({ promociones: proveedor.promociones.filter((p) => p.id !== id) });

  return (
    <Tarjeta
      titulo="Promociones por volumen"
      pista="Qué te dan si compras más. Es lo que decide si conviene o no."
    >
      {proveedor.promociones.length === 0 && (
        <p className="mb-3 text-[14px] text-fg-subtle">
          Sin promociones capturadas. Pregunta: «¿qué me da si le compro más?».
        </p>
      )}

      <div className="grid gap-3">
        {proveedor.promociones.map((promo) => {
          const escalon = escalones.find((e) => e.promocion.id === promo.id);
          const sufijo = TIPOS_PROMOCION.find((t) => t.valor === promo.tipo)?.sufijo ?? "";
          const pideValor = promo.tipo !== "envio_gratis" && promo.tipo !== "otro";

          return (
            <div
              key={promo.id}
              className="rounded-[var(--radius-md)] border border-border-strong p-3"
            >
              <div className="grid grid-cols-[1fr_7rem] gap-2">
                <Campo
                  etiqueta="A partir de"
                  type="number"
                  inputMode="numeric"
                  placeholder="50"
                  value={promo.desde ?? ""}
                  onChange={(e) =>
                    cambiar(promo.id, {
                      desde: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
                <Selector
                  etiqueta="Unidad"
                  opciones={UNIDADES_PROMOCION.map((u) => ({
                    valor: u.valor,
                    etiqueta: u.etiqueta,
                  }))}
                  valor={promo.unidad}
                  onChange={(v) =>
                    cambiar(promo.id, { unidad: (v ?? "piezas") as UnidadPromocion })
                  }
                  vacio="piezas"
                />
              </div>

              <div className="mt-2 grid grid-cols-[1fr_7rem] gap-2">
                <Selector
                  etiqueta="Qué dan"
                  opciones={TIPOS_PROMOCION.map((t) => ({
                    valor: t.valor,
                    etiqueta: t.etiqueta,
                  }))}
                  valor={promo.tipo}
                  onChange={(v) =>
                    cambiar(promo.id, { tipo: (v ?? "descuento") as TipoPromocion })
                  }
                  vacio="Descuento"
                />
                {pideValor && (
                  <Campo
                    etiqueta={sufijo || "Valor"}
                    type="number"
                    inputMode="decimal"
                    placeholder="15"
                    value={promo.valor ?? ""}
                    onChange={(e) =>
                      cambiar(promo.id, {
                        valor: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                )}
              </div>

              <div className="mt-2">
                <Campo
                  etiqueta="Nota"
                  placeholder="Solo en aromas seleccionados, hasta fin de mes…"
                  value={promo.nota}
                  onChange={(e) => cambiar(promo.id, { nota: e.target.value })}
                />
              </div>

              {/* El número que decide: qué queda por pieza con esta promoción. */}
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[13px] text-fg-muted">
                  {escalon?.efectivo != null && base != null ? (
                    <>
                      Sale a{" "}
                      <strong className="tabular-nums text-fg">
                        {escalon.efectivo.toFixed(2)} {proveedor.moneda}
                      </strong>{" "}
                      por pieza
                      {escalon.ahorro != null && escalon.ahorro > 0 && (
                        <span className="text-success"> · ahorras {escalon.ahorro}%</span>
                      )}
                    </>
                  ) : base == null ? (
                    <span className="text-fg-subtle">
                      Captura un precio arriba para ver el efectivo
                    </span>
                  ) : (
                    <span className="text-fg-subtle">No cambia el precio por pieza</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => quitar(promo.id)}
                  aria-label="Quitar promoción"
                  className="grid h-11 w-11 shrink-0 place-items-center text-danger"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Boton variante="secundario" onClick={agregar} className="mt-3 w-full">
        <Plus size={18} />
        Agregar promoción
      </Boton>

      {referencia && (
        <p className="mt-2 text-[12px] text-fg-subtle">
          Calculado sobre el precio de {referencia.presentacion.replace("ml", " ml")} (
          {referencia.precio} {proveedor.moneda}).
        </p>
      )}
    </Tarjeta>
  );
}
