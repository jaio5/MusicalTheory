---
name: arrancar
description: Levanta Caos ordenado y la conduce con un navegador de verdad — micrófono incluido. Úsalo para ver un cambio funcionando, hacer capturas o probar el audio, no para correr los tests.
---

# Arrancar y conducir Caos ordenado

Lo que sigue está probado en este equipo. Cada línea existe porque algo falló sin
ella.

## Levantar

Sin base de datos, que es lo que hace falta para mirar una pantalla:

```bash
DATABASE_URL= pnpm dev > /tmp/musical-dev.log 2>&1 &
```

Con la variable puesta y la base caída, la aplicación intenta conectar; vacía, cae
en el modo anónimo que `CLAUDE.md` describe y todo funciona menos las cuentas.

Arranca en unos 400 ms en el 3000. El `.env` dice `APP_PORT=3001`, pero eso es
para `compose`: `pnpm dev` no lo lee.

**Con base de datos**, si hace falta tocar cuentas, IA o guardar canciones:
`pnpm docker:db` y `pnpm db:migrate`, y ya `pnpm dev` a secas.

### Docker en este equipo, que engaña

Este apartado decía que la integración de Docker con WSL estaba apagada aquí. **Es
falso, y el mensaje de error es el que engaña.** Con Docker Desktop cerrado,
`command -v docker` devuelve el `.exe` de Windows y contesta «could not be found
in this WSL 2 distro», que suena a integración apagada y no lo es. Arrancando
Docker Desktop —`powershell.exe -Command "Start-Process 'C:\Program
Files\Docker\Docker\Docker Desktop.exe'"`, unos diez segundos— `docker` pasa a
ser `/usr/bin/docker`, nativo, y todo funciona.

**El 5432 del equipo lo ocupa un Postgres nativo de Windows** —hay dos servicios,
`postgresql-x64-13` y `postgresql-x64-18`—, así que el contenedor del proyecto no
puede publicar ahí: falla con `port is already allocated`. Y desde WSL ese Postgres
de Windows **no es alcanzable**: el cortafuegos tira las conexiones desde las seis
IPs del host, comprobado una por una. Por eso el `.env` de aquí lleva
`POSTGRES_PORT=5434` y la `DATABASE_URL` apuntando al 5434.

`scripts/docker-arriba.sh` rechaza el `docker` de `/mnt/`, así que con Docker
Desktop cerrado `pnpm docker:up` se niega antes de intentarlo. El remedio es
encender Docker Desktop, no tocar el script.

**Sin cuenta no hay**: profesor, salidas, guardar canciones ni registro.
Todo eso contesta 401 y lo explica en pantalla, que es el comportamiento correcto.

## Conducir

No hay `chromium-cli` ni Playwright en el proyecto. Hay un Playwright **global**
de nvm y los navegadores descargados en la caché:

```js
import { chromium } from '/home/javie/.nvm/versions/node/v24.15.0/lib/node_modules/playwright/index.mjs';
```

Se ejecuta con `node fichero.mjs`. **El toque se sintetiza con CDP**
(`Input.dispatchTouchEvent`), no con el ratón, y en Chromium: Safari/iOS no está
probado. Por debajo de `lg` el mástil es una hoja: se abre desde «Más» → «Mástil». Engancha siempre `pageerror` y `console` de
tipo `error`: **la mitad de los fallos de esta aplicación no se ven en la
captura**, solo en la consola.

## El micrófono, que es la mitad de la aplicación

Chromium acepta un WAV como micrófono. Es la única manera de probar el afinador,
el reconocimiento de acordes y el punteo:

```js
const nav = await chromium.launch({
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--use-file-for-fake-audio-capture=/ruta/al.wav',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const ctx = await nav.newContext({ permissions: ['microphone'] });
```

Sin fichero, el micro falso emite un tono de 400 Hz —sirve para el afinador y
nada más—. **El fichero se repite en bucle**: si grabas más segundos de los que
dura, oirás el principio otra vez.

Un WAV de acordes o de un punteo se genera con Python puro (`wave` y `struct`),
sumando senos con dos armónicos y una envolvente suave para no meter un chasquido
en cada cambio. Con senos pelados el croma se confunde más que con una guitarra.

