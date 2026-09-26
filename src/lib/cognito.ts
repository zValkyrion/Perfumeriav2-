"use client";

/**
 * Habla con Cognito directamente, sin SDK.
 *
 * La API de Cognito es JSON sobre HTTPS y aquí se usan unas pocas llamadas:
 * meter el SDK de AWS en el paquete de la tienda por esto sumaría cientos de
 * kilobytes. Las pantallas son nuestras, así que la contraseña viaja a Cognito
 * por TLS y nunca pasa por nuestra API ni se guarda en ningún sitio.
 *
 * Todo lo de aquí es sin estado: quien guarda la sesión es `sesion.ts`.
 */

const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION ?? "us-east-1";
const CLIENTE = process.env.NEXT_PUBLIC_COGNITO_CLIENTE ?? "";
const URL_COGNITO = `https://cognito-idp.${REGION}.amazonaws.com/`;

export function hayCognito(): boolean {
  return CLIENTE !== "";
}

/** Error de Cognito ya traducido, con el tipo original para decidir qué hacer. */
export class ErrorCognito extends Error {
  constructor(
    mensaje: string,
    readonly tipo: string,
  ) {
    super(mensaje);
  }
}

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
    if (!res.ok) {
      const tipo = (datos.__type ?? "").split("#").pop() ?? "";
      throw new ErrorCognito(traducir(tipo, datos.message), tipo);
    }
    return datos as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ErrorCognito("El servidor no respondió a tiempo", "Tiempo");
    }
    if (e instanceof ErrorCognito) throw e;
    throw new ErrorCognito("No hay conexión. Revisa tu internet.", "Red");
  } finally {
    clearTimeout(corte);
  }
}

/** Los mensajes de Cognito llegan en inglés y con nombres de excepción. */
function traducir(tipo: string, mensaje?: string): string {
  switch (tipo) {
    case "NotAuthorizedException":
    // Mismo mensaje a propósito: decir "ese correo no existe" le confirma a
    // cualquiera qué cuentas hay dadas de alta.
    case "UserNotFoundException":
      return "Correo o contraseña incorrectos";
    case "UserNotConfirmedException":
      return "Falta confirmar tu correo con el código que te enviamos";
    case "UsernameExistsException":
      return "Ya hay una cuenta con ese correo. Inicia sesión o recupera tu contraseña.";
    case "CodeMismatchException":
      return "El código no es correcto";
    case "ExpiredCodeException":
      return "El código ya venció. Pide uno nuevo.";
    case "PasswordResetRequiredException":
      return "Hay que restablecer la contraseña. Usa «¿Olvidaste tu contraseña?».";
    case "InvalidPasswordException":
      return "La contraseña necesita al menos 10 caracteres, con minúsculas y números";
    case "InvalidParameterException":
      return "Revisa los datos: el correo debe ser válido";
    case "CodeDeliveryFailureException":
      return "No pudimos enviar el correo. Revisa la dirección e inténtalo de nuevo.";
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException":
      return "Demasiados intentos. Espera unos minutos antes de reintentar.";
    default:
      return mensaje ?? "Algo salió mal. Inténtalo de nuevo.";
  }
}

export type Tokens = {
  idToken: string;
  refreshToken: string;
  /** Momento (ms) en que caduca el idToken. */
  vence: number;
};

type RespuestaAuth = {
  AuthenticationResult?: { IdToken: string; RefreshToken?: string; ExpiresIn: number };
  ChallengeName?: string;
  Session?: string;
};

function tokensDe(r: RespuestaAuth): Tokens {
  const a = r.AuthenticationResult;
  if (!a?.IdToken) throw new ErrorCognito("El servidor no devolvió la sesión", "SinSesion");
  return {
    idToken: a.IdToken,
    refreshToken: a.RefreshToken ?? "",
    vence: Date.now() + a.ExpiresIn * 1000,
  };
}

export type ResultadoEntrar =
  | { tipo: "entrado"; tokens: Tokens }
  | { tipo: "nueva_contrasena"; sesion: string; correo: string };

export async function iniciarSesion(
  correo: string,
  contrasena: string,
): Promise<ResultadoEntrar> {
  const r = await llamar<RespuestaAuth>("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENTE,
    AuthParameters: { USERNAME: correo, PASSWORD: contrasena },
  });
  // Cuenta creada por un administrador: Cognito exige cambiar la contraseña
  // temporal antes de entregar ninguna sesión.
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

/** Renueva el token de identidad (1 h) con el de refresco (90 días). */
export async function refrescar(refreshToken: string): Promise<Tokens> {
  const r = await llamar<RespuestaAuth>("InitiateAuth", {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: CLIENTE,
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  });
  // El refresco no devuelve uno nuevo: se conserva el que ya se tenía.
  return { ...tokensDe(r), refreshToken };
}

/**
 * Crea la cuenta. Cognito manda un código al correo y la cuenta no sirve para
 * entrar hasta confirmarlo. El grupo `clientes` lo pone el servidor al
 * confirmar; desde aquí no hay forma de pedir otro.
 */
export async function registrar(nombre: string, correo: string, contrasena: string) {
  await llamar("SignUp", {
    ClientId: CLIENTE,
    Username: correo,
    Password: contrasena,
    UserAttributes: [
      { Name: "email", Value: correo },
      { Name: "name", Value: nombre },
    ],
  });
}

export async function confirmarRegistro(correo: string, codigo: string) {
  await llamar("ConfirmSignUp", {
    ClientId: CLIENTE,
    Username: correo,
    ConfirmationCode: codigo,
  });
}

export async function reenviarCodigo(correo: string) {
  await llamar("ResendConfirmationCode", { ClientId: CLIENTE, Username: correo });
}

/** Manda al correo un código para elegir contraseña nueva. */
export async function pedirRecuperacion(correo: string) {
  await llamar("ForgotPassword", { ClientId: CLIENTE, Username: correo });
}

export async function restablecerContrasena(
  correo: string,
  codigo: string,
  nueva: string,
) {
  await llamar("ConfirmForgotPassword", {
    ClientId: CLIENTE,
    Username: correo,
    ConfirmationCode: codigo,
    Password: nueva,
  });
}
