# ADR 0070 — La sala encendida: la paleta y el sistema del rework

Fecha: 2026-10-01 · Estado: aceptada · Rehace la paleta de
[ADR 0027](./0027-grafito-y-ambar.md) sin tocar su regla —fondo frío, acento
cálido—, confirma el tema de casa de [ADR 0010](./0010-tema-claro-por-defecto.md) y
cambia la letra que [ADR 0026](./0026-el-blanco-hielo.md) y
[0027](./0027-grafito-y-ambar.md) dejaron para otro día

## Contexto

La portada se acaba de convertir en una escena de píxel: un local de ensayo de
noche, con el profesor sentado encima del ampli
([ADR 0069](./0069-la-portada-es-una-escena-de-pixel.md)). Es lo primero que ve
quien llega, y es lo único de la aplicación que tiene un mundo propio. Al pasar de
ahí a cualquier pantalla, ese mundo desaparecía:

- **La letra dependía del equipo.** Los títulos eran Georgia, el cuerpo
  `system-ui` y la monoespaciada una JetBrains Mono que nadie descargaba. En un
  Linux sin Georgia —el equipo donde se hacen todas las capturas de este
  repositorio— los títulos salían en DejaVu Serif y el cuerpo en DejaVu Sans. Lo
  que se miraba en las capturas no era la identidad de la aplicación, era la del
  sistema operativo.
- **El negro era el de cualquiera.** `#0B0D11` es el negro tintado que lleva media
  herramienta de hoy. La escena, en cambio, tiene una pared de espuma azul tinta,
  una bombilla de filamento, herrajes de latón, una válvula verde y una alfombra
  granate: cinco cosas que la interfaz no contaba.
- **El latón decía dos cosas.** Relleno era «púlsame» y borde era «está puesto»,
  y de lejos las dos son la misma mancha ámbar: con una pastilla marcada al lado
  de un botón principal, no se sabía cuál estaba puesta y cuál se pulsaba.
- **Las pantallas se leían como formularios.** Título a 30–36 px, la línea de qué
  es esto a 14 px, los apartados nombrados con un rótulo de 12 px y el mismo
  `gap-8` entre todo. No había escalones entre la cabecera, un apartado y una
  tarjeta, así que no había por dónde empezar a mirar.
- **Dos clases no hacían nada.** El botón principal pedía `hover:filo-luz-alto`, y
  una clase de `@layer components` no admite variantes en Tailwind v4: la regla no
  se generaba y al pasar por encima no se encendía nada. Nadie lo vio porque no
  falla, simplemente no ocurre.

Y antes de que lleguen los agentes que rehacen cada pantalla, hacía falta un
sistema cerrado sobre el que trabajar, o cada uno traería su color.

## Decisión

**La interfaz es la sala de la portada con la luz encendida.** Todo lo que sale en
pantalla se puede pintar con los colores de la escena, y la escena se puede pintar
con los de la interfaz.

### La paleta: dieciséis colores, y ninguno más

Los catorce papeles de siempre —con sus nombres de siempre: `brass` es el acento,
`oxblood` lo que va mal, `tube` lo que va bien— más dos nuevos que no cambian con
el tema:

| Token           | Papel                                          | Oscuro    | Claro     |
| --------------- | ---------------------------------------------- | --------- | --------- |
| `background`    | La pared de la sala                            | `#0A0E19` | `#EDF0F7` |
| `surface`       | Lo que se consulta                             | `#131824` | `#F5F7FC` |
| `surfaceRaised` | Lo que está encima o flota                     | `#1E2432` | `#FFFFFF` |
| `border`        | Separar dos cajas                              | `#303747` | `#D5D9E3` |
| `borderStrong`  | El borde de un control                         | `#788093` | `#737A8A` |
| `text`          | Lo que se lee                                  | `#F4F0E7` | `#101624` |
| `textMuted`     | Lo que acompaña                                | `#A6AEC0` | `#535B6C` |
| `brass`         | La acción, rellena                             | `#E3A04B` | `#97570D` |
| `brassBright`   | Lo puesto, un enlace, el foco                  | `#F4C87E` | `#7A420A` |
| `brassDim`      | Adorno: bordes suaves, fondos tenues           | `#533A1E` | `#E7CDA5` |
| `oxblood`       | El granate: grabar, lo que va mal, la alfombra | `#5E1927` | `#B32130` |
| `oxbloodBright` | El error que se lee                            | `#FB9494` | `#9D1137` |
| `tube`          | La válvula: lo hecho, lo encendido             | `#3D7E5D` | `#227C45` |
| `tubeBright`    | El acierto que se lee                          | `#85D5AB` | `#166238` |
| `night`         | La sala, oscura en los dos temas               | `#0A0E19` | `#0A0E19` |
| `bulb`          | La luz que se escribe sobre la sala            | `#F4F0E7` | `#F4F0E7` |

