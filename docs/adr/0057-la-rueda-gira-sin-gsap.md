# ADR 0057 — La rueda gira sin GSAP

Fecha: 2026-09-30 · Estado: aceptada

## Contexto

GSAP entró para una cosa: que la rueda de quintas girase hasta poner arriba la
tonalidad que suena, con el anillo del modo que manda pasando a fuera. Eran
**cuatro interpolaciones** en `features/wheel/WheelOfFifths.tsx` —la escala de
cada anillo, el giro y el contragiro de las letras— y ningún otro uso en todo el
repositorio.

Y costaba **29,6 KB comprimidos** en cada ruta que monta la rueda: la portada,
`/componer` y `/profesor`. En la portada es más que todo el código de la página;
en componer, donde la rueda está plegada detrás de una línea casi siempre, se
descargaba para girar una vez al empezar.

Tenía además una trampa que obligaba a recordarla: **GSAP escribe el transform
él mismo**, así que la regla de `prefers-reduced-motion` de `globals.css` no le
alcanzaba y había que preguntar a mano en `ui/motion.ts` (`motionSeconds`).

## Decisión

**Transiciones CSS sobre el `transform` de cada grupo**, escrito en el render.

- La escala de los anillos ya salía del render (`escalaDesdeElCentro`) para que
  el HTML del servidor no trajera los veinticuatro nombres pisados; ahora es un
  transform CSS en vez del atributo de SVG, que no se puede transicionar.
- El giro es estado: se acumula con `shortestRotation` desde el anterior, y se
  deriva durante el render cuando cambia la tonalidad, sin un efecto.
- El contragiro de cada letra gira sobre su propio centro con `transform-origin`
  en unidades del lienzo.
- La curva es la `power3.out` de GSAP escrita como `cubic-bezier(0.25, 1, 0.5, 1)`.

**`prefers-reduced-motion` se cumple solo**: la regla global deja cualquier
transición en 0,01 ms, así que `motionSeconds` desaparece. `prefersReducedMotion`
se queda para lo que decide desde JavaScript si se mueve —el vídeo de la portada,
la mascota—.

`gsap` sale de `package.json`.

## Descartadas

- **Cargar GSAP con `import()` al primer giro.** Quita los 29,6 KB del primer
  pintado, pero siguen viajando en cuanto se elige tonalidad, que en componer es
  lo primero que se hace. Y deja la animación a merced de la red: el primer giro
  esperaría a un chunk, y la rueda saltaría en vez de girar justo la vez que más
  se mira. Conserva además la trampa del movimiento reducido.
- **Dejarlo como estaba.** Una librería de animación entera para cuatro
  interpolaciones que el navegador ya hace, y la única razón de que existiera
  `motionSeconds`. GSAP ofrece líneas de tiempo, arrastre y morfología de
  trazados; aquí no se usaba nada de eso ni está previsto.
- **Web Animations API (`element.animate`).** Mueve lo mismo, pero desde un
  efecto y con el estado de partida leído del DOM: vuelve a separar lo que se
  pinta en el servidor de lo que se anima, que es lo que ya había dado el fallo de
  los nombres pisados. Y `animate()` no lo frena la regla global: habría que
  seguir preguntando por el movimiento reducido. Una transición sobre el estilo
  que sale del render no necesita nada de eso.

## Consecuencias

Tres rutas bajan 29,6 KB comprimidos. La rueda se pinta igual en el servidor y en
el cliente, y un cambio de tonalidad a mitad de giro sigue desde donde está en
vez de reiniciar la animación, porque es el navegador quien interpola.

Lo que se pierde: si algún día hiciera falta una animación con varias fases
encadenadas, CSS la escribe peor que GSAP. Entonces se vuelve a mirar, con un ADR.
