# ADR 0001 — Capas con el dominio musical aislado del navegador

Fecha: 2026-07-28 · Estado: aceptada

## Contexto

La aplicación mezcla tres cosas de naturaleza muy distinta: teoría musical
(determinista, sin efectos), acceso a hardware del navegador (asíncrono, con
permisos, imposible de reproducir en un test) e interfaz (React, movimiento,
render).

Si se mezclan, ocurren dos cosas conocidas: la teoría musical se vuelve
imposible de probar porque necesita un `AudioContext`, y la lógica acaba
duplicada dentro de componentes porque no hay dónde ponerla.

## Decisión

Cinco capas, con dependencias siempre hacia abajo:

```
app → features → { state, audio, media, ui } → core
```

Y cuatro reglas:

1. `core/` es TypeScript puro: cero React, cero DOM, cero relojes. El tiempo y
   la aleatoriedad entran por parámetro.
2. `audio/` y `media/` exponen interfaces; `features/` consume esas interfaces y
   nunca las APIs del navegador directamente.
3. Un feature no importa de otro feature.
4. El audio y el vídeo del usuario no salen del dispositivo.

Las reglas 1 y 3 están vigiladas por ESLint, no solo escritas aquí.

## Alternativas descartadas

**Todo dentro de los componentes, con hooks.** Es lo que sale por defecto en
React y funciona bien para una aplicación pequeña. Se descarta porque el
dominio musical es la parte más valiosa y la que más va a crecer: `keys.ts`
tiene reglas que quiero poder cambiar con la confianza de una batería de tests
que corre en milisegundos. Dentro de un hook eso exige montar un componente,
simular tiempo y esperar renders.

**Arquitectura hexagonal completa, con puertos, adaptadores y casos de uso.**
Es la que tiene sentido en el trabajo de backend en Go o Java. Aquí sobra: no
hay múltiples orígenes de datos ni transacciones. Añadiría tres capas de
indirección para un solo adaptador de cada tipo. Se toma solo la parte útil:
las interfaces de `audio/` y `media/` son puertos.

**Monorepo con el dominio como paquete aparte.** Daría el aislamiento por
construcción, sin depender de reglas de ESLint. Se descarta por coste: pnpm
workspaces, build separado, versionado y `tsconfig` compuesto para un proyecto
de una persona. Si el dominio llegara a usarse desde otro sitio —una CLI, otra
app— esta decisión se revisa.

## Consecuencias

**A favor**

- El dominio se prueba en Node, sin DOM y sin simular el paso del tiempo con
  temporizadores: los instantes son parámetros.
- Cambiar de motor de tono, o meter uno falso en los tests de interfaz, es
  cambiar la implementación de una interfaz.
- Las reglas se pueden comprobar automáticamente, así que no dependen de que
  alguien se acuerde.

**En contra**

- Hay indirección: para ver «qué pasa cuando suena un Mi» hay que mirar en dos
  o tres sitios.
- Pasar el tiempo por parámetro es menos cómodo de escribir que llamar a
  `Date.now()`. Se acepta a cambio de que los tests no necesiten relojes falsos.
- La regla 3 obliga a decidir dónde va lo compartido en cuanto dos features
  quieren lo mismo. Es una molestia sana: casi siempre significa que la pieza
  pertenece a `core/`.
