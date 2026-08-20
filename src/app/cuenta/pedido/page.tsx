"use client";

import { Suspense } from "react";
import { VistaPedido } from "@/components/cuenta/vista-pedido";

// `useSearchParams` obliga a un límite de Suspense; sin él la exportación
// estática falla al construir.
export default function Pagina() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="h-64 animate-pulse rounded-lg bg-white/5" />
        </div>
      }
    >
      <VistaPedido />
    </Suspense>
  );
}
