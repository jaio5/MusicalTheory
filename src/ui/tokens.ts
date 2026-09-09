/**
 * Tokens de diseño: la única fuente de verdad de la paleta y la tipografía.
 *
 * **Dos temas, y el oscuro es el de casa.** Grafito frío y ámbar de noche; blanco
 * hielo, grises fríos y el mismo ámbar de día. Son la misma paleta con la luz
 * encendida y apagada, y por eso el acento vale igual en las dos
 * ([adr/0027](../../docs/adr/0027-grafito-y-ambar.md)).
 *
 * **Los nombres vienen de un amplificador que ya no está.** El proyecto nació con
 * la idea de uno visto de noche —chasis de latón, tapizado oxblood, resplandor
 * verde— y de ahí salieron `brass`, `oxblood` y `tube`. La estética se cambió por
 * una moderna y los nombres se quedaron, porque **lo que nombran no es un color
 * sino un papel**: `brass` es «el acento», `oxblood` «lo que va mal» y `tube` «lo
 * que va bien», valga lo que valga en cada tema. Renombrarlos serían trescientas
 * sustituciones para no ganar nada.
 *
 * Y es justo eso lo que hace que ningún componente sepa qué tema hay puesto: piden
 * `text-brass-bright` y les sale lo que toque.
 *
 * Están espejados como variables CSS en src/app/globals.css, que es lo que
 * consume Tailwind, y un test comprueba que no se separan.
 */

export interface Paleta {
  readonly background: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly border: string;
  readonly text: string;
  readonly textMuted: string;
  readonly brass: string;
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
  readonly oxblood: string;
  readonly oxbloodBright: string;
  readonly tube: string;
  readonly tubeBright: string;
}

/**
 * El tema claro: **blanco hielo**, y elegante por lo que **no** tiene.
 *
 * El fondo no es blanco puro sino un blanco frío —`#F1F4F8`—, y **las superficies
 * suben hacia el blanco** en vez de bajar hacia el gris: `surface` casi blanco y
 * `surfaceRaised` blanco del todo. Esto invierte lo que había, y es a propósito
 * ([adr/0026](../../docs/adr/0026-el-blanco-hielo.md)): con el blanco puro de
 * fondo, lo que se elevaba tenía que oscurecerse para verse, o sea que **cuanto
 * más importante era una caja, más sucia se veía**, justo al revés que en el tema
 * oscuro. Con el hielo debajo, elevarse es acercarse a la luz en los dos temas.
 *
 * Los grises pasan a ser fríos, que es lo contrario de lo que decía este comentario
 * antes. La razón de entonces —un gris azulado sobre blanco puro deja aire de
 * hospital— era cierta **sobre blanco puro**: es el par blanco clínico + gris azul
 * lo que enfría, no el gris solo. Sobre un fondo que ya es hielo, un gris cálido es
 * el que desafina, y el que sostiene la paleta es el acento.
 *
 * Y el acento sigue siendo el mismo latón de la casa, sin tocar: `#9A5B08` es lo
 * que hace falta para que un texto de acento llegue a 4,5:1, y el dorado bonito de
 * las paletas —`#D4AF37`— no lo cumple ni de lejos. Un ámbar cálido sobre un fondo
 * frío es lo único que hay aquí de temperatura, y por eso se ve.
 */
export const paletaClara: Paleta = {
  background: '#F1F4F8',
  surface: '#F8FAFC',
  surfaceRaised: '#FFFFFF',
  border: '#DCE3EA',

  text: '#141A20',
  textMuted: '#5A646E',

  brass: '#9A5B08',
  brassBright: '#7C4A0C',
  brassDim: '#E0CDA2',

  oxblood: '#B91C1C',
  oxbloodBright: '#9F1239',

  tube: '#15803D',
  tubeBright: '#166534',
};

