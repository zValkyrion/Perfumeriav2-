import { PRESENTACIONES } from "@/data/catalogo";
import { PREGUNTAS, PREGUNTAS_FICHA } from "@/data/preguntas";
import type { Ejes, Precio, Promocion, Proveedor } from "@/lib/tipos";

/**
 * Motor de evaluación.
 *
 * Dos reglas gobiernan todo lo demás:
 *
 * 1. **Solo se puntúa lo que se preguntó.** Un eje en `null` no vale cero: sale
 *    del cálculo y su peso se reparte entre lo que sí se sabe. Por eso cada
 *    puntaje viaja siempre con su `cobertura` — un 80 respaldado por el 30% de
 *    la información no es el mismo 80 que uno con el 90%, y presentarlos igual
 *    es lo que hace que alguien firme con el proveedor equivocado.
 *
 * 2. **Las banderas rojas no restan, topan.** Un proveedor que vende
 *    falsificaciones no deja de ser un riesgo legal porque tenga buen precio y
 *    buen trato; sin el tope, la suma ponderada lo colaría al verde.
 */

export const CRITERIOS = {
  calidad: { peso: 28, nombre: "Calidad" },
  precio: { peso: 22, nombre: "Precio" },
  confiabilidad: { peso: 15, nombre: "Confiabilidad" },
  versatilidad: { peso: 12, nombre: "Versatilidad" },
  capacidad: { peso: 10, nombre: "Capacidad" },
  comercial: { peso: 8, nombre: "Comercial" },
  trato: { peso: 5, nombre: "Trato" },
} as const;

export type Criterio = keyof typeof CRITERIOS;

// ── Normalizadores ──────────────────────────────────────────────────────────
/** Escala 1–5 a 0–1. */
const de5 = (v: number) => Math.min(Math.max((v - 1) / 4, 0), 1);
/** Lineal con techo: más es mejor. */
const techo = (max: number) => (v: number) => Math.min(Math.max(v / max, 0), 1);
/** Lineal invertido: menos es mejor (días de entrega, horas de respuesta). */
const inverso = (max: number) => (v: number) => 1 - Math.min(Math.max(v / max, 0), 1);
/** Sí = 1, no = 0. */
const bin = (v: boolean) => (v ? 1 : 0);

type Item = {
  clave: keyof Ejes;
  peso: number;
  norma: (v: never) => number;
};

const item = <K extends keyof Ejes>(
  clave: K,
  peso: number,
  norma: (v: NonNullable<Ejes[K]>) => number,
): Item => ({ clave, peso, norma: norma as (v: never) => number });

/** Qué ejes componen cada criterio y cuánto pesa cada uno dentro de él. */
const COMPOSICION: Record<Criterio, Item[]> = {
  calidad: [
    item("similitud", 25, de5),
    item("fijacion_horas", 20, techo(10)),
    item("consistencia_lotes", 20, de5),
    item("porcentaje_esencia", 15, techo(25)),
    item("envase", 12, de5),
    item("etiqueta", 8, de5),
  ],
  precio: [
    item("competitividad_precio", 60, de5),
    item("precio_negociable", 25, bin),
    item("envase_incluido", 15, bin),
  ],
  confiabilidad: [
    item("anios_operando", 20, techo(10)),
    item("permisos_sanitarios", 18, bin),
    item("da_factura", 18, bin),
    item("local_fisico", 15, bin),
    item("acepta_devoluciones", 15, bin),
    item("tiene_referencias", 8, bin),
    item("entrega_muestras", 6, bin),
  ],
  versatilidad: [
    item("aromas_catalogo", 30, techo(150)),
    item("marca_blanca", 25, bin),
    item("personalizacion", 20, bin),
    item("exporta", 15, bin),
    item("catalogo_digital", 10, bin),
  ],
  capacidad: [
    item("stock_inmediato", 50, de5),
    item("capacidad_mensual", 50, techo(2000)),
  ],
  comercial: [
    item("dias_entrega", 35, inverso(30)),
    item("acepta_credito", 25, bin),
    item("envio_internacional", 15, bin),
    item("cubre_flete", 15, bin),
    item("exclusividad_zona", 10, bin),
  ],
  trato: [item("trato", 60, de5), item("horas_respuesta", 40, inverso(48))],
};

