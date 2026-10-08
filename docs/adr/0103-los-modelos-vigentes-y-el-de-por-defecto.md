# ADR 0103 — A cada modelo lo que acepta, y Sonnet 5.5 por defecto

> **Cifras de hoy:** con el modelo por defecto los cupos son 96 y 193 preguntas al mes, no los 113 y 227 de la tabla de abajo. Mira [`CUENTAS-Y-PLANES.md`](../CUENTAS-Y-PLANES.md).

Fecha: 2026-10-07 · Estado: aceptada · Corrige: la llamada de
[ADR 0008](./0008-los-cupos-salen-del-precio.md) («sin pensar y con esfuerzo bajo en
las dos rutas») · Cambia: el modelo por defecto

## Contexto

Un estudio de negocio leyó `server/ask-model.ts` contra los modelos que hay hoy en la
API y encontró que la llamada **solo funcionaba con algunos**. Mandaba a todos lo
mismo:

```ts
thinking: { type: 'disabled' },
output_config: { effort: 'low', format: { type: 'json_schema', schema } },
```

Comprobado contra la documentación de la API el 7 de octubre de 2026
(`platform.claude.com/docs`: «Effort», «Steering thinking», «Structured outputs» y la
tabla de precios):

| Modelo               | `disabled`          | Cómo se apaga                 | `effort`                  | Precio (entrada/salida por millón) |
| -------------------- | ------------------- | ----------------------------- | ------------------------- | ---------------------------------- |
| Fable 5.1, Fable 5   | 400                 | no se apaga                   | sí                        | 10 / 50 $                          |
| Opus 5.5             | 400 a todo esfuerzo | no se apaga                   | sí (por defecto `medium`) | 4 / 20 $                           |
| Opus 5               | sí, hasta `high`    | `disabled`                    | sí                        | 5 / 25 $                           |
| Sonnet 5.5           | 400                 | `between_tools`, hasta `high` | sí                        | 2 / 10 $                           |
| Sonnet 5, Sonnet 4.6 | sí                  | `disabled`                    | sí                        | 2 / 10 $, 3 / 15 $                 |
| Haiku 4.5            | —                   | sin `thinking` no piensa      | **400**                   | 1 / 5 $                            |

Las salidas estructuradas (`output_config.format`) las aceptan todos, Haiku 4.5
incluido. Y en los que no dejan apagar el pensamiento, **lo que piensan se cobra como
salida y cuenta dentro de `max_tokens`**: la documentación lo dice con esas palabras.

Tres fallos de ahí:

1. **Con Opus 5.5, Fable, Sonnet 5.5 o Haiku 4.5, cada pregunta era un 400.** La ruta
   reintentaba, volvía el 400, tiraba del respaldo
   ([adr/0088](./0088-el-profesor-siempre-contesta-y-sabe-mas.md)) y **cobraba el cupo**. Cuatro
   de los modelos vigentes dejaban la IA sin contestar nada.
2. **Opus 5.5, Fable 5.1 y Sonnet 5.5 no estaban en la tabla de precios**, así que se
   cobraban como el más caro de la tabla: no perdía dinero, pero Sonnet 5.5 —el más
   barato de los buenos— daba los cupos de Fable.
3. **Un modelo que no deja de pensar se cobraba como si no pensara.** El coste suponía
   el tope de la respuesta; ese modelo gasta además lo que piensa, del mismo tope, y si
   se lo come entero la respuesta sale cortada: se paga y no se sirve.

Y una cuarta, que es la de producto: con Opus 5 por defecto, Básico daba **73
preguntas al mes**, unas dos al día. Con el margen contado bien
([adr/0106](./0106-el-margen-se-cuenta-sin-iva-y-con-pago-anual.md)) habría dado 45.

## Decisión

**Lo que acepta cada modelo vive en la tabla de precios**, `MODEL_PRICES` de
`core/billing/cost.ts`, con dos campos más: `pensamiento` —`se-apaga`,
`entre-herramientas`, `siempre` o `no-piensa`— y `esfuerzo`. De ahí leen las dos
cosas que no pueden separarse:

- **La petición** (`opcionesDelModelo` en `server/ask-model.ts`): `disabled` a Opus 5,
  Sonnet 5 y Sonnet 4.6; `between_tools` a Sonnet 5.5; nada de `thinking` a Opus 5.5 y
  Fable; ni `thinking` ni `effort` a Haiku 4.5. Esfuerzo `low` a todos los que lo
  aceptan: modera también lo que piensa quien no puede dejar de hacerlo.
- **El coste** (`presupuestoDe`): a los que piensan siempre, el tope de salida lleva
  **1.024 tokens de reserva para pensar** (`RESERVA_PARA_PENSAR`), y el coste la paga
  entera, como paga entero el resto del peor caso. El `max_tokens` que se manda es el
  mismo número.

**Un modelo que no esté en la tabla se supone el peor en todo**
(`MODELO_DESCONOCIDO`): precio del más caro y pensamiento que no se apaga. A la
petición le va `effort: 'low'` sin `thinking`, que es lo que aceptan todos los modelos
nuevos; uno viejo que no aceptara el esfuerzo contestaría 400 y el registro lo diría.
**Los vigentes están todos**, el de Haiku con su alias y con su nombre fechado, y un
test lo comprueba.

