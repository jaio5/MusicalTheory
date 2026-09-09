# Cómo se escribe aquí

Las reglas de escritura del proyecto: el idioma, los comentarios, la interfaz y
los tests. Vivían en `CLAUDE.md` y salieron de ahí porque ese fichero es el mapa
—enruta, no explica— y estas cincuenta líneas eran la mitad de lo que lo hacía
crecer.

**Casi todo lo de aquí lo vigila un test.** Cuando se dice «lo comprueba
`coherencia.test.ts`», no es una recomendación: es que romperlo pone la
construcción en rojo.

## El idioma

- **Todo en español**: código comentado, tests, documentación y commits.
- Los comentarios explican **por qué**, no qué. Lee un fichero vecino antes de
  escribir uno nuevo: el repositorio es consistente en esto.
- **Los identificadores, según la capa.** `core/` y `audio/` van en inglés
  —`CapturedChord`, `degreesFor`, `chordsOfRecording`— y `ui/`, `state/` y
  `server/` admiten español —`ANCHOS`, `elegirTema`, `versionesSinIA`—. No es un
  capricho: en `core/` no hay ni un identificador castellano entre sesenta, y
  meter uno crea trampas como tener `MAX_SECCIONES` (4) al lado de `MAX_SECTIONS`
  (12).
- Notas en cifrado anglosajón —C, D, E—, y cada tonalidad decide sostenidos o
  bemoles según su sitio en la rueda.
- Commits: `tipo(ámbito): frase en minúscula y sin tildes`, contando el efecto que
  se nota. Ejemplo real: `fix(mastil): se ve entero al abrirlo, sin arrastrar nada`.

## La interfaz

Se lee **a un metro y con las dos manos ocupadas**. De ahí sale casi todo lo
demás: nada por debajo de 12 px, **44 px de alto en todo lo que se pulsa**,
diagramas grandes, y el significado de un color al lado del color.

- **Los controles de formulario son tres y solo tres**: `ui/Field` para elegir una
  opción, `ui/Disclosure` para abrir un bloque y `ui/TextField` para escribir.
  Ninguno se escribe a mano —lo vigila `coherencia.test.ts`—, porque así salieron
  cinco pintas distintas. El campo de texto estuvo suelto en catorce sitios y lo
  que la copia escondía era peor: **ninguno llegaba a los 44 px**. El ancho se pide
  (`completo`, `auto`, `crece`); heredarlo llenaba una barra de herramientas con un
  desplegable de un dígito y doce rem.
- **Toda pantalla entra por `ui/Screen`** —o por `WorkHeader` si es de taller— y
  ninguna se escribe su propio ancho, relleno ni `h1`. Lo vigilan dos tests que
  leen los ficheros (`app/screens/coherencia.test.ts`), porque la coherencia solo
  se ve en conjunto.
- **Los 44 px valen también para lo redondo.** Los tres controles de formulario los
  cumplían desde que existen, pero los botones sin texto no pasan por ellos y nadie
  los miraba: el conmutador de tema y los dos de la cuenta medían 36 px y el de
  grabar 32, los tres al lado de uno de 44 en la misma barra, y los enlaces de la
  barra de pantallas se quedaban en 26 a partir de los 640 px, que es donde entran
  las tabletas. Se piden con `size-tap`, que es el mismo `--spacing-tap` que
  `min-h-tap`, y lo vigila `coherencia.test.ts` leyendo la clase **propia** de cada
  `<button>` y cada `<Link>` —la de dentro no, que un icono de `size-5` está bien—.
- **Los 44 px valen también fuera de la aplicación y dentro de un SVG.** Es donde
  se escaparon: la portada no pasa por `ui/Screen` ni por `ui/Button`, y su barra
  tenía enlaces de veinte píxeles y un «Abrir» de veintiséis; las veinticuatro
  casillas de la rueda de quintas son botones dentro de un `foreignObject`, así
  que ni el test que lee las clases ni nadie las medía, y las del anillo pequeño
  estaban en veintinueve. Ahora, en un teléfono, salen a sesenta y cinco y a
  cuarenta y cinco. **En un escritorio el anillo pequeño se queda en treinta y
  seis, y se acepta**: ahí se apunta con un ratón, y dos anillos de doce con
  casillas de cuarenta y cuatro pedirían una rueda de seiscientos píxeles que no
  cabe en ninguna de las tres pantallas donde vive.
