// DynamoDB, S3 y Cognito falsos, en memoria, con lo que usan la Lambda y la
// carga del catálogo. No pretenden ser AWS: entienden justo las expresiones
// que aparecen en el código y **fallan en voz alta** con cualquier otra, para
// que un endpoint nuevo que use algo no simulado se note aquí y no pase como
// verde por accidente.
//
// Cada servidor escucha en un puerto libre que elige el sistema: se pueden
// correr las pruebas con `servidor-local.mjs` abierto al mismo tiempo.
import http from "node:http";
import { crc32 } from "node:zlib";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

export const tablas = new Map(); // nombre → Map("PK#SK" → item)
export const objetos = new Map(); // clave → { tipo, cache, tamaño }
export const cuenta = { escrituras: 0, borrados: 0, subidas: 0, transacciones: 0 };

/**
 * Tamaño de página de Query. DynamoDB corta a 1 MB; aquí se corta mucho antes
 * para que el código que pagina (`ExclusiveStartKey`) se ejercite con pocos
 * datos de prueba.
 */
export const ajustes = { paginaQuery: 25, loteBatchGet: 40 };

const tabla = (n) => (tablas.has(n) ? tablas.get(n) : tablas.set(n, new Map()).get(n));
const k = (i) => `${i.PK}#${i.SK}`;

/** Las claves de cada índice secundario de las tablas del proyecto. */
const INDICES = { porFecha: ["GSI1PK", "GSI1SK"] };

class ErrorDynamo extends Error {
  constructor(tipo, mensaje, extra = {}) {
    super(mensaje);
    this.tipo = tipo;
    this.extra = extra;
  }
}
const invalida = (m) => new ErrorDynamo("ValidationException", m);

/* ── Expresiones ──────────────────────────────────────────────────────────── */

/** Parte en el separador (regex) solo fuera de paréntesis. */
function partir(texto, separador) {
  const partes = [];
  let nivel = 0;
  let desde = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === "(") nivel++;
    else if (c === ")") nivel--;
    else if (nivel === 0) {
      const m = texto.slice(i).match(separador);
      if (m && m.index === 0) {
        partes.push(texto.slice(desde, i));
        i += m[0].length - 1;
        desde = i + 1;
      }
    }
  }
  partes.push(texto.slice(desde));
  return partes.map((p) => p.trim()).filter((p) => p !== "");
}

function camino(expr, nombres) {
  return expr
    .trim()
    .split(".")
    .map((p) => {
      p = p.trim();
      if (p.startsWith("#")) {
        if (!(p in nombres)) throw invalida(`Falta el nombre ${p} en ExpressionAttributeNames`);
        return nombres[p];
      }
      if (!/^[A-Za-z_][\w-]*$/.test(p)) throw invalida(`Ruta que el falso no entiende: ${expr}`);
      return p;
    });
}

function leer(item, ruta) {
  let x = item;
  for (const p of ruta) {
    if (x === null || typeof x !== "object") return undefined;
    x = x[p];
  }
  return x;
}

function escribir(item, ruta, valor) {
  let x = item;
  for (const p of ruta.slice(0, -1)) {
    // Como DynamoDB: no crea mapas intermedios; escribir en `a.b` sin `a` es un error.
    if (x[p] === null || typeof x[p] !== "object") {
      throw invalida("The document path provided in the update expression is invalid for update");
    }
    x = x[p];
  }
  x[ruta.at(-1)] = valor;
}

function quitar(item, ruta) {
  const padre = leer(item, ruta.slice(0, -1));
  if (padre && typeof padre === "object") delete padre[ruta.at(-1)];
}

function valorDe(token, valores) {
  const t = token.trim();
  if (!(t in valores)) throw invalida(`Falta el valor ${t} en ExpressionAttributeValues`);
  return valores[t];
}

