# ADR 0084 — Lo que trabaja no se apaga, y el foco se mueve a mano cuando lo pulsado desaparece

Fecha: 2026-10-02 · Estado: aceptada · Matiza
[ADR 0065](./0065-lo-que-se-abre-desde-una-fila-que-se-desplaza-es-un-popover.md), que
los dejó como `popover`, y amplía [ADR 0062](./0062-la-rejilla-del-punteo-llega-a-veinticuatro.md)
en lo que no se pudo subir a 44 px

## Contexto

La auditoría de accesibilidad del 2 de octubre recorrió la aplicación con teclado y
con el árbol de accesibilidad delante, y lo que salió se repetía: **el foco se
perdía.**

- Un botón que pasa a `disabled` mientras trabaja **suelta el foco al `<body>`**, y
  quien no ve la pantalla pierde el sitio justo después de pulsar. Pasaba al entrar,
  al cambiar la contraseña, al pedir el enlace de la olvidada y en el micro de la
  cabecera.
- Cuando lo pulsado **desaparece** —«Siguiente», el formulario de la olvidada, el botón
  de una unidad terminada— el foco se iba con ello.
- Los tres paneles de la barra de componer son `popover` con velo y **parecen modales
  sin serlo**: el tabulador salía por detrás y seguía por los controles tapados.
- En una tira que se desplaza, el tabulador llegaba a un control fuera de la vista y
  el navegador lo dejaba asomar apenas: «Tempo» enseñaba 13 de sus 82 píxeles a 390.
- Las regiones vivas hablaban cuando no debían: la del micro, en plena toma, se
  pisaba con lo que se estaba tocando.
- El nombre accesible de un control no contenía lo que dice: la casilla «Am» se
  llamaba «A menor», y quien la pide por voz leyendo la pantalla no la encuentra
  (WCAG 2.5.3).
- Los atajos `[`, `]` y `\` no se podían pulsar en un teclado español, donde se
  escriben con AltGr y Windows lo manda como Ctrl+Alt.
- Con poco alto, el panel flotante de `ui/Disclosure` y la barra de abajo se repartían
  una pantalla que no daba para los dos.

## Decisión

**Un botón que trabaja no se apaga: lleva `aria-disabled` y `aria-busy` y ignora el
clic** —también el Intro que envía el formulario—. Es `cargando` en `ui/Button` y
`mientrasTrabaja()` para lo que no es un `Button` y también espera, como el micro.
Y **un botón no nace apagado por lo que falta**: gris, no dice qué le pasa; lo que
falta se dice en el campo o con `ui/Aviso`.

**Cuando lo pulsado desaparece, el foco se mueve a mano** a lo que lo sustituye: el
aviso, el título de la unidad terminada o «Siguiente» al contestar, con
`tabIndex={-1}` donde no debe ser una parada más. **Las regiones vivas nacen vacías**
y antes de su mensaje, y **callan donde estorban** con `aria-live="off"` sin
desmontarlas: durante la toma y el ensayo, y en el afinador, que ya dice la nota.

**El nombre accesible empieza por lo visible**: «Am, A menor» y «100 bpm, tempo y
compás». **El aro del foco va hacia dentro** (`-outline-offset-3`) donde un
`overflow` lo recorta.

**Los `popover` se cierran al salir el foco** y no son `<dialog>` modales
(`ui/cerrar-al-salir-el-foco.ts`): lo hace solo cuando el foco va a un sitio que se
conoce, y no cuando pulsas en algo que no recibe foco ni cuando va a su propio
botón. **Las tiras traen el foco a la vista** (`ui/use-traer-a-la-vista.ts`), solo si
de verdad se desplazan y con `nearest`, para no mover la página en vertical.

**El panel flotante tiene un suelo**, `max-h-[max(9rem, …)]`, y **por debajo de 500 px
de alto el `<main>` se desplaza y la barra de abajo se pliega a iconos**
(`AppShell`).

**Los atajos de símbolo valen con AltGr, Ctrl+Alt y Alt solo; los números, sin
modificador alguno** (`state/atajos-del-banco.ts`). Control a secas y Comando siguen
siendo del navegador.

**La rejilla del punteo se queda en 24 px** ([ADR 0062](./0062-la-rejilla-del-punteo-llega-a-veinticuatro.md)):
a 44 una parte de trece filas mediría 572 px, y hay alternativa a 44 px.

## Consecuencias

**Ahora hay tres sitios que saben del corte de la navegación**, no dos: `AppShell`
—arriba o abajo, en `md`—, el tope del panel flotante de `ui/Disclosure` —que
descuenta la barra de abajo mientras exista— y el de 500 px de alto. Si uno se mueve,
los otros también. ~~Ningún test lo vigila~~: desde el
[ADR 0122](./0122-lo-que-se-lee-va-al-cuerpo.md) son las variantes `barra-arriba:` y
`ventana-baja:` de `globals.css`, y `screens/coherencia.test.ts` prohíbe el literal.

Un botón que trabaja se sigue pudiendo enfocar, y pulsarlo otra vez no hace nada. Quien escriba un botón nuevo que espere tiene que pasar por
`cargando` o `mientrasTrabaja`, o volverá a soltar el foco. Quien monte un `popover`
nuevo, ponerle `cerrarAlSalirElFoco`.

## Alternativas descartadas

**`disabled` y devolver el foco a mano.** El foco se suelta en cuanto el botón se
apaga, y devolverlo es un parche por cada botón que espera: la regla tiene que estar
en la pieza.

**No marcar nada.** El botón sigue pareciendo vivo mientras espera y nada dice, ni a
la vista ni al lector, que está trabajando.

**Hacer los `popover` modales con `<dialog>` y `showModal()`.** Atrapar el foco es
lo que pide un aviso que hay que contestar; estos son mandos que se tocan de pasada y
cerrar al salir deja el foco donde lo quería quien se fue.

**Subir la rejilla del punteo a 44 px.** Una parte de trece filas ocuparía 572 px, y
la alternativa de 44 px ya existe para quien la necesite.
