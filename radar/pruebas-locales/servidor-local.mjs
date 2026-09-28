// La Lambda empaquetada detrás de un HTTP local (como API Gateway), sobre
// DynamoDB, S3 y Cognito falsos con el catálogo del repositorio y una tienda
// de muestra: para mirar el panel y la tienda en el navegador sin tocar AWS.
//
//   npm --prefix radar run servidor:local      → http://127.0.0.1:4700
//
// Todo vive en memoria: al cerrar se pierde, y al volver a abrir se siembra
// de nuevo igual. Instrucciones completas en LEEME.md.
import http from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { empaquetar, GENERADO } from "./empaquetar.mjs";
import { agregarUsuario, arrancar, entorno, sembrarCatalogo, tablas } from "./servicios-falsos.mjs";
import { sembrarDemo } from "./datos-prueba.mjs";

const PUERTO = Number(process.env.PUERTO ?? 4700);
const RAIZ = join(import.meta.dirname, "..", "..");
const catalogo = JSON.parse(readFileSync(join(RAIZ, "src", "data", "catalogo.json"), "utf8"));

await empaquetar();
await arrancar();
Object.assign(process.env, entorno);

sembrarCatalogo(catalogo);
const tabla = new Map();
tablas.set("Elrey_proveedores", tabla);
const puras = await import("./.generado/puras.mjs");
const { sesiones, pedidos } = sembrarDemo({ puras, catalogo, tabla, agregarUsuario });

const { handler } = await import("./.generado/api.mjs");

http
  .createServer((req, res) => {
    const trozos = [];
    req.on("data", (c) => trozos.push(c));
    req.on("end", async () => {
      const url = new URL(req.url, "http://local");
      const r = await handler({
        requestContext: { http: { method: req.method, path: url.pathname } },
        headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])),
        queryStringParameters: Object.fromEntries(url.searchParams),
        body: trozos.length ? Buffer.concat(trozos).toString("utf8") : null,
      });
      res.writeHead(r.statusCode, r.headers);
      res.end(r.isBase64Encoded ? Buffer.from(r.body, "base64") : r.body);
      console.log(req.method, url.pathname + url.search, r.statusCode);
    });
  })
  .listen(PUERTO, "127.0.0.1", () => {
    // Lo que hay que pegar en la consola del navegador para entrar como cada
    // quien. También queda en `.generado/sesiones.json` (no se versiona).
    const snippet = ({ token, nombre }) =>
      `localStorage.setItem("radar:token","${token}");localStorage.setItem("radar:vence","${Date.now() + 30 * 86_400_000}");localStorage.setItem("radar:evaluador",${JSON.stringify(nombre)});location.reload()`;
    const paraGuardar = Object.fromEntries(Object.entries(sesiones).map(([k, s]) => [k, { ...s, consola: snippet(s) }]));
    writeFileSync(join(GENERADO, "sesiones.json"), JSON.stringify(paraGuardar, null, 2));

    console.log(`API local en http://127.0.0.1:${PUERTO}  (${pedidos} pedidos, 4 solicitudes y 5 cuentas de PRUEBA)`);
    console.log(`Sesiones de prueba en ${join(GENERADO, "sesiones.json")}. Para entrar, pega en la consola del navegador:`);
    for (const [quien, s] of Object.entries(paraGuardar)) console.log(`\n· ${quien}:\n${s.consola}`);
    console.log("");
  });