const igual = (a, b) => a !== undefined && JSON.stringify(a) === JSON.stringify(b);
function comparar(a, op, b) {
  if (op === "=") return igual(a, b);
  if (op === "<>") return !igual(a, b);
  if (a === undefined || typeof a !== typeof b) return false;
  if (op === "<") return a < b;
  if (op === "<=") return a <= b;
  if (op === ">") return a > b;
  if (op === ">=") return a >= b;
  throw invalida(`Operador desconocido ${op}`);
}

/** Una condición atómica sobre el item (que puede no existir). */
function atomo(expr, item, nombres, valores) {
  let m = expr.match(/^\((.*)\)$/s);
  if (m) return condicion(m[1], item, nombres, valores);
  m = expr.match(/^NOT\s+(.*)$/s);
  if (m) return !atomo(m[1].trim(), item, nombres, valores);
  m = expr.match(/^attribute_not_exists\(([^)]+)\)$/);
  if (m) return !item || leer(item, camino(m[1], nombres)) === undefined;
  m = expr.match(/^attribute_exists\(([^)]+)\)$/);
  if (m) return Boolean(item) && leer(item, camino(m[1], nombres)) !== undefined;
  m = expr.match(/^begins_with\(([^,]+),\s*(:\w+)\)$/);
  if (m) {
    const v = item ? leer(item, camino(m[1], nombres)) : undefined;
    return typeof v === "string" && v.startsWith(valorDe(m[2], valores));
  }
  m = expr.match(/^([#\w.-]+)\s+BETWEEN\s+(:\w+)\s+AND\s+(:\w+)$/);
  if (m) {
    const v = item ? leer(item, camino(m[1], nombres)) : undefined;
    return comparar(v, ">=", valorDe(m[2], valores)) && comparar(v, "<=", valorDe(m[3], valores));
  }
  m = expr.match(/^([#\w.-]+)\s*(=|<>|<=|>=|<|>)\s*(:\w+)$/);
  if (m) {
    const v = item ? leer(item, camino(m[1], nombres)) : undefined;
    return comparar(v, m[2], valorDe(m[3], valores));
  }
  throw invalida(`Condición que el falso no entiende: ${expr}`);
}

/** OR de AND de átomos (con paréntesis). `BETWEEN :a AND :b` no parte el AND. */
function condicion(expr, item, nombres = {}, valores = {}) {
  if (!expr) return true;
  return partir(expr, /^\s+OR\s+/).some((o) => {
    const ands = partir(o, /^\s+AND\s+/);
    const atomos = [];
    for (const a of ands) {
      const previo = atomos.at(-1);
      if (previo && /\sBETWEEN\s+:\w+$/.test(previo)) atomos[atomos.length - 1] = `${previo} AND ${a}`;
      else atomos.push(a);
    }
    return atomos.every((a) => atomo(a, item, nombres, valores));
  });
}

/** Un operando del lado derecho de un SET, evaluado sobre el item de antes. */
function operando(expr, previo, nombres, valores) {
  const t = expr.trim();
  let m = t.match(/^if_not_exists\((.*)\)$/s);
  if (m) {
    const [ruta, respaldo] = partir(m[1], /^,/);
    const actual = previo ? leer(previo, camino(ruta, nombres)) : undefined;
    return actual !== undefined ? actual : operando(respaldo, previo, nombres, valores);
  }
  m = t.match(/^list_append\((.*)\)$/s);
  if (m) {
    const [a, b] = partir(m[1], /^,/).map((x) => operando(x, previo, nombres, valores));
    if (!Array.isArray(a) || !Array.isArray(b)) throw invalida("list_append con algo que no es lista");
    return [...a, ...b];
  }
  const suma = partir(t, /^\s*[+-]\s*/);
  if (suma.length === 2) {
    const signo = t.slice(t.indexOf(suma[0]) + suma[0].length).trim()[0];
    const [a, b] = suma.map((x) => operando(x, previo, nombres, valores));
    if (typeof a !== "number" || typeof b !== "number") throw invalida("Suma de algo que no es número");
    return signo === "+" ? a + b : a - b;
  }
  if (t.startsWith(":")) return structuredClone(valorDe(t, valores));
  return structuredClone(previo ? leer(previo, camino(t, nombres)) : undefined);
}

function actualizar(previo, clave, expr, nombres, valores) {
  const item = structuredClone(previo ?? clave);
  const partes = expr.split(/\b(SET|REMOVE|ADD|DELETE)\b/).map((x) => x.trim()).filter(Boolean);
  for (let i = 0; i < partes.length; i += 2) {
    const [accion, cuerpo] = [partes[i], partes[i + 1] ?? ""];
    for (const a of partir(cuerpo, /^,/)) {
      if (accion === "SET") {
        const j = a.indexOf("=");
        escribir(item, camino(a.slice(0, j), nombres), operando(a.slice(j + 1), previo, nombres, valores));
      } else if (accion === "REMOVE") {
        quitar(item, camino(a, nombres));
      } else if (accion === "ADD") {
        const [ruta, v] = a.split(/\s+/);
        const r = camino(ruta, nombres);
        escribir(item, r, (leer(item, r) ?? 0) + valorDe(v, valores));
      } else {
        throw invalida(`Acción que el falso no entiende: ${accion}`);
      }
    }
  }
  return item;
}

/* ── Operaciones ──────────────────────────────────────────────────────────── */

const salida = (item) => (item ? marshall(item, { removeUndefinedValues: true, convertClassInstanceToMap: true }) : undefined);
const nombresDe = (d) => d.ExpressionAttributeNames ?? {};
const valoresDe = (d) => (d.ExpressionAttributeValues ? unmarshall(d.ExpressionAttributeValues) : {});

function ordenar(a, b) {
  if (a === b) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  return a < b ? -1 : 1;
}

function query(d) {
  const t = tabla(d.TableName);
  const nombres = nombresDe(d);
  const valores = valoresDe(d);
  const [hash, rango] = d.IndexName ? INDICES[d.IndexName] ?? [] : ["PK", "SK"];
  if (!hash) throw invalida(`Índice desconocido: ${d.IndexName}`);
  const usados = (d.KeyConditionExpression ?? "").replace(/#\w+/g, (n) => nombres[n] ?? n);
  if (!new RegExp(`\\b${hash}\\s*=`).test(usados)) {
    throw invalida(`La KeyConditionExpression tiene que fijar ${hash} con =`);
  }

  let items = [...t.values()].filter(
    (i) => i[hash] !== undefined && condicion(d.KeyConditionExpression, i, nombres, valores),
  );
  items.sort((a, b) => ordenar(a[rango], b[rango]) || ordenar(a.PK, b.PK) || ordenar(a.SK, b.SK));
  if (d.ScanIndexForward === false) items.reverse();

  if (d.ExclusiveStartKey) {
    const inicio = unmarshall(d.ExclusiveStartKey);
    const j = items.findIndex((i) => i.PK === inicio.PK && i.SK === inicio.SK);
    items = j === -1 ? [] : items.slice(j + 1);
  }
  const tope = Math.min(d.Limit ?? Infinity, ajustes.paginaQuery);
  const pagina = items.slice(0, tope);
  const hayMas = items.length > pagina.length;
  const filtrados = d.FilterExpression
    ? pagina.filter((i) => condicion(d.FilterExpression, i, nombres, valores))
    : pagina;
  const ultimo = pagina.at(-1);
  return {
    Items: filtrados.map(salida),
    Count: filtrados.length,
    ScannedCount: pagina.length,
    ...(hayMas && ultimo
      ? {
          LastEvaluatedKey: salida({
            PK: ultimo.PK,
            SK: ultimo.SK,
            ...(d.IndexName ? { [hash]: ultimo[hash], [rango]: ultimo[rango] } : {}),
          }),
        }
      : {}),
  };
}

function put(d, aplicar = true) {
  const t = tabla(d.TableName);
  const i = unmarshall(d.Item);
  if (!condicion(d.ConditionExpression, t.get(k(i)), nombresDe(d), valoresDe(d))) return false;
  if (aplicar) {
    t.set(k(i), i);
    cuenta.escrituras++;
  }
  return true;
}

function update(d, aplicar = true) {
  const t = tabla(d.TableName);
  const clave = unmarshall(d.Key);
  const previo = t.get(k(clave));
  const nombres = nombresDe(d);
  const valores = valoresDe(d);
  if (!condicion(d.ConditionExpression, previo, nombres, valores)) return false;
  const item = actualizar(previo, clave, d.UpdateExpression, nombres, valores);
  if (aplicar) {
    t.set(k(item), item);
    cuenta.escrituras++;
  }
  return { previo, item };
}

function borrar(d, aplicar = true) {
  const t = tabla(d.TableName);
  const clave = unmarshall(d.Key);
  if (!condicion(d.ConditionExpression, t.get(k(clave)), nombresDe(d), valoresDe(d))) return false;
  if (aplicar) {
    t.delete(k(clave));
    cuenta.borrados++;
  }
  return true;
}

function transaccion(d) {
  const ops = d.TransactItems ?? [];
  if (ops.length === 0 || ops.length > 100) throw invalida("TransactItems tiene que traer de 1 a 100 operaciones");
  const vistos = new Set();
  const razones = ops.map((op) => {
    const [tipo, cuerpo] = Object.entries(op)[0];
    const clave = tipo === "Put" ? unmarshall(cuerpo.Item) : unmarshall(cuerpo.Key);
    const id = `${cuerpo.TableName}|${k(clave)}`;
    if (vistos.has(id)) throw invalida("Transaction request cannot include multiple operations on one item");
    vistos.add(id);
    const pasa =
      tipo === "Put"
        ? put(cuerpo, false)
        : tipo === "Update"
          ? update(cuerpo, false) !== false
          : tipo === "Delete"
            ? borrar(cuerpo, false)
            : condicion(cuerpo.ConditionExpression, tabla(cuerpo.TableName).get(k(clave)), nombresDe(cuerpo), valoresDe(cuerpo));
    return pasa ? { Code: "None" } : { Code: "ConditionalCheckFailed", Message: "The conditional request failed" };
  });
  if (razones.some((r) => r.Code !== "None")) {
    throw new ErrorDynamo(
      "TransactionCanceledException",
      `Transaction cancelled, please refer cancellation reasons for specific reasons [${razones.map((r) => r.Code).join(", ")}]`,
      { CancellationReasons: razones },
    );
  }
  for (const op of ops) {
    const [tipo, cuerpo] = Object.entries(op)[0];
    if (tipo === "Put") put(cuerpo);
    if (tipo === "Update") update(cuerpo);
    if (tipo === "Delete") borrar(cuerpo);
  }
  cuenta.transacciones++;
  return {};
}

function batchGet(d) {
  const pedidas = Object.entries(d.RequestItems ?? {}).flatMap(([nombre, r]) => r.Keys.map((c) => [nombre, c]));
  if (pedidas.length > 100) throw invalida("Too many items requested for the BatchGetItem call");
  // Como DynamoDB bajo carga: contesta una parte y devuelve el resto como sin procesar.
  const ahora = pedidas.slice(0, ajustes.loteBatchGet);
  const despues = pedidas.slice(ajustes.loteBatchGet);
  const Responses = {};
  for (const [nombre, c] of ahora) {
    const item = tabla(nombre).get(k(unmarshall(c)));
    (Responses[nombre] ??= []);
    if (item) Responses[nombre].push(salida(item));
  }
  const UnprocessedKeys = {};
  for (const [nombre, c] of despues) (UnprocessedKeys[nombre] ??= { Keys: [] }).Keys.push(c);
  return { Responses, UnprocessedKeys };
}

function operar(accion, d) {
  switch (accion) {
    case "Query":
      return query(d);
    case "GetItem": {
      const i = tabla(d.TableName).get(k(unmarshall(d.Key)));
      return i ? { Item: salida(i) } : {};
    }
    case "PutItem":
      if (!put(d)) throw new ErrorDynamo("ConditionalCheckFailedException", "The conditional request failed");
      return {};
    case "UpdateItem": {
      const r = update(d);
      if (r === false) throw new ErrorDynamo("ConditionalCheckFailedException", "The conditional request failed");
      const rv = d.ReturnValues ?? "NONE";
      if (rv === "NONE") return {};
      return { Attributes: salida(rv === "ALL_OLD" || rv === "UPDATED_OLD" ? r.previo : r.item) };
    }
    case "DeleteItem":
      if (!borrar(d)) throw new ErrorDynamo("ConditionalCheckFailedException", "The conditional request failed");
      return {};
    case "BatchWriteItem": {
      for (const [nombre, peticiones] of Object.entries(d.RequestItems)) {
        for (const p of peticiones) {
          if (p.PutRequest) {
            const i = unmarshall(p.PutRequest.Item);
            tabla(nombre).set(k(i), i);
            cuenta.escrituras++;
          }
          if (p.DeleteRequest) {
            tabla(nombre).delete(k(unmarshall(p.DeleteRequest.Key)));
            cuenta.borrados++;
          }
        }
      }
      return { UnprocessedItems: {} };
    }
    case "BatchGetItem":
      return batchGet(d);
    case "TransactWriteItems":
      return transaccion(d);
    default:
      throw invalida(`Acción no simulada: ${accion}`);
  }
}

export const dynamo = http.createServer((req, res) => {
  let cuerpo = "";
  req.on("data", (c) => (cuerpo += c));
  req.on("end", () => {
    const accion = String(req.headers["x-amz-target"] ?? "").split(".")[1];
    res.setHeader("content-type", "application/x-amz-json-1.0");
    try {
      res.end(JSON.stringify(operar(accion, JSON.parse(cuerpo || "{}"))));
    } catch (e) {
      if (!(e instanceof ErrorDynamo)) console.error("DynamoDB falso:", e);
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          __type: `com.amazonaws.dynamodb.v20120810#${e.tipo ?? "InternalFailure"}`,
          message: e.message,
          ...(e.extra ?? {}),
        }),
      );
    }
  });
});

/* ── S3 ───────────────────────────────────────────────────────────────────── */

export const s3 = http.createServer((req, res) => {
  // Acepta estilo ruta (/bucket/clave) y el host virtual que rehacemos a mano.
  const clave = decodeURIComponent(req.url.split("?")[0]).replace(/^\/[^/]+\//, "");
  const trozos = [];
  // Para subir desde el navegador del panel, como el CORS del bucket real.
  res.setHeader("access-control-allow-origin", "*");
  req.on("data", (c) => trozos.push(c));
  req.on("end", () => {
    if (req.method === "OPTIONS") {
      res.setHeader("access-control-allow-methods", "PUT, GET, HEAD");
      res.setHeader("access-control-allow-headers", req.headers["access-control-request-headers"] ?? "*");
      res.statusCode = 204;
      return res.end();
    }
    if (req.method === "HEAD") {
      res.statusCode = objetos.has(clave) ? 200 : 404;
      return res.end();
    }
    if (req.method === "PUT") {
      // Como S3: si la URL trae suma de verificación, tiene que cuadrar.
      const esperado = new URL(req.url, "http://s3").searchParams.get("x-amz-checksum-crc32");
      if (esperado) {
        const suma = Buffer.alloc(4);
        suma.writeUInt32BE(crc32(Buffer.concat(trozos)));
        if (suma.toString("base64") !== esperado) {
          res.statusCode = 400;
          return res.end("<Error><Code>XAmzContentChecksumMismatch</Code></Error>");
        }
      }
      objetos.set(clave, { tipo: req.headers["content-type"], cache: req.headers["cache-control"], tamaño: Buffer.concat(trozos).length });
      cuenta.subidas++;
      res.setHeader("ETag", '"x"');
      return res.end();
    }
    res.statusCode = 400;
    res.end();
  });
});

/* ── Cognito ──────────────────────────────────────────────────────────────── */

/** Usuario → { Username, sub, atributos, grupos:Set, creado:Date, estado }. */
export const usuarios = new Map();
export const GRUPOS_POOL = new Set(["admins", "proveedores", "clientes"]);
export const estadisticasCognito = { llamadas: 0, simultaneas: 0, maxSimultaneas: 0 };

export function agregarUsuario({ sub, correo, nombre = "", telefono = "", grupos = [], creado = new Date(), estado = "CONFIRMED", habilitada = true }) {
  usuarios.set(correo, { Username: correo, sub, correo, nombre, telefono, grupos: new Set(grupos), creado, estado, habilitada, sesionesCerradas: 0, invitado: false });
}

function usuarioCognito(u) {
  const atributos = [
    ["sub", u.sub],
    ["email", u.correo],
    ["name", u.nombre],
    ["phone_number", u.telefono],
  ].filter(([, v]) => v);
  return {
    Username: u.Username,
    Attributes: atributos.map(([Name, Value]) => ({ Name, Value })),
    UserCreateDate: u.creado.getTime() / 1000,
    UserLastModifiedDate: u.creado.getTime() / 1000,
    Enabled: u.habilitada,
    UserStatus: u.estado,
  };
}

class ErrorCognito extends Error {
  constructor(tipo, mensaje) {
    super(mensaje);
    this.tipo = tipo;
  }
}

function cognitoOperar(accion, d) {
  const usuario = (nombre) => {
    const u = usuarios.get(nombre);
    if (!u) throw new ErrorCognito("UserNotFoundException", "User does not exist.");
    return u;
  };
  switch (accion) {
    case "ListUsers": {
      let lista = [...usuarios.values()];
      if (d.Filter) {
        const m = d.Filter.match(/^(\w+)\s*(=|\^=)\s*"([^"]*)"$/);
        if (!m) throw new ErrorCognito("InvalidParameterException", `Filtro que el falso no entiende: ${d.Filter}`);
        const campo = { sub: "sub", email: "correo", username: "Username", name: "nombre" }[m[1]];
        if (!campo) throw new ErrorCognito("InvalidParameterException", `Atributo no filtrable: ${m[1]}`);
        lista = lista.filter((u) => (m[2] === "=" ? u[campo] === m[3] : String(u[campo]).startsWith(m[3])));
      }
      const limite = d.Limit ?? 60;
      if (limite > 60) throw new ErrorCognito("InvalidParameterException", "Limit no puede pasar de 60");
      const desde = d.PaginationToken ? Number(d.PaginationToken) : 0;
      const pagina = lista.slice(desde, desde + limite);
      return {
        Users: pagina.map(usuarioCognito),
        ...(desde + limite < lista.length ? { PaginationToken: String(desde + limite) } : {}),
      };
    }
    case "AdminListGroupsForUser": {
      const u = usuario(d.Username);
      return { Groups: [...u.grupos].map((GroupName) => ({ GroupName, UserPoolId: d.UserPoolId })) };
    }
    case "AdminAddUserToGroup":
    case "AdminRemoveUserFromGroup": {
      const u = usuario(d.Username);
      if (!GRUPOS_POOL.has(d.GroupName)) throw new ErrorCognito("ResourceNotFoundException", "Group not found.");
      if (accion === "AdminAddUserToGroup") u.grupos.add(d.GroupName);
      else u.grupos.delete(d.GroupName);
      return {};
    }
    case "AdminCreateUser": {
      if (usuarios.has(d.Username)) throw new ErrorCognito("UsernameExistsException", "An account with the given email already exists.");
      const attr = (n) => d.UserAttributes?.find((a) => a.Name === n)?.Value ?? "";
      if (attr("email") !== d.Username) throw new ErrorCognito("InvalidParameterException", "El falso espera el correo como Username");
      agregarUsuario({ sub: `invitado-${usuarios.size}`, correo: d.Username, nombre: attr("name"), estado: "FORCE_CHANGE_PASSWORD" });
      const u = usuarios.get(d.Username);
      u.invitado = true;
      return { User: usuarioCognito(u) };
    }
    case "AdminDisableUser":
    case "AdminEnableUser": {
      usuario(d.Username).habilitada = accion === "AdminEnableUser";
      return {};
    }
    case "AdminUserGlobalSignOut": {
      const u = usuario(d.Username);
      // Como Cognito: con la cuenta ya deshabilitada no deja operar.
      if (!u.habilitada) throw new ErrorCognito("NotAuthorizedException", "User is disabled.");
      u.sesionesCerradas++;
      return {};
    }
    default:
      throw new ErrorCognito("InvalidParameterException", `Acción no simulada: ${accion}`);
  }
}

export const cognito = http.createServer((req, res) => {
  let cuerpo = "";
  req.on("data", (c) => (cuerpo += c));
  req.on("end", async () => {
    const accion = String(req.headers["x-amz-target"] ?? "").split(".")[1];
    res.setHeader("content-type", "application/x-amz-json-1.1");
    estadisticasCognito.llamadas++;
    estadisticasCognito.simultaneas++;
    estadisticasCognito.maxSimultaneas = Math.max(estadisticasCognito.maxSimultaneas, estadisticasCognito.simultaneas);
    // Un respiro, como la red: sin él nunca habría dos llamadas a la vez y no
    // se podría medir que el panel limita la concurrencia.
    await new Promise((r) => setTimeout(r, 3));
    try {
      res.end(JSON.stringify(cognitoOperar(accion, JSON.parse(cuerpo || "{}"))));
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ __type: e.tipo ?? "InternalErrorException", message: e.message }));
    } finally {
      estadisticasCognito.simultaneas--;
    }
  });
});

