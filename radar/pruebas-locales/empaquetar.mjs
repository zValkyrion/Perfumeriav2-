// Empaqueta la Lambda (`servidor/api.ts`) y las funciones puras del servidor
// y de `compartido/` en `.generado/`, para que las pruebas locales las
// importen con Node sin TypeScript.
//
// esbuild vive en los node_modules de la raíz del repositorio (lo trae tsx);
// Node lo encuentra subiendo carpetas desde aquí. Los paquetes (`sst`,
// `@aws-sdk/*`) quedan fuera del paquete y se resuelven desde
// `radar/node_modules`, igual que en la Lambda. `aws-jwt-verify` se cambia por
// `jwt-falso.mjs`: un token de prueba es JSON en base64, no una firma de Cognito.
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const AQUI = import.meta.dirname;
export const GENERADO = join(AQUI, ".generado");
const SERVIDOR = join(AQUI, "..", "servidor");

const comun = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  logLevel: "warning",
};

export async function empaquetar() {
  await mkdir(GENERADO, { recursive: true });
  await Promise.all([
    build({
      ...comun,
      entryPoints: [join(SERVIDOR, "api.ts")],
      outfile: join(GENERADO, "api.mjs"),
      alias: { "aws-jwt-verify": join(AQUI, "jwt-falso.mjs") },
    }),
    // Lo que se prueba sin pasar por HTTP: las cuentas de ventas, el armado de
    // lo que ve cada quien y las reglas compartidas con la tienda.
    build({
      ...comun,
      stdin: {
        contents: [
          `export * from "../servidor/pedidos-formas.ts";`,
          `export * from "../servidor/ventas.ts";`,
          `export { cotizar } from "../../compartido/cotizacion.ts";`,
          `export { fuenteDeCatalogo } from "../../compartido/catalogo.ts";`,
          `export * from "../../compartido/pedido.ts";`,
          `export * from "../../compartido/niveles.ts";`,
          `export { ARCHIVOS_CSV, escribirCSV, filasCsv } from "../../compartido/catalogo-csv.ts";`,
        ].join("\n"),
        resolveDir: AQUI,
        sourcefile: "puras.ts",
        loader: "ts",
      },
      outfile: join(GENERADO, "puras.mjs"),
    }),
  ]);
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  await empaquetar();
  console.log(`Empaquetado en ${GENERADO}`);
}
