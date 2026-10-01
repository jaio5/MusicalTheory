# ADR 0063 — La cabecera de un área mide un dedo

Fecha: 2026-10-01 · Estado: aceptada · Corrige lo que fijaba el
[ADR 0031](0031-componer-es-un-banco-de-trabajo.md) sobre los 28 px

## Contexto

La cabecera de `ui/Area` medía 28 px (`h-7`) y llevaba dentro «Estrechar»,
«Ensanchar» y «Plegar». Los botones se estiraban a la cabecera, así que medían
44 × 27: ancho de dedo, alto de media dedo. `docs/ESTILO.md` pide 44 px de alto en
todo lo que se pulsa. Además «−» y «+» se leían como un zoom, no como un reparto
del ancho.

## Decisión

**La cabecera pasa a `min-h-tap` (44 px)** y los botones siguen estirándose a ella.
Los glifos de la medida son dos flechas que se juntan o se separan (giradas un
cuarto de vuelta en el eje `alto`), con su `title` y `aria-label` de siempre.

Cuesta 16 px por área abierta con cabecera. Se paga con el área, no con el
contenido: el suelo de 220 px del arreglo ya contaba los 44 de la tira plegada, y la
cabecera abierta no se había recontado.

## Alternativas descartadas

**Un único botón «⋯» de 44 px que abra las tres acciones.** Mantenía los 28 px, pero
esconde «Plegar» —con el que se devuelve un área— detrás de un menú, añade un
popover con su foco y su Escape, y obliga a dos pulsaciones para lo que hoy es una.

**Dejar los 28 px y ampliar solo la zona de pulsación con relleno invisible.** El
botón de 44 se salía de su fila y se comía los clics del contenido de debajo sin
que se viera por qué.

**Quitar «Estrechar» y «Ensanchar» y dejar el divisor.** Volvía a dejar sin sitio
donde pulsar a quien no arrastra (WCAG 2.5.7).

## Consecuencias

- Hay que repasar el reparto de `/componer` con `auditar-componer.mjs`: cada
  cabecera abierta quita 16 px a su contenido.
- El ADR 0031 y cualquier texto que diga «veintiocho píxeles» describen el estado
  anterior.
