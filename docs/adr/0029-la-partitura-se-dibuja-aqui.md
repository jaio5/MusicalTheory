# ADR 0029 — La partitura se dibuja aquí, y no la trae una librería

Fecha: 2026-09-15 · Estado: aceptada · Amplía: [ADR 0019](./0019-punteos-y-partitura.md)

## Contexto

El pentagrama de `Montar` se veía pobre, y al medirlo resultó que no era una
impresión: la cabeza de la nota estaba al **63 %** de su tamaño —`ry 3.8` sobre un
espacio de doce—, la plica medía 2,2 espacios en vez de los 3,5 de siempre, las
divisorias iban más apagadas que las propias líneas del pentagrama y faltaban la
indicación de compás y la barra final. La clave de sol tenía la masa en el lado
contrario al que la tiene una de imprenta y se leía como una clave de fa.

Arreglar eso a mano costó tres intentos sobre la clave y un banco de pruebas para
comparar variantes a las dos escalas. Y ahí aparece la pregunta que este proyecto
no se había hecho: **si esto lo tiene que dibujar la aplicación o lo tiene que
traer una librería de grabado musical**, que es lo que hace todo el mundo.

La pregunta es real porque el grabado es un oficio con cuatro siglos de
convenciones, y cada una de esas convenciones es un fallo posible: las dos tablas
de alturas de la armadura, el puntillo que nunca va sobre una línea, la alteración
que no se escribe si ya la trae la armadura, el becuadro que sí. Las cuatro
estaban mal aquí en algún momento.

## Decisión

**El pentagrama se sigue dibujando en este repositorio, en SVG propio**, y la
calidad se sostiene con medidas derivadas y con tests que fijan las invariantes,
no con números probados a ojo.

La razón no es orgullo, es lo que este pentagrama **es**. No es un visor de
partituras: es una superficie que se manipula.

- Las notas se arrastran, se estiran y se eligen, y los cifrados se mueven y se
  estiran tirando de la punta de su línea.
- Comparte **el mismo píxel por pulso** con la tira de bloques, porque las dos
  vistas son la misma canción con dos pieles ([ADR 0019](./0019-punteos-y-partitura.md)).
- Se pinta con los tokens del tema, en oscuro y en claro, y la nota que suena se
  resalta durante la reproducción.
- Vive dentro de las capas: `features/` dibuja, `core/music` decide, y la altura
  viaja como semitonos sobre la tónica y no como una nota absoluta.

Una librería de grabado trae su propio motor de disposición, su propia fuente y su
propio modelo. Las cuatro cosas de arriba habría que reconstruirlas encima de ella
o en contra de ella.

Y hay una segunda razón, más incómoda: **el modelo no tiene lo que una librería
espera**. `melody.ts` no tiene silencios, ni ligaduras, ni grupos irregulares, ni
dos voces, y limita las duraciones a las seis figuras que se pueden escribir. Una
librería pide una partitura completa; aquí hay una melodía de semitonos sobre la
tónica con duraciones acotadas. Adaptarla significaría inventar lo que falta para
poder pedírselo.

Lo que sí se adopta es **el rigor de imprenta como referencia numérica**: las
proporciones de la clave y los tamaños de cabeza, plica y líneas adicionales se
contrastan contra las de una fuente musical estándar, en espacios de pentagrama, y
se dejan escritas en el código como divisiones y no como constantes sueltas.

## Consecuencias

- Cada convención de grabado que falte hay que descubrirla y escribirla. Ya han
  aparecido cuatro por el camino, y aparecerán más al llegar los silencios.
- A cambio, arreglar el grabado entero fue **un fichero**, sin tocar el modelo ni
  la reproducción ni las capas.
- Las invariantes de la clave están en `clef.test.ts` y no en el ojo de nadie: los
  dos cruces con el mástil, la espiral muriendo sobre la línea del Sol, la altura
  en espacios y que sea más alta que ancha. Esos tests cazaron dos errores de
  diseño que la vista había dado por buenos.
- Los márgenes de la clave salen de la caja del contorno, así que **cada vez que
  cambie el trazo hay que volver a medirlos**. Está anotado donde se declaran.
- Dibujar una letra a mano es aproximar: la clave costó tres vueltas, y la tercera
  solo salió al comparar proporciones con las de imprenta en vez de a ojo.

## Alternativas descartadas

**VexFlow**, que es lo que usaría cualquiera. Graba de verdad y resuelve de un
golpe los silencios, el barrado, los grupos irregulares y las ligaduras que aquí
habrá que escribir. Se descarta porque **es dueña de la disposición**: decide
dónde cae cada nota, y aquí el sitio de cada nota lo decide el píxel por pulso que
comparte con la tira de bloques. Habría que o pelearse con su motor o dejar de
tener dos vistas de lo mismo. Además dibuja con su propia fuente y su propio color,
que es justo lo que los tokens del tema existen para evitar.

**abcjs.** Renderiza notación ABC, que es texto. El modelo de aquí no es ABC, y
convertirlo en cada pintada —y de vuelta en cada arrastre— añade una traducción
con pérdida en el camino más caliente que tiene la pantalla.

**OpenSheetMusicDisplay, con MusicXML.** Está pensada para leer partituras
completas escritas en otro sitio, que es lo contrario de lo que pasa aquí: aquí la
partitura se escribe pulsando. Pesa lo que pesa un editor y se usaría como visor.

**Traer solo la fuente musical** —Bravura u otra SMuFL, con licencia abierta— y
quedarse con la disposición propia. **Es la alternativa fuerte**, y se descarta
por ahora y no para siempre: hoy los glifos que hacen falta son cinco —clave,
sostenido, bemol, becuadro y cabeza— y dibujarlos ya está hecho y probado. Se
reconsidera **cuando lleguen los silencios y los grupos irregulares**, que son
media docena de glifos más y de los difíciles; ese es el momento en que el coste
de dibujar supera al de vendorizar una fuente, su licencia y su atribución.

**Dejarlo como estaba.** Se descarta por lo medido: una cabeza al 63 %, una clave
que se leía como la de otro instrumento y bemoles repetidos que la armadura ya
traía. No era una cuestión de gusto.
