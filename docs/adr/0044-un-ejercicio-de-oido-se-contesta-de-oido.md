# ADR 0044 — Un ejercicio de oído se contesta de oído

Fecha: 2026-09-23 · Estado: aceptada · Corrige: [ADR 0022](./0022-aprender-de-oido.md)

## Contexto

Revisando el temario apareció una unidad que no se puede hacer: `p2-oido`, «Qué
añade la séptima».

Sus tres ejercicios se escribieron así:

```ts
degrees: [uno, uno],
prompt: 'El mismo acorde, y luego con una nota más. ¿Cómo suena la de más?',
```

Y `EarExercise.degrees` era una lista de `DegreeSymbol`, que la pantalla convertía
en sonido con `resolveDegree`. Esa función acaba en `notes: triadNotes(...)`:
**tres notas, siempre**. Así que la unidad sonaba dos veces la misma tríada y
preguntaba por una nota que no llegaba a oírse nunca. Se acertaba razonando el
enunciado —«la séptima mayor suena suave, lo dice el libro»—, que es exactamente
lo contrario de lo que esta unidad entrena.

Es el mismo fallo que [ADR 0022](./0022-aprender-de-oido.md) nació para arreglar.
Allí se cuenta que `e2-repaso` se llamaba «Distinguirlas de oído» y se contestaba
leyendo, y que prometía una cosa y hacía otra. La unidad de cuatríadas hacía eso
mismo, y llevaba desde entonces.

**Nadie lo cazó porque no había con qué.** Los tests recorrían las seis clases
comprobando que los grados existen en el modo, que no hay azar y que cada clase
tiene nombre; ninguno preguntaba si lo que suena es lo que se pregunta. Y la
pantalla no podía fallar: pintaba lo que le daban.

De paso, el mismo sitio tenía un segundo error, este visible: el cifrado de la
cuatríada se escribía pegándole el sufijo al de la tríada.

```ts
why: `Es la séptima mayor: ${cifrado(tonic, mode, uno)}maj7.`;
```

En Do mayor sale `Cmaj7` y cuela. En las **doce tonalidades menores** sale
`Ammaj7`.

Y al mirar el reparto entero apareció un hueco de temario: de diez cursos, seis
no tienen alguno de los tres tipos de unidad, y `profesional-1` —Funciones
armónicas— era **dos lecciones de teoría y nada que oír**. La función armónica es
de lo que menos sentido tiene estudiar leyendo: un grado no «es» tenso, tensa
respecto a una tónica.

## Decisión

**Un paso de un ejercicio puede llevar especie, y la especie la escribe quien
escribe la pregunta.**

```ts
export type EarStep = DegreeSymbol | EarChord;
export interface EarChord {
  readonly degree: DegreeSymbol;
  readonly especie: SeventhQuality;
}
```

Un grado a secas sigue sonando como tríada, que es lo que hace casi todo el
catálogo, y esas clases no se tocaron ni una línea. La unidad de cuatríadas ya suena la
tríada y **la misma con la nota de más**.

**Quién convierte un paso en sonido vive en el dominio, no en la pantalla.**
`sonidoDe(step, tonic, mode)` devuelve las notas y el cifrado. Está ahí porque la
pantalla ya se equivocó escribiendo un cifrado a mano, y porque el cifrado que se
enseña y las notas que suenan tienen que salir del mismo sitio o vuelven a
separarse.

**La especie va escrita en el ejercicio y no deducida de la tonalidad.** En menor
la dominante no es el quinto grado de la escala natural —ese es menor y no tiene
tritono— sino la del menor armónico, que es mayor. Una regla automática que mire
la escala se equivocaría en las doce tonalidades menores, que es el error que este
proyecto ya cometió una vez y está contado en `lessons.ts`.

**Y tres clases nuevas**, que es lo que esa máquina hace posible:

- **`functions`**, en `profesional-1`. Suena la casa y luego otro acorde, y la
  pregunta no es cuál es sino qué hace: reposa, sale o tensa. Los `why` salen de
  `HARMONIC_ROLES`, que es donde ya vive esa verdad.
- **`substitutions`**, en `profesional-4`, que era el curso más flojo del temario
  —dos lecciones de teoría y nada más—. Separa las dos maneras de sustituir
  porque se oyen distinto: por notas compartidas, el relativo hace el mismo
  reposo y el final llega sin cerrar; por tritono, dos dominantes separadas por un
  tritono aprietan igual. **Esta segunda es la que necesitaba la máquina nueva**:
  la tríada de `bII` no tiene tritono, así que con grados a secas la pregunta no
  se podía ni plantear.
- **`circle`**, en `elemental-3`. La rueda se estudiaba solo mirándola, y lo que
  dice se oye: la relativa son las mismas notas con otro centro, y a la vecina
  solo se llega trayendo una nota que aquí no está. Por eso la vecina se presenta
  con su dominante secundaria y no con el quinto grado —el V de esta tonalidad es
  de casa y no trae nada nuevo—.

