/**
 * Comprueba la capa de datos del carrito y los pedidos contra la tabla real.
 *
 * No pasa por HTTP ni por Cognito: importa `servidor/tienda.ts` y trabaja con un
 * `sub` inventado, para poder verificar el diseño de claves —y sobre todo que
 * las filas de usuario NO se cuelen en `GET /proveedores`— sin necesitar la
 * contraseña de una cuenta.
 *
 *   npm --prefix radar run probar-tienda
 *
 * Va en TypeScript y no en `.mjs` como los demás porque importa el módulo del
 * servidor tal cual: probar una copia en JavaScript sería probar otra cosa. Node
 * lo ejecuta directo quitando los tipos, y por eso el import lleva la extensión
 * `.ts` —Node no la adivina— y `tsconfig.json` tiene `allowImportingTsExtensions`.
 *
 * Necesita credenciales de AWS con acceso a la tabla. Crea filas bajo un `sub`
 * de prueba y las borra al terminar, así que se puede correr contra producción
 * sin dejar basura.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  guardarCarrito,
  guardarDirecciones,
  guardarPedido,
  leerCarrito,
  leerDirecciones,
  listarPedidos,
  sanearCarrito,
  sanearDirecciones,
  sanearPedido,
} from "../servidor/tienda.ts";

const TABLA = "Elrey_proveedores";
const SUB = `prueba-${Date.now()}`;
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }), {
  marshallOptions: { removeUndefinedValues: true },
});

let fallos = 0;
const ok = (nombre: string, cond: boolean, detalle = "") => {
  console.log(`${cond ? "PASA" : "FALLA"}  ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  if (!cond) fallos++;
};

// ── Saneado ─────────────────────────────────────────────────────────────────
const sucio = sanearCarrito({
  carrito: [
    { productoId: "praline", ml: 100, cantidad: 4 },
    { productoId: "lote-invierno", ml: 0, cantidad: 1 },   // paquete: ml 0 vale
    { productoId: "", ml: 50, cantidad: 1 },               // sin producto: fuera
    { productoId: "x", ml: 50, cantidad: 0 },              // cantidad 0: fuera
    { productoId: "y", ml: 50, cantidad: 1e9 },            // desbordado: fuera
    "basura",
  ],
  guardados: null,
  favoritos: ["a", "a", "b", 7],
  intruso: "no debería guardarse",
});
ok("el saneado conserva las líneas buenas", sucio.carrito.length === 2, JSON.stringify(sucio.carrito));
ok("conserva el paquete con ml 0", sucio.carrito.some((i) => i.ml === 0));
ok("los favoritos quedan sin duplicados", JSON.stringify(sucio.favoritos) === '["a","b"]');
ok("no arrastra campos ajenos", !("intruso" in sucio));

ok("un pedido sin folio se rechaza", sanearPedido({ total: 10 }) === null);
const pedidoSaneado = sanearPedido({ folio: "T-1", estatus: "inventado", total: -5, items: [] });
ok("un estatus desconocido cae a Pendiente", pedidoSaneado?.estatus === "Pendiente");
ok("un total negativo se guarda en cero", pedidoSaneado?.total === 0);

// ── Ida y vuelta contra DynamoDB ────────────────────────────────────────────
const vacio = await leerCarrito(dynamo, TABLA, SUB);
ok("un usuario nuevo no tiene carrito", vacio.carrito.length === 0);

await guardarCarrito(dynamo, TABLA, SUB, sucio);
const leido = await leerCarrito(dynamo, TABLA, SUB);
ok("el carrito vuelve como se guardó", leido.carrito.length === 2 && leido.favoritos.length === 2);
ok("trae su fecha de actualización", leido.actualizadoEn !== "");

await guardarPedido(dynamo, TABLA, SUB, sanearPedido({
  folio: "AUR-2026-00001", fecha: "2026-01-05", estatus: "Entregado", total: 1200, piezas: 3,
  items: [{ productoId: "praline", ml: 100, cantidad: 3 }],
})!);
await guardarPedido(dynamo, TABLA, SUB, sanearPedido({
  folio: "AUR-2026-00002", fecha: "2026-08-01", estatus: "Pendiente", total: 450, piezas: 1,
  items: [{ productoId: "nardo", ml: 50, cantidad: 1 }],
})!);
const pedidos = await listarPedidos(dynamo, TABLA, SUB);
ok("se listan los dos pedidos", pedidos.length === 2);
ok("del más reciente al más viejo", pedidos[0]?.folio === "AUR-2026-00002", pedidos.map((p) => p.folio).join(", "));

// ── Direcciones ─────────────────────────────────────────────────────────────
const dirSucias = sanearDirecciones({
  direcciones: [
    { id: "d1", alias: "Casa", calle: "Av. Insurgentes 233", cp: "37000", predeterminada: true },
    { id: "d2", alias: "Local", calle: "Centro 10", predeterminada: true }, // dos marcadas
    { alias: "sin id" },                                                    // fuera
    "basura",
  ],
});
ok("las direcciones sin id se descartan", dirSucias.length === 2, JSON.stringify(dirSucias.map((d) => d.id)));
ok(
  "solo queda una predeterminada, la primera",
  dirSucias.filter((d) => d.predeterminada).length === 1 && dirSucias[0]!.predeterminada,
);
ok("los campos que faltan quedan vacíos, no rotos", dirSucias[0]!.colonia === "" && dirSucias[0]!.ciudad === "");

const sinNinguna = sanearDirecciones([{ id: "x", alias: "Única" }]);
ok("si ninguna viene marcada, se marca la primera", sinNinguna[0]!.predeterminada === true);

ok("un usuario nuevo no tiene direcciones", (await leerDirecciones(dynamo, TABLA, SUB)).length === 0);
await guardarDirecciones(dynamo, TABLA, SUB, dirSucias);
const dirLeidas = await leerDirecciones(dynamo, TABLA, SUB);
ok("las direcciones vuelven como se guardaron", dirLeidas.length === 2 && dirLeidas[0]!.calle === "Av. Insurgentes 233");
ok("y conservan su predeterminada", dirLeidas.filter((d) => d.predeterminada).length === 1);

// ── Lo importante: no se mezclan con las fichas ─────────────────────────────
const porFecha = await dynamo.send(new QueryCommand({
  TableName: TABLA,
  IndexName: "porFecha",
  KeyConditionExpression: "GSI1PK = :p",
  ExpressionAttributeValues: { ":p": "PROVEEDORES" },
}));
const colados = (porFecha.Items ?? []).filter((i) => String(i.PK).startsWith("USER#"));
ok("las filas de usuario no salen en GET /proveedores", colados.length === 0, `${colados.length} coladas`);

// ── Limpieza ────────────────────────────────────────────────────────────────
const mios = await dynamo.send(new QueryCommand({
  TableName: TABLA,
  KeyConditionExpression: "PK = :pk",
  ExpressionAttributeValues: { ":pk": `USER#${SUB}` },
}));
for (const f of mios.Items ?? []) {
  await dynamo.send(new DeleteCommand({ TableName: TABLA, Key: { PK: f.PK, SK: f.SK } }));
}
const quedan = await dynamo.send(new QueryCommand({
  TableName: TABLA,
  KeyConditionExpression: "PK = :pk",
  ExpressionAttributeValues: { ":pk": `USER#${SUB}` },
}));
ok("no queda basura de la prueba", (quedan.Items ?? []).length === 0);

console.log(`\n${fallos === 0 ? "TODO EN VERDE" : `${fallos} PRUEBAS FALLARON`}`);
process.exit(fallos === 0 ? 0 : 1);
