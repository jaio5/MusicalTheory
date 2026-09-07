# Cómo se escribe aquí

Las reglas de escritura del proyecto: el idioma, los comentarios, la interfaz y
los tests. Vivían en `CLAUDE.md` y salieron de ahí porque ese fichero es el mapa
—enruta, no explica— y estas cincuenta líneas eran la mitad de lo que lo hacía
crecer.

**Casi todo lo de aquí lo vigila un test.** Cuando se dice «lo comprueba
`coherencia.test.ts`», no es una recomendación: es que romperlo pone la
construcción en rojo.

## El idioma

- **Todo en español**: código comentado, tests, documentación y commits.
- Los comentarios explican **por qué**, no qué. Lee un fichero vecino antes de
  escribir uno nuevo: el repositorio es consistente en esto.
- **Los identificadores, según la capa.** `core/` y `audio/` van en inglés
  —`CapturedChord`, `degreesFor`, `chordsOfRecording`— y `ui/`, `state/` y
  `server/` admiten español —`ANCHOS`, `elegirTema`, `versionesSinIA`—. No es un
  capricho: en `core/` no hay ni un identificador castellano entre sesenta, y
  meter uno crea trampas como tener `MAX_SECCIONES` (4) al lado de `MAX_SECTIONS`
  (12).
- Notas en cifrado anglosajón —C, D, E—, y cada tonalidad decide sostenidos o
  bemoles según su sitio en la rueda.
- Commits: `tipo(ámbito): frase en minúscula y sin tildes`, contando el efecto que
  se nota. Ejemplo real: `fix(mastil): se ve entero al abrirlo, sin arrastrar nada`.

## La interfaz

Se lee **a un metro y con las dos manos ocupadas**. De ahí sale casi todo lo
demás: nada por debajo de 12 px, **44 px de alto en todo lo que se pulsa**,
diagramas grandes, y el significado de un color al lado del color.

- **Los controles de formulario son tres y solo tres**: `ui/Field` para elegir una
  opción, `ui/Disclosure` para abrir un bloque y `ui/TextField` para escribir.
  Ninguno se escribe a mano —lo vigila `coherencia.test.ts`—, porque así salieron
  cinco pintas distintas. El campo de texto estuvo suelto en catorce sitios y lo
  que la copia escondía era peor: **ninguno llegaba a los 44 px**. El ancho se pide
  (`completo`, `auto`, `crece`); heredarlo llenaba una barra de herramientas con un
  desplegable de un dígito y doce rem.
- **Toda pantalla entra por `ui/Screen`** —o por `WorkHeader` si es de taller— y
  ninguna se escribe su propio ancho, relleno ni `h1`. Lo vigilan dos tests que
  leen los ficheros (`app/screens/coherencia.test.ts`), porque la coherencia solo
  se ve en conjunto.
- **Los 44 px valen también para lo redondo.** Los tres controles de formulario los
  cumplían desde que existen, pero los botones sin texto no pasan por ellos y nadie
  los miraba: el conmutador de tema y los dos de la cuenta medían 36 px y el de
  grabar 32, los tres al lado de uno de 44 en la misma barra, y los enlaces de la
  barra de pantallas se quedaban en 26 a partir de los 640 px, que es donde entran
  las tabletas. Se piden con `size-tap`, que es el mismo `--spacing-tap` que
  `min-h-tap`, y lo vigila `coherencia.test.ts` leyendo la clase **propia** de cada
  `<button>` y cada `<Link>` —la de dentro no, que un icono de `size-5` está bien—.
- **Se puede saltar a lo que importa.** La primera parada del tabulador es un enlace
  al contenido, oculto hasta que se enfoca. Sin él costaba ocho paradas llegar a
  `<main>`, y se repetían en cada página.
- **La pantalla llega a los cantos, así que hay que apartarse del hueco.** El
  `viewportFit: 'cover'` de `app/layout.tsx` es lo que hace que el tapizado de la
  barra de abajo no muera en una franja del color del sistema; a cambio,
  `env(safe-area-inset-*)` deja de valer cero y `AppShell` lo usa dos veces: abajo
  en la barra de pantallas y a los lados en el marco, para el hueco de la cámara
  con el teléfono tumbado.
- Los iconos son de `ui/icons.tsx`: **emoji no**, que no se tiñen.
- **Los títulos de pantalla van en la serif** (`font-display`), la misma de la
  portada. Los rótulos de apartado, en versalitas de máquina de escribir.

## Los dos temas

**El negro es el de casa.** El claro se elige y se guarda; volver al oscuro borra
la preferencia. No cuelga de `prefers-color-scheme` a propósito.