- **Un mando se tabula una vez y se recorre con las flechas.** La rueda de
  quintas pedía veinticuatro turnos del tabulador —doce mayores y doce menores—,
  así que entrar en componer con el teclado y llegar a la lista de acordes era un
  viaje. Ahora hay una sola parada —la tonalidad puesta, o el Do de arriba— y las
  flechas hacen el resto: izquierda y derecha giran **dentro de su anillo**, arriba
  y abajo cambian de anillo sin moverse de sitio. Y la rueda deja de ser
  `role="img"` donde se pulsa: los hijos de una imagen son decoración por
  definición, así que veinticuatro botones dentro de un `img` es decir que no hay
  nada que tocar. En la portada, donde no se pulsa, sigue siendo una imagen.
- **Centrar a lo alto se hace con `my-auto` en el hijo, no con `justify-center`
  en la caja que se desplaza.** Es la trampa clásica de flexbox y aquí mordió: con
  `justify-content: center`, cuando el contenido no cabe se sale por los dos lados
  y el desplazamiento no llega a lo que sobra —el navegador ni siquiera lo cuenta
  en el `scrollHeight`—. En un portátil de 640 px con el micro abierto, el medidor
  de señal y los dos avisos del afinador quedaban debajo del borde y **no había
  forma de bajar hasta ellos**. Con el margen automático, se centra cuando sobra
  sitio y se desplaza cuando falta.
- **Se puede saltar a lo que importa.** La primera parada del tabulador es un enlace
  al contenido, oculto hasta que se enfoca. Sin él costaba ocho paradas llegar a
  `<main>`, y se repetían en cada página.
- **La pantalla llega a los cantos, así que hay que apartarse del hueco.** El
  `viewportFit: 'cover'` de `app/layout.tsx` es lo que hace que el tapizado de la
  barra de abajo no muera en una franja del color del sistema; a cambio,
  `env(safe-area-inset-*)` deja de valer cero y `AppShell` lo usa dos veces: abajo
  en la barra de pantallas y a los lados en el marco, para el hueco de la cámara
  con el teléfono tumbado.
- Los iconos son de `ui/icons.tsx`: **emoji no**, que no se tiñen. Y **con
  etiqueta**: un botón que solo lleva dibujo pide `aria-label`, y si además cabe
  el texto al lado, mejor el texto. Se dibuja lo que se reconoce por la forma
  —grabar, parar, cerrar, descargar, tirar— no lo que hay que descifrar.
- **Los títulos de pantalla van en la serif** (`font-display`), la misma de la
  portada.
- **La monoespaciada es para lo que se alinea en columna, no para la interfaz.**
  Notas, cifrados, cents, hercios, compases, XP, un correo: cosas que se comparan
  dígito a dígito o que crecen y encogen sin descolocar lo de al lado. Todo lo
  demás va en la sans.

  Esta regla llegó tarde y costó cara. La monoespaciada se había extendido a la
  navegación, a las pastillas, a los rótulos de apartado, a los botones y a los
  enlaces de vuelta —cerca de cien sitios—, y con ella la aplicación entera se
  leía como la salida de un terminal: media pantalla en letra de máquina de once
  píxeles. Los rótulos de apartado, además, iban en **versalitas con separación**
  —`font-mono text-xs tracking-widest uppercase`, escrito a mano en diecinueve
  ficheros—, que es la combinación más rápida que hay para que algo parezca un
  panel de administración de hace diez años. Ahora hay una sola clase, `.rotulo`,
  y es la sans a 12 px con peso.

  Lo que sí conserva la mono es el **contenido** de una pastilla cuando _es_ un
  dato: se pasa `font-mono` desde donde se usa, que es una decisión por sitio y no
  por componente.

- **Un estado vacío no es una frase gris en medio de la nada.** Se pinta con
  `ui/Vacio`, que pide tres cosas: un dibujo —para que el hueco parezca a propósito
  y no un fallo de carga—, un título con lo que falta, y **la acción**. Pedir sin
  ofrecer dónde es la manera más corta de dejar a alguien parado: componer decía
  «elige una tonalidad en la rueda» en mitad de setecientos píxeles de negro, con
  la rueda al lado sin parecer pulsable. Dos tamaños: el `normal` es el que ocupa
  una pantalla y el `discreto` el que va al final de una columna que ya tiene
  contenido, donde el grande dejaba la acción por debajo del pliegue.
- **La profundidad se usa, no solo se declara.** `globals.css` tenía
  `.superficie`, `.superficie-alta` y `.superficie-viva` desde el principio —«lo
  que da modernidad no es más color, es que se note qué está encima de qué»— y
  las pantallas que más se miran no usaban ninguna: componer y el camino eran tres
  columnas sobre el mismo negro separadas por una línea de un píxel, que de lejos
  es una pared. Ahora **lo que se consulta va sobre `surface` y donde se trabaja
  sobre el fondo**, y lo que se mira de cerca lleva su relieve: la partitura es
  una hoja, cada forma de acorde una tarjeta, cada cuerda del afinador una pieza.
