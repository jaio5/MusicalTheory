# ADR 0048 — Una toma dice lo que es

Fecha: 2026-09-24 · Estado: aceptada, con su reversión **pendiente** (nota de abajo) · Corrige un supuesto de [ADR 0034](./0034-tres-maneras-de-escribir-la-misma-cancion.md)

> **Esto se va a revertir, y todavía no se ha revertido:** el selector de papel de la toma sigue en el código (`PapelDeLaToma`, `TocarParaEscribir`) y lo que este ADR cerró sigue cerrado hasta que el ROADMAP diga lo contrario. El 26 de septiembre de 2026, quien usa la aplicación
> decidió que **no hay que declarar la toma: tiene que transcribirse sola**, y que
> lo que importa es poder corregir lo que se entienda mal. La medida de aquí abajo
> sigue siendo verdad —una nota sola y su acorde mayor tienen casi la misma forma—,
> pero el objetivo cambia: no acertar siempre, sino transcribir y dejar arreglar.
> Lo que hace falta antes de quitar el selector está en el
> [ROADMAP](../ROADMAP.md), y el orden importa: quitarlo hoy devuelve los acordes
> inventados encima del punteo, que es justo lo que esto cerró.

## Contexto

De las pruebas con guitarra salió un fallo que parecía del motor y no lo era:

> `g-repetidas`: dos notas iguales seguidas en un punteo — **«los percibe como
> acordes»**.

La explicación está en `state/apuntar-lo-tocado.ts`, y es de una línea: **una
toma producía las dos cosas a la vez.**

```ts
const capture = captureProgression(sesion.captured, { … }); // acordes, del croma
const punteo = captureMelody(sesion.noteHistory, { … }); // notas, del motor de tono
```

Los dos motores corren en paralelo sobre la misma entrada —así está desde que
existe «Tocando»— y al apuntar se leía de los dos. **Nadie le decía nunca a la
aplicación qué se estaba tocando**, así que escribía lo que los dos creyeran
haber oído: un punteo entraba con sus notas _y_ con los acordes que el croma
creyó reconocer encima.

[ADR 0043](./0043-dos-maneras-de-equivocarse.md) dejó anotado por qué eso no se
arregla afinando el croma: `discountHarmonics` rebaja la quinta y la tercera de
_cualquier_ acorde, porque en un Do real el Sol **sí es** su tercer armónico. Tras
el descuento, un Do rasgueado y un Do pulsado a solas tienen casi la misma forma,
y ningún umbral los separa. Allí se concluyó que hacía falta calibrar con
grabaciones de una guitarra de verdad.

Eso sigue siendo cierto **para saber qué acorde es**. Y resulta que no hacía
falta para esto otro, porque la pregunta que no se podía contestar mirando el
croma —¿es una nota o es un acorde?— la contesta gratis quien está tocando.

## Decisión

**Antes de tocar se dice qué es la toma: rítmica o punteo. Solo se apunta lo de
ese papel.**

Con `ritmica` corre `captureProgression` y lo del motor de tono se descarta; con
`punteo`, al revés. No es un ajuste ni una preferencia: es **qué se tocó**, y por
eso se elige antes y no se cambia a mitad —media toma leída con un motor y media
con el otro no es ninguna de las dos—.

Lo que esto consigue no es solo quitar ruido: **pone cada cosa en el motor que
sabe hacerla.** El croma es bueno con acordes rasgueados y es el que trae su duda
(`readChord` con margen y candidatos); el de tono es **monofónico y es el fiable**
—es el mismo que afina, y el afinador fue de lo poco que pasó las pruebas con
guitarra a la primera—. Antes competían por la misma señal; ahora cada uno
contesta lo que se le pregunta.

**Y lo que se ve mientras suena es lo que va a entrar.** Con el punteo puesto ya
no se enseña el cifrado que el croma cree reconocer, porque no se va a escribir:
enseñarlo era prometer algo que no pasaba. Se enseña la nota.

**Las dos entradas lo dicen**, porque son dos: el espacio de trabajo de tocar y el
botón del lienzo, que pasa a ser dos —«Traer rítmica» y «Traer punteo»—. La
conversión sigue viviendo en un solo sitio, que es lo que [ADR
0034](./0034-tres-maneras-de-escribir-la-misma-cancion.md) ya decidió y aquí solo
se respeta.

## Consecuencias

Se graba por tomas: primero la rítmica, luego el punteo. Es un gesto más que
antes, y a cambio lo que entra es lo que tocaste. El intercambio está claro y cae
del lado bueno: una parte con acordes inventados encima hay que limpiarla a mano,
y limpiar cuesta más que pulsar un botón.

**Lo que esto no arregla**: acertar _qué_ acorde es cuando roza una cuerda o
falta una nota. Eso sigue pendiente de las grabaciones, y sigue anotado en el
[ROADMAP](../ROADMAP.md). Lo que se va es la confusión entre nota y acorde, que
era una clase entera de falso positivo, no el error dentro de los acordes.

Y abre la puerta a la tercera capa —una segunda guitarra—, que es lo que pidió
quien usa esto. Hoy una parte tiene dos: `blocks` y `notes`. Una tercera toca el
lienzo, la partitura, el reproductor, el MIDI y lo que se guarda, así que va
aparte.

## Alternativas descartadas

**Adivinarlo mirando la señal**, contando cuántas notas suenan a la vez. Es lo
primero que se intentó pensar y está descartado con su medida en
[ADR 0043](./0043-dos-maneras-de-equivocarse.md): tras el descuento de armónicos
las dos cosas tienen la misma forma. Adivinar bien exigiría calibrar contra
grabaciones reales; preguntarlo no exige nada.

**Escribir las dos cosas y dejar que se borre lo que sobre.** Es lo que pasaba, y
es lo que se ha quitado. Una parte con acordes falsos encima del punteo no se ve
mal a simple vista —los bloques parecen legítimos— así que no se borra: se
arrastra.

**Un interruptor global en los ajustes**, en vez de una elección por toma. Se
descarta porque lo que se toca cambia de una toma a la siguiente: la gracia es
grabar la rítmica y después el punteo, y un ajuste que hay que ir a cambiar entre
las dos es el mismo olvido que [ADR
0034](./0034-tres-maneras-de-escribir-la-misma-cancion.md) vino a quitar.

**Dejar que se cambie mientras suena.** Se descarta porque partiría la toma: lo
de antes leído con un motor y lo de después con el otro, sin que nada lo diga.
