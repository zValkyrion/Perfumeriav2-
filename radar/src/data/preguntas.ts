import type { Ejes } from "@/lib/tipos";

/**
 * El guion de la visita.
 *
 * Cada eje lleva la pregunta tal como se le hace al proveedor. Sirve para tres
 * cosas: rotular el control en el formulario, listar lo que quedó sin preguntar,
 * y componer el mensaje de WhatsApp con las preguntas pendientes — que es como
 * se termina de llenar una ficha sin volver a cruzar la ciudad.
 *
 * `observable: true` marca lo que se juzga mirando (el frasco, el trato, la
 * etiqueta). Eso nunca entra en el mensaje de seguimiento: preguntarle a alguien
 * "¿qué tal es su trato?" no da información, y por escrito queda ridículo.
 */
export type Pregunta = {
  /** Rótulo corto para el control del formulario. */
  etiqueta: string;
  /** La pregunta literal, para el guion y el mensaje de seguimiento. */
  texto: string;
  /** Se responde mirando, no preguntando. */
  observable?: boolean;
};

export const PREGUNTAS: Record<keyof Ejes, Pregunta> = {
  // Calidad
  fijacion_horas: {
    etiqueta: "Fijación",
    texto: "¿Cuántas horas dura el aroma en piel?",
  },
  proyeccion: {
    etiqueta: "Proyección / estela",
    texto: "¿Qué tanta estela deja?",
    observable: true,
  },
  similitud: {
    etiqueta: "Similitud con el original",
    texto: "¿Qué tan parecido es al perfume original?",
    observable: true,
  },
  envase: {
    etiqueta: "Envase (frasco, tapa, atomizador)",
    texto: "¿Cómo es la calidad del frasco y el atomizador?",
    observable: true,
  },
  etiqueta: {
    etiqueta: "Etiqueta y presentación",
    texto: "¿Cómo es la etiqueta y la presentación?",
    observable: true,
  },
  consistencia_lotes: {
    etiqueta: "Consistencia entre lotes",
    texto: "¿El aroma sale igual en todos los lotes o varía entre producciones?",
  },
  porcentaje_esencia: {
    etiqueta: "Porcentaje de esencia",
    texto: "¿Qué porcentaje de esencia lleva el producto?",
  },

  // Precio
  competitividad_precio: {
    etiqueta: "Precio frente al mercado",
    texto: "¿Cómo está su precio comparado con otros proveedores de la zona?",
    observable: true,
  },
  precio_negociable: {
    etiqueta: "Precio negociable",
    texto: "¿El precio baja si el pedido es más grande?",
  },
  envase_incluido: {
    etiqueta: "Precio incluye envase",
    texto: "¿El precio incluye el frasco o el envase se cobra aparte?",
  },

  // Confiabilidad
  anios_operando: {
    etiqueta: "Años operando",
    texto: "¿Cuántos años llevan en el negocio?",
  },
  local_fisico: {
    etiqueta: "Tiene local físico",
    texto: "¿Este es su local propio o trabajan desde otro lado?",
    observable: true,
  },
  permisos_sanitarios: {
    etiqueta: "Permisos sanitarios",
    texto: "¿Cuentan con permisos o registro sanitario del producto?",
  },
  da_factura: {
    etiqueta: "Da factura",
    texto: "¿Pueden facturar la compra?",
  },
  tiene_referencias: {
    etiqueta: "Dio referencias de clientes",
    texto: "¿Nos pueden dar referencias de clientes con los que ya trabajan?",
  },
  entrega_muestras: {
    etiqueta: "Entrega muestras",
    texto: "¿Nos pueden dar muestras para probar antes de comprar?",
  },
  acepta_devoluciones: {
    etiqueta: "Acepta devoluciones",
    texto: "Si llega producto defectuoso, ¿lo reponen o lo aceptan de vuelta?",
  },

  // Versatilidad
  marca_blanca: {
    etiqueta: "Acepta marca blanca",
    texto: "¿Pueden entregarlo con nuestra propia marca?",
  },
  personalizacion: {
    etiqueta: "Personalización",
    texto: "¿Pueden hacer un aroma o una etiqueta a nuestra medida?",
  },
  catalogo_digital: {
    etiqueta: "Tiene catálogo digital",
    texto: "¿Tienen catálogo y lista de precios que nos puedan enviar?",
  },
  exporta: {
    etiqueta: "Exporta",
    texto: "¿Tienen experiencia exportando a otros países?",
  },
  aromas_catalogo: {
    etiqueta: "Aromas en catálogo",
    texto: "¿Cuántos aromas distintos manejan?",
  },

  // Capacidad
  stock_inmediato: {
    etiqueta: "Stock inmediato",
    texto: "¿Tienen existencia para entregar hoy o todo es bajo pedido?",
  },
  capacidad_mensual: {
    etiqueta: "Capacidad mensual",
    texto: "¿Cuántas piezas al mes pueden producir o surtir?",
  },

  // Comercial
  dias_entrega: {
    etiqueta: "Tiempo de entrega",
    texto: "¿En cuántos días entregan un pedido?",
  },
  acepta_credito: {
    etiqueta: "Crédito o anticipo parcial",
    texto: "¿Manejan crédito o se puede pagar con un anticipo parcial?",
  },
  cubre_flete: {
    etiqueta: "Cubre el flete",
    texto: "¿Quién paga el envío?",
  },
  exclusividad_zona: {
    etiqueta: "Exclusividad por zona",
    texto: "¿Dan exclusividad por zona a sus distribuidores?",
  },
  envio_internacional: {
    etiqueta: "Envío internacional",
    texto: "¿Hacen envíos a otro país y con qué paquetería?",
  },

  // Trato
  trato: {
    etiqueta: "Trato y comunicación",
    texto: "¿Cómo fue el trato?",
    observable: true,
  },
  horas_respuesta: {
    etiqueta: "Tiempo de respuesta",
    texto: "¿En cuánto tiempo suelen contestar un mensaje?",
  },
};

/** Datos de la ficha que no son ejes pero también se preguntan. */
export const PREGUNTAS_FICHA: { campo: string; texto: string }[] = [
  { campo: "origenEsencia", texto: "¿De dónde viene la esencia que usan?" },
  { campo: "precios", texto: "¿Cuál es el precio por presentación y el mínimo de compra?" },
  { campo: "promociones", texto: "¿Qué promoción o descuento hacen por volumen?" },
  { campo: "horario", texto: "¿Cuál es su horario de atención?" },
  { campo: "razonSocial", texto: "¿Cuál es la razón social para facturar?" },
];
