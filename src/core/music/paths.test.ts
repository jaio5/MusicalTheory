import { describe, expect, it } from 'vitest';

import {
  canFollow,
  songProblem,
  hasSections,
  isValidPath,
  pathProblem,
  PATHS,
  pathById,
  graphText,
  type PathStep,
  type ProposedStep,
} from './paths';
import { degreesFor, nextDegrees } from './progressions';
import { applyMove, MOVES } from './reharmonization';

/** Un movimiento que de verdad se le puede hacer a ese grado, y a dónde lleva. */
function unMovimientoDe(degree: 'i' | 'VI' | 'III' | 'VII') {
  for (const move of MOVES) {
    const destino = applyMove('minor', degree, move.id);
    if (destino !== null && destino !== degree) {
      return { id: move.id, destino };
    }
  }
  throw new Error(`a ${degree} no se le puede hacer nada`);
}

/** Cuatro compases en A menor, la vuelta de siempre. */
const TUYO: readonly PathStep[] = [
  { degree: 'i', beats: 4 },
  { degree: 'VI', beats: 4 },
  { degree: 'III', beats: 4 },
  { degree: 'VII', beats: 4 },
];

const pasos = (...pares: readonly (readonly [string, number])[]): ProposedStep[] =>
  pares.map(([degree, beats]) => ({ degree: degree as ProposedStep['degree'], beats }));

describe('el catálogo de salidas', () => {
  it('cada una tiene id, nombre y porqué, y los ids no se repiten', () => {
    expect(new Set(PATHS.map((p) => p.id)).size).toBe(PATHS.length);
    for (const path of PATHS) {
      expect(path.name.length, path.id).toBeGreaterThan(3);
      expect(path.why.length, path.id).toBeGreaterThan(20);
    }
  });

  it('un id inventado no es una salida', () => {
    expect(pathById('rearmonizar')).not.toBeNull();
    expect(pathById('lo-que-sea')).toBeNull();
    expect(pathById(null)).toBeNull();
  });
});

describe('lo que vale para todas', () => {
  it('devolver tu canción tal cual no es una salida', () => {
    // Es el mismo motivo por el que una rearmonización que no cambia nada se
    // descartaba antes: eso ya lo tienes, y has pagado una petición por ello.
    expect(pathProblem('minor', 'seguir', TUYO, [...TUYO])).toBe('es tu canción tal cual');
  });

  it('un compás de cero pulsos, o de cuarenta, no es un compás', () => {
    expect(
      pathProblem('minor', 'estirar', TUYO, pasos(['i', 0], ['VI', 4], ['III', 4], ['VII', 4])),
    ).toBe('pulsos que no son un compás');
    expect(
      pathProblem('minor', 'estirar', TUYO, pasos(['i', 40], ['VI', 4], ['III', 4], ['VII', 4])),
    ).toBe('pulsos que no son un compás');
  });

  it('una salida no puede pasar de treinta y dos compases', () => {
    const larga = Array.from({ length: 33 }, () => ({ degree: 'i' as const, beats: 4 }));
    expect(pathProblem('minor', 'seguir', TUYO, larga)).toBe('largo fuera de rango');
  });
});

describe('seguir hasta cerrar', () => {
  it('mantiene tus compases, encadena saltos conocidos y cierra en la tónica', () => {
    // VII → i está en el grafo, y termina en la tónica.
    const salida = pasos(['i', 4], ['VI', 4], ['III', 4], ['VII', 4], ['i', 4]);
    expect(pathProblem('minor', 'seguir', TUYO, salida)).toBeNull();
  });

  it('no vale si toca uno de tus compases', () => {
    const salida = pasos(['i', 4], ['iv', 4], ['III', 4], ['VII', 4], ['i', 4]);
    expect(pathProblem('minor', 'seguir', TUYO, salida)).toBe('seguir no mantiene tus compases');
  });

  it('no vale si el salto no está en el grafo', () => {
    // VII → bII no existe en el dominio: VII va a i, III o VI.
    const salida = pasos(['i', 4], ['VI', 4], ['III', 4], ['VII', 4], ['bII', 4], ['i', 4]);
    expect(pathProblem('minor', 'seguir', TUYO, salida)).toBe('un salto que el dominio no conoce');
  });

  it('no vale si no cierra', () => {
    const salida = pasos(['i', 4], ['VI', 4], ['III', 4], ['VII', 4], ['VI', 4]);
    expect(pathProblem('minor', 'seguir', TUYO, salida)).toBe(
      'seguir tiene que cerrar en la tónica',
    );
  });

  it('no vale si no añade nada', () => {
    const salida = pasos(['i', 4], ['VI', 4], ['III', 4], ['i', 4]);
    expect(pathProblem('minor', 'seguir', TUYO, salida)).toBe('seguir tiene que añadir compases');
  });
});

