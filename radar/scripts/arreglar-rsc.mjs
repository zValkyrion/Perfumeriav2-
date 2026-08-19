import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Duplica los payloads de navegación de Next con el nombre que el navegador pide.
 *
 * En la exportación estática, Next **escribe** el payload de cada ruta en una
 * carpeta —`captura/__next.captura/__PAGE__.txt`— pero el cliente lo **pide** con
 * puntos: `captura/__next.captura.__PAGE__.txt`. En S3 no existe esa clave, así
 * que CloudFront devolvía 403 en cada prefetch y la navegación entre pantallas
 * caía a recarga completa de página: más lento y, con roaming, datos tirados a la
 * basura en algo que ya estaba descargado.
 *
 * La copia es de unos pocos KB por ruta y deja las dos formas disponibles, así
 * que funciona sin importar cuál de las dos convenciones use la versión de Next
 * que haya instalada.
 *
 * Se ejecuta al final de `npm run build`.
 */
const RAIZ = "out";
let copiados = 0;

function recorrer(directorio) {
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (!statSync(ruta).isDirectory()) continue;

    if (entrada.startsWith("__next.")) {
      const pagina = join(ruta, "__PAGE__.txt");
      if (existsSync(pagina)) {
        const destino = join(directorio, `${entrada}.__PAGE__.txt`);
        copyFileSync(pagina, destino);
        copiados++;
        console.log(`· ${destino}`);
      }
    }
    recorrer(ruta);
  }
}

if (!existsSync(RAIZ)) {
  console.error(`No existe ${RAIZ}/. Corre "next build" antes.`);
  process.exit(1);
}

recorrer(RAIZ);
console.log(`payloads de navegación duplicados: ${copiados}`);
