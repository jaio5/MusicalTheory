/**
 * Lo que el resto del proyecto ve del motor de salidas, y nada más.
 *
 * Por dentro está partido por oficio —quien valida, quien construye cada camino,
 * quien arma el menú y el juez con un fichero por criterio— y esos ficheros se
 * exportan cosas entre sí que no son de nadie de fuera. Por eso aquí se nombra
 * cada export en vez de `export *`: lo que no está en esta lista no sale de
 * `salidas/`, y `@core/music` lo reexporta tal cual (adr/0124).
 */
export { type ContextoDeSalidas, type NotaDelCompas } from './contexto';
export { formaDeBlues } from './juez/forma';
export { hablaDeUnSitio, loQueNoEsVerdad } from './lo-que-dice';
export { esRelleno, porQueNoHaySalidas, salidasPosibles, SIN_SALIDA } from './menu';
export { moveById, type MoveId } from './movimientos';
export { gruposPorPulsos } from './partir';
export {
  type Color,
  type Criterio,
  type CriterioId,
  MAX_SALIDAS_POSIBLES,
  type PathId,
  type PathKind,
  type SalidaPosible,
} from './tipos';
export { MAX_PATH_STEPS, pathById, PATHS } from './validar';
