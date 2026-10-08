# Publicar

Qué hace falta para poner esto en internet, y qué se rompe según dónde.

**Esto no se ha desplegado nunca.** Hoy la aplicación corre en un equipo. Lo que
sigue es lo que pediría hacerlo, comprobado leyendo el código y no ejecutándolo;
la lista de lo que falta para publicar y cobrar está en
[PARA-PUBLICAR.md](./PARA-PUBLICAR.md).

## Lo que la aplicación necesita del sitio donde viva

**Un servidor de Node.** No vale un alojamiento estático. Hay **dos** rutas de IA
que corren en el servidor y que existen precisamente para que la clave del modelo no
llegue nunca al navegador:

- `/api/teacher` — el profesor.
- `/api/salidas` — las salidas: por dónde puede seguir lo que llevas tocado. Es
  la más cara de las dos.

Las dos pasan por las mismas puertas —frecuencia, cuenta y cupo— y están en un
solo sitio, `server/ai-gate.ts`.

Todo lo demás —afinador, rueda, mástil, acordes, metrónomo, grabación— corre en
el navegador y funcionaría hasta en un servidor de ficheros.

**HTTPS.** El micrófono solo se concede en un origen seguro. En
`localhost` el navegador hace la excepción; en cualquier otro sitio, sin
certificado no hay permiso y la aplicación entera se queda muda.

**Postgres, solo si quieres cuentas** —y la analítica, que vive en la misma base
([adr/0110](./adr/0110-contar-sin-seguir.md))—. Las tablas están en
`src/server/db/schema.ts`, y esta es la única parte que necesita base de datos.

**Sin `DATABASE_URL` la aplicación funciona entera y sin cuentas**, igual que
funciona sin la clave de Anthropic: todo el mundo anónimo, plan gratis, sesiones en
IndexedDB y avance en `localStorage`. Así era antes de que existieran las cuentas y
así sigue siendo si no se configura ninguna. Un despliegue nuevo tampoco pierde nada
en ese modo, porque no hay nada de nadie.

Lo que **nunca** hace falta guardar en ningún sitio: el audio. Eso no sale del
equipo de quien toca y las cuentas no han cambiado eso.

## Variables de entorno

| Variable                                             | Hace falta                | Para qué                                                                                                                                                                                                  |
| ---------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                                  | Solo para la IA           | Las dos rutas. Sin ella contesta el modelo de casa si lo hay, y si tampoco, el dominio; en producción se contesta 503.                                                                                    |
| `OLLAMA_URL` / `OLLAMA_MODEL`                        | No                        | Un modelo en tu equipo para probar sin clave y sin factura. **La clave le gana**: con las dos puestas contesta la API.                                                                                    |
| `ANTHROPIC_MODEL`                                    | No                        | Cambiar de modelo sin tocar código. Por defecto, `claude-sonnet-5-5`. **Cambia los cupos de todos los planes**: ver abajo.                                                                                |
| `DATABASE_URL`                                       | Solo para cuentas         | Postgres. Sin ella no hay cuentas ni planes, y todo lo demás funciona igual.                                                                                                                              |
| `AUTH_SECRET`                                        | Solo para cuentas         | Firmar la cookie de sesión. `openssl rand -base64 32`. **Con menos de 32 caracteres cuenta como ninguno**: sin cuentas y un aviso al arrancar (`server/secreto.ts`).                                      |
| `APP_URL`                                            | Cobro y correo            | La dirección pública. De ella salen el enlace del correo de la contraseña y a dónde vuelve quien paga. Sin ella se supone `http://localhost:3000`, que en producción manda a la gente a su propio equipo. |
| `STRIPE_SECRET_KEY`                                  | Solo para cobrar          | La clave de la pasarela. **Va con el secreto del webhook**: sin ella cada pago contesta 500, porque el webhook pregunta a Stripe antes de dar un plan (adr/0077).                                         |
| `STRIPE_WEBHOOK_SECRET`                              | Solo para cobrar          | El secreto del endpoint, para comprobar la firma. **Sin él el webhook no acepta nada.**                                                                                                                   |
| `STRIPE_PRICE_BASICO` / `_MEDIO`                     | Solo para cobrar          | Qué precio de Stripe es cada plan, al mes. Son distintos en la cuenta de pruebas y en la de verdad.                                                                                                       |
| `STRIPE_PRICE_BASICO_ANUAL` / `_MEDIO_ANUAL`         | Solo para cobrar          | Los mismos planes, al año (adr/0106). **Hacen falta también**: la pantalla ofrece el anual siempre.                                                                                                       |
| `TRUSTED_PROXY_HOPS`                                 | En producción             | Cuántos proxies de confianza hay delante. **Sin ella no se cree `X-Forwarded-For`**, todo el mundo comparte los topes y el arranque lo avisa en grande; `0` es «sin proxy, a sabiendas»: abajo.           |
| `MAIL_API_KEY` / `MAIL_FROM`                         | Solo para correo          | El proveedor de correo (Resend) y el remitente. Sin las dos, `/olvidada` dice que esta copia no manda correo.                                                                                             |
| `TITULAR_NOMBRE` / `_NIF` / `_DOMICILIO` / `_CORREO` | **Para abrir al público** | Quién publica, para el aviso legal y la política de privacidad (LSSI art. 10). Sin ellas, las dos páginas dicen que faltan ([adr/0111](./adr/0111-la-edad-se-declara-y-el-titular-se-configura.md)).      |
| `TITULAR_ALOJAMIENTO`                                | **Para abrir al público** | Quién aloja el servidor y dónde, en una frase. La política de privacidad lo nombra: guarda registros de acceso aunque la aplicación no guarde ninguno.                                                    |
| `METRICAS_CLAVE`                                     | No                        | La clave para leer la analítica en `GET /api/metricas`. Sin ella esa ruta no existe; contar se cuenta igual ([adr/0110](./adr/0110-contar-sin-seguir.md)).                                                |
| `IA_TOPE_DIARIO_USD` / `IA_TOPE_MENSUAL_USD`         | No, pero mírala           | El techo de gasto en el modelo **entre todos**, en dólares. De serie 10 y 150. Al tocarlo, la IA se cierra para todos con un 503 hasta mañana o el día uno (adr/0114). Con clientes, súbelo: abajo.       |
| `IA_TOPE_GRATIS_DIARIO_USD` / `_MENSUAL_USD`         | No, pero mírala           | El mismo techo **solo para el plan gratis**, más bajo y aparte: 2 y 30 de serie. Un ataque con cuentas gratis cierra lo gratis y no lo que se paga.                                                       |