## Explorar a mano, sin escribir un script

Para mirar una pantalla paso a paso —abrir, leer el árbol, pulsar `e15`— está
`playwright-cli` (skill de usuario `playwright-cli`). Lo que mide y se repite sigue
siendo un `.mjs` de aquí; la CLI es para explorar y para reproducir un fallo.

```bash
playwright-cli open http://localhost:3210/afinar \
  --config=.claude/skills/arrancar/playwright-cli.json
playwright-cli snapshot
playwright-cli close
```

- **Sin `--config` busca Google Chrome**, que en WSL no está, y no arranca. La
  configuración de aquí pide el Chromium de Playwright, un teléfono de 390 y el
  micro falso con su permiso dado. El tono es el de 400 Hz: para un WAV, añade
  `--use-file-for-fake-audio-capture` a `args` en una copia.
- **El `playwright-cli` que encuentra el PATH sin filtrar es el de Windows**
  (`/mnt/c/.../npm/playwright-cli`). Filtra el PATH antes, como con todo.
- **Escribe sus instantáneas en `.playwright-cli/`** del directorio desde el que
  se llama. Está en `.gitignore`.
- `getUserMedia` solo existe en un contexto seguro: en `about:blank` no hay
  micro, en `localhost` sí.

## Trampas que ya han mordido

- **El recorrido de la primera visita sale en cada contexto nuevo** y tapa la
  pantalla con un `<dialog>` modal. Antes de navegar:
  `await ctx.addInitScript(() => localStorage.setItem('caos-ordenado:recorrido', 'visto'))`.
  Los `.mjs` de aquí ya lo hacen; uno nuevo tiene que hacerlo también, o medirá la
  tarjeta y su trozo de código.
- **`fullPage: true` no sirve.** La aplicación vive en un `h-dvh` con scroll
  interno: lo que está fuera no sale en la captura aunque pidas la página entera.
  Usa `scrollIntoViewIfNeeded` o mide con `getBoundingClientRect`.
- **Los tests verdes no garantizan que la página cargue.** Un ciclo de
  importación entre `song.ts` y `arrangement.ts` devolvía 500 en toda la
  aplicación con todo en verde. Después de tocar `core/music`, pide la página.
- **Los botones de la rueda y de los acordes tienen nombre accesible propio.**
  `getByRole('button', { name: 'C mayor', exact: true })` para la rueda y
  `{ name: 'C, I' }` para un grado; el texto visible lleva `aria-hidden`.
- **Una nota del pentagrama no se coge por el centro de su `<g>`**: ahí está la
  plica. Apunta a la cabeza.
- **Tras un arrastre el navegador manda también un `click`.** Si una prueba
  arrastra y luego cuenta elementos, cuenta uno de más.

## Medir si algo se ve entero

`sonda-de-medidas.mjs` recorre el DOM y devuelve **lo que no se puede alcanzar**:
lo que se sale de la caja que lo recorta sin que ningún ancestro pueda
desplazarse hasta ello. Se importa y se pasa a `page.evaluate(SONDA)`.

```js
import { SONDA } from '/home/javie/projects/MusicAlApp/.claude/skills/arrancar/sonda-de-medidas.mjs';
const problemas = await page.evaluate(SONDA);
```

Los tamaños que encuentran cosas son **320×568**, **700×600** y **1024×600**: el
teléfono pequeño, la franja de la tableta y el portátil bajo. Un 1920×1080 no
enseña nada que no enseñen esos tres.

**El de en medio se añadió tarde y costó caro que faltara.** Aquí ponía que con el
teléfono y el portátil bastaba, y no bastaba: entre 640 y 767 la cabecera de
escritorio salía entera sin caber, se llevaba el botón de la cuenta por la derecha
—el marco recorta y no desplaza— y **no había manera de cerrar la sesión** en toda
esa franja. Ninguno de los dos tamaños de aquí pasaba por ahí. Lo que hay que
recorrer no son los extremos, sino **los dos lados de cada punto de corte**: 640 y
768 son donde esta aplicación cambia de navegación.

