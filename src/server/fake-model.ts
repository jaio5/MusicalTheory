/**
 * El modelo que no piensa.
 *
 * Tercer puerto con la misma forma que los otros dos: el cobrador que no cobra
 * (`billing/fake.ts`) y el correo que no manda (`mail/none.ts`). Y por la misma
 * razón: sin él, media aplicación no se puede probar sin dar de alta un servicio
 * y empezar a pagar por tokens.
 *
 * **Lo que devuelve sale del dominio, no de un fichero de ejemplos.** Las
 * versiones se construyen aplicando movimientos de verdad de
 * `core/music/reharmonization.ts` a la progresión que se manda, así que pasan la
 * misma verificación que pasaría una respuesta del modelo. Eso es lo que permite
 * probar la pantalla, la reproducción y «ponerla en el camino» sin gastar un
 * céntimo.
 *
 * Lo que **no** prueba, y hay que tenerlo claro: si el modelo de verdad devuelve
 * versiones que valgan la pena. Eso no lo puede decir nada que no sea el modelo.
 * Por eso cada cosa que sale de aquí lo dice en su propio texto: en pantalla se
 * lee «Sin IA», no un título que parezca escrito por alguien.
 */

import {
  applyMove,
  degreesFor,
  MOVES,
  nextDegrees,
  pitchClassFromName,
  resolveProgression,
  roleOfDegreeSymbol,
  type DegreeSymbol,
  type HarmonicRole,
  type KeyMode,
  type NoteName,
} from '@core/music';

/** La marca que llevan todas las respuestas de aquí. Se lee en pantalla. */
export const SIN_IA = 'Sin IA';

interface Peticion {
  readonly tonic: NoteName;
  readonly mode: KeyMode;
  readonly progression: readonly { readonly degree: DegreeSymbol; readonly beats: number }[];
}

/** Lo más largo que puede durar un cierre, en compases. */
const LARGO_MAXIMO_DEL_CIERRE = 4;

/**
 * Qué grado prepara mejor la tónica, de mejor a peor.
 *
 * Es el orden de la cadencia: la dominante es la que tira a casa, la
 * subdominante lleva sin tirar, y las otras dos llegan de rebote.
 */
const PREPARA_MEJOR: readonly HarmonicRole[] = ['dominant', 'subdominant', 'approach', 'tonic'];

/** De los caminos que valen, el que mejor prepara la tónica del final. */
function mejorPreparado(caminos: readonly DegreeSymbol[][]): DegreeSymbol[] | undefined {
  let mejor: DegreeSymbol[] | undefined;
  let mejorRango = PREPARA_MEJOR.length;
  for (const camino of caminos) {
    const previo = camino[camino.length - 2]!;
    const rango = PREPARA_MEJOR.indexOf(roleOfDegreeSymbol(previo));
    if (rango < mejorRango) {
      mejor = camino;
      mejorRango = rango;
    }
  }
  return mejor;
}

/**
 * El cierre: los compases que llevan a casa, **sin pasar por casa antes**.
 *
 * Esto se escribía andando por el grafo «hasta caer en la tónica», con un mínimo
 * de dos compases porque una parte de uno no es una parte. Y el mínimo se
 * cumplía **siguiendo después de haber llegado**: desde un V el primer paso ya
 * daba la tónica, el bucle no podía parar ahí, y el cierre salía `I IV I` —en Mi
 * mayor, «Mi La Mi»—. La tónica dos veces, y sin cadencia ninguna: un cierre que
 * empieza en casa no cierra nada, se va y vuelve.
 *
 * **Un cierre no se alarga hacia delante, se prepara por detrás.** Así que se
 * busca el camino **más corto** que acabe en la tónica y no la toque antes, y
 * entre los que empatan de largo gana el que mejor la prepara. Por anchura y no
 * por profundidad, porque lo que se quiere es el más corto: dos compases, que es
 * lo que mide una cadencia.
 */
function cierreHastaCasa(
  mode: KeyMode,
  desde: DegreeSymbol,
  tonica: DegreeSymbol,
): DegreeSymbol[] | null {
  let frentes: DegreeSymbol[][] = [[]];
  for (let largo = 1; largo <= LARGO_MAXIMO_DEL_CIERRE; largo += 1) {
    const siguientes: DegreeSymbol[][] = [];
    for (const camino of frentes) {
      const ultimo = camino[camino.length - 1] ?? desde;
      for (const salto of nextDegrees(mode, ultimo)) {
        siguientes.push([...camino, salto.to]);
      }
    }
    // Dos compases al menos. No lo pide `pathProblem` —que mira compases— sino
    // `songProblem`, que mira partes: `MIN_BARS_PER_SECTION`. Mirar la primera y
    // creer que un cierre de un compás valía costó un arreglo del revés.
    //
    // Y como los frentes nunca llevan la tónica dentro, aquí solo puede estar al
    // final, que es justo lo que se pide de un cierre.
    const mejor = mejorPreparado(
      siguientes.filter((camino) => camino.length >= 2 && camino.at(-1) === tonica),
    );
    if (mejor !== undefined) {
      return mejor;
    }
    frentes = siguientes.filter((camino) => !camino.includes(tonica));
  }
  return null;
}

