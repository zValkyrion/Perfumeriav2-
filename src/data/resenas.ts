import type { Reseña } from "@/types";
import { getProducto } from "./productos";

interface SemillaReseña {
  slug: string;
  autor: string;
  rating: number;
  fecha: string;
  titulo: string;
  texto: string;
  verificada?: boolean;
}

/**
 * Las ocho primeras de cinco estrellas son las que alimentan la prueba social
 * de la home, y están escritas desde el negocio: quien las firma compró para
 * revender. Hablan de margen contra el proveedor anterior, de rotación y de que
 * el pedido llegó a tiempo, porque eso es lo que decide a quien está pensando
 * en emprender. Las de más abajo mantienen la voz del cliente final, que es la
 * que tiene sentido en la ficha de producto.
 */
const SEMILLAS: readonly SemillaReseña[] = [
  {
    slug: "noir-absolu",
    autor: "Mariana Cépeda",
    rating: 5,
    fecha: "2026-06-18",
    titulo: "Se me acabó antes que nada",
    texto:
      "Lo metí en mi primer pedido de 12 sin muchas esperanzas y fue el primero que se me agotó. Me sale a menos de la mitad de lo que me lo dejaba mi proveedor de antes, así que hasta puedo dar descuento y seguir ganando.",
    verificada: true,
  },
  {
    slug: "noir-absolu",
    autor: "Rodrigo Ávalos",
    rating: 4,
    fecha: "2026-04-02",
    titulo: "Serio, no para todos",
    texto:
      "Es un perfume elegante pero seco. Si esperabas algo dulce no es este. A mí me encanta para la oficina en invierno; en mayo con 30 grados lo siento pesado.",
    verificada: true,
  },
  {
    slug: "praline",
    autor: "Fernanda Quiroz",
    rating: 5,
    fecha: "2026-07-21",
    titulo: "Mi más vendido como revendedora",
    texto:
      "Llevo tres paquetes y este modelo se me acaba siempre primero. Las clientas lo huelen y lo compran, no hay que explicarles nada. Con lo que me ahorro contra mi mayorista de antes saco casi el doble por pieza.",
    verificada: true,
  },
  {
    slug: "praline",
    autor: "Alejandra Nieto",
    rating: 5,
    fecha: "2026-05-09",
    titulo: "Llegó a tiempo para el 10 de mayo",
    texto:
      "Pedí ocho piezas un martes pensando en la fecha y el viernes ya las tenía. Se vendieron todas ese fin de semana. Vino bien empacado y con la lista de precios sugeridos, que es justo lo que me faltaba para no rematar.",
    verificada: true,
  },
  {
    slug: "cuir-fauve",
    autor: "Javier Montalvo",
    rating: 5,
    fecha: "2026-03-14",
    titulo: "El de ticket más alto de mi mesa",
    texto:
      "Lo pongo como el caro del puesto y es el que más margen deja. El cliente que ya sabe de perfumes lo reconoce al primer olfateo y no regatea. Con otros proveedores un cuero así me costaba el doble.",
    verificada: true,
  },
  {
    slug: "cuir-fauve",
    autor: "Ernesto Palomares",
    rating: 4,
    fecha: "2025-12-30",
    titulo: "Potente, cuidado con la dosis",
    texto:
      "La primera vez me puse cuatro disparos y fue un error, me dolía la cabeza. Con uno en el cuello es perfecto. Es de noche y de frío, no lo lleven a la playa.",
    verificada: true,
  },
  {
    slug: "azahar-de-marzo",
    autor: "Paulina Berrones",
    rating: 5,
    fecha: "2026-07-02",
    titulo: "Rota rapidísimo en el norte",
    texto:
      "Vendo en Hermosillo y con el calor lo que se busca es cítrico. Pedí doce, me llegaron en tres días y no me duraron el mes. Ya voy por el segundo pedido y esta vez llevo el paquete grande.",
    verificada: true,
  },
  {
    slug: "azahar-de-marzo",
    autor: "Luis Fernando Cruz",
    rating: 4,
    fecha: "2026-02-11",
    titulo: "Muy bueno para diario",
    texto:
      "Fresco y limpio, ideal para la oficina. Le quito una estrella porque me gustaría que durara un par de horas más, pero por el precio no me quejo.",
    verificada: true,
  },
  {
    slug: "minuit-ambre",
    autor: "Gabriela Ostos",
    rating: 5,
    fecha: "2026-01-22",
    titulo: "Mi mejor diciembre",
    texto:
      "Compré veinte piezas para la temporada y las vendí todas antes de Navidad. El precio por pieza me dejó margen para regalar el envío y aun así ganar bien. Es el que repito cada invierno.",
    verificada: true,
  },
  {
    slug: "minuit-ambre",
    autor: "Diana Sotelo",
    rating: 5,
    fecha: "2025-11-28",
    titulo: "Los clientes regresan por él",
    texto:
      "No es solo que se venda: la gente vuelve a pedirme el mismo, y esa recompra con lo que traía de otro mayorista no me pasaba. Llega sellado y con su caja, que es la mitad de la venta.",
    verificada: true,
  },
  {
    slug: "vetiver-haiti",
    autor: "Héctor Zambrano",
    rating: 5,
    fecha: "2026-06-05",
    titulo: "El seguro de mi inventario",
    texto:
      "Es el que le ofrezco a quien no sabe qué llevar, hombre o mujer, y nunca se me queda parado. Lo pido en cada paquete y siempre sale antes que los demás. Cero riesgo.",
    verificada: true,
  },
  {
    slug: "vetiver-haiti",
    autor: "Óscar Rentería",
    rating: 4,
    fecha: "2026-03-30",
    titulo: "Clásico bien hecho",
    texto:
      "No inventa nada pero está muy bien resuelto. La salida de pomelo es corta, en diez minutos ya estás en la raíz. Duración de unas siete horas en mi piel.",
    verificada: true,
  },
  {
    slug: "tuberosa-blanca",
    autor: "Regina Alcalá",
    rating: 5,
    fecha: "2026-05-17",
    titulo: "Se vende sola en temporada de bodas",
    texto:
      "De mayo a octubre no doy abasto con este. Lo pido en cada paquete y se va en dos semanas. Mis clientas lo comparan con el de tienda departamental y no notan la diferencia, pero pagan la tercera parte.",
    verificada: true,
  },
  {
    slug: "azafran-real",
    autor: "Ibrahim Sandoval",
    rating: 5,
    fecha: "2026-04-19",
    titulo: "Con este subí mi ticket promedio",
    texto:
      "Lo agregué para atender a clientes que ya saben de perfumes y me cambió el negocio: vendo menos piezas pero cada una deja el doble. El costo al que me llega no lo consigo con nadie más.",
    verificada: true,
  },
  {
    slug: "oud-y-rosa",
    autor: "Carolina Mejía",
    rating: 5,
    fecha: "2026-02-27",
    titulo: "Empecé con el paquete chico y ya voy en el grande",
    texto:
      "Arranqué con diez piezas para probar, sin conocer a nadie del giro. Se vendieron en tres semanas y con esa ganancia pagué el siguiente pedido. Hoy vivo de esto y no metí capital extra.",
    verificada: true,
  },
  {
    slug: "frutos-del-septimo",
    autor: "Yatzil Contreras",
    rating: 4,
    fecha: "2026-07-08",
    titulo: "Excelente para revender",
    texto:
      "Compré 12 piezas y las vendí en dos semanas. Es fácil, fresco y a las clientas jóvenes les encanta. Dura unas cinco horas, que para el precio está muy bien.",
    verificada: true,
  },
  {
    slug: "sal-y-higuera",
    autor: "Bruno Villalpando",
    rating: 5,
    fecha: "2026-06-27",
    titulo: "Huele a vacaciones",
    texto:
      "La hoja de higuera está clavada, es idéntica a la planta real. Lo uso en Vallarta y funciona perfecto con el calor. Unisex de verdad, mi esposa me lo roba.",
    verificada: true,
  },
  {
    slug: "copal",
    autor: "Itzel Ramírez",
    rating: 5,
    fecha: "2026-01-09",
    titulo: "Orgullosamente mexicano",
    texto:
      "El copal se reconoce al instante y el cacao le da algo cálido que no había olido en ningún perfume europeo. Se lo regalé a una amiga en Barcelona y no paran de preguntarle.",
    verificada: true,
  },
  {
    slug: "solaris-azul",
    autor: "Emiliano Barajas",
    rating: 4,
    fecha: "2026-05-31",
    titulo: "Mucho rendimiento por el precio",
    texto:
      "Es un acuático moderno, no reinventa nada, pero proyecta muchísimo y dura ocho horas reales. Para lo que cuesta no hay con qué pelearle.",
    verificada: true,
  },
  {
    slug: "silencio-04",
    autor: "Natalia Escobedo",
    rating: 5,
    fecha: "2026-03-05",
    titulo: "Segunda piel",
    texto:
      "Trabajo en un consultorio y no puedo usar nada que invada. Este es perfecto: casi no proyecta pero yo lo huelo todo el día y quien me abraza lo nota. Caro, pero rinde muchísimo.",
    verificada: false,
  },
] as const;