- **La pared es tinta, no grafito neutro.** `#0A0E19` lleva el azul de la espuma
  a oscuras: lo bastante para no confundirse con el negro de cualquiera y lo
  bastante poco para seguir siendo negro. El claro es el mismo azul con la luz de
  la ventana, y por eso los dos temas se reconocen como el mismo sitio.
- **El texto de noche es la luz de una bombilla**, `#F4F0E7`, y no el blanco frío
  de una pantalla. Al lado de un fondo frío lleva la única temperatura que no es el
  acento, y es lo que hace que la sala parezca iluminada.
- **Los escalones entre fondo, superficie y superficie alta se abren**, para que
  se note qué está encima de qué sin depender del borde.
- **`night` y `bulb` son la sala, que no cambia con el tema**: la escena va en su
  marco oscuro también de día. Sustituyen a los únicos colores que no salían de la
  paleta, `bg-black/55` y `text-white`, en el velo de tres `popover` y en el botón
  de parar la escena.
- **El granate es `oxblood`**, no un token nuevo. Ya rellenaba el botón de grabar
  y la escena ya pintaba la alfombra con él. Se le reconoce el papel de campo
  grande de color, y sigue sin poder escribirse con él.
- **No hay un color de neón propio.** Las corcheas de neón de la escena son el
  verde de la válvula encendido, y un quinto tono —el rosa de un cartel— habría
  sido un semáforo con caramelo al lado del ámbar.

Para un matiz, la opacidad de un token (`bg-brass/20`) o `color-mix` en
`globals.css`. Nada más: **un tono de la paleta de Tailwind o un color entre
corchetes lo caza `screens/coherencia.test.ts`**, que es el guardián nuevo.

### Los contrastes

Medidos con la fórmula de WCAG 2.2 sobre los tres fondos de cada tema. Los de
texto los vigila `ui/tokens.test.ts` (4,5:1), y también lo que se dibuja (3:1),
que ahora se mira **sobre los tres fondos y no solo sobre el de la página**: el
verde de antes daba 2,5:1 sobre la superficie alta, que es por donde corre la
barra de lo hecho, con el test en verde.

| Pareja                              | Papel                        | Mínimo | Oscuro: fondo / superficie / alta | Claro: fondo / superficie / alta |
| ----------------------------------- | ---------------------------- | ------ | --------------------------------- | -------------------------------- |
| `text`                              | texto                        | 4,5:1  | 16,94 / 15,60 / 13,64             | 15,84 / 16,86 / 18,07            |
| `textMuted`                         | texto                        | 4,5:1  | 8,66 / 7,97 / 6,97                | 5,98 / 6,36 / 6,82               |
| `brass`                             | texto                        | 4,5:1  | 8,62 / 7,94 / 6,94                | 5,00 / 5,32 / 5,70               |
| `brassBright`                       | texto y foco                 | 4,5:1  | 12,31 / 11,33 / 9,91              | 7,05 / 7,50 / 8,04               |
| `oxbloodBright`                     | texto                        | 4,5:1  | 8,96 / 8,25 / 7,21                | 7,17 / 7,63 / 8,17               |
| `tubeBright`                        | texto                        | 4,5:1  | 11,11 / 10,22 / 8,94              | 6,49 / 6,90 / 7,40               |
| `borderStrong`                      | control                      | 3:1    | 4,87 / 4,48 / 3,92                | 3,77 / 4,02 / 4,30               |
| `tube`                              | relleno                      | 3:1    | 3,98 / 3,67 / 3,21                | 4,56 / 4,85 / 5,20               |
| `brassDim`                          | adorno                       | —      | 1,83 / 1,68 / 1,47                | 1,35 / 1,43 / 1,54               |
| `border`                            | separación                   | —      | 1,62 / 1,49 / 1,30                | 1,24 / 1,32 / 1,41               |
| `background` sobre `brass`          | letra del botón principal    | 4,5:1  | 8,62                              | 5,00                             |
| `background` sobre `brassBright`    | el mismo botón al pasar      | 4,5:1  | 12,31                             | 7,05                             |
| `bulb` sobre `night`                | lo que va sobre la sala      | 4,5:1  | 16,94                             | 16,94                            |
| `text` sobre `oxblood`              | la letra del botón de grabar | 4,5:1  | 11,23                             | — (no se escribe sobre él)       |
| `brassBright` sobre `surfaceRaised` | lo marcado con su piloto     | 4,5:1  | 9,91                              | 8,04                             |