/* ── Clip ─────────────────────────────────────────────────────────────────── */

/** id → el cobro tal como lo devuelve `GET /v2/checkout/{id}`. */
export const cobrosClip = new Map();
/** `caido`: Clip contesta 500 a todo. `llamadas`: cuántas veces se le habló. */
export const ajustesClip = { caido: false, llamadas: 0 };
export const CLAVES_CLIP = { api: "test_clave-falsa", secreto: "secreto-falso" };

export const clip = http.createServer((req, res) => {
  let cuerpo = "";
  req.on("data", (c) => (cuerpo += c));
  req.on("end", () => {
    const contestar = (estado, datos) => {
      res.statusCode = estado;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(datos));
    };
    ajustesClip.llamadas++;
    if (ajustesClip.caido) return contestar(500, { message: "Clip caído (falso)" });
    const esperada = `Basic ${Buffer.from(`${CLAVES_CLIP.api}:${CLAVES_CLIP.secreto}`).toString("base64")}`;
    if (req.headers.authorization !== esperada) return contestar(401, { message: "Unauthorized" });

    const ruta = req.url.split("?")[0];
    if (req.method === "POST" && ruta === "/v2/checkout") {
      const d = JSON.parse(cuerpo || "{}");
      // Como Clip: sin monto, moneda, descripción o URLs de regreso, no hay enlace.
      if (!(d.amount > 0) || d.currency !== "MXN" || !d.purchase_description || !d.redirection_url?.success) {
        return contestar(400, { message: "Bad request (falso)" });
      }
      const id = `cobro-falso-${String(cobrosClip.size + 1).padStart(4, "0")}`;
      const cobro = {
        payment_request_id: id,
        payment_request_url: `http://127.0.0.1:${clip.address().port}/pagar/${id}`,
        status: "CHECKOUT_CREATED",
        amount: d.amount,
        currency: d.currency,
        purchase_description: d.purchase_description,
        redirection_url: d.redirection_url,
        metadata: d.metadata ?? null,
        webhook_url: d.webhook_url ?? null,
        expires_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      };
      cobrosClip.set(id, cobro);
      return contestar(200, cobro);
    }
    const consulta = ruta.match(/^\/v2\/checkout\/([^/]+)$/);
    if (req.method === "GET" && consulta) {
      const cobro = cobrosClip.get(decodeURIComponent(consulta[1]));
      return cobro ? contestar(200, cobro) : contestar(404, { message: "Not found" });
    }
    contestar(404, { message: `Ruta de Clip no simulada: ${req.method} ${ruta}` });
  });
});

