# ADR 0088 — El profesor siempre contesta: respaldo común y glosario ampliado

> **Ampliado por [ADR 0097](./0097-las-salidas-se-juzgan-por-lo-que-encajan.md):** el respaldo de las salidas son las tres mejores del juez, con variedad y su porqué.

Fecha: 2026-10-03 · Estado: aceptada · Amplía:
[ADR 0076](./0076-el-profesor-se-apoya-en-un-glosario-comprobado.md) y
[ADR 0015](./0015-un-solo-canal-de-texto-libre.md)

## Contexto

El examen del profesor (`scripts/examen-del-profesor.ts`) pasó de 28 a **88
preguntas** y mide por separado cuatro cosas: que contesta, que es verdad, que
responde a lo preguntado y que habla de música. Con `qwen3:8b` salían **68 de 88
bien**. Los fallos eran de dos clases: el modelo que no da nada que valga en dos
intentos —y la ruta devolvía un error— y teoría que el glosario no cubría.

## Decisión

**Si el modelo falla dos veces, la ruta contesta igualmente.**

- **El respaldo es común**: `RutaDeIa` admite `respaldo(peticion, fallo)`, y el
  bucle de intentos vive en `server/ai-intentos.ts` (`preguntarAlModelo`). Lo usan
  el profesor y las salidas.
- **En el profesor, el respaldo es el glosario resuelto**, marcado como no escrito
  por la IA (`fuente: 'glosario'`), o, si ni eso, un aviso honrado
  (`fuente: 'aviso'`).
- **El respaldo gasta cupo.** La pregunta se cobra antes de llamar al modelo y no
  se devuelve: devolverlo haría gratis exactamente lo que busca una inyección,
  provocar el fallo.
- **El glosario pasa de 50 a 59 entradas**, más los acordes escritos en la pregunta
  calculados al vuelo; la recuperación entiende plurales, abreviaturas y faltas;
  hay firmas nuevas (intervalos, notas, dominante, armadura, modos).
- **Contra la inyección**: `hablaDeMusica`, `copiaLasInstrucciones` y un
  recordatorio detrás del bloque de la pregunta.

Medido sobre las 88 preguntas: **bien de 68 a 82**. Teoría de 48 a 51 de 54; mal
escritas de 9 a 12 de 12; aplicación de 3 a 7 de 7; inyecciones de 2 a 6 de 8 (7 de
8 en otra pasada).

## Consecuencias

- **El presupuesto del profesor está lleno: 696 de 700 tokens estimados**, sin
  subirlo. No queda sitio para otra frase en el prompt de sistema
  ([AI.md](../AI.md)).
- **La `fuente` se dice dos veces**: en el propio texto, que empieza por «Esto no lo
  ha escrito la IA…» o por «No hemos podido contactar con el modelo…», y con una
  marca encima de la respuesta en `Teacher.tsx` («Del glosario, sin IA», «Sin IA» o
  «Sin conexión con el modelo»), que depende del `motivo` del respaldo.
- Las inyecciones no se cierran: 6 o 7 de 8.

## Alternativas descartadas

**Devolver el cupo cuando contesta el respaldo.** Parece justo y abre la puerta:
cualquier pregunta que provoque el fallo sale gratis.

**Un respaldo solo para el profesor.** Las salidas necesitaban lo mismo, y dos
bucles de intentos divergen.

**El aviso al final del prompt de sistema.** Lo último del prompt de sistema
es lo que más pesa, y ahí se queda la guía; el recordatorio va detrás del bloque
de la pregunta, que es donde está el texto del usuario.

**La pregunta como JSON.** Escapa el texto sin cambiar lo que el modelo hace con
él, y gasta presupuesto.

**Rechazar las preguntas que digan «answer».** Una pregunta legítima de música las
puede decir, y una inyección escribe lo mismo con otra palabra.

**Corregir faltas en palabras cortas.** en una palabra corta una letra de
diferencia es otra palabra: solo se corrige lo largo.
