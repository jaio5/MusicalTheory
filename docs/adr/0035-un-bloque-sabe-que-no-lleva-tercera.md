# ADR 0035 — Un bloque sabe que no lleva tercera

Fecha: 2026-09-18 · Estado: aceptada · Amplía: [ADR 0032](./0032-la-progresion-y-el-montaje-son-lo-mismo.md)

## Contexto

Desde el [ADR 0032](./0032-la-progresion-y-el-montaje-son-lo-mismo.md), pulsar un
acorde en «a dónde ir» lo escribe en la canción. Lo escribe **si tiene grado**: la
tríada sale de las notas con `triadInside` y el grado de la tríada con
`degreeOfChord`, y un bloque guarda ese grado y su séptima. Lo que no tiene
tercera no tiene tríada, así que no tiene grado, así que no se puede escribir: el
botón lo dice —«Probarlo» en vez de «Ponerlo en la canción»— y lleva al camino.

**Medido, y por eso este documento existe.** De los catorce acordes que propone
la lista, **tres no caben, y son los mismos en los seis estilos**: `C5`, `F5` y
`G5`. Ni uno más: las suspendidas y las sextas que el catálogo sabe generar no
llegan a los catorce primeros en ningún estilo.

Es decir: lo único que esta aplicación propone y no deja escribir es **el acorde
de quinta**. Y no es un caso raro en una aplicación de guitarra con Rock y Metal
entre sus estilos: un riff de rock **es** una sucesión de quintas. La pantalla
las ofrece en cada estilo y luego dice que solo se pueden probar.

Hay además una asimetría que se ve mirando: un `Fmaj7` sí entra, porque el bloque
sabe guardar séptimas. La diferencia entre `Fmaj7` y `F5` no es musical, es de qué
campos tiene el bloque.

## Decisión

**Un bloque guarda una especie, y la especie puede ser «sin tercera».** El campo
`seventh?: SeventhQuality` pasa a ser `especie?: SeventhQuality | 'quinta'`.

Un acorde de quinta **tiene grado**: es el grado de su fundamental en la
tonalidad, tocado sin la tercera. Eso es lo que quiere decir un guitarrista al
escribir `C5` en Do mayor, y es lo que permite que cambiar de tonalidad siga
traduciendo la canción ([ADR 0030](./0030-cambiar-de-modo-traduce-la-cancion.md)):
un `I5` en Do es un `C5` y en La menor es un `A5`, sin tocar el bloque.

El grado se saca **de la fundamental y no de la tríada**, que es lo que hoy falla:
sin tercera, `triadInside` no tiene nada que decir, pero la fundamental sigue
cayendo en un grado de la tonalidad.

**Una especie y no tres campos.** Al guardar la canción, las séptimas ya viajan en
una lista paralela a los grados; meter las quintas en otra lista sería la tercera
—`sources`, `sevenths`, `quintas`— y tres listas que hay que mantener alineadas
son tres maneras de desalinearlas. Va una sola: `especies`.

## Alternativas descartadas

**Dejarlo como está: las quintas se prueban y no se escriben.** Es lo de hoy, y
es defendible mientras sean un caso raro. Dejó de serlo al medirlo: son el único
hueco que queda y salen en los seis estilos, incluidos los dos donde son el
lenguaje —rock y metal—. Una aplicación de guitarra que propone un riff y no deja
escribirlo está dando un consejo que ella misma no sabe seguir.

**Que el bloque guarde una especie cualquiera** —un `ShapeId` entero: `sus2`,
`sus4`, `6`, `7#9`, `7sus4`—. Es la versión general y la tentación evidente, y se
descarta por lo mismo que se descartó preguntarle a la IA lo que el dominio sabe:
resuelve un problema que no se tiene. De las once especies del catálogo, diez ya
caben o no llegan a proponerse nunca; abrir el modelo a todas obligaría a que el
pentagrama, el ensayo y el guardado supieran dibujar, comparar y guardar formas
que nadie escribe. Cuando alguna aparezca de verdad en la pantalla, este ADR se
amplía con la medida delante, como se ha ampliado con esta.

**Guardar la quinta como su tríada, sin decirlo.** `C5` entra como `C`. Es la
opción de una línea y es la peor: escribes un acorde y te devuelven otro, que es
justo el fallo que se acaba de arreglar con las séptimas —se guardaban como
tríadas y volvían sin la séptima—. Lo que esta aplicación no hace es cambiar lo
que escribes sin decírtelo.

**Guardar el cifrado en vez del grado.** Quita el problema de raíz y rompe lo que
sostiene todo lo demás: una canción guardada se abre en otro tono porque lo que se
guarda son grados ([ADR 0032](./0032-la-progresion-y-el-montaje-son-lo-mismo.md)).

## Consecuencias

- **`blockChord` es el único sitio que lo traduce.** Ya lo era para las séptimas:
  el grado resuelto da la fundamental bien escrita y encima se pone la especie.
  Una quinta son dos notas, la fundamental y su quinta justa.
- **El ensayo tiene que compararlo bien.** `suenaComo` exige el mismo conjunto de
  clases, y el croma oyendo una quinta entrega dos notas: comparándola contra la
  tríada, un riff bien tocado contaría como fallo. El guion del ensayo pasa a
  llevar la especie, no solo el grado.
- **El pentagrama no se entera, y eso está bien.** Escribe los cifrados encima
  del pentagrama y las cabezas que dibuja son las del punteo, no las del acorde,
  así que le basta con `blockChord`: pone `C5` donde antes ponía `C`. Si algún día
  dibujara el acorde, tendría que pintar dos notas y no tres.
- **A la IA no le cambia nada**: se le siguen mandando grados, y un `I5` es un `I`
  para lo que ella decide. No se toca el contrato ni los cupos.
- **Las canciones de antes no se enteran.** La especie es opcional y ausente
  quiere decir tríada, igual que las séptimas: leer y volver a guardar sin tocar
  nada sigue dando lo mismo.