/* ── Arranque ─────────────────────────────────────────────────────────────── */

const escuchar = (servidor) =>
  new Promise((r) => servidor.listen(0, "127.0.0.1", () => r(servidor.address().port)));

/**
 * El entorno con que la Lambda (y los scripts de carga) encuentran las falsas.
 * Se llena en `arrancar()` con los puertos que tocaron. Las credenciales son
 * falsas a propósito: si algo se escapa hacia AWS real, AWS lo rechaza.
 */
export const entorno = {
  AWS_REGION: "us-east-1",
  AWS_ACCESS_KEY_ID: "falsa",
  AWS_SECRET_ACCESS_KEY: "falsa",
  SST_RESOURCE_App: JSON.stringify({ name: "elrey-radar", stage: "prueba" }),
  SST_RESOURCE_Elrey_proveedores: JSON.stringify({ name: "Elrey_proveedores" }),
  SST_RESOURCE_Elrey_catalogo: JSON.stringify({ name: "Elrey_catalogo" }),
  SST_RESOURCE_Elrey_imagenes: JSON.stringify({ name: "bucket-imagenes" }),
  SST_RESOURCE_Elrey_fotos: JSON.stringify({ name: "bucket-fotos" }),
  SST_RESOURCE_Elrey_usuarios: JSON.stringify({ id: "us-east-1_falso" }),
  SST_RESOURCE_Elrey_web: JSON.stringify({ id: "cliente-falso" }),
  SST_RESOURCE_Elrey_github_token: JSON.stringify({ value: "" }),
  SST_RESOURCE_Elrey_clip_api: JSON.stringify({ value: CLAVES_CLIP.api }),
  SST_RESOURCE_Elrey_clip_secreto: JSON.stringify({ value: CLAVES_CLIP.secreto }),
  ELREY_SITIO: "https://tienda.prueba",
};

