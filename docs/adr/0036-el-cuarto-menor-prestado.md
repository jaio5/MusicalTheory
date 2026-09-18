# ADR 0036 — El cuarto menor prestado existe en tonalidad mayor

Fecha: 2026-09-19 · Estado: aceptada · Amplía: [ADR 0030](./0030-cambiar-de-modo-traduce-la-cancion.md)

## Contexto

En tonalidad mayor, el catálogo de grados tiene los tres prestados del menor que
son **mayores** —`bIII`, `bVI`, `bVII`— y no tiene el que es **menor**: el `iv`.

No es una laguna teórica. El cuarto menor es el préstamo más corriente de la
música popular: la cadencia plagal menor `I–iv–I` está en media discografía de
los sesenta en adelante, y el giro `IV–iv–I` es idioma corriente en pop, en soul
y en cualquier balada. En Do mayor, **no se puede escribir un Fa menor**: no
tiene grado, así que la lista lo marca como «probarlo», la IA no lo puede
proponer —la ruta descarta lo que no cuadra contra el dominio— y el micro que lo
oye no sabe dónde ponerlo.

Se vio probando la pantalla de salidas con una respuesta inventada que usaba un
`iv`: entró como `IV` y el Fa menor se convirtió en Fa mayor. La respuesta era
mentira mía —la ruta de verdad la habría descartado antes de llegar—, pero lo que
enseñó es real: el acorde no cabe.

`docs/DOMAIN-MUSIC.md` no miente: dice que los prestados son bIII, bVI y bVII. El
documento está bien; lo que falta es el acorde.

## Decisión

**`iv` entra en la tabla de grados de la tonalidad mayor**, como el cuarto
prestado del menor: misma fundamental que el `IV` y tercera menor.

Entra **con sus movimientos**, y eso no es un detalle de implementación: sin
ellos, `nextDegrees` lanza una excepción en cuanto alguien elige ese acorde —es
exactamente la que tumbó la pantalla de componer al añadir los modos
([ADR 0030](./0030-cambiar-de-modo-traduce-la-cancion.md))—. Sale a `I` sobre
todo, que es la cadencia plagal menor, y se llega a él desde `IV` y desde `I`.

**Al cambiar de modo, el `iv` se queda `iv` en los dos sentidos**, porque desde
ahora se llama igual en los dos y no hay nada que traducir. Eso quiere decir que
llevar una canción mayor a menor y traerla de vuelta deja el `IV` convertido en
`iv`: el subdominante que sonaba menor sigue sonando menor.

Y es lo que esta traducción ya hacía con el `vi`, que va a `VI` y vuelve como
`bVI`: **suena el mismo acorde**, aunque se diga con otro nombre. Ese es el trato
desde el [ADR 0030](./0030-cambiar-de-modo-traduce-la-cancion.md), y no una
excepción que se inventa aquí.

Se probó la regla contraria —que la tabla de traducción mandara sobre lo que ya
vale en el modo destino, para que el `iv` de menor volviera a mayor como `IV`— y
no se sostiene: esa traducción se llama **en cada cambio de tonalidad**, no solo
al cambiar de modo, así que un `iv` prestado escrito en mayor se convertía en
`IV` en cuanto alguien tocaba la rueda. Traducir de más tiene que ser no hacer
nada.

## Alternativas descartadas

**Dejarlo fuera y que se pruebe en el camino.** Es lo de hoy. Vale para un acorde
raro y no para éste: no es una rareza de jazz, es el préstamo que más se usa, y
una aplicación de guitarra que no sabe escribir `I–iv–I` no sabe escribir medio
repertorio.

**Meter los cuatro préstamos que faltan de golpe** —`i`, `ii°` prestado, `bV`—.
Es la tentación de hacerlo «bien de una vez», y se descarta por lo mismo que se
descartó abrir el bloque a todas las especies en el
[ADR 0035](./0035-un-bloque-sabe-que-no-lleva-tercera.md): cada grado nuevo trae
su fila de movimientos, su traducción de modo y su sitio en lo que la IA puede
contestar, y ninguno de los otros tres aparece cuando se mira la pantalla. Este
apareció. Cuando aparezca otro, este ADR se amplía con la medida delante.

**Escribirlo como `bVI/…` o cualquier apaño para no tocar la tabla.** Nombrar mal
un acorde para no tocar una tabla es deuda con nombre falso: el `iv` se llama
`iv` en todos los libros y en la mitad menor de esta misma aplicación.

**Que la traducción de modo lo conserve en los dos sentidos** —que el `iv` de
menor vuelva a mayor como `iv` prestado—. Suena a «no perder información» y es
peor musicalmente: llevar una canción de La menor a La mayor y que el subdominante
siga siendo menor es no haberla llevado a mayor.

## Consecuencias

- `MAJOR_DEGREES`, `MAJOR_MOVES` y la tabla de traducción de modo crecen en una
  fila cada una. Nada más del dominio se entera: `degreeOfChord` lo encuentra
  solo, porque busca por fundamental y especie de tríada.
- **La IA puede proponerlo, y por tanto puede equivocarse con él.** Los grados que
  acepta el contrato salen del dominio, así que la puerta se abre sola. Lo que
  seguía verificándose —que el grado exista en la tonalidad— sigue igual.
- El micro que oye un Fa menor en Do mayor ya sabe dónde ponerlo: entra como
  bloque, como cualquier otro grado.
- `docs/DOMAIN-MUSIC.md` pasa a decir cuatro préstamos donde decía tres.