export const RESEÑAS: readonly Reseña[] = SEMILLAS.map((s, i) => ({
  id: `r${String(i + 1).padStart(3, "0")}`,
  productoId: getProducto(s.slug)?.id ?? "",
  autor: s.autor,
  rating: s.rating,
  fecha: s.fecha,
  titulo: s.titulo,
  texto: s.texto,
  verificada: s.verificada ?? true,
}));

/** Reseñas de un producto, de la más reciente a la más antigua. */
export function resenasDe(productoId: string): Reseña[] {
  return RESEÑAS.filter((r) => r.productoId === productoId).sort((a, b) =>
    b.fecha.localeCompare(a.fecha),
  );
}

/** Distribución de estrellas 5→1, para el resumen de la ficha (§10.11). */
export function distribucion(resenas: Reseña[]): Record<number, number> {
  const base: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of resenas) base[r.rating] = (base[r.rating] ?? 0) + 1;
  return base;
}

/** Las mejores reseñas del sitio, para la prueba social de la home (§8.10). */
/** Las mejores reseñas del sitio: alimentan la prueba social y los videos. */
const MEJORES = RESEÑAS.filter((r) => r.rating >= 4.5 && r.verificada);

export const RESEÑAS_DESTACADAS = MEJORES.slice(0, 8);

/**
 * Segunda tanda, para el bloque en vertical de la home.
 *
 * Son otras cinco y no las mismas ocho: repetir las tarjetas de arriba unas
 * pantallas más abajo se lee como relleno, y lo que se busca aquí es que quien
 * llegó hasta el final siga encontrando testimonios que no había visto.
 */
export const RESEÑAS_VERTICALES = MEJORES.slice(8, 13);
