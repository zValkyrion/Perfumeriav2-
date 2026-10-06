import { Suspense } from "react";
import { VistaPedido } from "@/components/pedidos/vista-pedido";

// `useSearchParams` obliga a un límite de Suspense; sin él la exportación
// estática falla al construir. El folio va por `?folio=` y no en la ruta: con
// `output: "export"` una ruta dinámica daría 404 con los folios que se crean
// después de compilar.
export default function Pagina() {
  return (
    <Suspense fallback={<p className="p-5 text-[14px] text-fg-subtle">Abriendo…</p>}>
      <VistaPedido />
    </Suspense>
  );
}
