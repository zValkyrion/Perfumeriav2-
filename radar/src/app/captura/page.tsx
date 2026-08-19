import { Suspense } from "react";
import { VistaCaptura } from "@/components/captura/vista-captura";

// `useSearchParams` obliga a un límite de Suspense; sin él la exportación
// estática falla al construir.
export default function Pagina() {
  return (
    <Suspense fallback={<p className="p-5 text-[14px] text-fg-subtle">Abriendo…</p>}>
      <VistaCaptura />
    </Suspense>
  );
}
