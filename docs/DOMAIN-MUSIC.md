# El dominio musical, en lenguaje de músico

Este documento explica qué hace `src/core/music/` sin que haga falta leer
TypeScript. Si algo aquí te parece mal desde el punto de vista musical, el
código está mal, no el documento.

## Notas y frecuencias (`notes.ts`)

Todo se ancla en **La4 = 440 Hz** y en **temperamento igual**: la octava se
parte en doce semitonos iguales, cada uno con una razón de frecuencia de
2^(1/12).

- **Número MIDI**: numerar las notas de forma continua. La4 es el 69, y subir
  un semitono es sumar uno. Es más cómodo que trabajar con hercios porque la
  aritmética musical se vuelve suma y resta.
- **Clase de altura**: la nota olvidando la octava. C = 0, C# = 1, ...,
  Si = 11. Un Mi grave y un Mi agudo son la misma clase de altura, que es lo
  que importa para hablar de escalas y de acordes.
- **Cents**: la centésima parte de un semitono. Una octava son 1200 cents. El
  afinador trabaja aquí: +12 cents significa doce centésimas de semitono por
  encima de la nota, o sea alta. Negativo, baja.

La conversión devuelve siempre la nota temperada **más cercana** y la
desviación respecto a ella, que queda entre -50 y +50 cents. No hay caso en
que el afinador diga «G muy alto» cuando lo que quiere decir es «G#».

