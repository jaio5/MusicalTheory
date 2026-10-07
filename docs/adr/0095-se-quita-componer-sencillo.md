# ADR 0095 — Se quita la versión sencilla de componer

Fecha: 2026-10-03 · Estado: aceptada · Sustituye a
[ADR 0087](./0087-componer-sencillo-es-una-pagina-de-prueba.md) y a
[ADR 0091](./0091-componer-sencillo-es-para-tocar.md)

## Contexto

`/componer/sencillo` nació como una página de prueba para quien se abruma con el
banco de `/componer`, y el 0091 la rehízo como pantalla para tocar. Dejaba cosas por
igualar: no tenía mástil, tempo ni compás, ni guardar con nombre, ni estilo ni
punteo; sumaba el hecho `oido` al avance y la completa no; y su tonalidad por los
acordes solo se había medido con WAV sintéticos. Eran dos pantallas para lo mismo,
con dos maneras de detectar la tonalidad.

**La decisión la tomó quien usa la aplicación**, en el mismo encargo que el
recorrido: enseñar `/componer` entera la primera vez y quitar la sencilla. Lo de
arriba es lo que le faltaba, no el motivo que se dio.

## Decisión

**Se quitan la ruta, `ComposeSimpleScreen`, `screens/componer-sencillo/` y, con ella,
la opción `contarLosDudosos` de `state/apuntar-lo-tocado.ts`.** Lo que abruma de
`/componer` se ataca con el recorrido de la primera visita
([adr/0094](./0094-el-recorrido-de-la-primera-visita.md)) y con el espacio
`Tocando`, que ya escribe lo que suena.

- **Se queda lo que no era suyo**: el primer acorde de la toma
  ([adr/0072](./0072-la-claqueta-suena-toda-la-toma.md)) vive en `startCapture` y
  lo usa `Tocando`.
- La tonalidad se detecta **solo con notas sueltas** (`docs/AUDIO-PITCH.md`). La
  detección por acordes, con tres distintos como mínimo, se fue con la pantalla.

## Consecuencias

- Una sola pantalla de componer, y ningún documento promete una segunda.
- **Rasgueando sigue sin detectarse la tonalidad**: la interfaz pide
  «unas notas sueltas».
- Se pierde lo que el 0091 midió de la pantalla: cinco estados, un botón fijo y 2
  toques hasta tocar. Si vuelve una entrada para tocar, empieza de cero.

## Alternativas descartadas

- **Hacerla la entrada por defecto**, que era lo que anotaba el ROADMAP. Obligaba a
  igualar mástil, tempo, guardado y avance, y a mantener las dos.
- **Dejarla escondida a prueba.** Dos pantallas que se desfasan, y una documentación
  que tiene que explicar cuál es cuál.
- **Conservar solo la detección por acordes**, llevándola a `/componer`. Sin
  guitarra de verdad que la mida, es una promesa que no se puede comprobar.
