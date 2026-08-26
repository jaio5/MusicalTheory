# ADR 0011 — Las versiones de una canción se verifican contra el dominio, y no sube audio

Fecha: 2026-08-25 · Estado: aceptada · Se apoya en: [ADR 0004](./0004-reconocimiento-de-acordes-por-croma.md), [ADR 0008](./0008-los-cupos-salen-del-precio.md)

> **Enmendada por [ADR 0016](./0016-salidas-en-vez-de-versiones.md).** La regla de
> «cambia el número de compases o su orden: eso ya no es una versión de esa
> canción» queda derogada: lo que se pide ya no son versiones sino salidas, y una
> puede alargar o acortar. Lo demás de este ADR sigue en pie, y `rearmonizar` es
> ahora una salida más que lo cumple entero.

## Contexto

La idea original era: grabas un trozo tocando y la IA te propone varias versiones de
tu canción a partir de la tonalidad y los acordes que estás usando. Es la parte más
ambiciosa de la aplicación y la que más se puede equivocar, por dos motivos
distintos.

El primero es **qué se manda**. «Grabar un trozo» suena a subir audio, y esta
aplicación lleva catorce fases sin una sola línea de código de subida: la regla 4 de
la arquitectura dice que el audio y el vídeo no salen del dispositivo, y hay dos ADR
que se apoyan en ella.

El segundo es **qué se hace con lo que vuelve**. Un modelo devuelve acordes
razonables casi siempre. Lo que no devuelve de forma fiable es una explicación cierta
de por qué son esos: puede decir «sustitución tritonal» sobre un cambio que no lo es,
y la frase suena igual de bien. Y el porqué **es la mitad del producto**: sin él, una
versión son cuatro acordes distintos que cualquiera puede probar a mano.

## Decisión

**A la IA solo viajan símbolos, también al grabar.** La aplicación ya sabe qué acorde
suena —el motor de croma lo dice veinte veces por segundo—, así que
[`core/music/capture.ts`](../../src/core/music/capture.ts) convierte lo que se toca en
grados con sus pulsos, usando el tempo del metrónomo. Grabar es apuntar símbolos y
milisegundos. Lo que sale del equipo son entre treinta y doscientos caracteres.

**El razonamiento se verifica, no solo el resultado.**
[`core/music/reharmonization.ts`](../../src/core/music/reharmonization.ts) declara un
catálogo cerrado de cinco movimientos que el código sabe **nombrar y comprobar**:
relativo, intercambio de especie, préstamo modal, cadencia interrumpida y sustitución
tritonal. Cada compás que una versión cambia declara cuál se le ha aplicado, y el
validador vuelve a aplicarlo al grado que había para ver si sale el que propone. Si
no coincide, la versión se cae entera.

Ninguno de los cinco es una tabla escrita a mano: cada uno le pregunta al catálogo de
grados cuántos semitonos y qué especie es un grado, lo transforma y busca qué ha
salido. Así un grado nuevo entra solo en los cinco movimientos, y **no puede pasar
que la tabla diga una cosa y el catálogo otra**. Por el mismo motivo, la lista de
movimientos que se le ofrece al modelo en el prompt se genera desde `MOVES` en vez de
escribirse a mano: un movimiento ofrecido que el validador no supiera comprobar haría
caer todas las versiones que lo usaran, y nadie entendería por qué.

Es la misma regla que ya seguían las ideas —los cifrados no se creen, se recalculan
desde los grados— llevada del cifrado al porqué.

**Una versión es una rearmonización**: los mismos compases, en el mismo orden y con
las mismas duraciones. Cambiar la forma se rechaza, y no cambiar nada también.

## Consecuencias

- Cuesta céntimos en vez de euros, y no hace falta almacenamiento ni política de
  privacidad nueva. La regla 4 sigue en pie sin excepciones.
- El porqué que se enseña al lado de cada acorde **está comprobado**, así que se
  puede poner en pantalla sin matizarlo.
- Es la petición más cara de las tres, así que entra en el plan Pro y **le baja el
  cupo de 363 a 271 al mes** con el modelo por defecto: el cupo es el presupuesto
  entre la petición más cara, y desde ahora la más cara es esta. Bajarlo no es un
  efecto secundario, es el cálculo funcionando ([ADR 0008](./0008-los-cupos-salen-del-precio.md)).
- Hizo falta añadir **bII al catálogo de grados de tonalidad mayor**. Sin él, la
  sustitución tritonal solo existía en menor, que es media función.
- Al añadirlo salió un fallo de escritura que ya estaba: en Do mayor, `bIII` se
  escribía «D#» y `bVII` «A#». Un grado que se llama «b» algo se escribe con bemol,
  valga lo que valga la tonalidad. Había un test que fijaba el comportamiento
  equivocado.

## Lo que no capta, y está asumido

No hay ritmo dentro del compás, no hay melodía, y las inversiones se leen como el
acorde en estado fundamental porque el croma olvida la octava
([ADR 0004](./0004-reconocimiento-de-acordes-por-croma.md)). Lo que sale es la armonía
y su reparto en el tiempo. Para rearmonizar es justo lo que hace falta; para
«proponme un arreglo» no bastaría.

Tampoco se puede **oír** una versión sin ponerla en el camino y tocarla. Comparar
tres versiones leyéndolas cuesta, y es la primera cosa que hay que mirar después.

## Alternativas descartadas

**Subir el fragmento de audio a un modelo que oiga.** Captaría el ritmo, la melodía y
las inversiones, que es todo lo que se pierde arriba. Se descarta porque rompe la
promesa que sostiene la aplicación entera, obliga a almacenamiento y a política de
privacidad nueva, y multiplica el coste por petición lo bastante como para tener que
rehacer el modelo de coste de cero. Si algún día se hace, será con su propio ADR y no
como una ampliación de este.

**Creerse lo que devuelve el modelo.** Es lo que hace casi todo el mundo, y aquí se
descarta por lo mismo que se descartó con los cifrados: un porqué falso es peor que
no dar ninguno, porque el que aprende no tiene forma de saber cuál era falso. El
coste de esta decisión es real —una tanda puede quedarse sin versiones válidas y hay
que pedirla otra vez—, y por eso el mensaje de ese caso dice lo que ha pasado en vez
de «no ha venido bien formada».

**Dejar que la versión cambie la forma de la canción** —quitar compases, alargar,
proponer una estructura de estrofa y estribillo—. Sería más ambicioso y más vendible.
Se descarta porque el dominio no puede verificar casi nada de eso, y volveríamos a
fiarnos del modelo, que es lo que este proyecto evita. Con la forma fija, cada compás
propuesto se compara con el que había y la comprobación es exacta.

**Un solo movimiento por versión**, en vez de varios compases cambiados. Más fácil de
explicar y de verificar. Se descarta porque una versión que cambia un solo acorde de
ocho no se nota al tocarla, y la gracia está en oír la canción distinta.
