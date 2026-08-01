# ADR 0008 — Los cupos de IA se calculan desde el precio, y la IA pide cuenta

Fecha: 2026-07-30 · Estado: aceptada · Corrige: los cupos de [ADR 0006](./0006-planes-y-puerto-de-facturacion.md)

## Contexto

Los tres planes salieron con un cupo diario de llamadas al modelo escrito a mano:
tres al día en el gratis, cuarenta en Básico, ciento veinte en Medio, cuatrocientas
en Pro. Los números parecían razonables. **Nadie los había multiplicado.**

Cuarenta peticiones al día son unas mil doscientas al mes. Con `claude-opus-5` a
5 $ el millón de tokens de entrada y 25 $ el de salida, y con el `max_tokens` que
tenían las rutas —1024 en el profesor, 2048 en las ideas—, cada pregunta costaba
entre dos y cinco céntimos. Mil doscientas peticiones son **entre veintiséis y
sesenta euros de coste para un plan de 4,99 €**.

Y había una segunda avería, más silenciosa: en Opus 5 **el pensamiento viene
encendido por defecto** y se cobra como salida. Las dos rutas no lo configuraban,
así que cada pregunta pagaba además el razonamiento, y con un `max_tokens` ajustado
podía gastarse el tope pensando y devolver una respuesta truncada: se paga y no se
sirve.

Y una tercera: el cupo de quien no había entrado se contaba **por dirección IP y en
memoria**. Eso no es un límite por cliente. Se reinicia al desplegar, cada instancia
lleva su cuenta y se esquiva cambiando de red con el móvil en la mano.

## Decisión

**Los cupos no se escriben: se calculan.** Un módulo nuevo del dominio,
[`core/billing/cost.ts`](../../src/core/billing/cost.ts), tiene los precios reales
de los tres modelos, el peor caso de tokens de cada petición y una división:

```
cupo mensual = (precio del plan × parte gastable) / coste del peor caso
```

De ahí salen los dos topes de cada plan, para el modelo que haya configurado. El
número que se promete en la pantalla **es** el dinero que hay para gastar, porque es
el mismo cálculo. No hay forma de que se separen.

Cuatro piezas sostienen eso:

**El peor caso, no el caso típico.** Quien quiera gastar gastará el máximo, así que
el cupo cuadra con el máximo. Calcularlo sobre el gasto medio funciona hasta que
aparece el primer usuario que aprieta, y entonces el dinero ya se ha perdido.

**El `max_tokens` de las rutas sale del mismo sitio.** El peor caso de salida no es
una estimación: es un tope que el servidor impone, leído de `TOKEN_BUDGETS`. Escritos
por separado se separarían.

**Dos topes, no uno.** El del mes protege el dinero —es el periodo de facturación—;
el del día evita que alguien se funda el mes en una tarde y se quede veintinueve
días sin profesor, que es una forma rara de cumplir lo prometido. Los dos se
comprueban en la misma sentencia SQL, y por eso la tabla tiene una fila por cuenta y
mes con el día dentro.

**Sin pensar y con esfuerzo bajo en las dos rutas.** La respuesta la fija un esquema
JSON: no hay nada que razonar. Se apaga el pensamiento y se baja el esfuerzo, con la
instrucción que la documentación del modelo recomienda para ese caso —que no meta
etiquetas internas en la salida—.

**Y la IA pide cuenta.** Es lo que convierte «limitado por cliente» en algo cierto:
sin cuenta no hay cliente, solo una dirección. El contador por IP se ha borrado, no
arreglado.

Con esto, y el 40 % del precio como techo de gasto en modelo:

|                       | Opus 5   | Sonnet 5 | Haiku 4.5 |
| --------------------- | -------- | -------- | --------- |
| Coste de una pregunta | 1,35 cts | 0,81 cts | 0,27 cts  |
| Básico (4,99 €)       | 147/mes  | 246/mes  | 739/mes   |
| Medio (9,99 €)        | 181/mes  | 302/mes  | 908/mes   |
| Pro (19,99 €)         | 363/mes  | 605/mes  | 1817/mes  |

Un test comprueba que **ningún plan de pago pierde dinero con ningún modelo**, ni
gastándose el cupo entero, ni con un modelo que no esté en la tabla.

## Alternativas descartadas

**Ajustar los números a mano hasta que cuadren.** Es lo que se pedía y lo que no se
ha hecho. Cuadrarían hoy y se descuadrarían el día que cambie un precio, el modelo o
un `max_tokens`, sin que nada avise: es exactamente el fallo que se está corrigiendo,
repetido con números distintos.

**Cambiar el modelo a Haiku por nuestra cuenta.** Multiplicaría los cupos por cinco
y sería la decisión con más impacto de este documento. No es nuestra: es una decisión
de producto sobre la calidad de las respuestas, y el cálculo ya deja el número listo
para cualquiera de los tres modelos —una variable de entorno—. Lo que sí se ha hecho
es dejar los precios de los tres a la vista para que la decisión se tome con la
aritmética delante.

**Cobrar por uso en vez de por plan.** Es lo que de verdad alinea precio y coste, y
pide medidor, factura y una pasarela que sepa cobrar importes variables. No hay
pasarela todavía ([ADR 0006](./0006-planes-y-puerto-de-facturacion.md)), así que
habría que construir dos cosas para tener una.

**Un solo cupo, el mensual.** Más simple y deja que alguien se lo funda el día uno.
El coste no cambia —el mes está acotado igual—, pero el producto sí: veintinueve días
con un profesor que no contesta se parecen mucho a estar roto.

**Guardar el histórico por días, como antes.** La tabla tenía una fila por cuenta y
día; permitía dibujar el uso de un mes. Se ha cambiado por una fila por mes porque es
lo que hace posible comprobar los dos topes en una sentencia atómica. Con dos tablas
hay una rendija entre las dos escrituras por la que se cuelan dos peticiones
simultáneas, y eso, en la cuenta del dinero, no es un detalle.

**Dejar el cupo anónimo por IP como cortesía.** Suena generoso y es una puerta:
mientras exista, el límite por cliente no lo es. Lo que se ofrece sin cuenta es la
aplicación entera menos la IA, que es casi todo, porque casi todo pasa en el
navegador de quien toca.

## Consecuencias

- **El plan gratis pierde dinero a propósito**, y ahora se sabe cuánto: quince
  peticiones al mes por cuenta, unos veinte céntimos con el modelo más caro. Es gasto
  de captación, está en una constante con nombre y es el único sitio de la aplicación
  con margen negativo.
- Los cupos que enseña la pantalla dependen del modelo configurado, así que el
  `aiModel` viaja hasta el navegador. Es un identificador público, no un secreto.
- Cambiar `ANTHROPIC_MODEL` cambia lo que reciben todos los clientes sin tocar
  código. Es potente y es un cañón: bajar de modelo sube los cupos y baja la calidad
  de las respuestas, y no hay nada que avise de lo segundo.
- **Sin cuenta no hay IA.** La portada y las pantallas lo dicen donde se intenta
  usar, no en la letra pequeña.
- El peor caso de entrada sigue siendo una estimación por longitud de los prompts, no
  una medida con `count_tokens` —eso pide clave y red—. Lo vigila
  `server/prompts.test.ts`, que mide los prompts de verdad y falla si crecen hasta
  comerse la holgura. Es lo que evita que el modelo de coste se quede mintiendo en
  silencio.
- Los precios de los modelos son de 30 de julio de 2026. Cuando cambien, se cambian
  en una tabla y los cupos se recalculan solos.
