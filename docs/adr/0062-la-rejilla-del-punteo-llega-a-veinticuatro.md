# ADR 0062 — La rejilla del punteo llega a veinticuatro, y lo que se coge no es lo que se pinta

Fecha: 2026-09-30 · Estado: aceptada · Amplía [ADR 0019](./0019-punteos-y-partitura.md)

## Contexto

[ADR 0019](./0019-punteos-y-partitura.md) dejó escrito que la rejilla de notas no
cumple los cuarenta y cuatro píxeles de la casa, y por qué: una octava son doce
filas, y a cuarenta y cuatro serían quinientos treinta de alto para una sola parte.
Esa excepción sigue en pie. Lo que no se miró entonces es que **tampoco llegaba al
mínimo de la norma**, que son veinticuatro (WCAG 2.2, 2.5.8):

- Cada fila medía **22** de alto, y las filas se tocan unas con otras. La norma
  perdona un objetivo pequeño si tiene aire alrededor, pero aquí no hay aire: el
  vecino empieza donde acaba el anterior.
- Cada nota medía **16** de alto —la fila menos tres de aire por arriba y por
  abajo— y una semicorchea, **ocho de ancho**. Cogerla era apuntar a un palillo.

## Decisión

**Las filas pasan a 24 y las notas se cogen por una zona mayor que lo que se
pinta.**

- `ALTO_FILA` vale 24, en todas las pantallas.
- El botón de cada nota es **la fila entera de alto y al menos 24 de ancho**, y es
  transparente. Lo que se ve va dentro: la barra de siempre, con tres de aire
  arriba y abajo —ahora mide 18— y el ancho que da su duración.
- Estirar se sigue midiendo desde el borde **de lo pintado**, no desde el de la
  zona de agarre: en una nota corta la zona sobresale, y que el aire de la derecha
  estirase no se entendería.

La rejilla crece dos píxeles por fila: con la escala puesta, unas trece filas, son
veintiséis más; sin ella, cuarenta y cuatro. Sigue cabiendo en un portátil.

## Consecuencias

- La rejilla cumple el mínimo de la norma en filas y notas, y la excepción de
  [ADR 0019](./0019-punteos-y-partitura.md) queda en lo que dice: **por debajo de
  cuarenta y cuatro**, no por debajo de todo.
- Una nota corta seguida de otra muy cerca solapa su zona de agarre con la de la
  siguiente, y gana la que va después en el árbol. Se acepta: con medio pulso entre
  las dos, la de delante conserva su parte, y separarlas pediría una rejilla más
  ancha que la de los acordes, que es la que manda el píxel por pulso.
- Los tests leen `ALTO_FILA` del módulo, y no una copia del número.

## Alternativas descartadas

**Una zona de agarre invisible también para las filas, dejándolas en 22.** Es lo
que se hace con las notas, pero con las filas no sirve: se tocan, así que agrandar
una es comerse la de al lado. Lo que gana una lo pierde la vecina, y la suma sigue
siendo 22.

**Filas de 24 solo en pantallas táctiles** (`pointer: coarse`). Es lo que dice la
norma que importa —el dedo— y dejaría el escritorio como estaba. Se descarta porque
son dos geometrías: `casillaEn` tendría que saber cuál hay puesta para traducir un
punto de la pantalla a una casilla, los tests tendrían que probar las dos, y la
diferencia en un escritorio son dos píxeles por fila. No compensa.

**Dejarlo en 22 y apoyarse en la excepción del espaciado.** No aplica: la
excepción pide que un círculo de 24 centrado en el objetivo no toque a otro, y
aquí cada fila toca a las dos de al lado.