describe('una parte que contraste', () => {
  it('añade una parte que sabe volver al principio y no cierra', () => {
    // VII → VI (grafo), y desde VI se puede volver a i, que es tu primer compás.
    const salida = pasos(['i', 4], ['VI', 4], ['III', 4], ['VII', 4], ['VI', 4]);
    expect(pathProblem('minor', 'contraste', TUYO, salida)).toBeNull();
  });

  it('si cierra en la tónica no es contraste: es seguir', () => {
    // La comprobación que hace que la etiqueta signifique algo. Sin ella el
    // modelo declararía la que le apeteciera.
    const salida = pasos(['i', 4], ['VI', 4], ['III', 4], ['VII', 4], ['i', 4]);
    expect(pathProblem('minor', 'contraste', TUYO, salida)).toBe(
      'contraste no cierra: para eso está seguir',
    );
  });

  it('no vale si la parte nueva no sabe volver al principio', () => {
    // Desde III se va a VII, VI o iv: no hay vuelta a la tónica. Así que una
    // parte que acabe ahí no puede enlazar con tu primer compás, y eso es lo que
    // separa un contraste de una parte que se queda colgada.
    expect(canFollow('minor', 'III', 'i')).toBe(false);

    const salida = pasos(['i', 4], ['VI', 4], ['III', 4], ['VII', 4], ['VI', 4], ['III', 4]);

    expect(pathProblem('minor', 'contraste', TUYO, salida)).toBe(
      'la parte nueva no sabe volver al principio',
    );
  });
});

describe('otro final', () => {
  it('deja en pie la primera mitad y cambia lo que viene después', () => {
    // VI → VII → i: los dos saltos están en el grafo del dominio.
    const salida = pasos(['i', 4], ['VI', 4], ['VII', 4], ['i', 4]);
    expect(pathProblem('minor', 'otro-final', TUYO, salida)).toBeNull();
  });

  it('puede acabar antes', () => {
    const salida = pasos(['i', 4], ['VI', 4], ['VII', 4]);
    expect(pathProblem('minor', 'otro-final', TUYO, salida)).toBeNull();
  });

  it('no vale si se carga la primera mitad', () => {
    const salida = pasos(['iv', 4], ['V', 4], ['i', 4], ['i', 4]);
    expect(pathProblem('minor', 'otro-final', TUYO, salida)).toBe(
      'otro final no deja en pie la primera mitad',
    );
  });

  it('no vale si alarga: para eso está seguir', () => {
    const salida = pasos(['i', 4], ['VI', 4], ['III', 4], ['VII', 4], ['i', 4]);
    expect(pathProblem('minor', 'otro-final', TUYO, salida)).toBe(
      'otro final no alarga: para eso está seguir',
    );
  });
});

describe('otro reparto', () => {
  it('los mismos grados en el mismo orden, durando otra cosa', () => {
    const salida = pasos(['i', 8], ['VI', 2], ['III', 4], ['VII', 4]);
    expect(pathProblem('minor', 'estirar', TUYO, salida)).toBeNull();
  });

  it('no vale si toca un acorde', () => {
    const salida = pasos(['i', 8], ['iv', 2], ['III', 4], ['VII', 4]);
    expect(pathProblem('minor', 'estirar', TUYO, salida)).toBe('estirar no cambia los acordes');
  });
});

