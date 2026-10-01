# ADR 0060 — Un borde izquierdo para todas las pantallas

Fecha: 2026-09-30 · Estado: aceptada · Amplía lo que fija `ui/Screen`

## Contexto

`ui/Screen` tiene tres anchos con nombre —`lectura`, `normal` y `ancha`— y cada
uno se centraba por su cuenta con `mx-auto`. Por separado cada pantalla se veía
bien; al pasar de una a otra, el título saltaba. Medido a 1440 de ancho:

| Pantalla           | Ancho     | Dónde empieza el título |
| ------------------ | --------- | ----------------------- |
| Planes             | `ancha`   | x = 112                 |
| Profesor, Registro | `normal`  | x = 240                 |
| Cuenta (entrar)    | `lectura` | x = 368                 |

Lo que el marco venía a asegurar era **dónde está cada cosa**: el título arriba a
la izquierda, en el mismo sitio en todas. Con tres centrados, «a la izquierda»
eran tres sitios distintos.

## Decisión

**Se centra una sola caja, la del ancho mayor, y el ancho de cada pantalla va
dentro sin centrar.** El relleno de página también va en esa caja de fuera. Así el
título, la vuelta atrás y el primer apartado empiezan en el mismo borde en las
nueve pantallas, y lo que sobra en una de lectura queda a la derecha.

Los tres anchos se quedan: siguen diciendo cuánto puede crecer lo de dentro —un
renglón de lectura no pasa de `max-w-3xl`—, solo que ya no deciden dónde empieza.

Lo vigilan `ui/Screen.test.tsx`, que comprueba que la columna de cada ancho no se
centra y la caja de fuera sí, y `screens/coherencia.test.ts`, que lee el relleno de
esa caja para que ninguna pantalla lo repita.

## Consecuencias

- En un monitor ancho, las pantallas de lectura quedan cargadas a la izquierda con
  un hueco a la derecha. Es a propósito: el hueco no se lee, y un título que no se
  mueve al cambiar de pantalla sí se nota.
- Por debajo de 80 rem —portátil pequeño, tableta, móvil— no cambia nada: la caja
  de fuera ya ocupaba todo el ancho y las columnas llenaban el suyo.

## Alternativas descartadas

**Un solo ancho para todas las pantallas de formulario.** Arreglaba Cuenta,
Registro y Profesor entre sí, pero Planes —la rejilla de tres tarjetas— seguía
necesitando el ancho grande y seguía empezando en otro sitio. Era arreglar dos de
tres saltos.

**Quitar los anchos y dejar que todo ocupe `max-w-7xl`.** El título caería en su
sitio, pero los renglones de la cuenta y de la unidad pasarían de doscientos
caracteres, que es justo lo que el ancho de lectura existe para impedir.

**Centrar la columna y alinear solo la cabecera a la caja grande.** Título a la
izquierda y contenido centrado debajo: el ojo baja del título y tiene que buscar
dónde empieza lo que sigue. Es el mismo salto, puesto dentro de una pantalla en vez
de entre dos.
