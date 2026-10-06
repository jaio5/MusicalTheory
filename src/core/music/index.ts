/**
 * Punto de entrada del dominio musical.
 *
 * Las capas de arriba importan de aquí, no de los ficheros sueltos, para que
 * mover una pieza dentro de core/ no rompa a nadie.
 */

export * from './notes';
export * from './scales';
export * from './spelling';
export * from './lessons';
export * from './ear';
export * from './curriculum';
export * from './presentaciones';
export * from './resumenes';
export * from './progress';
export * from './posiciones';
export * from './days';
export * from './review';
export * from './tempo';
export * from './chord-symbols';
export * from './chord-matching';
export * from './chords';
export * from './judgement';
export * from './circle-of-fifths';
export * from './keys';
export * from './styles';
export * from './harmonic-function';
export * from './reharmonization';
export * from './partir';
export * from './formas';
export * from './paths';
export * from './suggestions';
export * from './transitions';
export * from './progressions';
export * from './song';
export * from './melody';
export * from './melody-suggestions';
export * from './arrangement';
export * from './ensayo';
export * from './capture';
export * from './playback';
export * from './midi';
export * from './glossary';
export * from './contexto-de-salidas';
export * from './encaje';
export * from './lo-que-dice';