export async function arrancar() {
  const [pDynamo, pS3, pCognito, pClip] = await Promise.all([
    escuchar(dynamo),
    escuchar(s3),
    escuchar(cognito),
    escuchar(clip),
  ]);
  Object.assign(entorno, {
    ELREY_CLIP_URL: `http://127.0.0.1:${pClip}`,
    AWS_ENDPOINT_URL_DYNAMODB: `http://127.0.0.1:${pDynamo}`,
    AWS_ENDPOINT_URL_S3: `http://127.0.0.1:${pS3}`,
    AWS_ENDPOINT_URL_COGNITO_IDENTITY_PROVIDER: `http://127.0.0.1:${pCognito}`,
  });
  return entorno;
}

export function cerrar() {
  dynamo.close();
  s3.close();
  cognito.close();
  clip.close();
}

/** El catálogo del repositorio cargado en la tabla, como lo dejó la carga del CSV. */
export function sembrarCatalogo(catalogo, generado = catalogo.generado) {
  const t = new Map();
  const poner = (PK, SK, datos) => t.set(`${PK}#${SK}`, { PK, SK, datos, huella: `vieja-${SK}` });
  for (const d of catalogo.productos) poner("PRODUCTO", d.codigo, d);
  for (const d of catalogo.marcas) poner("MARCA", d.slug, d);
  for (const d of catalogo.sets) poner("SET", d.codigo, d);
  for (const d of catalogo.lotes) poner("LOTE", d.slug, d);
  t.set("META#CATALOGO", { PK: "META", SK: "CATALOGO", generado });
  tablas.set("Elrey_catalogo", t);
  for (const x of [...catalogo.productos, ...catalogo.sets]) for (const i of x.imagenes) objetos.set(i.clave, {});
  return t;
}
