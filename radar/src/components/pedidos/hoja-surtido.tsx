import type { PedidoAdmin } from "@/lib/tienda-admin";
import { fechaHora, pesosCentavos } from "@/components/tienda/comun";
import { envioTexto, metodoTexto, nombrePaqueteria } from "@/components/pedidos/comun";

/**
 * La hoja que se imprime para surtir y empacar un pedido: quién, a dónde, qué
 * lleva (con una casilla por línea para palomear) y cuánto se cobró.
 *
 * En pantalla no se ve (`hidden print:block`); al imprimir es lo único que
 * sale, porque la vista del detalle va con `print:hidden`. Blanco y negro,
 * letra grande y sin botones: se lee en la mesa de empaque, no en el teléfono.
 */
export function HojaSurtido({ pedido: p, evaluador }: { pedido: PedidoAdmin; evaluador: string | null }) {
  const c = p.contacto;
  const direccion = [c.calle, c.colonia, c.cp && `C.P. ${c.cp}`, c.ciudad, c.estado].filter(Boolean).join(", ");
  const piezas = p.lineas.reduce((s, l) => s + l.cantidad, 0);
  return (
    <div className="hidden text-[12pt] leading-snug text-black print:block">
      <style>{"@page { size: letter; margin: 12mm; }"}</style>
      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-2">
        <div>
          <p className="text-[10pt] font-semibold uppercase tracking-[0.14em]">El Rey de los Perfumes · Hoja de surtido</p>
          <h1 className="text-[22pt] font-bold tracking-tight">{p.folio}</h1>
        </div>
        <div className="text-right text-[10pt]">
          <p>Pedido: {fechaHora(p.creadoEn)}</p>
          <p>Estatus: {p.estatus}</p>
          <p>Impreso: {fechaHora(new Date().toISOString())}</p>
        </div>
      </header>

      <section className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-[10pt] font-semibold uppercase tracking-[0.1em]">Enviar a</h2>
          <p className="text-[14pt] font-semibold">{c.nombre || "Sin nombre"}</p>
          <p>Tel. {c.telefono || "—"}</p>
          {c.correo && <p>{c.correo}</p>}
          <p className="mt-1">{direccion || "Sin dirección"}</p>
          {c.referencias && <p className="mt-1 italic">Referencias: {c.referencias}</p>}
        </div>
        <div>
          <h2 className="text-[10pt] font-semibold uppercase tracking-[0.1em]">Envío y pago</h2>
          <p>Envío: {envioTexto(p.envio)}</p>
          <p>Pago: {metodoTexto(p.metodo, p.plazo)}</p>
          <p>Paquetería: {nombrePaqueteria(p.paqueteria) ?? "—"}</p>
          <p>Guía: {p.guia ?? "—"}</p>
          <p className="mt-1 text-[14pt] font-semibold">Total: {pesosCentavos(p.cifras.total)}</p>
        </div>
      </section>

      <table className="mt-4 w-full border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-black text-[10pt] uppercase tracking-[0.08em]">
            <th className="w-8 py-1" aria-label="Surtido" />
            <th className="py-1">Artículo</th>
            <th className="py-1">Presentación</th>
            <th className="py-1 text-right">Cant.</th>
          </tr>
        </thead>
        <tbody>
          {p.lineas.map((l, i) => (
            <tr key={`${l.productoId}-${l.ml}-${i}`} className="border-b border-black/40 align-top">
              <td className="py-1.5">
                <span aria-hidden className="inline-block h-4 w-4 border-2 border-black" />
              </td>
              <td className="py-1.5 pr-2">
                <span className="font-semibold">{l.nombre}</span>
                <span className="block text-[9pt]">{l.productoId}</span>
              </td>
              <td className="py-1.5 pr-2">{l.detalle}</td>
              <td className="py-1.5 text-right text-[14pt] font-bold tabular-nums">{l.cantidad}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td className="pt-2 font-semibold" colSpan={2}>
              {p.lineas.length} {p.lineas.length === 1 ? "línea" : "líneas"} · {p.cifras.piezas || piezas} piezas en total
            </td>
            <td className="pt-2 text-right text-[14pt] font-bold tabular-nums">{piezas}</td>
          </tr>
        </tfoot>
      </table>

      {(p.notaCliente || p.notaInterna) && (
        <section className="mt-4 grid gap-2">
          {p.notaInterna && (
            <p className="border border-black p-2">
              <strong>Nota interna:</strong> {p.notaInterna}
            </p>
          )}
          {p.notaCliente && (
            <p className="border border-black/50 p-2">
              <strong>Mensaje al cliente:</strong> {p.notaCliente}
            </p>
          )}
        </section>
      )}

      <footer className="mt-6 grid grid-cols-2 gap-8 text-[10pt]">
        <p className="border-t border-black pt-1">Surtió</p>
        <p className="border-t border-black pt-1">Revisó{evaluador ? ` (imprimió: ${evaluador})` : ""}</p>
      </footer>
    </div>
  );
}