Los nombres de los tokens no cambian entre uno y otro —`brass` es «el acento»
valga lo que valga—, así que ningún componente sabe qué tema hay puesto. Pero un
color nuevo se comprueba en los dos fondos.

**Un color con el que se escribe tiene que llegar a 4,5:1** sobre los tres fondos
—`background`, `surface` y `surface-alta`—, y lo comprueba `ui/tokens.test.ts` en
los dos temas. La regla se escribió tarde: el tema claro se hizo con ella delante
—el dorado bonito de las paletas se descartó por no llegar sobre blanco— y al
oscuro, que es el que sale por defecto, no se le pasó la misma vara. Su rojo daba
**2,26:1** y era el color de veinticuatro mensajes de error.

De ahí sale la otra mitad, que el sistema ya seguía sin tenerla dicha: **los
colores van en pares y el papel está repartido**. `oxblood` y `tube` rellenan
—el tapizado del botón de escuchar, la barra de lo que llevas hecho— y
`oxblood-bright` y `tube-bright` son los que se leen; `brass-dim` es adorno y no
es ninguna de las dos cosas. Que no se escriba con los tres primeros lo vigila
`app/screens/coherencia.test.ts`, porque si no la excepción sería una puerta
abierta: un `text-tube` y ya hay un texto por debajo del mínimo con los dos
guardianes en verde.

**El código de tres estados lleva forma, no solo color.** Aquí hay dos códigos que
usan verde, ámbar y rojo —si un acorde entra en la tonalidad, y qué papel armónico
tiene— y verde contra rojo es justo la pareja que no distingue la deficiencia de
color más común, que le pasa a uno de cada doce hombres. Se dibuja con `ui/Marca`:
**círculo lleno, anillo y rombo**, y así la marca se lee sin ver el color. Que
nadie vuelva a pintar el punto a mano lo vigila `ui/tokens.test.ts` leyendo los
ficheros.

Las aplicaciones que se apoyan en el color para esto lo resuelven por el otro
lado: [Hooktheory](https://www.hooktheory.com/support/hookpad) envía cinco
paletas, dos de ellas pensadas para daltonismo, y Yousician tiene un interruptor
en ajustes. Con forma sale más barato y no hay nada que configurar ni una paleta
más que mantener en dos temas.

**El papel no se pone oscuro con el resto.** El pentagrama lleva su propio fondo
claro y su propia tinta, siempre los mismos, valga lo que valga el tema. Es lo que
hace [Soundslice](https://www.soundslice.com/help/en/player/advanced/301/theme/)
de fábrica —el marco sigue al sistema y la música se queda sobre blanco— y su
razón es buena: notas claras sobre fondo oscuro es lo bastante poco tradicional
como para que haya que pedirlo. Aquí el negro sigue siendo el tema de casa; lo que
no se tiñe es el papel. El diagrama de acorde ya funcionaba así.

**La profundidad se pide por su nombre**: `.superficie`, `.superficie-alta` y
`.superficie-viva` en `globals.css` —fondo, borde, radio, filo de luz y sombra en
una clase—. Nada de cajas con `border` suelto: un tema oscuro sin relieve se lee
plano, y lo que da modernidad es que se note qué está encima de qué.

Y una de las de media hora: **`color-scheme: dark` en `:root`** es lo que hace que
el navegador pinte en oscuro lo que dibuja él y no nosotros —la lista de un
`<select>`, la barra de scroll, el cursor—. Sin esa línea aparecen parches blancos
que no se arreglan con ninguna clase de Tailwind.

## Los tests

- Vitest corre en **entorno `node` por defecto**. Un test que necesite DOM lleva
  `// @vitest-environment jsdom` en la primera línea.
- `include` es `src/**/*.test.ts(x)`: los tests viven al lado del código.
- `src/audio/main-thread-cost.test.ts` es un guardián de rendimiento con topes
  holgados a propósito. Si falla, es una regresión algorítmica, no ruido.
- **Nada toca Postgres.** Lo que se prueba de las cuentas es lo puro: planes,
  permisos, fusión de avances, cola de repaso, cifrado. El camino con base de datos
  se ha ejecutado a mano dos veces y las dos salieron fallos que ningún test veía.
- **Los tests que leen ficheros son a propósito.** `coherencia.test.ts` y
  `esquema-ideas.test.ts` comprueban cosas que solo se ven en conjunto —que ninguna
  pantalla se escriba su propio ancho, que ninguna ruta gaste cupo por su cuenta—.
  Son feos y han cazado lo que ningún test unitario podía.
