# Publicar

Qué hace falta para poner esto en internet, y qué se rompe según dónde.

## Lo que la aplicación necesita del sitio donde viva

**Un servidor de Node.** No vale un alojamiento estático. Hay dos rutas que
corren en el servidor y que existen precisamente para que la clave de Anthropic
no llegue nunca al navegador:

- `/api/ideas` — las ideas de progresión.
- `/api/teacher` — el profesor de la pantalla de aprender.

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

| Variable            | Hace falta        | Para qué                                                                                                               |
| ------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Solo para la IA   | Ideas y profesor. Sin ella, esas dos pantallas responden «no hemos podido contactar» y el resto va igual.              |
| `ANTHROPIC_MODEL`   | No                | Cambiar de modelo sin tocar código. Por defecto, `claude-opus-5`. **Cambia los cupos de todos los planes**: ver abajo. |
| `DATABASE_URL`      | Solo para cuentas | Postgres. Sin ella no hay cuentas ni planes, y todo lo demás funciona igual.                                           |
| `AUTH_SECRET`       | Solo para cuentas | Firmar la cookie de sesión. `openssl rand -base64 32`.                                                                 |

Las dos últimas van **juntas**: hacen falta las dos, y con una sola la aplicación se
comporta como si no hubiera ninguna. Es a propósito: media configuración de cuentas
es peor que ninguna, porque falla al entrar en vez de decir que aquí no hay cuentas.

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
sirve las dos rutas como funciones.

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

Lo que está comprobado y lo que no: la salida `standalone` arranca y sirve
—portada, pantallas, estáticos y las rutas de API—, y pesa 40 MB. El `Dockerfile`
que la envuelve está escrito pero no construido: en el equipo donde se preparó
no había Docker disponible. Si la primera construcción falla, será en las líneas
de copia, no en la aplicación.

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
—`output: 'export'`— pero entonces desaparecen las dos rutas de la IA, y con
ellas el profesor y las ideas. El resto de la aplicación seguiría funcionando.

Si algún día interesa esa versión, lo honesto es que las dos pantallas digan que
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
las dos rutas de IA contestan `401`: la aplicación funciona entera menos el profesor y
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
