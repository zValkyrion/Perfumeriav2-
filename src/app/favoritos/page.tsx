import type { Metadata } from "next";
import { VistaFavoritos } from "@/components/favoritos/vista-favoritos";

export const metadata: Metadata = {
  title: "Favoritos",
  description: "Los perfumes que guardaste para después.",
  robots: { index: false, follow: true },
};

export default function FavoritosPage() {
  return <VistaFavoritos />;
}