/**
 * Salidas construidas por el dominio, no por un modelo.
 *
 * Una por camino, hasta tres, y **cada una se construye con las mismas piezas con
 * las que se valida**: los movimientos de `reharmonization.ts` para rearmonizar y
 * el grafo de `nextDegrees` para alargar. Por eso pasan la misma verificación que
 * pasaría una respuesta del modelo, que es lo que hace que sirvan para probar la
 * pantalla entera sin gastar un céntimo.
 *
 * Lo que **no** prueban sigue siendo lo de siempre: si las salidas de un modelo de
 * verdad valen la pena. Por eso todas llevan «Sin IA» escrito en su título.
 */
export function versionesSinIA(peticion: Peticion): unknown {
  const { mode, progression } = peticion;
  const versions: unknown[] = [];

  // 1. Rearmonizar: un compás de cada dos, con su movimiento declarado.
  for (const move of MOVES) {
    const steps = progression.map((paso, index) => {
      const destino = index % 2 === 1 ? applyMove(mode, paso.degree, move.id) : null;
      return destino === null || destino === paso.degree
        ? { degree: paso.degree, beats: paso.beats, move: null }
        : { degree: destino, beats: paso.beats, move: move.id };
    });

    if (steps.some((paso) => paso.move !== null)) {
      versions.push({
        path: 'rearmonizar',
        title: `${SIN_IA} · ${move.name.toLowerCase()}`,
        why: `${move.why} La ha construido el dominio, no un modelo.`,
        sections: [{ name: 'Lo que llevas', yours: false, steps }],
      });
      break;
    }
  }

  // 2. Seguir: un cierre que lleva a casa preparándola, no pasando por ella.
  const tonica: DegreeSymbol = mode === 'minor' ? 'i' : 'I';
  const ultimo = progression[progression.length - 1]?.degree;
  const camino = ultimo === undefined ? null : cierreHastaCasa(mode, ultimo, tonica);
  if (camino !== null) {
    const cola = camino.map((degree) => ({ degree, beats: 4, move: null }));
    versions.push({
      path: 'seguir',
      title: `${SIN_IA} · cerrar en la tónica`,
      why: 'Un cierre por donde el dominio dice que se suele ir: prepara la tónica y cae en ella.',
      sections: [
        {
          name: 'Lo que llevas',
          yours: true,
          steps: progression.map((paso) => ({ ...paso, move: null })),
        },
        { name: 'Cierre', yours: false, steps: cola },
      ],
    });
  }

  // 3. Otro reparto: el primer compás dura el doble. No toca un solo acorde.
  if (progression.length > 0) {
    versions.push({
      path: 'estirar',
      title: `${SIN_IA} · el primero, el doble`,
      why: 'Los mismos acordes en el mismo orden, con el primero durando el doble.',
      sections: [
        {
          name: 'Lo que llevas',
          yours: false,
          steps: progression.map((paso, index) => ({
            degree: paso.degree,
            beats: index === 0 ? Math.min(16, paso.beats * 2) : paso.beats,
            move: null,
          })),
        },
      ],
    });
  }

  return { versions: versions.slice(0, 3) };
}

/** Ideas construidas con los grados que existen en esa tonalidad. */
export function ideasSinIA(tonic: NoteName, mode: KeyMode): unknown {
  const grados = degreesFor(mode);
  const raiz = pitchClassFromName(tonic);

  const progresiones: readonly DegreeSymbol[][] =
    mode === 'major'
      ? [
          ['I', 'V', 'vi', 'IV'],
          ['I', 'bVII', 'IV', 'I'],
          ['vi', 'IV', 'I', 'V'],
        ]
      : [
          ['i', 'VI', 'III', 'VII'],
          ['i', 'iv', 'v', 'i'],
          ['i', 'VII', 'VI', 'V'],
        ];

  return {
    ideas: progresiones
      .filter((degrees) => degrees.every((degree) => grados.includes(degree)))
      .map((degrees) => ({
        title: `${SIN_IA} · ${resolveProgression(raiz, mode, degrees)
          .map((chord) => chord.symbol)
          .join(' ')}`,
        why: 'Del catálogo del dominio. Con una clave puesta, esto lo escribiría el modelo.',
        degrees,
      })),
  };
}

/** Una respuesta del profesor que dice lo que es. */
export function respuestaSinIA(): unknown {
  return {
    // Declara el tema como cualquier respuesta, porque el validador lo exige a
    // todo el mundo. Un puerto falso que se salte una comprobación deja de servir
    // para lo que existe: probar el camino de verdad sin pagarlo.
    tema: 'musica',
    answer:
      'Aquí no hay modelo conectado, así que esto no es una respuesta de verdad: es lo que ' +
      'contesta la aplicación cuando le falta la clave. Pon ANTHROPIC_API_KEY y vuelve a preguntar.',
  };
}
