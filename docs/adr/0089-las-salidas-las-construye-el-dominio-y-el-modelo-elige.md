# ADR 0089 — Las salidas las construye el dominio y el modelo elige

> **Sustituido en parte por [ADR 0097](./0097-las-salidas-se-juzgan-por-lo-que-encajan.md):** el menú del modelo es de seis, no de nueve; el dominio genera más y un juez de encaje ordena; sin directrices el modelo explica las tres mejores. La idea de fondo —el dominio construye, el modelo elige— sigue.

Fecha: 2026-10-03 · Estado: aceptada · **Sustituye en parte** a
[ADR 0086](./0086-retocar-devuelve-solo-lo-que-cambia.md) · Amplía
[ADR 0011](./0011-versiones-verificadas-contra-el-dominio.md) y
[ADR 0016](./0016-salidas-en-vez-de-versiones.md)

## Contexto

Tras el 0086, retocar «salía» pero **copiando**: 21 de 22 salidas válidas eran el
ejemplo del prompt. Al continuar pasaban **21 de 72**, los porqués decían cosas
falsas de la canción, y el presupuesto de entrada estaba mal medido (unos 1.950
tokens frente a los 1.400 del tope).

## Decisión

**El dominio construye las salidas posibles y el modelo solo elige por número y
las explica.**

- **`salidasPosibles`** (`core/music/paths.ts`) construye hasta **9** salidas
  (`MAX_SALIDAS_POSIBLES`), válidas por construcción.
- **El menú** (`features/versions/menu.ts`) se le enseña al modelo, con un tope de
  caracteres (`MAX_CARACTERES_DEL_MENU`). El esquema pasa a `{opcion, title, why}`.
- **`loQueNoEsta`** comprueba la prosa del porqué contra la canción; lo que miente
  se sustituye por lo que dice el dominio.
- **El respaldo del dominio** (si el modelo falla, el [ADR 0088](./0088-el-profesor-siempre-contesta-y-sabe-mas.md))
  va marcado «Sin IA»; el `heard` también se marca.
- **El presupuesto se mide donde se ve**: `app/api/versiones/presupuesto.test.ts`.

Medido con 40 peticiones: contesta **38 → 40**; salidas válidas **51 % → 100 %**;
no copian el ejemplo **6 % → 87 %**; porqué verdadero **84 % → 119 de 120**;
directrices servidas **36 % → 63 %**; entrada **1.699 → 1.120 tokens**; **6,5 →
3,6 s**.

## Consecuencias

- **El modelo no puede proponer nada que el dominio no sepa construir.** Es lo que
  se compra: validez total, y lo que se paga: techo.
- **Desaparecen `desde` y el montaje del trozo** del 0086, y con ellos los
  ejemplos hechos con tus compases. Lo demás del 0086 —el diagnóstico— sigue.
- **Las directrices como «flamenco» o «tensión» no se pueden servir** sin
  movimientos nuevos en el dominio: el 63 % es el techo del menú actual.
- **`TOKEN_BUDGETS.versiones.output` sigue en 900** cuando bastan unos 300; bajarlo
  sube los cupos de los planes, así que es decisión de precio y está en el
  [ROADMAP](../ROADMAP.md).

## Alternativas descartadas

**Seguir con el ejemplo** del 0086: es lo que copiaba.

**Pedir en prosa que no copie.** Medido en el 0086: no cambia lo que hace.

**Un híbrido con `anyOf`** (menú o propuesta libre): la rama la elige el modelo al
empezar a escribir, y elige la que no toca.

**El dominio solo, sin modelo.** Sirve el 38 % de las directrices; el modelo es
quien las lee y las explica.
