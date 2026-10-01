# ADR 0058 — Componer se descarga por partes

Fecha: 2026-09-30 · Estado: aceptada · Revisa lo descartado en [ADR 0045](./0045-un-barril-por-pantalla-no.md)

## Contexto

[ADR 0045](./0045-un-barril-por-pantalla-no.md) dejó a cada ruta con lo suyo, y
`/componer` fue la que menos bajó: 260 KB, «casi todo lo que descargaba sí es
suyo». Descartó `next/dynamic` con esta frase:

> Una pantalla cargada en diferido necesita su estado de espera, y el lienzo de
> componer tardando en aparecer con un hueco en medio es peor que 80 KB. Esto se
> reconsidera si `/componer` crece mucho más.

Desde entonces cambió lo que hace falta para reconsiderarlo, y no es el peso: es
**por dónde se entra**. Componer entra por `Tocando`, con el área de abajo cerrada
([ADR 0034](./0034-tres-maneras-de-escribir-la-misma-cancion.md),
`state/workspace.ts`). En la primera visita no se pinta ni el lienzo, ni el
ensayo, ni el mástil, ni ninguno de los tres paneles de abajo —salidas, canciones,
sesiones—, y los seis viajaban con ella. El «hueco en medio» que temía 0045 era
el del lienzo al entrar, y el lienzo ya no está al entrar.

## Decisión

**Seis piezas llegan en diferido, con `React.lazy` y `Suspense`**, cada una
importada de su módulo y no del índice de su feature:

| Pieza                                | Cuándo se pinta            |
| ------------------------------------ | -------------------------- |
| `ArrangeCanvas`                      | al pasar a `Escribir`      |
| `Ensayo`                             | al pasar a `Ensayar`       |
| `FretboardPanel`, `RotulosDelMastil` | al abrir el mástil abajo   |
| `VersionsPanel`                      | al abrir «Salidas» abajo   |
| `SongsPanel`                         | al abrir «Canciones» abajo |
| `SessionsPanel`                      | al abrir «Sesiones» abajo  |

Se quedan en el paquete de entrada `TocarParaEscribir` —es por donde se entra—,
el metrónomo y los ajustes —se ven en la cabecera y en la columna de la
tonalidad— y las listas del acorde y de «a dónde ir».

**Y el hueco de 0045 se evita pidiendo antes de hacer falta**, en tres momentos:

- **En reposo, el lienzo y el ensayo.** Son los dos espacios a los que se pasa
  desde aquí, así que se piden con `requestIdleCallback` en cuanto la pantalla se
  queda quieta —con un plazo de 200 ms donde no existe, que es Safari—. En reposo
  no compiten con la hidratación, que es lo que la división viene a aligerar.
- **Al pasar por los espacios**, con el puntero o con el tabulador, por si se
  llega antes que el reposo. Los atajos `1`, `2` y `3` no pasan por ahí y dependen
  del reposo.
- **Al pasar por la fila de abajo**, los cuatro paneles a la vez. Son unas
  decenas de KB cada uno, y lo que cuesta es esperarlos al pulsar.

Pedir dos veces el mismo `import()` no descarga nada: el empaquetador guarda lo
que ya trajo. Si aun así se llega antes que el código —una red lenta—, el sitio lo
ocupa «Abriendo el lienzo…» con `role="status"`, no un hueco.

**`@features/arrange` ya no se importa por su índice desde la pantalla**:
reexporta el lienzo y el ensayo, y un índice es la forma más corta de volver a
traerse al paquete de entrada lo que acaba de salir. Lo mismo `ResumeLast`, que
se importa de su fichero para no pasar por el índice de sesiones.

## Consecuencias

**El peso no está medido todavía.** Esta decisión se tomó con el árbol de
dependencias a la vista y sin poder pasar `pnpm build`, así que no hay cifra: la
tabla de lo que baja `/componer` la tiene que sacar `peso-de-las-rutas.mjs` del
skill `arrancar`, y es lo primero que hay que hacer antes de dar esto por bueno.
Si la ruta no baja, lo más probable es que algo siga importando uno de estos
módulos por un índice.

Cambiar de espacio puede enseñar un fotograma de «Abriendo…» aunque el código ya
esté: `lazy` se resuelve con una promesa la primera vez que se pinta, esté el
módulo descargado o no. Se acepta: un fotograma con una línea de texto no es el
hueco que temía 0045.

Los tests montan la pantalla igual que antes, pero lo diferido llega un momento
después: lo que mira dentro del lienzo desde `ComposeScreen.test.tsx` tiene que
esperarlo con `findBy`. Y el doble de `TocarParaEscribir` de
`ComposeScreen.espacios.test.tsx` se pone sobre el módulo, no sobre el índice.

## Alternativas descartadas

**`next/dynamic`**, que es lo que se usa en Next. Por dentro es lo mismo —`lazy`
y `Suspense`—, y se descarta por lo que pasa en los tests: `next/dynamic` solo es
el de producción después de que el compilador de Next lo reescriba al del App
Router (`shared/lib/app-dynamic.js`); en Vitest se resuelve al del Pages Router
(`shared/lib/dynamic.js`), que es otro cargador. Las pruebas estarían probando una
pieza que no se sirve. `lazy` es la misma en los dos sitios, y la guía de Next la
da como la otra manera buena (`01-app/02-guides/lazy-loading.md`).

**`ssr: false`.** No hace falta: lo diferido no se pinta en el servidor porque en
el servidor no hay tonalidad elegida ni espacio guardado —los dos se leen del
navegador al montar—, así que la primera pintura es la de `Tocando` sin nada.

**Diferir también el metrónomo y los ajustes.** Se ven al entrar, en la cabecera y
en la columna de la tonalidad: diferirlos es poner un «Abriendo…» justo en lo
primero que se mira, que es el caso que 0045 tenía razón en no querer.

**Pedirlo todo en reposo**, también los paneles de abajo. Se descarta porque son
cuatro piezas que la mayoría de las visitas no abre, y descargar lo que nadie usa
es justo lo que esta decisión viene a quitar; para esas basta con pedirlas al
pasar por su fila.