`DATABASE_URL` y `AUTH_SECRET` van **juntas**: hacen falta las dos, y con una sola la
aplicación se comporta como si no hubiera ninguna. Es a propósito: media configuración
de cuentas es peor que ninguna, porque falla al entrar en vez de decir que aquí no hay
cuentas.

**Las seis de Stripe también van juntas**, y por lo mismo: `stripeConfigured()` —que `billing()` consulta— comprueba que
estén la clave y los cuatro precios —dos planes, al mes y al año—, y si falta
cualquiera devuelve el cobrador que no cobra. `STRIPE_PRICE_PRO` ya no se lee: Pro se
fundió en Medio (adr/0104). Media configuración de pasarela sería una ventana de pago que promete cobrar y
no puede. **En producción, ese cobrador no regala nada**: fuera de producción cambia
el plan al pulsar, y en producción (`NODE_ENV=production`, que es lo que pone el
`Dockerfile`) es `CobroCerrado`, que deja bajar a gratis y no deja subir. Antes
regalaba el plan de arriba a quien pulsara el botón en cualquier copia publicada a la que
le faltara una variable. Para probar los planes en el Docker de casa están las
cuentas de `pnpm usuarios:prueba`, una por plan.

Ninguna lleva el prefijo `NEXT_PUBLIC_`, así que Next no las mete en el bundle
del navegador. Si alguna vez añades una que sí lo lleve, ten claro que eso es
publicarla. **Las del titular tampoco lo llevan aunque sean públicas**: las
`NEXT_PUBLIC_` se escriben al construir, y el camino del contenedor construye sin
variables; leídas en el servidor valen las del arranque.

## La primera copia pública, sin cobro: los pasos

Lo que tiene que hacer una persona, en orden. **Nada de esto se ha hecho todavía**;
al lado de cada paso, qué parte está probada y cuál no. Sin las variables de Stripe
y con `NODE_ENV=production` no se cobra a nadie (`CobroCerrado`), así que publicar
así no pide pasarela.

1. **Los seis comandos en verde** en el equipo (`CLAUDE.md`). _Probado: es lo de
   cada día._
2. **Un dominio**, con su DNS a mano. Hace falta para el HTTPS —sin él no hay
   micrófono— y para el correo. _No hecho._
3. **La base de datos, en la UE.** Dos caminos:
   - **Neon** (Postgres gestionado; región Frankfurt), para ir con Vercel. Copia la
     cadena de conexión. _No probado contra Neon_: el cliente abre una sola conexión
     (`max: 1` en `server/db/client.ts`), que es lo que pide una función; si Neon da
     una cadena con _pooler_, esa es la de la aplicación.
   - **El Postgres de `compose.yml`** en un servidor propio. _Probado en casa_ (1 de
     agosto de 2026), nunca en un servidor público.
4. **Las migraciones, antes de arrancar la versión nueva**:
   `DATABASE_URL=… pnpm db:migrate` desde tu equipo, o el contenedor `migraciones` de
   compose. _Las ocho (0000 a 0007) las aplica a un Postgres 17 de verdad el trabajo
   `postgres` de la integración continua; la 0006 —la analítica y la edad declarada—
   y la 0007 —el techo de gasto y el plazo de gracia— no se han aplicado a mano a una
   base con datos._
5. **Las variables** de la tabla de arriba:
   - Siempre: `DATABASE_URL`, `AUTH_SECRET` (`openssl rand -base64 32`),
     `APP_URL=https://tu-dominio`, `TRUSTED_PROXY_HOPS=1` y las cinco `TITULAR_*`.
   - Para el profesor con un modelo de verdad, `ANTHROPIC_API_KEY`. Sin ella contesta
     el dominio, y la política de privacidad lo dice sola. _Contra la API no se ha
     medido la inyección_ ([PARA-PUBLICAR.md](./PARA-PUBLICAR.md)).
   - Para recuperar la contraseña, `MAIL_API_KEY` y `MAIL_FROM` (paso 7).
   - Para leer la analítica, `METRICAS_CLAVE`.
   - **Ninguna de Stripe.**
6. **Publicar**, por uno de los dos caminos:
   - **Vercel**: importar el repositorio, poner las variables en «Production» y la
     región de las funciones en Frankfurt (`fra1`), cerca de la base.
     `TRUSTED_PROXY_HOPS=1`. _No probado: nunca se ha desplegado._
   - **Un VPS**: la imagen del `Dockerfile` detrás de **un proxy con certificado**
     (Caddy lo saca solo; nginx con certbot). **El puerto 3000, cerrado a
     internet**: si se llega a Next sin pasar por el proxy, `TRUSTED_PROXY_HOPS` deja
     de valer. _La imagen está probada en casa; detrás de un proxy de verdad, no._
7. **El correo**: alta en Resend, verificar el dominio (sus registros SPF y DKIM en
   el DNS) y `MAIL_FROM` con una dirección de ese dominio. Probar `/olvidada` de
   punta a punta. _Nunca probado contra un proveedor de verdad._
8. **Comprobar a mano, ya publicada**:
   - `/aviso-legal` y `/privacidad` sin ningún «sin configurar», y nombrando el
     modelo que de verdad contesta.
   - Crear una cuenta: pide la edad, y con «Tengo menos» no la crea.
   - Abrir el micrófono en `/afinar` desde un teléfono, por HTTPS.
   - `curl -H "Authorization: Bearer $METRICAS_CLAVE" https://tu-dominio/api/metricas`
     contesta, y al día siguiente hay visitas sumadas.
   - Ocho registros seguidos desde una misma dirección: a partir del sexto, 429. Si
     no, `TRUSTED_PROXY_HOPS` está mal.
