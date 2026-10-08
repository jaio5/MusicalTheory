# ADR 0102 — Lo que se lee a un metro se ve, y lo que se pulsa se sujeta

> **Cifra superada:** hoy hay cinco `popover` en el código (el del metrónomo, el del micro y tres en `ComposeScreen`), no cuatro.

Fecha: 2026-10-06 · Estado: aceptada · Amplía: [ADR 0065](./0065-lo-que-se-abre-desde-una-fila-que-se-desplaza-es-un-popover.md) · Ajusta: [ADR 0046](./0046-el-mastil-solo-ocupa-lo-que-dibuja.md)

## Contexto

Una crítica de diseño (29/40) y una auditoría técnica (16/20), hechas por separado,
y cuatro puestos de arreglo. Lo que ya estaba bien: Lighthouse de accesibilidad en
100 en cuatro pantallas, CLS 0, cero errores de consola en 124 cargas y la sonda de
medidas a cero. **Lo que fallaba era lo escrito a mano fuera de `ui/` y lo que vive
dentro de un SVG**: justo donde no llegan los tests que leen clases.

Los fallos que se midieron:

- **A 390 px, con ocho acordes, la tira de bloques no se desplazaba con el dedo**:
  `scrollLeft` se quedaba en 0 y un barrido descolocaba los acordes. Siete
  `touch-action: none` eran la respuesta al arrastre con el ratón, y con el dedo se
  comían también el desplazamiento.
- **El mástil en un teléfono era una tira ilegible**: diana de 9,3 px y letra de 5,7.
- **Con el área de abajo abierta el arreglo se quedaba en 128 px** (14 %) a 1440×900.
- **Las opciones de una pregunta parecían texto**: 14 px, gris, sin borde.
- **Lo tapado no parecía tapado**, y cuatro campos de texto a mano llevaban el borde
  a 1,3–1,5:1.

## Decisión

1. **Con el dedo, lo que se arrastra se sujeta primero.** En
   `arrange/use-block-drag.ts`, con `pointerType === 'touch'` el bloque se agarra a
   los `PULSACION_LARGA_MS = 300`; antes de eso el gesto es desplazamiento.
   `BlockButton` pasa a `touch-action: pan-x pan-y` y **solo la franja de estirar**
   sigue en `none`; el cifrado del pentagrama (`Staff.tsx`) va con `pan-y`, y las
   notas y la rejilla se quedan en `none` porque no tienen eje que ceder.
   `touch-action: none` es para lo que no tiene eje que ceder, no para lo que se
   arrastra. Medido a 390 con ocho acordes: `scrollLeft` de 0 a 238 y el orden
   intacto.
2. **El mástil en un teléfono es una hoja**, no una tira. Por debajo de `lg` se abre
   como `popover` (`HojaDelMastil` en `ComposeScreen.tsx`; `FretboardPanel` con la
   prop `hoja` y `ALTO_DE_LA_HOJA_REM`) y el dibujo va a tamaño de lectura, que se
   arrastra de lado. Es **el cuarto `popover`**: el ADR 0065 decía que fuera de la
   barra compacta no había ninguno, y ahora hay uno más, abierto desde «Más» →
   «Mástil». Medido a 390: diana de 9,3 a 26,2 px y letra de 5,7 a 13,1.
3. **El arreglo tiene suelo también con el área de abajo abierta.** El tope del
   mástil pasa a `100dvh-31rem` (`lg`) y `100dvh-28rem` (`xl`). Con todo abierto a
   1440×900 el Arreglo pasa de 128 px (14 %) a 224 (25 %), y a 1024×600 de 156 a 226. **El precio**, medido después por la verificación: así el mástil quedaba en 104 px con notas de 5,8, que no se leen. Se corrigió dándole un suelo de 14 rem (`max(14rem, …)`) y dejando que, por debajo de 700 px de alto, ceda el Arreglo hasta seis rem y «A dónde ir» conserve su cabecera de 44: a 1024×600 el dibujo vuelve a 224 px (notas ≈12,4) y nada queda fuera de alcance; a 1440×900 no cambia.
