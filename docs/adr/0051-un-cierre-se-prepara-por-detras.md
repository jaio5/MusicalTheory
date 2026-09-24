# ADR 0051 — Un cierre se prepara por detrás, no se alarga por delante

Fecha: 2026-09-24 · Estado: aceptada · Respeta la línea de [ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md)

## Contexto

En tonalidad de Mi, el cierre que proponía la aplicación era **«Mi · La · Mi»**: la
tónica dos veces y ninguna cadencia. En grados, `I IV I`, y salía casi siempre
—con la parte acabando en V, en IV o en vi, que es como acaba casi todo—.

La causa está en `fake-model.ts` y es de tres líneas. El cierre se construía
andando por el grafo armónico «hasta caer en la tónica», con un mínimo de dos
compases porque **una parte de un compás no es una parte** y el validador la
tiraba. Pero el mínimo se cumplía **siguiendo después de haber llegado**: desde un
V, el primer paso ya daba la tónica, el bucle no podía parar ahí, así que se iba
de casa —al primer grado que ofreciera el grafo— y volvía.

Lo que salía no era una cadencia mal elegida: era un cierre que **empieza** en la
tónica, y un cierre que empieza en casa no cierra nada.

Y sobrevivió porque **ningún test miraba dentro del cierre**. Los que había
comprobaban que la salida existiera y que llevara «Sin IA» escrito; el contenido,
nadie. El validador del dominio tampoco lo cazaba: a `seguir` le exige que **acabe**
en la tónica, y `I IV I` acaba en la tónica.

## Decisión

**Un cierre no se alarga hacia delante: se prepara por detrás.** Se busca el
camino **más corto** que acabe en la tónica **sin tocarla antes**, y entre los que
empatan de largo gana el que mejor la prepara: primero dominante, luego
subdominante, y las otras dos de rebote (`roleOfDegreeSymbol`).

Por anchura y no por profundidad, porque lo que se quiere es el más corto: dos
compases, que es lo que mide una cadencia.

Los 27 grados de los dos modos dan ahora un cierre de dos compases, y los 27 pasan
el validador. Una muestra:

| Tu parte acaba en | Cierre de antes | Cierre de ahora |
| ----------------- | --------------- | --------------- |
| `V`               | `I IV I`        | `IV I`          |
| `IV`              | `I IV I`        | `V I`           |
| `vi`              | `I IV I`        | `V I`           |
| `I`               | `IV I`          | `V I`           |

**Y la regla queda escrita como test, para los 27 grados**: la tónica sale una vez
y es la última. No es «que no se repita un acorde» —dos compases del mismo grado
son legítimos en otro sitio—: es que la tónica **es** el final.

## Consecuencias

El cierre que se propone es una cadencia, auténtica cuando el grafo la deja y
plagal cuando no. Desde un V sale `IV I`, que es un retroceso antes de la plagal:
no es lo más elegante, pero es lo mejor que ofrece el grafo desde ahí y no
repite nada.

Lo que **no** cambia: esto es el modelo que no piensa. Que las salidas de un modelo
de verdad valgan la pena sigue sin poderlo decir nada que no sea el modelo. Lo que
antes tampoco se podía decir —y ahora sí— es si las del dominio tienen sentido.

## Alternativas descartadas

**Meter la regla en el validador**, en `pathProblem`, para que ninguna respuesta
—ni la del dominio ni la del modelo— pueda traer la tónica antes del final. Se
descarta con un contraejemplo: `V I vi IV V I` es una frase entera perfectamente
buena que pasa por la tónica y acaba en ella, y esa regla la tiraría. El validador
comprueba **legalidad**, no gusto: que los saltos existan, que tus compases sigan
ahí y que se cierre en casa. Que lo propuesto tenga sentido es del que lo propone.
Es la línea que [ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md) trazó, y
aquí se respeta en vez de moverla.

**Parar en el primer compás cuando ya se llega a la tónica**, aceptando un cierre
de uno. Se descarta porque el validador lo tira, y con razón: una parte con un
compás no es una parte. El mínimo no era el problema; el problema era cómo se
cumplía.

**Elegir el primer camino que el grafo ofrezca**, sin mirar qué grado prepara la
tónica. Es lo que hacía —el `?? nextDegrees(...)[0]` de la vieja versión— y es de
donde salía el `IV` de en medio: el grafo lo ofrece primero, no porque prepare
nada. Con el orden por función armónica, acabando en IV o en vi sale `V I`, que es
la cadencia que cualquiera escribiría.