- **Y un panel puede callarse el rótulo.** `ui/Panel` con `rotuloOculto` deja el
  título como nombre de la región y se ahorra la franja: el afinador vive en una
  pantalla que se llama «Afinar», y encima del aparato ponía otros cuarenta y
  cuatro píxeles con la palabra «Afinador». Eso es chapa, no información.
- **Un botón que trabaja lo dice, y no solo con el rótulo.** `cargando` en
  `ui/Button` pone la ruedecilla y marca `aria-busy`. Hace falta porque lo que más
  tarda aquí son las llamadas al modelo, que se pasan varios segundos: cambiar el
  texto a «Pensando…» y nada más deja dudando de si se ha pulsado. La ruedecilla
  va con `motion-safe`, así que quien pide menos movimiento no ve un arco parado
  —la regla global congela toda animación a 0,01 ms—; le queda el rótulo, que dice
  lo mismo.
- **Lo que corrige no se apaga.** Al contestar una pregunta, las opciones se
  desactivan, y el `disabled:opacity-40` las dejaba todas al cuarenta por ciento:
  la acertada en verde y la fallada en roja son justo lo que hay que leer
  entonces. `ui/Chip` apaga solo lo que ya no dice nada.
- **La acción de una pantalla se ve como una acción.** El candado de plan tenía su
  única salida escrita en un enlace subrayado de doce píxeles, más pequeño que el
  aviso que la pedía. `ui/PlansLink` tiene dos formas y la de botón es la de casa;
  la de enlace se queda para la palabra suelta dentro de una frase.

## Los dos temas

**El oscuro es el de casa.** El claro se elige y se guarda; volver al oscuro borra
la preferencia. No cuelga de `prefers-color-scheme` a propósito.

**Los dos son la misma paleta con la luz encendida y apagada**: grafito frío y
ámbar de noche, blanco hielo y el mismo ámbar de día
([adr/0027](adr/0027-grafito-y-ambar.md)). Y de ahí sale la regla que hay que
tener delante al colocar una caja: **subir es acercarse a la luz en los dos
temas** —lo vigila `ui/tokens.test.ts`—. El tema claro iba al revés, con blanco
puro abajo y grises cada vez más sucios encima, o sea que cuanto más importaba una
caja, más apagada se veía ([adr/0026](adr/0026-el-blanco-hielo.md)).

**El fondo es frío y el acento es cálido, y ese contraste es el diseño.** El ámbar
es lo único que tiene temperatura en toda la pantalla, y es eso lo que lo hace
visible sin subirle la saturación. Cuando el fondo era negro cálido, la aplicación
entera caía en el mismo cuarto de la rueda de color y el acento solo destacaba por
claridad, que es la mitad del trabajo que tiene que hacer un acento. Vale para los
dos temas: en claro, el gris frío hace el mismo papel que el grafito.

**Los nombres de los tokens vienen de un amplificador que ya no está.** `brass`,
`oxblood` y `tube` salieron de la idea original —uno de válvulas visto de noche— y
se quedan, porque lo que nombran no es un color sino un papel: el acento, lo que va
mal y lo que va bien. Ningún componente sabe qué tema hay puesto ni de qué color es
`brass` hoy.

Los nombres de los tokens no cambian entre uno y otro —`brass` es «el acento»
valga lo que valga—, así que ningún componente sabe qué tema hay puesto. Pero un
color nuevo se comprueba en los dos fondos.

**Un color con el que se escribe tiene que llegar a 4,5:1** sobre los tres fondos
—`background`, `surface` y `surface-alta`—, y lo comprueba `ui/tokens.test.ts` en
los dos temas. La regla se escribió tarde: el tema claro se hizo con ella delante
—el dorado bonito de las paletas se descartó por no llegar sobre blanco— y al
oscuro, que es el que sale por defecto, no se le pasó la misma vara. Su rojo daba
**2,26:1** y era el color de veinticuatro mensajes de error.

De ahí sale la otra mitad, que el sistema ya seguía sin tenerla dicha: **los
colores van en pares y el papel está repartido**. `oxblood` y `tube` rellenan
—el tapizado del botón de escuchar, la barra de lo que llevas hecho— y
`oxblood-bright` y `tube-bright` son los que se leen; `brass-dim` es adorno y no
es ninguna de las dos cosas. Que no se escriba con los tres primeros lo vigila
`app/screens/coherencia.test.ts`, porque si no la excepción sería una puerta
abierta: un `text-tube` y ya hay un texto por debajo del mínimo con los dos
guardianes en verde.

