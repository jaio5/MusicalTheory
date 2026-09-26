# ADR 0053 — La claqueta cuenta dos compases y se calla

Fecha: 2026-09-26 · Estado: aceptada · Sostiene [ADR 0019](./0019-punteos-y-partitura.md) y [ADR 0049](./0049-la-rejilla-llega-a-la-semicorchea.md)

## Contexto

Al grabar no había pulso. Se pulsaba «Tocar», el micro se abría y desde ese
instante se apuntaba, y **la transcripción convertía lo tocado con el `bpm` de los
ajustes**: `apuntar-lo-tocado.ts` divide el tiempo entre `msPerBeat(bpm)` para saber
cuántos pulsos dura cada acorde y en qué figura cae cada nota.

Eso da por hecho algo que nadie había garantizado: que lo que toques va a ese
tempo. Si el ajuste dice 100 y tocas a 112, cada nota cae un poco más adelante que
la anterior, y al cabo de unos compases la rejilla escribe cualquier cosa. Y no
había manera de acertar, porque **no se oía nada a lo que agarrarse**.

De aquí cuelga todo lo demás de la partitura. La rejilla de la semicorchea
([ADR 0049](./0049-la-rejilla-llega-a-la-semicorchea.md)) y las figuras
([ADR 0019](./0019-punteos-y-partitura.md)) están bien medidas, pero miden contra un
origen y un tempo: si el tempo es una suposición, la precisión de la rejilla es
precisión falsa.

Y hay un problema físico que condiciona la solución: **el clic sale por los
altavoces y el micro lo oye.** Una claqueta sonando durante la toma entra en el
análisis como un golpe de onda cuadrada en cada pulso, justo donde caen los ataques
que hay que reconocer.

## Decisión

**Dos compases de cuenta atrás, y al empezar a tocar se calla.**

- **Suena antes, no durante.** Resuelve la fuga del todo y sin pedirle nada a
  nadie: no hay clic que descontar porque no hay clic mientras se graba.
- **Dos compases y no uno.** Uno da cuatro golpes para coger el pulso y colocar la
  mano, y con tomas cortas eso se queda justo.
- **El tempo sale del ajuste que ya hay.** Es el mismo con el que después se miden
  los pulsos, así que dos sitios donde elegirlo serían dos tempos para la misma
  toma.
- **Y se ve además de oírse.** Dos compases de espera sin nada en pantalla no se
  leen como «prepárate», se leen como que la aplicación se ha quedado colgada.

**Lo que se apunta empieza donde cae el compás uno, que es un pulso después del
último clic.** No es un detalle: el tramo se mide desde ese instante
—`captureStartedAt`— así que poner el origen en el último clic desplaza la canción
entera un pulso y la primera nota sale en el segundo pulso del primer compás. Lo
calcula `state/cuenta-atras.ts` y hay un test que lo fija.

**La cuenta va con el micro abierto y antes de grabar el sonido.** Antes del micro
no puede ir, porque abrirlo pide permiso y puede tardar: la cuenta se quedaría
sonando mientras el navegador pregunta. Y antes de grabar porque así **la claqueta
no entra en la toma**: el audio que se descarga empieza donde empiezas a tocar.

**Si la claqueta no puede sonar, no se espera a nada.** Un metrónomo que no arranca
dejaría la grabación colgada en la cuenta, y eso no se parece a un fallo: se parece
a que la aplicación se ha quedado pensando.

**Y cortarla es un camino propio.** Pulsar el botón durante la cuenta la corta y no
escribe nada. Sin eso pasaba por apuntar lo tocado —que es nada— y contestaba «no
he podido leer nada», que es culpar a quien solo ha cambiado de idea.

## Consecuencias

La rejilla pasa a medir contra un tempo que quien toca ha oído. De eso cuelgan las
figuras, los compases y los silencios que vienen después.

Grabar cuesta dos compases más. Es el precio, y es el que se paga en cualquier
programa que grabe contra una rejilla.

**Lo que esto no arregla, y hay que medirlo tocando**: la claqueta se calla, así
que **se puede seguir yendo de tempo** mientras la transcripción sigue creyéndose
el ajuste. Con tomas de cuatro u ocho compases la deriva debería ser pequeña, pero
eso es una suposición hasta que se pruebe con una guitarra delante. Si se va, las
salidas son las dos que aquí se descartan: dejarla sonar con auriculares, o detectar
el tempo de verdad.

## Alternativas descartadas

**Que siga sonando y se pidan auriculares.** Es lo que hacen los programas de
grabación, y da pulso durante toda la toma, que es lo único que evita la deriva del
todo. Se descarta porque **el navegador no puede comprobar si los llevas puestos**:
solo se puede pedir, y una petición que no se puede verificar convierte el caso
normal —altavoces— en un fallo silencioso que se lee como «el reconocimiento va
mal». Y esta aplicación tiene que servir con el micro del portátil y una acústica
delante, que es el caso donde la fuga es peor.

**Que suene y se descuente del análisis.** La aplicación sabe cuándo suena cada
golpe, así que podría ignorar esos instantes. Se descarta porque los instantes que
habría que ignorar son **justo los pulsos**, que es donde caen los ataques: se
perdería la señal precisamente donde está la información.

**Detectar el tempo de lo que se toca** y no pedir ninguno. Es lo más cómodo y lo
que habría que hacer algún día. Se descarta ahora porque es un motor nuevo —no
existe detección de tempo en el proyecto— y porque no hace falta para lo que se
viene a arreglar: con una claqueta, el tempo deja de ser una suposición sin escribir
una línea de detección.

**Un compás de cuenta en vez de dos.** Más rápido para repetir tomas, y es lo que
se descartó a mano: cuatro golpes no dan tiempo a coger el pulso y colocar la mano.

**Dejarla como ajuste opcional.** Se descarta porque el ajuste que hay que ir a
encender es el que nadie enciende, y entonces el tempo vuelve a ser una suposición
en el caso normal. Si algún día molesta, se discute con la medida delante.