`brassDim` y `border` no llegan a 3:1 a propósito: no dicen nada que haga falta
ver para usar algo, y `coherencia.test.ts` impide escribir con `brassDim`.

### El tema de casa sigue siendo el oscuro

[ADR 0010](./0010-tema-claro-por-defecto.md) ya lo decía y aquí se confirma, ahora
con más razones que entonces. Una sala de ensayo se usa de noche; la escena de la
portada es de noche en los dos temas; el profesor se enciende en verde, que es
como se ve que escucha, y eso solo luce sobre lo oscuro. El claro sigue a un clic
para quien toque junto a una ventana, y sigue sin colgar de
`prefers-color-scheme`.

### La letra: tres familias autoalojadas

`app/fuentes.ts` las carga con `next/font/local` desde `app/_fuentes/`, sin CDN,
con su licencia OFL al lado:

- **Archivo, ancha** (`font-display`): instanciada a un ancho fijo de 116 % y pesos
  de 500 a 800, solo latín. Es la rotulación de un flight case o del frontal de un
  ampli, se lee de lejos y no se parece a la sans de nadie. Fijar el ancho la deja
  en 27 kB en vez de 90.
- **Atkinson Hyperlegible Next** (`font-sans`): dibujada para leerse con poca
  vista, con la «I», la «l» y el «1» distintos. Esta aplicación se lee a un metro
  y con las dos manos ocupadas, y es la única letra que se eligió por eso.
- **Atkinson Hyperlegible Mono** (`font-mono`): para lo que se alinea en columna
  ([ADR 0024](./0024-la-interfaz-se-lee-primero.md)), de la misma familia.

Las dos primeras se precargan; la monoespaciada no, que solo la usan algunas
pantallas. Son 80 kB entre las tres, y las dos que se precargan, 61.

La escala: `text-fluid-title` (30 → 48 px) para el título de una pantalla,
`text-fluid-subtitle` (17 → 21 px) para su línea, `.titulo-apartado` (17 px en la
letra de los titulares) para un apartado, el cuerpo a 16 px con 1,5 de interlínea,
y `.rotulo` (12 px) solo para nombrar una caja.

### Las primitivas

- **`ui/Screen`**: el título pasa a `.titular` en la escala fluida, la línea de
  qué es esto a tamaño de leerse y con su medida de 60 caracteres, y **dos ritmos**
  —más aire entre la cabecera y lo primero que entre dos apartados—. La cabecera
  se posa al llegar, y es lo único que se mueve.
- **`Section`**: su título es un `h2` en la letra de los titulares, no un rótulo.
- **`WorkHeader`**: la misma letra, a la altura de la franja.
- **El piloto** (`.piloto`): lo que está puesto lleva una luz de latón encendida
  debajo —la pantalla en la que estás, una pastilla marcada, la opción de un
  segmentado—. El latón relleno queda solo para la acción.
- **`ui/Segmentado`** es un carril hundido con la opción elegida arriba; **`Chip`
  `quiet`** va sin borde hasta que se pasa por encima; **`Button` `quiet`** y
  `danger` llevan fondo propio y no solo contorno; los tres solo cambian al pasar
  lo que se puede pulsar.
- **Superficies**: `.superficie`, `.superficie-alta` y `.superficie-viva` con las
  sombras y el filo nuevos, y dos piezas más: **`.hueco`**, lo hundido dentro de
  una tarjeta, y **`.ventana-pixel`**, el cuadro de diálogo de dieciséis bits con
  las esquinas a escalones, **solo para lo que dice el profesor**.
- **`.tarjeta-pulsable`**, para una tarjeta entera que es un enlace.
- **La barra de arriba** lleva al profesor delante de la marca, a 32 px —un píxel
  de pantalla por cada uno del dibujo—, deja ver la sala por detrás y marca la
  pantalla con su piloto. El nombre se calla por debajo de 360 px y entre 768 y
  1023, donde no cabe con la cuenta configurada: medido, la barra pedía hasta
  44 px más de los que había.
