# ADR 0020 — Lo que se oyó, lo seguro que se estaba, y quién lo dijo

Fecha: 2026-09-07 · Estado: aceptada · Amplía: [ADR 0004](./0004-reconocimiento-de-acordes-por-croma.md), [ADR 0018](./0018-el-lienzo-de-montar.md)

## Contexto

Entre lo que suena y lo que quedaba apuntado había tres cortes, y en los tres se
perdía justo lo que hace falta para poder decir algo acertado sobre una canción:

**El motor se quedaba con un candidato.** `matchChords` devuelve una lista
ordenada con su puntuación y `bestChord` cogía el primero. Los demás —que al oír
una guitarra son casi siempre el mismo acorde con otra especie, o su relativo— se
tiraban.

**La captura tiraba la confianza.** El `score` viajaba hasta el estado de sesión y
allí se quedaba: `CapturedChord` era `{root, notes, at}`. Y el primer colapso, el
que une los fotogramas repetidos mientras la mano no se mueve, se quedaba con el
primero y descartaba el resto **con su duda dentro**.

**Lo que no se pudo leer era un número.** `dropped: 3` no dice dónde estaba, ni
qué sonó, ni por qué se cayó. Y tres acordes que no caben en la tonalidad son casi
siempre lo mismo: que la tonalidad detectada no es la que se estaba tocando.

El resultado: un bloque en el lienzo no sabía si el motor estaba seguro, ni qué
otra cosa pudo ser, ni si lo había puesto una persona o un micro. Todo valía
igual, y sobre eso no se puede construir una observación que valga.

## Decisión

**El motor emite lo que oye con su duda.** `readChord` devuelve el acorde, los
candidatos que compitieron y **el margen**: cuánto se despega el elegido del
segundo.

El margen, y no la puntuación, es lo que dice si había duda. Un 0,90 con el
segundo en 0,89 es un empate que se resolvió casi a cara o cruz; un 0,85 con el
segundo en 0,60 es una certeza. La puntuación sola no distingue esos dos casos, y
son exactamente los dos que hay que distinguir: **el primero se pregunta y el
segundo no**. Es un umbral de ambigüedad, no de calidad de sonido —de eso ya se
encarga `minScore`, que decide si hay acorde o no—.

**La duda sobrevive a los dos colapsos.** Al fundir fotogramas repetidos y al
fundir grados iguales seguidos se conserva **el peor margen**, no la media: si en
alguno de esos análisis el motor estuvo a punto de decir otra cosa, el acorde
entero es dudoso. Promediar escondería la duda justo donde hay que preguntar.

**Cada acorde del lienzo dice de dónde salió.** `heard`, `written` o `fixed`. No
es una etiqueta informativa: es lo que decide de qué se puede fiar quien lea esta
canción. Lo escrito a mano es la intención de quien compone y no se discute; lo
oído es una lectura de un micro en una habitación; lo corregido es lo oído que ya
pasó por delante de quien tocó, y vale tanto como lo escrito.

**Corregir es elegir entre lo que de verdad compitió.** Un bloque dudoso se marca
con el filo punteado y un interrogante, y al pulsarlo ofrece los candidatos que el
motor consideró —no los doce acordes de la tonalidad—. Al corregir, la lectura que
había pasa a ser la primera alternativa: sin eso, corregir sería un camino de ida.
Y **«estaba bien» también es corregir**: si el motor dudó y acertó, decírselo
tiene que dejar de preguntar.

**Lo que no se pudo leer se enseña con su sitio y su cifrado.** `Capture.unread`
dice cuándo sonó, cuánto duró, qué se oyó y por qué se cayó —`fuera` de la
tonalidad, o `ilegible`—. Al traer una grabación, eso se cuenta en una frase: _«Un
acorde no cabe en Do mayor: F#m. Si lo tocaste a propósito, prueba a cambiar la
tonalidad y a traerlo otra vez.»_ Es el diagnóstico que antes había que adivinar.

**Y todo eso se guarda.** `SongSection` gana `sources` —de dónde salió cada
grado— y `lead` —el punteo—. No hace falta migración: `data` es un `jsonb` sin
forma fija y quien decide qué hay dentro es `parseSong`, que ya descarta lo que no
reconoce. Los dos campos **se omiten cuando no dicen nada**, así que una canción
sin punteo y toda escrita a mano se guarda exactamente igual que antes de que
existieran.

**Grabar deja de pedir plan.** El único sitio desde el que se podía apuntar la
progresión era el panel de Salidas, que va con Pro, y eso dejaba «Traer lo
grabado» sin nada que traer para quien no paga. Apuntar acordes lo hace el croma
en el propio equipo: no cuesta IA ni gasta cupo. El muro es para pedirle salidas a
un modelo, no para escribir en tu canción lo que acabas de tocar.

## Consecuencias

Lo que llega a la IA deja de ser una lista plana de grados: puede decir de cuáles
fiarse. Una lección puede no corregir sobre un compás que nadie oyó bien. Y quien
abra su canción dentro de seis meses ve qué escribió y qué le escribió el micro.

La confianza en sí **no se guarda**, solo la procedencia. Un número de un análisis
de hace un mes no dice nada útil; lo que hace falta después es si aquello se oyó o
se escribió.

Sigue sin resolverse lo de [ADR 0004](./0004-reconocimiento-de-acordes-por-croma.md):
el croma no distingue inversiones, así que `C/E` y `C` son el mismo vector y ni el
margen ni las alternativas lo arreglan. Lo que sí cambia es que ahora un acorde
dudoso lo dice, en vez de afirmarlo con la misma seguridad que uno claro.

## Alternativas descartadas

**Usar la puntuación como medida de la duda**, que es lo que ya estaba calculado y
no costaba nada. Se descarta porque mide otra cosa: cuánto se parece el croma a
una plantilla, que depende del instrumento, de la sala y de la pastilla. Dos
acordes que empatan a 0,90 son mucho más peligrosos que uno solo a 0,80, y la
puntuación los ordena al revés.

**Guardar el croma crudo** para poder reinterpretarlo entero después. Sería lo más
preciso de todo: cambiar la tonalidad releería la grabación sin volver a tocar. Se
descarta por lo que es este proyecto: un croma por análisis, diez por segundo, son
mil doscientos vectores de doce números por minuto tocando, y hay una regla que
dice que a la base de datos van identificadores, números y fechas —no señal—. Lo
que resuelve el mismo problema por mucho menos es guardar los candidatos, que ya
son la parte del croma que significa algo.

**Preguntar por todos los acordes dudosos a la vez**, en una lista al traer la
grabación. Se descarta porque llena la columna de preguntas sobre compases que a
lo mejor ni importan: el lienzo ya los marca, y la corrección se abre al pulsar el
que molesta.

**Marcar la duda con un color.** Sería lo más visible. Se descarta porque los tres
colores de un bloque ya están diciendo qué papel armónico tiene el acorde, y un
cuarto encima haría que no se leyera ninguno de los dos. La duda se dice con el
filo punteado y un interrogante, que no compiten con nada.

**Guardar también la confianza de cada acorde.** Se descarta por lo que
significaría leerla después: un margen de 0,03 de un análisis de hace un mes no se
puede volver a comprobar ni sirve para decidir nada. Lo que hace falta es si
aquello se oyó, se escribió o se corrigió, y eso sí se guarda.
