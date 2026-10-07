# ADR 0043 — Dos maneras de equivocarse, y hasta ahora se miraba una

Fecha: 2026-09-23 · Estado: aceptada · Corrige: [ADR 0020](./0020-lo-que-se-oyo-y-lo-que-se-supo.md)

> **Ampliada por [ADR 0107](./0107-los-armonicos-se-miden-en-su-serie.md).** Lo de
> aquí abajo sobre el modelo de armónicos describe la tabla de entonces: ahora cada
> armónico se mide en su serie, y el margen se mide contra el primer candidato que
> se escribiría distinto. Lo medido es con guitarra sintética.

## Contexto

Esto sale de una tarde de guitarra, que es la única prueba que no se puede
escribir. De treinta y nueve cosas que había que probar a mano, las que fallaron
casi todas caían en el mismo sitio —oír una guitarra de verdad—, y dos de las
notas decían exactamente lo mismo con otras palabras:

> Una cuerda que roza o una nota apagada: **«lo escribe como si estuviera
> seguro»**.
>
> C, F, G y Am sueltos: **«se inventa algunos»**.

Que se equivoque estaba previsto y escrito: el croma olvida la octava y este
proyecto no promete acertar siempre. Lo que promete, desde
[ADR 0020](./0020-lo-que-se-oyo-y-lo-que-se-supo.md), es **decir cuándo duda**. Y
eso es lo que no estaba cumpliendo.

El motivo es que la duda se medía con una sola regla. `ADR 0020` decidió que la
medida era **el margen** —cuánto le saca el elegido al segundo candidato— y
descartó explícitamente usar la puntuación, con un argumento que sigue siendo
cierto: la puntuación depende del instrumento, de la sala y de la pastilla, y dos
acordes empatados a 0,90 son más peligrosos que uno solo a 0,80.

El argumento es cierto y la conclusión era incompleta. Supone que la única forma
de equivocarse es la ambigüedad, y tocando aparece la otra:

**Un acorde puede ganar de calle y no parecerse a nada.** Una cuerda que roza o
una nota que no llegó a sonar dejan un croma raro que _una sola_ plantilla
explica: mal, pero sola. Sale con un margen enorme —no había con qué
confundirlo— y con una puntuación de 0,79, a un pelo del suelo. Mirando solo el
margen, eso era una certeza.

Y había dos agujeros más, los dos del mismo tipo: el dato estaba recogido y se
tiraba.

- `CapturedChord` llevaba su `score` desde el motor hasta `captureProgression`, y
  allí **nadie lo leía**. La única lectura que quedaba era para arrastrarlo al
  colapsar repetidos.
- El análisis en diferido —«grabar un trozo y analizarlo»— usaba `bestChord`, que
  contesta el acorde a secas. Así que **no traía margen ni puntuación**, y todo lo
  que salía de una grabación se apuntaba con confianza 1: certeza absoluta, por
  omisión. La nota de esa prueba fue «como percibe mal los acordes, falla».

## Decisión

**La confianza son las dos holguras, y manda la peor.**

```
confianza = min( margen , puntuación − PARECIDO_MINIMO )
```

El margen es lo que le saca al segundo candidato. La segunda es lo que le saca al
suelo por debajo del cual no hay acorde. **Las dos son diferencias de
puntuación**, así que viven en la misma escala y se comparan con el mismo
`DUDOSO = 0,06` sin convertir nada: no hay un segundo umbral que ajustar.

Lo que esto cambia, en los dos casos que importan:

| Lo que pasó                 | Margen | Puntuación | Antes    | Ahora  |
| --------------------------- | ------ | ---------- | -------- | ------ |
| Dos acordes empatados       | 0,01   | 0,99       | dudoso   | dudoso |
| Una cuerda que roza         | 0,90   | 0,79       | _cierto_ | dudoso |
| Bien tocado y sin confusión | 0,50   | 0,95       | cierto   | cierto |

**El suelo de parecido pasa a tener nombre y un solo sitio.** Era el literal
`0.78` escrito tres veces —dos en `chord-matching.ts` y una en el motor—, y ahora
es `PARECIDO_MINIMO`. Deja de ser un detalle: de él cuelga la mitad de la
confianza, así que tres copias significaban tres reglas midiendo la holgura contra
suelos distintos en cuanto alguien tocara una.