const BANDERAS_CRITICAS = ["falsificaciones", "precios_inconsistentes"];
const TOPE_CRITICO = 39;
const CASTIGO_BANDERA = 8;

export type Puntaje = {
  /** 0–100, o `null` si no se respondió nada de este criterio. */
  valor: number | null;
  /** Proporción del peso del criterio que está respondida (0–1). */
  cobertura: number;
  /** Ejes de este criterio que siguen sin preguntar. */
  faltantes: (keyof Ejes)[];
};

export function puntajeCriterio(ejes: Ejes, criterio: Criterio): Puntaje {
  const items = COMPOSICION[criterio];
  let suma = 0;
  let pesoRespondido = 0;
  let pesoTotal = 0;
  const faltantes: (keyof Ejes)[] = [];

  for (const { clave, peso, norma } of items) {
    pesoTotal += peso;
    const valor = ejes[clave];
    if (valor === null || valor === undefined) {
      faltantes.push(clave);
      continue;
    }
    pesoRespondido += peso;
    suma += peso * norma(valor as never);
  }

  return {
    valor: pesoRespondido === 0 ? null : Math.round((suma / pesoRespondido) * 100),
    cobertura: pesoTotal === 0 ? 0 : pesoRespondido / pesoTotal,
    faltantes,
  };
}

export type Analisis = {
  score: number | null;
  /** Cuánta de la información evaluable está respondida (0–1). */
  cobertura: number;
  criterios: Record<Criterio, Puntaje>;
  semaforo: Semaforo | null;
  fortalezas: string[];
  debilidades: string[];
  riesgos: string[];
  /** Frase de cierre: qué hacer con este proveedor. */
  veredicto: string;
  /** Preguntas que nadie hizo y que sí se pueden hacer por mensaje. */
  pendientes: { clave: keyof Ejes; texto: string }[];
  topadoPorBandera: boolean;
};

export type Semaforo = "bueno" | "regular" | "malo";

export function semaforo(score: number): Semaforo {
  if (score >= 70) return "bueno";
  if (score >= 40) return "regular";
  return "malo";
}

export const ETIQUETA_SEMAFORO: Record<Semaforo, string> = {
  bueno: "Buen candidato",
  regular: "Con reservas",
  malo: "Riesgoso",
};

export const COLOR_SEMAFORO: Record<Semaforo, string> = {
  bueno: "var(--color-success)",
  regular: "var(--color-warning)",
  malo: "var(--color-danger)",
};

export function analizar(p: Proveedor): Analisis {
  const criterios = {} as Record<Criterio, Puntaje>;
  let suma = 0;
  let pesoRespondido = 0;
  const pesoTotal = Object.values(CRITERIOS).reduce((t, c) => t + c.peso, 0);
  let coberturaPonderada = 0;

  for (const clave of Object.keys(CRITERIOS) as Criterio[]) {
    const puntaje = puntajeCriterio(p.ejes, clave);
    criterios[clave] = puntaje;
    coberturaPonderada += puntaje.cobertura * CRITERIOS[clave].peso;
    if (puntaje.valor !== null) {
      // El criterio pesa en proporción a lo que se sabe de él: un criterio con
      // una sola respuesta de cinco no puede arrastrar el puntaje global.
      const peso = CRITERIOS[clave].peso * puntaje.cobertura;
      suma += puntaje.valor * peso;
      pesoRespondido += peso;
    }
  }

  const criticas = p.banderas.filter((b) => BANDERAS_CRITICAS.includes(b));
  const leves = p.banderas.filter((b) => !BANDERAS_CRITICAS.includes(b));

  let score: number | null = null;
  if (pesoRespondido > 0) {
    score = suma / pesoRespondido - leves.length * CASTIGO_BANDERA;
    if (criticas.length > 0) score = Math.min(score, TOPE_CRITICO);
    score = Math.round(Math.min(Math.max(score, 0), 100));
  } else if (criticas.length > 0) {
    // Sin una sola respuesta no hay puntaje… salvo que ya haya una bandera
    // crítica: eso solo no necesita más información para ser un problema.
    score = TOPE_CRITICO;
  }

  const { fortalezas, debilidades } = leerCriterios(criterios);
  const riesgos = leerRiesgos(p, criterios);
  const cobertura = coberturaPonderada / pesoTotal;

  return {
    score,
    cobertura,
    criterios,
    semaforo: score === null ? null : semaforo(score),
    fortalezas,
    debilidades,
    riesgos,
    veredicto: redactarVeredicto(score, cobertura, riesgos.length, p),
    pendientes: preguntasPendientes(p),
    topadoPorBandera: criticas.length > 0,
  };
}

