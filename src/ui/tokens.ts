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
 * El tema claro, el que se ofrece: elegante por lo que **no** tiene.
 *
 * Un solo acento y tres grises. El oro es el mismo hilo del latón de antes, pero
 * bajado a `#9A5B08`: es lo que hace falta para que un texto de acento llegue a
 * 4,5:1 sobre blanco, y el dorado bonito de las paletas —`#D4AF37`— no lo cumple
 * ni de lejos. Los grises son cálidos y no azules: sobre blanco puro, un gris
 * azulado deja la pantalla con aire de hospital.
 */
export const paletaClara: Paleta = {
  background: '#FFFFFF',
  surface: '#FAF9F7',
  surfaceRaised: '#F3F1ED',
  border: '#E4E0D9',

  text: '#1C1917',
  textMuted: '#655C54',

  brass: '#9A5B08',
  brassBright: '#7C4A0C',
  brassDim: '#E0CDA2',

  oxblood: '#B91C1C',
  oxbloodBright: '#9F1239',

  tube: '#15803D',
  tubeBright: '#166534',
};

/**
 * El tema oscuro: el amplificador de siempre, y el que sale por defecto.
 *
 * **`oxblood` es el tapizado y `oxbloodBright` es lo que se lee.** No son dos
 * tonos del mismo rojo para elegir a gusto: el primero solo vale de relleno
 * —el fondo del botón de grabar— y el segundo es el que llevan los mensajes
 * de error, que aquí son veinticuatro. Estuvo en `#8C2B31`, que sobre este
 * negro da 2,26:1: menos de la mitad del 4,5:1 que pide un texto, y justo en
 * lo más importante que hay que poder leer.
 *
 * Al repasar la estética se subió el latón —de `#B08D4F` a `#C08A3E`, y el vivo
 * de `#D8B76A` a `#E8B765`— y se abrió el escalón entre las tres superficies.
 * No es capricho: **la aplicación se leía plana**, con el fondo, las tarjetas y
 * lo que está encima casi del mismo gris pardo, así que nada parecía estar sobre
 * nada. El latón de antes tampoco parecía metal encendido; parecía cartón.
 */
export const paletaOscura: Paleta = {
  background: '#100D0B',
  surface: '#1A1613',
  surfaceRaised: '#26201A',
  border: '#3A322A',

  text: '#F3ECE0',
  textMuted: '#B3A695',

  brass: '#C08A3E',
  brassBright: '#E8B765',
  brassDim: '#6E5830',

  oxblood: '#6B1F24',
  oxbloodBright: '#E8878A',

  tube: '#5C8A5A',
  tubeBright: '#86BC82',
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
