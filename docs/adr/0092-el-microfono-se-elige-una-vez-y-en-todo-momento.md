# ADR 0092 — El micrófono se elige una vez, en todo momento y por su nombre

Fecha: 2026-10-03 · Estado: aceptada · Amplía
[ADR 0065](./0065-lo-que-se-abre-desde-una-fila-que-se-desplaza-es-un-popover.md)
(el `popover` vale también aquí, por otra razón) y
[ADR 0079](./0079-el-marco-se-monta-una-vez-y-el-micro-sobrevive-a-navegar.md) (el
micro es uno y lo sujeta `use-listening.ts`)

## Contexto

Solo el afinador dejaba elegir micrófono, con un `useState` suyo. Componer, las
unidades de oído y la toma abrían siempre el del sistema —con una tarjeta de sonido
enchufada, el del portátil— y al recargar el afinador también lo olvidaba. Dos
verdades sobre un mismo aparato.

Además, con el permiso en «solo esta vez» el navegador da **otro `deviceId` en cada
página**: lo elegido se perdía al recargar aunque el aparato siguiera enchufado
(medido en Chromium).

## Decisión

- **La elección es una y vive en `state/microfono.ts`**, un almacén propio y no un
  rincón de `session-store`: aquel tiene `reset()`, y empezar una sesión limpia no
  puede devolverte al micro del portátil. Se guarda en las preferencias
  (`microfono: {id, nombre}` en `workspace.ts`).
- **Se guarda el nombre además del identificador.** Si el identificador no está en
  la lista y una entrada se llama igual, es ésa y se guarda su identificador nuevo.
- **El mando es `features/workspace/ElegirMicro`, en la barra de todas las
  pantallas.** Cambiar con el micro abierto lo cambia en caliente
  (`cambiarDeMicro`, `state/use-listening.ts`); **durante una toma espera a que
  acabe**, porque un `MediaRecorder` no cambia de pista a mitad. Acabar es
  **soltar la entrada** (`sujetarLaEntrada`), después de que pare el grabador: la
  claqueta y la captura se sueltan antes, y con ellas solas el cambio llegaba con
  el grabador aún sobre la entrada vieja.
- **Se pide con `deviceId: { exact }`**, y si falla se abre el del sistema y se
  dice. La lista y la vigilancia de enchufar y desenchufar son de
  `audio/entradas-de-audio.ts` (`conocerEntradas`, `vigilarEntradas`, `pistaDe`).
- **El panel es un `popover`**, y no por la fila que se desplaza del 0065 —la barra
  no se desplaza—: un `Disclosure` mediría lo que su rótulo (un botón de 44 px) y la
  barra, con `backdrop-blur`, es un contexto de apilamiento que dejaría la lista por
  debajo de lo que flota. Por eso está en `DONDE_VALE` de `coherencia.test.ts`.

## Consecuencias

- Quien abra el micro lee la elección de aquí; quien monte otro selector tiene dos
  verdades otra vez.
- Si el aparato elegido no está, se escucha por el del sistema **y la barra lo dice**
  en vez de callarse.
- Sin permiso la lista no trae nombres; el mando lo dice.

## Alternativas descartadas

- **Dejarlo solo en el afinador.** Es lo que había, y componer grababa con un micro
  que nadie había elegido.
- **Un selector por pantalla.** Cuatro copias de lo mismo y cuatro elecciones que
  se contradicen.
- **Guardar solo el identificador.** Con «solo esta vez» cambia en cada página y la
  elección no sobrevive a recargar.
- **`deviceId: { ideal }`.** Sustituye en silencio un aparato ausente por otro, y la
  aplicación no podría decir que no escucha por el elegido.
- **Cambiar de pista a mitad de la toma.** `MediaRecorder` no lo admite, y el salto
  de nivel entre dos micros se leería como un ataque que nadie tocó.
- **Un `Disclosure` que flota** para el panel. Ver arriba: ancho de 44 px y capa
  de apilamiento.
