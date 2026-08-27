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
- Los iconos son de `ui/icons.tsx`: **emoji no**, que no se tiñen.
- **Los títulos de pantalla van en la serif** (`font-display`), la misma de la
  portada. Los rótulos de apartado, en versalitas de máquina de escribir.

## Los dos temas

**El negro es el de casa.** El claro se elige y se guarda; volver al oscuro borra
la preferencia. No cuelga de `prefers-color-scheme` a propósito.

Los nombres de los tokens no cambian entre uno y otro —`brass` es «el acento»
valga lo que valga—, así que ningún componente sabe qué tema hay puesto. Pero un
color nuevo se comprueba en los dos fondos.

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
