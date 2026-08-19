// Modelo de la ficha de proveedor. Es el mismo contrato que guardará DynamoDB en
// la Fase 1, así que los nombres de campo aquí son los definitivos: lo capturado
// en calle antes de que exista el backend tiene que subir sin migraciones.

export type EstadoSync = "borrador" | "pendiente" | "sincronizado";

export type TipoProveedor =
  | "fabricante"
  | "maquila"
  | "importador"
  | "mayorista"
  | "revendedor";

export type TipoProducto =
  | "inspirados"
  | "originales"
  | "decants"
  | "granel"
  | "envases";

export type Concentracion = "edt" | "edp" | "parfum" | "aceite";

export type OrigenUbicacion = "gps" | "manual";

export type Decision = "descartar" | "seguimiento" | "negociar" | "aprobado";

export type TipoFoto =
  | "fachada"
  | "interior"
  | "producto"
  | "etiqueta"
  | "lista_precios";

export type Presentacion = "30ml" | "50ml" | "100ml" | "granel_l";

/**
 * Horario estructurado.
 *
 * Era texto libre y por eso no se podía filtrar: "L-S 9 a 6", "lunes a sábado
 * de 9:00 a 18:00" y "9-6" son el mismo horario y tres valores distintos para
 * la base de datos. La `nota` guarda lo que no cabe en el molde (comidas,
 * domingos alternos) sin obligar a nadie a mentir con el selector.
 */
export type Horario = {
  dias: string | null;
  abre: string | null;
  cierra: string | null;
  nota: string;
};

export type TipoPromocion =
  | "descuento"
  | "gratis"
  | "precio_fijo"
  | "envio_gratis"
  | "otro";

export type UnidadPromocion = "piezas" | "lotes" | "litros";

/**
 * Un escalón de la escalera de volumen.
 *
 * Es el dato que decide una compra de mayoreo: un proveedor caro con un 3x2 real
 * puede salir más barato que uno barato sin promoción. Estructurado —y no como
 * nota suelta— porque solo así se calcula el precio efectivo por pieza.
 */
export type Promocion = {
  id: string;
  /** A partir de cuántas unidades aplica. */
  desde: number | null;
  unidad: UnidadPromocion;
  tipo: TipoPromocion;
  /** % si es descuento, piezas regaladas si es gratis, precio si es fijo. */
  valor: number | null;
  /** Para "otro", y para los detalles que el molde no captura. */
  nota: string;
};

export type Precio = {
  presentacion: Presentacion;
  precio: number | null;
  moq: number | null;
};

/**
 * Los ejes evaluables.
 *
 * **Todo empieza en `null`, y `null` significa "no se preguntó".** Es la regla
 * más importante del modelo. Antes cada ficha nacía con valores por defecto
 * —`permisos_sanitarios: false`, `anios_operando: 3`— y el score los sumaba
 * como si fueran observaciones: un proveedor del que solo se tomó una foto salía
 * con 44 puntos inventados, y peor, aparecía como "no tiene permisos" cuando
 * nadie se lo había preguntado. Un dato ausente y un dato malo no son lo mismo,
 * y confundirlos es la forma más rápida de descartar a un buen proveedor.
 *
 * Consecuencia: `lib/analisis.ts` solo puntúa lo respondido y reporta aparte
 * cuánta información sostiene ese puntaje.
 */
export type Ejes = {
  // ── Calidad ──────────────────────────────────────────────────────────────
  fijacion_horas: number | null; // 0–12
  proyeccion: number | null; // 1–5
  similitud: number | null; // 1–5
  envase: number | null; // 1–5
  etiqueta: number | null; // 1–5
  /** Variación entre lotes: en perfumería es lo que más devoluciones causa. */
  consistencia_lotes: number | null; // 1–5
  /** % de esencia. Es el dato duro detrás de "¿qué tan bueno es?". */
  porcentaje_esencia: number | null; // 0–40

  // ── Precio ───────────────────────────────────────────────────────────────
  competitividad_precio: number | null; // 1–5
  precio_negociable: boolean | null;
  /** ¿El precio incluye el frasco o se cobra aparte? Cambia el costo real. */
  envase_incluido: boolean | null;

  // ── Confiabilidad ────────────────────────────────────────────────────────
  anios_operando: number | null; // 0–30
  local_fisico: boolean | null;
  permisos_sanitarios: boolean | null;
  da_factura: boolean | null;
  tiene_referencias: boolean | null;
  entrega_muestras: boolean | null;
  acepta_devoluciones: boolean | null;

  // ── Versatilidad ─────────────────────────────────────────────────────────
  marca_blanca: boolean | null;
  /** Aroma o etiqueta a medida, más allá de poner tu logo. */
  personalizacion: boolean | null;
  catalogo_digital: boolean | null;
  exporta: boolean | null;
  /** Número de aromas distintos en catálogo. */
  aromas_catalogo: number | null;

  // ── Capacidad ────────────────────────────────────────────────────────────
  stock_inmediato: number | null; // 1–5
  capacidad_mensual: number | null; // piezas/mes

  // ── Comercial ────────────────────────────────────────────────────────────
  dias_entrega: number | null; // 0–60
  acepta_credito: boolean | null;
  cubre_flete: boolean | null;
  exclusividad_zona: boolean | null;
  envio_internacional: boolean | null;

  // ── Trato ────────────────────────────────────────────────────────────────
  trato: number | null; // 1–5
  /** Horas que tarda en contestar. Predice cómo será trabajar con él. */
  horas_respuesta: number | null; // 0–72
};

