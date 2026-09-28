import { Suspense } from "react";
import { VistaCliente } from "@/components/clientes/vista-cliente";

// `useSearchParams` obliga a un límite de Suspense; sin él la exportación
// estática falla al construir. La clave va en `?clave=` y no en la ruta porque
// los clientes nacen después de compilar (no hay rutas dinámicas en `export`).
export default function Pagina() {
  return (
    <Suspense fallback={<p className="p-5 text-[14px] text-fg-subtle">Abriendo…</p>}>
      <VistaCliente />
    </Suspense>
  );
}
