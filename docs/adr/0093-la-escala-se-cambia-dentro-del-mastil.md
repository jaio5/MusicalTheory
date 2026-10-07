# ADR 0093 — La escala se cambia dentro del mástil

Fecha: 2026-10-03 · Estado: aceptada

## Contexto

Para ver cómo cambia una escala sobre el mástil había que elegirla en otro sitio: en
un teléfono, en la ventana de la tonalidad, que tapa la pantalla entera —se elegía a
ciegas y se cerraba para mirar—; en el banco, en el área de la tonalidad, donde con el
mástil abierto el desplegable quedaba bajo la rueda y había que desplazarse.

## Decisión

**`features/fretboard/EscalaDelMastil.tsx` va en la cabecera del área del mástil**:
una flecha, un desplegable y otra flecha. Es **la misma escala de siempre**
(`setScale` del almacén de la sesión): cambiarla aquí la cambia en la tonalidad, en
las propuestas del punteo y en el profesor.

- Va en la **cabecera** porque mide lo mismo vacía que llena; una fila encima del
  dibujo costaba 45 px, justo los que le faltaban al mástil para llenar el ancho
  ([adr/0046](./0046-el-mastil-solo-ocupa-lo-que-dibuja.md)).
- Las flechas dan la vuelta (tras la última viene la primera) y miden 44 px de alto
  siempre; entre 360 y 368 px de ancho ceden ancho, y por debajo de 360 se van.
- **El cambio se anuncia una vez y nunca durante una toma**: un lector de pantalla
  tapa el clic ([adr/0072](./0072-la-claqueta-suena-toda-la-toma.md)).
- Sin tonalidad no se pinta: no cambiaría nada a la vista.

## Consecuencias

- Hay dos sitios desde donde elegir escala, y los dos escriben en el mismo almacén.
- La cabecera del mástil tiene un tope de ancho para la frase de las notas: el sitio
  de los mandos no encoge (`FretboardPanel.tsx`).

## Alternativas descartadas

- **Una escala propia del mástil**, aparte. Se contradiría con la de la tonalidad y
  con lo que lee el profesor.
- **Nueve botones segmentados.** No caben en ningún ancho de la cabecera.
- **Segmentado con las de siempre y el resto en un desplegable.** Dos mandos para una
  elección, y esconde justo las que se quieren comparar: dórico, mixolidio, frigio.
- **Una fila encima del dibujo.** Costaba el 9 % de ancho que el tope le quitaba.
- **Dejarlo en el área de la tonalidad.** Era el problema.