4. **Las opciones de una pregunta son opciones.** `ui/Chip` gana el tono `opcion` y
   el tamaño `grande`; `learn/Question.tsx` las pone en rejilla 2×2: de 14 px gris
   sin borde a 16 px, 58 px de alto y borde `border-strong`.
5. **Lo tapado se ve tapado**: `inert:opacity-50 inert:saturate-50` en `UnitScreen`
   y `ComposeScreen`. Es la variante `inert:` y no una clase que cambie al hidratar:
   la clase es la misma con y sin, y no hay salto.
6. **La red de `coherencia.test.ts` ya no se esquiva.** Cualquier `<input>` o
   `<textarea>` fuera de `ui/TextField` falla, sin lista de excepciones. Los cuatro
   que había a mano —metrónomo, compases de la parte, buscar acorde, directrices—
   pasaron a `ui/TextField` y su borde de 1,3–1,5:1 a 4,5:1.

## Consecuencias

- Hay **cuatro `popover`** y dos maneras de abrir un panel; la regla de `Disclosure`
  sigue valiendo en todo lo demás.
- El suelo del arreglo con la bandeja abierta se cuenta: nav 61 + cabecera 57 +
  bandeja 61 + cabecera del área 44 + tira 44 + suelo del arreglo 224 (176 a partir
  de `xl`).
- Menores que cuelgan de lo mismo: el panel flotante de la tonalidad tiene escalón
  `sm:` (`ui/Disclosure`, de 248 a 304 px a 700×600: **las cuatro tonalidades
  caben enteras**); `.hay-mas-al-lado` llega hasta `lg` y la fila de mandos de
  componer va en dos filas entre 640 y 1023; el selector de espacios lleva nombre a
  390 (se esconde el icono, no el rótulo); el globo del profesor solo se abre solo
  desde `lg` y pequeño; el afinador pone la instrucción a `text-3xl` pegada a la
  nota y las cuerdas son piezas `.hueco` con la que suena encendida; el camino tiene
  una sola parada de tabulador (de 41 a 1) y las medallas se pliegan bajo `lg`;
  «Clic» pasa a «Metrónomo»; la portada pierde el «01–04» y los antetítulos; el
  cifrado del pentagrama tiene agarre de 44 (de 29 a 46 px); no queda letra bajo
  12 px fuera de un SVG; `.sombra-pixel` y `ProgressRing` usan `--duracion-*`.
- **Lo que se escapa a los tests es lo que no pasa por `ui/` y lo que vive dentro
  de un SVG** (44 px, 12 px, 3:1). Ahí hay que medir.
- Las cifras de después se miden en el skill `arrancar` (`auditar-componer.mjs`);
  las de arriba son las de los informes de los puestos.
- **Sin probar**: Safari/iOS (el toque se sintetizó en Chromium con CDP), cuenta
  con micro, y el muñeco del profesor a 390 (`docs/ROADMAP.md`).

## Alternativas descartadas

**Un asa visible para arrastrar.** Contradice el «un solo control» de `BlockButton`:
el bloque es el botón, y un asa sería un segundo objetivo de 44 px por bloque.

**Un carril bajo la tira para arrastrar.** Gasta alto en el teléfono, que es donde
más falta hace, y separa el gesto de lo que se mueve.

**Dejar `touch-action: none`.** Es lo que había, y era el fallo.

**Girar el mástil** en el teléfono. Obliga a leer ladeado y no resuelve las dianas:
la tira seguiría midiendo lo mismo en el otro eje.

**Un área de abajo desplazable** para el mástil. Lo vuelve a esconder detrás de un
desplazamiento dentro de otro, en una pantalla que ya tiene dos.

**Menos trastes.** Quita lo que se dibuja para ganar tamaño y deja de ser el
mástil que enseña la escala.
