/**
 * La app de campo (proveedores): una columna de teléfono, porque se usa de pie
 * en la calle. Antes este ancho vivía en el `<body>` de toda la app; ahora es
 * solo de este grupo, y el panel de la tienda (`(panel)`) usa el ancho de la
 * pantalla.
 */
export default function LayoutCampo({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-dvh max-w-2xl">{children}</div>;
}
