/// <reference path="./.sst/platform/config.d.ts" />

/**
 * Infraestructura del Radar de Proveedores.
 *
 * Convención de nombres: todo lleva el prefijo `Elrey_`.
 *
 * **Excepción obligada — el bucket.** S3 exige nombres en minúsculas, sin
 * guiones bajos y únicos en todo el planeta (regla de AWS, no una preferencia).
 * `Elrey_fotos` es un nombre inválido: el despliegue lo rechazaría. El bucket se
 * llama `elrey-radar-fotos-<sufijo>`, que es lo más cerca que permite el
 * servicio. El *identificador* dentro de este archivo sí es `Elrey_fotos`, así
 * que en el código se sigue leyendo con la convención.
 *
 * Deliberadamente NO hay VPC, RDS ni NAT Gateway: eso costaría ~32 USD/mes fijos
 * sin aportar nada a este volumen de datos.
 */
export default $config({
  app(input) {
    return {
      name: "elrey-radar",
      removal: input?.stage === "produccion" ? "retain" : "remove",
      protect: input?.stage === "produccion",
      home: "aws",
      providers: { aws: { region: "us-east-1" } },
    };
  },

  async run() {
    // ── Secretos ────────────────────────────────────────────────────────────
    // Viven en SSM Parameter Store, nunca en el repositorio. Se fijan con
    // `npx sst secret set <nombre> <valor> --stage produccion`.
    //
    // `Elrey_pin` y `Elrey_jwt_secreto` (el código compartido del equipo) se
    // retiraron el 2026-10-05: ahora cada quien entra con su cuenta. **Siguen
    // declarados, sin enlazar a nada, a propósito**: producción va con
    // `protect` y Pulumi se niega a borrar un recurso protegido, así que
    // quitarlos de aquí tumbó el despliegue entero. Sin `link` ninguna
    // función los lee: son dos parámetros muertos en SSM.
    new sst.Secret("Elrey_pin");
    new sst.Secret("Elrey_jwt_secreto");
    //
    // Token de GitHub con permiso de Actions (escritura) sobre este repositorio
    // y nada más: es lo que deja al panel volver a compilar la tienda. Vacío
    // por defecto —el despliegue no falla sin él—; entonces el panel guarda
    // igual y lo publica el siguiente push.
    const githubToken = new sst.Secret("Elrey_github_token", "");
    //
    // Las claves de la API de Clip (panel de Clip → Desarrolladores). Con ellas
    // la API crea un enlace de cobro por pedido y confirma los pagos. Vacías
    // por defecto: sin ellas la tienda funciona igual y el cobro se acuerda
    // por WhatsApp. Las de prueba empiezan por `test_` y no cobran de verdad.
    const clipApi = new sst.Secret("Elrey_clip_api", "");
    const clipSecreto = new sst.Secret("Elrey_clip_secreto", "");
    // A dónde vuelve el comprador después de pagar. Fijo aquí porque el sitio
    // depende de la API y no al revés; se cambia el día que haya dominio propio.
    const urlSitio = process.env.ELREY_SITIO ?? "https://devfq5kjop78h.cloudfront.net";
    // De dónde se pide el despliegue. En la CI lo dice GitHub; a mano, el de
    // siempre.
    const repositorio = process.env.GITHUB_REPOSITORY ?? "zValkyrion/Perfumeriav2-";

    // ── Datos ───────────────────────────────────────────────────────────────
    const tabla = new sst.aws.Dynamo("Elrey_proveedores", {
      fields: {
        PK: "string",
        SK: "string",
        GSI1PK: "string",
        GSI1SK: "string",
      },
      primaryIndex: { hashKey: "PK", rangeKey: "SK" },
      // Listar todas las fichas por fecha sin recorrer la tabla entera.
      globalIndexes: {
        porFecha: { hashKey: "GSI1PK", rangeKey: "GSI1SK" },
      },
      transform: {
        table: { name: "Elrey_proveedores" },
      },
    });

    // ── Catálogo de la tienda ───────────────────────────────────────────────
    //
    // Tabla aparte de `Elrey_proveedores` a propósito: el catálogo es público
    // —lo sirve `GET /catalogo`— y lo demás es privado (fichas de proveedores,
    // carritos, direcciones, pedidos). Separarlos deja los permisos, los
    // respaldos y los borrados de cada mundo sin riesgo de tocar el otro.
    //
    //   PK = PRODUCTO  SK = <código del PDF>
    //   PK = MARCA     SK = <slug>
    //   PK = SET       SK = <código del PDF>
    //   PK = LOTE      SK = <slug>
    //   PK = META      SK = CATALOGO   → versión y huella de la última carga
    //
    // Cabe en unas pocas particiones porque son cientos de filas, no millones,
    // y siempre se leen completas; la huella evita reescribir lo que no cambió.
    const catalogo = new sst.aws.Dynamo("Elrey_catalogo", {
      fields: { PK: "string", SK: "string" },
      primaryIndex: { hashKey: "PK", rangeKey: "SK" },
      transform: {
        table: { name: "Elrey_catalogo" },
      },
    });

    // Las fotos de producto no viven en el repositorio ni en la tienda: se
    // suben aquí y se sirven por CloudFront. El bucket no es público; solo
    // CloudFront puede leerlo. Los nombres llevan la huella del contenido, así
    // que cada archivo se sirve con caché de un año sin miedo a quedar viejo.
    const imagenes = new sst.aws.Bucket("Elrey_imagenes", {
      access: "cloudfront",
    });
    const cdnImagenes = new sst.aws.Router("Elrey_cdn_imagenes");
    cdnImagenes.routeBucket("/", imagenes);

    const fotos = new sst.aws.Bucket("Elrey_fotos", {
      // El teléfono sube directo con URL prefirmada: el navegador necesita CORS.
      cors: {
        allowMethods: ["GET", "PUT"],
        allowOrigins: ["*"],
        allowHeaders: ["*"],
      },
    });

    // ── Identidad ───────────────────────────────────────────────────────────
    //
    // Un solo pool para clientes y equipo: son las mismas personas —quien
    // captura proveedores también compra— y con dos pools tendrían dos
    // contraseñas para el mismo humano. Lo que separa es el grupo, no la cuenta.
    const usuarios = new sst.aws.CognitoUserPool("Elrey_usuarios", {
      // Se entra con el correo, no con un nombre de usuario que haya que
      // recordar aparte.
      usernames: ["email"],
      // El correo con el código de verificación del registro. Lo manda Cognito
      // desde su propia dirección, con un tope de ~50 al día: suficiente para
      // arrancar. Cuando el registro crezca, se pasa a SES.
      verify: {
        emailSubject: "Tu código de El Rey de los Perfumes",
        emailMessage:
          "Hola. Tu código para confirmar tu cuenta en El Rey de los Perfumes es {####}. Si no fuiste tú, ignora este correo.",
      },
      triggers: {
        // Toda cuenta que se confirma sola cae en `clientes`, y en nada más.
        // Los grupos del equipo solo los pone un admin a mano: es lo que
        // sostiene todo el esquema.
        postConfirmation: {
          handler: "servidor/alta-cliente.handler",
          name: `Elrey_alta_cliente_${$app.stage}`,
          timeout: "10 seconds",
          // El pool no puede referenciarse aquí —dependería de sí mismo—, así
          // que el permiso se da sobre los pools de la cuenta y el nombre del
          // pool llega en el propio evento.
          permissions: [
            {
              actions: ["cognito-idp:AdminAddUserToGroup"],
              resources: ["arn:aws:cognito-idp:us-east-1:*:userpool/*"],
            },
          ],
        },
      },
      transform: {
        userPool: {
          name: "Elrey_usuarios",
          // Registro abierto: los clientes se crean su cuenta solos. Al equipo
          // lo acepta o lo invita el superadmin desde «Equipo y cuentas»,
          // porque el grupo no se lo puede poner nadie más.
          adminCreateUserConfig: {
            allowAdminCreateUserOnly: false,
            // La invitación que manda «Invitar por correo». Sin esto Cognito la
            // manda en inglés. `{username}` es el correo y `{####}` la
            // contraseña temporal; las dos son obligatorias en la plantilla.
            inviteMessageTemplate: {
              emailSubject: "Tu acceso al panel de El Rey de los Perfumes",
              emailMessage:
                "Hola. Te dieron acceso al panel de El Rey de los Perfumes. Entra en https://devfq5kjop78h.cloudfront.net/radar/ con tu correo {username} y esta contraseña temporal: {####} . Vale 14 días y te pedirá cambiarla la primera vez.",
              // No se manda SMS, pero con la plantilla a medias el primer
              // despliegue la guardó en el estado y Cognito no la recibió: va
              // completa.
              smsMessage: "El Rey de los Perfumes: tu usuario es {username} y tu contraseña temporal {####}",
            },
          },
          // Quien cambia su correo desde la cuenta sigue entrando con el
          // anterior hasta confirmar el nuevo con el código. Sin esto, un correo
          // mal escrito dejaba la cuenta atada a una dirección que nadie lee.
          userAttributeUpdateSettings: {
            attributesRequireVerificationBeforeUpdates: ["email"],
          },
          // Solo el correo sirve para recuperar la contraseña: no hay SMS.
          accountRecoverySetting: {
            recoveryMechanisms: [{ name: "verified_email", priority: 1 }],
          },
          passwordPolicy: {
            minimumLength: 10,
            requireLowercase: true,
            requireNumbers: true,
            requireUppercase: false,
            requireSymbols: false,
            // Días que vale la contraseña temporal que reparte el admin.
            temporaryPasswordValidityDays: 14,
          },
        },
      },
    });

    const clienteWeb = usuarios.addClient("Elrey_web", {
      transform: {
        client: {
          name: "Elrey_web",
          // Las pantallas son nuestras, así que el navegador habla directo con
          // Cognito: usuario y contraseña por TLS, y refresco para que una gira
          // entera quepa en un solo inicio de sesión.
          explicitAuthFlows: [
            "ALLOW_USER_PASSWORD_AUTH",
            "ALLOW_REFRESH_TOKEN_AUTH",
          ],
          // Sin secreto: vive en un navegador, donde nada es secreto.
          generateSecret: false,
          // Al entrar o al pedir recuperar la contraseña, «ese correo no
          // existe» le diría a cualquiera qué cuentas hay. Así Cognito responde
          // igual exista o no.
          preventUserExistenceErrors: "ENABLED",
          accessTokenValidity: 1,
          idTokenValidity: 1,
          tokenValidityUnits: {
            accessToken: "hours",
            idToken: "hours",
            refreshToken: "days",
          },
          // 90 días: el equipo pasa semanas en la calle sin señal fiable y no
          // puede quedarse fuera por caducidad a mitad de una visita.
          refreshTokenValidity: 90,
        },
      },
    });

    // Los grupos son el permiso. Nadie puede auto-asignarse uno: eso es lo que
    // sostiene todo el esquema. Solo los reparte el superadmin, que **no** es
    // un grupo: vive en `compartido/equipo.ts` (`SUPERADMINS`).
    const grupos = [
      { nombre: "admins", precedencia: 1, texto: "Control total del sistema" },
      { nombre: "proveedores", precedencia: 2, texto: "Acceso al panel de proveedores" },
      { nombre: "clientes", precedencia: 3, texto: "Compradores de la tienda" },
    ];
    for (const g of grupos) {
      new aws.cognito.UserGroup(`Elrey_grupo_${g.nombre}`, {
        userPoolId: usuarios.id,
        name: g.nombre,
        precedence: g.precedencia,
        description: g.texto,
      });
    }
    // ── API ─────────────────────────────────────────────────────────────────
    const api = new sst.aws.ApiGatewayV2("Elrey_api", {
      cors: {
        allowMethods: ["GET", "POST", "PUT", "DELETE"],
        allowOrigins: ["*"],
        allowHeaders: ["content-type", "authorization"],
      },
      transform: {
        api: { name: "Elrey_api" },
      },
    });

    // Una sola Lambda para todas las rutas, con `$default` como atrapa-todo y el
    // enrutado dentro de `servidor/api.ts`.
    //
    // Declarar las siete rutas por separado creaba siete funciones —una por
    // ruta— que peleaban por el mismo nombre y el mismo grupo de logs. A este
    // volumen, además, repartirlas solo multiplica arranques en frío sin ganar
    // nada: el paquete es idéntico y la concurrencia sobra.
    api.route("$default", {
      handler: "servidor/api.handler",
      // `imagenes`: el panel sube fotos de producto con URL prefirmada, y la
      // firma sale del permiso de esta función sobre el bucket.
      link: [
        tabla,
        catalogo,
        imagenes,
        fotos,
        githubToken,
        clipApi,
        clipSecreto,
        usuarios,
        clienteWeb,
      ],
      environment: { ELREY_REPOSITORIO: repositorio, ELREY_SITIO: urlSitio },
      name: `Elrey_api_${$app.stage}`,
      memory: "512 MB",
      timeout: "20 seconds",
      // Textract no se enlaza como un recurso de SST: se concede por política.
      // El alcance es la acción, no el bucket — Textract lee de S3 con el
      // permiso de esta misma función, que ya está limitado a nuestro bucket.
      permissions: [
        { actions: ["textract:AnalyzeDocument"], resources: ["*"] },
      ],
    });

    // ── Publicación automática ──────────────────────────────────────────────
    // Cada diez minutos: si el panel dejó cambios sin publicar y nadie ha
    // tocado nada en diez minutos, pide el despliegue. Sin token no hace nada.
    new sst.aws.Cron("Elrey_publicacion", {
      schedule: "rate(10 minutes)",
      function: {
        handler: "servidor/publicar-cron.handler",
        link: [catalogo, githubToken],
        environment: { ELREY_REPOSITORIO: repositorio },
        name: `Elrey_publicacion_${$app.stage}`,
        timeout: "30 seconds",
      },
    });

    // ── Sitio ───────────────────────────────────────────────────────────────
    // Una sola distribución sirve las dos apps: la tienda en la raíz y la de
    // campo en /radar. Comparten origen —y compartirán dominio— sin que ninguna
    // necesite saber de la otra.
    //
    // Ambas son exportaciones estáticas: no hay servidor que se caiga cuando el
    // equipo pierde la señal.
    const sitio = new sst.aws.StaticSite("Elrey_radar", {
      build: {
        command: "node scripts/construir-sitio.mjs",
        output: "salida-sitio",
      },
      environment: {
        NEXT_PUBLIC_API: api.url,
        // De aquí sale la URL de cada foto de producto. El catálogo solo guarda
        // la clave dentro del bucket.
        NEXT_PUBLIC_IMAGENES: cdnImagenes.url,
        NEXT_PUBLIC_COGNITO_CLIENTE: clienteWeb.id,
        NEXT_PUBLIC_COGNITO_REGION: "us-east-1",
        // Ajustes de la tienda que no son infraestructura: el pixel de Meta, el
        // enlace de cobro de Clip y el webhook que avisa de cada pedido. Llegan
        // del entorno del despliegue —variables del repositorio en GitHub— y no
        // se escriben aquí porque cambian sin que cambie la nube. Vacíos, la
        // tienda funciona igual y simplemente no usa esa pieza.
        NEXT_PUBLIC_META_PIXEL: process.env.NEXT_PUBLIC_META_PIXEL ?? "",
        NEXT_PUBLIC_CLIP_LINK: process.env.NEXT_PUBLIC_CLIP_LINK ?? "",
        NEXT_PUBLIC_WEBHOOK_PEDIDOS: process.env.NEXT_PUBLIC_WEBHOOK_PEDIDOS ?? "",
      },
    });

    return {
      api: api.url,
      sitio: sitio.url,
      tabla: tabla.name,
      pool: usuarios.id,
      clienteCognito: clienteWeb.id,
      bucket: fotos.name,
      catalogo: catalogo.name,
      imagenes: imagenes.name,
      cdnImagenes: cdnImagenes.url,
    };
  },
});