/** Banderas rojas. Las críticas topan el score: ver `lib/analisis.ts`. */
export type Bandera =
  | "falsificaciones"
  | "sin_factura"
  | "sin_muestra"
  | "precios_inconsistentes"
  | "sin_local";

export type Foto = {
  id: string;
  proveedorId: string;
  tipo: TipoFoto;
  blob: Blob;
  tomadaEn: string;
  lat: number | null;
  lng: number | null;
  /** Ya está en S3. Se marca solo cuando S3 confirmó, para que un corte a
      media subida se reintente en vez de darse por hecho. */
  subida?: boolean;
};

export type Proveedor = {
  id: string;
  // Identificación
  nombre: string;
  razonSocial: string;
  tipo: TipoProveedor | null;
  telefono: string;
  whatsapp: string;
  email: string;
  redes: string;
  contactoNombre: string;
  contactoCargo: string;
  horario: Horario;
  /** Lada internacional. Sin esto el enlace de WhatsApp sale roto en el
      extranjero, que es justo donde se está usando la app. */
  lada: string;
  // Ubicación
  lat: number | null;
  lng: number | null;
  precisionGps: number | null;
  /** Un punto puesto a mano vale más que un GPS impreciso, pero hay que saber
      cuál es cuál al hacer los mapas. */
  origenUbicacion: OrigenUbicacion | null;
  direccion: string;
  ciudad: string;
  pais: string;
  // Producto
  tiposProducto: TipoProducto[];
  concentraciones: Concentracion[];
  familias: string[];
  /** Casa o país de la esencia (Givaudan, Firmenich, "esencia árabe"…). En
      inspirados es el mejor indicador de calidad que se puede preguntar. */
  origenEsencia: string;
  // Comercial
  precios: Precio[];
  promociones: Promocion[];
  moneda: string;
  // Evaluación
  ejes: Ejes;
  banderas: Bandera[];
  notas: string;
  decision: Decision | null;
  // Meta
  evaluador: string;
  creadoEn: string;
  actualizadoEn: string;
  estado: EstadoSync;
};

/** Todo en `null`: nada se da por sabido hasta que alguien lo pregunta. */
export const EJES_INICIALES: Ejes = {
  fijacion_horas: null,
  proyeccion: null,
  similitud: null,
  envase: null,
  etiqueta: null,
  consistencia_lotes: null,
  porcentaje_esencia: null,
  competitividad_precio: null,
  precio_negociable: null,
  envase_incluido: null,
  anios_operando: null,
  local_fisico: null,
  permisos_sanitarios: null,
  da_factura: null,
  tiene_referencias: null,
  entrega_muestras: null,
  acepta_devoluciones: null,
  marca_blanca: null,
  personalizacion: null,
  catalogo_digital: null,
  exporta: null,
  aromas_catalogo: null,
  stock_inmediato: null,
  capacidad_mensual: null,
  dias_entrega: null,
  acepta_credito: null,
  cubre_flete: null,
  exclusividad_zona: null,
  envio_internacional: null,
  trato: null,
  horas_respuesta: null,
};

export function proveedorNuevo(evaluador: string): Proveedor {
  const ahora = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    nombre: "",
    razonSocial: "",
    tipo: null,
    telefono: "",
    whatsapp: "",
    email: "",
    redes: "",
    contactoNombre: "",
    contactoCargo: "",
    horario: { dias: null, abre: null, cierra: null, nota: "" },
    lada: "",
    lat: null,
    lng: null,
    precisionGps: null,
    origenUbicacion: null,
    direccion: "",
    ciudad: "",
    pais: "",
    tiposProducto: [],
    concentraciones: [],
    familias: [],
    origenEsencia: "",
    precios: [],
    promociones: [],
    moneda: "USD",
    ejes: { ...EJES_INICIALES },
    banderas: [],
    notas: "",
    decision: null,
    evaluador,
    creadoEn: ahora,
    actualizadoEn: ahora,
    estado: "borrador",
  };
}

/**
 * Completa una ficha guardada con los campos que no existían cuando se capturó.
 *
 * Las fichas viven en el teléfono entre versión y versión de la app: sin esto,
 * abrir una ficha vieja después de un despliegue reventaría al leer un eje que
 * todavía no existía.
 */
export function normalizar(guardado: Proveedor): Proveedor {
  const base = proveedorNuevo(guardado.evaluador ?? "");
  // El horario nació como texto libre. Lo escrito entonces se conserva en la
  // nota: es información real y perderla al migrar sería peor que no migrar.
  const horario =
    typeof guardado.horario === "string"
      ? { ...base.horario, nota: guardado.horario }
      : { ...base.horario, ...(guardado.horario ?? {}) };

  return {
    ...base,
    ...guardado,
    horario,
    ejes: { ...EJES_INICIALES, ...(guardado.ejes ?? {}) },
    promociones: guardado.promociones ?? [],
  };
}