**El modelo por defecto pasa a ser `claude-sonnet-5-5`.** Con el margen de
[adr/0106](./0106-el-margen-se-cuenta-sin-iva-y-con-pago-anual.md):

| Modelo     | Una pregunta | Una salida gasta | Básico           | Medio            |
| ---------- | ------------ | ---------------- | ---------------- | ---------------- |
| Sonnet 5.5 | 1,08 cts     | 3                | 113/mes · 19/día | 227/mes · 37/día |
| Haiku 4.5  | 0,54 cts     | 3                | 226 · 37         | 454 · 74         |
| Opus 5     | 2,70 cts     | 3                | 45 · 8           | 90 · 15          |
| Opus 5.5   | 6,26 cts     | 2                | 19 · 4           | 39 · 7           |
| Fable 5.1  | 15,64 cts    | 2                | 7 · 2            | 15 · 3           |

Por qué Sonnet 5.5: cuesta lo que Sonnet 5 por token, su pensamiento se apaga —así
que no paga reserva—, y es la generación actual. Lo que se le pide es poco: contestar
una pregunta de teoría en cuatro frases o elegir tres salidas de un menú que el
dominio ya ha construido y validado
([adr/0089](./0089-las-salidas-las-construye-el-dominio-y-el-modelo-elige.md)), con la
respuesta atada a un esquema y comprobada después contra el dominio. Lo que Opus
pagaría de más no llegaría a quien pregunta.

**El `as` de `between_tools`.** El SDK instalado (0.115) solo conoce `enabled`,
`disabled` y `adaptive`; el cliente manda el cuerpo tal cual. Va con un `as` y su
porqué al lado, y sobra cuando el SDK lo conozca.

## Alternativas descartadas

**Opus 5.5 por defecto.** Es el modelo que la documentación recomienda para casi todo,
y es más barato por token que Opus 5. Pero no deja apagar el pensamiento: con la
reserva, una pregunta cuesta 6,26 céntimos y Básico daría **19 preguntas al mes**.
Sin la reserva el número sería mentira —piensa, y se cobra—, y sin pensar no se puede.

**Haiku 4.5 por defecto.** Dobla los cupos de Sonnet 5.5 —226 al mes en Básico—, y
[adr/0008](./0008-los-cupos-salen-del-precio.md) ya dejó escrito que bajar de modelo
es una decisión de calidad que no se toma con la aritmética sola. Es de la generación
anterior, y el profesor explica teoría en español a quien está aprendiendo: un error
ahí se lo cree. Queda como la primera alternativa que medir: si el examen del profesor
y el de las salidas dan lo mismo con los dos, se baja
([PARA-PUBLICAR.md](../PARA-PUBLICAR.md)).

**Seguir con Opus 5.** Es el que había y funciona con la llamada de antes. Con el
margen contado bien da 45 preguntas al mes en Básico, menos que antes, por 2,5 veces
el precio de Sonnet 5.5 y con un modelo que ya no es el último.

**Mandar `thinking: adaptive` a todos y bajar el esfuerzo.** Es lo que la
documentación recomienda en general, y quitaba el `switch`. Pero en los modelos que sí
lo apagan, pensar es gasto sin nada que ganar —la respuesta la fija un esquema—, y
habría que pagarles la reserva a todos: los cupos de Sonnet 5.5 bajarían de 113 a 39.

**No mandar `thinking` a ninguno.** Es lo que aceptan todos, y Sonnet 5.5, Opus 5 y
Sonnet 5 pensarían por su cuenta: vuelve el fallo de
[adr/0008](./0008-los-cupos-salen-del-precio.md), pagar pensamiento para una respuesta
de esquema.

**Preguntar a la API qué acepta cada modelo** (`GET /v1/models`, que trae
`capabilities`). Es la fuente viva y evitaría la tabla. Pide clave y red en cada
arranque, y **los cupos se calculan también en el navegador**, que no tiene ni una ni
otra; y la tabla hace falta igual para los precios. Una tabla comprobada a mano, con
fecha y con test, es lo que ya se hacía con el precio.

**Una reserva para pensar medida en vez de fija.** `usage.output_tokens_details.thinking_tokens`
dice lo que se pensó de verdad. Medirlo pide clave y dinero, y el cupo tiene que
cuadrar con el peor caso, que es el tope, no la media. Queda como lo que hay que mirar
antes de publicar con un modelo que piense siempre.

## Consecuencias

- Con cualquier modelo vigente, la llamada es una que la API acepta. Un test recorre
  los diez casos —nueve modelos y uno desconocido— y otro mira el `max_tokens` con
  reserva y sin ella.
- **Los cupos con el modelo por defecto suben**: Básico de 73 a 113 preguntas al mes,
  Medio de 148 a 227, y con el margen contado sobre lo que entra de verdad.
- **Opus 5.5 y Fable gastan dos preguntas por salida y no tres**: la reserva pesa lo
  mismo en las dos peticiones y acerca su coste. Lo dice la pantalla, que lo calcula.
- La calidad de Sonnet 5.5 **no está medida** contra el examen del profesor; está en
  [PARA-PUBLICAR.md](../PARA-PUBLICAR.md) con Haiku 4.5 al lado.
- Añadir un modelo es añadir una fila con lo que acepta. Sin ella se cobra como el
  peor caso: siete preguntas al mes en Básico, que es la alarma.