Tres cosas que hay que saber o se mide humo:

- **Un `scrollHeight` mayor que el `clientHeight` no prueba nada.** Chromium suma
  ahí el desborde de descendientes que ya recorta otro ancestro: el marco de la
  aplicación parecía recortar 186 px y no se escapaba nada. Lo que vale es
  comparar la geometría contra la caja que de verdad recorta.
- **Un `<details>` cerrado sigue dando medidas de lo que esconde.** Es
  `content-visibility`, y por ahí entraron veintitrés falsos positivos. Lo
  distingue `checkVisibility`, que es lo que usa la sonda.
- **Lo apartado a propósito no es un fallo.** El «Saltar al contenido» vive fuera
  de la pantalla hasta que se le da el foco, y Tailwind v4 lo hace con la
  propiedad `translate` y no con `transform`: hay que mirar las dos.

**Calibra antes de creerte un cero.** Devuelve el fallo con un `addStyleTag` y
comprueba que la sonda lo ve; si no lo ve, lo que mide es otra cosa.

## Medir cómo reparte la pantalla el banco de componer

`sonda-de-medidas.mjs` contesta «¿se llega a esto?». **No contesta «¿a qué le
está dando sitio la aplicación?»**, y esa es la pregunta cuando una pantalla se
lee mal estando todo alcanzable. Eso lo mide `sonda-de-componer.mjs`, y
`auditar-componer.mjs` la pasa por los cinco tamaños y seis estados de
`/componer`:

```bash
node .claude/skills/arrancar/auditar-componer.mjs medido.json
```

Deja un JSON para comparar el antes con el después, que es para lo que existe:
un cambio de reparto se defiende con dos números, no con dos capturas.

Mide el reparto —cuánto alto se lleva la canción frente a cada panel de ayuda—,
los mandos duplicados, cuántos hay encima del documento, el vacío del área
principal y los candidatos a estar tapados.

**Cuatro medidas son fiables y la del alcance no.** Una caja grande que se cruza
con un hermano sale «tapada» sin estarlo: da candidatos y se confirman mirando.

Tres cosas que costaron una pasada en falso:

- **Un montaje que falla en silencio mide la pantalla de partida y lo llama seis
  casos.** Los seis escenarios del teléfono salían idénticos: ninguna tonalidad
  se dejaba pulsar. Por eso el auditor anota cada paso que no pudo dar y marca el
  caso como roto; un caso roto no se mide.
- **De «C mayor» hay tres botones en pantalla**, y uno está `inert` a propósito
  porque la rueda flotante lo tapa. Hay que pulsar **el primero que se deje**, no
  el primero ni el último.
- **Con el centro solo, media rueda de quintas sale tapada por la otra media.**
  Son gajos de un círculo en cajas rectangulares que se solapan. Se juzga con
  cinco puntos y se da por tapado lo que no se alcanza por ninguno.

## Si aguanta un teléfono de gama media

El análisis en vivo va en el hilo principal
([adr/0003](../../../docs/adr/0003-analisis-en-el-hilo-principal.md)), así que
si la CPU no da, lo que se pierde no es fluidez: **son acordes**.

```bash
node .claude/skills/arrancar/gama-media.mjs acordes.wav
```

Toca un WAV por el micrófono falso con la CPU frenada —×1, ×4, ×6, ×10 y ×20,
con `Emulation.setCPUThrottlingRate`, el mismo freno del panel de rendimiento de
Chrome— y cuenta **qué acordes escribió la aplicación**. No milisegundos:
aciertos, que es lo único que le importa a quien compone.

**Medido el 22 de septiembre de 2026: 4 de 4 en los cinco frenos, incluido ×20.**
El reconocimiento en vivo no se cae por CPU.

Tres cosas sobre lo que esa cifra **no** dice:

- El micro falso da una señal limpia. Esto mide si el motor **llega a tiempo**,
  no si acierta con una guitarra en una habitación.
- El freno es del hilo principal. Lo que corre en el hilo de audio no se frena
  igual.
- **No mide el análisis de la grabación entera**, que es otra cosa y va en un
  worker.

