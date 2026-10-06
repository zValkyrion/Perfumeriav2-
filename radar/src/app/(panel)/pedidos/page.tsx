import { Suspense } from "react";
import { VistaPedidos } from "@/components/pedidos/vista-pedidos";

// `useSearchParams` (el filtro `?estatus=` que manda el tablero) obliga a un
// límite de Suspense; sin él la exportación estática falla al construir.
export default function Pagina() {
  return (
    <Suspense fallback={<p className="p-5 text-[14px] text-fg-subtle">Abriendo…</p>}>
      <VistaPedidos />
    </Suspense>
  );
}
