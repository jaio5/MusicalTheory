# ADR 0034 — Tres maneras de escribir, y una sola canción

Fecha: 2026-09-17 · Estado: aceptada · Amplía: [ADR 0032](./0032-la-progresion-y-el-montaje-son-lo-mismo.md)

## Contexto

Componer aquí se puede hacer de tres maneras, y las tres están construidas:

- **Tocando.** El motor de croma dice qué acorde suena y cuánto dura
  (`captureProgression`), el de tono dice qué notas suenan (`captureMelody`), y
  `partFromCapture` lo convierte en una parte con sus bloques y su punteo.
- **Por bloques.** Arrastrar, estirar, mover entre partes.
- **En la partitura.** Escribir las notas y los cifrados directamente, que es la
  otra piel de lo mismo ([ADR 0019](./0019-punteos-y-partitura.md)).

El problema no es que falte nada: es **que la primera no se encuentra y va en dos
tiempos**. Está detrás de un botón dentro de la barra del lienzo, se llama
«apuntar», y cuando paras hay que pulsar además «traer lo grabado» para que lo
que has tocado entre en la canción. Quien abre la pantalla no descubre nunca que
puede componer tocando; y quien lo descubre tiene que acordarse de dos pasos.

Y hay una segunda costura: **grabar el sonido es otra herramienta que no se
entera de nada.** La grabadora vive en su pestaña, guarda su toma, y la
transcripción vive en el lienzo. Son la misma acción —tocar algo y quedárselo—
partida en dos sitios que no se hablan. Eso importa porque la transcripción
**pierde cosas a propósito y está documentado**: dos notas iguales seguidas se
funden, el croma olvida la octava, no hay dinámica ni ligaduras. La toma de audio
es justo lo que repara esa pérdida, y hoy no está al lado de lo que transcribió.

## Decisión

**Las tres maneras son tres entradas a la misma canción, y se dicen como tales.**
`Tocando` sube a la barra de arriba como espacio de trabajo, al lado de
`Escribir`. No es una vista distinta de la canción: es otra forma de escribir en
ella.

- **Un solo gesto.** Se pulsa una vez y pasan las tres cosas: se abre el micro,
  **se graba el sonido** y se empieza a apuntar lo que suena. Se pulsa otra vez y
  lo tocado entra en la canción como una parte, con sus acordes, sus duraciones y
  su punteo. Se acabaron los dos pasos.
- **Se ve crecer mientras suena.** El acorde que se está oyendo, los compases que
  llevas y el tiempo. Sin eso, tocar contra una pantalla quieta es tocar a
  ciegas y no saber si te está oyendo.
- **La toma se queda pegada a la parte que creó.** Al lado de lo transcrito, para
  poder comparar lo que sonó con lo que se escribió. No se guarda en el montaje
  —un montaje es dominio puro y no sabe de audio— sino en `state/`, por
  identificador de parte, y se suelta al salir.
- **De ahí se sigue por donde se quiera.** La parte recién creada se edita por
  bloques o en la partitura, que ya son dos pieles de lo mismo.

**El audio sigue sin salir del equipo.** Se graba para poder oírlo y descargarlo,
como ya hacía la grabadora; a la IA siguen viajando símbolos. La regla 4 no se
negocia.

## Alternativas descartadas

**Dejarlo donde está y solo hacerlo más visible.** Un botón más grande no arregla
que sean dos pasos ni que la grabación vaya por otro lado. Y el sitio importa: un
botón dentro de la barra del lienzo dice «esto es una herramienta del lienzo»,
cuando es una de las tres formas de empezar.

**Construir la partitura nota a nota mientras suena**, en vez de al parar. Es lo
que promete la frase «se va construyendo», y no se puede hacer honestamente con
este motor: la transcripción **necesita el tramo entero** para fundir las notas
repetidas, elegir la figura y cuadrar los compases contra el tempo. Escribiendo
al vuelo habría que reescribir lo ya escrito cada pocos cientos de milisegundos,
y lo que se vería es una partitura que se corrige sola mientras la miras. Lo que
sí se hace en vivo es **decir que te está oyendo**: el acorde, los compases y el
tiempo.

**Una sola apertura de micrófono para analizar y grabar.** Sería lo correcto, y
no se hace ahora: analizar vive en `audio/` y grabar en `media/`, cada uno con su
`getUserMedia`, y juntarlos significa que las dos capas compartan un
`MediaStream`. Es un cambio de fontanería que merece su propio paso; abrir dos es
lo que hace hoy quien usa las dos herramientas a la vez, así que no empeora nada.
Queda escrito en el roadmap para no perderlo.

**Que tocar cree una canción nueva en vez de una parte.** Rompería lo que se
gana: se toca una idea, entra como parte, y al lado están las que ya había. Una
canción nueva por cada toma obliga a juntarlas a mano después.

## Consecuencias

- Hay un espacio de trabajo más, y los tres —`Tocando`, `Escribir`, `Ensayar`—
  son modos de la misma pantalla y de la misma canción.
- `state/` gana las tomas por parte, en memoria y sin persistir: una toma es un
  blob y un blob retenido es memoria que no vuelve.
- La grabadora deja de ser el único sitio donde se graba, pero no desaparece:
  sigue valiendo para grabarse tocando algo que no se quiere transcribir.
- Sigue faltando un micrófono compartido entre `audio/` y `media/`. Está en el
  roadmap y no se disimula.