describe('rearmonizar, que es lo que ya había', () => {
  it('cambia acordes por sus sustitutos y lo declara', () => {
    const { id, destino } = unMovimientoDe('i');
    const salida: ProposedStep[] = [
      { degree: destino, beats: 4, move: id },
      { degree: 'VI', beats: 4, move: null },
      { degree: 'III', beats: 4, move: null },
      { degree: 'VII', beats: 4, move: null },
    ];

    expect(pathProblem('minor', 'rearmonizar', TUYO, salida)).toBeNull();
  });

  it('un movimiento que no es el que se ha hecho tumba la salida', () => {
    const { id } = unMovimientoDe('i');
    const otro = MOVES.find((m) => m.id !== id)!;
    const salida: ProposedStep[] = [
      { degree: unMovimientoDe('i').destino, beats: 4, move: otro.id },
      { degree: 'VI', beats: 4, move: null },
      { degree: 'III', beats: 4, move: null },
      { degree: 'VII', beats: 4, move: null },
    ];

    expect(pathProblem('minor', 'rearmonizar', TUYO, salida)).toBe(
      'el movimiento declarado no es el que se ha hecho',
    );
  });

  it('declarar un movimiento en un compás que no cambia sigue sin valer', () => {
    // La regla de adr/0011, viva. Decir que no has tocado algo que sí cambió es
    // tan falso como lo otro.
    // Cambia el primer compás de verdad —si no, el descarte sería «es tu canción
    // tal cual»— y encima declara un movimiento en el segundo, que no ha tocado.
    const { id, destino } = unMovimientoDe('i');
    const salida: ProposedStep[] = [
      { degree: destino, beats: 4, move: id },
      { degree: 'VI', beats: 4, move: id },
      { degree: 'III', beats: 4, move: null },
      { degree: 'VII', beats: 4, move: null },
    ];

    expect(pathProblem('minor', 'rearmonizar', TUYO, salida)).toBe(
      'declara un movimiento en un compás que no cambia',
    );
  });

  it('no cambia el largo ni el reparto', () => {
    expect(pathProblem('minor', 'rearmonizar', TUYO, pasos(['i', 4], ['VI', 4], ['III', 4]))).toBe(
      'rearmonizar no cambia el largo',
    );
    expect(
      pathProblem('minor', 'rearmonizar', TUYO, pasos(['i', 8], ['VI', 4], ['III', 4], ['VII', 4])),
    ).toBe('rearmonizar no cambia el reparto');
  });
});

describe('el grafo que se le enseña al modelo', () => {
  it('sale del dominio y no de una lista escrita a mano', () => {
    // Si el prompt ofreciera un salto que el validador no conoce, todas las
    // salidas que lo usaran caerían sin que nadie entendiera por qué.
    const texto = graphText('minor', degreesFor('minor'));

    for (const linea of texto.split('\n')) {
      const [desde, hasta] = linea.split(': ');
      for (const destino of (hasta ?? '').split(' ')) {
        expect(canFollow('minor', desde as never, destino as never), `${desde} → ${destino}`).toBe(
          true,
        );
      }
    }
  });

  it('cubre todos los grados de los dos modos', () => {
    for (const mode of ['minor', 'major'] as const) {
      const grados = degreesFor(mode);
      expect(graphText(mode, grados).split('\n')).toHaveLength(grados.length);
    }
  });
});

describe('isValidPath', () => {
  it('es el motivo, en booleano', () => {
    const buena = pasos(['i', 4], ['VI', 4], ['III', 4], ['VII', 4], ['i', 4]);
    expect(isValidPath('minor', 'seguir', TUYO, buena)).toBe(true);
    expect(isValidPath('minor', 'estirar', TUYO, buena)).toBe(false);
  });
});

