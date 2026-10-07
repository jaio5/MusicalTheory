# ADR 0052 — El segundo canal de texto libre: a qué quieres que suene

Fecha: 2026-09-24 · Estado: aceptada · Abre lo que cerró [ADR 0015](./0015-un-solo-canal-de-texto-libre.md)

## Contexto

Las salidas mandaban al modelo la tonalidad, los grados, sus pulsos y qué parte es
lo que le mandas. Todo eso lo elige la interfaz, así que nada de lo que viajaba lo
escribía nadie con el teclado.

Y faltaba la otra mitad de la pregunta. El selector dice **qué** le mandas —una
idea, una estrofa, un estribillo— y no había manera de decir **qué quieres**: que
suene a rock lento, que lleve un punteo en el estribillo, que el puente cambie de
sitio. Sin eso el modelo continuaba siempre por lo obvio, porque nadie le había
dicho otra cosa.

El problema es que [ADR 0015](./0015-un-solo-canal-de-texto-libre.md) se llama «un
solo canal de texto libre» y dejó **uno** a propósito: la pregunta del profesor.
Cerró los otros dos que había, `topic` y `name`, y dejó escrito que lo demás queda
«cerrado por construcción y no por filtro».

Así que esto lo abre, y hay que decir por qué no es lo mismo.

## Decisión

**Se abre un segundo canal, `directrices`, y va acotado exactamente como el
primero.**

Lo que lo distingue de los dos que se cerraron es lo único que importaba allí:
**aquellos no hacían falta.** El título de la unidad estaba en el temario y el
nombre de la canción solo construía una línea del prompt —no volvía, no se
guardaba, y el cliente ni lo mandaba—: 120 caracteres de superficie abiertos sin
que nadie los usara. Esto sí se usa: **es la función.** No hay manera de decir a
qué quieres que suene tu canción con un menú, igual que no la hay de preguntar lo
que no sabes decir, que es el argumento con el que 0015 se quedó con el canal del
profesor.

Y va acotado igual, con lo mismo que ya está probado allí:

- **Entre marcas `###DIRECTRICES###`**, y el prompt de sistema dice que lo de
  dentro lo escribe quien toca: un dato, nunca una instrucción.
- **La marca se le borra a lo que escribas** al validar. Sin eso, escribirla
  cerraría el bloque y lo de después se leería como instrucciones nuestras.
- **240 caracteres**, el mismo tope que la pregunta, y vive con las demás palancas
  de gasto en `core/billing/cost.ts` porque es lo que es: tokens.
- **Vacío es no mandar nada**: el campo se omite en vez de viajar en blanco. Una
  línea vacía en un prompt es una línea que el modelo interpreta, y lo que
  interpreta es que le falta algo.

Dos maneras de acotar lo mismo serían dos superficies que revisar, así que es una.

### Y de paso, lo que esto destapó

**El título y el porqué de una salida no tenían tope ninguno**: ni en el esquema ni
al validar, solo «que no esté vacío». Son **la única prosa del modelo que llega a
la pantalla** —los acordes se recalculan contra el dominio, el texto no—, y
mientras no entrara texto libre en ese prompt era un descuido pequeño. Con este
canal abierto es justo por donde una inyección te escribiría algo.

Así que se cierran por construcción: 60 caracteres de título —lo que el prompt ya
pedía, ahora comprobado— y 200 de porqué. **Se recortan, no se descartan**: un
porqué de más es prosa de sobra, no una progresión mala, y tirarla sería tirar lo
que sí vale.

## Consecuencias

Lo que de verdad acota el abuso sigue siendo lo que decía 0015, y conviene no
confundirlo con esto: **900 tokens de salida**, cuenta obligatoria, las salidas solo
en el plan Pro, el cupo del mes, el límite por minuto, y una respuesta que solo ve
quien la pidió. De ahí no sale un chatbot. Y ahora, además, la prosa que llegue a
la pantalla cabe en una línea y media.

Lo que **no** cambia: los acordes no se creen nunca. Vengan de donde vengan, se
recalculan contra el dominio y la salida que no cuadra se descarta
([ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md)). Unas directrices
no pueden hacer que se escriba un grado que no existe ni un salto que el grafo no
conoce, porque eso no depende de lo que el modelo diga.

Y sigue sin subir audio. Lo que viaja de lo que toques son grados, pulsos y ahora
una frase tuya.

## Alternativas descartadas

**Directrices con un menú**, casillas de estilo y de intención en vez de escribir.
Cerraría el canal del todo y es lo que hace `styles.ts` para las sugerencias de
acorde, así que hay precedente. Se descarta por lo mismo que 0015 no prohibió la
pregunta escrita: el menú ya existe —el papel de la parte y el estilo— y lo que
falta es justo lo que no cabe en él. «Que el puente entre después del segundo
estribillo y baje de intensidad» no es una casilla.

**Declarar el tema, como hace el profesor** —que el modelo diga si lo que le piden
es de música y tirar su texto si no—. Se descarta porque aquí no hace el mismo
trabajo: del profesor lo que llega a la pantalla **es** su prosa, y de una salida
lo que llega son acordes recalculados más un título y un porqué que ahora caben en
una línea y media. Tirar el texto ya lo hace el tope, y sin gastar cinco tokens de
esquema en cada petición.

**Guardar las directrices para ver qué se pide.** Se descarta por lo mismo que allí:
hoy no se guarda ni una palabra de lo que se escribe, y empezar a hacerlo es una
decisión de privacidad con su propio ADR y su aviso en pantalla, no una línea
metida de rondón.

**Un cuadro de texto grande en vez de una línea.** Se descarta porque un cuadro
grande pide un guion, y un guion son tokens que además no se leen: el tope son 240
caracteres, así que un cuadro que invita a escribir mil miente sobre lo que va a
pasar.
