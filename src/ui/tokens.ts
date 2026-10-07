/**
 * Tokens de diseño: la única fuente de verdad de la paleta y la tipografía.
 *
 * **La paleta sale de la sala de la portada**: un local de ensayo de noche, con
 * paredes de espuma color tinta, una bombilla desnuda, herrajes de latón, una
 * válvula verde encendida y una alfombra granate
 * ([adr/0070](../../docs/adr/0070-la-sala-encendida.md)). Es la misma sala que
 * pinta `arte/portada/build.py` y el mismo muñeco de `arte/mascota/build.py`, y
 * por eso **todo lo que hay en pantalla se puede pintar con estos dieciséis
 * colores**: si algo pide uno que no está aquí, el que está mal es ese algo.
 *
 * **Dos temas, y el oscuro es el de casa.** De noche, la sala con la bombilla; de
 * día, la misma sala con la luz de la ventana. Comparten el tono de la pared
 * —un azul tinta, no un gris neutro— y el acento, así que se reconocen como el
 * mismo sitio ([adr/0027](../../docs/adr/0027-grafito-y-ambar.md) puso las bases).
 *
 * **Los nombres vienen de un amplificador**, y **lo que nombran no es un color
 * sino un papel**: `brass` es «el acento», `oxblood` «lo que va mal» y además el
 * granate de la alfombra, y `tube` «lo que va bien» o «está encendido», valga lo
 * que valga en cada tema. Ningún componente sabe qué tema hay puesto: piden
 * `text-brass-bright` y les sale lo que toque.
 *
 * Están espejados como variables CSS en src/app/globals.css, que es lo que
 * consume Tailwind, y un test comprueba que no se separan.
 */

export interface Paleta {
  /** La pared de la sala: el fondo de cada pantalla. */
  readonly background: string;
  /** Lo que se consulta: una tarjeta, un panel, la barra de arriba. */
  readonly surface: string;
  /** Lo que está encima: lo que se mira primero, lo que flota. */
  readonly surfaceRaised: string;
  /** La línea que separa dos cajas. Separa; no se ve de lejos, y no debe. */
  readonly border: string;
  /**
   * El borde de lo que se rellena: campos de texto y desplegables.
   *
   * `border` es una línea de separación y da 1,3–1,5:1 contra los fondos, que para
   * separar dos cajas basta y para ver **dónde se escribe** no: WCAG 1.4.11 pide
   * 3:1 a lo que hace falta ver para usar un control, y un campo vacío sobre su
   * fondo es solo su borde. Subir `border` entero habría rayado todas las tarjetas
   * de la aplicación; por eso es otro token, y solo lo llevan los controles. Lo
   * vigila `tokens.test.ts`.
   */
  readonly borderStrong: string;
  readonly text: string;
  readonly textMuted: string;
  /** El latón: la acción principal, rellena. También se lee. */
  readonly brass: string;
  /** El latón con la luz encima: lo que está puesto, un enlace, el foco. */
  readonly brassBright: string;
  /**
   * El latón apagado, que es **adorno y no información**: bordes suaves, el
   * fondo tenue de lo que está activo y el trazo de la mascota.
   *
   * Nunca un relleno que diga algo ni un texto. Estuvo rellenando la barra del
   * temario, el medidor de señal y el tramo de camino de la unidad abierta, y
   * en el tema claro eso son 1,4:1 contra su propio carril: una barra que no se
   * distingue del hueco por el que corre. Esos tres piden `brass`. Lo vigila
   * `app/screens/coherencia.test.ts`.
   */
  readonly brassDim: string;
  /**
   * El granate: el relleno de grabar y de lo que va mal, y la alfombra de la sala
   * cuando hace falta un campo grande de color. **Nunca un texto**: lo que se lee
   * en rojo es `oxbloodBright`.
   */
  readonly oxblood: string;
  readonly oxbloodBright: string;
  /** La válvula: el relleno de lo hecho y de lo encendido. Nunca un texto. */
  readonly tube: string;
  readonly tubeBright: string;
  /**
   * La sala, que es oscura **en los dos temas**.
   *
   * La escena de la portada va en su marco oscuro también de día, y encima de
   * ella —o detrás de un `popover`, como velo— hace falta un oscuro que no se
   * vuelva hielo al cambiar de tema. Antes eso era `bg-black/55` y `text-white`
   * escritos a mano: los dos únicos colores de la aplicación que no salían de aquí.
   * Vale lo mismo en los dos temas a propósito, y es el fondo del tema oscuro.
   */
  readonly night: string;
  /** La luz de la bombilla: lo que se escribe sobre `night`. Fija, como ella. */
  readonly bulb: string;
}

