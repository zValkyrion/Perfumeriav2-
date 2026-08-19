import type {
  Bandera,
  Concentracion,
  Decision,
  Presentacion,
  TipoFoto,
  TipoProducto,
  TipoProveedor,
} from "@/lib/tipos";

/** Etiquetas en español para cada valor. La UI nunca muestra el valor crudo. */

export const TIPOS_PROVEEDOR: { valor: TipoProveedor; etiqueta: string }[] = [
  { valor: "fabricante", etiqueta: "Fabricante" },
  { valor: "maquila", etiqueta: "Maquila / taller" },
  { valor: "importador", etiqueta: "Importador" },
  { valor: "mayorista", etiqueta: "Mayorista" },
  { valor: "revendedor", etiqueta: "Revendedor" },
];

export const TIPOS_PRODUCTO: { valor: TipoProducto; etiqueta: string }[] = [
  { valor: "inspirados", etiqueta: "Inspirados" },
  { valor: "originales", etiqueta: "Originales" },
  { valor: "decants", etiqueta: "Decants" },
  { valor: "granel", etiqueta: "Esencia a granel" },
  { valor: "envases", etiqueta: "Envases" },
];

export const CONCENTRACIONES: { valor: Concentracion; etiqueta: string }[] = [
  { valor: "edt", etiqueta: "EDT" },
  { valor: "edp", etiqueta: "EDP" },
  { valor: "parfum", etiqueta: "Parfum" },
  { valor: "aceite", etiqueta: "Aceite" },
];

export const FAMILIAS = [
  "Amaderado",
  "Oriental",
  "Floral",
  "Cítrico",
  "Fougère",
  "Chipre",
  "Gourmand",
  "Acuático",
  "Especiado",
];

export const PRESENTACIONES: { valor: Presentacion; etiqueta: string; ml: number }[] = [
  { valor: "30ml", etiqueta: "30 ml", ml: 30 },
  { valor: "50ml", etiqueta: "50 ml", ml: 50 },
  { valor: "100ml", etiqueta: "100 ml", ml: 100 },
  { valor: "granel_l", etiqueta: "Granel (1 L)", ml: 1000 },
];

export const TIPOS_FOTO: { valor: TipoFoto; etiqueta: string; pista: string }[] = [
  { valor: "fachada", etiqueta: "Fachada", pista: "Para reconocer el local al volver" },
  { valor: "interior", etiqueta: "Interior", pista: "Tamaño real de la operación" },
  { valor: "producto", etiqueta: "Producto", pista: "Frasco, tapa, atomizador" },
  { valor: "etiqueta", etiqueta: "Etiqueta", pista: "Lote, caducidad, marca" },
  {
    valor: "lista_precios",
    etiqueta: "Lista de precios",
    pista: "Fotografía la hoja en vez de teclearla",
  },
];

export const BANDERAS: { valor: Bandera; etiqueta: string }[] = [
  { valor: "falsificaciones", etiqueta: "Vende falsificaciones de marca" },
  { valor: "sin_factura", etiqueta: "Se niega a facturar" },
  { valor: "sin_muestra", etiqueta: "No entrega muestra" },
  { valor: "precios_inconsistentes", etiqueta: "Precios inconsistentes" },
  { valor: "sin_local", etiqueta: "Sin local verificable" },
];

export const DECISIONES: { valor: Decision; etiqueta: string; color: string }[] = [
  { valor: "descartar", etiqueta: "Descartar", color: "var(--color-danger)" },
  { valor: "seguimiento", etiqueta: "Seguimiento", color: "var(--color-warning)" },
  { valor: "negociar", etiqueta: "Negociar", color: "var(--color-gold)" },
  { valor: "aprobado", etiqueta: "Aprobado", color: "var(--color-success)" },
];

export const MONEDAS = ["USD", "MXN", "COP", "PEN", "BRL", "EUR", "GTQ", "CLP"];

