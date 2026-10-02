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
  applyMove,
  canFollow,
  cancionRetocada,
  DEFAULT_ROLE,
  MOVES,
  nextDegrees,
  cadenciasText,
  PATHS,
  PATHS_BY_KIND,
  degreesFor,
  graphText,
  roleInfo,
  type DegreeSymbol,
  type KeyMode,
  type MoveId,
  type PathKind,
  type PathStep,
  type SectionRole,
} from '@core/music';

import { MARCA_DIRECTRICES, type VersionsRequest } from './contract';

/** Un compás escrito para el modelo: `V x4`. */
function compas(paso: PathStep): string {
  return `${paso.degree} x${paso.beats}`;
}

/** Unos compases seguidos, como se leen en el prompt. */
function compases(pasos: readonly PathStep[]): string {
  return pasos.map(compas).join(' | ');
}

/**
 * Lo que queda tras un ejemplo, hasta ocho compases.
 *
 * Son tres ejemplos con la canción entera cada uno, y con treinta y dos compases
 * eso eran trescientos tokens de entrada solo en repetirla. Ocho bastan para ver
 * dónde cae el trozo, que es lo que el ejemplo viene a enseñar.
 */
function hastaOcho(pasos: readonly PathStep[]): string {
  return pasos.length > 8 ? `${compases(pasos.slice(0, 8))} | …` : compases(pasos);
}

/** Tus compases con su número delante, que es lo que `desde` cuenta. */
function numerados(pasos: readonly PathStep[]): string {
  return pasos.map((paso, i) => `${i + 1}: ${compas(paso)}`).join(' | ');
}

/** Un retoque de ejemplo: qué salida, desde dónde y qué trozo devuelve. */
export interface EjemploDeRetoque {
  readonly path: 'rearmonizar' | 'estirar' | 'otro-final';
  readonly desde: number;
  readonly trozo: readonly {
    readonly degree: DegreeSymbol;
    readonly beats: number;
    readonly move: MoveId | null;
  }[];
}

/** El primer compás tuyo que algún movimiento sabe cambiar, con lo que sale. */
function rearmonizarUno(mode: KeyMode, pasos: readonly PathStep[]): EjemploDeRetoque | null {
  for (const [i, paso] of pasos.entries()) {
    for (const move of MOVES) {
      const destino = applyMove(mode, paso.degree, move.id);
      if (destino !== null && destino !== paso.degree) {
        return {
          path: 'rearmonizar',
          desde: i + 1,
          trozo: [{ degree: destino, beats: paso.beats, move: move.id }],
        };
      }
    }
  }
  return null;
}

/**
 * Un final nuevo de un compás, justo después de la mitad que no se toca.
 *
 * La tónica si se llega a ella, que es lo que suena a final; si no, el primer
 * salto del grafo que cambie algo.
 */
function otroFinalDeUno(mode: KeyMode, pasos: readonly PathStep[]): EjemploDeRetoque | null {
  // Con un compás no hay mitad que dejar en pie ni final que cambiar.
  if (pasos.length < 2) {
    return null;
  }
  const suelo = Math.ceil(pasos.length / 2);
  const ultimoQueSeQueda = pasos[suelo - 1]!;
  const elQueHabia = pasos[suelo]!;
  const tonica: DegreeSymbol = mode === 'minor' ? 'i' : 'I';
  const saltos = nextDegrees(mode, ultimoQueSeQueda.degree).map((salto) => salto.to);
  // Ni el que había, que no cambiaría nada, ni el de antes, que sería quedarse:
  // `I I` es la tónica repetida, y eso no cierra nada (adr/0051).
  const destino = [tonica, ...saltos].find(
    (grado) =>
      grado !== elQueHabia.degree &&
      grado !== ultimoQueSeQueda.degree &&
      canFollow(mode, ultimoQueSeQueda.degree, grado),
  );
  return destino === undefined
    ? null
    : {
        path: 'otro-final',
        desde: suelo + 1,
        trozo: [{ degree: destino, beats: elQueHabia.beats, move: null }],
      };
}

