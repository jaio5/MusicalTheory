/**
 * Tokens de diseño: la única fuente de verdad de la paleta y la tipografía.
 *
 * **Dos temas, y el negro es el de casa.** El oscuro es el de siempre —un
 * amplificador de válvulas visto de noche: chasis de latón, tapizado oxblood y
 * resplandor verde sobre negro cálido— y sale sin pedir nada. El claro —blanco,
 * tres grises cálidos y un oro— se elige, para quien estudie de día.
 *
 * Los nombres no cambian entre temas, y eso es lo que hace que ningún componente
 * sepa de esto: `brass` es «el acento», `oxblood` «lo que va mal» y `tube` «lo que
 * va bien», valga lo que valga en cada tema.
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
  readonly brassDim: string;
  readonly oxblood: string;
  readonly oxbloodBright: string;
  readonly tube: string;
  readonly tubeBright: string;
}

/**
 * El tema claro, el que se ofrece: elegante por lo que **no** tiene.
 *
 * Un solo acento y tres grises. El oro es el mismo hilo del latón de antes, pero
 * bajado a `#A16207`: es lo que hace falta para que un texto de acento llegue a
 * 4,5:1 sobre blanco, y el dorado bonito de las paletas —`#D4AF37`— no lo cumple
 * ni de lejos. Los grises son cálidos y no azules: sobre blanco puro, un gris
 * azulado deja la pantalla con aire de hospital.
 */
export const paletaClara: Paleta = {
  background: '#FFFFFF',
  surface: '#FAFAF9',
  surfaceRaised: '#F5F5F4',
  border: '#E7E5E4',

  text: '#1C1917',
  textMuted: '#6B625C',

  brass: '#A16207',
  brassBright: '#854D0E',
  brassDim: '#E2CFA4',

  oxblood: '#B91C1C',
  oxbloodBright: '#991B1B',

  tube: '#15803D',
  tubeBright: '#166534',
};

/** El tema oscuro: el amplificador de siempre, y el que sale por defecto. */
export const paletaOscura: Paleta = {
  background: '#12100E',
  surface: '#1A1714',
  surfaceRaised: '#241F1A',
  border: '#332C25',

  text: '#EDE6DA',
  textMuted: '#A79C8C',

  brass: '#B08D4F',
  brassBright: '#D8B76A',
  brassDim: '#6E5830',

  oxblood: '#6B1F24',
  oxbloodBright: '#8C2B31',

  tube: '#5C8A5A',
  tubeBright: '#7FB07C',
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
 * Los colores del overlay de grabación.
 *
 * Son los del tema oscuro **siempre**, y no es un descuido: ese texto se dibuja
 * encima del vídeo de la cámara, no encima de la aplicación. Sobre una imagen
 * cualquiera, la letra clara con sombra se lee y la oscura desaparece en cuanto
 * se toca una pared clara.
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
  /** Ancho útil de la portada: casi todo, con un margen de aire a los lados. */
  hero: 'clamp(2.75rem, 6.6vw, 7rem)',
  title: 'clamp(1.9rem, 4vw, 4rem)',
  subtitle: 'clamp(1.2rem, 2vw, 1.9rem)',
  body: 'clamp(1rem, 1.15vw, 1.3rem)',
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

export const radii = {
  sm: '3px',
  md: '6px',
  /**
   * El chasis se suavizó un punto —de 8 a 12— al repasar la estética: con
   * esquinas casi rectas, un tema oscuro se lee como un panel de administración
   * de hace diez años. Doce sigue siendo un aparato y no una burbuja.
   */
  lg: '12px',
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

export type ColorToken = keyof typeof colors;
export type FontToken = keyof typeof fonts;
export type DurationToken = keyof typeof durations;
