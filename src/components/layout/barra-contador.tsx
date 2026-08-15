"use client";

import { useSyncExternalStore } from "react";

/**
 * Barra de urgencia con cuenta atrás.
 *
 * El contador va **hasta la medianoche de hoy**, no a un "faltan 3 horas" que
 * se reinicia en cada carga: el plazo es real y comprobable —la promoción del
 * día termina cuando termina el día—, que es lo que pide el §1.2.2 sobre
 * urgencia honesta.
 *
 * El reloj es un store externo que emite una vez por segundo; en el servidor el
 * snapshot es `null`, así que se reserva el hueco y no hay desajuste de
 * hidratación ni un efecto que llame a setState.
 */
function suscribir(alCambiar: () => void) {
  const id = setInterval(alCambiar, 1000);
  return () => clearInterval(id);
}

const ahoraCliente = () => Math.floor(Date.now() / 1000);
const ahoraServidor = () => null;

function restante(ahora: number) {
  const fin = new Date();
  fin.setHours(23, 59, 59, 999);
  const s = Math.max(0, Math.floor(fin.getTime() / 1000) - ahora);
  return {
    horas: Math.floor(s / 3600),
    minutos: Math.floor((s / 60) % 60),
    segundos: Math.floor(s % 60),
  };
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

export function BarraContador() {
  const ahora = useSyncExternalStore(suscribir, ahoraCliente, ahoraServidor);
  const t = ahora === null ? null : restante(ahora);

  return (
    <div className="relative z-50 bg-[#e02b20] text-white">
      <div className="mx-auto flex h-11 max-w-[1400px] items-center justify-center gap-3 px-4 text-center">
        <p className="text-[13px] font-bold sm:text-sm">
          <span aria-hidden>⏰</span> 3x2 + Envío Gratis
        </p>

        {t ? (
          <div className="flex items-end gap-1.5" role="timer">
            <Casilla valor={dosDigitos(t.horas)} etiqueta="Hrs" />
            <span aria-hidden className="pb-2.5 text-base font-bold leading-none">
              :
            </span>
            <Casilla valor={dosDigitos(t.minutos)} etiqueta="Min" />
            <span aria-hidden className="pb-2.5 text-base font-bold leading-none">
              :
            </span>
            <Casilla valor={dosDigitos(t.segundos)} etiqueta="Seg" />
            <span className="sr-only">
              La promoción termina en {t.horas} horas y {t.minutos} minutos.
            </span>
          </div>
        ) : (
          // Hueco del mismo alto: evita que la barra salte al hidratar.
          <div aria-hidden className="h-8 w-28" />
        )}
      </div>
    </div>
  );
}

function Casilla({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <span className="flex flex-col items-center leading-none">
      <span data-precio className="text-base font-extrabold sm:text-lg">
        {valor}
      </span>
      <span className="mt-0.5 text-[9px] tracking-wide opacity-80">
        {etiqueta}
      </span>
    </span>
  );
}
