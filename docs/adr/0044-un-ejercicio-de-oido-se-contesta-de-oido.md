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

Un grado a secas sigue sonando como tríada, que es lo que hacen cinco de las siete
clases, y esas no se tocaron ni una línea. La unidad de cuatríadas ya suena la
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

**Y una clase nueva, `functions`, con su unidad en `profesional-1`.** Suena la
casa y luego otro acorde, y la pregunta no es cuál es sino qué hace: reposa, sale
o tensa. Los `why` salen de `HARMONIC_ROLES`, que es donde ya vive esa verdad.

El tercer ejercicio es el que enseña algo. Los dos primeros se pueden acertar por
la especie —el IV y el V son mayores—, y el sexto grado es **menor y reposa
igual**: es el único sitio donde «alegre o triste» deja de servir y hay que oír la
función. Va entre la teoría y el repaso, y no al final, porque llegar al repaso
sin haber oído nunca una función es repasar de memoria.

## Consecuencias

El temario pasa de 31 unidades a 32, y `profesional-1` deja de ser el único curso
con dos lecciones de teoría y nada que oír. Quedan cinco cursos a los que les
falta un tipo, y el peor sigue siendo `profesional-4` —Sustituciones, dos
unidades de teoría—: el sustituto tritonal es una cosa que solo se entiende
oyéndola. Está anotado en el [ROADMAP](../ROADMAP.md).

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

**Poner la clase `functions` al final del curso**, después del repaso. Se descarta
porque el repaso de `profesional-1` es la unidad que reparte los grados en los tres
papeles: hacerlo sin haber oído ninguno es memorizar una tabla.
