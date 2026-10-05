// `npm --prefix radar run probar:local`: empaqueta la Lambda y corre cada
// archivo de pruebas en su propio proceso (cada uno arranca sus falsas desde
// cero, así el orden no importa y un fallo no contamina al siguiente).
//
// Sin AWS: credenciales falsas y servicios en memoria. Corre igual en Windows
// y en Linux (la CI lo lanza antes de pedir credenciales a AWS).
import { spawn } from "node:child_process";
import { join } from "node:path";
import { empaquetar } from "./empaquetar.mjs";

const AQUI = import.meta.dirname;
const ARCHIVOS = ["probar-admin.mjs", "probar-tienda.mjs", "probar-equipo.mjs"];

await empaquetar();

let rojos = 0;
for (const archivo of ARCHIVOS) {
  console.log(`\n▸ ${archivo}`);
  const codigo = await new Promise((resolver) => {
    const hijo = spawn(process.execPath, [join(AQUI, archivo)], { stdio: "inherit", cwd: AQUI });
    hijo.on("close", resolver);
  });
  if (codigo !== 0) rojos++;
}

console.log(rojos === 0 ? "\nPRUEBAS LOCALES: TODO EN VERDE" : `\nPRUEBAS LOCALES: ${rojos} archivo(s) en rojo`);
process.exit(rojos === 0 ? 0 : 1);