const UMBRAL_FUERTE = 75;
const UMBRAL_DEBIL = 45;
/** Por debajo de esto el criterio se sabe demasiado poco como para opinar. */
const COBERTURA_MINIMA = 0.4;

function leerCriterios(criterios: Record<Criterio, Puntaje>) {
  const fortalezas: string[] = [];
  const debilidades: string[] = [];

  for (const clave of Object.keys(CRITERIOS) as Criterio[]) {
    const { valor, cobertura } = criterios[clave];
    if (valor === null || cobertura < COBERTURA_MINIMA) continue;
    const nombre = CRITERIOS[clave].nombre.toLowerCase();
    if (valor >= UMBRAL_FUERTE) fortalezas.push(`${nombre} (${valor}/100)`);
    else if (valor <= UMBRAL_DEBIL) debilidades.push(`${nombre} (${valor}/100)`);
  }

  return { fortalezas, debilidades };
}

/** Riesgos concretos, no puntajes: cosas que costarían dinero o un problema legal. */
function leerRiesgos(p: Proveedor, criterios: Record<Criterio, Puntaje>): string[] {
  const r: string[] = [];
  const e = p.ejes;

  if (p.banderas.includes("falsificaciones")) {
    r.push("Vende falsificaciones de marca: riesgo legal, no solo comercial.");
  }
  if (p.banderas.includes("precios_inconsistentes")) {
    r.push("Los precios cambian según a quién se le pregunte.");
  }
  if (e.da_factura === false) {
    r.push("No factura: la compra no se puede deducir ni comprobar.");
  }
  if (e.permisos_sanitarios === false) {
    r.push("Sin permisos sanitarios: problema para importar o revender formalmente.");
  }
  if (e.consistencia_lotes !== null && e.consistencia_lotes <= 2) {
    r.push("El aroma varía entre lotes: devoluciones y clientes que no repiten.");
  }
  if (e.acepta_devoluciones === false) {
    r.push("No acepta devoluciones: el producto defectuoso lo absorbes tú.");
  }
  if (e.local_fisico === false) {
    r.push("Sin local verificable: difícil reclamar si algo sale mal.");
  }
  if (e.entrega_muestras === false) {
    r.push("No da muestras: habría que comprar a ciegas.");
  }
  if (e.dias_entrega !== null && e.dias_entrega > 30) {
    r.push(`Entrega en ${e.dias_entrega} días: demasiado para reponer inventario.`);
  }
  if (criterios.calidad.cobertura < COBERTURA_MINIMA) {
    r.push("Apenas se evaluó la calidad del producto: el puntaje no la respalda.");
  }
  return r;
}

