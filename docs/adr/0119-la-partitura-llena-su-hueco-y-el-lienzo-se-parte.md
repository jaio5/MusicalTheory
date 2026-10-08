# ADR 0119 — La partitura llena su hueco, lo elegido se cambia en su sitio y el lienzo se parte

Fecha: 2026-10-08 · Estado: aceptada · Amplía:
[ADR 0029](./0029-la-partitura-se-dibuja-aqui.md),
[ADR 0059](./0059-memo-a-mano-y-no-el-compilador.md) y
[ADR 0102](./0102-lo-que-se-lee-a-un-metro-se-ve-y-lo-que-se-pulsa-se-sujeta.md) ·
Retira: [ADR 0033](./0033-el-copiloto-propone-y-no-escribe.md)

## Contexto

Una crítica de diseño de `/componer` en «Escribir» encontró cinco cosas, medidas en
el navegador con el skill `arrancar`:

- **La canción no se leía a un metro.** Con cuatro compases, la hoja medía
  824 × 154 px dentro de un área de 1.544 × 750 a 1920 de pantalla, con 453 px
  vacíos debajo y 720 a la derecha; a 1440, 824 × 154 en 1.064 × 570. El pulso
  tiene tope (`PULSO_MAXIMO`, 46) para que cuatro compases no sean una pancarta, y
  con el tope puesto lo que sobraba se quedaba sin usar. Los cifrados iban a 16 px
  en la monoespaciada.
- **La duda no salía en la partitura.** El aviso de lo traído dice que los
  dudosos «salen marcados con «?»», y en Bloques salían; en Partitura, que es la
  vista de entrada, no. Y la tarjeta «No lo oí claro… Apunté Em» no decía de cuál
  de los cuatro `Em` hablaba.
- **No había manera de cambiar un acorde**: con uno elegido, escribir `Am7` lo
  metía detrás.
- **El detalle del acorde parecía texto suelto**: cuatro `Chip` silenciosos sin
  contorno con cien píxeles entre ellos, y la ayuda del teclado salía también en
  el teléfono.
- **`ArrangeCanvas` era una función de 1.795 líneas** —complejidad 48, 27
  `useCallback`, 14 suscripciones—, y el bloque que suena (`currentBlockId`) vivía
  en su estado: cada acorde que sonaba repintaba el lienzo entero. Dentro seguía
  el copiloto que propone en línea, que desde el ADR 0066 no llenaba nadie.

## Decisión

1. **Lo que sobra a lo ancho de la hoja se gasta en escala.** `repartoEnSistemas`
   devuelve además `escala`: con el pulso justificado sale uno, y con el pulso en su
   tope es lo que falta para llenar la caja, hasta `ESCALA_MAXIMA = 2`. El SVG se
   pinta a `ancho × escala` con el mismo `viewBox`, así que todo crece a la vez y
   en la misma proporción —cabeza, plica, clave, espacio— y el grabado sigue en
   espacios de pentagrama (ADR 0029); `clef.test.ts` no se entera. Lo único que
   cambia es la vuelta de pantalla a dibujo: el clic y el estirón se dividen por la
   escala.
2. **Los cifrados van a 22 px en pantalla y en la letra de los títulos**
   (`font-display`, la misma del ensayo y de «A dónde ir»): el cuerpo es
   `CIFRADO_PX / escala`, para que una hoja grande no los convierta en carteles.
3. **La duda se ve en la partitura** —un «?» al lado del cifrado y su línea
   punteada, como el filo del bloque— y **el acorde que se pregunta va
   recuadrado** en las dos vistas, con la tarjeta diciendo la parte y el compás:
   «Apunté Em en Estrofa, compás 3, el recuadrado».
4. **Cambiar es «Cambiar por…», en lo elegido, y escribir sigue metiendo
   detrás.** Abre el mismo buscador de acordes y sustituye el elegido en su sitio
   y con lo que duraba, en un solo paso de deshacer. Quita antes de poner: en una
   parte llena, poner primero no cabría y quitar después perdería el acorde.
5. **Los mandos del detalle son mandos**: `ui/Mandos`, el carril de
   `ui/Segmentado` con acciones —«Antes | Después» y «− | 4 pulsos | +»—, y la
   ayuda del teclado solo con `pointer-fine`.
6. **El copiloto en línea se borra entero**: `state/propuesta.ts`,
   `state/atajos-de-la-propuesta.ts`, `arrange/BloqueFantasma` y sus props en
   `PartRow`. El arrastre de **sugerencias** de «Qué poner ahora» no era parte de
   él y se queda (`use-arrastre-de-sugerencias.ts`).
