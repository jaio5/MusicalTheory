# ADR 0064 — La partitura se parte en sistemas, y no se desplaza de lado

Fecha: 2026-10-01 · Estado: aceptada · Amplía: [ADR 0019](./0019-punteos-y-partitura.md) y
[ADR 0029](./0029-la-partitura-se-dibuja-aqui.md)

## Contexto

[ADR 0019](./0019-punteos-y-partitura.md) dejó la partitura en **un solo
sistema** que se justifica al ancho: los pulsos de la parte se reparten por la
línea entre dos topes, 28 y 46 píxeles por pulso. Por debajo del mínimo las
notas se pisan, así que cuando los compases no caben a su mínimo la línea no
encoge más: se sale de la hoja, y la hoja se desplaza de lado.

Medido en el navegador, eso pasa siempre en un teléfono y también en un
escritorio:

| Pantalla | Caja de la hoja | Lo que medía la partitura | Lo que se veía              |
| -------- | --------------- | ------------------------- | --------------------------- |
| 390×844  | 364             | 552                       | tres compases de C-F-G-Am   |
| 1440×900 | 713             | 727                       | todo, menos catorce píxeles |

El primero es el grave: el cuarto compás vivía detrás de un desplazamiento
horizontal **que nada anunciaba**, dentro de un área que además se desplaza en
vertical. Quien no lo sabía no lo encontraba. El segundo es otro fallo: el
ancho que se repartía era el de la caja de fuera, y la hoja le sumaba luego su
relleno y su borde —dieciocho píxeles—.

## Decisión

**Cuando los compases no caben a su ancho mínimo, la partitura se parte en
sistemas**, que es lo que hace cualquier partitura de verdad
(`repartoEnSistemas` en `arrange/Staff.tsx`).

- **Caben los compases que quepan a su pulso mínimo, y al menos uno.** En un
  teléfono son dos de cuatro por cuatro; en un escritorio, la parte entera.
- **Los compases se reparten a partes iguales** entre los sistemas que hagan
  falta: cinco que caben de cuatro en cuatro salen tres y dos, no cuatro y uno
  colgando.
- **Todos los sistemas llevan el mismo pulso.** El mismo pulso de cada compás
  cae en la misma columna en todos los renglones, así que las barras quedan
  alineadas como en una hoja guía, y un último sistema corto es más corto en vez
  de más estirado.
- **Cada sistema empieza con su clave y su armadura**; la indicación de compás
  solo va en el primero, como en cualquier partitura impresa. El hueco que deja
  en los demás se queda vacío para que la música empiece en la misma columna.
- **Un acorde que cruza el final de un renglón sigue en el de abajo**: su línea
  de duración va en un tramo por sistema, y la punta de la que se tira para
  estirarlo va donde acaba.
- Un sistema que no es el último acaba en una divisoria sencilla; la barra final
  va solo en el último.
- **Sin medida no se parte**: en el primer pintado —y en jsdom— no hay ancho con
  el que decidirlo, y partir en uno por compás sería lo peor de los dos mundos.

Y el ancho que se reparte es **el del papel**, con el relleno y el borde de la
hoja descontados (`PAPEL`). Con eso desaparecen los catorce píxeles del
escritorio.

El desplazamiento de lado **se queda**, pero solo para lo que no se puede
partir: un compás de seis a su pulso mínimo no cabe en un teléfono de 320, y un
compás no se parte en dos renglones.

## Consecuencias

- La partitura crece hacia abajo en vez de hacia la derecha. El área del
  arreglo ya se desplaza en vertical en un teléfono, así que lo que no cabe se
  alcanza con el gesto que ya se estaba haciendo.
- **Traducir un punto de la pantalla a un pulso pasa por el sistema**: primero
  qué renglón, por la altura —todos miden lo mismo—, y luego qué pulso dentro
  de él. Escribir, arrastrar una nota y mover un acorde siguen el mismo camino.
- Estirar un acorde tirando de su punta sigue midiéndose en horizontal; si el
  gesto cruza de renglón, cuenta la distancia en píxeles y no salta de sistema.
  Se acepta: para estirar mucho están «+ pulso» y la vista de bloques.
- Las cuentas de sistemas, compases por sistema y pulso viven en una función
  pura con sus tests, y lo que se dibuja en cada sistema —clave, armadura, barra
  final, tramos del acorde— lo comprueba `Staff.test.tsx` con una caja de 364
  de mentira.
- **No está medido en el navegador todavía.** Lo tiene que medir el skill
  `arrancar` a 390 y a 1440 con C-F-G-Am: dos sistemas y cero desbordes en el
  primero, uno y cero en el segundo.

## Alternativas descartadas

**Dejar el sistema único con la pista de `hay-mas-al-lado`.** Es lo mínimo, y
arregla que el desplazamiento no se anunciaba. No arregla lo que importa: una
partitura se lee de izquierda a derecha y de arriba abajo, y una que hay que
arrastrar para leer el cuarto compás no se lee de un vistazo, que es para lo que
se escribe. Además la clase pinta el fondo de la tira y se pelea con el papel de
`.superficie`.

**Bajar el pulso mínimo en pantallas estrechas.** Se probaría a 20, que es lo
que había antes. El mínimo sale de una división —medio pulso de papel tiene que
medir una cabeza entera— y por debajo dos corcheas seguidas se solapan. Es
cambiar un desbordamiento por notas que no se leen.

**Escalar el dibujo entero para que quepa** (`viewBox` con `width: 100%`). Es
una línea de CSS y deforma lo que [ADR 0029](./0029-la-partitura-se-dibuja-aqui.md)
fija en espacios de pentagrama: la clave, las cabezas y el texto encogen con la
pantalla, y a 364 los cifrados de quince píxeles se quedarían en diez. Y rompe
que un píxel de pantalla es un píxel del dibujo, que es lo que permite pulsar
donde se escribe.

**Justificar cada sistema por su cuenta**, como una partitura impresa. Es lo más
fiel al grabado, y el último renglón de una parte corta se estiraría hasta
ocupar la línea con dos compases. Se descarta porque cada sistema tendría su
pulso: las barras dejarían de caer en columna entre renglones, y traducir un
punto a un pulso necesitaría saber el pulso de cada uno. Con uno solo para todos
la cuenta es una división.

**La indicación de compás en todos los sistemas.** Se descarta por convención:
se escribe al principio y donde cambia, y repetida en cada renglón se lee como
si cambiara.
