# ADR 0040 — Ni un cuadrado ni una tira: el mástil, con notas que se leen

> **Ajustado por [ADR 0046](./0046-el-mastil-solo-ocupa-lo-que-dibuja.md):** el mástil solo ocupa lo que dibuja.

Fecha: 2026-09-22 · Estado: aceptada · Amplía: [ADR 0039](./0039-el-mastil-se-estira-a-lo-ancho.md)

## Contexto

El mástil ha pasado por los dos extremos, y los dos se vieron en pantalla:

- **Con proporción fija** ([ADR 0037](./0037-el-mastil-pide-su-alto.md)), en una
  ventana de 606 px de alto se dibujaba como un cuadrado de 514 px en medio,
  con casi cuatrocientos muertos a cada lado.
- **Estirándose sin freno** ([ADR 0039](./0039-el-mastil-se-estira-a-lo-ancho.md))
  llenaba los 1290 de ancho, pero con 166 de alto: una tira de 7,8 a 1 con las
  notas diminutas.

Las dos veces el problema de fondo es el mismo y no es el ancho: **el tamaño de
las notas lo pone el alto**, y el alto que le quedaba al mástil eran 166 px se
estirara o no.

## Decisión

Tres cosas a la vez, porque por separado ninguna llega:

1. **Un tope a lo fino: cinco a uno.** Más ancho que su proporción natural —3,6 a
   1— y todavía se lee como un mástil. Pasado eso deja de parecerlo.
2. **Menos aire arriba y abajo.** Los márgenes donde van los números eran 34 y
   46, el 35 % del alto del dibujo. Con 22 y 26, las cuerdas pasan de llevarse el
   65 % del dibujo al 76 %. Cada píxel de margen era una nota más pequeña.
3. **La canción cede mientras el mástil está abierto, y se desplaza.** Su suelo
   baja de 176 a 128 px, y el área pasa a desplazarse: lo que no cabe **se
   alcanza**, que es la diferencia entre ceder y cortar. Para que eso funcione,
   lo de dentro lleva su propio suelo: el lienzo es una columna con `min-h-0` y
   sin él se encogía a cero, con el panel de «Qué poner ahora» entero fuera de la
   pantalla —medido, y es lo que hizo fracasar el primer intento—.

## Lo que se gana, medido

Separación entre cuerdas, que es lo que decide si una nota se lee:

| Ventana    | Cuadrado (0037) | Tira (0039) | Ahora     |
| ---------- | --------------- | ----------- | --------- |
| 1314 × 606 | 22 px           | 22 px       | **33 px** |
| 1024 × 600 | 11 px           | 11 px       | **28 px** |
| 1366 × 768 | 43 px           | 43 px       | **57 px** |
| 1440 × 900 | 60 px           | 60 px       | 60 px     |

Y el ancho que ocupa: 1090 de 1290 disponibles a 1314 × 606 —el 84 %—, y el 100 %
de 1366 para arriba. Cero recortados en todos los tamaños de escritorio, con la
canción escrita y con la canción en blanco.

## Alternativas descartadas

**Solo el tope a lo fino.** Deja el mástil más estrecho sin hacer las notas más
grandes: volvería el cuadrado con otro nombre.

**Solo bajarle el suelo a la canción.** Probado antes sin dejarla desplazarse, y
es lo que rompía: la fila de dentro se queda en cero y «Qué poner ahora» sale
entera fuera de la pantalla.

**Un botón para verlo grande, o abrirlo grande en ventanas bajas.** Existió medio
día y se quitó: es un mando para tapar una limitación del dibujo, y la pantalla ya
tiene demasiados. Está contado en el [ADR 0037](./0037-el-mastil-pide-su-alto.md).

**Quitar más trastes.** El tamaño de las notas lo pone el alto, así que con menos
trastes se verían igual de pequeñas y además habría menos mástil.

## Lo que hay que saber si se toca

- **El suelo de 128 y el desplazamiento van juntos.** Bajar uno sin poner el otro
  corta el arreglo por dentro, y lo primero que se pierde es la tira que devuelve
  un área plegada.
- El alto del hueco del mástil se cuenta desde ese suelo: si cambia, cambian las
  rem de `FretboardPanel`.
- Se mide con `node .claude/skills/arrancar/auditar-componer.mjs` y con la sonda
  de medidas.
