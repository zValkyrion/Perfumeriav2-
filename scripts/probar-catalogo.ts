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
  disponibilidadDe,
  fuenteDeCatalogo,
  presentacionBase,
  valorLote,
  type ProductoCatalogo,
} from "../compartido/catalogo";
import {
  catalogoDeFilas,
  estable,
  filasDe,
  fusionar,
  iguales,
  planDeCarga,
  type FilaGuardada,
} from "../compartido/catalogo-tabla";
import {
  quienUsa,
  validarLote,
  validarMarca,
  validarProducto,
  validarSet,
} from "../compartido/validar-catalogo";
import { porQueNoPublicar } from "../compartido/publicacion";
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

  // ── Disponibilidad en vivo ──────────────────────────────────────────────
  // La tienda cobra con esto mientras no se vuelva a compilar: tiene que
  // cobrar exactamente lo mismo que el catálogo completo.
  const vivo = fuenteDeCatalogo(disponibilidadDe(c));
  const distintos = [
    ...c.productos.flatMap((p) =>
      p.presentaciones
        .filter((v) => JSON.stringify(vivo.producto(p.codigo, v.ml)) !== JSON.stringify(fuente.producto(p.codigo, v.ml)))
        .map(() => p.codigo),
    ),
    ...[...c.sets.map((s) => s.slug), ...c.lotes.map((l) => l.slug)].filter(
      (id) => JSON.stringify(vivo.paquete(id)) !== JSON.stringify(fuente.paquete(id)),
    ),
  ];
  ok("la disponibilidad cobra igual que el catálogo completo", distintos.length === 0, distintos.slice(0, 5).join(", "));
  const disp = disponibilidadDe(c);
  ok("la disponibilidad no trae ocultos", disp.productos.length === visibles.length && disp.sets.every((s) => c.sets.find((x) => x.slug === s.slug)?.visible));
  ok("y pesa una fracción del catálogo", JSON.stringify(disp).length < JSON.stringify(publico).length / 4, `${Math.round(JSON.stringify(disp).length / 1024)} KB`);

  // ── El panel acepta lo que ya hay ───────────────────────────────────────
  // El validador del panel y el lector del CSV son dos puertas a la misma
  // tabla: si el panel rechazara un producto que el CSV cargó, no se podría
  // editar ni para marcarlo agotado.
  const rechazos = [
    ...c.productos.flatMap((p) => { const v = validarProducto(p, c, p.codigo); return v.ok ? [] : [`${p.codigo}: ${v.errores[0]!.campo} ${v.errores[0]!.mensaje}`]; }),
    ...c.marcas.flatMap((m) => { const v = validarMarca(m, c, m.slug); return v.ok ? [] : [`${m.slug}: ${v.errores[0]!.campo}`]; }),
    ...c.sets.flatMap((s) => { const v = validarSet(s, c, s.codigo); return v.ok ? [] : [`${s.codigo}: ${v.errores[0]!.campo} ${v.errores[0]!.mensaje}`]; }),
    ...c.lotes.flatMap((l) => { const v = validarLote(l, c, l.slug); return v.ok ? [] : [`${l.slug}: ${v.errores[0]!.campo}`]; }),
  ];
  ok("el panel acepta todo lo que cargó el CSV", rechazos.length === 0, rechazos.slice(0, 3).join("; "));
  const mismos = c.productos.filter((p) => { const v = validarProducto(p, c, p.codigo); return v.ok && iguales(v.valor, p); });
  ok("y guardarlo sin tocar nada no lo cambia", mismos.length === c.productos.length, `${c.productos.length - mismos.length} cambiarían`);

  const yara = c.productos.find((p) => p.codigo === "0001")!;
  const malo = validarProducto(
    { ...yara, slug: c.productos[1]!.slug, marca: "no-existe", familia: "Dulce", presentaciones: [{ ml: 100, precio: 0 }], imagenes: [{ clave: "productos/0002/abcdefabcdef.webp", ancho: 600, alto: 800, blur: "data:image/webp;base64,AA==" }] },
    c,
    "0001",
  );
  const campos = malo.ok ? [] : malo.errores.map((e) => e.campo);
  ok("el panel rechaza slug ajeno, marca inexistente, familia inventada, precio cero y foto de otro", ["slug", "marca", "familia", "presentaciones", "imagenes"].every((x) => campos.includes(x)), campos.join(", "));
  const conExtra = validarProducto({ ...yara, extra: "no" }, c, "0001");
  ok("un campo que no es del contrato no entra a la tabla", conExtra.ok && !("extra" in conExtra.valor));
  const notaLarga = validarProducto({ ...yara, nota: "x".repeat(2000) }, c, "0001");
  ok("un texto fuera de medida se rechaza", !notaLarga.ok && notaLarga.errores[0]!.campo === "nota");
  const otroCodigo = validarProducto(yara, c, "0002");
  ok("el código del cuerpo tiene que ser el de la ruta", !otroCodigo.ok && otroCodigo.errores.some((e) => e.campo === "codigo"));
  const marcaUsada = c.productos[0]!.marca;
  ok("una marca con perfumes no se puede borrar", quienUsa("marca", marcaUsada, c).length > 0);
  const enLote = c.lotes[0]!.modelos[0]!;
  ok("un perfume que está en un lote tampoco", quienUsa("producto", enLote, c).length > 0);

  // ── Fusión del CSV con el panel ─────────────────────────────────────────
  ok("el orden de las claves no cambia la huella", estable({ a: 1, b: [{ y: 2, x: 1 }] }) === estable({ b: [{ x: 1, y: 2 }], a: 1 }));

  const original = { ...yara } as ProductoCatalogo;
  const panel = { ...original, agotado: true };
  const csv = { ...original, presentaciones: [{ ml: 100, precio: 999 }] };
  const f1 = fusionar(original, csv, panel);
  ok("el panel marca agotado y el CSV sube el precio: quedan los dos", f1.datos.agotado === true && f1.datos.presentaciones[0]!.precio === 999 && f1.conflictos.length === 0);
  const f2 = fusionar(original, { ...original, nombre: "Del CSV" }, { ...original, nombre: "Del panel" });
  ok("si los dos cambian el mismo campo gana el CSV y se avisa", f2.datos.nombre === "Del CSV" && f2.conflictos.join() === "nombre");
  const f3 = fusionar(original, { ...original, rebaja: undefined }, { ...original, rebaja: 0.2 });
  ok("un opcional que solo tocó el panel se conserva", f3.datos.rebaja === 0.2);

  const fila = (d: ProductoCatalogo, extra: Partial<FilaGuardada> = {}): FilaGuardada => ({ PK: "PRODUCTO", SK: d.codigo, datos: d, huella: "h", ...extra });
  const otro = c.productos.find((p) => p.codigo !== "0001")!;
  const deseadas = [{ PK: "PRODUCTO" as const, SK: yara.codigo, datos: yara }];
  const p1 = planDeCarga([fila(yara)], deseadas);
  ok("una fila de antes del panel solo se anota con su origen", p1.escribir.length === 1 && iguales(p1.escribir[0]!.datos, yara) && iguales(p1.escribir[0]!.fuente, yara));
  const p2 = planDeCarga([fila(panel, { fuente: original, editadoEn: "x" })], deseadas);
  ok("una fila editada en el panel y sin cambios en el CSV no se toca", p2.escribir.length === 0 && p2.respetadas.length === 1);
  const p3 = planDeCarga([fila(panel, { fuente: original, editadoEn: "x" })], [{ PK: "PRODUCTO", SK: yara.codigo, datos: csv }]);
  ok("…y si el CSV cambió otro campo, se fusiona", p3.escribir.length === 1 && (p3.escribir[0]!.datos as ProductoCatalogo).agotado === true && (p3.escribir[0]!.datos as ProductoCatalogo).presentaciones[0]!.precio === 999);
  const p4 = planDeCarga([fila(yara, { fuente: yara }), fila(otro, { editadoEn: "x" })], deseadas);
  ok("lo creado en el panel no se borra por no estar en el CSV", p4.borrar.length === 0);
  const p5 = planDeCarga([fila(yara, { fuente: yara }), fila(otro, { fuente: otro })], deseadas);
  ok("lo que vino del CSV y se quitó de él, sí", p5.borrar.length === 1 && p5.borrar[0]!.SK === otro.codigo);
  const p6 = planDeCarga([fila(yara, { fuente: yara, borrado: true, editadoEn: "x" })], deseadas);
  ok("lo borrado en el panel no resucita", p6.escribir.length === 0 && p6.borrar.length === 0);
  const vueltaSinBorrados = catalogoDeFilas([fila(yara, { borrado: true }), fila(otro)], "");
  ok("y no se publica", vueltaSinBorrados.productos.length === 1 && vueltaSinBorrados.productos[0]!.codigo === otro.codigo);

  // ── Publicación automática ──────────────────────────────────────────────
  const hora = (min: number) => new Date(Date.UTC(2026, 8, 23, 12, min)).toISOString();
  const a12y30 = Date.parse(hora(30));
  const corriendo = { estado: "en_curso" as const, resultado: null, iniciada: hora(25), url: "" };
  const fallida = { estado: "terminada" as const, resultado: "fallo" as const, iniciada: hora(12), url: "" };
  ok("al día: no publica", porQueNoPublicar({ generado: hora(0), publicado: hora(0) }, a12y30) !== null);
  ok("cambios de hace 5 min: espera a que terminen de editar", porQueNoPublicar({ generado: hora(25), publicado: hora(0) }, a12y30) === "siguen editando");
  ok("cambios de hace 20 min sin publicar: publica", porQueNoPublicar({ generado: hora(10), publicado: hora(0) }, a12y30) === null);
  ok("nunca publicado: publica", porQueNoPublicar({ generado: hora(10) }, a12y30) === null);
  ok("con un despliegue en marcha: espera", porQueNoPublicar({ generado: hora(10), publicado: hora(0) }, a12y30, corriendo) !== null);
  ok("ya pedida para estos cambios y falló: no reintenta sola", porQueNoPublicar({ generado: hora(10), publicado: hora(0), pedidaEn: hora(11) }, a12y30, fallida) === "ya se pidió para estos cambios");
  ok("cambios nuevos después de pedir: vuelve a pedir", porQueNoPublicar({ generado: hora(15), publicado: hora(0), pedidaEn: hora(11) }, a12y30, fallida) === null);

  console.log(`\n${fallos === 0 ? "TODO EN VERDE" : `${fallos} PRUEBAS FALLARON`}`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