function redactarVeredicto(
  score: number | null,
  cobertura: number,
  riesgos: number,
  p: Proveedor,
): string {
  if (score === null) {
    return "Todavía no hay nada evaluado. Con responder el paso de evaluación ya se puede comparar contra los demás.";
  }

  const nombre = p.nombre || "Este proveedor";

  // Con muy poca información, cualquier veredicto sobre el proveedor sería en
  // realidad un veredicto sobre lo poco que se preguntó. Más vale decir eso.
  if (cobertura < 0.35) {
    return `Con el ${Math.round(cobertura * 100)}% de la ficha respondida no alcanza para juzgar a ${nombre}: el ${score} de arriba sale de un puñado de respuestas y puede moverse en cualquier dirección. Manda las preguntas pendientes antes de decidir nada.`;
  }

  const info =
    cobertura < 0.7
        ? ` Está respaldado por el ${Math.round(cobertura * 100)}% de la ficha.`
        : ` Está respaldado por el ${Math.round(cobertura * 100)}% de la ficha, que ya es información suficiente para decidir.`;

  if (score >= 70) {
    return `${nombre} sale bien parado: es de los que conviene llevar a negociación y pedirle cotización formal.${info}`;
  }
  if (score >= 40) {
    return riesgos > 0
      ? `${nombre} podría funcionar, pero arrastra ${riesgos === 1 ? "un pendiente" : `${riesgos} pendientes`} que hay que resolver antes de comprometer dinero.${info}`
      : `${nombre} está en zona intermedia: sirve como respaldo, no como proveedor principal.${info}`;
  }
  return `${nombre} no da el ancho con lo que se sabe hoy. Solo vale la pena volver si baja mucho el precio o resuelve lo señalado arriba.${info}`;
}

/** Lo que quedó sin preguntar y todavía se puede preguntar por mensaje. */
export function preguntasPendientes(p: Proveedor) {
  const pendientes: { clave: keyof Ejes; texto: string }[] = [];
  for (const clave of Object.keys(PREGUNTAS) as (keyof Ejes)[]) {
    const pregunta = PREGUNTAS[clave];
    if (pregunta.observable) continue;
    if (p.ejes[clave] === null || p.ejes[clave] === undefined) {
      pendientes.push({ clave, texto: pregunta.texto });
    }
  }
  return pendientes;
}

/** Datos de la ficha (no ejes) que siguen vacíos y se pueden preguntar. */
export function huecosDeFicha(p: Proveedor): string[] {
  const vacio = (v: unknown) => typeof v !== "string" || v.trim() === "";
  return PREGUNTAS_FICHA.filter(({ campo }) => {
    // Los campos compuestos no se pueden mirar con `trim`: cada uno sabe por su
    // cuenta cuándo está vacío.
    if (campo === "precios") return !p.precios.some((x) => x.precio !== null);
    if (campo === "promociones") return p.promociones.length === 0;
    if (campo === "horario") {
      const h = p.horario;
      return !h || (!h.dias && !h.abre && !h.cierra && vacio(h.nota));
    }
    return vacio((p as unknown as Record<string, unknown>)[campo]);
  }).map((q) => q.texto);
}

/** Mensaje de seguimiento con las preguntas que faltan, listo para WhatsApp. */
export function mensajeSeguimiento(p: Proveedor): string {
  const preguntas = [
    ...preguntasPendientes(p).map((q) => q.texto),
    ...huecosDeFicha(p),
  ];
  const saludo = p.contactoNombre ? `Hola ${p.contactoNombre}` : "Hola";
  const cuerpo = preguntas.map((q, i) => `${i + 1}. ${q}`).join("\n");
  return `${saludo}, le escribo de EL REY DE LOS PERFUMES. Estuvimos en su local y nos quedaron algunas dudas para poder avanzar con la cotización:\n\n${cuerpo}\n\nGracias.`;
}

// ── Precios ─────────────────────────────────────────────────────────────────

/**
 * Costo por ml normalizado — la única forma real de comparar proveedores que
 * venden en presentaciones distintas.
 */