/* ============================================================
   Vocabularios controlados.

   Cada uno de estos campos era texto libre y por eso no se podía
   filtrar ni agrupar: "Dueño", "dueño", "el dueño" y "propietario"
   son cuatro valores distintos para la base de datos y el mismo
   para una persona. Se convierten en selección **sin cerrar la
   puerta**: siempre hay "Otro" con texto libre, y dejarlo vacío
   sigue siendo válido — obligar a elegir en la calle produce datos
   peores que un hueco honesto.
   ============================================================ */

export const CARGOS = [
  "Dueño",
  "Encargado",
  "Vendedor",
  "Gerente",
  "Administración",
];

/** Países de la ruta. Los que faltan entran por "Otro" y por el geocodificador. */
export const PAISES = [
  "México",
  "Guatemala",
  "Colombia",
  "Perú",
  "Ecuador",
  "Chile",
  "Argentina",
  "Brasil",
  "Estados Unidos",
  "España",
];

/** Lada por país, para que el enlace de WhatsApp no salga roto. */
export const LADAS: { valor: string; etiqueta: string; pais?: string }[] = [
  { valor: "+52", etiqueta: "+52 MX", pais: "México" },
  { valor: "+502", etiqueta: "+502 GT", pais: "Guatemala" },
  { valor: "+57", etiqueta: "+57 CO", pais: "Colombia" },
  { valor: "+51", etiqueta: "+51 PE", pais: "Perú" },
  { valor: "+593", etiqueta: "+593 EC", pais: "Ecuador" },
  { valor: "+56", etiqueta: "+56 CL", pais: "Chile" },
  { valor: "+54", etiqueta: "+54 AR", pais: "Argentina" },
  { valor: "+55", etiqueta: "+55 BR", pais: "Brasil" },
  { valor: "+1", etiqueta: "+1 US", pais: "Estados Unidos" },
  { valor: "+34", etiqueta: "+34 ES", pais: "España" },
];

/**
 * Casas de esencia. Las cuatro primeras son las grandes del mundo; el resto son
 * las respuestas que de verdad se oyen en un mostrador — incluida "No sabe",
 * que es una respuesta legítima y muy informativa sobre el proveedor.
 */
export const ORIGENES_ESENCIA = [
  "Givaudan",
  "Firmenich",
  "IFF",
  "Symrise",
  "Esencia francesa",
  "Esencia árabe",
  "Esencia local",
  "No sabe",
];

export const DIAS_HORARIO = [
  { valor: "L-V", etiqueta: "Lun a Vie" },
  { valor: "L-S", etiqueta: "Lun a Sáb" },
  { valor: "L-D", etiqueta: "Todos los días" },
];

/** Cada media hora entre las 6:00 y las 23:00: cubre cualquier local real. */
export const HORAS = Array.from({ length: 35 }, (_, i) => {
  const minutos = 6 * 60 + i * 30;
  const h = String(Math.floor(minutos / 60)).padStart(2, "0");
  const m = String(minutos % 60).padStart(2, "0");
  return `${h}:${m}`;
});

/* ── Promociones por volumen ───────────────────────────────────────────────
   La escalera de descuento es el dato que decide una compra de mayoreo: un
   proveedor caro con 3x2 real puede salir más barato que uno barato sin
   promoción. Se captura estructurada — no como nota suelta — porque solo así
   se puede calcular el precio efectivo y comparar manzanas con manzanas. */

export const TIPOS_PROMOCION = [
  { valor: "descuento", etiqueta: "% de descuento", sufijo: "%" },
  { valor: "gratis", etiqueta: "Piezas gratis", sufijo: "gratis" },
  { valor: "precio_fijo", etiqueta: "Precio fijo por pieza", sufijo: "c/u" },
  { valor: "envio_gratis", etiqueta: "Envío gratis", sufijo: "" },
  { valor: "otro", etiqueta: "Otro", sufijo: "" },
] as const;

export const UNIDADES_PROMOCION = [
  { valor: "piezas", etiqueta: "piezas" },
  { valor: "lotes", etiqueta: "lotes" },
  { valor: "litros", etiqueta: "litros" },
] as const;
