/**
 * Punto de entrada del dominio musical.
 *
 * Las capas de arriba importan de aquí, no de los ficheros sueltos, para que
 * mover una pieza dentro de core/ no rompa a nadie.
 */

export * from './notes';
export * from './scales';
export * from './lessons';
export * from './curriculum';
export * from './progress';
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
export * from './suggestions';
export * from './transitions';
export * from './progressions';
