# ADR 0108 — El recorrido sale por pantallas, y no bloquea

Fecha: 2026-10-07 · Estado: aceptada · Sustituye en parte a
[ADR 0094](./0094-el-recorrido-de-la-primera-visita.md)

## Contexto

Un estudio de los primeros cinco minutos, recorriendo la aplicación con Playwright
como lo haría alguien que no es el autor —un adulto que toca algo de guitarra y
quiere entender la armonía y escribir sus canciones—, se encontró esto al entrar:
**un diálogo modal de 21 pasos** («Bienvenida · 1 de 21») con la sala a oscuras.
Hasta acabarlo o saltarlo no se podía tocar nada; navegaba solo de pantalla en
pantalla, cambiaba el espacio de componer y ponía Do mayor para poder enseñarse, y
lo deshacía al acabar. Explicaba catorce piezas de componer antes de que se
hubiera escrito un acorde.

## Decisión

**Cinco pasos en cuatro tramos, cada uno en su pantalla, y ninguno bloquea**
(`features/tour/`, estado en `state/recorrido.ts`):

| Tramo        | Dónde sale                     | Pasos                                         |
| ------------ | ------------------------------ | --------------------------------------------- |
| `bienvenida` | La primera pantalla de trabajo | Qué hay, y que se retoma desde Aprender       |
| `aprender`   | `/aprender`                    | El botón de seguir y «Empiezo por»            |
| `componer`   | `/componer`                    | Tonalidad y «Para empezar»; los tres espacios |
| `afinar`     | `/afinar`                      | El afinador                                   |

- **Sale el tramo de la pantalla al llegar a ella** (`tramos.ts`, `tramoPara`), la
  bienvenida primero. Las pantallas sin tramo —una unidad, el profesor— no sacan
  nada.
- **No es modal.** Un `<dialog>` abierto con `show()`, sin velo: la pantalla de
  detrás sigue viva y la pieza señalada, con un aro de latón que deja pasar los
  clics, se puede pulsar mientras se lee. **No se lleva el foco**; cada paso se
  anuncia en una región viva montada vacía. Escape con el foco dentro cierra el
  tramo.
- **Se salta con un clic** —«Saltar el recorrido» lo da por visto entero— **y se
  retoma** con el botón de Aprender, que lo vuelve a poner a cero. La bienvenida lo
  dice.
- **No toca nada de la aplicación para enseñarse**: ni navega, ni cambia de
  espacio, ni pone tonalidad. Ya no hay nada que deshacer al acabar. Como la
  pantalla sigue viva, **la pieza puede cambiar por otra** —elegir tonalidad quita
  los botones de salida y pone la lista de acordes— y el aro la sigue: si la
  señalada desaparece se busca otra por el mismo objetivo, y si no hay ninguna se
  vuelve a mirar cada cuarto de segundo.
- **Se guarda por tramos**: `{ vistos, paso }`, o `'visto'` con todo visto o
  saltado. Lo guardado por la versión de antes se lee como sin empezar.
- Cada `data-tour` puesto lo busca algún paso, y al revés: `pasos.test.ts` vigila
  las dos direcciones. Se quitaron los que no busca nadie.

## Consecuencias

- Se explica mucho menos: las áreas que se pliegan, la bandeja, el metrónomo, las
  teclas o el profesor ya no tienen paso. Cada pantalla tiene que explicarse sola,
  y es lo que ya hacen sus estados vacíos («La canción está en blanco…»).
- La tarjeta puede tapar algo mientras está abierta: es pequeña, va al lado de la
  pieza, y se cierra con un clic.
- Quien navega con el teclado la encuentra al final del orden de tabulación, porque
  el marco la monta después de la aplicación. Se anuncia al salir.

## Alternativas descartadas

- **Dejar los 21 pasos y solo hacerlos no modales.** Seguiría navegando solo por la
  aplicación y explicando lo que no se ha usado.
- **Todo el recorrido al entrar, pero corto.** Cinco pasos seguidos que saltan de
  pantalla siguen siendo una visita guiada antes de ver nada; y en una pantalla que
  no es la suya, la pieza no está.
- **Avisos sueltos sin estado**, uno por pantalla y sin forma de saltarlos todos.
  Sin «saltar» de una vez, quien ya sabe se los come de uno en uno.
- **Un recorrido que pone la tonalidad y el espacio para enseñarse**, como antes.
  Es lo que obligaba a guardar qué había tocado y a deshacerlo tras una recarga, y
  enseñaba una pantalla que no era la que el usuario iba a encontrarse.
- **Mover el foco a la tarjeta al aparecer.** Es lo que haría un diálogo, y aquí la
  tarjeta no pide nada: robar el foco a quien está usando la pantalla es
  interrumpir.
