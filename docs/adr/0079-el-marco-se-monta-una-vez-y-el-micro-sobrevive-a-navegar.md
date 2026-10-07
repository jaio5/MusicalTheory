# ADR 0079 — El marco se monta una vez, y el micro sobrevive a navegar

Fecha: 2026-10-02 · Estado: aceptada · Completa
[ADR 0030](./0030-cambiar-de-modo-traduce-la-cancion.md) en dónde se vigila el modo,
y matiza el recuento de montados de `state/use-listening.ts`

## Contexto

Cada `page.tsx` montaba su propio `AppShell`, así que **al navegar el marco entero
se desmontaba y se volvía a montar**. Con él se iba el botón del micro de la barra, y
el recuento de componentes montados llegaba a cero: el micro se cerraba **con la
barra diciendo que seguía escuchando**, y el primer clic en ella no paraba nada.
Medido en un Chromium, de `/afinar` a `/aprender` con el micro abierto: la pista
terminada y el botón encendido.

Arreglarlo sacó tres cosas más:

- **Abrir el micro espera varias veces** —a descargar los motores, al permiso del
  navegador, a que arranque el análisis—, y en cada hueco puede entrar un «parar» o
  un cambio de pantalla. Con el permiso tardando tres segundos y una navegación en
  medio, la pista quedaba viva, sin dueño y con la barra apagada.
- **Los motores de audio viajaban a todas las pantallas.** El gancho lo monta la
  barra, y la barra está en todas: el análisis de tono, el croma y la entrada de Web
  Audio iban también a `/planes`, `/cuenta` y `/profesor`, donde no se escucha nada.
  El selector de micrófonos del afinador importaba, además, la clase entera de la
  entrada solo para listar los aparatos.
- **La vigilancia del modo del montaje solo existía con componer montada**, y el
  montaje sigue en memoria al navegar. Con cuatro bloques en Do mayor, ir a una
  unidad, pasar la rueda a La menor y volver a componer tumbaba la pantalla.

Y un cuarto, de cuando algo revienta: sin fronteras de error, Next pinta las suyas,
en inglés y sin barra.

## Decisión

**Las páginas viven en `src/app/(marco)/` y su `layout.tsx` monta `AppShell` una
sola vez.** Un layout de Next no se desmonta al ir de una de sus páginas a otra. La
portada queda fuera, porque pinta su propia sala sin barra. El paréntesis no sale en la
dirección, y el `force-dynamic` del layout raíz se hereda.

**El micro abierto sigue abierto al cambiar de pantalla.** Se cierra cuando **no queda
nadie** con el gancho montado —al ir a la portada, o al recargar en caliente— y
entonces la sesión vuelve a reposo con él: cerrar el aparato y dejar «escuchando» era
un piloto encendido de un micro apagado.

**Un contador de vueltas, mirado después de cada espera de `start()`.** Cada vez que
se suelta lo abierto, `vuelta` sube; el arranque que vuelve de una espera compara con
la vuelta con la que empezó, y si no coincide suelta lo suyo y se va. Si el permiso
llega tarde, el único que todavía tiene la pista es quien la pidió, y la cierra él.

**Los motores se cargan con `import()` dentro de `start()`**, solo en el camino de
casa: quien pasa sus fábricas —los tests— no descarga nada. Si ya hay un micro abierto
y quien llega pide acordes, el croma se añade a la entrada que hay
(`anadirAcordes`), en vez de quedarse la toma sin ellos. Listar los aparatos vive en
`audio/entradas-de-audio.ts`, que no abre nada.

**La vigilancia del modo la arranca el almacén del montaje al crearse**, solo en el
navegador: en el servidor el módulo es uno para todas las peticiones y apuntarse a la
tonalidad allí mezclaría la de una persona con el montaje de otra. No puede haber un
montaje sin su vigilancia.

**Tres fronteras de error** —`(marco)/error.tsx`, que deja la barra puesta;
`error.tsx`, para lo de fuera del marco; y `global-error.tsx`, para lo que rompa el
layout raíz— con una vista común, `Averia`. Y un **`(marco)/not-found.tsx`** propio:
un `notFound()` desde una página de dentro se pinta ya dentro del layout, y el
`not-found.tsx` de la raíz monta su propio marco, así que salían dos cabeceras, dos
micros y dos barras de abajo.

## Consecuencias

El micro ya no se corta al pasar de una pantalla de trabajo a otra, y lo que lo
sujeta es la barra. Quien monte un gancho que pida acordes en una pantalla no
tiene que saber si el micro estaba ya abierto.

Los motores de audio dejan de estar en el paquete de las pantallas que no escuchan.
El primer clic en el micro espera a la descarga: el botón pasa a «pidiendo» desde el
primer instante para que conteste al dedo.

## Alternativas descartadas

**El marco en el layout raíz, con un componente que mire la ruta.** Funciona, pero la
portada descargaría la barra y el micro para esconderlos, y es justo lo que se
quería evitar.

**Seguir montándolo en cada página.** Es lo que había, y el recuento de montados
vale para el micro solo si lo que lo sujeta no se desmonta al navegar.

**Cerrar el micro en cada navegación.** Es lo más simple, y rompe lo que se espera:
quien abre el micro en el afinador y se va a una unidad de oído quiere seguir
oyéndose.

**Un sí o un no de «arrancando» y un `AbortController`.** El sí o no no distingue
un arranque que sigue siendo de alguien de uno que se quedó sin dueño mientras
esperaba el permiso, e impide el siguiente. Un `AbortController` cancela el `fetch`
y poco más: aquí lo que hay que cortar son esperas de `getUserMedia` que el navegador
no deja cancelar.

**Poner la vigilancia en un efecto de `ComposeScreen`, o de `AppShell`.** El
primero es lo que había y falla fuera de componer; el segundo corre después de
pintar, y para entonces el lienzo ya leyó los grados viejos y lanzó.

**Un `import` por efecto secundario, o importar el almacén desde la vigilancia.**
Lo primero esconde el enchufe en un `import 'x'`; lo segundo es un ciclo entre dos
módulos, que revienta en el navegador sin que lo vea ningún test. Por eso el almacén
entra por parámetro.
