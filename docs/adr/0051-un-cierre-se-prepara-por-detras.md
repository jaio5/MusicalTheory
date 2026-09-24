# ADR 0051 — Un cierre se prepara por detrás, no se alarga por delante

Fecha: 2026-09-24 · Estado: aceptada · Respeta la línea de [ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md)

## Contexto

En tonalidad de Mi, el cierre que proponía la aplicación repetía la tónica. Y
resultó ser **dos fallos con la misma cara**, uno en cada sitio de donde puede
salir un cierre:

| Quién lo escribe                             | Qué devolvía | En Mi        |
| -------------------------------------------- | ------------ | ------------ |
| El dominio (`fake-model.ts`), sin proveedor  | `I IV I`     | Mi · La · Mi |
| El modelo (`qwen3:8b`), con Ollama conectado | `I I`        | Mi · Mi      |

El primero salía casi siempre —con la parte acabando en V, en IV o en vi, que es
como acaba casi todo—. El segundo, medido pidiendo salidas de verdad a `/api/versiones`
con `I vi IV V` en Mi mayor.

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
y es la última. No es «que no se repita un acorde» —sostener un acorde dentro de
una parte es legítimo—: es que la tónica **es** el final.

### Y lo del modelo: una parte de un solo grado no es una parte

Eso arregla al dominio, no al modelo. Para el modelo van dos cosas.

**El validador rechaza una parte añadida de dos o más compases cuyo grado sea
siempre el mismo**, en `seguir` y en `contraste`.

Hay que decir qué se pierde con eso, porque se pierde algo. Un cierre tiene que
medir **dos compases**: lo exige `MIN_BARS_PER_SECTION` en `songProblem`, y con
razón —un puente de un compás no es un puente—. Pero eso significa que, cuando la
única respuesta honesta es «resuelve», hay que rellenar; y la única manera de
rellenar una resolución pura es repetir la tónica. Ni con pulsos se salva: `i(8)`
es un compás y cae por el mínimo igual.

Así que lo que se va es **proponer un cierre que sea solo la tónica**. Y se va a
propósito: eso es lo único que nadie necesita que se lo diga una IA. Sostener la
tónica **dentro** de una cadencia sigue valiendo —`VI i(8)` entra—; lo que no entra
es un cierre que no va a ningún sitio.

**Y el catálogo que lee el modelo lo dice**: `seguir` pide «una cadencia que llegue
a la tónica. Llegar a ella, no quedarse en ella». El prompt añade que un acorde
que dura más de un compás va en un compás con más pulsos.

**De paso, una trampa que costó un arreglo del revés**: el mínimo de compases de
una parte **no está en `pathProblem`**, que es el que mira compases y saltos, sino
en `songProblem`, que mira partes. Comprobando la primera parece que un cierre de
un compás vale, y no vale. Dos validadores en dos niveles, y el de las partes es
el que manda.

## Consecuencias

El cierre que se propone es una cadencia, auténtica cuando el grafo la deja y
plagal cuando no. Desde un V sale `IV I`, que es un retroceso antes de la plagal:
no es lo más elegante, pero es lo mejor que ofrece el grafo desde ahí y no
repite nada.

Lo que **no** cambia: esto es el modelo que no piensa. Que las salidas de un modelo
de verdad valgan la pena sigue sin poderlo decir nada que no sea el modelo. Lo que
antes tampoco se podía decir —y ahora sí— es si las del dominio tienen sentido.

## Alternativas descartadas

**Meter en el validador la regla de «la tónica solo al final»**, para que ninguna
respuesta pueda traerla antes. Se descarta con un contraejemplo: `V I vi IV V I` es
una frase entera perfectamente buena que pasa por la tónica y acaba en ella, y esa
regla la tiraría.

Nótese que **no es la regla que sí entró**. «La parte añadida no puede ser un solo
grado» no toca ese contraejemplo: la frase larga se mueve. La primera decidiría por
gusto dónde puede estar un acorde; la segunda solo dice que una parte tenga dentro
más de un acorde, que es lo que la hace una parte. La línea de [ADR
0011](./0011-versiones-verificadas-contra-el-dominio.md) —el modelo propone, el
dominio verifica— se respeta con la segunda y se movería con la primera.

**Parar en el primer compás cuando ya se llega a la tónica**, aceptando un cierre
de uno. Se descarta porque el validador lo tira, y con razón: una parte con un
compás no es una parte. El mínimo no era el problema; el problema era cómo se
cumplía.

**Elegir el primer camino que el grafo ofrezca**, sin mirar qué grado prepara la
tónica. Es lo que hacía —el `?? nextDegrees(...)[0]` de la vieja versión— y es de
donde salía el `IV` de en medio: el grafo lo ofrece primero, no porque prepare
nada. Con el orden por función armónica, acabando en IV o en vi sale `V I`, que es
la cadencia que cualquiera escribiría.
