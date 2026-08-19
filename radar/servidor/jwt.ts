import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * JWT HS256 hecho a mano con `node:crypto`.
 *
 * Sin dependencias a propósito: firmar y verificar un HS256 son treinta líneas,
 * y una librería más en el paquete de la Lambda es más arranque en frío y una
 * superficie de actualizaciones que mantener para siempre. La verificación usa
 * comparación en tiempo constante — comparar firmas con `===` filtra
 * información sobre la firma correcta byte a byte.
 */

const b64url = (b: Buffer) => b.toString("base64url");

function firma(contenido: string, secreto: string): string {
  return b64url(createHmac("sha256", secreto).update(contenido).digest());
}

export type Sesion = {
  /** Quién capturó. Va dentro del token para que cada ficha quede firmada. */
  evaluador: string;
  /** Expiración en segundos desde época. */
  exp: number;
};

/** 90 días: la gira dura semanas y volver a pedir el PIN en la calle es fricción. */
const VIGENCIA_SEGUNDOS = 90 * 24 * 60 * 60;

export function firmarToken(evaluador: string, secreto: string): string {
  const cabecera = b64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const cuerpo: Sesion = {
    evaluador,
    exp: Math.floor(Date.now() / 1000) + VIGENCIA_SEGUNDOS,
  };
  const carga = b64url(Buffer.from(JSON.stringify(cuerpo)));
  const contenido = `${cabecera}.${carga}`;
  return `${contenido}.${firma(contenido, secreto)}`;
}

export function verificarToken(token: string, secreto: string): Sesion | null {
  const partes = token.split(".");
  if (partes.length !== 3) return null;

  const contenido = `${partes[0]}.${partes[1]}`;
  const esperada = Buffer.from(firma(contenido, secreto));
  const recibida = Buffer.from(partes[2]);
  if (esperada.length !== recibida.length) return null;
  if (!timingSafeEqual(esperada, recibida)) return null;

  try {
    const cuerpo = JSON.parse(
      Buffer.from(partes[1], "base64url").toString("utf8"),
    ) as Sesion;
    if (typeof cuerpo.exp !== "number" || cuerpo.exp < Date.now() / 1000) return null;
    return cuerpo;
  } catch {
    return null;
  }
}

/** Compara el PIN sin filtrar por tiempo cuántos caracteres coinciden. */
export function pinCorrecto(recibido: string, esperado: string): boolean {
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