/**
 * El tema claro: **la sala de día**, con la luz de la ventana.
 *
 * El fondo no es blanco puro sino hielo teñido del mismo azul tinta que la pared
 * de noche —`#EDF0F7`—, y **las superficies suben hacia el blanco**: elevarse es
 * acercarse a la luz en los dos temas ([adr/0026](../../docs/adr/0026-el-blanco-hielo.md)).
 * Los grises son de la familia de la pared, no neutros: un gris sin tono al lado
 * de un fondo azulado se lee sucio.
 *
 * El latón baja hasta `#97570D`, que es lo que hace falta para que un texto de
 * acento llegue a 4,5:1 sobre el hielo. El dorado bonito de las paletas —`#D4AF37`—
 * no lo cumple ni de lejos. Un ámbar cálido sobre un fondo frío es lo único con
 * temperatura en la pantalla, y por eso se ve sin subirle la saturación.
 */
export const paletaClara: Paleta = {
  background: '#EDF0F7',
  surface: '#F5F7FC',
  surfaceRaised: '#FFFFFF',
  border: '#D5D9E3',
  borderStrong: '#737A8A',

  text: '#101624',
  textMuted: '#535B6C',

  brass: '#97570D',
  brassBright: '#7A420A',
  brassDim: '#E7CDA5',

  oxblood: '#B32130',
  oxbloodBright: '#9D1137',

  tube: '#227C45',
  tubeBright: '#166238',

  night: '#0A0E19',
  bulb: '#F4F0E7',
};

/**
 * El tema oscuro: **la sala de noche**, y el que sale por defecto.
 *
 * **La pared es tinta, no grafito neutro.** `#0A0E19` tiene el azul de la espuma
 * de la escena a oscuras: lo bastante para que no se lea como el negro tintado de
 * cualquier aplicación —`#0B0B0B`, `#111`— y lo bastante poco para que siga siendo
 * negro. Contra él el latón se queda solo en su temperatura, que es lo que lo hace
 * visible ([adr/0027](../../docs/adr/0027-grafito-y-ambar.md)).
 *
 * **Y el texto es la luz de la bombilla, no blanco de pantalla.** `#F4F0E7` es un
 * blanco de papel bajo una bombilla de filamento: sobre la tinta da 16:1 y, al
 * lado de un fondo frío, lleva la única temperatura que no es el acento. Es lo que
 * hace que la sala parezca iluminada y no encendida.
 *
 * **Los escalones entre fondo, superficie y superficie alta se abren**: de una
 * luminancia relativa a la siguiente hay el doble, para que se note qué está
 * encima de qué sin depender del borde.
 *
 * **`oxblood` es el relleno y `oxbloodBright` es lo que se lee.** No son dos tonos
 * del mismo rojo para elegir a gusto: el primero es el granate de la alfombra y
 * del botón de grabar, y el segundo el de los mensajes de error. Lo mismo vale
 * para `tube` y `tubeBright`. El verde no llega a ácido y el rojo no llega a
 * alarma: lo vigila `tokens.test.ts`.
 */
/**
 * **Y es la que se lee cuando hace falta un color en crudo**, porque es la que
 * sale por defecto. Quien lea de aquí y dibuje algo que también existe en claro
 * está haciendo trampa: lo correcto es una utilidad de color, que sigue al tema
 * puesto.
 */
export const paletaOscura: Paleta = {
  background: '#0A0E19',
  surface: '#131824',
  surfaceRaised: '#1E2432',
  border: '#303747',
  borderStrong: '#788093',

  text: '#F4F0E7',
  textMuted: '#A6AEC0',

  brass: '#E3A04B',
  brassBright: '#F4C87E',
  brassDim: '#533A1E',

  oxblood: '#5E1927',
  oxbloodBright: '#FB9494',

  tube: '#3D7E5D',
  tubeBright: '#85D5AB',

  night: '#0A0E19',
  bulb: '#F4F0E7',
};

/**
 * Cómo se llama cada token dentro del CSS.
 *
 * Las variables del CSS están en español —`--fondo`, `--laton`— y los tokens en
 * inglés como el resto del código. La correspondencia se escribe una vez aquí, y
 * es lo que permite que el test compare los dos temas sin adivinar nombres.
 */
export const VARIABLES_CSS: Readonly<Record<keyof Paleta, string>> = {
  background: 'fondo',
  surface: 'superficie',
  surfaceRaised: 'superficie-alta',
  border: 'borde',
  borderStrong: 'borde-fuerte',
  text: 'texto',
  textMuted: 'texto-suave',
  brass: 'laton',
  brassBright: 'laton-vivo',
  brassDim: 'laton-suave',
  oxblood: 'rojo',
  oxbloodBright: 'rojo-vivo',
  tube: 'verde',
  tubeBright: 'verde-vivo',
  night: 'noche',
  bulb: 'bombilla',
};