- **El foco**: latón vivo, dos píxeles y separado tres del control, que da 12:1 en
  oscuro y 7:1 en claro. Y la selección de texto, en latón y no en el azul del
  sistema.
- **El movimiento**: `--ease-salida` (`ease-salida` en Tailwind) para todo lo que
  responde a algo, y `--duracion-*` espejadas de `durations`. Todo CSS
  ([ADR 0057](./0057-la-rueda-gira-sin-gsap.md)), y la regla de
  `prefers-reduced-motion` lo para todo como siempre.
- **`filo-luz` y `filo-luz-alto` pasan a `@utility`**, que es lo que les deja
  aceptar `hover:`.

## Consecuencias

- **Un guardián nuevo** en `coherencia.test.ts` —ningún color fuera de la
  paleta— y dos más fuertes en `ui/tokens.test.ts`: lo que se dibuja llega a 3:1
  sobre los tres fondos, y `night` y `bulb` valen lo mismo en los dos temas.
- **La escena y el muñeco quedan un punto por detrás.** `arte/portada/build.py` y
  las `--mascota-*` de `globals.css` siguen con los valores de
  [ADR 0027](./0027-grafito-y-ambar.md): se pintaron con aquellos grafitos y aquel
  latón. Hasta que se vuelvan a generar con los de aquí, la pared de la escena es
  un punto más gris que la de la página. Volver a generarlos es un encargo aparte,
  porque son PNG y no se tocan a mano.
- **Ochenta kilobytes más** en la primera visita, 61 de ellos precargados, y con
  huella en el nombre y caché larga después. Lo mide `peso-de-las-rutas.mjs`.
- **Los tamaños de las pantallas cambian**: el título de `Screen` crece y la
  Atkinson es más estrecha que la DejaVu de las capturas de antes. Las medidas de
  `/componer` (`auditar-componer.mjs`) se repasan con el resto de la pantalla.
- `docs/ESTILO.md` recoge las reglas nuevas: la paleta cerrada, el piloto, la
  ventana del profesor, la escala y los dos ritmos.

## Alternativas descartadas

**Seguir con las letras del sistema.** Cero kilobytes y cero cambios. Se descarta
porque la identidad no puede depender del ordenador de quien mira: en la mitad de
los equipos los títulos ni siquiera eran Georgia. Y es justo la palanca que
[ADR 0026](./0026-el-blanco-hielo.md) y [0027](./0027-grafito-y-ambar.md) dejaron
pendiente por ser «otro cambio de identidad»; este es ese cambio.

**Una letra de píxel para los títulos** —Silkscreen, Press Start 2P—, a juego con
la escena y el muñeco. Es lo más evidente y se descarta por lo mismo: una letra de
píxel en un título de unidad de cuarenta caracteres no se lee, y con acentos y
eñes a 8×8 menos. El píxel se queda donde es dibujo: el profesor, su ventana y la
escena.

**Una serif con carácter** —Fraunces, Instrument Serif—, que conservaba la idea de
Georgia con más oficio. Se descarta porque una serif de titular es hoy la marca de
una página de producto genérica, y porque no tiene nada de local de ensayo: la
rotulación de un ampli, de un flight case o de un pedal es una palo seco ancha.

**Un neón rosa como sexto papel**, el cartel de «ON AIR» de cualquier estudio. Se
descarta porque metía un quinto tono saturado al lado del ámbar, el verde y el
granate, y la escena no lo tiene: sus corcheas de neón son el verde de la válvula.

**Renombrar los tokens** a `accent`, `danger`, `success` aprovechando el cambio.
Se descarta otra vez y por lo mismo que en [ADR 0027](./0027-grafito-y-ambar.md):
cientos de sustituciones en ficheros que van a rehacer otros agentes justo
después, con tests que leen los nombres de clase. Los nombres siguen nombrando un
papel, y ahora además salen de la sala de la portada.

**Cambiar el tema de casa al claro.** La aplicación se usa de día junto a una
ventana, y el claro es el que mejor se lee con luz de frente. Se descarta porque
eso ya lo cubre el conmutador, y porque la escena, el muñeco y la idea entera son
de noche: abrir en claro sería abrir con la luz del techo en un concierto.

**Un borde de latón vivo para lo marcado**, que es lo que había, en vez del piloto.
Es lo más corto. Se descarta porque es justo lo que hacía que la pastilla puesta y
el botón principal se confundieran: dos manchas del mismo latón.
