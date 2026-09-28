"use client";

import { Suspense } from "react";
import { VistaRastreo } from "@/components/cuenta/vista-rastreo";

// `useSearchParams` (el `?folio=` que llega desde la confirmación) obliga a un
// límite de Suspense; sin él la exportación estática falla al construir. Nada
// de `loading.tsx`: con `output: export` deja páginas en blanco.
export default function Pagina() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="mx-auto h-64 max-w-md animate-pulse rounded-lg bg-white/5" />
        </div>
      }
    >
      <VistaRastreo />
    </Suspense>
  );
}
