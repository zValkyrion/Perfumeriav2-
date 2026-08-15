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
import { statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const publico = join(process.cwd(), "public");

/** Calidad alta: los banners llevan texto y el WebP agresivo lo ensucia. */
const CALIDAD = 86;

const BANNERS = ["hero-promo-3x2.png", "paca-100-piezas.jpg"];

async function main() {
  for (const archivo of BANNERS) {
    const origen = join(publico, archivo);
    const destino = origen.replace(/\.(png|jpg|jpeg)$/i, ".webp");

    const entrada = await readFile(origen);
    const salida = await sharp(entrada).webp({ quality: CALIDAD }).toBuffer();
    await writeFile(destino, salida);

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
