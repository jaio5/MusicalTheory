# Publicar

Qué hace falta para poner esto en internet, y qué se rompe según dónde.

**Esto no se ha desplegado nunca.** Hoy la aplicación corre en un equipo. Lo que
sigue es lo que pediría hacerlo, comprobado leyendo el código y no ejecutándolo;
la lista de lo que falta para publicar y cobrar está en
[PARA-PUBLICAR.md](./PARA-PUBLICAR.md).

## Lo que la aplicación necesita del sitio donde viva

**Un servidor de Node.** No vale un alojamiento estático. Hay **tres** rutas que
corren en el servidor y que existen precisamente para que la clave del modelo no
llegue nunca al navegador:

- `/api/ideas` — las ideas de progresión.
- `/api/teacher` — el profesor.
- `/api/versiones` — las salidas: por dónde puede seguir lo que llevas tocado. Es
  la más cara de las tres.

Las tres pasan por las mismas puertas —frecuencia, cuenta y cupo— y están en un
solo sitio, `server/ai-gate.ts`.

Todo lo demás —afinador, rueda, mástil, acordes, metrónomo, grabación— corre en
el navegador y funcionaría hasta en un servidor de ficheros.

**HTTPS.** El micrófono y la cámara solo se conceden en un origen seguro. En
`localhost` el navegador hace la excepción; en cualquier otro sitio, sin
certificado no hay permiso y la aplicación entera se queda muda.

**Postgres, solo si quieres cuentas.** Desde que hay cuentas y planes hay tres
tablas —quién eres, tu avance y cuántas llamadas al modelo llevas hoy—, y esta es la
única parte que necesita base de datos.

**Sin `DATABASE_URL` la aplicación funciona entera y sin cuentas**, igual que
funciona sin la clave de Anthropic: todo el mundo anónimo, plan gratis, sesiones en
IndexedDB y avance en `localStorage`. Así era antes de que existieran las cuentas y
así sigue siendo si no se configura ninguna. Un despliegue nuevo tampoco pierde nada
en ese modo, porque no hay nada de nadie.

Lo que **nunca** hace falta guardar en ningún sitio: audio y vídeo. Eso no sale del
equipo de quien toca y las cuentas no han cambiado eso.

## Variables de entorno

| Variable                                  | Hace falta        | Para qué                                                                                                                      |
| ----------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                       | Solo para la IA   | Las tres rutas. Sin ella contesta el modelo de casa si lo hay, y si tampoco, el dominio; en producción se contesta 503.       |
| `OLLAMA_URL` / `OLLAMA_MODEL`             | No                | Un modelo en tu equipo para probar sin clave y sin factura. **La clave le gana**: con las dos puestas contesta la API.        |
| `ANTHROPIC_MODEL`                         | No                | Cambiar de modelo sin tocar código. Por defecto, `claude-opus-5`. **Cambia los cupos de todos los planes**: ver abajo.        |
| `DATABASE_URL`                            | Solo para cuentas | Postgres. Sin ella no hay cuentas ni planes, y todo lo demás funciona igual.                                                  |
| `AUTH_SECRET`                             | Solo para cuentas | Firmar la cookie de sesión. `openssl rand -base64 32`.                                                                        |
| `APP_URL`                                 | Solo para cobrar  | A dónde vuelve quien paga. Sin ella se supone `http://localhost:3000`, que en producción manda a la gente a su propio equipo. |
| `STRIPE_SECRET_KEY`                       | Solo para cobrar  | La clave de la pasarela.                                                                                                      |
| `STRIPE_WEBHOOK_SECRET`                   | Solo para cobrar  | El secreto del endpoint, para comprobar la firma. **Sin él el webhook no acepta nada.**                                       |
| `STRIPE_PRICE_BASICO` / `_MEDIO` / `_PRO` | Solo para cobrar  | Qué precio de Stripe es cada plan. Son distintos en la cuenta de pruebas y en la de verdad.                                   |

`DATABASE_URL` y `AUTH_SECRET` van **juntas**: hacen falta las dos, y con una sola la
aplicación se comporta como si no hubiera ninguna. Es a propósito: media configuración
de cuentas es peor que ninguna, porque falla al entrar en vez de decir que aquí no hay
cuentas.

**Las cinco de Stripe también van juntas**, y por lo mismo: `billing()` comprueba que
estén la clave y los tres precios, y si falta cualquiera devuelve el cobrador que no
cobra. Media configuración de pasarela sería una ventana de pago que promete cobrar y
no puede.

Ninguna lleva el prefijo `NEXT_PUBLIC_`, así que Next no las mete en el bundle
del navegador. Si alguna vez añades una que sí lo lleve, ten claro que eso es
publicarla.

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
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Los cinco tienen que pasar. `pnpm build` es el que de verdad se parece a
producción: es el único que compila las rutas y avisa si algo del servidor se ha
colado en el cliente.

Ninguno necesita base de datos ni claves. Los tests no tocan Postgres a propósito:
lo que se prueba es la política de planes, la fusión de avances y el cifrado de
contraseñas, que son puros.

## Camino 1: Vercel

Es la casa de Next y no necesita configuración: detecta el proyecto, compila y
sirve las tres rutas como funciones.

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

Comprobado el 1 de agosto de 2026 con Docker 29.4.2: las tres tablas se crean, se
registra una cuenta, se entra, se cambia el nombre y la contraseña —y con la vieja ya
no se entra—, se sube a Pro, el avance se fusiona sin perder nada y el contador de IA
sube en `ai_usage`.

