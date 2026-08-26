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
  type DegreeSymbol,
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
        sections: [{ name: 'Lo que llevas', tuya: false, steps }],
      });
      break;
    }
  }

  // 2. Seguir: se alarga por el grafo hasta caer en la tónica, como mucho cuatro
  //    compases. Si desde el último grado no se llega, no se propone.
  const tonica = mode === 'minor' ? 'i' : 'I';
  const cola: { degree: DegreeSymbol; beats: number; move: null }[] = [];
  let actual = progression[progression.length - 1]?.degree;
  for (let paso = 0; paso < 4 && actual !== undefined; paso += 1) {
    const siguiente =
      nextDegrees(mode, actual).find((m) => m.to === tonica) ?? nextDegrees(mode, actual)[0];
    if (siguiente === undefined) {
      break;
    }
    cola.push({ degree: siguiente.to, beats: 4, move: null });
    actual = siguiente.to;
    // Se para al llegar a casa, pero no con un solo compás: una parte de uno no
    // es una parte, y el validador la tiraría.
    if (siguiente.to === tonica && cola.length >= 2) {
      break;
    }
  }
  // Dos compases al menos, o no es una parte.
  if (cola.length >= 2 && cola[cola.length - 1]!.degree === tonica) {
    versions.push({
      path: 'seguir',
      title: `${SIN_IA} · cerrar en la tónica`,
      why: 'Sigue por donde el dominio dice que se suele ir, hasta caer en casa.',
      sections: [
        {
          name: 'Lo que llevas',
          tuya: true,
          steps: progression.map((paso) => ({ ...paso, move: null })),
        },
        { name: 'Cierre', tuya: false, steps: cola },
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
          tuya: false,
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
