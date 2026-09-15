---
name: arrancar
description: Levanta Caos ordenado y la conduce con un navegador de verdad — micrófono incluido. Úsalo para ver un cambio funcionando, hacer capturas o probar el audio, no para correr los tests.
---

# Arrancar y conducir Caos ordenado

Lo que sigue está probado en este equipo. Cada línea existe porque algo falló sin
ella.

## Levantar

```bash
DATABASE_URL= pnpm dev > /tmp/musical-dev.log 2>&1 &
```

**La `DATABASE_URL` vacía es lo importante.** El `.env` apunta a un Postgres que
solo existe dentro de Docker, y Docker no tiene encendida la integración con WSL
en este equipo. Con la variable puesta y la base caída, la aplicación intenta
conectar; vacía, cae en el modo anónimo que `CLAUDE.md` describe y todo funciona
menos las cuentas.

Arranca en unos 400 ms en el 3000. El `.env` dice `APP_PORT=3001`, pero eso es
para `compose`: `pnpm dev` no lo lee.

**Sin cuenta no hay**: profesor, ideas, salidas, guardar canciones ni registro.
Todo eso contesta 401 y lo explica en pantalla, que es el comportamiento correcto.

## Conducir

No hay `chromium-cli` ni Playwright en el proyecto. Hay un Playwright **global**
de nvm y los navegadores descargados en la caché:

```js
import { chromium } from '/home/javie/.nvm/versions/node/v24.15.0/lib/node_modules/playwright/index.mjs';
```

Se ejecuta con `node fichero.mjs`. Engancha siempre `pageerror` y `console` de
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

## Trampas que ya han mordido

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

Los tamaños que encuentran cosas son **320×568** y **1024×600**: el teléfono
pequeño y el portátil bajo. Un 1920×1080 no enseña nada que no enseñen esos dos.

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

## Antes de dar nada por terminado

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm format:check && pnpm build
```

`pnpm format` después de tocar cualquier `.md`, o `format:check` falla. Es el
fallo más repetido de este repositorio.