export function costoPorMl(precio: Precio): number | null {
  if (precio.precio === null || precio.precio <= 0) return null;
  const ml = PRESENTACIONES.find((p) => p.valor === precio.presentacion)?.ml;
  if (!ml) return null;
  return precio.precio / ml;
}

/** El costo por ml más bajo del proveedor, para ordenar y comparar. */
export function mejorCostoPorMl(precios: Precio[]): number | null {
  const costos = precios.map(costoPorMl).filter((c): c is number => c !== null);
  return costos.length ? Math.min(...costos) : null;
}

/** Qué tan llena está la ficha, contando lo esencial de cada bloque. */
export function completitud(p: Proveedor): number {
  const checks = [
    p.nombre.trim() !== "",
    p.telefono.trim() !== "" || p.whatsapp.trim() !== "",
    p.tipo !== null,
    p.lat !== null,
    p.tiposProducto.length > 0,
    p.precios.some((pr) => pr.precio !== null),
    p.decision !== null,
    Object.values(p.ejes).filter((v) => v !== null).length >= 10,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// ── Promociones por volumen ─────────────────────────────────────────────────

/**
 * Precio efectivo por pieza al aplicar una promoción sobre el precio de lista.
 *
 * Es el número que decide una compra de mayoreo. Un proveedor con el frasco a 45
 * y 3x2 sale a 30 por pieza: más barato que otro que lo da a 38 sin promoción.
 * Comparar precios de lista sin bajar esto a piezas es la forma más común de
 * elegir mal.
 *
 * Devuelve `null` cuando la promoción no mueve el precio unitario (envío gratis)
 * o no está completa: no inventamos un número a partir de datos incompletos.
 */
export function precioConPromocion(base: number, promo: Promocion): number | null {
  switch (promo.tipo) {
    case "descuento":
      return promo.valor === null ? null : base * (1 - promo.valor / 100);
    case "gratis": {
      // `desde` = piezas que se pagan, `valor` = piezas de regalo. Un 3x2 son
      // 2 pagadas y 1 gratis: el costo se reparte entre las tres que te llevas.
      if (promo.desde === null || promo.valor === null) return null;
      const pagadas = promo.desde;
      const total = promo.desde + promo.valor;
      if (pagadas <= 0 || total <= 0) return null;
      return (base * pagadas) / total;
    }
    case "precio_fijo":
      return promo.valor;
    default:
      return null;
  }
}

export type Escalon = {
  promocion: Promocion;
  /** Precio por pieza ya con la promoción aplicada. */
  efectivo: number | null;
  /** Cuánto se ahorra frente al precio de lista, en porcentaje. */
  ahorro: number | null;
};

/** La escalera completa sobre un precio base, ordenada por volumen. */
export function escalera(base: number, promociones: Promocion[]): Escalon[] {
  return [...promociones]
    .sort((a, b) => (a.desde ?? 0) - (b.desde ?? 0))
    .map((promocion) => {
      const efectivo = precioConPromocion(base, promocion);
      return {
        promocion,
        efectivo,
        ahorro: efectivo === null ? null : Math.round((1 - efectivo / base) * 100),
      };
    });
}

/** El precio de lista que se usa como referencia: el de 100 ml, o el que haya. */
export function precioReferencia(p: Proveedor): Precio | null {
  const conValor = p.precios.filter((x) => x.precio !== null);
  return conValor.find((x) => x.presentacion === "100ml") ?? conValor[0] ?? null;
}

/**
 * El mejor costo por ml del proveedor **incluyendo promociones**.
 *
 * Es la cifra con la que se comparan dos proveedores de verdad.
 */
export function mejorCostoPorMlConPromo(p: Proveedor): number | null {
  const base = mejorCostoPorMl(p.precios);
  if (base === null) return null;
  const efectivos = p.promociones
    .map((promo) => precioConPromocion(base, promo))
    .filter((v): v is number => v !== null && v > 0);
  return efectivos.length ? Math.min(base, ...efectivos) : base;
}
