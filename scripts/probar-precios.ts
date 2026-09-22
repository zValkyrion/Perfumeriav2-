/**
 * Pruebas de `compartido/cotizacion.ts` contra las reglas del catálogo en PDF.
 *
 *   npm run probar:precios
 *
 * Casi todo usa un catálogo inventado de tres artículos: lo que se prueba es la
 * aritmética de las reglas, y un cambio de precio no debe poner en rojo una
 * prueba que no tiene nada que ver con él. Al final, dos pruebas con el catálogo
 * real comprueban que la fuente que comparten el carrito y la Lambda está bien
 * conectada, sin fijar ninguna cifra.
 */
import { cotizar, type FuentePrecios, type ItemPedido } from "../compartido/cotizacion";
import { escalonPara } from "../compartido/reglas";
import { FUENTE_TIENDA } from "../src/data/fuente-precios";
import { LOTES } from "../src/data/lotes";
import { PRODUCTOS } from "../src/data/productos";

const FUENTE: FuentePrecios = {
  producto(id, ml) {
    if (id === "yara" && ml === 100) return { precio: 569, mayoreo: true, promo3x2: false };
    if (id === "limitado" && ml === 100) return { precio: 1000, mayoreo: false, promo3x2: false };
    return undefined;
  },
  paquete(id) {
    if (id === "lote-10") return { precio: 4299, referencia: 5690, piezas: 10 };
    return undefined;
  },
};

const yara = (cantidad: number): ItemPedido => ({ productoId: "yara", ml: 100, cantidad });

let fallos = 0;
function igual(nombre: string, obtenido: unknown, esperado: unknown) {
  const pasa = JSON.stringify(obtenido) === JSON.stringify(esperado);
  console.log(`${pasa ? "PASA " : "FALLA"}  ${nombre}${pasa ? "" : ` — esperaba ${JSON.stringify(esperado)}, salió ${JSON.stringify(obtenido)}`}`);
  if (!pasa) fallos++;
}

// ── Escalera del PDF ────────────────────────────────────────────────────────
igual("1–2 piezas no tienen descuento", [escalonPara(1).descuento, escalonPara(2).descuento], [0, 0]);
igual("3–9 piezas: 10%", [escalonPara(3).descuento, escalonPara(9).descuento], [0.1, 0.1]);
igual("10–19 piezas: 20%", [escalonPara(10).descuento, escalonPara(19).descuento], [0.2, 0.2]);
igual("20 o más: 30%", [escalonPara(20).descuento, escalonPara(500).descuento], [0.3, 0.3]);

// ── Menudeo y envío ─────────────────────────────────────────────────────────
const una = cotizar([yara(1)], FUENTE);
igual("una pieza paga lista más envío estándar", [una.subtotal, una.costoEnvio, una.total], [569, 149, 718]);

const tres = cotizar([yara(3)], FUENTE);
igual("tres piezas: 10% y envío gratis", [tres.lineas[0]!.unitario, tres.costoEnvio, tres.total], [512.1, 0, 1536.3]);

const expres = cotizar([yara(3)], FUENTE, { envio: "express" });
igual("el envío urgente se cobra aunque haya volumen", expres.costoEnvio, 180);

// ── Transferencia: se suma al volumen sobre el precio de lista ─────────────
const diez = cotizar([yara(10)], FUENTE, { metodo: "transferencia" });
igual("10 piezas por transferencia: 20% + 10% = 30%", diez.total, 3983);

const veinte = cotizar([yara(20)], FUENTE, { metodo: "transferencia" });
igual("20 piezas por transferencia: el máximo del 40%", [veinte.descuentoTransferencia, veinte.total], [1138, 6828]);
igual("…que es 569 × 20 × 0.6", veinte.total, Math.round(569 * 20 * 0.6 * 100) / 100);

const conTarjeta = cotizar([yara(20)], FUENTE, { metodo: "clip" });
igual("con tarjeta no hay descuento extra", [conTarjeta.descuentoTransferencia, conTarjeta.total], [0, 7966]);

// ── Tope del 40%: cede el cupón antes que la transferencia ─────────────────
const tope = cotizar([yara(20)], FUENTE, { metodo: "transferencia", cupon: "AURA10" });
igual("con el 40% alcanzado, el cupón ya no descuenta", [tope.descuentoCupon, tope.total], [0, 6828]);

const cuponSolo = cotizar([yara(3)], FUENTE, { cupon: "AURA10" });
igual("por debajo del tope el cupón sí aplica", cuponSolo.descuentoCupon, 153.63);

const cuponInventado = cotizar([yara(3)], FUENTE, { cupon: "GRATIS100" });
igual("un cupón que no existe no descuenta", [cuponInventado.cupon, cuponInventado.descuentoCupon], [null, 0]);

// ── Contra entrega ──────────────────────────────────────────────────────────
const contra = cotizar([yara(3)], FUENTE, { metodo: "contra" });
igual("contra entrega suma la comisión", [contra.metodo, contra.comision, contra.total], ["contra", 400, 1936.3]);

const contraGrande = cotizar([yara(30)], FUENTE, { metodo: "contra" });
igual("por encima del tope se cobra con Clip y sin comisión", [contraGrande.metodo, contraGrande.comision], ["clip", 0]);

// ── Lo que no entra a la escalera ───────────────────────────────────────────
const limitado = cotizar([{ productoId: "limitado", ml: 100, cantidad: 5 }], FUENTE);
igual("una edición limitada no baja de precio por volumen", limitado.subtotal, 5000);

const lote = cotizar([{ productoId: "lote-10", ml: 0, cantidad: 1 }, yara(1)], FUENTE, { metodo: "transferencia" });
igual("un lote no sube de escalón a los sueltos", lote.escalon.descuento, 0);
igual("pero sí da envío gratis", lote.costoEnvio, 0);
igual("y la transferencia descuenta sobre su precio", lote.descuentoTransferencia, Math.round((429.9 + 56.9) * 100) / 100);

// ── Lo que manda el navegador no se cree ────────────────────────────────────
const basura = cotizar(
  [yara(2), { productoId: "no-existe", ml: 100, cantidad: 50 }, { productoId: "yara", ml: 30, cantidad: 1 }],
  FUENTE,
);
igual("lo que no existe no cuenta piezas ni se cobra", [basura.piezasSueltas, basura.descartados.length], [2, 2]);
igual("vacío no cobra envío", cotizar([], FUENTE).total, 0);

// ── Con el catálogo real: la fuente que usan el carrito y la Lambda ─────────
const elegible = PRODUCTOS.find((p) => p.esMayoreoElegible)!;
const frasco = elegible.presentaciones[0]!;
const real = cotizar(
  [{ productoId: elegible.id, ml: frasco.ml, cantidad: 20 }],
  FUENTE_TIENDA,
  { metodo: "transferencia" },
);
igual(
  `catálogo real: 20 × ${elegible.slug} por transferencia = 60% de lista`,
  real.total,
  Math.round(frasco.precio * 20 * 0.6 * 100) / 100,
);

const loteReal = LOTES[0]!;
const conLote = cotizar([{ productoId: loteReal.slug, ml: 0, cantidad: 1 }], FUENTE_TIENDA);
igual(`catálogo real: el lote ${loteReal.slug} se cobra a su precio`, conLote.subtotal, loteReal.precio);

console.log(`\n${fallos === 0 ? "TODO EN VERDE" : `${fallos} PRUEBAS FALLARON`}`);
process.exit(fallos === 0 ? 0 : 1);
