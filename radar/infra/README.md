# Despliegue automático desde GitHub

Cada push a `main` que toque `radar/` despliega a AWS y corre las pruebas contra
producción. El workflow es [`.github/workflows/radar.yml`](../../.github/workflows/radar.yml).

**Sin llaves de acceso guardadas en GitHub.** El workflow pide un token temporal
por OIDC y asume un rol en tu cuenta. No hay nada que rotar ni que se pueda
filtrar en un log.

## Lo que ya está hecho

El proveedor OIDC de GitHub existe en la cuenta:

```
arn:aws:iam::637423567003:oidc-provider/token.actions.githubusercontent.com
```

## Crear o actualizar el rol

Crear el rol es una decisión de seguridad, así que la tomas tú.

Si ya existe y solo hay que corregir la confianza:

```bash
aws iam update-assume-role-policy --role-name Elrey_despliegue_github --policy-document file://radar/infra/confianza-github.json
```

Desde cero:

```bash
aws iam create-role \
  --role-name Elrey_despliegue_github \
  --assume-role-policy-document file://radar/infra/confianza-github.json \
  --description "Despliegue del Radar desde GitHub Actions"
```

```bash
aws iam attach-role-policy \
  --role-name Elrey_despliegue_github \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

Y en GitHub: **Settings → Secrets and variables → Actions → New secret**, con
nombre `RADAR_PIN` y el código del equipo como valor. Lo usa el paso de pruebas.

## Por qué el `sub` lleva números

GitHub emite el claim con **identificadores inmutables**: no manda
`repo:zValkyrion/Perfumeriav2-` sino
`repo:zValkyrion@140108264/Perfumeriav2-@1333411510`. Son el id del usuario y el
del repositorio, y existen para que renombrar cualquiera de los dos no rompa la
confianza — con el nombre en texto, un rename te dejaba el despliegue caído sin
rastro del motivo.

El efecto secundario es cruel de depurar: la política "se ve" perfecta, el token
se emite bien, y STS responde un escueto `Not authorized` sin decir qué claim no
coincide. Se descubre consultando
`gh api repos/OWNER/REPO/actions/oidc/customization/sub`, que devuelve el prefijo
real.

La política acepta las dos formas, así que funciona con o sin identificadores
inmutables. Ambas entradas son exactas —no hay comodines—, de modo que no se
afloja nada.

## Por qué AdministratorAccess, y qué significa

SST crea y modifica roles de IAM (uno por Lambda), buckets, distribuciones de
CloudFront y tablas de DynamoDB. Una política recortada a mano se rompe en cuanto
se añade un recurso nuevo, y el fallo aparece a mitad de un despliegue.

El control real está en **quién puede asumir el rol**, no en qué puede hacer:
[`confianza-github.json`](confianza-github.json) lo limita a
`repo:zValkyrion/Perfumeriav2-:ref:refs/heads/main`. Ni otro repositorio, ni otra
rama, ni un fork, ni una pull request pueden asumirlo.

**Dicho claro:** con esto, quien pueda hacer push a `main` puede hacer cualquier
cosa en la cuenta de AWS. Es el mismo poder que ya tiene quien despliega desde su
laptop con el perfil de administrador, pero conviene saberlo y proteger `main`
con revisión obligatoria si algún día entra más gente al repositorio.

Si prefieres recortarlo, el camino es `PowerUserAccess` + `IAMFullAccess`, que en
la práctica es casi lo mismo, o una política a medida que habrá que mantener.

## Comprobar que quedó bien

```bash
aws iam get-role --role-name Elrey_despliegue_github \
  --query "Role.AssumeRolePolicyDocument.Statement[0].Condition"
```

Después, en GitHub: pestaña **Actions → Desplegar Radar a AWS → Run workflow**.
Si el rol o el secreto faltan, el workflow falla ahí y no toca nada de producción.
