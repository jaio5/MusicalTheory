# ADR 0056 — Grabar es un papel de la toma, no otra herramienta

Fecha: 2026-09-28 · Estado: aceptada · Amplía [ADR 0048](./0048-una-toma-dice-lo-que-es.md) · Cierra lo que dejó [ADR 0023](./0023-grabar-solo-el-sonido.md)

## Contexto

Había dos maneras de grabar sonido, y hacían casi lo mismo:

|                       | «Tocando»                    | «Grabar», la pastilla de abajo         |
| --------------------- | ---------------------------- | -------------------------------------- |
| Abre el micro         | el de análisis, **prestado** | **uno propio**                         |
| Reproductor           | sí                           | sí                                     |
| Descargar             | sí                           | sí                                     |
| Dice cuánto dura      | **sí**, contado al grabar    | no: el WebM no lo lleva en la cabecera |
| Escribe en la canción | sí                           | no                                     |
| Tirar la toma         | no                           | **sí**                                 |
| Pide tonalidad        | sí                           | no                                     |

La grabadora venía de cuando esto grababa vídeo y ocupaba una franja entera
([ADR 0023](./0023-grabar-solo-el-sonido.md)); al quedarse en solo sonido bajó a
una pastilla. Y ahí se quedó, mientras «Tocando» crecía hasta hacer lo mismo y
mejor —la duración bien contada, y sin pedir un segundo micrófono—.

Ese segundo micrófono no es un detalle: **dos `getUserMedia` sobre el mismo
aparato son dos permisos y dos pilotos**, y en un iPhone el segundo puede quedarse
el dispositivo y dejar al primero sin señal. Es la trampa que este proyecto ya
tenía escrita, y la grabadora era la única pieza que seguía abriendo el suyo.

Y ocupaba una de las seis pastillas de una barra que **mide 657 px y no cabe en
ninguna pantalla de móvil**, medido de 320 a 640.

## Decisión

**Lo único suyo era no escribir en la canción, y eso es un papel de la toma.**

`PapelDeLaToma` pasa de dos a tres: `ritmica`, `punteo` y **`solo-grabar`**. Se
elige donde se eligen los otros dos, antes de tocar, y encaja con lo que
[ADR 0048](./0048-una-toma-dice-lo-que-es.md) decidió: **una toma dice lo que es**,
y «no escribas nada» es una respuesta tan válida como las otras dos.

De ahí salen tres cosas, todas por la misma razón:

- **No escribe**, y lo decide `apuntarLoTocado` y no la pantalla: es lo que
  significa ese papel, y saberlo en dos sitios es la manera de que un día digan
  cosas distintas.
- **No cuenta los dos compases.** La claqueta existe para que la rejilla sea de
  fiar ([ADR 0053](./0053-la-claqueta-cuenta-y-se-calla.md)); sin nada que
  escribir no hay rejilla, y contar sería esperar por esperar.
- **Y no pide tonalidad**, porque no escribe grados sobre ninguna.

**Se queda lo que la grabadora hacía mejor: tirar la toma.** Aquí no estaba —la
toma solo desaparecía cuando la reemplazaba la siguiente— y decidir que una toma
no vale es la mitad de grabar.

`features/recorder/` se borra entero.

## Consecuencias

Una pastilla menos en la barra que no cabe. Un micrófono en vez de dos. Y la toma
hereda lo que «Tocando» ya hacía bien: la duración contada de verdad.

**Lo que no se ha podido conservar, y hay que decirlo**: la grabadora se podía usar
**sin elegir tonalidad**, porque la fila de abajo se pinta igual. La pantalla de
componer, en cambio, pide la tonalidad antes que nada: sin ella no hay lienzo, hay
rueda. Así que hoy, para llegar a «Solo grabar», hay que elegir una tonalidad
aunque no se vaya a usar.

La pieza está preparada para cuando eso se decida: `TocarParaEscribir` sin
tonalidad enseña el aviso **con un botón de «Solo grabar»** que lleva al papel que
no la necesita. Lo que falta es la puerta de más arriba, y esa es otra decisión: la
tonalidad primero está puesta a propósito.

## Alternativas descartadas

**Dejar las dos.** Es lo que había, y el coste no era la pastilla: era el segundo
micrófono y dos sitios donde arreglar lo mismo. La duración bien contada ya vivía
solo en uno de los dos, que es exactamente cómo empiezan a separarse.

**Quitar la grabadora y no poner nada.** Se pierde grabar sin escribir, que es un
uso de verdad: capturar una idea como sonido sin que se meta en el arreglo. Es la
diferencia entre quitar una función y mudarla.

**Un interruptor «no escribir» aparte del papel**, en vez de un tercer papel. Serían
dos controles para una sola pregunta —qué es esta toma— y dejaría combinaciones sin
sentido, como «punteo que no escribe». El papel ya era la pregunta.

**Abrir la pantalla de componer sin tonalidad** para conservar el caso entero. Se
descarta aquí y no se descarta para siempre: es una decisión sobre cómo se entra a
componer, no sobre dónde vive grabar, y mezclarlas en un mismo cambio habría
cambiado dos cosas a la vez.
