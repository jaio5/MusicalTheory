# ADR 0032 — La progresión y el montaje son la misma cosa: el arreglo

Fecha: 2026-09-17 · Estado: aceptada · Revisa: la convivencia de los dos modelos de [ADR 0018](./0018-el-lienzo-de-montar.md)

## Contexto

Hoy hay **dos cosas distintas que dicen ser tu canción**, y no se hablan.

La primera es `path`, en `state/session-store.ts`: una lista de `PathChord` con
su cifrado, su grado y sus notas. Es lo que se llena pulsando acordes en la cara
de `Tocar`. **No tiene duraciones, ni partes, ni repeticiones, ni deshacer.** Un
acorde pulsado por error se arregla cortando por ahí y volviendo a pulsar el
resto.

La segunda es `arrangement`, en `core/music/arrangement.ts` con su almacén y su
deshacer: bloques con pulsos, partes con nombre y papel, punteo y partitura. Es
lo que se llena en `Montar`.

Las dos existen porque llegaron en momentos distintos, y la costura se nota en
todas partes:

- Lo que se toca en `Tocar` **no aparece** en `Montar`, y al revés.
- `features/versions` pide salidas a partir de `path` si no hay grabación, así que
  la IA opina sobre la cadena y no sobre la canción.
- `features/songs` guarda el montaje si hay partes y la cadena si no: dos formatos
  para lo mismo, decididos por un `if`.
- El deshacer solo protege una de las dos. La que más se toca al empezar —la
  cadena— es la que no tiene red.
- `FretboardPanel`, `HeardChord` y `ResumeLast` leen `path.at(-1)` para saber qué
  acorde miras. Eso es una **selección**, y está viviendo dentro de lo que debería
  ser la canción.

El arreglo es el modelo bueno: es el que tiene tiempo dentro, el que se prueba en
un milisegundo sin montar React y el que ya sabe resolverse contra cualquier
tonalidad ([ADR 0030](./0030-cambiar-de-modo-traduce-la-cancion.md)).

## Decisión

**Hay un solo objeto que editar, y es el arreglo.** `path` deja de ser tu canción
y pasa a ser lo que siempre fue de verdad: **el cursor de escritura**, o sea qué
acorde tienes seleccionado y dónde va a entrar el siguiente.

- Pulsar un acorde en «a dónde ir», buscarlo por su cifrado o tocarlo con el
  micro **escribe un bloque en el arreglo**, en la parte y en la posición donde
  está el cursor.
- La selección —qué bloque miras— es un identificador de bloque, no el último
  elemento de una lista. La columna derecha cambia con la selección, nunca con lo
  que suena.
- El deshacer, que ya cubre el arreglo, pasa a cubrir por tanto todo lo que se
  escribe. Sigue siendo de veinte pasos: es lo que cabe en un rato de montaje, y
  ese número está razonado donde vive.
- Las salidas, las canciones y las sesiones leen el arreglo. Se acaba el `if` de
  dos formatos.

**Lo que no cambia:** un bloque sigue siendo un grado con pulsos, el tono sigue
poniéndolo la rueda, y por eso cambiar de tonalidad sigue sin tocar un bloque.

**Lo que se añade al dominio** es lo único que le falta para que una canción de
rock quepa entera: **repeticiones por parte** (`|: :|` con vueltas). Dos partes
con vueltas bastan; no se hace un DAW.

## Alternativas descartadas

**Mantener los dos y sincronizarlos.** Un efecto que copie la cadena al arreglo y
al revés. Es lo que parece menos invasivo y es la peor opción: dos fuentes de
verdad con una copia en medio significa decidir quién gana en cada conflicto —¿y
si borras un bloque que en la cadena sigue?— y esa decisión hay que tomarla en
cada operación, para siempre. Es deuda que crece sola.

**Quedarse con la cadena y darle duraciones.** O sea, hacer que `path` crezca
hasta ser el arreglo. Significaría reimplementar en `state/` lo que ya está hecho
y probado en `core/music/arrangement.ts`, con la diferencia de que allí se prueba
sin navegador y aquí no. Y dejaría el punteo y la partitura —que cuelgan del
arreglo— fuera de lo que se escribe tocando.

**Dejar el arreglo como algo opcional a lo que se "pasa" cuando la idea cuaja.**
Es lo de hoy con otro nombre, y es lo que produce el salto: escribes en un sitio,
y para seguir en serio tienes que mudarte a otro. El momento en que una idea
"cuaja" no existe; se compone añadiendo y quitando desde el primer acorde.

## Por dónde va

**Hecho: la selección ya es un identificador de bloque.** Vive en
`state/arrangement-store.ts` y la traduce a acorde `state/acorde-elegido.ts`. La
columna del acorde enseña las formas del bloque que eliges —el rótulo cambia de
«Elegido» a «En la canción»— y las propuestas salen desde él, así que dejaron de
decir «Por dónde empezar» con media canción escrita delante. `path` sigue de
respaldo mientras quede algo que solo sepa llenarlo a él.

**Falta, y no por olvido: escribir desde «a dónde ir».** Un bloque guarda **un
grado** y esa lista propone **especies** —`Fmaj7`, `F5`, `Fsus2`—, que un grado
no sabe guardar. Para que pulsar ahí escriba en la canción hace falta antes que
un bloque lleve especie, que es un cambio del dominio con su propio ADR. Hasta
entonces, pulsar una propuesta **suelta el bloque elegido y sigue por el
camino**: es irse a probar, y escribir se hace en el lienzo, que es donde se
arrastra.

## Consecuencias

- **Es el cambio más ancho de los tres.** `path` lo leen siete sitios
  —`features/path`, `versions`, `songs`, `sessions`, `fretboard`, `HeardChord` y
  la propia pantalla—, así que va en su commit y se comprueba uno por uno.
- `capture.ts` y `partFromCapture` ya convierten lo que oye el micro en bloques
  con sus pulsos: escribir tocando deja de ser un camino aparte.
- Empezar una canción cuesta lo mismo que antes —pulsar un acorde— pero ahora lo
  que sale es algo que dura, se repite, se deshace y se guarda.
