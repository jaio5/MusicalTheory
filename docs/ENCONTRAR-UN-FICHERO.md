# Encontrar un fichero

Este documento contesta una sola pregunta: **quiero cambiar algo, ¿dónde está?**

No explica por qué las capas son así —eso es
[ARCHITECTURE.md](./ARCHITECTURE.md)— ni qué hace cada pieza. Solo enseña a
navegar.

## La única regla que hace falta entender

No está ordenado por tipo de fichero. **No hay una carpeta `components` y otra
`hooks`**: está ordenado por **quién puede depender de quién**.

```
app/  →  features/  →  state/  →  audio/  ↘
      ↘              →  ui/               core/
       server/       →  media/  ──────────↗
```

Cada capa solo puede importar de las que tiene a su derecha. `core/` no importa de
nadie. Lo vigila un test —[`src/capas.test.ts`](../src/capas.test.ts)— y ESLint, así
que si te equivocas de sitio te lo dicen antes de que funcione.

Eso significa que **la profundidad te dice de qué trata un fichero**: cuanto más a
la derecha, menos sabe de la pantalla y más de la música.

## Las siete carpetas, en el orden en que se buscan

| Carpeta                    | Qué hay                                               | Vas ahí cuando buscas                 |
| -------------------------- | ----------------------------------------------------- | ------------------------------------- |
| `src/app/`                 | Las doce rutas y las nueve pantallas                  | una **página**                        |
| `src/features/`            | Las funciones grandes, una carpeta cada una           | **cómo se comporta** algo             |
| `src/state/`               | Lo que se recuerda, y quién abre el micro             | **datos compartidos** entre pantallas |
| `src/ui/`                  | Veinticuatro piezas: botones, campos, avisos, paneles | una **pieza reutilizable**            |
| `src/core/`                | Teoría musical, planes, mástil. **TypeScript puro**   | una **regla o un cálculo**            |
| `src/audio/`, `src/media/` | Micrófono, análisis, metrónomo, grabar                | algo que **suena o graba**            |
| `src/server/`              | Cuentas, base de datos, llamadas al modelo            | algo del **servidor**                 |

## La cadena: de una dirección a su código

Siempre son los mismos saltos, y siempre en el mismo orden. Con el afinador:

| Salto          | Fichero                       | Qué hay dentro                   |
| -------------- | ----------------------------- | -------------------------------- |
| 1. La ruta     | `app/(marco)/afinar/page.tsx` | qué pantalla va aquí y su título |
| 2. La pantalla | `app/screens/TuneScreen.tsx`  | el marco y qué apartados tiene   |
| 3. La función  | `features/tuner/`             | el comportamiento de verdad      |
| 4. El motor    | `audio/autocorrelation.ts`    | cómo se detecta el tono          |
| 5. El dominio  | `core/instrument/tunings.ts`  | las ocho afinaciones             |

Y se puede leer al revés. Si tocas `core/instrument/tunings.ts`, sabes que lo que
cambias sale en el afinador y en el mástil, porque son los únicos que lo abren.

Las doce rutas son la portada, `src/app/page.tsx`, y todos los
`src/app/(marco)/*/page.tsx`. El paréntesis no sale en la dirección: es un grupo
de rutas, y su `layout.tsx` monta el marco común —la barra, el micro— **una vez
para todas**, así que cambiar de pantalla no lo desmonta. La portada va fuera
porque pinta su propia sala, sin barra.

```
/            /afinar        /componer     /profesor
/aprender    /aprender/[unidad]           /aprender/repaso
/planes      /planes/[plan]  /registro    /cuenta      /olvidada
```

Si una pantalla revienta al pintarse, lo que se ve sale de `app/Averia.tsx`, por
una de tres fronteras: `(marco)/error.tsx` deja la barra puesta, `app/error.tsx`
coge lo de fuera del marco y `app/global-error.tsx` lo que rompa el layout raíz.

## Cuatro ejemplos de verdad

**«Quiero cambiar el texto de un botón de componer.»** Es pantalla: `features/arrange/`.
Casi todo lo de `/componer` vive ahí, y el fichero grande es `ArrangeCanvas.tsx`.

**«Quiero cambiar qué acordes propone.»** Es una regla, no una pantalla:
`core/music/suggestions.ts` y `styles.ts`. La pantalla solo pinta lo que estos
deciden, así que cambiando aquí cambia en los dos sitios donde se ofrece.

**«Quiero cambiar cuánto dura la cuenta atrás al grabar.»** Es tiempo musical, así
que está en el dominio: `core/music/tempo.ts`. Quien la hace sonar es
`state/cuenta-atras.ts`, pero el número no vive ahí.

**«Quiero cambiar lo que se le manda al modelo.»** Eso es servidor:
`app/api/versiones/route.ts` para las salidas, y el texto del prompt en
`features/versions/prompt.ts` y `server/prompts.ts`.

## Tres atajos que valen más que todo lo anterior

**El índice de [`CLAUDE.md`](../CLAUDE.md).** Hay una tabla de cincuenta y siete filas «busco X
→ está en Y». Es más rápida que cualquier búsqueda y es lo primero que hay que
mirar.

**Los tests están pegados al código.** `Staff.tsx` tiene su `Staff.test.tsx` al
lado, en la misma carpeta. Así que si encuentras el fichero ya tienes su test, y
muchas veces **el test se lee mejor que el código**: dice por qué se hizo así y qué
fallo evita.

**Los nombres nuevos van en español.** Sirve para distinguir de un vistazo lo del
proyecto de lo que trae la plataforma: `cuenta-atras.ts` o `CorregirAcorde.tsx` son
nuestros; `useCallback` o `SessionRecorder`, no.

## Dos ficheros que no son código

- [`src/capas.test.ts`](../src/capas.test.ts) es lo que **vigila el diagrama de
  arriba**: si importas `@server/` desde un componente, ese test falla.
- `src/features/direcciones.test.tsx` comprueba que los enlaces entre pantallas
  llevan a alguna parte.

## Si vienes de Angular

El cambio de cabeza es este: allí la plantilla va en un `.html` y su clase en un
`.ts` al lado. **Aquí las dos cosas están en el mismo `.tsx`** —la `x` es por el
marcado que lleva dentro— y por eso no hay carpeta de plantillas: no existen como
ficheros aparte.

Lo demás que se comporta distinto a lo que esperarías —que no hay inyección de
dependencias, que el estado va en Zustand y no en un servicio con
`BehaviorSubject`, y que `useEffect` no es `ngOnInit`— está explicado en
[ARCHITECTURE.md](./ARCHITECTURE.md#notas-para-quien-viene-de-angular).
