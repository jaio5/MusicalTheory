# ADR 0019 — El punteo, y las dos maneras de escribirlo

Fecha: 2026-09-07 · Estado: aceptada · Amplía: [ADR 0018](./0018-el-lienzo-de-montar.md)

## Contexto

El lienzo de montar sabía de acordes y de nada más. Es lo que había: una canción
en este proyecto era **armonía y su reparto en el tiempo**, y `capture.ts` lo
decía de su propia captura —«no hay ritmo dentro del compás, no hay melodía»—.
Con eso se monta el acompañamiento entero y ni una línea de solo.

Y hay dos maneras muy distintas de escribir una melodía según quién la escriba.
Quien lee partituras quiere un pentagrama; quien no ha leído una en su vida
quiere cajas que se arrastren y que ninguna suene mal. Las dos son la misma
melodía.

## Decisión

**Una nota se guarda como semitonos sobre la tónica**, en `core/music/melody.ts`.
Cero es la tónica, siete la quinta, doce la octava. Es la misma lección que los
acordes ya aprendieron tres veces: cambiar de tonalidad la canción entera se
convierte en no hacer nada, porque el punteo se mueve con ella.

Frente a guardar el **grado de la escala** —«la tercera de la pentatónica»—, que
sería más seguro para quien no sabe, se gana lo que hace falta de verdad: **se
puede escribir una nota que no está en la escala.** La nota de paso cromática es
medio idioma del blues, y una partitura donde no cabe no es una partitura, es una
rejilla.

**El tiempo va en pulsos, sobre una rejilla de media pulso, y las duraciones son
solo las seis que tienen figura** —de la corchea a la redonda, con sus
puntillos—. Ese tope está en el dominio y no en el dibujo, y es lo que garantiza
que nunca haya una nota que la partitura no sepa escribir.

**Y hay dos vistas de lo mismo, con las mismas acciones y el mismo píxel por
pulso. La partitura es la que sale al entrar:**

- **Con punteo** es una rejilla de cajas bajo los acordes. La casilla de «solo la
  escala» es la que separa una interfaz de la otra: encendida, las filas son las
  notas de la escala que hay puesta y **no hay manera de escribir una que
  desafine**, porque la interfaz no ofrece las de fuera. Apagada aparecen las
  doce.
- **Partitura** es un pentagrama de verdad, y ahí **los acordes también viven
  dentro**: cifrados encima con una línea que dice hasta dónde llegan, y sin la
  tira de bloques repitiendo lo mismo justo encima. Se pulsan, se quitan y se
  estiran tirando de la punta de su línea.

**Una parte tiene sitio antes de tener contenido.** Trae cuatro compases —una
frase—, se alarga y se acorta de uno en uno, y el número se escribe si el sitio
que hace falta está lejos. De dos en dos estuvo y no cabía: como no se puede bajar
de lo que hay escrito, pegado a ese suelo el botón movía uno en vez de dos y desde
el suelo mismo no movía nada. Antes el pentagrama medía lo que
hubiera dentro, así que la única manera de escribir en el compás cuatro era
rellenar los tres primeros: al revés de como se escribe música, donde primero hay
papel. Es una medida de papel y no de sonido: alargar una parte no le añade
silencio al final. Y no se puede acortar por debajo de lo que hay escrito, porque
un botón que borra compases con acordes dentro borra trabajo sin decirlo.

**Las dos se justifican al ancho, y no de la misma manera.** El pentagrama
reparte los pulsos de **su** parte en la línea, porque un sistema ocupa el papel
entero tenga cuatro compases u ocho; con medida fija, una parte corta salía como
un sello en la esquina de una pantalla vacía.

La tira de bloques necesita lo contrario: allí la anchura de una caja **es** su
duración y hay que poder compararlas de un vistazo, también **entre partes**. Así
que se justifica una vez para todo el lienzo, a partir de la parte más larga, y
ese mismo número lo usan todas: una parte de ocho compases sigue midiendo el doble
que una de cuatro.

Fija estuvo, en veinticuatro píxeles por pulso, y no valía: cuatro compases
ocupaban 384 píxeles de los mil y pico de un portátil y el resto era hueco. Y la
medida fija tampoco cumplía lo que prometía, porque un bloque nunca baja de
sesenta y ocho píxeles para que el cifrado se lea: por debajo de tres pulsos, dos
duraciones distintas ya se dibujaban igual. Calculada al ancho, el suelo se pisa
mucho menos.

**Es la vista por defecto**, y no un extra detrás de un conmutador. Es donde se
escribe: los acordes van encima, las notas dentro, y las dos cosas se arrastran.
Empezar por una tira de bloques y esconder la partitura la convertía en una
decoración para expertos, cuando es la manera de escribir una canción que existe
desde hace cuatro siglos. Quien no la lea tiene los bloques a un toque.

