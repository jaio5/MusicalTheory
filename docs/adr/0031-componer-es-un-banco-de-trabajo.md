# ADR 0031 — Componer es un banco de trabajo, no dos caras

Fecha: 2026-09-17 · Estado: aceptada · Revisa: [ADR 0018](./0018-el-lienzo-de-montar.md) y la vista doble de [ADR 0019](./0019-punteos-y-partitura.md)

## Contexto

[ADR 0018](./0018-el-lienzo-de-montar.md) partió `/componer` en dos caras con un
conmutador porque la pantalla no daba más de sí, y lo dijo con una frase que
sigue siendo verdad:

> No hay reparto bueno en un portátil: son cinco franjas peleando por el mismo
> alto.

La decisión fue correcta y el lienzo de montar es lo mejor que tiene hoy esta
pantalla. Pero el conmutador tiene un precio que se paga en cada sesión, y con
el uso se ha visto cuál es: **las dos preguntas de componer no son sucesivas,
son simultáneas**. «Qué acorde tengo delante» y «cómo va mi canción» se contestan
a la vez, con la guitarra puesta, y hoy hay que elegir cuál se mira. Se escribe
en `Montar`, se salta a `Tocar` para ver las formas de un acorde, y al volver hay
que reencontrar dónde se estaba.

Encima, la barra de herramientas se abre **encima** del contenido y se lleva la
mitad de la pantalla: mientras miras el mástil no ves la canción para la que lo
miras, y mientras pides ideas no ves dónde van a entrar. Es el mismo problema
otra vez, un piso más abajo.

Y el reparto sigue siendo fijo. Las tres columnas miden `16rem / 1fr / 19rem` en
`lg` y `20rem / 1fr / 23rem` en `xl`, lo elija quien lo elija. En una pantalla de
2560 px sobra sitio en los lados y falta en el centro; en una de 1366 pasa lo
contrario.

## Decisión

**Una sola pantalla dividida en áreas que se arrastran, y la disposición se
recuerda.** Cuatro áreas con cabecera propia y fina: lo que decides (tonalidad,
escala, estilo, afinación), lo que haces (el arreglo, y debajo a dónde ir y el
copiloto), lo que hay seleccionado (el acorde con sus formas) y un área inferior
con selector de tipo (mástil, ideas, sesiones, cerrada).

Tres cosas que hacen que esto no sea la cuadrícula de antes con otro nombre:

- **El reparto lo decide quien mira.** Divisores de 6 px de agarre y 1 px
  pintado, con tope mínimo por área y doble clic para volver al preset. Lo que
  antes era un número escrito en un `grid-cols` pasa a ser una preferencia.
- **Los controles de una cosa viven en esa cosa.** Cada área lleva su cabecera con
  su nombre y sus dos o tres mandos, en vez de un ajustes común donde hay que
  buscar de qué es cada interruptor.
- **Los espacios de trabajo son modos, no solo disposiciones.** `Tocando`,
  `Escribir` y `Ensayar` cambian a la vez el reparto y lo que la pantalla hace,
  que es lo que da una razón para volver: escribes una progresión y luego la
  tocas contra el metrónomo.
- **Cada espacio trae su reparto de fábrica, y las áreas se pliegan.** Es lo que
  arregla el problema que apareció en cuanto estuvo montado: con las cinco áreas
  abiertas la pantalla se lee como un panel de control —cinco cosas pidiendo la
  mirada y ninguna mandando—. Tocando hacen falta la rueda y el botón;
  escribiendo, la canción, a dónde seguir y el acorde; ensayando, solo la
  canción. Lo que sobra queda en una tira con su icono, a un clic de volver, y
  lo que se mueva se recuerda **por espacio**. Quien no quiera montarse nada no
  tiene que tocar un divisor en su vida; quien quiera, tiene «Reordenar» para
  volver a como venía.

**Lo que 0018 decidió sigue en pie.** El lienzo de bloques, las duraciones, las
partes con su papel y las dos vistas del punteo de [ADR 0019](./0019-punteos-y-partitura.md)
no se tocan: cambian de sitio, no de naturaleza. Lo que se retira es **el
conmutador**, porque el motivo por el que existía —no hay reparto bueno— deja de
ser cierto cuando el reparto se puede mover.

**Y por debajo de 1024 px no hay banco de trabajo, y no se disimula.** Una
columna con pestañas abajo, donde llega el pulgar, igual que el resto de la
aplicación en pantalla estrecha. Áreas redimensionables con el dedo es lo que
convierte un editor en una pelea.

## Alternativas descartadas

**Quedarse con la cuadrícula fija y solo repartir mejor los anchos.** Es lo más
barato y no arregla nada de lo de arriba: el reparto seguiría siendo el que
alguien escribió una vez, y la barra de herramientas seguiría tapando. Además ya
se probó en la práctica —los `lg:` y los `xl:` de hoy son el segundo intento— y
el resultado es que en un tamaño va bien y en los otros dos va regular.

**El tablero libre de Blender: partir y unir áreas donde sea.** Es la potencia de
verdad y aquí nadie la pide. A cambio trae dos problemas seguros: se puede dejar
la pantalla rota y no saber volver, y obliga a un modelo de disposición
recursivo —árbol de divisiones— con su serialización y sus casos límite. Esto se
tiene que entender en treinta segundos con la guitarra puesta. Cuatro áreas y
tres presets dan el noventa por ciento del beneficio por el diez por ciento del
coste.

**Mantener las dos caras y arreglar solo el cajón de herramientas.** Tentador,
porque el cajón es el que más molesta. Pero deja intacto el problema de fondo: el
acorde y la canción siguen sin verse a la vez, que es justo lo que hace falta
para componer. Habría sido arreglar el síntoma más ruidoso y dejar el motivo.

**Modales para lo que no cabe.** Un «ajustes del arreglo» en una ventana encima
resuelve el sitio a cambio de partir la tarea en dos pantallas. En un editor que
se usa con las manos ocupadas, cada modal es una interrupción y un sitio del que
hay que acordarse de salir.

## Consecuencias

- La disposición pasa a ser estado que se guarda, y va a `state/workspace.ts`,
  que ya tolera campos nuevos sin romper lo guardado.
- Hay una invariante nueva: el banco ocupa el alto exacto de la ventana y lo que
  no cabe se encoge o se desplaza **dentro de su área**, nunca en el documento.
  Eso ya lo garantiza el marco, y la sonda del skill `arrancar` lo vigila.
- El conmutador `Tocar`/`Montar` desaparece de la interfaz y de los tests que lo
  nombran.
- Los atajos de teclado pasan a ser parte del producto y no un extra: si las
  áreas se encogen, tiene que haber una tecla que las devuelva.
