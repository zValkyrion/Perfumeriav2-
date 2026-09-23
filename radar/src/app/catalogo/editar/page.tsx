import { Suspense } from "react";
import { VistaEditar } from "@/components/catalogo/vista-editar";

// `useSearchParams` obliga a un límite de Suspense; sin él la exportación
// estática falla al construir.
export default function Pagina() {
  return (
    <Suspense fallback={<p className="p-5 text-[14px] text-fg-subtle">Abriendo…</p>}>
      <VistaEditar />
    </Suspense>
  );
}