**Sobre los nombres**: se usa notación anglosajona (C, C#, D...) porque el
cifrado de acordes es así en todo el repertorio de rock: `Am`, `G`, `F`. Para
toda la interfaz se escribe así: C, D, E, no Do, Re, Mi.

**Cada tonalidad decide si se escribe con sostenidos o con bemoles.** La regla
es su posición en la rueda de quintas: de C a F# se van añadiendo sostenidos,
y de ahí en adelante sale más corto contarlo como bemoles. Así, F mayor escribe
Sib y no La#, que es lo correcto. Una tonalidad menor se escribe como su
relativa mayor: D menor lleva Sib porque es la relativa de Fa. Fa# y Solb
empatan a seis alteraciones; gana Fa#, que es lo que escribe todo el mundo en
guitarra.

## Escalas (`scales.ts`)

Una escala aquí es una lista de intervalos en semitonos desde la tónica. No
tiene octava ni digitación: es el conjunto de notas que valen.

| Escala            | Intervalos     | Qué aporta                                                           |
| ----------------- | -------------- | -------------------------------------------------------------------- |
| Mayor             | 0 2 4 5 7 9 11 | La referencia. Todo lo demás se explica como alteración de esta.     |
| Menor natural     | 0 2 3 5 7 8 10 | La relativa menor: mismas notas, otro centro.                        |
| Pentatónica mayor | 0 2 4 7 9      | A mayor sin cuarta ni séptima, los dos grados que chocan.            |
| Pentatónica menor | 0 3 5 7 10     | La caja del rock.                                                    |
| Blues             | 0 3 5 6 7 10   | La pentatónica menor con la quinta bemol de paso.                    |
| Dórico            | 0 2 3 5 7 9 10 | Menor con sexta mayor. Menos oscura.                                 |
| Mixolidio         | 0 2 4 5 7 9 10 | Mayor con séptima menor. El riff sobre dominante.                    |
| Frigio            | 0 1 3 5 7 8 10 | Menor con segunda bemol. El giro español y el metal.                 |
| Menor armónica    | 0 2 3 5 7 8 11 | Menor con sensible: crea la dominante que la menor natural no tiene. |

Transponer es sumar la tónica a cada intervalo. La pentatónica menor de La sale
A, C, D, E, G; el blues de A añade el Eb, y no el D#: es una quinta rebajada, y
lo que se rebaja se escribe con bemol (lo explica «Cómo se escribe cada escala»).

**La escala es una sola para toda la aplicación** —la de la tonalidad, la del
mástil, la que lee el punteo y la que se le da al profesor— y se recuerda de una
vez para otra. En componer se cambia también desde la cabecera del mástil, con
flechas para pasar a la vecina, y el dibujo se repinta sin cerrar el área: es
para ver cómo cambia una escala sobre la misma tonalidad.

## Acordes (`chords.ts`)

Los acordes diatónicos se obtienen **apilando terceras de la propia escala**:
sobre cada grado se pone la nota que está dos posiciones más arriba en la
escala, y la que está cuatro más arriba. Con siete notas eso da siete tríadas.

La especie sale de los dos intervalos resultantes:

- tercera mayor + quinta justa (4 y 7 semitonos) → **mayor**
- tercera menor + quinta justa (3 y 7) → **menor**
- tercera menor + quinta disminuida (3 y 6) → **disminuido**
- tercera mayor + quinta aumentada (4 y 8) → **aumentado**

En **C mayor** salen: C, Dm, Em, F, G, Am, Bdim — o sea I, ii, iii, IV, V, vi,
vii°. En **A menor natural**: Am, Bdim, C, Dm, Em, F, G — i, ii°, III, iv, v,
VI, VII. Son los mismos siete acordes con otro centro, que es exactamente lo
que significa «relativa menor».

En **menor armónica** aparecen los dos acordes que la natural no tiene: la
dominante mayor (V, con sensible) y un aumentado en el tercer grado.

Los números romanos van en mayúscula para mayor y aumentado, en minúscula para
menor y disminuido, con `+` y `°` respectivamente.

Solo se armonizan escalas de siete notas. Apilar terceras sobre una pentatónica
daría acordes que nadie toca, así que el tipo lo impide.

## Detección de tonalidad (`keys.ts`)

El método es el de **Krumhansl y Kessler**. La intuición:

1. Cada tonalidad tiene un reparto típico de cuánto suena cada nota. En C
   mayor el C suena mucho, el G bastante, el C# casi nada.
2. Se cuenta lo que está tocando el guitarrista, nota a nota, en un histograma
   de doce casillas.
3. Se compara ese reparto con los veinticuatro perfiles posibles (doce mayores
   y doce menores) y gana el que más se le parece.

El parecido se mide con la **correlación de Pearson**, que compara la _forma_
del reparto y no su tamaño: da igual que haya tocado diez notas o mil.

Se devuelven las **tres mejores candidatas con su puntuación**, no una sola. En
música la ambigüedad es real: A menor y C mayor tienen las mismas notas, y lo
único que las separa es en cuál se apoya el que toca. Enseñar tres candidatas
con su nota de confianza es más honesto que fingir certeza. Si no ha sonado
nada, la lista viene vacía y la interfaz debe decirlo, no inventarse un tono.

### El histograma decae

Un histograma que solo suma se queda anclado al principio de la sesión: si
empiezas en C mayor y a los tres minutos te pasas a E menor, la detección
seguiría diciendo C mayor durante mucho rato.

Por eso cada nota **pierde peso con el tiempo**, con una vida media de veinte
segundos: lo que sonó hace veinte segundos pesa la mitad, lo de hace cuarenta un
cuarto. Veinte segundos es más o menos media vuelta de una progresión lenta:
suficiente para no bailar con cada nota de paso, y poco para seguir un cambio
de tono real.

El decaimiento no lo dispara un temporizador: se aplica cuando llega la
siguiente nota, calculando cuánto tiempo ha pasado. Por eso el dominio recibe
el instante por parámetro en vez de leer el reloj.

## Progresiones (`progressions.ts`)

Un mapa de **a dónde se suele ir desde cada grado**, con pesos de frecuencia de
uso. El criterio es de rock, no de coral a cuatro voces. En la práctica:

- El **bVII** es un grado de primera clase, no una licencia. `I – bVII – IV` es
  una cadencia normal y evita la sensible.
- La **dominante menor** (`v`) es tan válida como la mayor en tonalidad menor.
  A mayor aprieta más porque trae la sensible del menor armónico.
- **V – IV** existe y se usa constantemente en blues, aunque en armonía clásica
  se considere una retrogradación.
- Los **prestados del menor** en tonalidad mayor son cuatro: bIII, bVI y bVII
  —mayores— y el **`iv`**, que es menor y el que más se usa: la cadencia plagal
  menor `I–iv–I` y el giro `IV–iv–I` son idioma corriente en pop y en soul
  ([adr/0036](./adr/0036-el-cuarto-menor-prestado.md)). El napolitano (bII) está
  en menor por el color frigio.
- El **vii°** casi no se usa: aparece marcado con peso bajo y con la nota de
  que en rock se sustituye por V.

Además hay un catálogo de progresiones completas con nombre: el bucle de cuatro
acordes (I–V–vi–IV), el rock and roll (I–IV–V), el giro mixolidio (I–bVII–IV),
el blues de doce compases, el descenso menor (i–VII–VI–VII), la cadencia
andaluza (i–VII–VI–V) y la plagal menor (i–iv–i–v).

Cualquier grado se puede convertir en acorde concreto dentro de una tonalidad, y
al revés: dado un acorde sonando se puede saber qué grado es, incluidos los
prestados, para sugerir a dónde ir desde ahí.

### Cambiar de modo con la canción escrita

Los dos modos no nombran los mismos grados, así que al pasar de mayor a menor
cada grado se dice en el otro **por su función** (`degreeInMode`): el `I` es el
`i`, el `IV` el `iv`, el `vi` el `VI`. Las dominantes secundarias también: la del
`vi` pasa a ser la del `VI`, que es el `III` —en Do, el E7 que lleva a Am se
vuelve el Eb7 que lleva a Ab—, y la del `iii` pasa a ser el `VII`. Lo único que no
tiene dónde caer es **la dominante del `ii`**: en menor el segundo grado es
disminuido, y a un disminuido no se le prepara con su dominante. Ésa se cae, y el
almacén del montaje la apunta para poder decirlo.

La tabla sola no es reversible —el mayor tiene dieciséis grados y el menor once,
y el `vi` y el `bVI` caen los dos en el `VI`—, así que **cada bloque traducido
recuerda lo que era** (`Block.delOtroModo`) y al volver se le devuelve tal cual:
C G Am F en mayor va a menor y vuelve C G Am F, no C G Ab Fm. Lo que se corrige
en el otro modo olvida el recuerdo, porque volver a lo de antes desharía la
corrección. Y traducir no gasta un paso del deshacer.

### Cuatríadas

Lo mismo apilando una tercera más: sobre cada grado, la nota que está seis
posiciones más arriba en la escala. Salen las siete especies habituales, con su
cifrado y su grado:

En **C mayor**: Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7b5 — o sea Imaj7, ii7,
iii7, IVmaj7, V7, vi7, viiø7. Hay **una sola dominante**, la del quinto grado, y
es lo que la convierte en el acorde que pide volver a casa.

En **menor armónica** aparecen el disminuido séptima sobre la sensible y la
dominante con séptima menor, que es justo lo que la menor natural no tiene.

Un Cmaj7 y un C7 son el mismo grado con distinta séptima, así que el dominio
sabe decir qué tríada hay debajo de cada cuatríada.

**Las notas de cada especie salen de apilar terceras**, de la misma tabla que las
nombra, y no del catálogo de cifrados del buscador. Ese catálogo no tiene `mMaj7`
ni `maj7#5`, y cuando de él salían las notas, esas dos caían a la tríada mayor:
un `CmMaj7` sonaba como un `C`, y como reconocer una séptima es comparar contra
esas notas, **cualquier cuatro notas con la tríada mayor dentro se leían
`minorMajor7`**. Un `C6` o un `Cadd9` entraban en la canción como `CmMaj7`.

**Lo que no es ninguna séptima entra como su tríada**, que es lo que ya pasaba
con un `C7b9`: un `C6` y un `Cadd9` son el I a secas, porque el bloque no sabe
guardar la sexta ni la novena, y el buscador enseña `C` antes de pulsar. Lo que
suena un bloque es siempre lo que se escribió o una parte, nunca una nota que
nadie pidió. En menor, un `F6` sobre Do menor ya no entra: el IV mayor no es un
grado de la menor, igual que no lo es el `F` a secas.

## Los dos anillos de la rueda

El de fuera va C, G, D, A... y el de dentro va Am, Em, Bm, F#m... Los
dos son círculos de quintas completos: el de los menores es el mismo recorrido
leído desde la relativa.

Por eso **se pueden intercambiar**, y la aplicación lo hace: al elegir una
tonalidad menor, las menores pasan al anillo de fuera. En la rueda de cartón de
toda la vida los mayores van siempre fuera, pero eso es una convención, no una
ley.

Lo que **no** cambia son las posiciones. A menor y C mayor comparten armadura
—las mismas notas, ninguna alteración— y por eso comparten sitio en la rueda.
Al pasar de una a otra la rueda no gira: solo se intercambian los anillos.

## Leer un cifrado y juzgarlo

Al revés que todo lo demás: en vez de partir de un grado y producir un cifrado,
se lee un cifrado escrito —`F#m7`, `Bb`, `Csus4`, `A7#9`— y se dice qué es.
Acepta las formas alternativas de escribir lo mismo (`min`, `-`, `M7`, `ø`, `+`)
y devuelve null cuando no lo reconoce, que es información útil: se puede decir
«no conozco ese acorde» en vez de callarse.

No hace falta escribirlo entero: con la fundamental basta para proponer. Quien
teclea «A» recibe A, Am, A7, Am7... en orden de uso en una guitarra, y lo que ya
esté escrito del todo va primero. Lo que no empieza por una nota reconocible no
propone nada, porque cualquier cosa sería adivinar.

Con el acorde leído se le puede preguntar si pega, y la respuesta tiene tres
grados:

- **Entra**: todas sus notas están en la tonalidad.
- **Cabe como color**: se sale, pero tiene un uso reconocido en el catálogo del
  estilo —un prestado, una dominante secundaria, un sustituto tritonal—.
- **Se va fuera**: se sale y no hay nada en el catálogo que lo justifique.

Que una nota se salga de la tonalidad no lo convierte en un error: la mitad de
lo que hace interesante a una progresión son notas de fuera. Lo que distingue un
color de un choque es si el acorde tiene un uso conocido.

## Cómo se escribe cada escala

Una escala se escribe con la armadura de la mayor de la que sale, que es la
regla de toda la vida. C mixolidio viene de F mayor, así que su séptima es Bb y
no A#. B menor viene de D mayor, así que su tercera es F# y no Gb. La
pentatónica menor de C sale de Eb mayor: C Eb F G Bb.

Cuando la mayor de origen es C no hay armadura que mande, y entonces decide la
escala: si rebaja algún grado, se escribe con bemoles. Por eso el blues de A
lleva Eb y no D#, que suena igual y no lo escribe nadie.

Suena a detalle y no lo es: leer «D#» donde esperas «Eb» te para un segundo, y
un segundo mirando la pantalla es un compás perdido.

## Formas de hacer un acorde

Las digitaciones no están copiadas de una tabla: se buscan. Para cada posición
del mástil se prueban las combinaciones de trastes que dan las notas del acorde
y se descartan las que no se pueden tocar. Las reglas:

- Tienen que estar **todas** las notas del acorde.
- La cuerda más grave que suena lleva la **fundamental**. Las inversiones son
  música válida, pero no es lo que se busca al aprender un acorde.
- La mano abarca **cuatro trastes**, contando solo lo que se pisa.
- Hay **cuatro dedos**. Si se pisan más cuerdas, el índice hace **cejilla** en el
  traste más bajo, y una cejilla no puede tener debajo una cuerda al aire ni una
  muda: la pisaría. Lo que no cabe en cuatro dedos así, no se ofrece. Por eso no
  sale `103211` para F —cejilla en el 1 con la quinta al aire debajo—, y sí
  `133211`.
- La cejilla solo cuenta **cuando hace falta**: D `xx0232` tiene dos cuerdas en
  el 2 y se coge con tres dedos sueltos.
- Una cuerda muda en medio de dos que suenan resta: se puede, pero cuesta.
- Dos dedos en el traste más bajo con cuerdas al aire entre ellos restan si
  están lejos: cerca se ponen —A7 `x02020`—, separados la mano se tumba y apaga
  las del medio. F `10321x` o Bm `x20402` se pueden escribir, y casi nadie las
  coge.

De las que sobreviven se ordenan por lo cómodas que son, y manda la posición: un
acorde en primera posición con cuerdas al aire es el que se aprende y el que se
usa, aunque más arriba haya diez formas más. Se devuelve **una por nombre**,
porque si no las cuatro mejores son la misma forma con cuerdas quitadas; y por
nombre y no por traste porque en el mismo traste caben dos manos: Bm sin cejilla
`x2443x` y con ella `x24432`.

El nombre dice cómo se coge. **«Al aire»** es lo que suena con cuerdas sueltas
dentro de la primera posición de la mano —sin pasar del cuarto traste—: G
`320003`, C `x32010`, Em `022000`. Lo demás es «3.ª posición», con «con cejilla»
si la lleva. Una forma se escribe pegada, `x32010`, mientras todos los trastes
son de una cifra; con uno de dos se separa, `x-8-7-10-10-8`, porque pegada no se
sabe dónde acaba cada uno.

Como se buscan y no se copian, funciona igual con un `7#9` que con un `Am`.

## A dónde ir desde un acorde

Dos cosas mandan: **cómo se mueve el bajo** y **cuántas notas comparten** los dos
acordes.

El movimiento del bajo tiene su propia tabla. Bajar una quinta es el encadenado
más fuerte que existe —es lo que hace V–I—; bajar un tono es la escalera del rock
menor; el tritono es el salto más raro y por eso se oye. Cada uno lleva escrito
en qué consiste.

Las notas compartidas cuentan **en proporción**, no en número: compartir dos de
cuatro no es más terreno común que compartir una de tres. Contarlas a secas
premiaría a los acordes grandes solo por tener más papeletas.

## Qué papel hace cada acorde (`harmonic-function.ts`)

Un grado no es solo un sitio en la escala: es un papel. Tres papeles y uno de
paso.

- **Tónica (T)** — reposo. Es donde la frase suena terminada. En mayor son el I,
  el iii y el vi.
- **Subdominante (S)** — la salida. Se ha ido de casa y todavía no hay tensión.
  El ii y el IV.
- **Dominante (D)** — tensión. Lleva el tritono dentro y pide resolver. El V y
  el vii°.
- **De paso (→)** — ni reposa ni resuelve. Es el disminuido cromático que une
  dos acordes por el semitono más cercano.

La agrupación no es arbitraria y se comprueba mirando las notas: **el I y el vi
comparten dos, el IV y el ii comparten dos, el V y el vii° comparten dos.** De
ahí sale la sustitución, que no necesita tabla aparte: dos acordes con el mismo
papel y dos notas en común se pueden cambiar el uno por el otro. El relativo
menor va donde iba la tónica porque es eso, no porque lo diga un libro.

La séptima menor de VII en modo menor es la única discutible. No tiene sensible,
así que no aprieta como un V de manual; pero en el idioma modal —el de quien coge
una guitarra eléctrica— va a i constantemente y hace de cadencia. Se marca como
dominante y el texto avisa de que llega sin sensible, que es lo que la distingue.

### En qué orden se enseñan

Primero los tres **tonales** —I, IV y V—, que sostienen una canción entera.
Después los **modales**, que dan el color del modo sin mover el centro. El
**disminuido, el último**: es el que menos se usa suelto y el que más asusta de
ver.

Antes esto lo decidía el alfabeto, porque a igualdad de peso el desempate era el
cifrado. En Do mayor eso proponía «Am, Bdim, C…»: el vi primero, un disminuido
segundo y la tónica tercera. Ordenado así no se puede aprender nada.

### El cifrado de una cuatríada no es el del acorde con un 7 detrás

`Cmaj7` es **Imaj7**, no «I7» —que es el acorde de dominante sobre la tónica, un
acorde distinto—. Y un `m7b5` es **ø7**, semidisminuido; escribirlo «°7» lo
confunde con el disminuido entero, que tiene la séptima disminuida y no la menor.

**Y su fundamental se escribe como la de su tríada.** El `bVII` de Do mayor es
`Bb`, así que con séptima es `Bb7`, no `A#7`: la especie no vuelve a decidir con
qué alteración va la nota, se la pregunta al grado, que ya sabe que un grado «b»
va con bemol valga lo que valga la armadura. Antes la decidía la armadura sola, y
en Do mayor salían `A#7`, `D#7` y `G#maj7` al lado de `Bb`, `Eb` y `Ab`. Vale en
las veinticuatro tonalidades y para las trece especies de un bloque, las séptimas
y las simples (`blockChord`).

## El temario sigue al conservatorio (`curriculum.ts`, `lecciones/`)

Lo que se enseña en `/aprender` va en el orden en que se estudia en España, y cada
curso usa solo lo explicado antes. Es el motivo de que el Elemental empiece por las
notas y no por los grados: no se puede hablar del quinto grado sin saber qué es una
escala.

- **Elemental, Lenguaje Musical.** 1º: notas, claves y ritmo. 2º: la escala mayor,
  los intervalos, el dictado de intervalos y la pentatónica mayor. 3º: armaduras y
  círculo de quintas, escalas menores, la menor natural, la pentatónica menor y el
  blues. 4º: las especies de tríada, los grados, y la teoría de pentatónicas y blues.
- **Profesional, Armonía.** 1º: funciones y cadencias. 2º: inversiones y enlace de
  acordes. 3º: especies de séptima y la séptima de dominante, con su cifrado
  (7, 6/5, +6, +4). 4º: dominantes secundarias, modulación e intercambio modal. 5º:
  napolitana y sextas aumentadas, y sustituciones. 6º: los siete modos.

Las pentatónicas y el blues no son de conservatorio, pero esto es para tocar, así
que van donde ya se tiene la teoría que las explica
([adr/0096](./adr/0096-el-temario-sigue-al-conservatorio.md)).

**Las cadencias llevan nombre español.** Perfecta (V–I), imperfecta, plagal
(IV–I), **semicadencia** (termina en V) y rota (V–VI). La que otros llaman
«auténtica» aquí es la perfecta, y así tiene que salir en toda frase que la cite.

### Cada nota con su letra (`spelling.ts`)

En una tonalidad cada grado lleva **una letra distinta**, y la alteración es lo que
haga falta para que suene bien: en Fa# mayor la séptima es **E#** y no F, y la
sensible de Sol# menor es **F##** y no G. Escribir «F» en el primer caso repetiría
la letra F con dos sonidos distintos. El mismo módulo nombra intervalos con ese
criterio: do–mi es una tercera mayor, pero do–fa bemol es una cuarta disminuida, aunque
suene igual.

### Cada unidad se presenta

Toda unidad lleva un `resumen` y la lista de `contenidos` que va a tocar. La
pantalla la recorre en tres momentos —presentación, teoría y prueba— y lo
prometido es lo que se explica y se pregunta. Ninguna lección sirve a dos
unidades.

## El glosario del profesor (`glossary.ts`)

Medio centenar de entradas de lo que de verdad pregunta un guitarrista —cadencias,
funciones, acordes, intervalos, escalas, los siete modos, tonalidades,
progresiones y ritmo— que se le dan al profesor cuando la pregunta casa con
alguna ([adr/0076](./adr/0076-el-profesor-se-apoya-en-un-glosario-comprobado.md)).

**Nada de lo que depende de la tonalidad está escrito.** Las cadencias se guardan
en grados y se resuelven con `resolveDegree`: la perfecta es V → I, que en Do mayor
sale G → C y en La menor E → Am, con el V mayor de la menor armónica. La armadura
sale de `keySignature`, la relativa del círculo, las sustituciones de
`substitutionOfDegree`, y los intervalos de cada acorde de `CHORD_SHAPES`.

**Las notas se escriben por letras, no por teclas.** El E7 de La menor es E G# B D,
no E Ab B D, y la menor armónica de D# lleva un C## porque cada grado ocupa su
letra. Lo escribe `spelling.ts`, y de ahí sale todo lo que se lee al aprender: las
lecciones, el oído, las unidades de tocar —cada nota de la escala que se toca, la
de blues incluida, con `spellScaleOf`— y el glosario, que cifra cada acorde con la
letra de su grado y la especie de `resolveDegree`. Así, en Fa# mayor la unidad, la
lección y el profesor dicen lo mismo: el vii° es `E#dim`, con sus notas E# G# B, y
lo prestado de Db mayor es `Fb`, `Bbb` y `Cb`. Dos excepciones decididas, cada una
con su porqué escrito donde vive: la nota de blues pasa a cuarta aumentada cuando
la quinta disminuida pediría doble bemol (`bluesNote`), y el sustituto tritonal se
cifra por la nota a un tritono de la dominante, con bemol —D7 y no Ebb7 en Db—. Y
el validador lee esos cifrados por su altura, así que `E#dim` y `Fdim` le valen
igual.

Lo que **no** escribe por letras es componer: `noteName` tiene doce nombres por
alteración y `resolveDegree` cifra con ellos, así que en el lienzo el vii° de Fa#
mayor sigue saliendo `Fdim`. Suena igual, y cambiarlo es otro tema.

Tres cosas que el resto del dominio no tenía y aquí se calculan: **el lidio y el
locrio**, como la mayor empezando en su cuarto y su séptimo grado —los otros modos
ya estaban en `scales.ts` y de allí sale lo que se dice de ellos—, **la menor
melódica**, como la natural con la sexta y la séptima subidas, y **los nombres de
los intervalos**.

Y sirve también para comprobar: las cadencias y la relativa llevan una firma que se
puede leer en un texto, y una respuesta del profesor que las nombra sin escribir
sus acordes, o escribiendo los de otra, no llega a la pantalla.

## Cuándo una salida encaja (`encaje.ts`, `paths.ts`)

Que una salida sea **correcta** —no rompe ninguna regla— no es que **suene bien**.
El juez de encaje puntúa de 0 a 100 con once criterios: sintaxis (que los acordes
vayan a donde suelen ir), cadencia, frase, ritmo armónico, bajo, notas comunes,
melodía, estilo, novedad, papel de la parte y forma. Pesan más lo que oye
cualquiera —sintaxis, cadencia, frase— y menos lo que solo decide en algunos
casos, como la melodía. Los motivos que da son verdaderos y hablan en grados.

**Lo que dice una salida de sí misma es verdad en cada sitio que nombra**
(`lo-que-dice.ts`, [adr/0101](./adr/0101-lo-que-dice-una-salida-es-verdad-sitio-por-sitio.md)):
«X en el N», un enlace, un papel o una forma se comprueban contra lo que hay en
ese sitio, para el juez, para el generador y para lo que escribe el modelo. El
quinto examen arregló además tres causas del juez: **el papel manda sobre el vamp**
(un pre, un puente o un final no se juzgan como el vamp que los rodea); el
consecuente de un periodo se llama «Consecuente» y la B de una AABA, «Puente»
(`papelNuevo`), y así los juzga; y los motivos del blues se construyen con lo que
suena en el 9 y en el 10, no con el esquema.

- **La frase es de cuatro, de ocho, de doce**: una continuación a siete compases
  se nota aunque no se sepa contar. En un vals se cuentan tres pulsos.
- **Lo que llega a la tónica y se prepara.** Una dominante que vuelve atrás o un
  final que no llega a ningún sitio son lo primero que se castiga. Las dominantes
  secundarias llevan séptima, y `V/V → I` no se propone.
- **El estilo manda en los préstamos.** El bVII es de casa en el rock y una
  licencia en el jazz; los préstamos se premian o se castigan según el estilo de la
  barra. El blues se juzga por su forma de doce compases, y **el modal no usa la
  sensible**: en dórico o mixolidio el V mayor lo estropea.
- **Una especie heredada.** Si el compás era una séptima o una quinta, la
  sustituta no la pierde en silencio; y en un idioma de dominantes séptimas
  —blues— los acordes nuevos las traen.
- **Trece movimientos de rearmonización**: relativo, tritono (con séptima y antes de
  su objetivo), préstamo (del paralelo), cadencia rota (en el sitio de la I),
  intercambio, `dominante` —«Su dominante delante»—, `funcion` —«Misma función»—,
  `modal` —«Sin sensible» o «Con sensible»: V↔bVII, y V↔VII en menor; en quintas se
  nombra «bVII en lugar de V»—, y cuatro que dependen del sitio:
  - `predominante`: el compás de tónica, o la dominante repetida, que hay delante
    del V pasa a ser una subdominante —ii o IV; en menor, ii° o iv—, salvo si ya
    llega preparado (por una subdominante o bajando medio tono, como el VI de la
    andaluza).
  - `cambio-rapido`: el IV en el compás 2 de un blues de doce, que vuelve a la I en
    el 3, y al revés. Es lo único que se toca del esquema; doblar o partir el coro
    entero ya no es ese blues y no se ofrece.
  - `frigio` —«Semitono frigio»—: el compás pasa a ser el acorde mayor medio tono
    por encima de un centro (la tónica o la dominante): bII→i, VI→V. Sin séptima: con
    ella es el sustituto tritonal.
  - `ii-v` —«Partir la dominante»— (`partir.ts`): un V, o una secundaria, de cuatro
    pulsos o más se parte en su ii y él, a medias. Es el único que cambia **cuántos**
    acordes hay, y por eso se comprueba, se nombra y se aplica emparejando por
    pulsos (`gruposPorPulsos`).
  - `vaiven` —«Giro del vamp»—: **solo sobre un vamp de tónica de funk**
    (`Entorno.vampDeTonica`). En mayor, I→bVII7 o IV7 y IV→bVII7; en menor,
    i→VII7, v7 o iv7 y iv→VII7. Un I que va al IV se queda, que ya es su dominante.
    Sin él, retocar un vamp daba el V7–I7 de una cadencia clásica.
- **Las formas** (`formas.ts`, la misma regla para quien construye y para el juez):
  un periodo —antecedente abierto, consecuente que cierra con su misma cabeza— y la
  AABA, de cuatro o de ocho compases por sección. Lo que falta se completa: el
  consecuente, la sección que contrasta tras dos que empiezan igual, y la vuelta a
  la primera tras ella. **Una andaluza reposa en su V** (`centroFrigio`): sin estilo,
  si lo tuyo es la bajada entera; en un flamenco, siempre que se llega por el VI o
  desde el iv. Ahí `seguir` puede acabar sin resolver a la i.

**Doce estilos**, agrupados en el selector por lo que se toca: «De riff» (rock,
metal, blues, funk), «De canción» (pop, folk, country, reggae) y «De armonía» (jazz,
bolero, flamenco, cine). Cada uno trae sus giros al juez y al generador, para que un
funk no se juzgue como un blues ni una andaluza como nada
([adr/0098](./adr/0098-seis-estilos-mas-para-que-no-se-juzguen-como-otro.md),
[adr/0099](./adr/0099-formas-y-movimientos-nuevos.md)).

**Lo que todavía falla:** lo que no es canónico en su estilo se juzga con menos
seguridad, y los corpus que lo medían se han usado para ajustar
([adr/0097](./adr/0097-las-salidas-se-juzgan-por-lo-que-encajan.md)).

## Lo que este dominio todavía no hace

- Tensiones por encima de la séptima: novenas, oncenas, trecenas.
- **Las dominantes secundarias, a medias.** Están las que se distinguen por la
  especie de su tríada, que son las que más se usan: en mayor `V/ii`, `V/iii`,
  `V/V` y `V/vi`; en menor `V/iv` y `V/V` —el `E7` de Re menor, que es lo que
  destapó que faltaban—. **No están las que chocan con un grado mayor que ya
  existe**: la del IV en mayor es un I con séptima, y la del VI en menor es el
  III con séptima, y el grado se calcula de la tríada a propósito para que un
  `Cmaj7` y un `C` sean el mismo. Esas dos piden que el grado sepa mirar la
  séptima, que es otra cosa.
- Acordes de paso y modulación explícita.
- **Del tiempo musical sabe la mitad.** Sabe pulsos, compases y velocidad:
  `tempo.ts` acota el pulso por minuto y los pulsos por compás —de uno a seis—,
  `melody.ts` guarda cada nota en pulsos sobre una rejilla de un cuarto de pulso
  —la semicorchea— y limita su duración a las siete figuras que tienen dibujo, `arrangement.ts` cuenta
  compases y `capture.ts` convierte en compases lo que tocas. Lo que **no** tiene:
  silencios, ligaduras, grupos irregulares, dos voces y anacrusa. Por eso una nota
  que dura más de lo que le queda al compás se escribe donde empieza y cruza la
  barra, en vez de partirse con una ligadura.
- **Intervalos: se enseñan y se oyen, pero el resto del dominio no los usa.** Hay
  unidad de teoría, dictado de oído (`interval`) y `spelling.ts` sabe nombrarlos,
  pero ni `suggestions.ts` ni la detección razonan con ellos: siguen pensando en
  grados y en acordes.
