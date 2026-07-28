/**
 * Punto de entrada del dominio musical.
 *
 * Las capas de arriba importan de aquí, no de los ficheros sueltos, para que
 * mover una pieza dentro de core/ no rompa a nadie.
 */

export * from './notes';
export * from './scales';
export * from './chords';
export * from './circle-of-fifths';
export * from './keys';
export * from './progressions';
