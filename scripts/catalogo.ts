/**
 * El catálogo en local.
 *
 *   npm run catalogo            catalogo/*.csv + fotos  →  src/data/catalogo.json
 *   npm run catalogo:exportar   src/data/catalogo.json  →  catalogo/*.csv
 *
 * La fuente de verdad en producción es DynamoDB (`Elrey_catalogo`): la edita el
 * panel y le llegan los cambios de estos CSV con `npm run catalogo:subir` en
 * cada despliegue. Lo que genera este script es la **copia local**: la que usa
 * `npm run dev`, la copia de GitHub Pages y el build cuando la API todavía no
 * tiene catálogo. Por eso se versiona.
 *
 * Además deja las fotos procesadas en `public/imagenes/` (fuera de git) para
 * que en desarrollo se vean igual que en producción, donde las sirve CloudFront.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { Catalogo } from "../compartido/catalogo";
import { ARCHIVOS_CSV, escribirCSV, filasCsv } from "../compartido/catalogo-csv";
import { datosDeFoto, leerCatalogo, sinFecha } from "./catalogo/leer";

const raiz = process.cwd();
const CARPETA = join(raiz, "catalogo");
const JSON_LOCAL = join(raiz, "src", "data", "catalogo.json");
const IMAGENES_LOCALES = join(raiz, "public", "imagenes");

async function leerJsonLocal(): Promise<Catalogo | undefined> {
  if (!existsSync(JSON_LOCAL)) return undefined;
  return JSON.parse(await readFile(JSON_LOCAL, "utf8")) as Catalogo;
}

async function importar() {
  const previo = await leerJsonLocal();
  const { catalogo, fotos, problemas, avisos } = await leerCatalogo({
    carpeta: CARPETA,
    previo,
  });

  for (const a of avisos) console.log(`· ${a}`);

  if (problemas.length > 0) {
    console.error(`\n✗ ${problemas.length} problema(s). No se escribió nada.\n`);
    for (const p of problemas.slice(0, 40)) {
      console.error(`  ${p.archivo} fila ${p.fila} · ${p.columna}: ${p.mensaje}`);
    }
    if (problemas.length > 40) console.error(`  … y ${problemas.length - 40} más.`);
    console.error("\nCorrige el CSV y vuelve a ejecutar. No se escribe un catálogo a medias:");
    console.error("medio catálogo cargado es peor que ninguno, porque parece que funcionó.");
    process.exit(1);
  }

  // Si el contenido no cambió se conserva la fecha anterior: regenerar sin
  // cambios no debe ensuciar el historial de git con un archivo distinto.
  const igual =
    previo && JSON.stringify(sinFecha(previo)) === JSON.stringify(sinFecha(catalogo));
  const final: Catalogo = igual ? { ...catalogo, generado: previo.generado } : catalogo;
  await writeFile(JSON_LOCAL, JSON.stringify(final, null, 2) + "\n", "utf8");

  let escritas = 0;
  for (const f of fotos) {
    const destino = join(IMAGENES_LOCALES, f.clave);
    if (existsSync(destino)) continue;
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, await datosDeFoto(f));
    escritas++;
  }

  const visibles = catalogo.productos.filter((p) => p.visible).length;
  console.log(
    `✓ ${catalogo.productos.length} productos (${visibles} visibles), ${catalogo.sets.length} sets, ` +
      `${catalogo.lotes.length} lotes y ${catalogo.marcas.length} marcas → src/data/catalogo.json` +
      (igual ? " (sin cambios)" : ""),
  );
  console.log(`✓ ${escritas} foto(s) nueva(s) en public/imagenes/ (${fotos.length} en total)`);
  console.log("\nComprueba que compila:  npm run build");
}

/* ── Exportar: la copia local de vuelta a CSV ─────────────────────────── */

async function exportar() {
  const c = await leerJsonLocal();
  if (!c) {
    console.error("No existe src/data/catalogo.json. Genéralo con:  npm run catalogo");
    process.exit(1);
  }
  await mkdir(CARPETA, { recursive: true });
  for (const archivo of ARCHIVOS_CSV) {
    await writeFile(join(CARPETA, `${archivo}.csv`), escribirCSV(filasCsv(c, archivo)), "utf8");
  }
  console.log(
    `✓ ${c.productos.length} productos, ${c.marcas.length} marcas, ${c.sets.length} sets y ${c.lotes.length} lotes → catalogo/*.csv`,
  );
}

// Envuelto en una función y no con `await` de primer nivel: los scripts de este
// repositorio se transpilan a CommonJS, donde eso no existe.
const modo = process.argv[2];
(modo === "exportar" ? exportar() : importar()).catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
