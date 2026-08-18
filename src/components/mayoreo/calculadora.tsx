"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { NumeroAnimado } from "@/components/comunes/numero-animado";
import { Precio } from "@/components/comunes/precio";
import { precioRedondo } from "@/lib/format";
import {
  ESCALON_INICIAL,
  ESCALONES,
  escalonPara,
  pct,
  precioUnitario,
} from "@/lib/volumen";
import { cn } from "@/lib/utils";

/**
 * Calculadora de mayoreo (§11): la pieza estrella de la página.
 *
 * Trabaja sobre un ticket promedio real del catálogo, no sobre un número
 * inventado, y muestra los cuatro datos que decide un revendedor: cuánto
 * invierte, a cómo le sale la pieza, a cómo la vende y cuánto gana.
 */
export function Calculadora({ ticketPromedio }: { ticketPromedio: number }) {
  const [piezas, setPiezas] = useState(12);

  const escalon = escalonPara(piezas);
  const unitario = precioUnitario(ticketPromedio, piezas);
  const inversion = unitario * piezas;
  const ventaSugerida = ticketPromedio * piezas;
  const utilidad = ventaSugerida - inversion;
  const margen = ventaSugerida > 0 ? utilidad / ventaSugerida : 0;

  return (
    <div className="border-border-soft bg-surface rounded-lg border p-5 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1.5">Calculadora</p>
          <h3 className="font-display text-2xl leading-tight">
            ¿Cuánto ganas con tu pedido?
          </h3>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium",
            escalon.descuento > 0
              ? "bg-gold-gradient text-bg"
              : "border-border-strong text-fg-muted border",
          )}
        >
          {escalon.etiqueta}
        </span>
      </div>

      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor="piezas" className="text-sm font-medium">
          Piezas en tu pedido
        </label>
        <span data-precio className="font-display text-gold-light text-3xl">
          {piezas}
        </span>
      </div>

      <Slider
        id="piezas"
        value={[piezas]}
        min={1}
        max={100}
        step={1}
        onValueChange={(v) => setPiezas(v[0]!)}
        aria-label="Número de piezas"
        aria-valuetext={`${piezas} piezas`}
      />

      <div className="text-fg-subtle mt-2 flex justify-between text-[11px]">
        <span>1</span>
        <span>25</span>
        <span>50</span>
        <span>100</span>
      </div>

      {/* Atajos a cada escalón */}
      <div className="mt-4 flex flex-wrap gap-2">
        {ESCALONES.map((e) => (
          <button
            key={e.nombre}
            type="button"
            onClick={() => setPiezas(e.min)}
            aria-pressed={escalon.nombre === e.nombre}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              escalon.nombre === e.nombre
                ? "border-gold text-gold-light"
                : "border-border-strong text-fg-muted hover:text-fg",
            )}
          >
            {e.max === null ? `${e.min}+` : `${e.min}–${e.max}`} pzas
          </button>
        ))}
      </div>

      <dl className="border-border-soft mt-7 grid gap-4 border-t pt-6 sm:grid-cols-2">
        <Dato
          etiqueta="Te sale a"
          valor={<NumeroAnimado valor={unitario} />}
          nota="por pieza"
        />
        <Dato
          etiqueta="Inviertes"
          valor={<NumeroAnimado valor={inversion} />}
          nota={`${piezas} ${piezas === 1 ? "pieza" : "piezas"}`}
        />
        <Dato
          etiqueta="Precio sugerido de venta"
          valor={<Precio valor={ticketPromedio} />}
          nota="por pieza, el que publicamos aquí"
        />
        <Dato
          etiqueta="Ganas"
          valor={<NumeroAnimado valor={utilidad} />}
          nota={`margen del ${Math.round(margen * 100)}%`}
          destacado
        />
      </dl>

      {escalon.descuento === 0 ? (
        <p className="border-border-soft text-fg-muted mt-5 rounded-md border px-3.5 py-3 text-[13px]">
          Con solo{" "}
          <strong className="text-gold-light">
            {ESCALON_INICIAL.min} piezas
          </strong>{" "}
          bajas {pct(ESCALON_INICIAL.descuento)}% y el envío te sale gratis.
        </p>
      ) : (
        <p className="border-gold/30 bg-gold-muted mt-5 rounded-md border px-3.5 py-3 text-[13px]">
          Con {piezas} piezas ganas hasta{" "}
          <strong className="text-gold-light">
            {precioRedondo(utilidad)} MXN
          </strong>{" "}
          y el envío corre por nuestra cuenta.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="gold" size="touch" className="flex-1">
          <Link href="/lotes">Ver lotes armados</Link>
        </Button>
        <Button asChild variant="goldOutline" size="touch" className="flex-1">
          <Link href="/catalogo">Armar mi surtido</Link>
        </Button>
      </div>

      <p className="text-fg-subtle mt-3 text-[11px] leading-relaxed">
        Cálculo sobre un ticket promedio de{" "}
        <Precio valor={ticketPromedio} /> MXN por pieza, que es el precio medio
        real de los más vendidos del catálogo. Tu margen cambia según los
        modelos que elijas.
      </p>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  nota,
  destacado,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  nota: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md px-3.5 py-3",
        destacado ? "bg-success/10" : "bg-bg",
      )}
    >
      <dt className="text-fg-subtle text-[11px] tracking-[0.12em] uppercase">
        {etiqueta}
      </dt>
      <dd
        className={cn(
          "mt-1 text-xl font-medium",
          destacado && "text-success",
        )}
      >
        {valor}
      </dd>
      <p className="text-fg-subtle mt-0.5 text-[11px]">{nota}</p>
    </div>
  );
}