En las tres, **el último ejercicio es el que enseña algo** y los primeros están
para dar el suelo. En `functions` se ve mejor que en ninguna: los dos primeros se
pueden acertar por la especie —el IV y el V son mayores— y el sexto grado es
**menor y reposa igual**, que es el único sitio donde «alegre o triste» deja de
servir. Esa unidad va además entre la teoría y el repaso, y no al final, porque el
repaso de ese curso es el que reparte los grados en los tres papeles: hacerlo sin
haber oído ninguno es memorizar una tabla.

## Consecuencias

El temario pasa de **31 unidades a 34**, y el oído de seis clases a nueve. De los
diez cursos, los que estaban cojos bajan de seis a tres, y **los tres que quedan
lo están por el mismo motivo: les falta una unidad de tocar que hoy no se puede
escribir.**

- `profesional-2` (Cuatríadas) y `profesional-4` (Sustituciones) pedirían **tocar
  acordes**, y una unidad de tocar valida una escala con el motor de tono, que es
  monofónico. Validar acordes es el motor de croma, y hoy ese motor falla con una
  guitarra de verdad: está medido y anotado
  ([adr/0043](./0043-dos-maneras-de-equivocarse.md)). Escribir la unidad antes de
  arreglar el motor es mandar a alguien a suspender por algo que no es suyo.
- `elemental-4` (Qué escala tocar) pediría una unidad de oído sobre escalas, y un
  ejercicio de oído aquí es **una progresión de acordes**: no sabe hacer sonar una
  melodía. Esa es otra máquina, no una unidad más.

Las tres están en el [ROADMAP](../ROADMAP.md) con ese porqué, que es distinto de
«falta por escribir».

Añadir una unidad **no rompe el avance de nadie**: el progreso se guarda por
identificador de unidad y `UNIT_ORDER` se deriva del temario. A quien ya hubiera
pasado por `profesional-1` le aparece una unidad nueva abierta, que es lo que se
quiere.

Los tests que faltaban ya están: que un paso con séptima suene con cuatro notas y
las tres de la tríada dentro, que **ningún ejercicio de séptimas suene dos veces
lo mismo seguidas** —la regla que habría cazado esto el primer día— y que ningún
`why` de tonalidad menor contenga `mm`.

Lo que esto **no** arregla: sigue sin haber nada de ritmo, de lectura de
pentagrama, de intervalos ni de acordes en el mástil, y las diez unidades de tocar
siguen siendo escalas. Eso es temario nuevo, no un arreglo, y va aparte.

## Alternativas descartadas

**Reescribir el enunciado para que case con lo que sonaba.** Es la más barata:
cambiar «el mismo acorde, y luego con una nota más» por algo que se pueda
contestar oyendo dos tríadas iguales. Se descarta porque no hay tal pregunta: dos
sonidos idénticos no distinguen nada, y la unidad se llama «Qué añade la séptima».
Habría que borrarla, y la séptima es la mitad de lo que el Grado Profesional
enseña.

**Deducir la séptima de la tonalidad**, con `diatonicSevenths`, sin escribir nada
en el ejercicio. Es menos código y más automático. Se descarta por el menor: la
dominante que se usa en menor no sale de la escala natural, así que la regla daría
un `m7` sin tritono justo donde la pregunta va sobre el tritono. El proyecto ya
tiene escrito, en `lessons.ts`, que cuatro lecciones dieron por hecho lo contrario
y mintieron en las doce tonalidades menores.

**Un campo aparte, `readonly conSeptima?: readonly boolean[]`**, en paralelo a
`degrees`. Se descarta por lo que son dos listas paralelas: nada impide que tengan
largos distintos, y el día que alguien inserte un acorde en medio las desalinea
sin que ningún test lo note. La especie pegada a su acorde no se puede
desalinear.

**Una clase de oído para intervalos**, que es lo que pide cualquier método. Se
descarta por lo que ya decidió `ear.ts` por escrito: aquí se pregunta por acordes,
grados y cadencias, porque no se compone con notas sueltas. Meter intervalos es
cambiar esa decisión, y eso pide su propio ADR y su propia máquina —los ejercicios
son progresiones de acordes, no pares de notas—.

**Escribir ya las unidades de tocar que faltan**, para no dejar ningún curso cojo.
Se descarta porque validar que alguien toca un `Cmaj7` es el motor de croma, y hoy
ese motor falla con una guitarra de verdad —medido tocando, y anotado en
[ADR 0043](./0043-dos-maneras-de-equivocarse.md)—. Una unidad que suspende por un
fallo del motor es peor que no tenerla: enseña a desconfiar de la aplicación.