/**
 * El tema oscuro: **grafito frío y un ámbar**, y el que sale por defecto.
 *
 * Era un negro pardo —`#100D0B`, `#1A1613`, `#26201A`— con latón encima, y lo que
 * tenía de malo no era el color sino lo que el color arrastraba: un pardo cálido
 * a esa luminancia no se lee como negro, se lee como **marrón viejo**, y contra él
 * cualquier acento cálido queda a un paso de distancia y no destaca. El grafito
 * frío se lee negro de verdad y deja al ámbar solo en su temperatura, que es lo
 * que hace que se vea sin subirle la saturación
 * ([adr/0027](../../docs/adr/0027-grafito-y-ambar.md)).
 *
 * **`oxblood` es el relleno y `oxbloodBright` es lo que se lee.** No son dos tonos
 * del mismo rojo para elegir a gusto: el primero solo vale de fondo —el del botón
 * de grabar— y el segundo es el que llevan los mensajes de error, que aquí son
 * veinticuatro. Estuvo en `#8C2B31`, que sobre el fondo de entonces daba 2,26:1:
 * menos de la mitad del 4,5:1 que pide un texto, y justo en lo más importante que
 * hay que poder leer. Lo mismo vale para `tube` y `tubeBright`.
 *
 * El verde sube a menta y el rojo a coral porque sobre grafito los apagados de
 * antes se hundían, pero **ninguno de los dos llega a ácido**: lo vigila
 * `tokens.test.ts`, y no por nostalgia del amplificador sino porque un verde con
 * el canal disparado, al lado de un acento cálido, es lo que separa una paleta de
 * un semáforo.
 */
export const paletaOscura: Paleta = {
  background: '#0B0D11',
  surface: '#131720',
  surfaceRaised: '#1C222D',
  border: '#2A313D',

  text: '#F0F3F8',
  textMuted: '#98A3B3',

  brass: '#D99A45',
  brassBright: '#F0BE6E',
  brassDim: '#4A3A22',

  oxblood: '#4A1E24',
  oxbloodBright: '#FF9494',

  tube: '#2F6B4E',
  tubeBright: '#7FD4A3',
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
  text: 'texto',
  textMuted: 'texto-suave',
  brass: 'laton',
  brassBright: 'laton-vivo',
  brassDim: 'laton-suave',
  oxblood: 'rojo',
  oxbloodBright: 'rojo-vivo',
  tube: 'verde',
  tubeBright: 'verde-vivo',
};

/**
 * La paleta de casa, para el poco código que necesita un color sin pasar por una
 * clase de Tailwind.
 *
 * Es la oscura porque es la que sale por defecto. Quien lea de aquí y dibuje algo
 * que también existe en claro está haciendo trampa: lo correcto es una utilidad
 * de color, que sigue al tema puesto.
 */
export const colors = paletaOscura;

export const fonts = {
  /** Serif de sistema para titulares. Sin descargas: arranca instantáneo. */
  display: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
  /** Sans del sistema para el cuerpo del texto. */
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  /** Monoespaciada para notas, cents, frecuencias y cifrados. */
  mono: "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
} as const;

/**
 * Tamaños que crecen con el ancho de la pantalla, para la portada.
 *
 * Un titular con un tamaño fijo se queda pequeño en un monitor grande y se
 * desborda en uno pequeño. Con `clamp` el navegador lo resuelve solo: mínimo
 * legible, máximo sensato y en medio proporcional al ancho.
 */
export const fluidSizes = {
  /**
   * El titular de la portada.
   *
   * Bajó de 7rem a 5,25rem al pasar el encabezado a media columna: siete rem
   * eran para un titular a todo lo ancho, y en media columna cada palabra
   * ocupaba una línea. Lo que hace grande a un titular no es el tamaño, es el
   * blanco que tiene alrededor.
   */
  hero: 'clamp(2.5rem, 5.4vw, 5.25rem)',
  title: 'clamp(1.75rem, 3.2vw, 3.25rem)',
  subtitle: 'clamp(1.15rem, 1.8vw, 1.6rem)',
  body: 'clamp(1rem, 0.95vw, 1.15rem)',
} as const;

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2.5rem',
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
   * El de una pieza grande: el vídeo de la portada.
   *
   * Doce píxeles en una caja de seiscientos no se ven; se leen como una esquina
   * recta con un defecto. La curva tiene que crecer con lo que envuelve, y por
   * eso son dos radios y no un `rounded-2xl` suelto de Tailwind, que sería el
   * primer número de esquina fuera de los tokens.
   */
  xl: '22px',
} as const;

/**
 * Duraciones de movimiento en milisegundos. GSAP las lee de aquí, y cuando el
 * sistema pide menos movimiento se sustituyen todas por 0.
 */
export const durations = {
  instant: 90,
  quick: 180,
  /** Giro de la rueda de quintas hasta poner arriba la tonalidad detectada. */
  wheel: 650,
} as const;
