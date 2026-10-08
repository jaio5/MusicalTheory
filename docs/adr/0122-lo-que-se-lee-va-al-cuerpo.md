# ADR 0122 — Lo que se lee va al cuerpo, y los cortes de la navegación tienen nombre

Fecha: 2026-10-08 · Estado: aceptada · Completa a
[ADR 0024](./0024-la-interfaz-se-lee-primero.md),
[ADR 0084](./0084-lo-que-trabaja-no-se-apaga-y-el-foco-se-mueve-a-mano.md) y
[ADR 0102](./0102-lo-que-se-lee-a-un-metro-se-ve-y-lo-que-se-pulsa-se-sujeta.md)

## Contexto

La auditoría de diseño del 8 de octubre de 2026 dio un 30 sobre 40, y lo primero
que encontró fue una escala de letra que no era la escrita. `ESTILO.md` nombraba
cinco escalones —el título de la pantalla, su línea, el apartado, el cuerpo a 16 px
y el rótulo a 12— y había un sexto sin nombre: **`text-sm`, 14 px, en unos ciento
noventa sitios de setenta y dos ficheros**. No era la letra de lo accesorio, era
la de lo que más había que leer:

| Dónde                         | Lo que había                                                 |
| ----------------------------- | ------------------------------------------------------------ |
| `/planes`                     | 18 de 23 párrafos a 14 px; la primera tarjeta a 865 px a 390 |
| Profesor, registro, cuenta    | Las explicaciones enteras a 14 px                            |
| La ventana de pago, las dudas | Lo que se lee antes de pagar, en la letra más pequeña        |
| `/planes` a 1024 × 600        | Las tarjetas empezaban a 533 px: se veían sesenta píxeles    |

Medido con un recorrido de once rutas en cinco tamaños: a 1440, `/planes` tenía 36
textos a 14 px; la cuenta y el registro, 13.

Y había tres sitios que sabían dónde cambia la navegación —`AppShell`, el tope del
panel flotante de `ui/Disclosure` y lo que se pliega con la ventana baja—, cada uno
con su `md:` o su `max-height` entre corchetes. El ADR 0084 lo dejaba escrito:
**ningún test lo vigila**.

## Decisión

**El texto corrido va al cuerpo.** Un párrafo, un elemento de lista o de
definición y cualquier caja con `max-w-prose` no llevan `text-sm` ni un tamaño
entre corchetes. Lo auxiliar va al cuerpo en `text-muted` o, si nombra una caja,
a `.rotulo`. `screens/coherencia.test.ts` lo vigila en todo `src/`. Hubo una lista de lo que
quedaba en zonas que trabajaba otra mano y que solo podía encoger; se vació y se
quitó con su segundo test, así que ya no hay excepciones.

**Los 14 px quedan para los mandos**: el botón y la pastilla compactos
(`tamano="compacto"`), el segmentado, la navegación, el `summary` de un
desplegable. Eso no se lee seguido, se pulsa, y su letra la pone su componente
(lo vigilaba ya la regla de `text-xs` en botones). El desplegable de `ui/Field`
sube a 16: es un valor que se lee, y por debajo de 16 Safari en iOS amplía la
página al enfocarlo.

**`/planes` enseña los planes en la primera pantalla.** Lo gratis se dice primero
—en la línea de la cabecera—, las tarjetas van después y los cuatro párrafos van
debajo, en «Sin pagar nada» y «Lo que se paga». El precio es lo grande de la
tarjeta, en la letra de los títulos y con `tabular-nums`, no en la mono: la mono
espaciaba «4,99 €» letra a letra. El anual se dice en cada tarjeta con sus meses
gratis en latón, y en la prosa.

**Los cortes de la navegación son variantes de `globals.css`**: `barra-arriba:`
(el `md` de Tailwind, leído de su variable) y `ventana-baja:` (500 px de alto). Los
tres sitios las piden por nombre y el test prohíbe el literal. Una variante propia
se escribe en la hoja **después** de `lg`, así que donde convive con él va acotada
(`barra-arriba:max-lg:`).

## Consecuencias

- `/planes`: la primera tarjeta pasa de 865 a 270 px a 390 × 844, y de 533 a 292
  a 1024 × 600. Los textos a 14 px, de 36 a 5 a 1440, y los cinco son la navegación.
- Lo que crece al subir la letra se midió con la sonda de `arrancar` en 320 × 568,
  390, 700 × 600, 768, 1024 × 600, 1440 y 1920, en los dos temas, y en los treinta
  casos de componer: **nada fuera de alcance**. Los huecos que el afinador reserva
  para no saltar (adr/0061) se recalcularon para renglones de 24 px.
- Mover la navegación es mover una línea de `globals.css`; quien vuelva a escribir
  `md:` en esos tres ficheros o el `max-height` a mano verá fallar el test.
- Ya no queda ningún párrafo a 14 px. Sí queda texto a 12 px (`text-xs`) que no es
  rótulo y la regla no vigila: está en el ROADMAP como pendiente de decisión.

## Alternativas descartadas

- **Hacer de los 14 px un escalón con nombre** («la letra de apoyo»). Es lo que
  había sin decirlo, y fue justo lo que llevó lo que más se lee a la letra más
  pequeña: un escalón para «lo menos importante» se acaba usando para todo lo que
  no es un título.
- **Bajar `text-sm` a 16 px en `@theme`.** Cambia ciento noventa sitios de golpe,
  también los mandos que sí deben ir apretados, y deja una clase que miente sobre
  lo que mide.
- **Plegar la explicación de `/planes` en un `Disclosure`.** Esconde justo lo que
  dice qué es gratis, que es lo que la pantalla quiere que se lea primero; con la
  línea de la cabecera y las tarjetas arriba ya no estorba debajo.
- **Un conmutador «al mes / al año» encima de las tarjetas.** El periodo se elige
  en la ventana de pago (adr/0106), y un conmutador aquí que no viaja hasta allí
  obliga a elegirlo dos veces.
- **Dejar los cortes como estaban y vigilarlos con la sonda.** La sonda dice que
  algo se sale, no por qué; un nombre hace que mover uno mueva los tres.
- **Cambiar el latón del tema claro.** Se valoró: `#97570D` da 5,0:1 sobre el
  hielo y se lee tostado. Uno de saturación entera y el mismo tono, `#9E5800`, da
  4,78:1 y, puesto en `/planes`, no se distingue a simple vista; uno más dorado no
  llega a 4,5:1 —un ámbar que se lea sobre el hielo tiene que estar por debajo del
  33 % de luminosidad, y ahí es tostado—. Se queda.
