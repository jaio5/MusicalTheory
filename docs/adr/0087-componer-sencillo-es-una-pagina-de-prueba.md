# ADR 0087 — Componer sencillo es una página de prueba, no un `/componer` simplificado

> **Sustituido por [ADR 0095](./0095-se-quita-componer-sencillo.md):** la versión sencilla ya no existe.

> **Sustituido en parte por [ADR 0091](./0091-componer-sencillo-es-para-tocar.md):** la página ya no es un editor de fichas sino una pantalla para tocar; sigue en pie que es aparte, de una columna y con el almacén de la completa.

Fecha: 2026-10-03 · Estado: sustituida por [ADR 0095](./0095-se-quita-componer-sencillo.md) · Se apoya en:
[ADR 0031](./0031-componer-es-un-banco-de-trabajo.md) y
[ADR 0034](./0034-tres-maneras-de-escribir-la-misma-cancion.md), que siguen en pie

## Contexto

`/componer` abruma a quien llega: las cinco preguntas de componer compiten con los
mandos de repartir la pantalla. Contados al entrar, **35 mandos a 390 px y 45 a
1280**, y **cuatro toques y tres decisiones** hasta oír algo. Es un banco de
trabajo para quien ya compone; para quien llega, es un cuadro de mandos.

## Decisión

**Una página aparte, `/componer/sencillo`, en una sola columna, para ver si
simplificar de verdad funciona antes de tocar la completa.**

- Vive en `app/(marco)/componer/sencillo/`, con la pantalla
  `screens/ComposeSimpleScreen.tsx` y sus piezas en `screens/componer-sencillo/`.
- El orden es el del gesto: tonalidad → la canción en fichas → escuchar y deshacer →
  tocar → por dónde sigo → MIDI. **Todo lo demás va tras un único «Más opciones».**
- **Comparte el almacén con la completa**: lo que se escribe en una está en la otra.
  `/componer` no cambia, salvo un enlace a la sencilla.
- **Cambiar un acorde es quitarlo y ponerlo en su sitio, dentro de un gesto** (un
  solo paso de deshacer). No usa `fixBlock`, que hereda la séptima del bloque.
- **Las propuestas son los seis acordes comunes en tríada**, y lo raro va uno por
  grado en un apartado plegado (`componer-sencillo/propuestas.ts`). _Hoy ya no hay
  apartado de lo raro: ver 0091._
- **Tocar suma el hecho `oido`** y monta `useGananciaAlComponer`, como la completa.

Medido con la misma sonda: **6 mandos al llegar** (contra 35), **3 toques y 2
decisiones**, teclas para cuatro acordes de 54 a 25, acordes raros a la vista de 6 a
0, y escribir `C G Am F` ya se puede. `axe`, sin avisos.

## Consecuencias

- **No se ven punteo, partes ni pulsos.** Es lo que se quitó a propósito.
- **En jazz propone `C` y no `Cmaj7`**: la tríada manda sobre la especie del estilo.
- **La toma suma `oido` y la completa no**: las dos tienen que sumar lo mismo al
  avance, y hoy no lo hacen. Está en el [ROADMAP](../ROADMAP.md).
- **Para ser la entrada por defecto le falta**: formas del acorde o mástil, tempo y
  compás, duración de cada acorde, mover acordes, guardar con nombre y ver el estilo.
  Mientras tanto no sustituye a nada.

## Alternativas descartadas

**Simplificar `/componer` por dentro.** Rompe el banco de áreas y los tres espacios
de trabajo, que son decisiones vigentes (0031 y 0034), y lo hace sin saber si el
camino corto funciona. Una página aparte se puede borrar.

**Una ficha «+ Añadir».** Esconde la acción principal detrás de otra pulsación: el
acorde que se propone se pone directamente.

**Forzar la tríada en la completa.** Le quita a quien compone jazz lo que viene a
buscar.

**`fixBlock` para cambiar un acorde.** Hereda la séptima del bloque que ya había, y
eso es lo que la página sencilla no quiere.

**Tarjetas numeradas de asistente.** Convierten la pantalla en un camino con
principio y fin, y componer no lo tiene.

**Dejar la especie que pone el estilo** (un `Dm7` en rock). Es lo raro que la
página existe para esconder.

**Un orden fijo I–ii–iii.** Parece didáctico, pero deja los acordes que de verdad
se usan —`C G Am F`— repartidos por la lista en vez de a mano.
