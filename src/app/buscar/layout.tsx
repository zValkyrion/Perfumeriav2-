import type { Metadata } from "next";

/**
 * La página de búsqueda es un componente de cliente —lee `q` de la URL— y por
 * eso no puede exportar `metadata` ella misma. Este layout existe solo para
 * sacarla del índice: una página de resultados no responde ninguna consulta y
 * hasta ahora heredaba el título de la home.
 */
export const metadata: Metadata = {
  title: "Buscar perfumes",
  description:
    "Busca por nombre, marca, familia olfativa o nota dentro del catálogo completo.",
  robots: { index: false, follow: true },
};

export default function BuscarLayout({
  children,
}: LayoutProps<"/buscar">) {
  return children;
}
