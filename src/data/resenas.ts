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

const SEMILLAS: readonly SemillaReseña[] = [
  {
    slug: "noir-absolu",
    autor: "Mariana Cépeda",
    rating: 5,
    fecha: "2026-06-18",
    titulo: "Vale cada peso",
    texto:
      "Lo compré para una boda y terminé usándolo todos los días de diciembre. Me dura desde las 8 de la mañana hasta que llego a casa, y el iris se nota más a las tres horas que al principio. Pedí el de 50 ml y ya voy a por el de 100.",
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
      "Llevo tres lotes de 24 y este modelo se me acaba siempre primero. Las clientas lo huelen y lo compran, no hay que explicarles nada. El fondo amaderado es lo que lo salva de ser un dulce más.",
    verificada: true,
  },
  {
    slug: "praline",
    autor: "Alejandra Nieto",
    rating: 5,
    fecha: "2026-05-09",
    titulo: "Dura muchísimo",
    texto:
      "Me lo pongo a las 7 am y a las 6 pm todavía lo huelo en el suéter. La almendra al principio es fuerte pero a los veinte minutos se acomoda muy rico.",
    verificada: true,
  },
  {
    slug: "cuir-fauve",
    autor: "Javier Montalvo",
    rating: 5,
    fecha: "2026-03-14",
    titulo: "Cuero de verdad",
    texto:
      "Había probado varios cueros y casi todos huelen a producto de limpieza. Este no: huele a taller, a piel curtida. Proyecta muchísimo las primeras dos horas, con dos disparos sobra.",
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
    titulo: "El azahar más real que he olido",
    texto:
      "Soy de Hermosillo y aquí los cítricos se evaporan en media hora. Este me aguanta cinco horas fácil y huele a naranjo de verdad, no a jabón. Ya lo pedí en 200 ml.",
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
    titulo: "Adictivo en invierno",
    texto:
      "Lo compré en diciembre y no me lo quité en dos meses. El ámbar es denso, dulce pero no empalagoso, y la ciruela del principio es preciosa. La estela dura en la bufanda días.",
    verificada: true,
  },
  {
    slug: "minuit-ambre",
    autor: "Diana Sotelo",
    rating: 5,
    fecha: "2025-11-28",
    titulo: "Cumplidos garantizados",
    texto:
      "Nunca me habían preguntado tanto qué perfume traigo. Eso sí: dos toques bastan, con más se vuelve abrumador. En verano lo dejo guardado.",
    verificada: true,
  },
  {
    slug: "vetiver-haiti",
    autor: "Héctor Zambrano",
    rating: 5,
    fecha: "2026-06-05",
    titulo: "El más versátil que tengo",
    texto:
      "Lo uso para trabajar, para salir y hasta para el gimnasio. Nunca queda mal. El vetiver es limpio, verde, sin ese toque terroso que a veces molesta. Segundo frasco ya.",
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
    titulo: "La tuberosa perfecta",
    texto:
      "He probado muchas y casi todas me resultan mantecosas. Esta está en el punto exacto: floral, cremosa, pero nunca pesada. Para eventos de noche es insuperable.",
    verificada: true,
  },
  {
    slug: "azafran-real",
    autor: "Ibrahim Sandoval",
    rating: 5,
    fecha: "2026-04-19",
    titulo: "Escuela árabe auténtica",
    texto:
      "El azafrán del principio es exactamente el de los perfumes que traía mi tío de Dubái. Con medio disparo me dura todo el día y la camisa huele al día siguiente. Rendimiento brutal.",
    verificada: true,
  },
  {
    slug: "oud-y-rosa",
    autor: "Carolina Mejía",
    rating: 5,
    fecha: "2026-02-27",
    titulo: "Mi primer oud y acerté",
    texto:
      "Tenía miedo de que oliera a medicina, que es lo que me pasó con otros. Este es dulce, la rosa manda al principio y el oud va saliendo poco a poco. Muy fácil de llevar.",
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
export const RESEÑAS_DESTACADAS = RESEÑAS.filter(
  (r) => r.rating >= 4.5 && r.verificada,
).slice(0, 8);
