/**
 * Pruebas del catálogo tal como se carga a DynamoDB.
 *
 *   npm run probar:catalogo
 *
 * Lee `catalogo/` con el mismo código que `catalogo:subir` y comprueba lo que,
 * si fallara, se notaría en caja: que lo oculto y lo agotado no se cobre, que
 * el catálogo público no filtre notas internas, que cada producto visible tenga
 * foto y que el viaje a la tabla y de vuelta no pierda nada. Corre en la CI
 * antes de desplegar.
 */
import { join } from "node:path";

import {
  catalogoPublico,
  fuenteDeCatalogo,
  presentacionBase,
  valorLote,
} from "../compartido/catalogo";
import { catalogoDeFilas, filasDe } from "../compartido/catalogo-tabla";
import { leerCatalogo, sinFecha } from "./catalogo/leer";

let fallos = 0;
function ok(nombre: string, cond: boolean, detalle = "") {
  console.log(`${cond ? "PASA " : "FALLA"}  ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
}

async function main() {
  const { catalogo: c, problemas, avisos } = await leerCatalogo({
    carpeta: join(process.cwd(), "catalogo"),
  });

  ok("el CSV se lee sin problemas", problemas.length === 0, problemas.slice(0, 3).map((p) => `${p.archivo}:${p.fila} ${p.columna}`).join("; "));
  ok("sin avisos (fotos que falten, modelos agotados en lotes)", avisos.length === 0, avisos.slice(0, 3).join("; "));

  const visibles = c.productos.filter((p) => p.visible);
  ok("hay productos publicados", visibles.length > 0, `${visibles.length}`);
  ok("cada producto visible tiene foto", visibles.every((p) => p.imagenes.length > 0));
  ok("cada producto tiene al menos una presentación con precio", c.productos.every((p) => p.presentaciones.length > 0 && p.presentaciones.every((v) => v.precio > 0)));
  ok("códigos únicos", new Set(c.productos.map((p) => p.codigo)).size === c.productos.length);
  ok("slugs únicos entre productos y sets", new Set([...c.productos, ...c.sets].map((x) => x.slug)).size === c.productos.length + c.sets.length);

  const marcas = new Set(c.marcas.map((m) => m.slug));
  ok("toda marca citada existe", c.productos.every((p) => marcas.has(p.marca)));

  // ── Lo que se cobra ─────────────────────────────────────────────────────
  const fuente = fuenteDeCatalogo(c);
  const vendible = visibles.find((p) => !p.agotado)!;
  const base = presentacionBase(vendible);
  ok(`un producto disponible se cobra a su precio (${vendible.codigo})`, fuente.producto(vendible.codigo, base.ml)?.precio === base.precio);

  const agotado = c.productos.find((p) => p.visible && p.agotado);
  ok(`un agotado no se cobra (${agotado?.codigo})`, !!agotado && fuente.producto(agotado.codigo, 100) === undefined);

  const oculto = c.productos.find((p) => !p.visible);
  ok(`un oculto no se cobra (${oculto?.codigo})`, !!oculto && fuente.producto(oculto.codigo, 100) === undefined);

  const setAgotado = c.sets.find((s) => s.visible && s.agotado);
  ok("un set agotado no se cobra", !setAgotado || fuente.paquete(setAgotado.slug) === undefined);

  const porCodigo = new Map(c.productos.map((p) => [p.codigo, p]));
  for (const l of c.lotes) {
    ok(`el lote ${l.slug} vale más a precio de lista que su precio`, valorLote(l, porCodigo) > l.precio, `${valorLote(l, porCodigo)} contra ${l.precio}`);
  }

  // ── Lo que se publica ───────────────────────────────────────────────────
  const publico = catalogoPublico(c);
  ok("el catálogo público no trae ocultos", publico.productos.every((p) => p.visible) && publico.sets.every((s) => s.visible));
  ok("ni notas internas", [...publico.productos, ...publico.sets].every((x) => !("nota" in x)));

  // ── Ida y vuelta por la tabla ───────────────────────────────────────────
  const vuelta = catalogoDeFilas(filasDe(c), c.generado);
  const ordenar = (x: ReturnType<typeof sinFecha>) => ({
    ...x,
    productos: [...x.productos].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    marcas: [...x.marcas].sort((a, b) => a.slug.localeCompare(b.slug)),
    sets: [...x.sets].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    lotes: [...x.lotes].sort((a, b) => a.slug.localeCompare(b.slug)),
  });
  ok("guardar en la tabla y leer de vuelta no pierde nada", JSON.stringify(ordenar(sinFecha(vuelta))) === JSON.stringify(ordenar(sinFecha(c))));

  console.log(`\n${fallos === 0 ? "TODO EN VERDE" : `${fallos} PRUEBAS FALLARON`}`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
