# ADR 0009 — Un solo marco de pantalla, y dónde cae cada cosa dentro

Fecha: 2026-08-01 · Estado: aceptada

## Contexto

Nueve pantallas escritas en once fases, cada una en su semana y cada una mirándose
a sí misma. Por separado ninguna estaba mal. Juntas:

| Pantalla | Ancho         | Relleno      | `h1` | Cajas con scroll |
| -------- | ------------- | ------------ | ---- | ---------------- |
| Cuenta   | `max-w-2xl`   | `p-4 md:p-8` | 2    | 2                |
| Componer | —             | `p-3`        | 0    | 3                |
| Camino   | `max-w-xl`    | `p-3`        | 0    | 1                |
| Planes   | `max-w-5xl`   | `p-4 md:p-8` | 1    | 1                |
| Registro | `max-w-2xl`   | `p-4 md:p-8` | 1    | 1                |
| Repaso   | `max-w-prose` | `p-3`        | 2    | 3                |
| Profesor | `max-w-3xl`   | `p-4 md:p-8` | 1    | 1                |
| Afinar   | `max-w-2xl`   | —            | 0    | 1                |
| Unidad   | `max-w-prose` | `p-4`        | 2    | 3                |

Cinco anchos, cuatro rellenos, tres pantallas **sin título ninguno** y dos con dos.
Eso se nota al usarla aunque no se sepa decir por qué: al cambiar de pantalla nada
cae donde acababas de dejarlo, y en las que no tienen título hay que deducir dónde
estás por lo que se ve. Y `Marco`, el envoltorio de la unidad, estaba copiado en el
repaso: dos copias que ya se habían separado en el ancho y en el hueco del título.

## Decisión

**Un componente, `ui/Screen.tsx`, y todas las pantallas dentro.** Lo que fija es
dónde está cada cosa, no cómo se ve:

- El título arriba a la izquierda, siempre `h1` y **uno por pantalla**.
- Debajo, una línea que dice para qué sirve. Un renglón: si hace falta un párrafo,
  la pantalla hace dos cosas.
- La acción principal arriba a la derecha en pantalla ancha, bajo el título en
  estrecha, donde llega el pulgar sin tapar lo que se lee.
- La vuelta atrás **encima** del título: leerla debajo obliga a subir la vista dos
  veces.
- Un solo sitio que hace scroll. Había pantallas con tres.

El ancho sale de tres opciones con nombre —`lectura`, `normal`, `ancha`— y no de un
número por pantalla. Tres porque cuatro ya nadie las distingue.

**Las tres pantallas de taller —componer, afinar y el camino— no usan el marco
entero, sino `WorkHeader`.** No son documentos que se leen de arriba abajo: tienen
el alto medido —el mástil ya peleó una vez por sus píxeles— y su propio scroll
dentro. Lo que sí comparten es un `h1` y la línea de qué es esto, en una franja
fina con el mismo relleno que la barra que ya tenían debajo.

**Cuarenta y cuatro píxeles de alto en todo lo que se pulsa** (`ui/Chip.tsx` y el
resto de botones pequeños). No es una cifra de guía de estilo copiada: esta
aplicación se usa con la guitarra puesta, mirando de reojo y sin apuntar. Había
botones de veintiséis.

**Los iconos se dibujan, no se escriben** (`ui/icons.tsx`). Los emoji no se dejan
teñir —la pantalla activa se marca en latón y el emoji seguía a todo color, así que
el estado se perdía justo donde se mira para saber dónde estás—, cada sistema los
dibuja distinto y no escalan con la tipografía. Los diez iconos son trazos sobre
`currentColor`.

## Alternativas descartadas

**Dejarlo como estaba y arreglar pantalla a pantalla.** Es lo que se venía
haciendo, y así se llegó aquí: cada arreglo suelto parece razonable y la deriva no
se ve nunca desde dentro de una pantalla.

**Una plantilla que además imponga el contenido** —secciones fijas, orden fijo—.
Habría convertido componer, que es un taller de tres columnas, en un formulario. El
marco fija el sitio de las cosas, no lo que se pone en ellas.

**Adoptar el sistema de diseño que propone la skill de UI/UX** que se instaló para
esto. Su generador da patrones de página de venta —héroe, características,
llamada a la acción—, paleta clara y Poppins. Habría tirado la identidad que este
proyecto ya tiene escrita y probada: el latón sobre negro cálido, la letra de
máquina y la regla de leerse a un metro. De la skill se han usado **las reglas**
—los objetivos de pulsación, los iconos, la jerarquía— y no la estética.

**Una librería de componentes** (shadcn/ui y compañía). Son doce ficheros de `ui/`
con un total de menos de mil líneas y ninguna dependencia; meter una librería para
esto es cambiar código propio que se entiende por una superficie que hay que
aprender y actualizar.

## Consecuencias

Lo que se gana: cambiar de pantalla ya no reordena nada, toda pantalla dice cómo se
llama, y añadir la décima no obliga a decidir el ancho ni el relleno otra vez.

Lo que cuesta: dos guardianes en `src/app/screens/coherencia.test.ts` que leen los
ficheros en vez de renderizar. La coherencia **solo se ve en conjunto** —cada
pantalla suelta se veía bien—, así que se prueba en conjunto: que ninguna se escriba
su propio contenedor de página ni su propio `h1`, y que no vuelvan los emoji.

Lo que no cambia: el color y la voz. Esto ordena, no redecora.

**Actualización del 1 de agosto, misma tarde.** Al repasar la estética entera, dos
cosas de aquí se quedaron cortas y se corrigen sin tocar la estructura:

- La regla «los paneles son rectos» duró unas horas. Con esquinas casi rectas y un
  borde de un píxel, un tema oscuro se lee como un panel de administración de hace
  diez años. Ahora la profundidad se pide por su nombre —`.superficie`,
  `.superficie-alta`, `.superficie-viva`—, con radio de 12 px, filo de luz arriba y
  sombra debajo, todo sacado de los tokens con `color-mix`.
- El título de pantalla iba en la letra del sistema mientras la portada usaba la
  serif de la casa: dentro parecía otra aplicación. Ahora `Screen` y `WorkHeader`
  usan `font-display`.
