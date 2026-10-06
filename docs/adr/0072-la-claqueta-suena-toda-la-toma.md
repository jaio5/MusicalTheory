# ADR 0072 — La claqueta suena toda la toma

> **Ampliado más abajo, en «Ampliación: el primer acorde»**. Lo que dice de la pantalla sencilla es historia: [ADR 0095](./0095-se-quita-componer-sencillo.md) la quitó.
>
> **Ampliado por [ADR 0082](./0082-ensayar-cuenta-dos-compases-con-el-mismo-metronomo.md):** Ensayar cuenta también dos compases con el mismo metrónomo y marca la toma en la claqueta.

Fecha: 2026-10-01 · Estado: aceptada · Sustituye en parte a
[ADR 0053](./0053-la-claqueta-cuenta-y-se-calla.md), que la callaba al empezar a apuntar

## Contexto

Quien toca quiere pulso mientras toca, y quiere tocar sin un tope de compases. El
[ADR 0053](./0053-la-claqueta-cuenta-y-se-calla.md) callaba la claqueta porque el
micro la oye, y con razón: la onda cuadrada de antes metía un Si 5 en los
silencios y partía las notas largas en cada pulso. Pero «callarla» era taparlo
por el lado equivocado: el problema no es que suene, es **cómo suena**.

Había además un tope escondido. El historial de notas guarda 24 entradas
(`NOTE_HISTORY_LIMIT`, `state/session-store.ts`), y un punteo largo se quedaba en
sus últimas notas sin que nada lo dijera.

Medido antes de cambiar nada: un punteo de 20 notas daba 3, 3 y 2 de 20 en
altura, ataque y duración; la rítmica C–Am–F/G–C, 0 de 5 acordes.

## Decisión

**El clic se ataca por su timbre y no por su instante**, en tres capas:

1. **Un golpe de ruido filtrado por encima de 4,5 kHz** (`audio/metronome.ts`,
   `audio/biquad.ts`). El ruido no tiene periodo, así que la autocorrelación no
   encuentra nada que leer, y cae fuera de la banda que miran los motores.
2. **Dos pasos bajos de 3 kHz delante de los analizadores**
   (`audio/web-audio-input.ts`). Lo grabado para oírlo no pasa por ellos.
3. **La regla del ataque de `melody.ts`**: el nivel tiene que volver a la mitad
   del golpe inicial para que cuente como un ataque nuevo.

Y alrededor:

- **Volumen y apagado del clic con la rejilla intacta** (`state/claqueta.ts`).
  Quitarlo no para el pulso: el metrónomo cuenta en silencio.
- Se siguen contando dos compases, y el compás uno cae **un pulso después del
  último clic**, como en el ADR 0053.
- **Cada análisis se guarda durante la toma** (`subscribeFrames`), así que lo
  apuntado ya no depende de las 24 entradas del historial.
- **Tope de seguridad a los diez minutos**: la toma se para sola y escribe lo
  tocado.
- Una toma larga se reparte en partes de 64 notas o de 32 bloques, cortando en
  barra.
- Las cuatríadas se escriben como tríada, y el motor de acordes mira el espectro
  hasta 1000 Hz y confirma por fundamental más tríada.

## Consecuencias

Hay pulso durante toda la toma. **Cambia el sonido del clic también en la barra y
en Ensayar**, porque es el mismo.

Medido en Chromium con una guitarra Karplus-Strong y el clic de la aplicación
sumado a 0,6: el punteo da 20/20/20 sin notas fantasma; la rítmica, 4 de 5
acordes, 4 de 5 cambios en su pulso y 3 de 5 duraciones. Con el clic más fuerte
que la cuerda (1,5): 20/20/20 en un pase y 20/18/18 en otro. Lo fija
`audio/toma-sintetica.test.ts`. La memoria sale a unos 127 B por análisis: 1,5 MB
en diez minutos.

El clic se oye en lo descargado si sale por los altavoces. El metrónomo de la
barra se calla y se bloquea mientras hay toma. El lector de pantalla no habla
durante la toma, porque el micro le oiría.

**Lo que no aguanta:** el La menor abierto se lee Esus4 o C6 y se escribe Do
marcado como dudoso; no hay tresillos ni ligaduras porque el modelo no los tiene;
la latencia de entrada del micro no se descuenta; y los retrasos de 40 y 520 ms
están calibrados con una guitarra sintética, no con una de verdad.

De paso se arregló que `addNote` (`core/music/arrangement.ts`) tiraba `clarity`:
la duda de las notas no llegaba a la partitura.

## Alternativas descartadas

**Enmascarar una ventana alrededor de cada clic.** Es la objeción del propio
[ADR 0053](./0053-la-claqueta-cuenta-y-se-calla.md): se pierden los ataques que
caen en el pulso, y la latencia entre altavoz y micro varía.

**Un tono puro agudo.** Un seno de 3 kHz se repite también a 1 kHz, y la
autocorrelación lo toma por una nota.

**Pedir auriculares.** No se puede comprobar, y la aplicación no debería fallar
según lo que lleve puesto quien toca.

**Analizar la grabación entera al parar.** Son unos 115 MB en diez minutos y
segundos de espera.

**Seguir callándola.** Lo descarta quien la usa: tocar sin pulso es lo que se
quería quitar.

## Ampliación: el acorde que ya suena al empezar es el primero

**Contexto.** El croma solo avisa cuando el acorde cambia. Quien rasguea durante la
cuenta ya tiene el acorde puesto al llegar el compás uno, y como no cambia, no se
volvía a decir: con un WAV de C G Am F empezado dos pulsos antes de «¡Ahora!», la
toma escribía «G Am F». **De 6 tomas, 0 salían con el Do** en las pantallas sencilla y
completa (la sencilla ya no existe).

**Decisión.** `startCapture` acepta `conElQueSuena` (`state/session-store.ts`) y lo
piden las tomas con cuenta:

- Si hay un acorde oído **y el nivel es al menos 0,006** (`NIVEL_QUE_SUENA`), entra
  como el primero en el compás uno. El nivel es la prueba de que suena: el croma
  compara formas y no tamaños, y en silencio sostiene el último acorde.
- Su instante es el compás uno más lo que tarda el motor en decir un acorde, que es
  lo que la rejilla le descuenta a todos: cae en el pulso cero, nunca antes.
- **No se duplica**: si el croma vuelve a decir el mismo (`mismoAcordeOido`, misma
  fundamental y misma tríada), se queda el que había con la peor duda de los dos.
- **Si dice otro anterior al compás uno, el que sonaba se sustituye.**
- Los botones que apuntan sin cuenta no lo piden: no hay compás uno en el que
  ponerlo.

**Consecuencias.** Medido en Chromium con el mismo WAV, tres pasadas: **de 0 a 6 de 6
tomas** salen con el Do. Las que empezaban en «¡Ahora!» siguen en C G Am F, sin un Do
de más.

**Alternativas descartadas.**

**Apuntar siempre el acorde oído al empezar, sin mirar el nivel.** En silencio el
croma sostiene el último acorde, y se escribiría uno que nadie tocó.

**Ponerlo en el instante en que se pulsa «Tocar».** Cae antes del compás uno y la
rejilla o lo recorta o corre todo lo que viene detrás un pulso.
