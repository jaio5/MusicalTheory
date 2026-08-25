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
 * Versiones construidas aplicando movimientos de verdad.
 *
 * Una versión por movimiento que sirva para algo en esa progresión, hasta tres.
 * Se cambia **un compás de cada dos como mucho**: una versión que lo cambia todo
 * ya no es la misma canción, y el validador la rechazaría igual que rechaza la
 * del modelo.
 */
export function versionesSinIA(peticion: Peticion): unknown {
  const versions: unknown[] = [];

  for (const move of MOVES) {
    const steps = peticion.progression.map((paso, index) => {
      // Uno de cada dos, y solo si a ese grado se le puede hacer.
      const destino = index % 2 === 1 ? applyMove(peticion.mode, paso.degree, move.id) : null;
      return destino === null || destino === paso.degree
        ? { degree: paso.degree, move: null }
        : { degree: destino, move: move.id };
    });

    if (!steps.some((paso) => paso.move !== null)) {
      continue;
    }

    versions.push({
      title: `${SIN_IA} · ${move.name.toLowerCase()}`,
      why: `${move.why} Esta versión la ha construido el dominio, no un modelo.`,
      steps,
    });

    if (versions.length === 3) {
      break;
    }
  }

  return { versions };
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
    answer:
      'Aquí no hay modelo conectado, así que esto no es una respuesta de verdad: es lo que ' +
      'contesta la aplicación cuando le falta la clave. Pon ANTHROPIC_API_KEY y vuelve a preguntar.',
  };
}
