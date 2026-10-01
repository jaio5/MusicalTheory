# ADR 0073 — Las pantallas llenan el ancho

Fecha: 2026-10-01 · Estado: aceptada · Sustituye en parte a
[ADR 0069](./0069-la-portada-es-una-escena-de-pixel.md) y a
[ADR 0071](./0071-la-sala-va-a-sangre-detras-del-titular.md) en cómo se mide la
sala y cuánto crece, y a [ADR 0009](./0009-un-solo-marco-de-pantalla.md) y
[ADR 0060](./0060-un-borde-izquierdo-para-todas-las-pantallas.md) en los anchos de
`ui/Screen`

## Contexto

A 1920 de ancho las pantallas usaban entre el 23 % y el 61 %: la cuenta, la
cuarta parte, y los planes, algo más de la mitad. El resto era vacío al lado de
una columna con tope. La portada tenía el mismo defecto con otra forma: una lista
de cortes por ancho y un múltiplo del píxel de la sala que no pasaba de 5× hasta 1920.

## Decisión

**El ancho útil es el de la ventana, con un margen que crece con ella; lo que se
queda estrecho es el párrafo, no la pantalla.**

### La portada

- Va **sin ancho máximo**, con `--margen: clamp(1.25rem, 4vw + 0.5rem, 7.5rem)`
  (`app/escena-portada.css`). La medida de lectura la pone cada párrafo con su
  `max-w-[..ch]`.
- **`--px` se calcula** con `@property` y
  `round(down, min(100cqw/columnas, 100svh/filas), 1px)`. La sala va de pie o
  tumbada según la orientación —apaisada desde 640— y no según un ancho de 1024.
- El titular se mide en `cqi` sobre su columna, y la columna la deja la sala. El
  encabezado ocupa al menos 100svh.
- Las franjas van en rejilla 5/7 desde `lg`, y las tarjetas en cuatro columnas
  desde `xl`.

### Las demás pantallas

`ui/Screen` tiene **dos anchos**, `lectura` y `completo`, y una prop `aside` que
acompaña a la derecha y se queda pegada. La caja es `max-w-pantalla` (160 rem,
2560 px) con `px-margen` (`clamp(1rem, 0.4rem + 3vw, 6rem)`). Todo lo que no es
texto seguido se reparte dentro del ancho entero: en rejilla, en columnas o con
algo al lado.

Se recompuso cada pantalla: el camino como mapa, el afinador con la afinación al
lado, el profesor con `aside`, los planes en rejilla, la cuenta y el registro con
`QueTeDaLaCuenta`, la entrada de componer con tarjetas que llevan I·IV·V, el
repaso con `aside` y `/planes/[plan]` con `ElPlanEntreLosTres`.

`coherencia.test.ts` busca la caja centrada sin depender del orden de las clases.

## Consecuencias

A 1920 el ancho útil pasa del 23–61 % al 89–96 %. En la portada, el margen
izquierdo a 2560 pasa de 680 a 110 px y el titular de 72 a 130 px; CLS 0 y axe 0.

**Ya no es cierto lo que dicen** el 0069 —el múltiplo por consulta de contenedor
según el ancho— y el 0071 —no pasar de 5× hasta 1920 y anclar a la derecha desde
1024—.

**Queda pendiente:** el `fit-content(44rem)` de `lectura` deja el `aside` en unos
200 px entre 768 y 1023 —hay una cota puesta por pantalla en el repaso y en el
plan—, y `WorkHeader` sigue con 16 px de margen frente al `px-margen` del cuerpo.

## Alternativas descartadas

**Mantener la lista de cortes y añadir `min-height`.** Seguía haciendo depender la sala de una lista de anchos.

**Calcular `--px` con `vw`.** Cuenta la barra de desplazamiento, y la sala se sale
por un lado.

**Una columna con tope de 120 a 180 rem.** Sigue dejando vacío a los lados.

**Tumbar la sala solo desde 1024.** Un móvil en horizontal seguía con la sala de pie.

**Subir a 3× en el teléfono.**

**Subir los anchos de antes**, **centrar cada columna**, **ir sin techo** y
**que cada pantalla se escriba su rejilla.** Se descartan las cuatro: no
quitan el vacío, o dejan la coherencia de las pantallas en manos de cada una.
