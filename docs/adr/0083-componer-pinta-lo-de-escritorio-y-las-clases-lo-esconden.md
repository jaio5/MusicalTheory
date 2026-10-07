# ADR 0083 — Componer pinta lo de escritorio, y las clases lo esconden en un teléfono

Fecha: 2026-10-02 · Estado: aceptada · Amplía
[ADR 0031](./0031-componer-es-un-banco-de-trabajo.md), que repartió componer en un
banco, y [ADR 0065](./0065-lo-que-se-abre-desde-una-fila-que-se-desplaza-es-un-popover.md),
que ordenó la barra de un teléfono

## Contexto

Componer elige qué pinta según el ancho: por encima de `lg`, un banco de áreas; por
debajo, una sola área con pestañas y una barra compacta. **El servidor no sabe el
ancho**, así que lo que sale en el HTML es una suposición, y al hidratar el cliente la
corrige.

La suposición no era gratis. Cuando la cabecera y la fila de abajo dependían de
`hayBanco`, un teléfono recibía la de escritorio, con la línea y los mandos
envolviéndose en tres renglones, y al hidratar se quedaba en uno: la pantalla entera
subía de golpe. Medido el 2 de octubre en Chromium a 390 de ancho: **CLS de 0,116**; a
800, 0,05.

## Decisión

**El servidor sigue contestando que sí al banco, y su árbol lleva lo de escritorio con
las clases que lo esconden en un teléfono** —`max-lg:hidden` en la fila de abajo y en
las cabeceras de las áreas, `lg:hidden` en lo que solo vale ahí—. El cliente poda
después lo que ya estaba escondido. La cabecera sale **igual del servidor que del
cliente, en cualquier ancho**, y lo de cada ancho lo eligen las clases.

- **`WorkHeader` lleva `lineaSoloEnElBanco`**: la línea va en `lead` y se esconde por
  debajo de `lg`, donde no cabe y compartía fila con el título.
- **Lo que depende de la tonalidad puede seguir mirando `hayBanco`**: la tonalidad se
  lee del almacenamiento al montar, así que nunca está en la primera pintura.
- `ComposeScreen.primera-pintura.test.tsx` renderiza en el servidor, hidrata, y
  compara caja a caja lo que se pinta en cada ancho leyendo las clases como las
  leería Tailwind con el corte `lg`: si algo visible cambia, se movería.

## Consecuencias

**El CLS de componer a 390 pasa de 0,116 a 0**, medido el mismo día. El HTML del
servidor lleva más nodos de los que un teléfono muestra, y el de escritorio sigue
sin parpadear.

Quien añada a componer algo que solo valga en un ancho tiene que decir en sus clases
en cuál, y no preguntarlo en el render: un `hayBanco` en la primera pintura vuelve a
dar un salto. El test mira cajas con clases `max-lg:hidden`, `lg:hidden`, `popover` y
`sr-only`, que son las que cambian sin mover nada.

## Alternativas descartadas

**Que el servidor conteste que no al banco.** El escritorio, que es donde se compone
más, parpadearía al revés: llegaría la versión de teléfono y se rehacería entera.

**Los dos árboles montados siempre**, uno escondido. Se duplica todo lo que hay
dentro, incluido el estado y los efectos de lo escondido, para evitar un salto que se
arregla con clases.

**No pintar hasta hidratar.** Quita el salto y la primera pintura entera: se pierde lo
que el servidor sirve ya.

**Client Hints o una cookie con el ancho.** Le dirían al servidor lo que mide la
pantalla, pero una cookie no existe en la primera visita, los Client Hints no viajan
en la primera petición, y ninguna de las dos sigue al teléfono cuando se gira.