9. **Lo legal que no es código**: que alguien que sepa lea los dos textos; que
   Anthropic siga en la lista del Marco de Privacidad de Datos
   (dataprivacyframework.gov) si se usa su API; y aceptar el acuerdo de tratamiento
   de datos del alojamiento, de la base y del correo. Está en
   [PARA-PUBLICAR.md](./PARA-PUBLICAR.md#para-abrir-al-público-sin-cobrar).

## Las migraciones

Se generan a mano y viven en `drizzle/`, dentro del repositorio:

```bash
pnpm db:generate   # después de tocar src/server/db/schema.ts
pnpm db:migrate    # aplica lo pendiente; necesita DATABASE_URL
```

**No se aplican al arrancar la aplicación.** Migrar al levantarse funciona muy bien
hasta el día en que se despliegan dos instancias a la vez. Se aplican a mano, o en un
paso propio del despliegue, antes de publicar la versión nueva.

## Antes de publicar

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm coverage
pnpm build
```

Los seis de después de instalar tienen que pasar —son los de `CLAUDE.md`—. `pnpm build` es el que de verdad se parece a
producción: es el único que compila las rutas y avisa si algo del servidor se ha
colado en el cliente.

Ninguno necesita base de datos ni claves. Los tests corren contra PGlite, un Postgres en memoria,
migrado una vez por pasada ([adr/0121](./adr/0121-la-base-de-los-tests-se-migra-una-vez-y-el-reloj-corre-aparte.md)),
y en la integración continua un trabajo repite los que levantan base contra un
Postgres 17 de verdad con el rol de la aplicación.

## Las cabeceras de seguridad, que las pone la aplicación

No hay que configurarlas en el sitio donde viva: las escribe `src/proxy.ts`
en cada respuesta, así que valen igual en Vercel, en un contenedor y en un
servidor propio. Si el sitio añade las suyas, gana la suya; conviene mirarlo.

Se llamaba `middleware.ts` hasta Next 16, que dejó ese nombre en desuso: hace lo
mismo, y lo que cambia sin decirlo es que **`proxy` corre en Node** y no en el
runtime de borde. Para estas cabeceras da igual; si algún día se le pide algo que
solo exista en uno de los dos, conviene saberlo.

- **`Content-Security-Policy`** con un número de un solo uso por petición. La
  aplicación no carga nada de fuera —ni un guion, ni una hoja, ni una fuente, ni
  una imagen, ni una petición—, así que la política es `'self'` y poco más. Los
  guiones en línea —el del tema y los que Next escribe para enviar la página a
  trozos— van con ese número, **no con `'unsafe-inline'`**: con él, la política
  dejaría de proteger de lo único de lo que protege.
- **`Permissions-Policy`** declara el micrófono y cierra cámara, ubicación, pagos
  y USB. Es la manera de decir por escrito lo que `CUENTAS-Y-PLANES.md` promete.
- **`X-Content-Type-Options`**, **`Referrer-Policy`**,
  **`Strict-Transport-Security`** y **`Cross-Origin-Opener-Policy: same-origin`**
  —que una página ajena abierta desde aquí no pueda tocar esta pestaña—, que son
  cuatro líneas y no se discuten.
- Y **sin `X-Powered-By`**, que esa la pone Next y se apaga en `next.config.ts`
  (`poweredByHeader: false`): decir con qué está hecha solo le sirve a quien busca
  qué fallo conocido tiene.

`style-src` sí lleva `'unsafe-inline'`, y es a propósito: Tailwind y React
escriben estilos en el atributo `style` —el ancho de un bloque, el avance de una
barra— y no hay número que valga para eso. Un estilo inyectado puede afear la
página; no puede ejecutar nada.

Lo vigila `src/proxy.test.ts`, que comprueba que el número cambia en cada
petición y que `'unsafe-inline'` no se cuela en los guiones.

## Detrás de un proxy: de quién es cada petición

Los topes de frecuencia —entrar, registrarse, pedir el enlace de la contraseña, las
rutas de IA— cuentan por dirección, y la dirección sale de `X-Forwarded-For`. Esa
cabecera **la puede escribir el cliente**: cada proxy añade a la derecha la
dirección de quien le habló, y lo de la izquierda es lo que mandó cualquiera. Se
tomaba la primera, y la auditoría del 2 de octubre de 2026 lo reprodujo con doce
POST cambiándola: ninguno frenado, porque cada cabecera nueva era un contador nuevo.

Ahora se toma **la que puso el último proxy de confianza**, contando desde la
derecha (`requesterKey` en `server/rate-limit.ts`), y cuántos hay se dice en
`TRUSTED_PROXY_HOPS`:

| Delante de la aplicación                                        | `TRUSTED_PROXY_HOPS` |
| --------------------------------------------------------------- | -------------------- |
| Vercel, o un proxy inverso (nginx, Caddy) que añade la cabecera | `1`                  |
| Una CDN y, detrás, un proxy inverso                             | `2`                  |
| Nada: `next start` a pelo, o el Docker de casa                  | `0`                  |

**Sin ponerla no se cree ninguna cabecera**, ni esta ni `X-Real-IP`, y todas las
peticiones comparten un contador: frena de más, que es mejor que no frenar. No hay
manera mejor sin proxy, porque `next start` pone `X-Forwarded-For` con la dirección
del socket **solo si no venía ya**, y desde dentro no se distingue la suya de la del
cliente.

**Frenar de más aquí es mucho**: con un contador para todos, diez peticiones de
cualquiera dejan a todo el mundo un minuto sin registrarse y sin entrar (la IA tiene
el tope por minuto por cuenta, y el de dirección solo existe con esta variable). Por
eso, en producción y sin la variable, **el servidor lo dice al arrancar** con un
bloque de error en el registro (`src/instrumentation.ts`) y otra vez la primera vez
que pasa una petición. No se niega a arrancar —el Docker de casa sirve en producción
sin proxy, y ahí no hay valor correcto que poner—; **`TRUSTED_PROXY_HOPS=0`** dice
«no hay proxy, lo sé» y calla el aviso
([adr/0113](./adr/0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md)).

**Una IPv6 cuenta por su /64**, no por la dirección suelta: una casa o un servidor
alquilado reciben un /64 entero y cambiar de dirección dentro de él es gratis. Antes
de agrupar se normaliza la forma comprimida, el puerto y los corchetes, la zona
(`%eth0`) y la IPv4 escrita como IPv6 (`::ffff:192.0.2.1`), que vuelve a ser IPv4.

Un número de más es lo peligroso: con `2` y un solo proxy, la clave vuelve a ser lo
que escribe el cliente. Y vale solo si **nadie llega a la aplicación sin pasar por
el proxy**: si el puerto de Next está abierto a internet, cualquiera le habla
directamente y escribe la cabecera que quiera. **No se ha probado detrás de un proxy
de verdad**: no hay ninguna copia publicada.

## Camino 1: Vercel

Es la casa de Next y no necesita configuración: detecta el proyecto, compila y
sirve las rutas de IA como funciones.

```bash
npx vercel            # la primera vez pide entrar; abre el navegador
npx vercel --prod     # publica
```

La clave se pone una vez, desde el panel del proyecto o así:

```bash
npx vercel env add ANTHROPIC_API_KEY production
```

El login es interactivo a propósito —abre el navegador— así que este paso lo
tienes que dar tú; no se puede automatizar desde aquí sin darle un token a un
script.

## En tu equipo: la aplicación entera con Docker

`compose.yml` levanta tres cosas —Postgres, las migraciones y el servidor— y es la
única forma de probar aquí lo que necesita base de datos: entrar, registrarse,
cambiar la contraseña, el plan, la fusión del avance y el cupo de la IA.

```bash
pnpm docker:up          # todo, en http://localhost:3000
pnpm docker:db          # solo Postgres, para usarlo con `pnpm dev`
pnpm docker:down        # parar; con -v además borra los datos
```

`pnpm docker:up` es [`scripts/docker-arriba.sh`](../scripts/docker-arriba.sh), y lo
que hace además de llamar a compose es lo que se olvida: comprobar que el `docker`
del `PATH` no es el `.exe` de Windows —la trampa de WSL que ya mordió con `npx` y con
`mvnw`— y escribir un `.env` con un `AUTH_SECRET` recién generado si no hay ninguno.

Tres cosas que se aprenden la primera vez:

- **Las migraciones van en su propio contenedor**, no en el arranque de la
  aplicación. Migrar al levantarse funciona muy bien hasta el día en que se
  despliegan dos instancias a la vez. El servidor espera a que ese contenedor
  termine bien (`service_completed_successfully`).
- **Postgres arranca dos veces al crearse**, y por eso hay `healthcheck`: sin
  esperarlo, las migraciones pegan contra el arranque intermedio y fallan una vez
  de cada tres.
- **El puerto de fuera se mueve con `APP_PORT`.** El 3000 es el puerto por defecto
  de medio mundo, y si otro contenedor tuyo ya lo tiene, esto falla con un error que
  habla de «endpoint» y no de quién lo ocupa.

Comprobado el 1 de agosto de 2026 con Docker 29.4.2: las tablas de entonces se crean (hoy son once), se
registra una cuenta, se entra, se cambia el nombre y la contraseña —y con la vieja ya
no se entra—, se sube de plan, el avance se fusiona sin perder nada y el contador de IA
sube en `ai_usage`.

## Camino 2: un contenedor

El `Dockerfile` de la raíz construye la salida `standalone` de Next, que trae
solo lo que hace falta para correr: ni `node_modules` entero ni el código
fuente.

```bash
docker build -t caos-ordenado .
docker run -p 127.0.0.1:3000:3000 --env-file /etc/caos/produccion.env caos-ordenado
```

Las claves en un fichero y no con `-e`: lo que va en la línea de órdenes se queda
en el historial del intérprete y lo ve cualquier usuario de la máquina en `ps`. El
fichero, de root y `chmod 600`, con `ANTHROPIC_API_KEY`, `DATABASE_URL`,
`AUTH_SECRET`, `TRUSTED_PROXY_HOPS=1` y el resto de la tabla. Y el puerto en
`127.0.0.1`, por lo que cuenta [«Seguridad del servidor»](#seguridad-del-servidor).

`TRUSTED_PROXY_HOPS=1` es para el caso de siempre, **un proxy con certificado
delante**, que es el que hace falta para el HTTPS; con otro reparto, el número de
la tabla de arriba. Sin ella, todo el que entra comparte los mismos topes
([«Detrás de un proxy»](#detrás-de-un-proxy-de-quién-es-cada-petición)).

**Aquí es donde muerde una trampa que ya está resuelta, y conviene no
deshacerla.** En este camino se construye sin variables de entorno y se arranca con
ellas. El layout raíz lee la cuenta, y si al construir no hay base de datos ni
secreto, Next concluye —con lo que ve— que las páginas son estáticas y las
prerenderiza con la cuenta anónima dentro. Luego se sirve ese HTML aunque al
arrancar sí haya cuentas, y todo el mundo entra como anónimo hasta que el
JavaScript despierta.

Por eso `src/app/layout.tsx` lleva `export const dynamic = 'force-dynamic'`. Si
alguien lo quita para recuperar el prerenderizado, esto vuelve.

Sirve para cualquier sitio que acepte una imagen: Fly, Railway, Render, una
máquina propia. Recuerda el HTTPS: detrás de un proxy con certificado, o el
micrófono no arranca.

Lo que está comprobado: la salida `standalone` arranca y sirve —portada,
pantallas, estáticos y las rutas de API— y pesa 40 MB, y el `Dockerfile` construye
y corre. Se dijo aquí durante un tiempo que estaba escrito pero sin construir,
porque en el equipo donde se preparó no había Docker encendido; ya lo hay, y la
imagen es la misma que usa `compose.yml`.

## Camino 3: un servidor propio, sin contenedor

```bash
pnpm install --prod=false
pnpm build
ANTHROPIC_API_KEY=sk-ant-... pnpm start
```

Detrás de nginx o Caddy con certificado. `pnpm start` no sirve HTTPS por sí
mismo.

## Lo que no vale: alojamiento estático

GitHub Pages y compañía sirven ficheros, no ejecutan Node. Se puede publicar así
—`output: 'export'`— pero entonces desaparecen las rutas de la IA, y con ellas el
profesor y las salidas. El resto de la aplicación seguiría funcionando.

Si algún día interesa esa versión, lo honesto es que esas pantallas digan que
esa parte no está disponible en esta copia, no que fallen con un error de red.

## Lo que hay que saber una vez publicado

**El límite por minuto de la IA es por cuenta, no por dirección** (adr/0114). Defiende
contra pulsar veinte veces el botón de las salidas, que es para lo que se hizo, y con
base de datos se comparte entre instancias. Delante hay uno por dirección, más ancho
—sesenta por minuto— y **solo si `TRUSTED_PROXY_HOPS` dice de quién es cada
petición**: sin la variable, todas serían la misma, y diez anónimas dejaban sin IA a
todo el mundo.

**El cupo de las cuentas es compartido**, porque vive en Postgres, y sube y comprueba
su tope en la misma sentencia: dos peticiones a la vez no pueden gastar las dos la
última que quedaba. Sin cuenta no hay IA.

**Y por encima de todos los cupos, el techo de gasto** (`IA_TOPE_*_USD`, adr/0114),
porque el cupo acota a cada cuenta y las cuentas se fabrican: registrarse no confirma
el correo. Con quince preguntas gratis por cuenta, cien direcciones gastaban unos
650 $ por hora sin que nada lo parara. Ahora, con los valores de serie, lo más que se
puede gastar son **10 $ al día y 150 $ al mes**, y con cuentas gratis **2 y 30**. Dos
cosas que hacer al publicar:

1. **Ajusta el mensual a tus clientes.** Tiene que cubrir lo que pueden gastar las
   cuentas de pago —cada una, como mucho, el 40 % de lo que deja su plan:
   `monthlyBudgetMicros` en `core/billing/cost.ts`, 1,22 $ al mes una de Básico y
   2,45 $ una de Medio— más el techo de lo gratis. Si se queda corto, la IA se cierra
   también para quien paga, con un 503 que dice que no es su cupo; si sobra, es dinero
   que un ataque puede gastar.
2. **Pon además un límite de gasto en la consola de Anthropic**
   (`console.anthropic.com`, _Limits_), un poco por encima del mensual. Es del dueño
   de la clave y es el único que para lo que no pasa por aquí: una clave robada, otra
   copia con la misma clave o un fallo en esta cuenta. El techo de la aplicación no lo
   sustituye, y él tampoco al techo: el de la consola corta a todos de golpe y sin
   explicar nada.

**El modelo que pongas decide los cupos de todos los planes.** Los cupos se calculan
dividiendo lo que se puede gastar de cada plan —el 40 % de lo que entra sin IVA ni
comisión ([adr/0106](./adr/0106-el-margen-se-cuenta-sin-iva-y-con-pago-anual.md))—
entre lo que cuesta una pregunta al profesor con el modelo configurado
([adr/0008](./adr/0008-los-cupos-salen-del-precio.md)); una salida gasta tres, o dos
con los modelos que no dejan de pensar ([adr/0067](./adr/0067-el-cupo-se-cuenta-en-preguntas.md)).
Cambiar `ANTHROPIC_MODEL` los multiplica sin tocar código:

| `ANTHROPIC_MODEL`                 | Básico  | Medio   |
| --------------------------------- | ------- | ------- |
| `claude-sonnet-5-5` (por defecto) | 96/mes  | 193/mes |
| `claude-haiku-4-5`                | 192/mes | 386/mes |
| `claude-opus-5`                   | 38/mes  | 77/mes  |
| `claude-opus-5-5`                 | 18/mes  | 36/mes  |
| `claude-fable-5-1`                | 7/mes   | 14/mes  |

**Opus 5.5 es más barato por token que Opus 5 y da menos cupo**: no deja apagar el
pensamiento, y el tope de salida lleva 1.024 tokens de reserva para pensar que el coste
paga ([adr/0103](./adr/0103-los-modelos-vigentes-y-el-de-por-defecto.md)). Y **a cada
modelo se le manda solo lo que acepta**: antes iban `thinking: disabled` y
`effort: low` a todos, y con Opus 5.5, Fable, Sonnet 5.5 o Haiku 4.5 cada pregunta
era un 400.

Es potente y es un cañón: bajar de modelo sube los cupos y baja la calidad de las
respuestas, y de lo segundo no avisa nada. Un modelo que no esté en la tabla de precios
se cobra como Fable y pensando, así que los cupos salen pequeños —siete preguntas al
mes en Básico— en vez de regalarse. **Los vigentes están todos en la tabla**: un
modelo nuevo de la API hay que añadirlo a `MODEL_PRICES` con lo que acepta antes de
ponerlo aquí.

**La IA pide cuenta.** Sin `DATABASE_URL` y `AUTH_SECRET` no hay cuentas, y sin cuentas
las rutas de IA contestan `401`: la aplicación funciona entera menos el profesor y
las salidas. Es a propósito —sin cuenta no hay a quién contarle el gasto— y está razonado
en [adr/0008](./adr/0008-los-cupos-salen-del-precio.md).

**La IA cuesta dinero, y ahora hay a quién cobrárselo… pero no se le cobra.** Los
planes, sus permisos y sus cupos están puestos y funcionando, y detrás del
cobro hay una interfaz ([adr/0006](./adr/0006-planes-y-puerto-de-facturacion.md))
cuya implementación de Stripe **nunca se ha ejecutado**. Sin Stripe configurado:

- **Fuera de producción**, cualquiera con una cuenta puede darse el plan Medio y su
  cupo, entrando en `/planes/medio` y pulsando un botón (`FakeBilling`).
- **En producción no**: el cobrador es `CobroCerrado`, que deja bajar a gratis y
  contesta que no se ha podido al subir. Nadie tiene más plan que el que le den las
  cuentas de prueba o la base de datos.

La pantalla de planes avisa de que aquí no se cobra en los dos casos: lo dice porque
el cobrador declara que no cobra, no porque alguien se acordase de escribirlo.

**La escena del encabezado son ocho kilobytes**: tres capas y una hoja de
fotogramas en PNG con paleta (`app/EscenaPortada.tsx`,
[adr/0069](./adr/0069-la-portada-es-una-escena-de-pixel.md)). La hoja de fotogramas
solo se pide si quien mira acepta movimiento y no tiene puesto el ahorro de datos.

**`next start` comprime con gzip, no con Brotli.** Lo que Next hace por su cuenta
es gzip, y Brotli le saca a un paquete de JavaScript en torno a un quince o veinte
por ciento más. En Vercel lo pone la propia plataforma; en un contenedor o un
servidor propio lo tiene que poner **lo que haya delante** —el proxy inverso o la
CDN—, y entonces conviene apagar la de Next (`compress: false` en
`next.config.ts`) para no comprimir dos veces.

**No hay `public/`, y es a propósito.** Lo que Next sirve desde ahí no lleva huella
en el nombre, así que sale con `Cache-Control: max-age=0` y se vuelve a validar en
cada visita: le pasaba al vídeo de la portada. Las imágenes de la escena que lo
sustituye se piden con `url()` desde su hoja de estilos, y por eso el empaquetador
las copia a `.next/static/media/` con huella —`fondo.2xah….png`— y caché larga, sin
tocar ni el proxy ni `next.config.ts`. **Lo que se añada a la página va por ahí**, y
no a una carpeta pública: si vuelve a hacer falta una, hay que devolver su `COPY` al
`Dockerfile`, que hoy no la copia porque no existe.

## Cobrar de verdad

Sin las variables de Stripe, `billing()` devuelve el cobrador que no cobra: los
planes funcionan, se pueden activar y la ventana de pago **dice que no se está
cobrando nada**. Es lo que hace que un clon recién bajado funcione entero sin
configurar una pasarela.

Con ellas puestas, la misma ventana deja de decirlo sola —el aviso cuelga de
`billing().charges`, no de una constante— y al confirmar se sale a la página de pago
de Stripe. Los datos de la tarjeta no pasan por aquí en ningún momento.

**Stripe como vendedora oficial (Managed Payments)**
([adr/0105](./adr/0105-la-pasarela-y-los-precios-por-pais.md)): así cobra y declara
ella el IVA de cada país, de la Unión y de Latinoamérica. Pide tres cosas en el panel
que el código no puede hacer: tener la cuenta aprobada para Managed Payments, poner a
cada producto el código fiscal de software como servicio para uso personal
(`txcd_10103000`) y crear los cuatro precios **con el IVA incluido**, que es lo que
suponen los cupos. Si la sesión de Checkout pide algún parámetro para activarlo, se
añade en `server/billing/stripe.ts`; está en [PARA-PUBLICAR.md](./PARA-PUBLICAR.md)
entre lo que hay que comprobar con una clave de pruebas.

### El webhook

```
POST /api/pago/webhook
```

Es lo que cambia el plan cuando el dinero ha entrado, y es la parte que hay que
configurar con cuidado:

1. En Stripe, crea un endpoint apuntando a `https://tu-dominio/api/pago/webhook`.
2. Suscríbelo a cuatro avisos: `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `customer.subscription.updated` y
   `customer.subscription.deleted`.
3. Copia su secreto de firma en `STRIPE_WEBHOOK_SECRET`.
4. En el portal de cliente de Stripe, activa **cambiar de plan** con los cuatro
   precios. Pasar de un plan de pago a otro —y de mensual a anual— va por ahí y no
   por otro Checkout: con suscripción viva, otro Checkout crea una segunda y se cobran
   las dos.

Qué hace con cada aviso:

- **Pagado** (los dos de `checkout.session`): si `payment_status` es `paid` o
  `no_payment_required`, guarda el plan, el cliente y la suscripción de una vez. Con
  `unpaid` —un adeudo bancario que tarda días— no sube nada, y espera al
  `async_payment_succeeded`. El plan sale de los metadatos de la sesión, porque el
  aviso **no trae `line_items`**: Stripe no los incluye si no se piden.
- **Cambiada o borrada**: del aviso solo se lee **qué suscripción es**; cómo está se
  le pregunta a Stripe (adr/0114), porque Stripe reintenta durante días y sin orden, y
  un `active` que llegaba después del `unpaid` devolvía el plan. Con `active` o
  `trialing`, el plan del precio que se cobra; con `unpaid` o `paused`, gratis; con
  `canceled`, `incomplete_expired` o si ya no existe, gratis y se suelta; con
  `incomplete` no toca nada. **Con `past_due` empiezan siete días de gracia**
  (`DIAS_DE_GRACIA`): Stripe está reintentando el cobro y su guía pide avisar, no
  cortar, pero sin plazo una tarjeta muerta conservaba el plan para siempre si Stripe
  no estaba configurado para acabar en `unpaid`. Pasada la semana, la cuenta se lee
  como gratis; en cuanto Stripe cobra, vuelve. Si Stripe no contesta, 500 y lo
  repite.

Los dos de la suscripción se aplican **a quien la tenga guardada**, no a quien digan
los metadatos. Así funciona la baja —que llega con la suscripción y no con la
sesión, y antes por eso se ignoraba— y un aviso viejo que llegue tarde no encuentra
a nadie. Los metadatos van igualmente en la suscripción (`subscription_data`), para
ver de quién es desde el panel de Stripe.

Cabecera de firma ausente o cuerpo de más de 128 KB: 400 sin leer más.

**Sin ese secreto el webhook no acepta nada**, y eso es a propósito: un webhook sin
comprobar la firma es un formulario público para darse el plan que se quiera. La comprobación
está en `server/billing/stripe-signature.ts`, no usa el SDK y está probada aparte:
firma buena, cuerpo cambiado, secreto distinto, firma caducada, marca de tiempo en el
futuro y secreto rotado.

Para probarlo en local, `stripe listen --forward-to localhost:3000/api/pago/webhook`
da un secreto de pruebas que vale para lo mismo.

### Lo que hay que saber

- **El plan lo cambia el webhook, no la vuelta del pago.** Volver de Stripe a
  `/cuenta?pago=hecho` no significa que el dinero haya entrado; significa que el
  navegador ha vuelto. Si el plan tarda unos segundos en aparecer, es esto.
- **Los reintentos son normales.** Stripe repite los webhooks que no contesta 2xx, y
  esta ruta es idempotente porque lo único que hace es poner un plan. Los eventos que
  no le interesan los acepta y los ignora: contestar error los pondría en cola de
  reintentos para siempre.
- **Borrar la cuenta también cancela antes** (adr/0114): si Stripe no contesta, no se
  borra nada. Antes se borraba la cuenta y Stripe seguía cobrando a quien ya no
  existía.
- **Cancelar cancela en Stripe primero** (`DELETE /v1/subscriptions/:id`, en el
  momento) y solo después baja el plan, sin esperar al webhook. Antes bajaba el plan
  y no avisaba a Stripe, que seguía cobrando. Si Stripe no contesta, el plan no se
  toca y la pantalla dice que no se ha podido: mejor reintentar que pagar sin plan.
- **El portal abre con el cliente guardado**, no buscándolo por correo: Checkout
  con `customer_email` crea un cliente nuevo cada vez, y la búsqueda daba uno
  cualquiera.
- **Nada de esto se ha ejecutado contra Stripe.** Los nombres de campos, avisos y
  estados salen de su documentación, y la firma, la traducción de precios, las
  llamadas y las respuestas del webhook están probadas con avisos con la forma que
  documenta Stripe; que la API conteste lo que se espera, no. Es lo primero que hay
  que hacer con una clave de pruebas y `stripe listen`.

## Recuperar la contraseña

Va con las dos variables de correo. Sin ellas, `/olvidada` dice que esta copia no
manda correo en vez de enseñar un formulario que no puede terminar en nada, y la
contraseña solo se cambia sabiéndola desde `/cuenta#contrasena`.

Con ellas puestas, el enlace aparece en la pantalla de entrar. El vale caduca en
una hora, vale una sola vez, y usarlo **cierra las sesiones abiertas en otros
aparatos**: quien recupera la contraseña suele estar haciéndolo porque alguien más
entró.

En la base de datos se guarda la **huella** del vale, no el vale
([adr/0013](./adr/0013-el-correo-como-puerto.md)). En desarrollo, sin proveedor
configurado, el correo que se habría mandado se escribe en el registro del
servidor y el flujo entero se puede probar sin dar de alta nada: eso es lo que
significa que `NoMailer.sends` valga `true` fuera de producción. En producción no
se escribe —sería dejar el vale en los registros— y la pantalla dice que aquí no
se puede recuperar la contraseña.

**El flujo está probado contra Postgres** (25 de agosto de 2026). Lo que sigue sin
probarse es que un proveedor de envío de verdad conteste lo que se espera.

## Seguridad del servidor

Lo que un VPS pide además de la aplicación. Nada de esto se ha hecho en un servidor
público, porque no lo hay; lo de `compose.yml` y el `Dockerfile` está comprobado con
`docker compose config`, y el rol de la base contra un Postgres de verdad
([adr/0117](./adr/0117-lo-que-se-levanta-escucha-solo-en-el-equipo.md)).

**Docker se salta `ufw`.** Escribe sus reglas de iptables por delante de las del
cortafuegos, así que `ports: '5432:5432'` abre Postgres a internet aunque
`ufw status` diga que el 5432 está cerrado. Por eso **todo lo que publica
`compose.yml` escucha en `127.0.0.1`**: la aplicación, Postgres y Ollama. Al proxy
con certificado, en la misma máquina, le basta. Para abrir uno a propósito está
su variable —`APP_ESCUCHA_EN`, `POSTGRES_ESCUCHA_EN`, `OLLAMA_ESCUCHA_EN`—, y en un
servidor la respuesta es no: ni la base ni Ollama tienen nada que hacer fuera, y
la aplicación sin pasar por el proxy deja sin valor `TRUSTED_PROXY_HOPS`.

**El cuerpo de una petición no pasa de 128 KB**, y lo pone `next.config.ts`
(`experimental.proxyClientMaxBodySize`), no el proxy de delante. Las rutas propias
ya lo acotaban al leer (`server/request-body.ts`), pero **la entrada la lee Auth.js**
y el tope de serie de Next era de 10 MB: veinte entradas con un correo de 8 MB
llevaron el proceso de 46 a 687 MB. El de Next **recorta, no rechaza** —la ruta
recibe los primeros 128 KB y el registro dice «Request body exceeded»—; si se quiere
un 413 de verdad, se pone también en el proxy (`client_max_body_size 128k;` en
nginx, `request_body { max_size 128KB }` en Caddy). Además, la entrada contesta
«no» sin contar ni comprobar a un correo de más de 254 caracteres o una contraseña
de más de 1024 ([adr/0113](./adr/0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md)).

**Sin contraseñas por defecto.** Compose no arranca sin `POSTGRES_PASSWORD` ni
`POSTGRES_APP_PASSWORD`; antes daba `caos:caos`. En casa las genera
`pnpm docker:up`; en un servidor, `openssl rand -hex 24` para cada una.

**La aplicación entra con un rol de mínimos privilegios.** `caos_app` —o lo que
diga `POSTGRES_APP_USER`— solo puede `SELECT`, `INSERT`, `UPDATE` y `DELETE` en
las tablas de `public`: ni crear ni borrar tablas, ni `COPY … FROM` un fichero del
servidor, ni crear roles. El superusuario solo lo usa el contenedor de las
migraciones, que después de migrar da de alta ese rol
(`scripts/rol-de-la-aplicacion.mjs`; idempotente, corre en cada arranque). Con una
base gestionada fuera de compose se hace igual: migrar con la cadena del dueño de
la base y correr ese script con `DATABASE_URL`, `POSTGRES_APP_USER` y
`POSTGRES_APP_PASSWORD`; la aplicación, con la cadena del rol.

**TLS hacia la base.** Si `DATABASE_URL` apunta fuera del equipo —no es
`localhost`, `127.*`, `::1` ni un nombre sin punto como el `db` de compose—, la
conexión va cifrada y **comprobando el certificado** (`verify-full`), también
cuando la cadena trae el `sslmode=require` que pegan Neon o Supabase: en
postgres.js `require` cifra sin mirar a quién habla. Una IP privada de otra
máquina sin TLS se dice a propósito con `?sslmode=disable`, y cualquier otro
`sslmode` escrito se respeta (`tlsPara` en `src/server/db/client.ts`). Las
migraciones van por drizzle-kit, que no pasa por ahí: a una base gestionada,
con `sslmode=verify-full` escrito en la cadena.

**Copias de Postgres**: programadas, cifradas y fuera del servidor, o no son
copias. Un `pg_dump` diario por cron —`docker compose exec -T db pg_dump -U caos
-Fc caos`—, cifrado antes de salir (`age` o `gpg` con una clave que **no** vive en
el servidor) y subido a otro proveedor. Lo que no se ha restaurado no es una copia:
una vez al mes, `pg_restore` en una base vacía y entrar con una cuenta de prueba.
Una base gestionada trae las suyas; aun así, una exportación propia fuera de ella.

**Rotar `AUTH_SECRET`**, si se filtra o al irse alguien con acceso. Se cambia en el
fichero de variables y se reinicia. Lo que pasa: **todas las sesiones se cierran**
—la cookie va firmada con él— y todo el mundo vuelve a entrar, sin perder nada;
los seudónimos de la analítica cambian, así que ese día cada visitante cuenta dos
veces (`server/metricas.ts`), y se olvida el uso de IA heredado por correo de las
cuentas borradas, que dura un mes como mucho (`server/ai-usage.ts`). Nada más
depende de él: las contraseñas van con `scrypt` y su sal, y los vales de
recuperar la contraseña se guardan por su huella.

**Las claves, en un fichero y no en la línea de órdenes**: `docker run
--env-file`, o el `.env` de compose, de root y `chmod 600`. Con `-e CLAVE=…` se
quedan en el historial y en `ps`.

**`pnpm build` copia el `.env` a `.next/standalone/`.** Es Next, no nosotros, y
pasa en el Camino 3: quien construya en su equipo y suba `.next/standalone` al
servidor sube también sus claves de desarrollo. Se borra antes de copiar
(`rm -f .next/standalone/.env*`), o se construye en el servidor. La imagen de
Docker no lo lleva: `.dockerignore` no deja entrar ningún `.env`, y el
`Dockerfile` lo borra de todos modos.

**Parches.** Dependabot abre cada semana las actualizaciones de npm, de las
acciones de CI y de las imágenes (`.github/dependabot.yml`), y la integración
continua falla si una dependencia de producción tiene un aviso alto
(`pnpm audit --prod --audit-level high`). Las imágenes van con versión exacta y
huella, así que una base nueva entra solo cuando se acepta esa petición. En el
servidor, actualizaciones automáticas de seguridad del sistema
(`unattended-upgrades` en Debian/Ubuntu) y reconstruir la imagen al aceptar una
subida de Node o de Postgres. Hoy `pnpm audit --prod` está limpio; el total deja
uno de desarrollo sin arreglo publicado (`braces`, por ESLint).

**La imagen corre sin privilegios y no puede reescribirse**: el proceso es
`nextjs`, los ficheros son de root y de solo lectura, y solo `.next/cache` se
puede escribir. Tiene `HEALTHCHECK`, que pregunta por el icono.

### En el equipo de casa: el Ollama nativo escucha en todas las interfaces

`systemctl cat ollama` dice `Environment="OLLAMA_HOST=0.0.0.0:11434"`, y Ollama
**no tiene autenticación**: quien llegue al 11434 puede gastar la gráfica, bajar
modelos o borrarlos. Escucha en todas las interfaces porque los contenedores lo
alcanzan por la IP de `eth0` de WSL
([adr/0050](./adr/0050-la-direccion-del-ollama-del-equipo-la-calcula-el-script.md)),
así que pasarlo a `127.0.0.1` sin más deja la IA de `pnpm docker:up` apagada.

Con la red de WSL en NAT —la de serie, y la de este equipo: no hay `.wslconfig`—
a esa IP solo llegan Windows y lo que corre en WSL, no la red de casa. Deja de ser
así con `networkingMode=mirrored` o con un `netsh interface portproxy`, y entonces
es la red entera. Dos maneras de acotarlo, que **no se han aplicado** porque tocan
la configuración del equipo:

- **Una regla de cortafuegos** que solo deje entrar al 11434 desde el propio
  equipo y desde las redes privadas de WSL y Docker:

  ```bash
  sudo iptables -I INPUT -p tcp --dport 11434 -j DROP
  sudo iptables -I INPUT -p tcp --dport 11434 -s 172.16.0.0/12 -j ACCEPT
  sudo iptables -I INPUT -p tcp --dport 11434 -i lo -j ACCEPT
  ```

  No sobrevive a un reinicio sin `iptables-persistent`, y conviene comprobar
  después que `pnpm docker:up` sigue encontrando el modelo.

- **Usar el del perfil** (`pnpm docker:ia`), que ya escucha en `127.0.0.1` y la
  aplicación alcanza por su nombre, y apagar el nativo
  (`sudo systemctl disable --now ollama`) o dejarlo en `OLLAMA_HOST=127.0.0.1:11434`
  con `sudo systemctl edit ollama`. Los dos a la vez chocan en el 11434: el del
  perfil se mueve con `OLLAMA_PORT`.
