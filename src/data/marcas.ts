import type { Marca } from "@/types";

/** Las 12 casas de EL REY DE LOS PERFUMES. Marcas ficticias, originales (§17). */
export const MARCAS: readonly Marca[] = [
  {
    slug: "maison-lumiere",
    nombre: "Maison Lumière",
    pais: "Francia",
    fundada: 1978,
    firma: "La alta perfumería, sin el discurso solemne.",
    descripcion:
      "Nacida en un taller de Grasse, Maison Lumière trabaja el absoluto de flor como quien pule una piedra: quitando. Sus fórmulas rara vez pasan de veinte materias primas, y esa contención es justo lo que las vuelve reconocibles a tres metros de distancia.",
  },
  {
    slug: "orfevre",
    nombre: "Orfèvre",
    pais: "Francia",
    fundada: 1992,
    firma: "Cuero, humo y paciencia.",
    descripcion:
      "Orfèvre empezó curtiendo guantes y terminó perfumándolos. Su obsesión es el cuero en todas sus temperaturas —el suave de la piel nueva, el ahumado de la birmana, el dulce de la gamuza— siempre sobre una base amaderada que aguanta el día entero.",
  },
  {
    slug: "casa-solano",
    nombre: "Casa Solano",
    pais: "España",
    fundada: 1964,
    firma: "El Mediterráneo embotellado.",
    descripcion:
      "Tres generaciones destilando azahar en la misma finca alicantina. Casa Solano hace cítricos que no se evaporan en veinte minutos: los ancla en petitgrain, almizcles blancos y una pizca de romero que los sostiene hasta la tarde.",
  },
  {
    slug: "atelier-nord",
    nombre: "Atelier Nord",
    pais: "Dinamarca",
    fundada: 2009,
    firma: "Menos aroma, más atmósfera.",
    descripcion:
      "La casa más joven del catálogo y la más austera. Atelier Nord construye fragancias translúcidas —aire salino, madera pálida, papel húmedo— pensadas para oficinas silenciosas y para quien prefiere que su perfume se note al abrazar, no al entrar.",
  },
  {
    slug: "nuit-royale",
    nombre: "Nuit Royale",
    pais: "Francia",
    fundada: 1985,
    firma: "Perfumes que empiezan a las nueve de la noche.",
    descripcion:
      "Nuit Royale no fabrica fragancias de oficina y lo dice con orgullo. Ámbar denso, vainilla negra, incienso y flores narcóticas en concentraciones que otras casas considerarían imprudentes. Se aplican con dos toques, nunca con seis.",
  },
  {
    slug: "ambar-co",
    nombre: "Ámbar & Co.",
    pais: "México",
    fundada: 2001,
    firma: "Resinas de aquí, técnica de allá.",
    descripcion:
      "Casa mexicana que trabaja copal, benjuí y vainilla de Papantla con método francés. Ámbar & Co. demostró que se podía hacer perfumería de autor en Puebla y hoy exporta a catorce países sin haber movido su laboratorio.",
  },
  {
    slug: "septimo-cielo",
    nombre: "Séptimo Cielo",
    pais: "México",
    fundada: 2014,
    firma: "Dulce, pero con carácter.",
    descripcion:
      "Séptimo Cielo entendió antes que nadie que el gourmand mexicano quería azúcar sin empalago. Sus fórmulas cruzan praliné, café de olla y frutas rojas con un fondo amaderado que evita el efecto postre y les da horas de vida.",
  },
  {
    slug: "kairo-parfums",
    nombre: "Kairo Parfums",
    pais: "Emiratos Árabes Unidos",
    fundada: 1996,
    firma: "La escuela árabe, sin traducir.",
    descripcion:
      "Kairo trabaja como se trabaja en el Golfo: concentraciones altas, materias caras y ninguna prisa por gustarle a todo el mundo. Azafrán, rosa de Taif, oud y ámbar gris en proporciones que explican por qué media gota rinde una jornada.",
  },
  {
    slug: "vetiver-house",
    nombre: "Vetiver House",
    pais: "Reino Unido",
    fundada: 1971,
    firma: "Una sola raíz, cien lecturas.",
    descripcion:
      "Una casa monográfica. Vetiver House lleva medio siglo destilando la misma raíz haitiana y encontrándole ángulos nuevos: ahumado, cítrico, terroso, casi mentolado. Es perfumería de fondo verde para quien ya se cansó de lo dulce.",
  },
  {
    slug: "lys-blanc",
    nombre: "Lys Blanc",
    pais: "Francia",
    fundada: 1988,
    firma: "Flores blancas a plena luz.",
    descripcion:
      "Tuberosa, jazmín, gardenia y nardo: Lys Blanc solo trabaja el territorio más difícil de la perfumería floral, el de las flores que se vuelven indolentes si se les da un gramo de más. Su equilibrio es la razón de su reputación.",
  },
  {
    slug: "oud-imperial",
    nombre: "Oud Imperial",
    pais: "Emiratos Árabes Unidos",
    fundada: 1983,
    firma: "El oud como materia noble, no como moda.",
    descripcion:
      "Compran madera de agar por lote y la maduran años antes de destilarla. Oud Imperial es la casa más cara del catálogo y la más longeva en piel: sus fondos siguen ahí a la mañana siguiente, en la camisa y en la almohada.",
  },
  {
    slug: "solaris",
    nombre: "Solaris",
    pais: "Italia",
    fundada: 2003,
    firma: "Verano permanente.",
    descripcion:
      "Solaris embotella la hora en que la playa se vacía: sal en la piel, higuera caliente, monoi y un cítrico que ya se está apagando. Fragancias solares hechas para climas como el mexicano, donde el calor se come a los perfumes pesados.",
  },
] as const;

export const MARCAS_POR_SLUG = new Map(MARCAS.map((m) => [m.slug, m]));

export function getMarca(slug: string): Marca | undefined {
  return MARCAS_POR_SLUG.get(slug);
}
