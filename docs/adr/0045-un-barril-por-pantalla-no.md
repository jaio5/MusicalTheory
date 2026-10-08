# ADR 0045 — Un barril para las pantallas, no

> **Lo descartado aquí lo revisa [ADR 0058](./0058-componer-se-descarga-por-partes.md):** componer se descarga por partes, con `lazy` desde el módulo y no desde un barril.

Fecha: 2026-09-23 · Estado: aceptada

## Contexto

Midiendo la aplicación compilada en producción apareció algo que ningún test
podía ver: **las ocho rutas descargaban exactamente los mismos trece chunks,
288 KB de JavaScript. Cero código específico de ruta.**

La cifra clavada en todas es la señal. No es que una pantalla pese de más: es que
no hay división ninguna.

No es una deducción. Se buscaron cadenas que solo existen en un sitio dentro de
los ficheros que descarga `/afinar` —una pantalla que dibuja seis cuerdas y una
aguja—:

| Cadena               | Vive en            | ¿La descargaba `/afinar`? |
| -------------------- | ------------------ | ------------------------- |
| «Añadir otra parte»  | lienzo de componer | **sí**                    |
| «sustituto tritonal» | temario            | **sí**                    |
| «Borrar la cuenta»   | ajustes de cuenta  | **sí**                    |

La causa estaba en una línea que se repetía en las nueve páginas:

```ts
import { TuneScreen } from '../screens';
```

`app/screens/index.ts` era un barril con `export *` de las nueve pantallas. Pedir
una las trae las nueve, y con ellas todo lo que cada una importa: el lienzo, el
grabado de partitura, los contratos de la IA, las tarjetas de plan.

**Los seis comandos estaban en verde**, y lo seguían estando: ni los tests, ni los
tipos, ni las reglas de capas de ESLint miran lo que acaba viajando por el cable.
Las reglas de capas vigilan **quién puede importar a quién**, que es una pregunta
distinta de **qué acaba en el paquete**.

Hubo además una hipótesis equivocada por el camino, y merece quedar escrita: se
empezó culpando a `AppShell`, que lo pinta toda página e importaba de
`@features/account` —un barril de diez componentes— para poner la bolita del
avatar. Se cambió, se volvió a medir y **no movió nada**: 288 KB antes y 290
después. Medir antes de creerse una causa ahorró arreglar lo que no era.

## Decisión

**Cada página importa su pantalla del módulo, y el barril se borra.**

```ts
import { TuneScreen } from '../screens/TuneScreen';
```

Se borra en vez de dejarlo y poner una regla: no se puede importar por error de un
fichero que no existe, y una regla de ESLint más es una cosa más que mantener.

**`sideEffects` en `package.json`, con las hojas de estilo fuera.**

```json
"sideEffects": ["*.css"]
```

Sin esa declaración, el empaquetador tiene que suponer que **cualquier** módulo
puede hacer algo al cargarse, así que no puede descartar lo que un barril
reexporta y nadie usa. Con ella, `@core/music` —que es un índice de cuarenta y
cinco ficheros y que `state/` importa entero— deja de arrastrar el temario, las
lecciones y los ejercicios de oído a todas las pantallas.

El `*.css` no es adorno: `layout.tsx` importa `globals.css` por su efecto y nada
más, y declararlo sin efectos lo borraría del build. Es el único import de este
proyecto que existe por lo que hace y no por lo que devuelve.

**Y un medidor en el skill `arrancar`**, porque esto no lo puede vigilar un test:
`peso-de-las-rutas.mjs` levanta el navegador contra un servidor de producción, dice
lo que pesa cada ruta y **avisa si una pantalla se descarga cadenas de otra**. Lo
que vale es esa última parte: un total que sube puede ser una función nueva, pero
«el afinador se trae _Añadir otra parte_» es un fallo sin discusión.

## Consecuencias

Lo que se ahorra quien abre la aplicación, medido con `transferSize` —lo que viaja
comprimido, que es lo que se paga—:

| Ruta                 | Antes  | Ahora  | Menos              |
| -------------------- | ------ | ------ | ------------------ |
| `/planes`            | 287 KB | 163 KB | **−124 KB, −43 %** |
| `/registro`          | 287 KB | 166 KB | **−121 KB, −42 %** |
| `/afinar`            | 287 KB | 167 KB | **−120 KB, −42 %** |
| `/aprender`          | 287 KB | 177 KB | −110 KB, −38 %     |
| `/profesor`          | 287 KB | 196 KB | −91 KB             |
| `/aprender/[unidad]` | 287 KB | 225 KB | −62 KB             |
| `/componer`          | 287 KB | 260 KB | −27 KB             |

`/componer` baja poco y es lo esperado: casi todo lo que descargaba **sí es suyo**.
Que fuera la que menos ganara es, de hecho, la comprobación de que el reparto
quedó bien.

Cambiar de `/afinar` a `/componer` ahora descarga la diferencia en vez de tenerla
ya. Es el intercambio de siempre y sale a cuenta: nadie abre las ocho pantallas, y
**la primera visita es la que decide si alguien se queda**.

Queda una cosa que no se tocó: `AppShell` sigue importando `@features/account`
entero, así que «Borrar la cuenta» viaja a todas partes. Se midió y **es un
empate** —quita 4 KB de las pantallas que no lo necesitan y añade 3 a las que sí—,
porque `/cuenta`, `/registro` y `/planes` acaban descargándolo por su lado. No
compensa el cambio.

## Alternativas descartadas

**Dejar el barril y poner una regla de ESLint** que prohíba importar de él. Se
descarta porque la regla no sirve de nada si el fichero no existe, y borrarlo es
más barato de mantener que configurarlo. El barril no daba ninguna ventaja: nueve
páginas, nueve importaciones, una cada una.

**`next/dynamic` para las pantallas pesadas.** Habría bajado más, y se descarta por
lo que cuesta: una pantalla cargada en diferido necesita su estado de espera, y el
lienzo de componer tardando en aparecer con un hueco en medio es peor que 80 KB.
Esto se reconsidera si `/componer` crece mucho más. Se reconsideró en
[ADR 0058](./0058-componer-se-descarga-por-partes.md): componer ya no entra por
el lienzo, y lo que se difiere es lo que no se ve al entrar.

**`optimizePackageImports` de Next** para los barriles. Se descarta porque está
pensado para dependencias de `node_modules` con cientos de exportaciones, no para
los índices de un proyecto, y porque `sideEffects` resuelve lo mismo siendo una
línea y estándar.

**Quitar los índices de `core/`** y que todo el mundo importe de los ficheros
sueltos. Se descarta porque `CLAUDE.md` manda lo contrario y tiene razón: un
dominio cohesionado se importa por su nombre, no por su estructura interna. Con
`sideEffects` puesto, el índice **ya no cuesta nada**, que era el único argumento
en contra.
