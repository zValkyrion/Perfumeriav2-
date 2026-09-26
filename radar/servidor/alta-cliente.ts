import {
  AdminAddUserToGroupCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";

/**
 * Disparador post-confirmación del pool: quien se registra solo en la tienda
 * queda en `clientes`.
 *
 * El grupo está escrito aquí y no llega de ningún sitio: nada de lo que mande
 * el navegador al registrarse puede cambiar dónde cae la cuenta. Los grupos del
 * equipo (`proveedores`, `admins`) solo los pone un admin a mano.
 *
 * Cognito también llama a este disparador cuando alguien confirma una
 * recuperación de contraseña; ahí no hay nada que hacer.
 */
const cognito = new CognitoIdentityProviderClient({});

type EventoPostConfirmacion = {
  triggerSource: string;
  userPoolId: string;
  userName: string;
};

export async function handler(evento: EventoPostConfirmacion) {
  if (evento.triggerSource !== "PostConfirmation_ConfirmSignUp") return evento;

  // Si esto falla, la cuenta queda confirmada igual y sin grupo: puede comprar
  // de todos modos, porque la API pide identidad, no el grupo `clientes`. Se
  // registra el error y se deja pasar para no dejar a nadie a medio registrar.
  try {
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: evento.userPoolId,
        Username: evento.userName,
        GroupName: "clientes",
      }),
    );
  } catch (e) {
    console.error(`No se pudo meter a ${evento.userName} en clientes`, e);
  }
  return evento;
}
