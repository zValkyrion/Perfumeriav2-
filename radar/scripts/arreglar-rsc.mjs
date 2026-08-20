import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Duplica los payloads de navegación de Next con el nombre que el navegador pide.
 *
 * **Es un parche para compilaciones en Windows.** Ahí la exportación estática
 * escribe el payload de cada ruta dentro de una carpeta
 * —`captura/__next.captura/__PAGE__.txt`— mientras que el cliente lo pide con
 * puntos: `captura/__next.captura.__PAGE__.txt`. Esa clave no existía en S3, así
 * que CloudFront devolvía 403 en cada prefetch y la navegación entre pantallas
 * caía a recarga completa: más lenta y, con roaming, datos tirados a la basura en
 * algo ya descargado.
 *
 * En Linux —donde corre la CI— Next escribe directamente el nombre con puntos y
 * este script no encuentra nada que copiar: informa "0" y no hace nada. Por eso
 * se queda, pero también por eso conviene desplegar desde la CI y no desde una
 * laptop con Windows.
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
