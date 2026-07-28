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
A, C, D, E, G; el blues de A añade el D#.

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
- Los **prestados del menor** (bIII, bVI, bVII en tonalidad mayor) están en el
  mapa desde el principio, y el napolitano (bII) en menor por el color frigio.
- El **vii°** casi no se usa: aparece marcado con peso bajo y con la nota de
  que en rock se sustituye por V.

Además hay un catálogo de progresiones completas con nombre: el bucle de cuatro
acordes (I–V–vi–IV), el rock and roll (I–IV–V), el giro mixolidio (I–bVII–IV),
el blues de doce compases, el descenso menor (i–VII–VI–VII), la cadencia
andaluza (i–VII–VI–V) y la plagal menor (i–iv–i–v).

Cualquier grado se puede convertir en acorde concreto dentro de una tonalidad, y
al revés: dado un acorde sonando se puede saber qué grado es, incluidos los
prestados, para sugerir a dónde ir desde ahí.

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

Con el acorde leído se le puede preguntar si pega, y la respuesta tiene tres
grados:

- **Entra**: todas sus notas están en la tonalidad.
- **Cabe como color**: se sale, pero tiene un uso reconocido en el catálogo del
  estilo —un prestado, una dominante secundaria, un sustituto tritonal—.
- **Se va fuera**: se sale y no hay nada en el catálogo que lo justifique.

Que una nota se salga de la tonalidad no lo convierte en un error: la mitad de
lo que hace interesante a una progresión son notas de fuera. Lo que distingue un
color de un choque es si el acorde tiene un uso conocido.

## Formas de hacer un acorde

Las digitaciones no están copiadas de una tabla: se buscan. Para cada posición
del mástil se prueban las combinaciones de trastes que dan las notas del acorde
y se descartan las que no se pueden tocar. Las reglas:

- Tienen que estar **todas** las notas del acorde.
- La cuerda más grave que suena lleva la **fundamental**. Las inversiones son
  música válida, pero no es lo que se busca al aprender un acorde.
- La mano abarca **cuatro trastes**, contando solo lo que se pisa.
- Una cuerda muda en medio de dos que suenan resta: se puede, pero cuesta.

De las que sobreviven se ordenan por lo cómodas que son, y manda la posición: un
acorde en primera posición con cuerdas al aire es el que se aprende y el que se
usa, aunque más arriba haya diez formas más. Se devuelve **una por posición**,
porque si no las cuatro mejores son la misma forma con cuerdas quitadas.

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

## Lo que este dominio todavía no hace

- Tensiones por encima de la séptima: novenas, oncenas, trecenas.
- Acordes de paso, dominantes secundarias y modulación explícita.
- Ritmo y compás: por ahora nada del dominio conoce el tiempo musical.
