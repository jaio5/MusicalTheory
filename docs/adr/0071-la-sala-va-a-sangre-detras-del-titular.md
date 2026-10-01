# ADR 0071 — La sala va a sangre detrás del titular

Fecha: 2026-10-01 · Estado: aceptada, sustituida en parte por [ADR 0073](./0073-las-pantallas-llenan-el-ancho.md) (el escalado y el anclaje) · Sustituye en parte a
[ADR 0069](./0069-la-portada-es-una-escena-de-pixel.md), que la metía en una caja,
y a [ADR 0026](./0026-el-blanco-hielo.md), que descartó el encabezado a sangre

## Contexto

La escena de píxel del local de ensayo
([ADR 0069](./0069-la-portada-es-una-escena-de-pixel.md)) iba en una caja con su
marco, a la derecha del titular, igual que antes el vídeo. La caja la hacía una
foto más de la página: el sitio donde pasa todo quedaba en un rectángulo de 500
píxeles, y el titular, en su columna de al lado, sin relación con él.

El encabezado a sangre ya se había probado y descartado
([ADR 0026](./0026-el-blanco-hielo.md)). La razón era el tema claro: un velo blanco
encima de un fondo oscuro deja una niebla gris, y la gracia del claro es el blanco
que se ve. Esa razón sigue en pie si el encabezado sigue al tema. Lo que cambia es
que ya no tiene por qué: la sala es de noche en los dos temas, y lo único claro de
ella es la luz de la bombilla.

## Decisión

**La sala ocupa el encabezado entero, a sangre, y el titular se escribe en su
pared.** El encabezado es un escenario oscuro en los dos temas: lleva
`.escenario-oscuro`, que vuelve a declarar las variables del tema oscuro, así que
el texto, los botones y el foco de dentro salen con los colores del oscuro sin
pintar nada a mano. La barra de arriba flota encima y también es de la sala.

- **En el teléfono y la tableta**, la sala va abajo y centrada, a 2× y a 3×, y el
  texto encima sobre la pared. El velo baja desde arriba y se abre donde empieza el
  ampli.
- **Desde 1024**, va anclada a la derecha y centrada en alto, con el titular sobre
  la pared de la izquierda. El velo va de izquierda a derecha y se abre a la mitad.
  El lienzo ocupa entre la mitad y el 85 % del ancho en cada corte, y no pasa de
  5× hasta 1920: a 1600 crecía más que la columna de texto y el titular caía encima
  del cartel y de la guitarra.
- **El negro de alrededor es el de los cantos del dibujo** (`--sala`). El lienzo se
  queda más pequeño que la pantalla y no se ve dónde acaba, porque sus bordes se
  funden en ese mismo negro.

Se conserva todo lo que ya había: el escalado entero, el paralaje, la vida por
fotogramas, la pausa, el movimiento reducido y el ahorro de datos.

## Consecuencias

El primer pantallazo de la portada es la sala, con el titular dentro. Medido en el
servidor de desarrollo a 390, 768, 1280 y 1600, en los dos temas: el titular no
pisa al profesor ni al ampli y no hay scroll lateral; axe da cero fallos con
movimiento y sin él; el foco de los botones sale en el color de la bombilla sobre
la sala.

Hay dos copias de los colores del oscuro: la de `globals.css` y la de
`.escenario-oscuro`. `escena.test.ts` comprueba que valgan lo mismo.

El tema claro tiene ahora una franja oscura arriba en la portada. Es a propósito,
porque es un escenario, y el resto de la página sigue siendo claro.

`--sala` todavía no es `night`: el dibujo se pintó antes de la paleta de
[ADR 0070](./0070-la-sala-encendida.md). Cuando `arte/portada/build.py` la use,
los dos negros se juntan.

## Alternativas descartadas

**Seguir con la caja.** Es lo que había y funciona. Se descarta porque la escena es
el sitio donde pasa todo, y metida en una caja se lee como una captura de pantalla
al lado de un texto.

**A sangre, pero siguiendo al tema**, con un velo claro en el tema claro. Es lo que
ya descartó [ADR 0026](./0026-el-blanco-hielo.md), y por lo mismo: un velo blanco
sobre la noche deja una niebla gris que no es ni la sala ni el blanco.

**A sangre, con el lienzo estirado a todo el ancho.** Ocupa la pantalla entera sin
negro alrededor. Se descarta porque obliga a un escalado que no es entero, y un
píxel del dibujo saldría unas veces de cuatro píxeles y otras de cinco. O, si se
redondea hacia arriba, el ampli se sale por un lado en cuanto la ventana es
estrecha.

**Ampliar el dibujo con más pared** para que llene la pantalla a cualquier ancho.
Es lo más limpio, y se puede hacer más adelante en `arte/portada/build.py`. Hoy no
hace falta: los cantos ya se funden en el negro, y más lienzo es más peso para
pintar pared.
