/**
 * El prompt de las salidas: lo que se le cuenta al modelo antes de pedirle.
 *
 * Vivía dentro de la ruta. Se saca aquí para que **el banco de pruebas mida
 * este prompt y no una copia suya**: un banco con el suyo propio mediría otro
 * programa, y en cuanto este cambiara las cifras dejarían de hablar de lo que
 * hay en producción.
 *
 * Al lado del contrato y no en `server/`, porque lo que necesita —la forma de
 * la petición— está aquí y `src/server/` no puede importar de `features/`. Solo
 * lo abre la ruta, así que no llega al navegador.
 */
import {
  DEFAULT_ROLE,
  MOVES,
  cadenciasText,
  PATHS,
  PATHS_BY_KIND,
  degreesFor,
  graphText,
  roleInfo,
  type PathKind,
  type SectionRole,
} from '@core/music';

import { MARCA_DIRECTRICES, type VersionsRequest } from './contract';

/**
 * El catálogo de movimientos, escrito para el modelo.
 *
 * Se genera desde `MOVES` y no se escribe a mano aquí: si mañana se añade un
 * movimiento al dominio, el modelo se entera solo, y sobre todo **no puede pasar
 * que el prompt ofrezca un movimiento que el validador no sepa comprobar**. Ese
 * desajuste haría que todas las versiones que lo usaran se cayeran sin que nadie
 * entendiera por qué.
 */
/**
 * El catálogo de salidas, generado desde `PATHS`.
 *
 * No se escribe a mano por lo mismo que el de movimientos: si el prompt ofreciera
 * una salida que el validador no sabe comprobar, todas las que la usaran caerían
 * sin que nadie entendiera por qué.
 */
function pathsText(kind: PathKind): string {
  return PATHS.filter((path) => PATHS_BY_KIND[kind].includes(path.id))
    .map((path) => `- ${path.id}: ${path.why}`)
    .join('\n');
}

function movesText(): string {
  return MOVES.map((move) => `- ${move.id}: ${move.why}`).join('\n');
}

/**
 * Qué es lo que le mandan, en una línea.
 *
 * La frase sale de `ROLES` y no se escribe aquí, por lo mismo que el catálogo de
 * salidas y el de movimientos: **lo que entiende quien compone y lo que entiende
 * el modelo tienen que salir del mismo sitio.** Escribirla otra vez aquí es
 * firmar que dentro de tres meses digan cosas distintas.
 *
 * Una idea se dice igual de claro que un estribillo. No decir nada haría que el
 * modelo diera por hecho que es una canción a medias, que es lo que venía
 * suponiendo y por lo que continuaba siempre por lo obvio.
 */
function queEs(role: SectionRole = DEFAULT_ROLE): string {
  const info = roleInfo(role);
  return `Lo que te mandan es ${info.name.toLowerCase()}: ${info.what}`;
}

/**
 * **Se exporta para el banco de pruebas**, que mide contra la API si lo que
 * devuelve el modelo sirve para componer. Un banco con su propio prompt mediría
 * otro programa: en cuanto este cambie, el de allí se queda viejo y las cifras
 * dejan de hablar de lo que hay en producción.
 */
export function promptDeSalidas(
  request: VersionsRequest,
  /**
   * Las líneas de cabecera —la tonalidad y los grados que existen— que ya arma
   * `server/prompts.ts`.
   *
   * Entran por la puerta en vez de importarse: `features/` no puede abrir
   * `server/`, y la alternativa era copiarlas aquí, que es exactamente lo que
   * este módulo existe para evitar.
   */
  cabecera: readonly string[],
): string {
  const { mode } = request.key;
  const progresion = request.progression.map((step) => `${step.degree} x${step.beats}`).join(' | ');

  const lines = [
    ...cabecera,
    `Salidas que puedes declarar:\n${pathsText(request.kind)}`,
    `Movimientos, solo para rearmonizar:\n${movesText()}`,
    // El mapa de saltos es lo que convierte «inventa algo» en «elige por dónde».
    // Es el mismo truco que llevó la función de ideas, ya retirada, de 0 de 4 a
    // 4 de 4: enseñarle lo que el validador va a comprobar, en vez de pedírselo en
    // prosa.
    `Mapa de saltos (de cada grado, a dónde puedes ir):\n${graphText(mode, degreesFor(mode))}`,
    `Lo que lleva tocado (grado y pulsos): ${progresion}`,
    queEs(request.role),
  ];

  // **Las cadencias, enumeradas.** Con el cierre pedido en prosa el modelo
  // contestaba la tónica repetida —a temperatura cero, `I I I I` siempre—: cumplía
  // la letra y no cerraba nada. Enumerándoselas contesta `IV I`, y es el mismo
  // truco que el mapa de saltos
  // ([adr/0051](../../../docs/adr/0051-un-cierre-se-prepara-por-detras.md)).
  //
  // **Y hay que decirle que su último compás ya está puesto.** Con «para cerrar
  // desde V» contestaba `V IV`: leía «desde V» como «empieza por V».
  //
  // El último compás existe siempre: el contrato no acepta menos de dos. Y toda
  // tonalidad tiene con qué cerrar desde cualquier grado, que lo comprueba
  // `cadenciasParaCerrar` para los suyos.
  if (request.kind === 'continuar') {
    const ultimo = request.progression[request.progression.length - 1]!.degree;
    lines.push(
      `Tu ultimo compas es ${ultimo} y ya esta puesto. La parte que cierra tiene que ` +
        `ser una de estas listas, copiada tal cual y sin empezarla por ${ultimo}:\n${cadenciasText(mode, ultimo)}`,
    );
  }

  lines.push(
    request.kind === 'continuar'
      ? `Continúa esos ${request.progression.length} compases: hasta tres canciones ` +
          'distintas. De cada una devuelve solo las partes que añades, no las suyas, y ' +
          'que digan algo que no estuviera ya.'
      : `Devuelve hasta tres salidas distintas para esos ${request.progression.length} compases.`,
  );

  // **Tus directrices, marcadas y al final.** Es el segundo texto libre que entra
  // al modelo —el otro es la pregunta del profesor— y va igual: delimitado, con el
  // prompt de sistema diciendo que lo de dentro es un dato, y con la marca ya
  // borrada al validar para que nadie cierre el bloque antes de tiempo.
  //
  // Al final a propósito: es lo último que lee, y tiene que pesar más que el
  // catálogo que va arriba.
  if (request.directrices !== undefined) {
    lines.push(`${MARCA_DIRECTRICES}\n${request.directrices}\n${MARCA_DIRECTRICES}`);
  }

  return lines.join('\n');
}
