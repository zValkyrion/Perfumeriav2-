// Sustituye a aws-jwt-verify en la prueba: un "token" es el JSON de la carga
// en base64 (o en la parte central de un JWT) con `falso: true`. Cualquier
// otra cosa se rechaza, como haría Cognito, y la identidad cae al PIN.
export const CognitoJwtVerifier = {
  create() {
    return {
      async verify(token) {
        const parte = token.includes(".") ? token.split(".")[1] : token;
        const carga = JSON.parse(Buffer.from(parte, "base64url").toString("utf8"));
        if (carga?.falso !== true) throw new Error("no es de Cognito");
        return carga;
      },
    };
  },
};
