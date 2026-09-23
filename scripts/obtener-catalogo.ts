/**
 * Antes de cada build (`prebuild` y `predev`): de dónde sale el catálogo.
 *
 * - **Con API** (`NEXT_PUBLIC_API`, el despliegue a AWS): se pide
 *   `GET /catalogo` —lo que hay en DynamoDB— y se escribe sobre
 *   `src/data/catalogo.json`. La tienda publica la base de datos, no el
 *   archivo del repositorio.
 * - **Sin API, o si no contesta o viene vacía** (desarrollo, GitHub Pages, el
 *   primer despliegue antes de cargar la tabla): se queda la copia versionada.
 *   Un build nunca se cae por no poder hablar con la API.
 *
 * Si además no hay CDN de imágenes (`NEXT_PUBLIC_IMAGENES`), deja las fotos
 * procesadas en `public/imagenes/` para que se vean igual que en producción.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { Catalogo } from "../compartido/catalogo";
import { datosDeFoto, leerCatalogo } from "./catalogo/leer";

const raiz = process.cwd();
const JSON_LOCAL = join(raiz, "src", "data", "catalogo.json");
const IMAGENES_LOCALES = join(raiz, "public", "imagenes");

async function desdeApi(api: string): Promise<Catalogo | null> {
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${api.replace(/\/+$/, "")}/catalogo`, { signal: ctrl.signal });
    if (!res.ok) {
      console.log(`· GET /catalogo respondió ${res.status}: se usa la copia local.`);
      return null;
    }
    const c = (await res.json()) as Catalogo;
    if (c?.version !== 1 || !Array.isArray(c.productos) || c.productos.length === 0) {
      console.log("· La API todavía no tiene catálogo: se usa la copia local.");
      return null;
    }
    return c;
  } catch (e) {
    console.log(`· No se pudo leer la API (${e instanceof Error ? e.message : e}): se usa la copia local.`);
    return null;
  } finally {
    clearTimeout(corte);
  }
}

async function fotosLocales(catalogo: Catalogo) {
  const faltan = [...catalogo.productos, ...catalogo.sets]
    .flatMap((x) => x.imagenes)
    .filter((i) => !existsSync(join(IMAGENES_LOCALES, i.clave)));
  if (faltan.length === 0) return;

  const { fotos } = await leerCatalogo({ carpeta: join(raiz, "catalogo"), previo: catalogo });
  const porClave = new Map(fotos.map((f) => [f.clave, f]));
  let escritas = 0;
  for (const i of faltan) {
    const f = porClave.get(i.clave);
    if (!f) continue; // Una foto que solo existe en S3: sin CDN no hay de dónde sacarla.
    const destino = join(IMAGENES_LOCALES, i.clave);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, await datosDeFoto(f));
    escritas++;
  }
  console.log(`✓ ${escritas} foto(s) procesada(s) en public/imagenes/`);
}

async function main() {
  const api = process.env.NEXT_PUBLIC_API ?? "";
  let catalogo = JSON.parse(await readFile(JSON_LOCAL, "utf8")) as Catalogo;

  if (api) {
    const remoto = await desdeApi(api);
    if (remoto) {
      catalogo = remoto;
      await writeFile(JSON_LOCAL, JSON.stringify(remoto, null, 2) + "\n", "utf8");
      console.log(
        `✓ Catálogo de la API: ${remoto.productos.length} productos, ${remoto.sets.length} sets (${remoto.generado})`,
      );
    }
  } else {
    console.log("· Sin NEXT_PUBLIC_API: se usa la copia local del catálogo.");
  }

  if (!process.env.NEXT_PUBLIC_IMAGENES) await fotosLocales(catalogo);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
