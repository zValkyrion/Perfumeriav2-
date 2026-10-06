import { MarcoPanel } from "@/components/panel/marco";

/**
 * El panel de la tienda: menú lateral en computadora, barra superior con menú
 * en teléfono. Las URL no cambian (`/tienda/`, `/pedidos/`…): el grupo solo
 * comparte este marco.
 */
export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  return <MarcoPanel>{children}</MarcoPanel>;
}
