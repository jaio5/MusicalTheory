# ADR 0094 — La primera visita trae un recorrido guiado

Fecha: 2026-10-03 · Estado: aceptada, **a prueba**

## Contexto

Quien llega por primera vez ve una barra de navegación, un camino y, en componer, un
banco de áreas con tres espacios de trabajo: mucho que descubrir y nada que lo diga.
La interfaz no se explica sola, y los textos de cada área solo se leen si ya se
sabe que existen.

## Decisión

**Un recorrido que enseña Aprender, el profesor, componer entera y afinar**
(`features/tour/`, estado en `state/recorrido.ts`): 21 pasos en escritorio y 19 en un
teléfono, que no tiene banco. Se puede volver a ver desde Aprender.

- **Los pasos son dato, no componente** (`tour/pasos.ts`), y señalan piezas por
  `data-tour`, un nombre puesto a mano; las que ya llevan un nombre estable —las
  áreas del banco, la navegación— usan ese. Nunca clase ni posición.
- **Se guarda el paso, no solo «visto»**: `localStorage['caos-ordenado:recorrido']`
  vale `'visto'` o el nombre del paso. Recargar a mitad no empieza de cero. Se
  guarda también lo que el recorrido tocó para enseñar componer (Do mayor si no había
  tonalidad, el espacio en que estabas), y se deshace al acabar.
- **Va en su propio trozo** y lo monta el marco (`app/(marco)/layout.tsx`) solo a
  quien no lo ha visto ([adr/0058](./0058-componer-se-descarga-por-partes.md)). En el
  servidor se da por visto: el HTML sale igual para todos.
- **Si una pieza no aparece en tres segundos, el paso se enseña igual**, con la
  tarjeta en medio.
- **No empieza en un trámite** —`/olvidada`, `/registro`, `/cuenta`, `/planes`—
  (`tour/Lanzador.tsx`): al acabar devolvía a la ruta sin la consulta, y quien venía
  del correo a `/olvidada?vale=…` perdía el vale. Sale en la siguiente pantalla de
  trabajo.
- Los scripts del skill `arrancar` lo marcan como visto: tapa la pantalla.

## Consecuencias

- **Un paso depende de un `data-tour`**: renombrarlo o quitarlo lo deja sin ancla, y
  el recorrido explica sin señalar. `tour/pasos.test.ts` vigila que cada paso tenga
  pieza, pero no que la pantalla la siga pintando en cada ancho.
- Es por navegador y por persona, sin cuenta: desde otro aparato se ve una vez más.

## Alternativas descartadas

- **Una ayuda escrita en una página aparte.** Nadie la abre sin saber qué busca.
- **Avisos sueltos en cada pantalla**, sin hilo. No cuentan cómo se relacionan
  aprender, componer y afinar.
- **Un solo mensaje de bienvenida.** Dice qué hay, no dónde.
- **Una librería de recorridos.** Colocar la tarjeta contra un `popover` y un banco
  que se pliega, y devolver el foco, es lo difícil; no se verificó que una la
  resolviera y añadiría peso al paquete de todas las rutas.
- **Guardar solo si se ha visto.** Una recarga a mitad lo daba por visto o lo
  reiniciaba entero.
- **Dentro de `workspace.ts`.** Cada paso reescribiría las preferencias enteras.
- **Señalar por clase o posición.** Cambian con cada retoque.
