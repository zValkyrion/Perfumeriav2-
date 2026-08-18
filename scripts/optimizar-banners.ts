/**
 * Optimizador de los banners de arte externo.
 *
 * `scripts/generar-imagenes.ts` produce el arte de producto desde SVG y ya sale
 * en WebP al tamaño correcto. Estos otros son archivos que llegaron de fuera
 * —el banner promocional, la foto de la paca— y venían en PNG y JPEG pesados.
 *
 * Importa porque el banner del hero es el elemento LCP de la home: con
 * `images.unoptimized` la exportación estática sirve el archivo tal cual, así
 * que lo que pese aquí es lo que pesa la métrica.
 *
 *   npm run banners
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const publico = join(process.cwd(), "public");

/** Calidad alta: los banners llevan texto y el WebP agresivo lo ensucia. */
const CALIDAD = 86;

/**
 * Arte que llega de fuera y hay que convertir a WebP.
 *
 * La lista es de candidatos, no de obligatorios: el que no esté se salta con un
 * aviso. Así se puede dejar aquí el nombre del arte definitivo antes de tenerlo
 * —`paca-50-piezas.jpg` sustituye al banner generado en cuanto exista— sin que
 * el script reviente por un archivo que todavía no llegó.
 */
const BANNERS: [origen: string, destino: string][] = [
  // El arte de la paca llega con el nombre con el que se descargó; el sitio lo
  // busca por el suyo. La correspondencia se declara aquí para no depender de
  // que alguien acierte a renombrar el archivo a mano.
  ["50piezas.png", "paca-50-piezas.webp"],
  ["hero-promo-3x2.png", "hero-promo-3x2.webp"],
];

async function main() {
  for (const [archivo, nombreDestino] of BANNERS) {
    const origen = join(publico, archivo);
    if (!existsSync(origen)) {
      console.log(`${archivo.padEnd(24)} — no está en public/, se salta`);
      continue;
    }

    const entrada = await readFile(origen);
    const salida = await sharp(entrada).webp({ quality: CALIDAD }).toBuffer();
    await writeFile(join(publico, nombreDestino), salida);

    const antes = Math.round(statSync(origen).size / 1024);
    const despues = Math.round(salida.length / 1024);
    const ahorro = Math.round((1 - salida.length / statSync(origen).size) * 100);
    console.log(
      `${archivo.padEnd(24)} ${antes} kB → ${despues} kB (-${ahorro}%)`,
    );
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