describe('una canción con sus partes', () => {
  const parte = (
    name: string,
    yours: boolean,
    pasos: ReadonlyArray<readonly [string, number]>,
  ) => ({
    name,
    yours,
    steps: pasos.map(([degree, beats]) => ({ degree: degree as never, beats })),
  });

  const TU_PARTE = parte('Lo que llevas', true, [
    ['i', 4],
    ['VI', 4],
    ['III', 4],
    ['VII', 4],
  ]);

  it('solo continuar y contrastar traen partes; retocar va en una sola', () => {
    expect(hasSections('seguir')).toBe(true);
    expect(hasSections('contraste')).toBe(true);
    expect(hasSections('rearmonizar')).toBe(false);
    expect(hasSections('estirar')).toBe(false);
    expect(hasSections('otro-final')).toBe(false);
  });

  it('acepta tu parte más un estribillo que cierra', () => {
    // VII → VI y VI → III están en el grafo, pero acaba en III: no cierra.
    const sinCerrar = [
      TU_PARTE,
      parte('Estribillo', false, [
        ['VI', 4],
        ['III', 4],
      ]),
    ];
    expect(songProblem('minor', 'seguir', TUYO, sinCerrar)).toBe(
      'seguir tiene que cerrar en la tónica',
    );

    // VII → VI → VII → i: los tres saltos existen, y termina en casa.
    const cerrando = [
      TU_PARTE,
      parte('Estribillo', false, [
        ['VI', 4],
        ['VII', 4],
        ['i', 4],
      ]),
    ];
    expect(songProblem('minor', 'seguir', TUYO, cerrando)).toBeNull();
  });

  it('tu parte va la primera y va intacta', () => {
    const alReves = [
      parte('Estribillo', false, [
        ['VI', 4],
        ['i', 4],
      ]),
      TU_PARTE,
    ];
    expect(songProblem('minor', 'seguir', TUYO, alReves)).toBe(
      'tu parte va la primera: lo demás es lo que sigue',
    );

    const retocada = [
      parte('Lo que llevas', true, [
        ['i', 4],
        ['iv', 4],
        ['III', 4],
        ['VII', 4],
      ]),
      parte('Estribillo', false, [
        ['VI', 4],
        ['VII', 4],
        ['i', 4],
      ]),
    ];
    expect(songProblem('minor', 'seguir', TUYO, retocada)).toBe('tu parte no es la que tocaste');
  });

  it('hace falta una parte yours, y solo una', () => {
    const ninguna = [
      parte('Estribillo', false, [
        ['i', 4],
        ['VI', 4],
        ['III', 4],
        ['VII', 4],
      ]),
      parte('Cierre', false, [
        ['VI', 4],
        ['VII', 4],
        ['i', 4],
      ]),
    ];
    expect(songProblem('minor', 'seguir', TUYO, ninguna)).toBe(
      'hace falta una parte yours, y solo una',
    );

    const dos = [TU_PARTE, { ...TU_PARTE, name: 'Otra vez' }];
    expect(songProblem('minor', 'seguir', TUYO, dos)).toBe(
      'hace falta una parte yours, y solo una',
    );
  });

  it('una parte sin nombre, o de un compás, no es una parte', () => {
    const sinNombre = [
      TU_PARTE,
      parte('  ', false, [
        ['VI', 4],
        ['i', 4],
      ]),
    ];
    expect(songProblem('minor', 'seguir', TUYO, sinNombre)).toBe(
      'una parte sin nombre, o con un nombre larguísimo',
    );

    const cortísima = [TU_PARTE, parte('Cierre', false, [['i', 4]])];
    expect(songProblem('minor', 'seguir', TUYO, cortísima)).toBe(
      'una parte de un solo compás no es una parte',
    );
  });

  it('las que retocan tus compases no vienen por partes', () => {
    const conPartes = [
      parte('A', false, [
        ['i', 4],
        ['VI', 4],
      ]),
      parte('B', false, [
        ['III', 4],
        ['VII', 4],
      ]),
    ];
    expect(songProblem('minor', 'estirar', TUYO, conPartes)).toBe(
      'esta salida retoca tus compases: va en una sola parte',
    );
  });

  it('las reglas de siempre siguen valiendo sobre las partes pegadas', () => {
    // El salto entre partes se comprueba igual que dentro de una: VII → bII no
    // existe en el dominio, y da igual que caiga justo en la costura.
    const saltoRaro = [
      TU_PARTE,
      parte('Puente', false, [
        ['bII', 4],
        ['i', 4],
      ]),
    ];

    expect(songProblem('minor', 'seguir', TUYO, saltoRaro)).toBe(
      'un salto que el dominio no conoce',
    );
  });

  it('no caben más de cuatro partes', () => {
    const muchas = [
      TU_PARTE,
      parte('B', false, [
        ['i', 4],
        ['iv', 4],
      ]),
      parte('C', false, [
        ['i', 4],
        ['iv', 4],
      ]),
      parte('D', false, [
        ['i', 4],
        ['iv', 4],
      ]),
      parte('E', false, [
        ['i', 4],
        ['iv', 4],
      ]),
    ];

    expect(songProblem('minor', 'seguir', TUYO, muchas)).toBe('número de partes fuera de rango');
  });
});