/**
 * Un ejemplo de cada retoque, **hecho con tus compases** y por el dominio.
 *
 * **Es lo que hace que `desde` se entienda**, y es el truco de siempre: enseñarle
 * lo que el validador comprueba en vez de pedírselo en prosa. Cada uno enseña lo
 * que su salida no puede tocar —rearmonizar los pulsos, estirar los grados, otro
 * final la primera mitad— y la canción que queda la monta `cancionRetocada`, no
 * se escribe a mano.
 *
 * **Con los tuyos y no con una vuelta fija, y está medido** contra `qwen3:8b`,
 * con ocho progresiones. Con `I V vi IV` de ejemplo lo copiaba en cualquier
 * tonalidad —«desde 2: bII x4» en dos compases que no tenían un V en el 2— y se
 * caía por un trozo que no cabía o unos pulsos que no eran los suyos: 15 válidas
 * de 27, y rearmonizar 2 de 9. Con los tuyos, 22 de 24. **El precio es que las
 * copia**: 21 de esas 22 son el ejemplo tal cual, y lo que pone el modelo es el
 * título y el porqué. Un ejemplo que se copia tiene que ser uno que valga, y
 * estos se construyen con los mismos movimientos y el mismo grafo que los
 * juzgan; `prompt.test.ts` comprueba que pasan el validador.
 *
 * **Y el trozo y lo que queda van rotulados**, «trozo» y «queda». Escritos como
 * `vi x4 → vi x4 | V x4 | …`, el modelo devolvía lo de la derecha como trozo
 * —la canción entera desde el compás 3, que es alargarla—: 13 de 24.
 *
 * Sale el que se puede construir: sin un compás que algún movimiento cambie no
 * hay ejemplo de rearmonizar, y no se inventa.
 */
export function ejemplosDeRetoque(
  mode: KeyMode,
  pasos: readonly PathStep[],
): readonly EjemploDeRetoque[] {
  const [primero] = pasos;
  // Estirar: el primero dura el doble, o la mitad si ya no cabe el doble.
  const estirar: EjemploDeRetoque | null =
    primero === undefined
      ? null
      : {
          path: 'estirar',
          desde: 1,
          trozo: [
            {
              degree: primero.degree,
              beats: primero.beats <= 8 ? primero.beats * 2 : Math.floor(primero.beats / 2),
              move: null,
            },
          ],
        };
  return [rearmonizarUno(mode, pasos), estirar, otroFinalDeUno(mode, pasos)].filter(
    (ejemplo): ejemplo is EjemploDeRetoque => ejemplo !== null,
  );
}

/**
 * Cómo se retoca devolviendo solo lo que cambia, con ejemplos sobre lo tuyo.
 *
 * Termina diciendo **qué no puede cambiar cada salida en tus compases**, con tus
 * números: dónde puede empezar otro final y hasta dónde llega un trozo. Es lo
 * que comprueban `cancionRetocada` y `pathProblem`, dicho antes y no después.
 */
function comoSeRetoca(mode: KeyMode, pasos: readonly PathStep[]): string {
  const largo = pasos.length;
  const ejemplos = ejemplosDeRetoque(mode, pasos).map((salida) => {
    const montada = cancionRetocada(salida.path, pasos, salida.desde, salida.trozo);
    /* v8 ignore next -- se construyen para caber, y prompt.test.ts los monta */
    const queda = 'pasos' in montada ? hastaOcho(montada.pasos) : '';
    const trozo = salida.trozo
      .map((paso) => (paso.move === null ? compas(paso) : `${compas(paso)} (${paso.move})`))
      .join(' | ');
    return `- ${salida.path}: desde ${salida.desde}, trozo ${trozo}. Con lo demas, queda ${queda}`;
  });
  // La primera mitad de otro final: la que `pathProblem` exige intacta.
  const primeroDelFinal = Math.ceil(largo / 2) + 1;
  return [
    'Al retocar devuelve solo el trozo que cambias y en desde el compas donde empieza; ' +
      'el resto lo ponemos nosotros. Por ejemplo, con los tuyos:',
    ...ejemplos,
    'rearmonizar no cambia pulsos y estirar no cambia grados: el trozo tapa tantos ' +
      `compases como mide y no pasa del ${largo}. otro-final no toca la primera mitad: ` +
      `desde va del ${primeroDelFinal} al ${largo} y el final nuevo sustituye todo desde ahi.`,
  ].join('\n');
}

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
  // Al retocar, numerados: es lo que cuenta `desde`, y sin los números el modelo
  // tendría que contar compases para decirlo.
  const progresion =
    request.kind === 'retocar'
      ? `Lo que lleva tocado (compas: grado y pulsos): ${numerados(request.progression)}`
      : `Lo que lleva tocado (grado y pulsos): ${compases(request.progression)}`;

  const lines = [
    ...cabecera,
    `Salidas que puedes declarar:\n${pathsText(request.kind)}`,
    `Movimientos, solo para rearmonizar:\n${movesText()}`,
    // El mapa de saltos es lo que convierte «inventa algo» en «elige por dónde».
    // Es el mismo truco que llevó la función de ideas, ya retirada, de 0 de 4 a
    // 4 de 4: enseñarle lo que el validador va a comprobar, en vez de pedírselo en
    // prosa.
    `Mapa de saltos (de cada grado, a dónde puedes ir):\n${graphText(mode, degreesFor(mode))}`,
    progresion,
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

  if (request.kind === 'retocar') {
    lines.push(comoSeRetoca(mode, request.progression));
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
