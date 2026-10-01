# ADR 0072 — La claqueta suena toda la toma

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