**El código de tres estados lleva forma, no solo color.** Aquí hay dos códigos que
usan verde, ámbar y rojo —si un acorde entra en la tonalidad, y qué papel armónico
tiene— y verde contra rojo es justo la pareja que no distingue la deficiencia de
color más común, que le pasa a uno de cada doce hombres. Se dibuja con `ui/Marca`:
**círculo lleno, anillo y rombo**, y así la marca se lee sin ver el color. Que
nadie vuelva a pintar el punto a mano lo vigila `ui/tokens.test.ts` leyendo los
ficheros.

Las aplicaciones que se apoyan en el color para esto lo resuelven por el otro
lado: [Hooktheory](https://www.hooktheory.com/support/hookpad) envía cinco
paletas, dos de ellas pensadas para daltonismo, y Yousician tiene un interruptor
en ajustes. Con forma sale más barato y no hay nada que configurar ni una paleta
más que mantener en dos temas.

**Lo que se elige una vez se pliega en cuanto está elegido.** La tonalidad y la
afinación se tocan al empezar y no se vuelven, así que abiertas se comen la parte
alta de la pantalla —que es donde tiene que estar lo que se mira mientras se
toca—. Se abren solas mientras falten, con `abierto` de `ui/Disclosure`, y se
cierran a una línea que dice cuál está puesta. Lo usan componer, la unidad, el
afinador y el profesor.

**La profundidad se pide por su nombre**: `.superficie`, `.superficie-alta` y
`.superficie-viva` en `globals.css` —fondo, borde, radio, filo de luz y sombra en
una clase—. Nada de cajas con `border` suelto: un tema oscuro sin relieve se lee
plano, y lo que da modernidad es que se note qué está encima de qué.

**Y un panel necesita que el fondo de debajo no sea el suyo.** `.superficie` es
casi blanco en el tema claro, así que puesto sobre una franja blanca se queda
dibujado por su borde y no se eleva. Le pasó a la portada al alternar franjas: el
que manda en el reparto no es el orden de las secciones, es **lo que llevan
dentro**. No lo vigila ningún test; se ve mirando la página.

## El movimiento

**Lo que depende del scroll se hace con `animation-timeline`, no con
JavaScript.** Es lo que evita el rodeo entero de un `IntersectionObserver`: para
que algo aparezca, un observador tiene que pintarlo invisible primero, y eso deja
media página en blanco en un navegador sin JavaScript. Y degrada solo: donde no
está soportado, la duración es `auto` —que computa a cero— y con `both` el
elemento se queda en el último fotograma, o sea visible. No hace falta un
`@supports`.

**Quien pide menos movimiento no recibe ninguno, y eso incluye el retardo y la
línea de tiempo.** La regla de `prefers-reduced-motion` anula las cuatro cosas:
duración, repeticiones, transiciones y —desde
[adr/0026](adr/0026-el-blanco-hielo.md)— `animation-delay` y `animation-timeline`.
Las dos últimas hacían falta porque sin ellas apagar el movimiento apagaba el
contenido: un trozo con 240 ms de retardo se queda transparente ese cuarto de
segundo, y una animación atada al scroll no la mueve una duración de 0,01 ms, así
que se queda en el primer fotograma para siempre.

Y GSAP no ve esa regla, porque escribe el transform él mismo: quien anime con GSAP
pregunta en `ui/motion.ts`.

Y una de las de media hora: **`color-scheme: dark` en `:root`** es lo que hace que
el navegador pinte en oscuro lo que dibuja él y no nosotros —la lista de un
`<select>`, la barra de scroll, el cursor—. Sin esa línea aparecen parches blancos
que no se arreglan con ninguna clase de Tailwind.

## Los tests

- Vitest corre en **entorno `node` por defecto**. Un test que necesite DOM lleva
  `// @vitest-environment jsdom` en la primera línea.
- `include` es `src/**/*.test.ts(x)`: los tests viven al lado del código.
- `src/audio/main-thread-cost.test.ts` es un guardián de rendimiento con topes
  holgados a propósito. Si falla, es una regresión algorítmica, no ruido.
- **Nada toca Postgres.** Lo que se prueba de las cuentas es lo puro: planes,
  permisos, fusión de avances, cola de repaso, cifrado. El camino con base de datos
  se ha ejecutado a mano dos veces y las dos salieron fallos que ningún test veía.
- **Los tests que leen ficheros son a propósito.** `coherencia.test.ts` y
  `esquema-ideas.test.ts` comprueban cosas que solo se ven en conjunto —que ninguna
  pantalla se escriba su propio ancho, que ninguna ruta gaste cupo por su cuenta—.
  Son feos y han cazado lo que ningún test unitario podía.
