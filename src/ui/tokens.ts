/**
 * Tokens de diseño: la única fuente de verdad de la paleta y la tipografía.
 *
 * La idea es un amplificador de válvulas visto de noche: chasis de latón,
 * tapizado oxblood, resplandor verde de la válvula sobre negro cálido. Nada de
 * gradientes ni de verde ácido: el verde solo aparece como brillo pequeño.
 *
 * Estos valores están espejados como variables CSS en src/app/globals.css, que
 * es lo que consume Tailwind. Si cambias uno, cambia el otro.
 */

export const colors = {
  /** Fondos, del más hondo al más cercano. */
  background: '#12100E',
  surface: '#1A1714',
  surfaceRaised: '#241F1A',
  border: '#332C25',

  /** Texto sobre fondo oscuro. */
  text: '#EDE6DA',
  textMuted: '#A79C8C',

  /** Latón: el color de marca, para bordes, títulos y elementos activos. */
  brass: '#B08D4F',
  brassBright: '#D8B76A',
  brassDim: '#6E5830',

  /** Oxblood: acentos cálidos, estados de grabación y errores. */
  oxblood: '#6B1F24',
  oxbloodBright: '#8C2B31',

  /** Verde tubo: solo para «esto está bien»: nota afinada, ejercicio superado. */
  tube: '#5C8A5A',
  tubeBright: '#7FB07C',
} as const;

export const fonts = {
  /** Serif de sistema para titulares. Sin descargas: arranca instantáneo. */
  display: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
  /** Sans del sistema para el cuerpo del texto. */
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  /** Monoespaciada para notas, cents, frecuencias y cifrados. */
  mono: "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
} as const;

export const fontSizes = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.5rem',
  display: '2.5rem',
  /** Para la nota grande del afinador. */
  hero: '5rem',
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

export const radii = {
  sm: '2px',
  md: '4px',
  /** El chasis no tiene esquinas muy redondeadas. */
  lg: '8px',
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
