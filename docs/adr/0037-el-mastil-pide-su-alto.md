# ADR 0037 — El mástil pide su alto, y el arreglo tiene un suelo de verdad

Fecha: 2026-09-22 · Estado: aceptada · Amplía: [ADR 0031](./0031-componer-es-un-banco-de-trabajo.md)

## Contexto

El mástil vive en el área de abajo del banco de trabajo, y el alto de esa área lo
reparte quien arrastra el divisor: dieciséis rem de fábrica, hasta treinta y dos.
Es lo que decidió el [ADR 0031](./0031-componer-es-un-banco-de-trabajo.md) para
las seis cosas que caben ahí.

**Con el mástil eso no funciona, y se ve.** El dibujo mide 874 por 230, casi
cuatro veces más ancho que alto, y lleva `preserveAspectRatio`: dentro de una
caja más ancha de lo que le toca, se encoge y se centra. Medido a 1440 de ancho,
con el área en su alto de fábrica: **el mástil se pintaba a 650 píxeles teniendo
1416**, entre dos franjas muertas de casi cuatrocientos a cada lado. A 1920 se
quedaba en el 34 % del ancho disponible.

Y no se arregla con otro número, porque el número tendría que cambiar con la
pantalla: para llenar 1440 hacen falta veintinueve rem, y para llenar 1920 hacen
falta treinta y seis y medio, que es más que el tope de treinta y dos.

Al medirlo apareció lo de debajo: **el suelo del arreglo era mentira**. El CSS
decía diez rem para todas las pantallas grandes, y con ese alto al arreglo no le
caben sus propios mandos. Barriendo alturas contra la sonda de medidas, lo que
necesita para no cortarse nada por dentro son 220 px por debajo de 1280 —la barra
se parte en más filas cuanto más estrecho— y 170 por encima. Nunca se había
notado porque hasta ahora nada empujaba al arreglo hasta su suelo.

## Decisión

**Un dibujo de proporción fija no tiene un alto que repartir: tiene uno**, el que
llena el ancho que le toque. Así que el mástil pide ese alto y no se le da
divisor, y el arreglo lleva el suelo que necesita de verdad.

Tres piezas:

- El hueco del dibujo lleva `aspect-ratio` con la proporción del mástil, sacada
  de sus propias constantes para que no envejezca. El área, que ya no tiene alto
  fijo, pide exactamente lo que hace falta.
- El hueco lleva un tope, y son dos por tramo de ancho. Hace falta porque el
  bloque de abajo es `shrink-0`: sin él el mástil se queda con su alto natural y
  deja la fila de arriba once píxeles corta —suficiente para que **la tira de un
  área plegada quede fuera de alcance**, y sin esa tira no hay manera de devolver
  ese panel—.
- El divisor del alto no se dibuja con el mástil abierto. Un mando que no mueve
  nada es peor que no tenerlo.

El tope son cinco cosas sumadas, medidas y no estimadas: la barra de navegación,
la de herramientas, el suelo del arreglo más los 44 px de la tira plegada que va
debajo de él, la barra de abajo y la cabecera y los rótulos de la propia área.
Por debajo de 1280 cambian dos de los cinco sumandos, y por eso son dos topes.

## Lo que se gana, medido

Con la canción escrita y el mástil abierto, lo que se pinta de ancho:

| Ventana   | Antes      | Después      | Recortados |
| --------- | ---------- | ------------ | ---------- |
| 1920×1080 | 650 (34 %) | 1896 (100 %) | 0 → 0      |
| 1600×1000 | 650 (41 %) | 1576 (100 %) | 0 → 0      |
| 1440×900  | 650 (46 %) | 1416 (100 %) | 0 → 0      |
| 1280×800  | 650 (52 %) | 1201 (96 %)  | 0 → 0      |
| 1024×768  | 650 (65 %) | 790 (79 %)   | 0 → 0      |
| 1024×600  | 635 (63 %) | 152 (15 %)   | **8 → 0**  |

**Y lo que se pierde, que no se esconde**: en 1024×600 el mástil queda en 152
píxeles. Ahí no caben las dos cosas —el arreglo honrado necesita 268 con su tira,
y el mástil lleno 263, y con las barras suman más de lo que hay—, así que algo
tiene que ceder. Antes cedía en silencio recortando ocho cosas; ahora cede el
mástil y no se corta nada. Se prefiere así: **un recorte no se ve y un dibujo
pequeño sí**, y lo que se recortaba era la tira que devuelve un panel.

## Alternativas descartadas

**Subir el alto de fábrica y el tope del área.** Es el arreglo de una línea y no
llega: el alto que llena el ancho depende del ancho, y a 1920 pide más que el
tope de treinta y dos rem. Llenaría en un monitor y no en el de al lado.

**Que el mástil ceda y conserve su alto el arreglo.** Es lo contrario de lo que
ya estaba decidido —«perder la mitad de la pantalla mientras está abierto es un
precio que se paga solo mientras se mira»— y además no resuelve nada: el problema
no era cuánto alto tenía el área, sino que el dibujo no lo usaba.

**Dejar que el área se desborde y salga una barra de desplazamiento.** Un mástil
que hay que desplazar para ver los trastes de arriba no es un mástil: la promesa
de este dibujo, desde que existe, es que se ve entero.

**Quitarle trastes en pantallas estrechas.** Cambia lo que la aplicación enseña
para arreglar un problema de reparto, y quince trastes son quince trastes.

**Un tope en `vh` y ya.** Se probó, y en un portátil bajo dejaba el mástil más
pequeño que antes, que es justo lo contrario de lo que se buscaba. El ancho lo
tiene que poner la proporción, que no hay que adivinarla.

## Lo que hay que saber si se toca

- **Un porcentaje no resuelve contra un padre de alto automático.** El primer
  intento puso `max-h-full` en el hueco, y el tope no topaba nada: el dibujo se
  imponía, empujaba al arreglo por debajo de su suelo y le cortaba lo de dentro.
  Aparecieron recortes a 1280 y a 1024 donde no los había.
- **Tailwind lee las clases del fichero.** Una clase armada en ejecución con una
  constante no existe, así que las rem del tope van escritas a mano.
- **La tira de un área plegada va debajo del arreglo, en la misma columna**, y
  cuenta para el suelo de la fila.
- Se mide con `node .claude/skills/arrancar/auditar-componer.mjs`, que da el
  reparto de la pantalla, y con la sonda de medidas, que da lo que no se alcanza.
