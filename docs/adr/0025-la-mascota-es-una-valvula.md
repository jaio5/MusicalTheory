# ADR 0025 — La mascota es una válvula, no un amplificador entero

Fecha: 2026-09-08 · Estado: aceptada

## Contexto

La mascota era **un amplificador con cara**: un chasis rectangular con asas,
patas, cinco puntos de rejilla y un piloto en la esquina. La idea era buena
—salir de lo que ya es la aplicación, y no de un búho con birrete— pero el
dibujo no funcionaba, y se vio ampliándolo a doscientos veinte píxeles sobre
`/registro`.

**No se reconocía lo que era.** Un amplificador se identifica por el altavoz, y
aquí el altavoz eran cinco círculos de un píxel y medio en fila debajo de la
boca: a tamaño real leen como una hilera de botones, no como tela. Sin altavoz,
un chasis rectangular con ojos es una tostadora.

**No cabía.** La cara ocupaba el chasis entero —cejas, ojos y boca en los dos
tercios de arriba—, así que no quedaba sitio para lo único que lo habría
identificado. El problema no era el estilo del dibujo: era que el objeto elegido
necesita más superficie de la que hay en cincuenta y seis píxeles.

**El estado no se veía.** «Está escuchando» era un punto de dos coma dos
unidades en la esquina superior derecha. Apagado es gris sobre gris y encendido
es invisible a tamaño real; y estaba en verde, que es el color con el que el
resto de la aplicación dice lo mismo, pero tan pequeño que no lo comunicaba.

## Decisión

**La mascota es una válvula**: cúpula de cristal, filamento dentro, zócalo y
tres patillas. La cara vive dentro del cristal.

Y el estado deja de ser un adorno en una esquina: **es el personaje entero**.
Escuchando, el filamento se pone verde y el cristal se tiñe con una brasa que
late despacio; callado, el filamento es un alambre gris. Se ve de reojo y desde
lejos, que es exactamente lo que un indicador tiene que hacer.

El verde no es una elección estética. Es `tube-bright`, el mismo con el que el
botón del micrófono dice que está abierto, así que en toda la aplicación
«encendido» tiene un solo color. Y no es casualidad que el token se llame así:
la paleta entera sale de un amplificador de válvulas visto de noche
([adr/0024](./0024-la-interfaz-se-lee-primero.md)), y ahí el resplandor ya era
verde antes de que existiera esta mascota.

Tres detalles salieron de mirar el dibujo a tamaño real, no de pensarlo:

- **La boca va a diez unidades de los ojos, no a cinco.** Pegada debajo leía
  como un pico. Una cara necesita el hueco de la mejilla igual que necesita los
  ojos.
- **La boca abierta es un hueco con reborde, no una mancha de latón.** Rellena,
  en mitad del cristal, volvía a leerse como un pico.
- **El filamento es un alambre plegado, no dos horquillas.** Con dos ganchos
  debajo de la boca se leía «UU», o unos dientes: se metía en la cara en vez de
  estar dentro del aparato.

## Alternativas descartadas

**El mismo amplificador, bien dibujado.** Altavoz de verdad con su cono, la cara
en el panel de mandos y asa arriba. Es el cambio de menor riesgo y no invalida
nada de lo escrito sobre la identidad. Se descarta porque no resuelve el
problema de fondo: un amplificador tiene panel **y** altavoz, y las dos cosas no
caben con una cara en cincuenta y seis píxeles. Se habría vuelto a elegir entre
que se reconozca el objeto o que se vea la cara.

**La pala de la guitarra**, con las clavijas de orejas y las cuerdas bajando al
mástil. Es lo más guitarrero de las cuatro y enlaza con el afinador y el mástil.
Se descarta porque sale del mundo del amplificador, que es de donde salen la
paleta, los nombres de los tokens y las tres superficies: habría dos identidades
en la misma pantalla.

**Un personaje geométrico propio**, con la rueda de quintas de cabeza. Es lo
único que no se parecería a la mascota de nadie. Se descarta por coste: obliga a
rehacer también la estética de alrededor, y la de ahora acaba de repasarse
entera. Queda como la salida si algún día la identidad deja de ser un aparato.

## Consecuencias

- `ui/Mascota.tsx` cambia de dibujo pero **no de interfaz**: sigue teniendo
  `hablando`, `atento` y `className`, así que el profesor de las unidades y la
  bienvenida del registro no se enteran.
- `globals.css` gana una animación en bucle, `brasa`. Son dos: el parpadeo, que
  es lo que hace que un muñeco no parezca una pegatina, y esta, que **solo corre
  mientras el micrófono está abierto**. `prefers-reduced-motion` las apaga las
  dos, como a todas.
- Se comprobó en los dos temas y a 32, 56 y 64 píxeles, que son los tamaños a
  los que sale de verdad.
