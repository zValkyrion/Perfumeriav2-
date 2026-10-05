/**
 * Un token de Cognito para las pruebas contra producción.
 *
 * Desde que se retiró el PIN (2026-10-05) la API solo acepta cuentas de
 * Cognito. Las pruebas entran con una cuenta dedicada del equipo
 * (`proveedores`), cuyo correo y contraseña llegan del entorno —en la CI, de
 * los secretos del repositorio— y nunca se escriben aquí:
 *
 *   RADAR_CORREO=prueba@... RADAR_CONTRASENA=... node scripts/probar-api.mjs
 *
 * El cliente de Cognito se pregunta a `GET /salud`, que ya lo publica: así no
 * hay un identificador más que mantener a mano.
 *
 * Devuelve `null` si no hay credenciales; quien llama decide si eso es fallo u
 * omisión.
 */
export async function tokenDePrueba(api) {
  const correo = process.env.RADAR_CORREO;
  const contrasena = process.env.RADAR_CONTRASENA;
  if (!correo || !contrasena) return null;

  const salud = await (await fetch(`${api}/salud`)).json();
  const res = await fetch("https://cognito-idp.us-east-1.amazonaws.com/", {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: salud.clienteCognito,
      AuthParameters: { USERNAME: correo, PASSWORD: contrasena },
    }),
  });
  const cuerpo = await res.json();
  const token = cuerpo.AuthenticationResult?.IdToken;
  if (!token) {
    throw new Error(
      `Cognito no dio sesión a la cuenta de prueba (${cuerpo.__type ?? res.status}${cuerpo.ChallengeName ? `, pide ${cuerpo.ChallengeName}` : ""})`,
    );
  }
  return token;
}