## Camino 2: un contenedor

El `Dockerfile` de la raíz construye la salida `standalone` de Next, que trae
solo lo que hace falta para correr: ni `node_modules` entero ni el código
fuente.

```bash
docker build -t caos-ordenado .
docker run -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e DATABASE_URL=postgres://... \
  -e AUTH_SECRET=... \
  caos-ordenado
```

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
—`output: 'export'`— pero entonces desaparecen las tres rutas de la IA, y con
ellas el profesor y las ideas. El resto de la aplicación seguiría funcionando.

Si algún día interesa esa versión, lo honesto es que esas pantallas digan que
esa parte no está disponible en esta copia, no que fallen con un error de red.

## Lo que hay que saber una vez publicado

**El límite por minuto es por instancia y está en memoria.** Defiende contra pulsar
veinte veces el botón de ideas, que es para lo que se hizo. Si esto corre en varias
instancias, cada una llevará su cuenta.

**El cupo diario de las cuentas sí es compartido**, porque vive en Postgres, y sube y
comprueba su tope en la misma sentencia: dos peticiones a la vez no pueden gastar las
dos la última que quedaba. El de quien no ha entrado sigue siendo en memoria y por
dirección.

**El modelo que pongas decide los cupos de todos los planes.** Los cupos se calculan
dividiendo lo que se puede gastar de cada plan entre lo que cuesta una petición con el
modelo configurado ([adr/0008](./adr/0008-los-cupos-salen-del-precio.md)), así que
cambiar `ANTHROPIC_MODEL` los multiplica sin tocar código:

| `ANTHROPIC_MODEL`             | Básico  | Medio   | Pro      |
| ----------------------------- | ------- | ------- | -------- |
| `claude-opus-5` (por defecto) | 147/mes | 181/mes | 363/mes  |
| `claude-sonnet-5`             | 246/mes | 302/mes | 605/mes  |
| `claude-haiku-4-5`            | 739/mes | 908/mes | 1817/mes |

Es potente y es un cañón: bajar de modelo sube los cupos y baja la calidad de las
respuestas, y de lo segundo no avisa nada. Un modelo que no esté en la tabla de precios
se cobra como el más caro, así que los cupos salen pequeños en vez de regalarse.

**La IA pide cuenta.** Sin `DATABASE_URL` y `AUTH_SECRET` no hay cuentas, y sin cuentas
las tres rutas de IA contestan `401`: la aplicación funciona entera menos el profesor y
las ideas. Es a propósito —sin cuenta no hay a quién contarle el gasto— y está razonado
en [adr/0008](./adr/0008-los-cupos-salen-del-precio.md).

**La IA cuesta dinero, y ahora hay a quién cobrárselo… pero no se le cobra.** Los
tres planes, sus permisos y sus cupos están puestos y funcionando, y detrás del
cobro hay una interfaz cuya única implementación de hoy **cambia el plan sin cobrar
nada** ([adr/0006](./adr/0006-planes-y-puerto-de-facturacion.md)). Antes de publicar
esto de cara al mundo hay que saber lo que eso significa:

- Cualquiera con una cuenta puede darse el plan Pro y su cupo, entrando en
  `/planes/pro` y pulsando un botón.
- Los cupos protegen del gasto accidental, no del que quiere gastar.

Lo primero que hay que añadir si esto se publica en serio es una implementación de
cobro de verdad. La pantalla de planes, mientras tanto, avisa de que aquí no se
cobra: lo dice porque el cobrador declara que no cobra, no porque alguien se acordase
de escribirlo.

**El vídeo del encabezado son 2,3 MB.** Se descarga solo si quien mira no ha
pedido menos movimiento. Si el ancho de banda importa, ahí está el primer
recorte.

## Cobrar de verdad

Sin las variables de Stripe, `billing()` devuelve el cobrador que no cobra: los tres
planes funcionan, se pueden activar y la ventana de pago **dice que no se está
cobrando nada**. Es lo que hace que un clon recién bajado funcione entero sin
configurar una pasarela.

Con ellas puestas, la misma ventana deja de decirlo sola —el aviso cuelga de
`billing().charges`, no de una constante— y al confirmar se sale a la página de pago
de Stripe. Los datos de la tarjeta no pasan por aquí en ningún momento.

### El webhook

```
POST /api/pago/webhook
```

Es lo que cambia el plan cuando el dinero ha entrado, y es la parte que hay que
configurar con cuidado:

1. En Stripe, crea un endpoint apuntando a `https://tu-dominio/api/pago/webhook`.
2. Suscríbelo a `checkout.session.completed` y `customer.subscription.deleted`.
3. Copia su secreto de firma en `STRIPE_WEBHOOK_SECRET`.

**Sin ese secreto el webhook no acepta nada**, y eso es a propósito: un webhook sin
comprobar la firma es un formulario público para darse el plan Pro. La comprobación
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
- **Cancelar baja el plan en el momento**, sin esperar al webhook. Si la llamada a
  Stripe fallara, lo peligroso sería seguir dando el plan de pago.
- **Nada de esto se ha ejecutado contra Stripe.** La firma, el mapeo de precios y las
  respuestas del webhook están probados con datos fabricados; que la API conteste lo
  que se espera, no. Es lo primero que hay que hacer con una clave de pruebas.

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