describe('quedarse en el mismo acorde', () => {
  it('un acorde que dura dos compases no es un salto raro', () => {
    // `nextDegrees` dice a dónde se *va* desde un grado, así que de i no sale i.
    // Sin tratarlo aparte se rechazaba media música: visto con un modelo de
    // verdad, un cierre de dos compases de tónica caía por «salto desconocido».
    expect(nextDegrees('minor', 'i').some((m) => m.to === 'i')).toBe(false);
    expect(canFollow('minor', 'i', 'i')).toBe(true);

    const cierraDosCompases = pasos(
      ['i', 4],
      ['VI', 4],
      ['III', 4],
      ['VII', 4],
      ['i', 4],
      ['i', 4],
    );
    expect(pathProblem('minor', 'seguir', TUYO, cierraDosCompases)).toBeNull();
  });
});

describe('una parte nueva tiene que aportar algo', () => {
  it('un puente que es tu progresión copiada no es un puente', () => {
    // Visto con un modelo de verdad: pasaba todas las reglas —los saltos existen,
    // no cierra, sabe volver— y era tu parte con otro nombre.
    const copia = [
      { name: 'Lo que llevas', yours: true, steps: [...TUYO] },
      { name: 'Puente', yours: false, steps: [...TUYO] },
    ];

    expect(songProblem('minor', 'contraste', TUYO, copia)).toBe(
      'las partes nuevas son tu parte otra vez',
    );
  });

  it('pero repetir vale si alguna otra parte aporta', () => {
    const conAlgoNuevo = [
      { name: 'Lo que llevas', yours: true, steps: [...TUYO] },
      { name: 'Otra vez', yours: false, steps: [...TUYO] },
      {
        name: 'Cierre',
        yours: false,
        steps: [
          { degree: 'VI' as const, beats: 4 },
          { degree: 'VII' as const, beats: 4 },
          { degree: 'i' as const, beats: 4 },
        ],
      },
    ];

    expect(songProblem('minor', 'seguir', TUYO, conAlgoNuevo)).toBeNull();
  });
});

describe('las salidas que se quedan en nada', () => {
  /**
   * Cada etiqueta promete algo, y estas comprobaciones son lo único que hace que
   * la promesa se cumpla. Sin ellas el modelo declararía la que le apeteciera y
   * «otro final» podría ser una canción entera distinta.
   */
  it('un contraste que no añade nada no es un contraste', () => {
    expect(pathProblem('minor', 'contraste', TUYO, pasos(['i', 4], ['VI', 4]))).toBe(
      'contraste tiene que añadir una parte',
    );
  });

  it('un contraste que se carga tus compases, tampoco', () => {
    const salida = pasos(['iv', 4], ['V', 4], ['i', 4], ['VII', 4], ['VI', 4]);

    expect(pathProblem('minor', 'contraste', TUYO, salida)).toBe(
      'contraste no mantiene tus compases',
    );
  });

  it('un contraste con un salto que el dominio no conoce, tampoco', () => {
    // Es lo que separa una parte nueva de una lista de acordes puestos en fila.
    const salida = pasos(['i', 4], ['VI', 4], ['III', 4], ['VII', 4], ['V', 4]);

    expect(pathProblem('minor', 'contraste', TUYO, salida)).toBe(
      'un salto que el dominio no conoce',
    );
  });

  it('un final de un solo compás se queda en nada', () => {
    expect(pathProblem('minor', 'otro-final', TUYO, pasos(['i', 4]))).toBe(
      'otro final se queda en nada',
    );
  });

  it('y uno con un salto desconocido tampoco vale', () => {
    // VI → V no está en el grafo del menor.
    const salida = pasos(['i', 4], ['VI', 4], ['V', 4]);

    expect(pathProblem('minor', 'otro-final', TUYO, salida)).toBe(
      'un salto que el dominio no conoce',
    );
  });
});

describe('una canción que continúa la tuya', () => {
  it('tu parte va la primera, y lo demás es lo que sigue', () => {
    const suyas = [
      { name: 'Lo que sigue', yours: false, steps: pasos(['VI', 4], ['VII', 4], ['i', 4]) },
      { name: 'Lo que llevas', yours: true, steps: [...TUYO] },
    ];

    expect(songProblem('minor', 'seguir', TUYO, suyas)).toBe(
      'tu parte va la primera: lo demás es lo que sigue',
    );
  });

  it('una canción que solo trae tu parte no continúa nada', () => {
    const suyas = [{ name: 'Lo que llevas', yours: true, steps: [...TUYO] }];

    expect(songProblem('minor', 'seguir', TUYO, suyas)).toBe(
      'continuar pide al menos una parte más que la yours',
    );
  });
});
