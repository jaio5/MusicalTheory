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
  cadenciasParaCerrar,
  MOVES,
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
        sections: [{ name: 'Lo que llevas', yours: false, steps }],
      });
      break;
    }
  }

  // 2. Seguir: la mejor cadencia con la que se puede cerrar desde donde acaba.
  const ultimo = progression[progression.length - 1]?.degree;
  const camino = ultimo === undefined ? undefined : cadenciasParaCerrar(mode, ultimo)[0];
  if (camino !== undefined) {
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
