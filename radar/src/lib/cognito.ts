"use client";

/**
 * Habla con Cognito directamente, sin SDK.
 *
 * La API de Cognito es JSON sobre HTTPS: tres llamadas y un puñado de campos.
 * Meter el SDK de AWS en el paquete del navegador por esto sumaría cientos de
 * kilobytes que el equipo descargaría con datos de roaming — y aquí cada
 * kilobyte se paga en la calle.
 *
 * Las pantallas son nuestras, así que la contraseña viaja a Cognito por TLS
 * (`USER_PASSWORD_AUTH`) y nunca pasa por nuestra API ni se guarda en ningún
 * sitio.
 */

const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION ?? "us-east-1";
const CLIENTE = process.env.NEXT_PUBLIC_COGNITO_CLIENTE ?? "";

export function hayCognito(): boolean {
  return CLIENTE !== "";
}

const URL_COGNITO = `https://cognito-idp.${REGION}.amazonaws.com/`;

async function llamar<T>(accion: string, cuerpo: unknown): Promise<T> {
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(URL_COGNITO, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/x-amz-json-1.1",
        "x-amz-target": `AWSCognitoIdentityProviderService.${accion}`,
      },
      body: JSON.stringify(cuerpo),
    });

    const datos = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(mensajeDe(datos));
    return datos as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Cognito no respondió a tiempo");
    }
    throw e;
  } finally {
    clearTimeout(corte);
  }
}

/**
 * Traduce los errores de Cognito.
 *
 * Los mensajes originales llegan en inglés y con nombres de excepción que no
 * significan nada para quien está de pie en la calle intentando entrar.
 */
function mensajeDe(datos: { __type?: string; message?: string }): string {
  const tipo = (datos.__type ?? "").split("#").pop();
  switch (tipo) {
    case "NotAuthorizedException":
      return "Correo o contraseña incorrectos";
    case "UserNotFoundException":
      // A propósito igual que el anterior: decir "ese correo no existe" le
      // confirma a cualquiera qué cuentas hay en el sistema.
      return "Correo o contraseña incorrectos";
    case "PasswordResetRequiredException":
      return "Hay que restablecer la contraseña. Pídeselo a un administrador.";
    case "InvalidPasswordException":
      return "La contraseña necesita al menos 10 caracteres, con minúsculas y números";
    case "LimitExceededException":
    case "TooManyRequestsException":
      return "Demasiados intentos. Espera un momento antes de reintentar.";
    default:
      return datos.message ?? "No se pudo completar el inicio de sesión";
  }
}

export type Tokens = {
  idToken: string;
  refreshToken: string;
  /** Momento (ms) en que caduca el idToken. */
  vence: number;
};

type RespuestaAuth = {
  AuthenticationResult?: {
    IdToken: string;
    RefreshToken?: string;
    ExpiresIn: number;
  };
  ChallengeName?: string;
  Session?: string;
};

export type ResultadoAcceso =
  | { tipo: "entrado"; tokens: Tokens }
  | { tipo: "nueva_contrasena"; sesion: string; correo: string };

export async function iniciarSesion(
  correo: string,
  contrasena: string,
): Promise<ResultadoAcceso> {
  const r = await llamar<RespuestaAuth>("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENTE,
    AuthParameters: { USERNAME: correo, PASSWORD: contrasena },
  });

  // A quien acaba de crear un administrador, Cognito le exige cambiar la
  // contraseña temporal antes de darle ningún token.
  if (r.ChallengeName === "NEW_PASSWORD_REQUIRED" && r.Session) {
    return { tipo: "nueva_contrasena", sesion: r.Session, correo };
  }
  return { tipo: "entrado", tokens: tokensDe(r) };
}

export async function fijarNuevaContrasena(
  correo: string,
  sesion: string,
  nueva: string,
): Promise<Tokens> {
  const r = await llamar<RespuestaAuth>("RespondToAuthChallenge", {
    ClientId: CLIENTE,
    ChallengeName: "NEW_PASSWORD_REQUIRED",
    Session: sesion,
    ChallengeResponses: { USERNAME: correo, NEW_PASSWORD: nueva },
  });
  return tokensDe(r);
}

/**
 * Renueva el token de identidad, que dura una hora.
 *
 * El de refresco dura 90 días: el equipo inicia sesión una vez y la gira entera
 * cabe dentro, sin volver a pedir contraseña en mitad de una visita.
 */
export async function refrescar(refreshToken: string): Promise<Tokens> {
  const r = await llamar<RespuestaAuth>("InitiateAuth", {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: CLIENTE,
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  });
  // El refresco no devuelve uno nuevo: se conserva el que ya se tenía.
  return { ...tokensDe(r), refreshToken };
}

function tokensDe(r: RespuestaAuth): Tokens {
  const a = r.AuthenticationResult;
  if (!a?.IdToken) throw new Error("Cognito no devolvió la sesión");
  return {
    idToken: a.IdToken,
    refreshToken: a.RefreshToken ?? "",
    vence: Date.now() + a.ExpiresIn * 1000,
  };
}

export type Perfil = {
  correo: string;
  nombre: string;
  grupos: string[];
};

/**
 * Lee el contenido del token sin verificar la firma.
 *
 * Aquí solo sirve para decidir qué pintar. **Quien verifica de verdad es la
 * API**, que comprueba la firma contra las claves públicas de Cognito: cambiar
 * este JSON en el navegador no da acceso a nada.
 */
export function leerPerfil(idToken: string): Perfil | null {
  try {
    const carga = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return {
      correo: carga.email ?? "",
      nombre: carga.name ?? carga.email ?? "",
      grupos: carga["cognito:groups"] ?? [],
    };
  } catch {
    return null;
  }
}
