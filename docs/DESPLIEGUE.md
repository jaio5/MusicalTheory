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

**Nada más.** No hay base de datos ni sesión de servidor: las sesiones guardadas
viven en el navegador de quien toca (IndexedDB) y la configuración en su
`localStorage`. Un despliegue nuevo no pierde datos de nadie porque no hay datos
de nadie.

## Variables de entorno

| Variable            | Hace falta      | Para qué                                                                                                  |
| ------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Solo para la IA | Ideas y profesor. Sin ella, esas dos pantallas responden «no hemos podido contactar» y el resto va igual. |
| `ANTHROPIC_MODEL`   | No              | Cambiar de modelo sin tocar código. Por defecto, `claude-opus-5`.                                         |

Ninguna lleva el prefijo `NEXT_PUBLIC_`, así que Next no las mete en el bundle
del navegador. Si alguna vez añades una que sí lo lleve, ten claro que eso es
publicarla.

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
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-... caos-ordenado
```

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

**El límite de peticiones es por instancia y está en memoria.** Defiende contra
pulsar veinte veces el botón de ideas, que es para lo que se hizo. Si esto llega
a correr en varias instancias, cada una llevará su cuenta, y para un abuso de
verdad haría falta un contador compartido.

**La IA cuesta dinero.** Cada idea y cada pregunta al profesor es una llamada al
modelo. Con la clave puesta en un sitio público, cualquiera que entre puede
gastar. Si la publicas de cara al mundo, lo primero que hay que añadir es un
límite por encima del que ya hay.

**El vídeo del encabezado son 2,3 MB.** Se descarga solo si quien mira no ha
pedido menos movimiento. Si el ancho de banda importa, ahí está el primer
recorte.
