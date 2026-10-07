# ADR 0042 — La especie dice lo que el grado no sabe

> **Ampliado por [ADR 0090](./0090-los-cifrados-salen-de-una-tabla-por-especie.md):** la especie de lo que no es séptima vuelve como su tríada, no como `CmMaj7`.

Fecha: 2026-09-23 · Estado: aceptada · Amplía: [ADR 0035](./0035-un-bloque-sabe-que-no-lleva-tercera.md)

## Contexto

El buscador de acordes de componer ofrecía **acordes apagados**. Medido en Do
mayor, con el buscador escribiendo cada fundamental: `Cm`, `Ebm`, `Abm`, `Bbm`,
los seis de `F#`, `Csus4`, `Dsus2`, `A7sus4`, `Cdim`, `Cdim7` y `Caug`.

El motivo es de modelo y está bien razonado: **un bloque guarda un grado**, el
grado sale de la tríada, y el catálogo de grados es un vocabulario escogido —
dieciséis símbolos en mayor y once en menor, cada uno con su frase de por qué
existe—. Un `Cm` en Do mayor no cae en ninguno: el catálogo no guarda un menor
sobre el primer grado.

Pero apagado sin remedio es una pared. Quien lee una partitura y teclea `Csus4`
no está pidiendo nada raro.

## Decisión

**Cuando la calidad no encuentra grado, lo pone la fundamental, y la especie
dice lo que es.**

Es exactamente el trato que el [ADR 0035](./0035-un-bloque-sabe-que-no-lleva-tercera.md)
le dio a la quinta: un `C5` tiene grado —el de su fundamental— y no tiene tríada.
Aquí se amplía a las demás formas que no se localizan por calidad.

La especie de un bloque pasa de ser «una séptima o `quinta`» a incluir seis
**formas simples**: `quinta`, `sus2`, `sus4`, `dim`, `aug` y `menor`. Cada una
sabe sus notas y su cifrado, y las dos cosas salen de la misma tabla, así que no
hay dos sitios que puedan decir cosas distintas.

El orden importa y es el único detalle delicado: **primero se busca el grado por
la tríada**. Un `Am` en Do mayor es el `vi` a secas, sin especie que lo adorne;
preguntando antes por la especie, todos los menores entrarían como «el grado de
su fundamental con especie menor», que es verdad y es inútil.

Y una suspendida lo es **tenga las notas que tenga encima**. Un `A7sus4` son
cuatro notas y no encaja exacto con ninguna forma de tres; lo que la hace
suspendida es que no tiene tercera y que en su lugar hay una segunda o una
cuarta. La séptima se pierde al guardarlo, y se ve antes de pulsar porque el
botón enseña el cifrado que va a quedar y no el que se tecleó.

## Lo que se gana, medido

Buscando en Do mayor, lo que estaba apagado y ahora entra:

| Se escribe                | Entra como       |
| ------------------------- | ---------------- |
| `Csus4`, `Dsus2`          | `Csus4`, `Dsus2` |
| `A7sus4`                  | `Asus4`          |
| `Cdim`, `Caug`            | `Cdim`, `Caug`   |
| `Cdim7`                   | `Cdim7`          |
| `Cm`, `Ebm`, `Abm`, `Bbm` | ellos mismos     |

## Lo que sigue sin entrar, y por qué no lo arregla una especie

**Una fundamental que no es ningún grado**: un `F#` en Do mayor, con sus seis
especies. El catálogo tiene once de las doce fundamentales —falta el tritono— y
eso no es una especie que falte: es un grado que no existe.

Y **las sextas y las novenas** —`Cm6`, `Cm9`—, que no son ni tríada, ni séptima,
ni ninguna de las seis formas simples. Se dicen en pantalla, sin concordancia de
número, porque salen siempre en pareja y la rama del singular no se alcanzaba.

## Alternativas descartadas

**Ampliar el catálogo de grados hasta cubrir las doce fundamentales por todas
las calidades.** Es lo que haría entrar absolutamente todo, y cuesta unos diez
grados nuevos en mayor y trece en menor, cada uno con su frase inventada. Dos
cosas lo desaconsejan: el catálogo es el vocabulario con el que la aplicación
**enseña** —«El napolitano», «El cuarto menor, prestado»— y llenarlo de `#iv°`
lo convierte en un vertedero cromático; y es el mismo enumerado que viaja al
modelo en el esquema JSON, así que duplicarlo duplica lo que hay que validar.

**Un bloque cromático aparte**, que guarde fundamental y calidad sin pasar por
el grado. Resuelve también el `F#`, pero parte el modelo en dos clases de bloque
y obliga a que todo lo que recorre un montaje sepa de las dos. Queda como el
camino si algún día hace falta el tritono.

**No ofrecer lo que no cabe.** Esconde que ese acorde existe, y el buscador ya
sabe decir por qué no entra.

## Lo que hay que saber si se toca

- **El orden de `comoBloque` es la decisión**: tríada primero, fundamental
  después. Cambiarlo hace que todos los acordes normales arrastren una especie.
- La especie **no viaja a la IA**: es del bloque y de la canción guardada. Por
  eso ampliarla no toca ni el esquema ni los validadores.
- Una especie que no se reconoce se lee como ninguna al abrir una canción
  guardada, así que añadir formas es compatible hacia atrás y quitarlas no.
