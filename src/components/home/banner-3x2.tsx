"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Contenedor } from "@/components/comunes/layout";
import { FIN_PROMO_3X2 } from "@/data/contenido";

function restante(fin: number) {
  const ms = fin - Date.now();
  if (ms <= 0) return null;
  return {
    dias: Math.floor(ms / 86_400_000),
    horas: Math.floor((ms / 3_600_000) % 24),
    minutos: Math.floor((ms / 60_000) % 60),
    segundos: Math.floor((ms / 1000) % 60),
  };
}

/**
 * Banner 3x2 (§8.5) con cuenta regresiva real.
 *
 * La fecha de fin es fija (`FIN_PROMO_3X2`), no un "faltan 72h" que se reinicia
 * en cada carga: el §1.2.2 pide urgencia honesta. Si la fecha ya pasó, el banner
 * se muestra sin contador en lugar de inventar uno nuevo.
 */
export function Banner3x2() {
  const fin = new Date(FIN_PROMO_3X2).getTime();
  const [tiempo, setTiempo] = useState<ReturnType<typeof restante>>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    setTiempo(restante(fin));
    const id = setInterval(() => setTiempo(restante(fin)), 1000);
    return () => clearInterval(id);
  }, [fin]);

  return (
    <section className="relative isolate overflow-hidden border-y border-[#C9A227]/25 bg-black">
      {/* Destello dorado, sin neón ni degradado morado (§1.3) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(201,162,39,0.22), transparent 70%)",
        }}
      />

      <Contenedor>
        <div className="flex flex-col items-center gap-6 py-12 text-center lg:flex-row lg:justify-between lg:gap-10 lg:py-14 lg:text-left">
          <div className="max-w-xl">
            <p className="eyebrow mb-2">Promoción por tiempo limitado</p>
            <h2 className="font-display text-[clamp(2rem,8vw,2.75rem)] leading-[1.02] tracking-tight lg:text-[3.25rem]">
              <span className="text-gold-gradient">3x2</span> en toda la tienda
            </h2>
            <p className="text-fg-muted mt-3 text-[15px] leading-relaxed">
              Llévate 3, paga 2. El de menor precio va por nuestra cuenta.
            </p>
          </div>

          <div className="flex flex-col items-center gap-5 lg:items-end">
            {montado && tiempo ? (
              <div>
                <p className="text-fg-subtle mb-2 text-center text-[11px] tracking-[0.16em] uppercase lg:text-right">
                  Termina en
                </p>
                <div className="flex gap-2" role="timer" aria-live="off">
                  <Casilla valor={tiempo.dias} etiqueta="días" />
                  <Casilla valor={tiempo.horas} etiqueta="hrs" />
                  <Casilla valor={tiempo.minutos} etiqueta="min" />
                  <Casilla valor={tiempo.segundos} etiqueta="seg" />
                </div>
              </div>
            ) : (
              // Reserva el mismo alto para que no haya salto de layout.
              <div aria-hidden className="h-[74px]" />
            )}

            <Button asChild variant="gold" size="touch-lg">
              <Link href="/promociones">Ver productos en 3x2</Link>
            </Button>
          </div>
        </div>
      </Contenedor>
    </section>
  );
}

function Casilla({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div className="border-border-strong bg-surface min-w-14 rounded-md border px-2.5 py-2 text-center">
      <span data-precio className="block text-xl leading-none font-medium">
        {String(valor).padStart(2, "0")}
      </span>
      <span className="text-fg-subtle mt-1 block text-[10px] tracking-wide uppercase">
        {etiqueta}
      </span>
    </div>
  );
}