**Los acordes se ponen de tres maneras, y las tres respetan dónde estás**:
pulsando una propuesta, arrastrándola **hasta el compás donde va** —con una marca
que enseña el hueco antes de soltar— o **escribiendo el cifrado**, que entra
detrás del compás elegido. Meterlos siempre al final obligaba a escribir y
arrastrar después, que son dos gestos para una cosa; y sobre una partitura,
soltar encima de un compás y ver el acorde aparecer cuatro más allá se lee como
que el gesto no ha funcionado. Lo escrito se convierte en
el grado que le toca y el botón enseña **el cifrado que va a quedar**, no el que
se tecleó, porque enterarse después —con el acorde ya puesto— es peor que verlo
antes.

Aquí decía que un `Am7` entraba como `Am` «porque un grado es una tríada», y era
verdad: el bloque guardaba el grado y nada más, así que la séptima se caía sin
avisar en todos los acordes, no solo en los raros. **Ya no.** El bloque guarda
además la especie, así que un `Am7` entra como `Am7`, se escribe con su séptima y
suena con ella. El grado sigue diciendo **cuál** es el acorde en esta tonalidad
—que es lo que permite cambiar la canción entera de tono— y la especie dice
**qué** acorde es; son dos preguntas distintas y ahora hay sitio para las dos.

**Arrastrar es por escalones en la partitura y por filas en la rejilla.** Subir
una nota en el pentagrama la lleva a la línea de encima, y qué nota es esa lo
dice la armadura: en Sol mayor, subir del Mi da un Fa **sostenido**. Los
cromatismos no se escriben moviendo la nota sino alterándola, con las teclas de
más y menos.

## Consecuencias

`core/music` gana `melody.ts` y `circle-of-fifths.ts` gana la armadura, que hacía
falta para dos cosas que parecían distintas y son la misma: dibujar el pentagrama
y saber qué nota se escribe en cada línea.

`Part` gana `notes`, y `soundOf` mete acordes y punteo **en una sola lista de
sonidos** para que suenen contra el mismo reloj: dos reproductores tendrían dos
`AudioContext` y unos milisegundos entre el acorde y la nota se oyen como un
golpe doble.

Lo que sigue sin haber: ligaduras, tresillos, dos voces y silencios escritos. No
es una renuncia de dibujo, es que el modelo no tiene ninguna de esas cosas.

**Y el punteo todavía no se guarda.** Una canción de `song.ts` son grados; la
melodía se pierde al guardar, igual que se pierde la duración de un bloque. Es lo
siguiente, y toca el esquema y el contrato de dos rutas.

## Alternativas descartadas

**Guardar la nota por su grado de escala**, que es lo más seguro para quien no
sabe música: cambiar de escala arrastraría el punteo y no habría manera de
escribir algo que desafine. Se descarta porque cierra el cromatismo, y con él la
mitad del vocabulario de un solo. Lo que se buscaba con ello —que quien no sepa
no se equivoque— se consigue igual desde la interfaz, con «solo la escala», y sin
cerrarle la puerta a nadie.

**Una sola vista, la de bloques.** Menos código y menos que mantener. Se descarta
porque la partitura no es una decoración para expertos: es cómo se lee una
melodía cuando se sabe leerla, y sin ella este lienzo le dice a quien lleva veinte
años tocando que su manera de escribir no cabe aquí.

**Una librería de notación** —VexFlow es la que tocaría—. Trae tipografía musical
de verdad y todos los casos raros resueltos. Se descarta por dos razones y la
segunda es la que decide: pesa más que todo lo que este proyecto lleva junto, y
**no edita**. Aquí la partitura no es una imagen: se pincha para escribir, se
arrastra para mover y se tira para estirar, y esa parte habría que escribirla
igual, mapeando coordenadas sobre un dibujo ajeno. Con el modelo acotado a seis
duraciones, dibujarlo entero son doscientas líneas y se controla todo.

**El símbolo Unicode para la clave de sol** (`U+1D11E`). Es lo primero que se
probó, y en el navegador salía **un cuadro vacío**: los símbolos musicales de
Unicode no están en las fuentes de sistema. Se dibuja con trazos, como ya se
dibujan aquí los diagramas de acorde. No es tipografía musical y no lo pretende.

**Una manija aparte para estirar**, tanto en las notas como en los acordes de la
partitura. Se descarta por la regla de los cuarenta y cuatro píxeles: sería un
control de catorce en una interfaz donde nada de lo que se pulsa baja de esa
altura. Se resuelve con un solo control y dos zonas, y el cursor lo dice.

**Que la rejilla de notas cumpla los cuarenta y cuatro píxeles por fila.** Es la
regla de la casa y aquí se incumple a propósito: una octava son doce filas, y a
cuarenta y cuatro píxeles cada una serían quinientos treinta de alto para una
sola parte. Ningún editor de música lo hace, y el gesto que se hace aquí no es
apuntar a ciegas con la guitarra puesta, sino colocar una nota mirando. Es la
única excepción del proyecto y queda escrita aquí para que no se copie a otro
sitio por analogía.
