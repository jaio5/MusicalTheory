# ADR 0039 — El mástil se estira a lo ancho

Fecha: 2026-09-22 · Estado: aceptada · Sustituye a parte del [ADR 0037](./0037-el-mastil-pide-su-alto.md)

## Contexto

Desde el [ADR 0037](./0037-el-mastil-pide-su-alto.md) el mástil pedía el alto que
llenaba su ancho, porque el dibujo tenía **proporción fija**: 712 por 230, con el
`preserveAspectRatio` de siempre.

Una proporción fija tiene una consecuencia que no se vio al decidirla: **cuando
manda el alto, sobra ancho**. En una ventana de 606 píxeles, lo que le queda al
mástil después de las barras y del suelo de la canción son 166, y con 166 de alto
la proporción solo deja 514 de ancho: el mástil se dibujaba como un cuadrado en
medio de la pantalla, con casi cuatrocientos píxeles muertos a cada lado.

Se intentaron dos cosas antes de esta, y las dos están medidas:

- **Bajarle el suelo a la canción** para que el mástil quepa entero dentro del
  banco. No se puede: con 112 px la fila de dentro del arreglo se queda en cero y
  el panel de «Qué poner ahora» sale entero fuera de la pantalla.
- **Un botón de «ver grande»** que apartaba la canción, y que además se activaba
  solo por debajo de 800 px de alto. Funcionaba —de 514 a 1183 de ancho— pero es
  un mando para arreglar una limitación del dibujo, y la pantalla ya tiene
  demasiados.

## Decisión

**El mástil deja de tener proporción fija: mide su hueco y reparte los trastes
por él.** El alto lo pone el hueco; el ancho de cada traste sale de dividir lo
que haya entre los doce.

- El hueco lleva un alto medido —las barras, el suelo del arreglo con la tira de
  un área plegada y la cabecera del área—, no una proporción.
- El dibujo se mide con un `ResizeObserver`, igual que el pentagrama y por la
  misma razón: hace falta **el número**. Estirando el SVG con
  `preserveAspectRatio="none"` se estirarían también las notas, y un mástil de
  notas ovaladas no es un mástil.
- **Nunca se encoge por debajo de su tamaño natural.** Si el hueco es más
  estrecho que su proporción de siempre, se queda como estaba y se centra:
  apretando los trastes las notas dejarían de caber dentro.
- El botón de «ver grande» desaparece, y con él su apertura automática.

## Lo que se gana, medido

Con la canción escrita y el mástil abierto, lo que se pinta de ancho:

| Ventana     | Antes (proporción fija) | Ahora            |
| ----------- | ----------------------- | ---------------- |
| 1314 × 606  | 514 px (40 %)           | **1290 (100 %)** |
| 1366 × 768  | 1079 (79 %)             | **1342 (100 %)** |
| 1024 × 600  | 260 (26 %)              | **1000 (100 %)** |
| 1440 × 900  | 1416 (100 %)            | 1416 (100 %)     |
| 1920 × 1080 | 1896 (100 %)            | 1896 (100 %)     |

Llena el ancho en todos, y la sonda de medidas sigue dando cero recortados.

## Lo que no arregla, y hay que decirlo

**Las notas no se hacen más grandes por estirar.** Lo que decide su tamaño es el
alto, no el ancho. Eso se arregla en el [ADR 0040](./0040-ni-cuadrado-ni-tira.md),
que le saca alto a la canción dejándola desplazarse en vez de cortarse.

## Alternativas descartadas

**`preserveAspectRatio="none"`.** Es el estiramiento de una línea, y deforma:
las notas pasan a ser óvalos y los puntos de referencia, rectángulos. Un diagrama
de guitarra se reconoce por su forma.

**Quitar más trastes cuando hay poco alto.** No serviría: el tamaño de las notas
lo pone el alto, así que con menos trastes se verían igual de pequeñas y además
habría menos mástil. Y el mástil dejaría de ser el mismo dibujo según dónde se
mire.

**Dejar el botón de «ver grande» además de esto.** Ya no arregla nada que no
arregle el estiramiento, y un mando que sobra es un mando que hay que entender.

## Lo que hay que saber si se toca

- **El alto del hueco va en clases de Tailwind y no en una constante**, porque
  Tailwind lee las clases del fichero: una armada en ejecución no existe.
- En estrecho el área es una pestaña y el alto lo pone la proporción natural con
  `aspect-[712/230]`, escrita a mano por lo mismo. **Hay un test que falla si esa
  clase y las constantes dejan de coincidir.**
- Se mide con `node .claude/skills/arrancar/auditar-componer.mjs` y con la sonda
  de medidas.
