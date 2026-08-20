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
    // `npx sst secret set Elrey_pin <valor> --stage produccion`.
    const pin = new sst.Secret("Elrey_pin");
    const jwtSecreto = new sst.Secret("Elrey_jwt_secreto");

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
      transform: {
        userPool: {
          name: "Elrey_usuarios",
          // Sin autoservicio por ahora: las cuentas del equipo las crea un
          // admin. Se abrirá cuando entre el registro de clientes, y aun
          // entonces el alta automática solo podrá caer en `clientes`.
          adminCreateUserConfig: { allowAdminCreateUserOnly: true },
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
    // sostiene todo el esquema.
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
      link: [tabla, fotos, pin, jwtSecreto, usuarios, clienteWeb],
      name: `Elrey_api_${$app.stage}`,
      memory: "512 MB",
      timeout: "20 seconds",
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
        NEXT_PUBLIC_COGNITO_CLIENTE: clienteWeb.id,
        NEXT_PUBLIC_COGNITO_REGION: "us-east-1",
      },
    });

    return {
      api: api.url,
      sitio: sitio.url,
      tabla: tabla.name,
      pool: usuarios.id,
      clienteCognito: clienteWeb.id,
      bucket: fotos.name,
    };
  },
});
