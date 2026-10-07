# ADR 0117 — Lo que se levanta escucha solo en el equipo, y la aplicación no es dueña de la base

Fecha: 2026-10-07 · Estado: aceptada · Completa a
[ADR 0047](./0047-la-ia-es-un-perfil-no-un-fichero.md) y
[ADR 0078](./0078-los-topes-se-cuentan-con-la-direccion-que-vio-nuestro-proxy.md)

## Contexto

La auditoría de infraestructura del 7 de octubre de 2026 leyó `compose.yml`, el
`Dockerfile`, la integración continua y las dependencias pensando en el día en que
esto se levante en un VPS, y encontró que **levantarlo tal cual en un servidor era
publicar la base de datos**:

| Qué                                                        | Por qué importa                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Postgres, Ollama y la aplicación publicados en `0.0.0.0`   | Docker escribe sus reglas por delante de `ufw`: el cortafuegos dice «cerrado» y el puerto está abierto |
| Postgres con `caos:caos` por defecto                       | La contraseña está en el README                                                                        |
| La aplicación conectada como superusuario                  | Una inyección de SQL sería la máquina entera: `COPY … FROM PROGRAM`, crear roles, borrar tablas        |
| `upgrade-insecure-requests` siempre                        | Servida por http desde la red de casa, 18 recursos con `ERR_SSL_PROTOCOL_ERROR`                        |
| Sin TLS hacia una base gestionada                          | `sslmode=require` en postgres.js cifra sin comprobar el certificado                                    |
| Imágenes por etiqueta móvil (`22-alpine`, `ollama:latest`) | Lo que se construye hoy no es lo de ayer, y no hay manera de saber qué entró                           |
| CI sin `permissions:` y acciones por etiqueta              | Repositorio público: una etiqueta movida ejecuta lo que quiera                                         |
| `pnpm audit --prod`: 2 altos (`sharp`, `source-map-js`)    | Viajan en la salida standalone                                                                         |
| `compose.yml` no pasaba `APP_URL`, `STRIPE_*` ni `MAIL_*`  | Puestas en el `.env`, no llegaban al contenedor                                                        |

Y una condición: **`pnpm docker:up` en casa tiene que seguir funcionando igual**,
con una base ya creada con `caos:caos` y con el Ollama nativo alcanzado por la IP
de `eth0` ([adr/0050](./0050-la-direccion-del-ollama-del-equipo-la-calcula-el-script.md)).

## Decisión

**Todo puerto publicado escucha en `127.0.0.1`**, con una variable por servicio
para abrirlo a propósito: `APP_ESCUCHA_EN`, `POSTGRES_ESCUCHA_EN`,
`OLLAMA_ESCUCHA_EN`. Abrir la aplicación a la red de casa —el móvil— es legítimo;
abrir Postgres u Ollama no tiene motivo, y por eso son variables separadas y no una.
Al Ollama nativo no le afecta: los contenedores salen hacia él, no entran.

**Sin contraseñas por defecto.** `POSTGRES_PASSWORD` y `POSTGRES_APP_PASSWORD` son
obligatorias (`:?` en compose). `scripts/docker-arriba.sh` las saca al azar al
escribir el `.env` —en hexadecimal, que va dentro de una URL—, con `umask 077`, y
**completa un `.env` de antes sin cambiar ninguna línea**: si falta
`POSTGRES_PASSWORD` y el volumen ya existe, apunta `caos`, que es con la que se
creó y Postgres no cambia al arrancar. `pnpm docker:db` pasa por el script por eso.

**La aplicación entra con un rol que solo toca filas.** El servicio de migraciones,
después de migrar, corre `scripts/rol-de-la-aplicacion.mjs` con el superusuario:
crea o ajusta `caos_app` con `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
NOBYPASSRLS`, le da `SELECT, INSERT, UPDATE, DELETE` en las tablas de `public` y
uso de sus secuencias, y deja privilegios por defecto para las tablas futuras.
**Corre en cada arranque**, no solo al crear la base: así una base de antes recibe
el rol sin borrar nada, y cada migración nueva, su permiso. Probado contra
Postgres (PGlite por socket): dos pasadas seguidas, rol sin poderes y los cuatro
permisos en la tabla.

**`upgrade-insecure-requests` solo cuando se llegó por https**: la petición, el
`X-Forwarded-Proto` del proxy —manda el primero— o un `APP_URL` con `https:`. La
cabecera la puede falsear cualquiera, y da igual: solo se rompe su propia página.