/**
 * Las tres letras, cada una con su reserva.
 *
 * El primer nombre es la variable que deja `app/fuentes.ts` en el `<html>`, con
 * la letra autoalojada; lo de detrás es lo que sale mientras llega o si no llega
 * ([adr/0070](../../docs/adr/0070-la-sala-encendida.md)).
 */
export const fonts = {
  /** Archivo ancha: los títulos, la rotulación de un flight case. */
  display: "var(--fuente-titulos), 'Arial Black', system-ui, sans-serif",
  /** Atkinson Hyperlegible Next: todo lo que se lee. */
  sans: 'var(--fuente-cuerpo), system-ui, -apple-system, sans-serif',
  /** Atkinson Hyperlegible Mono: notas, cents, frecuencias y cifrados. */
  mono: "var(--fuente-cifras), ui-monospace, 'SFMono-Regular', Consolas, monospace",
} as const;

/**
 * Tamaños que crecen con el ancho de la pantalla.
 *
 * Un titular con un tamaño fijo se queda pequeño en un monitor grande y se
 * desborda en uno pequeño. Con `clamp` el navegador lo resuelve solo: mínimo
 * legible, máximo sensato y en medio proporcional al ancho.
 *
 * **Bajaron todos al cambiar de letra.** La Archivo ancha ocupa bastante más que la
 * Georgia por la misma frase, y los tamaños de antes estaban medidos para aquella.
 * Lo que hace grande a un titular no es el tamaño, es el blanco que tiene
 * alrededor.
 */
export const fluidSizes = {
  /** El titular de la portada. */
  hero: 'clamp(2.25rem, 1.4rem + 3.6vw, 4.5rem)',
  /** El título de una pantalla (`ui/Screen`). */
  title: 'clamp(1.875rem, 1.35rem + 1.9vw, 3rem)',
  /** Lo que acompaña a un título: la línea de qué es esto, a tamaño de leerse. */
  subtitle: 'clamp(1.0625rem, 0.95rem + 0.45vw, 1.3125rem)',
  body: 'clamp(1rem, 0.95rem + 0.2vw, 1.125rem)',
} as const;

/**
 * Lo mínimo que puede medir algo que se pulsa.
 *
 * Estaba escrito como `min-h-tap` en catorce ficheros. No es una cifra de guía de
 * estilo copiada de nadie: esta aplicación se usa con la guitarra puesta y sin
 * mirar el botón, así que el dedo tiene que acertar a la primera. Vive aquí —y en
 * `@theme` como `--spacing-tap`, que es lo que genera `min-h-tap`— para que
 * subirlo sea cambiar un número y no buscar quince.
 */
export const tap = '2.75rem';

/**
 * Las esquinas, y por qué son cuatro y no una.
 *
 * Subieron enteras al cambiar la paleta —3/6/12/20 a 4/8/14/22—, y no es capricho
 * de gusto: **el radio tiene que crecer con lo que envuelve**, o las cosas grandes
 * parecen recortadas y las pequeñas, hinchadas. Con la esquina casi recta que
 * había, un tema oscuro se lee como un panel de administración de hace diez años;
 * pasado de vuelta, como una aplicación de móvil de 2014. Catorce en una tarjeta
 * es lo que hoy se lee como moderno sin llamar la atención.
 */
export const radii = {
  /** Una pastilla, una casilla: lo que mide dos dedos de ancho. */
  sm: '4px',
  /** Un botón, un campo, un desplegable. */
  md: '8px',
  /** Una tarjeta, un panel: lo que lleva `.superficie`. */
  lg: '14px',
  /**
   * El de una pieza grande: la escena de la portada.
   *
   * Doce píxeles en una caja de seiscientos no se ven; se leen como una esquina
   * recta con un defecto. La curva tiene que crecer con lo que envuelve, y por
   * eso son dos radios y no un `rounded-2xl` suelto de Tailwind, que sería el
   * primer número de esquina fuera de los tokens.
   */
  xl: '22px',
} as const;

/**
 * Duraciones de movimiento en milisegundos, espejadas en `globals.css` como
 * `--duracion-*` y vigiladas por `tokens.test.ts`. Las lee la transición CSS de la
 * rueda (`WheelOfFifths`), y cuando el sistema pide menos movimiento las apaga la
 * regla de `prefers-reduced-motion` de `globals.css`, no quien las usa.
 */
export const durations = {
  /** Lo que responde a un dedo: el hundido de un botón, el color al pasar. */
  instant: 90,
  /** Lo que cambia de estado: un piloto que se enciende, un panel que se abre. */
  quick: 180,
  /** La entrada de una pantalla: una vez, al llegar, y nada más. */
  entrada: 320,
  /** Giro de la rueda de quintas hasta poner arriba la tonalidad detectada. */
  wheel: 650,
} as const;