**El análisis en diferido pasa a `readChord`** y apunta su puntuación y su margen,
como el motor en vivo. La confianza de un tramo es la de **su peor ventana de las
que oyeron ese acorde por su cuenta**, y esa distinción no es un detalle: la
programación dinámica extiende un acorde por encima de ventanas cuyo mejor
candidato era otro —para eso está, es lo que corrige las ventanas sueltas—, y la
puntuación de esas habla de _ese otro_ acorde. Contarlas sería medir una cosa con
la regla de otra.

Y cuando **ninguna** ventana del tramo lo oyó, ese acorde lo puso la vecindad y no
el sonido. Es la duda máxima y se apunta como tal: sale con su «?» en el lienzo,
que es exactamente lo que es.

## Consecuencias

De una grabación de guitarra van a salir **bastantes más acordes marcados con
«?»** que antes, y algunos estarán bien. Eso es lo que se ha comprado: la
alternativa era la de ahora, que es afirmar de más. Un «?» de sobra se quita con
un toque y cuesta un segundo; un acorde falso afirmado se arrastra por la canción
entera y no se ve.

**Esto no hace que reconozca mejor.** Hace que mienta menos, que es otra cosa y la
que estaba rota. Lo de reconocer mejor pasa por el modelo de armónicos de
`chroma.ts`, y ahí hay un problema de fondo que ninguna de estas dos medidas toca:
`discountHarmonics` rebaja la quinta y la tercera de _cualquier_ acorde, porque en
un Do real el Sol sí es el tercer armónico del Do. Después del descuento, **un Do
rasgueado y un Do pulsado a solas tienen casi la misma forma**, y es por eso que un
punteo de dos notas iguales se lee como acordes. Eso no se arregla adivinando:
hace falta audio real de una guitarra, y está apuntado como tal en el
[ROADMAP](../ROADMAP.md).

El literal `0.78` sigue apareciendo en los tests, y ahí se queda: un test que
importa la constante que está probando no prueba el número.

## Alternativas descartadas

**Bajar `DUDOSO` y dejar la medida como estaba.** No arregla nada: el caso de la
cuerda que roza sale con margen 0,90, y ningún umbral sobre el margen distingue eso
de un acorde bien tocado. Se estaría afinando la regla equivocada.

**Subir `PARECIDO_MINIMO` para que lo mal tocado no llegue a acorde.** Es la
tentación obvia y es peor: convierte en silencio lo que ahora es una pregunta. Un
acorde de guitarra real en una habitación normal ronda el 0,85, así que subir el
suelo lo justo para tapar el 0,79 deja fuera lo que sí se estaba tocando, y lo
deja fuera **sin decir nada**: un hueco en la canción no se ve. Preguntar es mejor
que callar.

**Dos números separados, uno por cada manera de equivocarse**, con su umbral cada
uno. Es más expresivo y permitiría decir «este no lo tengo claro» distinto de «este
casi no se oía». Se descarta por lo que costaría arriba: `CapturedStep`,
`Block.confidence`, `isDoubtful`, el filo punteado y la corrección tendrían que
aprender a distinguirlos, y en pantalla las dos acaban en la misma pregunta —«esto
es lo que tocaste?»—. Dos números para una sola decisión.

**Guardar la puntuación en la canción** para poder revisarla después. Se descarta
por lo que ya decidió [ADR 0020](./0020-lo-que-se-oyo-y-lo-que-se-supo.md) y sigue
valiendo: una puntuación de un análisis de hace un mes no se puede volver a
comprobar. Lo que hace falta después es si aquello se oyó, se escribió o se
corrigió, y eso sí se guarda.

**Descartar sin más los acordes que rocen el suelo**, en vez de marcarlos. Es lo
mismo que subir el suelo, con el mismo problema: lo que se cae no se ve. Este
proyecto ya tiene decidido que un hueco se cuenta (`Capture.unread`), y un acorde
dudoso da más información que un hueco.
