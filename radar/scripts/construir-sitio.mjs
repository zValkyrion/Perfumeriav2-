import { cpSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

/**
 * Arma el sitio completo: la tienda en la raíz y la app de campo en `/radar`.
 *
 * Las dos son exportaciones estáticas independientes, pero se publican desde una
 * sola distribución de CloudFront para que compartan origen — y, el día que haya
 * dominio, para que compartan dominio sin mover nada más.
 *
 * La tienda se compila **sin** `PAGES=1`, así que sale para la raíz. El mismo
 * repositorio se sigue publicando en GitHub Pages con esa variable activada y su
 * `basePath`; son dos destinos con dos formas, del mismo código.
 */
const RAIZ = resolve(import.meta.dirname, "../..");
const RADAR = resolve(import.meta.dirname, "..");
const SALIDA = join(RADAR, "salida-sitio");

const correr = (comando, args, cwd) => {
  console.log(`\n▸ ${comando} ${args.join(" ")}  (${cwd})`);
  execFileSync(comando, args, {
    cwd,
    stdio: "inherit",
    // En Windows, npm es un .cmd y no se ejecuta sin shell.
    shell: process.platform === "win32",
  });
};

rmSync(SALIDA, { recursive: true, force: true });

// 1. La tienda, para la raíz del dominio.
correr("npm", ["run", "build"], RAIZ);
if (!existsSync(join(RAIZ, "out"))) {
  throw new Error("La tienda no generó out/. Revisa su build.");
}
cpSync(join(RAIZ, "out"), SALIDA, { recursive: true });

// 2. La app de campo, que ya se compila con basePath /radar.
correr("npx", ["next", "build"], RADAR);
correr("node", ["scripts/arreglar-rsc.mjs"], RADAR);
if (!existsSync(join(RADAR, "out"))) {
  throw new Error("El radar no generó out/. Revisa su build.");
}
cpSync(join(RADAR, "out"), join(SALIDA, "radar"), { recursive: true });

console.log(`\n✓ Sitio armado en ${SALIDA}`);
console.log("  /        → tienda");
console.log("  /radar/  → app de campo");
