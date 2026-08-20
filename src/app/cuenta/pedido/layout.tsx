import type { Metadata } from "next";

/**
 * El título y el `noindex` viven aquí y no en la página porque la página es un
 * componente de cliente: `useSearchParams` obliga a ello —el folio viaja en la
 * consulta— y un componente de cliente no puede exportar `metadata`.
 */
export const metadata: Metadata = {
  title: "Detalle del pedido",
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
