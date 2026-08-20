"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * La sesión del sitio, compartida por la tienda y el panel de proveedores.
 *
 * Las dos apps se sirven del mismo origen (`/` y `/radar`), así que comparten
 * `localStorage`: quien inicia sesión aquí entra también allá sin volver a
 * escribir nada. Las claves llevan el prefijo `radar:` por razones históricas —
 * el panel existió primero— y se conservan a propósito: renombrarlas cerraría la
 * sesión de todos los teléfonos que ya están en la calle.
 *
 * El panel tiene su propia copia de esta lógica porque son dos aplicaciones
 * independientes y no pueden importarse entre sí.
 */

const CLAVE_TOKEN = "radar:token";
const CLAVE_REFRESCO = "radar:refresco";
const CLAVE_VENCE = "radar:vence";
const CLAVE_EVALUADOR = "radar:evaluador";

const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION ?? "us-east-1";
const CLIENTE = process.env.NEXT_PUBLIC_COGNITO_CLIENTE ?? "";
const URL_COGNITO = `https://cognito-idp.${REGION}.amazonaws.com/`;

export function hayLogin(): boolean {
  return CLIENTE !== "";
}

async function cognito<T>(accion: string, cuerpo: unknown): Promise<T> {
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
    if (!res.ok) throw new Error(traducir(datos));
    return datos as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("El servidor no respondió a tiempo");
    }
    throw e;
  } finally {
    clearTimeout(corte);
  }
}

/** Los mensajes de Cognito llegan en inglés y con nombres de excepción. */
function traducir(datos: { __type?: string; message?: string }): string {
  const tipo = (datos.__type ?? "").split("#").pop();
  switch (tipo) {
    case "NotAuthorizedException":
    // Mismo mensaje a propósito: decir "ese correo no existe" le confirma a
    // cualquiera qué cuentas hay dadas de alta.
    case "UserNotFoundException":
      return "Correo o contraseña incorrectos";
    case "PasswordResetRequiredException":
      return "Hay que restablecer la contraseña. Escríbenos y lo resolvemos.";
    case "InvalidPasswordException":
      return "La contraseña necesita al menos 10 caracteres, con minúsculas y números";
    case "LimitExceededException":
    case "TooManyRequestsException":
      return "Demasiados intentos. Espera un momento antes de reintentar.";
    default:
      return datos.message ?? "No se pudo iniciar sesión";
  }
}

export type Perfil = {
  correo: string;
  nombre: string;
  grupos: string[];
};

/**
 * Lee el token sin verificar la firma: aquí solo decide qué pintar.
 *
 * **Quien verifica de verdad es la API**, contra las claves públicas de Cognito.
 * Editar esto en el navegador no abre ninguna puerta.
 */
export function leerPerfil(idToken: string): Perfil | null {
  try {
    const carga = JSON.parse(
      atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return {
      correo: carga.email ?? "",
      nombre: carga.name ?? carga.email ?? "",
      grupos: carga["cognito:groups"] ?? [],
    };
  } catch {
    return null;
  }
}

/** ¿Su cuenta abre el panel de proveedores? */
export function puedeVerPanel(perfil: Perfil | null): boolean {
  if (!perfil) return false;
  return perfil.grupos.includes("proveedores") || perfil.grupos.includes("admins");
}

type RespuestaAuth = {
  AuthenticationResult?: { IdToken: string; RefreshToken?: string; ExpiresIn: number };
  ChallengeName?: string;
  Session?: string;
};

export type Sesion = {
  perfil: Perfil | null;
  listo: boolean;
  entrar: (
    correo: string,
    contrasena: string,
  ) => Promise<
    | { ok: true; perfil: Perfil }
    | { ok: false; error: string }
    | { nuevaContrasena: { sesion: string; correo: string } }
  >;
  cambiarContrasena: (
    reto: { sesion: string; correo: string },
    nueva: string,
  ) => Promise<{ ok: boolean; error?: string; perfil?: Perfil }>;
  salir: () => void;
};

export function useSesion(): Sesion {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(CLAVE_TOKEN);
    if (token) setPerfil(leerPerfil(token));
    setListo(true);
  }, []);

  const guardar = useCallback((r: RespuestaAuth): Perfil => {
    const a = r.AuthenticationResult;
    if (!a?.IdToken) throw new Error("Cognito no devolvió la sesión");
    const p = leerPerfil(a.IdToken);
    localStorage.setItem(CLAVE_TOKEN, a.IdToken);
    if (a.RefreshToken) localStorage.setItem(CLAVE_REFRESCO, a.RefreshToken);
    localStorage.setItem(CLAVE_VENCE, String(Date.now() + a.ExpiresIn * 1000));
    localStorage.setItem(CLAVE_EVALUADOR, p?.nombre ?? "");
    setPerfil(p);
    return p!;
  }, []);

  const entrar = useCallback(
    async (correo: string, contrasena: string) => {
      try {
        const r = await cognito<RespuestaAuth>("InitiateAuth", {
          AuthFlow: "USER_PASSWORD_AUTH",
          ClientId: CLIENTE,
          AuthParameters: { USERNAME: correo.trim(), PASSWORD: contrasena },
        });
        // Cuenta recién creada por un administrador: Cognito exige cambiar la
        // contraseña temporal antes de entregar ninguna sesión.
        if (r.ChallengeName === "NEW_PASSWORD_REQUIRED" && r.Session) {
          return { nuevaContrasena: { sesion: r.Session, correo: correo.trim() } };
        }
        return { ok: true as const, perfil: guardar(r) };
      } catch (e) {
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : "No se pudo iniciar sesión",
        };
      }
    },
    [guardar],
  );

  const cambiarContrasena = useCallback(
    async (reto: { sesion: string; correo: string }, nueva: string) => {
      try {
        const r = await cognito<RespuestaAuth>("RespondToAuthChallenge", {
          ClientId: CLIENTE,
          ChallengeName: "NEW_PASSWORD_REQUIRED",
          Session: reto.sesion,
          ChallengeResponses: { USERNAME: reto.correo, NEW_PASSWORD: nueva },
        });
        return { ok: true, perfil: guardar(r) };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "No se pudo guardar la contraseña",
        };
      }
    },
    [guardar],
  );

  const salir = useCallback(() => {
    for (const c of [CLAVE_TOKEN, CLAVE_REFRESCO, CLAVE_VENCE, CLAVE_EVALUADOR]) {
      localStorage.removeItem(c);
    }
    setPerfil(null);
  }, []);

  return { perfil, listo, entrar, cambiarContrasena, salir };
}