Y una trampa que costó una pasada en falso con tres ceros que parecían una
medida: **al parar se sigue en «Tocando» y el lienzo ni está montado**, así que
los bloques no existen en el DOM. Lo escrito se lee de la lista «Lo que ya
llevas», que es la que enseña ese mismo espacio.

## Cuánto se descarga cada ruta

`peso-de-las-rutas.mjs` dice cuántos kilobytes de JavaScript paga quien abre cada
pantalla, y **si una se está trayendo código de otra**.

Hace falta un servidor de producción; con `pnpm dev` los números no significan
nada, porque no hay ni división de chunks ni minificado:

```bash
pnpm build
PORT=3210 DATABASE_URL= pnpm start &
node .claude/skills/arrancar/peso-de-las-rutas.mjs
```

Existe porque hubo un fallo que **ningún test veía y que no se lee en el código**:
las ocho rutas descargaban exactamente los mismos chunks, y el afinador —seis
cuerdas y una aguja— se traía el lienzo de componer, el grabado de partituras y el
temario entero. Tests, tipos y reglas de capas, los tres en verde: ninguno mira lo
que acaba viajando por el cable.

**Lo que vale no es el número, es la última columna.** Un total que sube puede ser
una función nueva; «el afinador se descarga _Añadir otra parte_» es un fallo sin
discusión. Por eso el guion lleva escritas unas cuantas cadenas que solo existen en
una pantalla y avisa si aparecen en otra.

Referencia, medida el 4 de octubre de 2026 contra el servidor de producción, con
la escena de píxel en la portada
([adr/0069](../../../docs/adr/0069-la-portada-es-una-escena-de-pixel.md)), las
tres letras servidas desde aquí ([adr/0070](../../../docs/adr/0070-la-sala-encendida.md))
y las presentaciones de las unidades fuera del temario
([adr/0096](../../../docs/adr/0096-el-temario-sigue-al-conservatorio.md)):

| Ruta                 | JS     | Media | Total  |
| -------------------- | ------ | ----- | ------ |
| `/planes`            | 186 KB | 78 KB | 298 KB |
| `/afinar`            | 187 KB | 78 KB | 296 KB |
| `/registro`          | 188 KB | 61 KB | 280 KB |
| `/profesor`          | 192 KB | 61 KB | 285 KB |
| `/` (portada)        | 194 KB | 88 KB | 317 KB |
| `/cuenta`            | 197 KB | 61 KB | 289 KB |
| `/aprender`          | 203 KB | 78 KB | 319 KB |
| `/aprender/repaso`   | 236 KB | 78 KB | 347 KB |
| `/aprender/[unidad]` | 243 KB | 61 KB | 336 KB |
| `/componer`          | 245 KB | 78 KB | 361 KB |

**Las presentaciones de las unidades viajaban con el temario**, y el temario lo
lee todo el que lee el avance: `/cuenta` y `/aprender/repaso` se llevaban 3 o
4 KB de texto comprimido que no pintan, y el `import()` con el que componer suma al avance
también. Ahora viven en `core/music/presentaciones.ts`, y el resumen —lo único
que enseña el camino— en `resumenes.ts`: con los dos en un fichero, `/aprender`
se llevaba todos los contenidos aunque use solo el resumen, porque el
empaquetador no parte un módulo por lo que se usa de él. El guion lo vigila con
una frase de cada uno en `NO_DEBERIA_VIAJAR`.

**La media ya no es solo de la portada: son las letras** (`app/fuentes.ts`). La
de títulos y la del cuerpo se precargan en todas las rutas —27 y 34 KB—, y la
monoespaciada, 18, solo se pide donde se pinta algo con ella: por eso `/profesor`,
`/registro`, `/cuenta` y la unidad se quedan en 61. La portada suma a eso los
9 KB de su escena. Con el vídeo eran 527 KB de media solo en la portada.

Antes de arreglarlo eran **287 KB en todas**, la misma cifra clavada, que es la
señal de que no hay división ninguna.

## Antes de dar nada por terminado

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm format:check && pnpm build
```

`pnpm format` después de tocar cualquier `.md`, o `format:check` falla. Es el
fallo más repetido de este repositorio.