**TLS `verify-full` hacia fuera**: `tlsPara` en `server/db/client.ts`. Lo local
—`localhost`, `127.*`, `::1`, un nombre sin punto— va sin TLS; lo demás, con
certificado comprobado, **también si la cadena dice `require`**; cualquier otro
`sslmode` escrito se respeta.

**Imágenes con versión exacta y huella**, Ollama incluido aunque sea de desarrollo:
`latest` con la gráfica montada es código que nadie ha leído. Dependabot las sube,
junto con npm y las acciones de CI, fijadas por commit, con `permissions: contents:
read` y `pnpm audit --prod --audit-level high` como paso.

**La imagen no puede reescribirse**: ficheros de root y de solo lectura, proceso
`nextjs`, solo `.next/cache` escribible, `HEALTHCHECK` contra el icono, y el
`.env` que Next copia a `.next/standalone/` borrado aunque `.dockerignore` ya no lo
deje entrar. `.dockerignore` deja fuera además el audio, `banco-de-ia.txt`,
`.claude/` y la carpeta `undefined/`.

**Dependencias**: `overrides` para `sharp >=0.35.5` y `source-map-js >=1.2.2`, y
para los avisos de desarrollo (`brace-expansion`, `js-yaml`, `esbuild`); `vitest`
4.1.11, `jsdom` 30.1.2, `drizzle-kit` 0.31.11, `eslint-config-next` 16.3.8. Y
`images: { unoptimized: true }`: no se usa `next/image`, y así `sharp` no
redimensiona nada que pida un desconocido. `pnpm audit` pasa de 27 avisos (14
altos, 2 de producción) a 1: `braces`, por ESLint, cuyo arreglo no se ha publicado.

## Consecuencias

`docker compose up` a secas, sin `.env`, ya no arranca: dice qué falta y que
`pnpm docker:up` lo escribe. Ya pasaba con `AUTH_SECRET`.

**La aplicación del Docker de casa ya no se ve desde el móvil** sin
`APP_ESCUCHA_EN=0.0.0.0` en el `.env`. Es la única cosa que cambia en casa, y es a
propósito: abrirla tiene que ser una decisión.

`DATABASE_URL` del `.env` sigue siendo la del superusuario, porque la usan
`pnpm dev`, `pnpm db:migrate` y `pnpm db:studio`, y migrar lo pide. El rol mínimo
es para lo que se sirve dentro de compose.

Una IP privada de otra máquina sin TLS ahora falla al conectar hasta que se
escriba `?sslmode=disable`. Es mejor fallar ahí que mandar los hashes en claro.

**Lo que no se ha comprobado**: construir la imagen —Docker Desktop estaba apagado
y no se encendió— y levantar compose entero con el rol nuevo. `docker compose
config` valida, y el script del rol se probó aparte.

## Alternativas descartadas

**Un `compose.prod.yml` sin `ports:`.** Es lo más limpio para un servidor, pero
deja el `compose.yml` de casa publicando en `0.0.0.0`, y el que se copia a un VPS
es el que hay. Mejor que el único fichero sea seguro por defecto.

**Una sola variable para los tres puertos.** Abrir la aplicación al móvil abriría
también Postgres y Ollama, que es justo lo que no se quiere.

**Contraseña obligatoria solo «fuera de desarrollo».** Compose no sabe en qué
entorno está; inventarle un modo es otra variable que olvidar. Obligatoria siempre,
y generada por el script, cuesta lo mismo en casa.

**El rol en `docker-entrypoint-initdb.d`.** Solo corre con el volumen vacío: la base
de casa, y cualquiera creada antes, no lo recibiría nunca y la aplicación no podría
entrar.

**Que el rol lo cree la aplicación al arrancar.** Necesitaría el superusuario, que
es lo que se quiere quitarle.

**Subir Next a la 16.4 por `sharp`.** Pide `sharp ^0.35.4`, que ya admite la
arreglada: basta el lockfile y el `override` impide volver atrás. Un salto de
versión de Next mientras otros cuatro agentes tocan `src/` no se mide aquí.

**`eslint` 10 y `vitest` 5.** Arreglan lo mismo que los `overrides`, con un cambio
de versión mayor detrás. Para otro día y con su propia medida.

**Bajar el Ollama nativo a `127.0.0.1`.** Los contenedores no lo alcanzarían
(adr/0050) y es configuración del equipo del dueño: se explica en
`docs/DESPLIEGUE.md` y no se toca.