7. **El lienzo se parte por responsabilidad y por suscripción.** `ArrangeCanvas`
   decide si hay tonalidad y monta `Lienzo`; los gestos, el teclado, las medidas y
   la elección son ganchos (`use-arrastre-de-bloques`, `use-arrastre-de-sugerencias`,
   `use-teclas-del-lienzo`, `use-por-pulso`, `use-eleccion`, `use-foco-pendiente`,
   y `useFuncionEstable`, que vive en `ui/`), y la barra, «Lo elegido», las sugerencias, la nota siguiente y
   los fantasmas son componentes que leen su almacén. **Lo que suena lo lee la
   fila**: el reproductor expone un cabezal (`cabezal.ts`, un `EstadoObservable`)
   fuera del estado de React y cada `PartRow` se suscribe con
   `useSyncExternalStore` a su bloque.
   `ArrangeCanvas.pintados.test.tsx` cuenta con `<Profiler>` los pintados de cada
   fila al cambiar otra, al elegir y al sonar otro bloque; con una flecha nueva
   hacia `PartRow` falla.

## Medido

Con el skill `arrancar`, cuatro acordes en una parte, oscuro y claro iguales:

| Ventana   | Hoja antes | Hoja después | Escala | Cifrado      | Vacío debajo |
| --------- | ---------- | ------------ | ------ | ------------ | ------------ |
| 390×844   | 344×308    | 348×312      | 1,01   | 16 mono → 22 | 0 → 0        |
| 768×1024  | 722×154    | 726×155      | 1,01   | 16 mono → 22 | 0 → 0        |
| 1024×600  | 602×154    | 606×155      | 1,01   | 16 mono → 22 | — (desplaza) |
| 1440×900  | 824×154    | 1.022×191    | 1,24   | 16 mono → 22 | 273 → 236    |
| 1920×1080 | 824×154    | 1.502×281    | 1,82   | 16 mono → 22 | 453 → 326    |

A 1440 y 1920 la hoja llena el ancho del área menos su relleno (42 px). La sonda
de medidas da cero en los diez casos y no hay errores de consola. En un teléfono
con toque emulado, la ayuda del teclado no se ve.

## Consecuencias

- **Lo que queda debajo a 1920 son 326 px**, y es sitio para la parte siguiente:
  la escala la pone el ancho, no el alto, y una parte de un compás no pasa del
  doble.
- Por debajo de `lg` la escala es prácticamente uno: ahí el pulso ya está
  justificado y no sobra papel.
- Un acorde cambiado a mano entra como **escrito** (`written`), no como
  corregido: la corrección entre lo que el motor dudó sigue siendo la tarjeta de
  «No lo oí claro».
- `ArrangeCanvas.tsx` pasa de 1.795 a unas 520 líneas, y la mayoría son las filas
  y la columna montadas con sus comentarios.

## Alternativas descartadas

**Subir `PULSO_MAXIMO`.** Llena el ancho estirando el tiempo y no el dibujo: cuatro
compases a 90 px por pulso son una pancarta con las notas del mismo tamaño
pequeño de antes, que es lo que el tope existe para evitar.

**`width: 100%` y que el `viewBox` haga el resto.** Escala igual, pero la altura
la decide la proporción de cada parte y el reparto en sistemas se seguiría
haciendo a ciegas del tamaño final; con la medida ya en la mano, decidir la escala
en el mismo sitio que el reparto es una cuenta y no dos.

**Que el cifrado crezca con la hoja.** A 1,82 serían 40 px por cifrado, más alto
que un espacio y medio de pentagrama: se pisan entre sí con acordes de dos pulsos.

**Que escribir con un acorde elegido lo sustituya.** Rompe encadenar: cada acorde
escrito queda elegido (ADR 0019), así que teclear `C`, `Am`, `F` dejaría solo la
`F`. Y sustituir sin decirlo es un cambio que no se ve venir.

**Una acción `replaceBlock` en el almacén.** Sería lo más limpio, pero
`state/arrangement-store.ts` no es de este cambio; quitar y poner dentro de un
gesto da el mismo único paso de deshacer. Si aparece un segundo sitio que
sustituye, se sube allí.

**Ampliar `ui/Segmentado` con acciones.** Mezclaría opciones que se excluyen
(`aria-pressed`) con acciones que no se quedan puestas; comparten el carril
(`CARRIL`, `PIEZA`) y no el componente.

**El bloque que suena en `state/`, en un almacén.** Funciona igual con un selector
por fila, pero es estado de un reproductor que vive en el lienzo: un almacén
global para él sobreviviría al lienzo y habría que limpiarlo al desmontar. El
cabezal nace y muere con el reproductor.

**`any-hover` para la ayuda del teclado.** Un portátil táctil con ratón contesta
lo mismo a las dos; un teléfono con lápiz que flota contestaría que sí a
`any-hover` sin teclado delante. `pointer-fine` es la mejor aproximación a «hay
un teclado» que da CSS.

**Guardar el copiloto por si vuelve.** Sin nadie que lo llene, eran cuatro
ficheros, tres props de `PartRow` y una tecla `Tab` secuestrada esperando; el
historial lo guarda, y quien vuelva a proponer en línea tiene la regla en el
ADR 0033.
