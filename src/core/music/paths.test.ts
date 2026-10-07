import { describe, expect, it } from 'vitest';

import {
  canFollow,
  songProblem,
  hasSections,
  MAX_PATH_STEPS,
  MAX_SALIDAS_POSIBLES,
  MINIMO_DEL_MENU,
  pathProblem,
  PATHS,
  PATHS_BY_KIND,
  pathById,
  salidasPosibles,
  type PathKind,
  type PathStep,
  type ProposedStep,
  type PathId,
  type SalidaPosible,
  cadenciasParaCerrar,
  candidatasDeSalida,
  ordenarConVariedad,
  porQueNoHaySalidas,
  SIN_SALIDA,
} from './paths';
import type { ContextoDeSalidas } from './contexto-de-salidas';
import { encaje, ENCAJE_MINIMO, pulsosHabituales, vivePrestado } from './encaje';
import { ROLES } from './song';
import { STYLE_IDS, type StyleId } from './styles';
import { degreesFor, resolveDegree, saltosDeSalidas, type DegreeSymbol } from './progressions';
import { roleOfDegreeSymbol } from './harmonic-function';
import type { KeyMode } from './keys';
import { applyMove, MOVES } from './reharmonization';
import {
  esSeventhQuality,
  notasDeEspecieSimple,
  seventhNotes,
  type EspecieDeBloque,
} from './chords';
import { examenesCiegos } from './corpus-ciego';
import { CORPUS, diceAlgoFalso, examinar } from './corpus-de-salidas';
import { examenesFinales } from './corpus-final';
import { CORPUS_DE_VERIFICACION } from './corpus-de-verificacion';

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
  it('no cambia el largo: con otro número de compases ya no son los mismos acordes', () => {
    expect(pathProblem('minor', 'estirar', TUYO, pasos(['i', 8], ['VI', 8]))).toBe(
      'estirar no cambia los acordes',
    );
  });

  it('los mismos grados en el mismo orden, durando otra cosa', () => {
    const salida = pasos(['i', 8], ['VI', 2], ['III', 4], ['VII', 4]);
    expect(pathProblem('minor', 'estirar', TUYO, salida)).toBeNull();
  });

  it('no vale si toca un acorde', () => {
    const salida = pasos(['i', 8], ['iv', 2], ['III', 4], ['VII', 4]);
    expect(pathProblem('minor', 'estirar', TUYO, salida)).toBe('estirar no cambia los acordes');
  });
});

/**
 * Al retocar, el modelo devuelve solo el trozo que cambia y desde qué compás, y
 * esto monta la canción (adr/0086). Monta, no juzga: lo juzga `pathProblem`.
 */
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

    const cortísima = [TU_PARTE, parte('Cierre', false, [['VI', 4]])];
    expect(songProblem('minor', 'seguir', TUYO, cortísima)).toBe(
      'una parte de un solo compás no es una parte',
    );
  });

  /**
   * **La llegada sí**: la tónica sola, al final de un `seguir`, es lo que hace una
   * dominante que se resuelve. Sin esto, de catorce tomas que acababan en V
   * ninguna resolvía a la I: la parte más corta medía dos compases y la tónica no
   * podía ir dos veces.
   */
  it('menos la llegada: la tónica sola al final de un seguir', () => {
    const llegada = [TU_PARTE, parte('Cierre', false, [['i', 4]])];
    expect(songProblem('minor', 'seguir', TUYO, llegada)).toBeNull();

    // Pero solo al final, solo en un seguir y solo la tónica.
    const enMedio = [
      TU_PARTE,
      parte('Cierre', false, [['i', 4]]),
      parte('Coda', false, [
        ['VI', 4],
        ['i', 4],
      ]),
    ];
    expect(songProblem('minor', 'seguir', TUYO, enMedio)).toBe(
      'una parte de un solo compás no es una parte',
    );
    expect(
      songProblem('minor', 'contraste', TUYO, [TU_PARTE, parte('Puente', false, [['VI', 4]])]),
    ).toBe('una parte de un solo compás no es una parte');
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
    // `saltosDeSalidas` dice a dónde se *va* desde un grado, así que de i no sale i.
    // Sin tratarlo aparte se rechazaba media música: visto con un modelo de
    // verdad, un cierre de dos compases de tónica caía por «salto desconocido».
    expect(saltosDeSalidas('minor', 'i').some((m) => m.to === 'i')).toBe(false);
    expect(canFollow('minor', 'i', 'i')).toBe(true);

    // Y sostener un acorde **dentro** de una parte sigue valiendo, que es para lo
    // que está: lo que se mira es la parte entera, no un compás contra el de al lado.
    const sostieneEnMedio = pasos(
      ['i', 4],
      ['VI', 4],
      ['III', 4],
      ['VII', 4],
      ['VII', 4],
      ['i', 4],
    );
    expect(pathProblem('minor', 'seguir', TUYO, sostieneEnMedio)).toBeNull();
  });

  /**
   * **Pero una parte entera de un solo grado no es una parte**, y esto es lo que
   * devolvía el modelo de verdad como cierre: después de un V, `I I`. En Mi mayor,
   * «Mi Mi». Pasaba todas las reglas —añade compases, los saltos valen, acaba en la
   * tónica— y no proponía nada.
   *
   * Aquí se aceptaba a propósito, por miedo a «rechazar media música». Y no se
   * rechaza ninguna: **la misma música se escribe con pulsos**, que llegan a
   * dieciséis. Lo que se va es una manera redundante de escribirla, no un sonido
   * ([adr/0051](../../../docs/adr/0051-un-cierre-se-prepara-por-detras.md)).
   */
  it('pero dos compases de tonica repetida no cierran nada', () => {
    const repetida = pasos(['i', 4], ['VI', 4], ['III', 4], ['VII', 4], ['i', 4], ['i', 4]);
    expect(pathProblem('minor', 'seguir', TUYO, repetida)).toBe(
      'el cierre no se mueve: es el mismo grado repetido',
    );
  });

  /**
   * **Y sostener la tónica dentro de una cadencia sí vale**, que es lo que
   * distingue esta regla de prohibir un acorde largo: `VI i(8)` entra. Lo que no
   * entra es un cierre que sea **solo** la tónica, de cualquier manera que se
   * escriba.
   */
  it('pero una cadencia con la tonica sostenida entra', () => {
    const sostenida = pasos(['i', 4], ['VI', 4], ['III', 4], ['VII', 4], ['VI', 4], ['i', 8]);
    expect(pathProblem('minor', 'seguir', TUYO, sostenida)).toBeNull();
  });

  // Y lo mismo para una parte que contrasta: de un solo grado no es una parte.
  it('una parte que contrasta tampoco puede ser un grado repetido', () => {
    const plana = pasos(['i', 4], ['VI', 4], ['III', 4], ['VII', 4], ['VI', 4], ['VI', 4]);
    expect(pathProblem('minor', 'contraste', TUYO, plana)).toBe(
      'la parte nueva no se mueve: es el mismo grado repetido',
    );
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
    // III → i no está en el grafo del menor.
    const salida = pasos(['i', 4], ['VI', 4], ['III', 4], ['i', 4]);

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

/**
 * **Las cadencias con las que se puede cerrar, enumeradas.**
 *
 * Existen para el prompt: con el cierre pedido en prosa, el modelo contestaba la
 * tónica repetida —`I I I I` a temperatura cero, siempre la misma— y con la lista
 * delante contesta `IV I`
 * ([adr/0051](../../../docs/adr/0051-un-cierre-se-prepara-por-detras.md)). Y las usa
 * también el modelo que no piensa para construir el suyo.
 */
describe('las cadencias para cerrar', () => {
  /** Cada grado de los dos modos: desde cualquiera se puede acabar una canción. */
  function todosLosGrados(): { mode: KeyMode; desde: DegreeSymbol }[] {
    return (['major', 'minor'] as KeyMode[]).flatMap((mode) =>
      (degreesFor(mode) as readonly DegreeSymbol[]).map((desde) => ({ mode, desde })),
    );
  }

  /**
   * Lo que sostiene el `v8 ignore` del `return []` de `cadenciasParaCerrar`: desde
   * cualquier grado del catálogo se llega a casa en cuatro pasos o menos.
   */
  it('desde cualquier grado hay alguna', () => {
    for (const { mode, desde } of todosLosGrados()) {
      expect(cadenciasParaCerrar(mode, desde).length, `${mode} desde ${desde}`).toBeGreaterThan(0);
    }
  });

  it('todas acaban en la tonica y no la tocan antes', () => {
    for (const { mode, desde } of todosLosGrados()) {
      const tonica = mode === 'minor' ? 'i' : 'I';
      for (const cadencia of cadenciasParaCerrar(mode, desde)) {
        expect(cadencia.at(-1), `${mode} desde ${desde}`).toBe(tonica);
        expect(
          cadencia.filter((grado) => grado === tonica),
          `${mode} desde ${desde}`,
        ).toHaveLength(1);
      }
    }
  });

  /**
   * De uno a tres compases. **Desde el V, la primera es la I sola**: lo que pide
   * una dominante es resolver, y antes la más corta medía dos compases a la fuerza.
   */
  it('miden de uno a tres compases, y desde el V la primera es resolver', () => {
    for (const { mode, desde } of todosLosGrados()) {
      for (const cadencia of cadenciasParaCerrar(mode, desde)) {
        expect(cadencia.length, `${mode} desde ${desde}`).toBeGreaterThanOrEqual(1);
        expect(cadencia.length, `${mode} desde ${desde}`).toBeLessThanOrEqual(3);
      }
    }
    expect(cadenciasParaCerrar('major', 'V')[0]).toEqual(['I']);
    expect(cadenciasParaCerrar('minor', 'V')[0]).toEqual(['i']);
  });

  // Y todas son legales: cada salto está en el grafo, empezando por el que sale
  // del grado donde te quedaste.
  it('todos sus saltos estan en el grafo', () => {
    for (const { mode, desde } of todosLosGrados()) {
      for (const cadencia of cadenciasParaCerrar(mode, desde)) {
        let anterior = desde;
        for (const grado of cadencia) {
          expect(canFollow(mode, anterior, grado), `${mode}: ${anterior} a ${grado}`).toBe(true);
          anterior = grado;
        }
      }
    }
  });

  // La mejor primero: la que prepara la tónica con una dominante antes que con
  // otra cosa. Desde IV en mayor, `V I` va delante de las demás.
  it('la que mejor prepara va primera', () => {
    expect(cadenciasParaCerrar('major', 'IV')[0]).toEqual(['V', 'I']);
  });
});

/** Un generador con semilla: las mismas canciones cada vez que corre. */
function aleatorio(semilla: number): () => number {
  let estado = semilla;
  return () => {
    estado = (estado * 1103515245 + 12345) % 2147483648;
    return estado / 2147483648;
  };
}

/** Canciones de dos a treinta y dos compases, por el grafo o a saltos sueltos. */
function canciones(mode: KeyMode, cuantas: number, semilla: number): PathStep[][] {
  const azar = aleatorio(semilla);
  const grados = degreesFor(mode) as readonly DegreeSymbol[];
  return Array.from({ length: cuantas }, (_, n) => {
    const largo = 2 + Math.floor(azar() * 31);
    const pasos: PathStep[] = [];
    let grado = grados[Math.floor(azar() * grados.length)]!;
    for (let i = 0; i < largo; i += 1) {
      pasos.push({ degree: grado, beats: 1 + Math.floor(azar() * 16) });
      // La mitad sigue el grafo y la otra mitad salta a cualquiera: lo grabado
      // no tiene por qué respetarlo.
      const saltos = saltosDeSalidas(mode, grado);
      grado =
        n % 2 === 0
          ? saltos[Math.floor(azar() * saltos.length)]!.to
          : grados[Math.floor(azar() * grados.length)]!;
    }
    return pasos;
  });
}

const cancionDe = (salida: SalidaPosible) =>
  salida.secciones.flatMap((s) => s.steps).map((p) => `${p.degree}/${p.beats}`);

/**
 * El menú: las salidas que construye el dominio para que el modelo elija.
 *
 * Lo que sostiene todo lo demás es la primera prueba: **todo lo que entra en el
 * menú es válido**, porque el modelo contesta con un número y no hay nada más que
 * comprobar después. Se recorre con miles de canciones y no con tres.
 */
describe('las salidas posibles', () => {
  it('todo lo que hay en el menú pasa el validador, en los dos modos y las dos clases', () => {
    for (const mode of ['major', 'minor'] as const) {
      const todas = [
        ...canciones(mode, 200, mode === 'major' ? 7 : 11),
        ...(degreesFor(mode) as readonly DegreeSymbol[]).flatMap((a) =>
          (degreesFor(mode) as readonly DegreeSymbol[]).map((b) => [
            { degree: a, beats: 4 },
            { degree: b, beats: 4 },
          ]),
        ),
      ];
      for (const original of todas) {
        for (const kind of ['continuar', 'retocar'] as PathKind[]) {
          for (const salida of salidasPosibles(mode, kind, original)) {
            const donde = `${mode} ${kind} ${original.map((p) => `${p.degree}/${p.beats}`).join(' ')} → ${salida.path}`;
            expect(songProblem(mode, salida.path, original, salida.secciones), donde).toBeNull();
            expect(PATHS_BY_KIND[kind], donde).toContain(salida.path);
            expect(salida.nombre.length, donde).toBeLessThanOrEqual(60);
            expect(salida.que.length, donde).toBeLessThanOrEqual(200);
          }
        }
      }
    }
    // Son unos miles de menús: con toda la batería a la vez no caben en cinco segundos.
  }, 30_000);

  it('nunca más de lo que cabe en el prompt', () => {
    for (const mode of ['major', 'minor'] as const) {
      for (const original of canciones(mode, 150, 3)) {
        for (const kind of ['continuar', 'retocar'] as PathKind[]) {
          expect(salidasPosibles(mode, kind, original).length).toBeLessThanOrEqual(
            MAX_SALIDAS_POSIBLES,
          );
        }
      }
    }
  });

  it('son siempre las mismas: el modelo contesta por número', () => {
    const [original] = canciones('minor', 1, 5);

    expect(salidasPosibles('minor', 'retocar', original!)).toEqual(
      salidasPosibles('minor', 'retocar', original!),
    );
  });

  it('no hay dos iguales, y nunca entra lo que el juez descarta', () => {
    for (const kind of ['continuar', 'retocar'] as PathKind[]) {
      const salidas = salidasPosibles('minor', kind, TUYO);

      expect(new Set(salidas.map((s) => cancionDe(s).join(' '))).size).toBe(salidas.length);
      for (const salida of salidas) {
        expect(salida.encaje?.descarte).toBeNull();
        expect(salida.encaje!.puntos).toBeGreaterThanOrEqual(ENCAJE_MINIMO);
      }
    }
  });

  it('sin compases no hay nada que ofrecer', () => {
    expect(salidasPosibles('major', 'retocar', [])).toEqual([]);
    expect(candidatasDeSalida('major', 'retocar', [])).toEqual([]);
  });

  it('lo tocado con pulsos desiguales se puede cuadrar, a la media si empatan', () => {
    const grabada: PathStep[] = [
      { degree: 'i', beats: 5 },
      { degree: 'VII', beats: 3 },
      { degree: 'VI', beats: 5 },
      { degree: 'VII', beats: 3 },
    ];
    const retoques = candidatasDeSalida('minor', 'retocar', grabada);
    const cuadrada = retoques.find((s) => s.nombre === 'Cuadrada a 4 pulsos');

    expect(cuadrada && cancionDe(cuadrada)).toEqual(['i/4', 'VII/4', 'VI/4', 'VII/4']);
    expect(cuadrada?.colores).toContain('cuadra');
    // A medio tiempo y a doble tiempo, cuadrada antes: heredar el 5 y el 3 sería
    // doblar el accidente de la toma.
    const medio = retoques.find((s) => s.nombre === 'A medio tiempo');
    expect(medio && cancionDe(medio)).toEqual(['i/8', 'VII/8', 'VI/8', 'VII/8']);
    expect(medio?.colores).toContain('cuadra');
    const doble = retoques.find((s) => s.nombre === 'A doble tiempo');
    expect(doble && cancionDe(doble)).toEqual(['i/2', 'VII/2', 'VI/2', 'VII/2']);
  });

  it('a doble tiempo no deja compases de un pulso', () => {
    const rapida = pasos(['I', 2], ['IV', 2], ['V', 2], ['I', 2]);
    const nombres = candidatasDeSalida('major', 'retocar', rapida).map((s) => s.nombre);

    expect(nombres).not.toContain('A doble tiempo');
    expect(nombres).toContain('A medio tiempo');
  });

  it('lo que se añade dura lo que más se repite en lo tuyo', () => {
    const grabada: PathStep[] = [
      { degree: 'i', beats: 7 },
      { degree: 'iv', beats: 1 },
      { degree: 'i', beats: 4 },
      { degree: 'V', beats: 4 },
    ];
    for (const salida of candidatasDeSalida('minor', 'continuar', grabada)) {
      for (const seccion of salida.secciones.slice(1)) {
        expect(
          seccion.steps.every((paso) => paso.beats === 4),
          salida.nombre,
        ).toBe(true);
      }
    }
  });

  it('con treinta y dos compases no cabe nada más, y retocar sigue sirviendo', () => {
    const larga = Array.from({ length: 32 }, (_, i) => TUYO[i % 4]!);
    const antes = performance.now();

    expect(salidasPosibles('minor', 'continuar', larga)).toEqual([]);
    expect(salidasPosibles('minor', 'retocar', larga).length).toBeGreaterThan(0);
    // Y rápido: se construye dos veces por petición, al escribir el prompt y al validar.
    expect(performance.now() - antes).toBeLessThan(500);
  });

  it('los cambios iguales van juntos, y con muchos dice cuántos más', () => {
    const larga = Array.from({ length: 24 }, (_, i) => TUYO[i % 4]!);
    const relativos = candidatasDeSalida('minor', 'retocar', larga).find(
      (s) => s.nombre === 'Su relativo, donde cabe',
    );

    expect(relativos?.que).toMatch(
      /^Cambia \S+ por \S+ en el \d+, el \d+, el \d+, el \d+ y \d+ más \(su relativo\)/u,
    );
    // El primer compás no se toca: «donde cabe» cambiaba la tónica del 1 y la
    // canción pasaba a estar en otra tonalidad.
    expect(cancionDe(relativos!)[0]).toBe('i/4');
  });
});

/** Lo que hace falta de una canción para escribirla rápido: grados a cuatro pulsos. */
const a4 = (...grados: DegreeSymbol[]): PathStep[] =>
  grados.map((degree) => ({ degree, beats: 4 }));

/** Los grados que añade una salida al continuar. */
const añadidos = (salida: SalidaPosible) =>
  salida.secciones.filter((s) => !s.yours).flatMap((s) => s.steps.map((p) => p.degree));

const pulsosDeLaCancion = (salida: SalidaPosible) =>
  salida.secciones.flatMap((s) => s.steps).reduce((total, p) => total + p.beats, 0);

// --- Siempre hay donde elegir -------------------------------------------------

/**
 * Un generador con semilla que no se repite (mulberry32). El de arriba trabaja con
 * enteros que pasan de 2^53 y pierde precisión: a las pocas decenas de canciones
 * empieza a dar las mismas, y una prueba de propiedad que repite casos no prueba
 * lo que dice.
 */
function semillero(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ESPECIES_AL_AZAR: readonly EspecieDeBloque[] = [
  'quinta',
  'sus2',
  'sus4',
  'dominant7',
  'major7',
  'minor7',
  'halfDiminished7',
  'diminished7',
];

interface CancionAlAzar {
  readonly mode: KeyMode;
  readonly original: readonly PathStep[];
  readonly contexto: ContextoDeSalidas;
}

/**
 * Una canción cualquiera con su contexto: de 1 a 32 compases, por el grafo o a
 * saltos, a dos, cuatro u ocho pulsos, en vals o tocada desigual, con o sin
 * especies, papel, punteo y dudas. **El estilo va por turno** —los seis y sin
 * estilo— para que ninguno se quede sin probar por azar.
 */
function cancionAlAzar(azar: () => number, n: number): CancionAlAzar {
  const elegir = <T>(lista: readonly T[]): T => lista[Math.floor(azar() * lista.length)]!;
  const mode: KeyMode = n % 2 === 0 ? 'major' : 'minor';
  const grados = degreesFor(mode) as readonly DegreeSymbol[];
  const vals = azar() < 0.15;
  const tipo = azar();
  const pulsos = vals ? 3 : tipo < 0.6 ? 4 : tipo < 0.75 ? 2 : tipo < 0.9 ? 8 : 0;
  const porElGrafo = azar() < 0.6;
  const original: PathStep[] = [];
  let grado = elegir(grados);
  for (let i = 1 + Math.floor(azar() * 32); i > 0; i -= 1) {
    original.push({ degree: grado, beats: pulsos === 0 ? 1 + Math.floor(azar() * 8) : pulsos });
    grado = porElGrafo ? elegir(saltosDeSalidas(mode, grado)).to : elegir(grados);
  }
  const estilos: readonly (StyleId | undefined)[] = [undefined, ...STYLE_IDS];
  const estilo = estilos[Math.floor(n / 2) % estilos.length];
  const contexto: { -readonly [K in keyof ContextoDeSalidas]: ContextoDeSalidas[K] } = {};
  if (estilo !== undefined) {
    contexto.estilo = estilo;
  }
  if (vals) {
    contexto.pulsosPorCompas = 3;
  }
  if (azar() < 0.4) {
    const todas = elegir<EspecieDeBloque | null>(['dominant7', 'quinta', null]);
    contexto.especies = original.map(() =>
      todas !== null || azar() < 0.5 ? todas : elegir(ESPECIES_AL_AZAR),
    );
  }
  if (azar() < 0.4) {
    contexto.papel = elegir(ROLES).id;
  }
  if (azar() < 0.3) {
    contexto.melodia = original.map(() =>
      Array.from({ length: Math.floor(azar() * 4) }, () => ({
        nota: Math.floor(azar() * 12),
        fuerte: azar() < 0.5,
      })),
    );
  }
  if (azar() < 0.2) {
    contexto.dudosos = original.map(() => azar() < 0.3);
  }
  return { mode, original, contexto };
}

/** Los grados a los que solo se llega desde la tónica, o desde ninguno. */
function sinVuelta(mode: KeyMode): ReadonlySet<DegreeSymbol> {
  const tonica = mode === 'major' ? 'I' : 'i';
  const grados = degreesFor(mode) as readonly DegreeSymbol[];
  const llegan = new Set(
    grados.filter((g) => g !== tonica).flatMap((g) => saltosDeSalidas(mode, g).map((m) => m.to)),
  );
  return new Set(grados.filter((g) => !llegan.has(g)));
}

/**
 * Por qué una canción puede tener menos de tres salidas, si lo puede. **Cada una
 * es un límite de la música o del gasto, no del generador**, y la prueba exige
 * además que, cuando pasa, el menú enseñe todo lo que se ha podido construir.
 */
function porQueHayMenos(
  kind: PathKind,
  { mode, original, contexto }: CancionAlAzar,
): string | null {
  const largo = original.length;
  const compas = contexto.pulsosPorCompas ?? 4;
  const pasosDeUnaFrase = Math.ceil((4 * compas) / pulsosHabituales(original, compas));
  // Lo que se añade cuadra la frase: lo que le falta a la tuya, o eso y una frase
  // más. Si no caben las dos dentro de los 32 compases —el tope de la factura—,
  // queda la mitad de las maneras de seguir, o ninguna.
  if (kind === 'continuar' && MAX_PATH_STEPS - largo <= 2 * pasosDeUnaFrase) {
    return 'no caben dos frases';
  }
  // Al acorde con el que empiezas solo se llega desde la tónica: una parte que
  // contrasta no puede volver a él sin cerrar antes, y entonces es un «seguir».
  if (kind === 'continuar' && sinVuelta(mode).has(original[0]!.degree)) {
    return 'nadie vuelve a tu primer acorde';
  }
  // Con tres compases o menos, el primero dice la tonalidad y no se toca, la
  // llegada tampoco, y a lo que queda puede no haberle sustituto que encaje.
  if (kind === 'retocar' && largo <= 3) {
    return 'retoque de tres compases o menos';
  }
  // En quintas, el relativo no comparte notas y cambiar mayor por menor no cambia
  // ninguna: de los sustitutos de un compás quedan pocos.
  if (kind === 'retocar' && contexto.especies?.every((especie) => especie === 'quinta')) {
    return 'en quintas apenas hay sustitutos';
  }
  // Un final solo se cierra, y en pocos compases: ni puentes que lo dejen abierto
  // ni codas que sean otra canción. Desde según qué acorde hay una o dos maneras.
  if (contexto.papel === 'final') {
    return 'un final solo se cierra';
  }
  // Lo que choca con las notas fuertes de tu punteo no se construye.
  if (kind === 'retocar' && contexto.melodia?.some((notas) => notas.some((n) => n.fuerte))) {
    return 'el punteo no deja';
  }
  // Una canción que vive de la mezcla con el menor no admite los sustitutos de la
  // escala de manual —el vi, el ii, las secundarias—: de un compás quedan pocos.
  if (
    kind === 'retocar' &&
    vivePrestado(
      mode,
      original.map((paso) => paso.degree),
    )
  ) {
    return 'lo prestado deja pocos sustitutos';
  }
  return null;
}

/**
 * **Siempre hay donde elegir.** Antes, con canciones al azar, el menú salía vacío
 * una vez de cada cien: tomas desiguales que pedían compases de un pulso, canciones
 * largas a dos pulsos que no cabían, un primer acorde al que no volvía nadie, un
 * generador que construía lo que el juez iba a descartar.
 */
describe('siempre hay donde elegir', () => {
  it('al menos tres salidas sin descarte, o todas las que existen y por qué', () => {
    const azar = semillero(2026);
    const excepciones = new Map<string, number>();
    let menus = 0;
    for (let n = 0; n < 700; n += 1) {
      const cancion = cancionAlAzar(azar, n);
      const { mode, original, contexto } = cancion;
      for (const kind of ['continuar', 'retocar'] as const) {
        menus += 1;
        const menu = salidasPosibles(mode, kind, original, contexto);
        const donde = `${mode} ${kind} ${JSON.stringify(contexto)} ${original.map((p) => `${p.degree}/${p.beats}`).join(' ')}`;
        expect(menu.length, donde).toBeLessThanOrEqual(MAX_SALIDAS_POSIBLES);
        // Un menú vacío llega siempre con su porqué, y solo cuando lo hay; y el porqué
        // es un límite de la música o del gasto, nunca «no sé».
        const porQue = porQueNoHaySalidas(mode, kind, original, contexto);
        expect(menu.length === 0, donde).toBe(porQue !== null);
        expect(porQue, donde).not.toBe(SIN_SALIDA);
        for (const salida of menu) {
          expect(salida.encaje?.descarte, donde).toBeNull();
        }
        if (menu.length >= MINIMO_DEL_MENU) {
          continue;
        }
        // Un menú vacío ya trae su porqué; uno corto, el de la lista de límites.
        const motivo = porQue ?? porQueHayMenos(kind, cancion);
        expect(motivo, donde).not.toBeNull();
        // Y lo que hay, entero: la red deja entrar todo lo que no tiene descarte.
        const validas = candidatasDeSalida(mode, kind, original, contexto).filter(
          (c) =>
            encaje(mode, kind, original, contexto, {
              path: c.path,
              cancion: c.secciones.flatMap((s) => s.steps),
            }).descarte === null,
        );
        expect(menu.length, donde).toBe(validas.length);
        excepciones.set(motivo!, (excepciones.get(motivo!) ?? 0) + 1);
      }
    }
    expect(menus).toBe(1400);
    // Las excepciones son eso: casi todas, un acorde suelo o una canción en el tope.
    const total = [...excepciones.values()].reduce((suma, veces) => suma + veces, 0);
    expect(total / menus).toBeLessThan(0.1);
    // Son unos cientos de menús con contexto: con la cobertura puesta van lentos.
  }, 60_000);

  it('cuando no cabe nada detrás, se dice por qué; retocar siempre tiene algo', () => {
    const llena = Array.from({ length: MAX_PATH_STEPS }, (_, i) => ({
      degree: (['I', 'vi', 'IV', 'V'] as const)[i % 4]!,
      beats: 4,
    }));
    expect(salidasPosibles('major', 'continuar', llena)).toEqual([]);
    expect(porQueNoHaySalidas('major', 'continuar', llena)).toContain(`${MAX_PATH_STEPS} acordes`);
    expect(porQueNoHaySalidas('major', 'retocar', llena)).toBeNull();
    expect(salidasPosibles('major', 'retocar', llena).length).toBeGreaterThanOrEqual(
      MINIMO_DEL_MENU,
    );
    expect(porQueNoHaySalidas('major', 'continuar', [])).not.toBeNull();
    expect(porQueNoHaySalidas('major', 'continuar', a4('I'))).toBeNull();
    // Con un acorde de sitio, solo si ese acorde es la llegada.
    const casi = llena.slice(1);
    expect(porQueNoHaySalidas('major', 'continuar', casi)).toBeNull();
    expect(salidasPosibles('major', 'continuar', casi)[0]!.nombre).toBe('Resuelve en la I');
    expect(porQueNoHaySalidas('major', 'continuar', llena.slice(2))).toBeNull();
    // Un III7 no va a casa en un paso: con un acorde de sitio, no hay llegada.
    const sinLlegada = [...casi.slice(0, -1), { degree: 'V/vi' as const, beats: 4 }];
    expect(porQueNoHaySalidas('major', 'continuar', sinLlegada)).toContain('solo cabe uno más');
  });

  it('si lo que llega al mínimo no da para elegir, entra lo mejor de lo demás, detrás', () => {
    // Un bucle raro —un VII7 al final que no prepara nada de lo que hay—: dos
    // salidas llegan al mínimo, y la tercera entra por la red. Era `IV bVII V/iii`, y
    // desde que el compás 1 se puede cambiar cuando es la predominante, ese tiene tres
    // que llegan: el de ahora abre en la tónica, que no se toca.
    const raro = pasos(['I', 4], ['ii', 4], ['V/iii', 4]);
    const menu = salidasPosibles('major', 'retocar', raro);
    const puntos = menu.map((s) => s.encaje!.puntos);

    expect(menu.length).toBeGreaterThanOrEqual(MINIMO_DEL_MENU);
    expect(puntos.some((p) => p < ENCAJE_MINIMO)).toBe(true);
    // Lo de la red va detrás de todo lo que sí llega.
    const primeraFlojita = puntos.findIndex((p) => p < ENCAJE_MINIMO);
    expect(puntos.slice(primeraFlojita).every((p) => p < ENCAJE_MINIMO)).toBe(true);
  });
});

/**
 * Lo que se construye al continuar, **antes del juez**: si una buena salida no se
 * construye, nadie puede elegirla.
 */
describe('lo que se construye al continuar', () => {
  /**
   * Lo que acaba en V se resuelve. Antes ninguna de catorce tomas lo hacía: la
   * primera salida era `V → IV I`.
   */
  it('lo que acaba en V se resuelve, y lo mejor del generador resuelve', () => {
    const tomas = [a4('vi', 'IV', 'I', 'V'), a4('I', 'IV', 'I', 'V'), a4('I', 'vi', 'ii', 'V')];
    for (const toma of tomas) {
      const seguir = candidatasDeSalida('major', 'continuar', toma).filter(
        (s) => s.path === 'seguir',
      );
      const mejor = [...seguir].sort((a, b) => b.prioridad - a.prioridad)[0]!;
      expect(añadidos(mejor)[0], toma.map((p) => p.degree).join(' ')).toBe('I');
    }
    // Y la andaluza, con su V.
    const andaluza = candidatasDeSalida('minor', 'continuar', [
      ...a4('i', 'VII', 'VI', 'V'),
    ]).filter((s) => s.path === 'seguir');
    expect(andaluza.some((s) => añadidos(s)[0] === 'i')).toBe(true);
  });

  it('con un compás de sitio, la llegada sola en ese compás', () => {
    const [llegada] = candidatasDeSalida('major', 'continuar', a4('I', 'IV', 'V')).filter(
      (s) => s.familia === 'resuelve',
    );

    expect(llegada && cancionDe(llegada)).toEqual(['I/4', 'IV/4', 'V/4', 'I/4']);
    expect(llegada?.que).toContain('desde la dominante, V');
  });

  /**
   * Las frases se cuentan de cuatro en cuatro: antes el 41 % de las canciones
   * quedaban en seis, siete, diez u once compases.
   */
  it('todo lo que se construye acaba en frase', () => {
    for (const mode of ['major', 'minor'] as const) {
      for (const original of [
        ...canciones(mode, 60, 17).map((c) => c.map((p) => ({ ...p, beats: 4 }))),
        ...canciones(mode, 30, 19).map((c) => c.slice(0, 6).map((p) => ({ ...p, beats: 2 }))),
      ]) {
        const tuya = original.reduce((suma, paso) => suma + paso.beats, 0);
        for (const salida of candidatasDeSalida(mode, 'continuar', original)) {
          const pulsos = pulsosDeLaCancion(salida);
          // O cuadra la frase, o contesta una idea de menos de media frase con otra
          // igual de larga: un riff de un compás y su respuesta.
          const contesta = tuya * 2 <= 16 && pulsos === tuya * 2;
          // O sigue una forma tuya de frases que no son de cuatro: tres y tres.
          const suForma = [3, 5, 6, 7].some((k) => tuya % (4 * k) === 0 && pulsos % (4 * k) === 0);
          expect(pulsos % 16 === 0 || contesta || suForma, `${mode} ${salida.nombre}`).toBe(true);
        }
      }
    }
  });

  it('a dos pulsos por acorde, el cierre dura el compás entero', () => {
    const rapida = [...pasos(['I', 2], ['IV', 2], ['V', 2], ['IV', 2])];
    for (const salida of candidatasDeSalida('major', 'continuar', rapida)) {
      const ultimo = salida.secciones.at(-1)!.steps.at(-1)!;
      if (salida.path === 'seguir') {
        expect(ultimo.beats, salida.nombre).toBe(4);
      }
      // Y nada se estira para rellenar: un acorde, como mucho, un compás.
      for (const paso of salida.secciones.slice(1).flatMap((s) => s.steps)) {
        expect(paso.beats).toBeLessThanOrEqual(4);
      }
    }
  });

  it('una frase larga va en dos partes, la última es el cierre', () => {
    const rapida = [
      ...pasos(['I', 2], ['vi', 2], ['ii', 2], ['V', 2], ['I', 2], ['vi', 2], ['ii', 2], ['V', 2]),
    ];
    const enDos = candidatasDeSalida('major', 'continuar', rapida).find(
      (s) => s.path === 'seguir' && s.secciones.length === 3,
    );

    expect(enDos?.secciones.at(-1)?.name).toBe('Cierre');
  });

  it('desde cualquier grado hay algún seguir que cierra en la tónica', () => {
    for (const mode of ['major', 'minor'] as const) {
      const tonica = mode === 'major' ? 'I' : 'i';
      for (const ultimo of degreesFor(mode) as readonly DegreeSymbol[]) {
        const original = a4(ultimo === tonica ? (mode === 'major' ? 'IV' : 'iv') : tonica, ultimo);
        const seguir = candidatasDeSalida(mode, 'continuar', original).filter(
          (s) => s.path === 'seguir',
        );
        expect(seguir.length, `${mode} ${ultimo}`).toBeGreaterThan(0);
      }
    }
  });

  it('una segunda vuelta repite tu frase y cambia solo el final', () => {
    const vuelta = candidatasDeSalida('major', 'continuar', a4('vi', 'IV', 'I', 'V')).find(
      (s) => s.familia === 'segunda-vuelta',
    );

    expect(vuelta && añadidos(vuelta)).toEqual(['vi', 'IV', 'V', 'I']);
    expect(vuelta?.que).toContain('los últimos 2 compases pasan a V I');
  });

  it('una segunda vuelta de una toma desigual va a tiempo', () => {
    const desigual = pasos(['I', 5], ['V', 3], ['vi', 6], ['V', 2]);
    const vuelta = candidatasDeSalida('major', 'continuar', desigual).find(
      (s) => s.familia === 'segunda-vuelta',
    );

    expect(vuelta?.secciones[1]!.steps.every((p) => p.beats === 4)).toBe(true);
  });

  /** Un vaivén que no gira en la tónica: cerrarlo en ella se carga el modo. */
  it('un vaivén dórico no se cierra en la tónica: se va y vuelve', () => {
    const salidas = candidatasDeSalida('major', 'continuar', a4('ii', 'V', 'ii', 'V'));

    expect(salidas.length).toBeGreaterThan(0);
    expect(salidas.every((s) => s.path === 'contraste')).toBe(true);
  });

  /** Lo que sigue a un blues es otro coro, o la tónica en el 13. */
  describe('un blues', () => {
    const BLUES = a4('I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V');

    it('sigue con otro coro de doce, o acaba en la I del 13', () => {
      const salidas = candidatasDeSalida('major', 'continuar', BLUES);

      expect(salidas.length).toBeGreaterThan(2);
      for (const salida of salidas) {
        expect(salida.path).toBe('seguir');
        expect([1, 12]).toContain(añadidos(salida).length);
        expect(añadidos(salida).at(-1)).toBe('I');
      }
      expect(salidas.map((s) => s.nombre)).toContain('Acaba en la I del 13');
    });

    it('con el estilo, suena con sus séptimas', () => {
      const [coro] = candidatasDeSalida('major', 'continuar', BLUES, { estilo: 'blues' }).filter(
        (s) => s.familia === 'coro',
      );
      const ultimo = coro!.secciones[1]!.steps.at(-1)!;

      expect(ultimo).toMatchObject({ degree: 'I', especie: 'dominant7' });
    });

    it('si ya acaba en casa, el coro nuevo cambia otra cosa', () => {
      const rapido = a4('I', 'IV', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'I');
      const nombres = candidatasDeSalida('major', 'continuar', rapido).map((s) => s.nombre);

      const salidas = candidatasDeSalida('major', 'continuar', rapido);
      expect(salidas.find((s) => s.familia === 'coro')?.que).toContain(
        'sin el cambio rápido al IV en su compás 2',
      );
      expect(nombres).toContain('Otro coro con el V en su compás 10');
    });

    it('en menor, con el iv', () => {
      const menor = a4('i', 'i', 'i', 'i', 'iv', 'iv', 'i', 'i', 'V', 'iv', 'i', 'V');
      const salidas = candidatasDeSalida('minor', 'continuar', menor);

      expect(salidas.some((s) => añadidos(s).includes('ii°'))).toBe(true);
    });

    it('sin el cambio rápido, el coro nuevo lo pone; con el V en el 10, lo quita', () => {
      const lento = a4('I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'V', 'I', 'I');
      const salidas = candidatasDeSalida('major', 'continuar', lento, { estilo: 'jazz' });

      expect(salidas.find((s) => s.familia === 'coro')?.que).toContain(
        'con el cambio rápido al IV en su compás 2',
      );
      expect(salidas.map((s) => s.nombre)).toContain('Otro coro con el IV en su compás 10');
    });

    it('en menor, también con la dominante menor en el 9', () => {
      const menor = a4('i', 'i', 'i', 'i', 'iv', 'iv', 'i', 'i', 'v', 'iv', 'i', 'i');
      expect(candidatasDeSalida('minor', 'continuar', menor).length).toBeGreaterThan(0);
    });
  });

  it('con un compás de vals, la frase mide cuatro de tres', () => {
    const vals = pasos(['I', 3], ['IV', 3], ['V', 3]);
    for (const salida of candidatasDeSalida('major', 'continuar', vals, { pulsosPorCompas: 3 })) {
      expect(pulsosDeLaCancion(salida) % 12, salida.nombre).toBe(0);
    }
    // Un compás que no es un compás se lee como cuatro por cuatro.
    for (const salida of candidatasDeSalida('major', 'continuar', a4('I', 'V'), {
      pulsosPorCompas: 0,
    })) {
      expect(pulsosDeLaCancion(salida) % 16, salida.nombre).toBe(0);
    }
  });

  // Un compás solo no es una parte: lo que lo siguiera no pasa `songProblem`, y no
  // revienta por no tener compás de antes.
  it('un solo compás se sigue: tu parte es la que tocaste, aunque sea un acorde', () => {
    const salidas = candidatasDeSalida('major', 'continuar', a4('V'));
    // La llegada, que es lo que pide un V solo, y frases que cierran.
    expect(salidas.find((s) => s.familia === 'resuelve')?.secciones[1]!.steps).toEqual([
      { degree: 'I', beats: 4, move: null },
    ]);
    expect(salidas.filter((s) => s.path === 'seguir').length).toBeGreaterThan(1);
    expect(salidasPosibles('major', 'continuar', a4('I')).length).toBeGreaterThanOrEqual(
      MINIMO_DEL_MENU,
    );
  });

  /** Lo que el micro leyó con duda no se da por seguro: lo que se apoya en ello baja. */
  it('lo que se construye encima de un compás dudoso cuenta menos', () => {
    const toma = a4('vi', 'IV', 'I', 'V');
    const prioridad = (dudosos: boolean[], familia: string) =>
      candidatasDeSalida('major', 'continuar', toma, { dudosos }).find((s) =>
        s.familia.startsWith(familia),
      )!.prioridad;

    expect(prioridad([false, false, false, true], 'resuelve')).toBeLessThan(
      prioridad([false, false, false, false], 'resuelve'),
    );
    // Repetir lo dudoso es construir encima como si fuera seguro: la segunda vuelta
    // que lo copiaría no se construye, y la que lo deja atrás sí.
    const vuelta = (dudosos: boolean[]) =>
      candidatasDeSalida('major', 'continuar', toma, { dudosos }).filter(
        (s) => s.familia === 'segunda-vuelta',
      );
    expect(vuelta([true, false, false, false])).toEqual([]);
    expect(vuelta([false, false, false, false])).toHaveLength(1);
    expect(vuelta([false, false, false, true])).toHaveLength(1);
    // Y lo nuevo no vuelve a apoyarse en un acorde que solo se oyó con duda, salvo que
    // toda la toma lo fuera: entonces no hay nada más seguro que preferir.
    const dudosoElIii = candidatasDeSalida('major', 'continuar', a4('I', 'iii', 'vi', 'IV'), {
      dudosos: [false, true, false, false],
    });
    expect(
      dudosoElIii.some((s) =>
        s.secciones.slice(1).some((x) => x.steps.some((p) => p.degree === 'iii')),
      ),
    ).toBe(false);
    const todaDudosa = candidatasDeSalida('major', 'continuar', a4('I', 'IV', 'V', 'I'), {
      dudosos: [true, true, true, true],
    });
    expect(todaDudosa.length).toBeGreaterThan(0);
    // Y sin color encima: ni préstamos, ni secundarias, ni el napolitano, ni el vii°.
    for (const salida of todaDudosa) {
      for (const paso of salida.secciones.slice(1).flatMap((x) => x.steps)) {
        expect(['bII', 'bIII', 'iv', 'bVI', 'bVII', 'vii°'], salida.nombre).not.toContain(
          paso.degree,
        );
        expect(paso.degree.includes('/'), salida.nombre).toBe(false);
      }
    }
    // **La llegada de un compás sobre un V dudoso no se construye**: descansa entera
    // en él, y si el micro se equivocó la canción no cierra. Antes contaba menos; el
    // corpus final la encontró arriba del menú como cierre seguro. Lo que se ofrece
    // es una frase que trae su propia cadencia.
    const tres = a4('I', 'IV', 'V');
    const llegada = (dudosos: boolean[]) =>
      candidatasDeSalida('major', 'continuar', tres, { dudosos }).find(
        (s) => s.familia === 'resuelve',
      );
    expect(llegada([false, false, false])).toBeDefined();
    expect(llegada([false, false, true])).toBeUndefined();
    expect(
      candidatasDeSalida('major', 'continuar', tres, { dudosos: [false, false, true] }),
    ).not.toEqual([]);
  });

  /**
   * **El ritmo armónico lento se sigue igual de lento**: `i i VI VI III III VII VII`
   * cambia de acorde cada dos compases, y lo que se le añadía iba a uno por compás.
   * Lo encontró el corpus final. Lo nuevo se construye sobre tus acordes enteros y
   * se escribe como tú, compás a compás; lo que se sabe de cada compás —especie,
   * duda, punteo— va con su acorde.
   */
  it('un acorde cada dos compases se continúa a un acorde cada dos compases', () => {
    const lenta = a4('i', 'i', 'VI', 'VI', 'III', 'III', 'VII', 'VII');
    const rachas = (salida: SalidaPosible) => {
      const nuevos = salida.secciones.slice(1).flatMap((s) => s.steps);
      return nuevos.every((paso, k) =>
        k % 2 === 0 ? nuevos[k + 1]?.degree === paso.degree : nuevos[k - 1]!.degree === paso.degree,
      );
    };
    const contextos: ContextoDeSalidas[] = [
      {},
      {
        especies: [null, null, 'major7', null, null, null, null, null],
        dudosos: [false, false, false, false, false, false, true, false],
        melodia: lenta.map(() => [{ nota: 0, fuerte: true }]),
      },
    ];
    for (const contexto of contextos) {
      const salidas = candidatasDeSalida('minor', 'continuar', lenta, contexto);
      expect(salidas.length).toBeGreaterThan(0);
      for (const salida of salidas) {
        expect(rachas(salida), salida.nombre).toBe(true);
        expect(salida.secciones[0]!.steps).toHaveLength(8);
      }
    }
    // Un acorde que dura dos compases no es un ritmo: con dos rachas, nada cambia.
    const corta = candidatasDeSalida('minor', 'continuar', a4('i', 'i', 'VI', 'VI'));
    expect(corta.some((salida) => !rachas(salida))).toBe(true);
    // Ni con rachas desiguales.
    const desigual = candidatasDeSalida(
      'minor',
      'continuar',
      a4('i', 'i', 'VI', 'III', 'III', 'VII'),
    );
    expect(desigual.some((salida) => !rachas(salida))).toBe(true);
  });

  it('al final de la canción cierra antes, y después de un puente no contrasta', () => {
    const toma = a4('I', 'IV', 'V', 'I');
    const final = candidatasDeSalida('major', 'continuar', toma, { papel: 'final' });
    const puente = candidatasDeSalida('major', 'continuar', toma, { papel: 'puente' });
    const idea = candidatasDeSalida('major', 'continuar', toma);
    const mejor = (salidas: readonly { path: string; prioridad: number }[], path: string) =>
      Math.max(...salidas.filter((s) => s.path === path).map((s) => s.prioridad));

    expect(mejor(final, 'seguir')).toBeGreaterThan(mejor(idea, 'seguir'));
    expect(final.map((s) => s.secciones[1]!.name)).toContain('Coda');
    expect(puente.map((s) => s.secciones[1]!.name)).toContain('Vuelta');
    // Detrás de un pre, de un puente o de un final viene una llegada: otra parte que
    // se va y vuelve a su principio es contestar a un pre con otro pre.
    for (const papel of ['pre', 'puente', 'final'] as const) {
      const salidas = candidatasDeSalida('major', 'continuar', a4('ii', 'iii', 'IV', 'V'), {
        papel,
      });
      expect(salidas.length, papel).toBeGreaterThan(0);
      expect(
        salidas.some((s) => s.path === 'contraste'),
        papel,
      ).toBe(false);
    }
    expect(puente.some((s) => s.path === 'contraste')).toBe(false);
    expect(idea.some((s) => s.path === 'contraste')).toBe(true);
  });

  it('detrás de un pre en vaivén, lo que sigue llega: el papel manda sobre el vamp', () => {
    // `ii V ii V` sin papel es un dórico sobre Re y no se cierra en Do; como pre, es
    // lo que prepara el estribillo, y el estribillo entra en casa (el quinto examen:
    // un pre en `VI VII VI VII` nunca caía en la i). En mayor y en menor.
    for (const [mode, vamp, tonica] of [
      ['major', ['ii', 'V'], 'I'],
      ['major', ['IV', 'V'], 'I'],
      ['minor', ['VI', 'VII'], 'i'],
    ] as const) {
      const salidas = candidatasDeSalida(mode, 'continuar', a4(...vamp, ...vamp), {
        papel: 'pre',
      });
      const llegan = salidas.filter(
        (s) => s.path === 'seguir' && s.secciones[1]!.steps[0]!.degree === tonica,
      );
      expect(llegan.length, vamp.join(' ')).toBeGreaterThan(0);
      // Y lo que sigue no entra en ninguno de los dos acordes del vaivén.
      for (const salida of salidas.filter((s) => s.path === 'seguir')) {
        expect(vamp, salida.nombre).not.toContain(salida.secciones[1]!.steps[0]!.degree);
      }
    }
    // Sin papel, el vamp dórico sigue sin cerrarse en Do.
    const dorico = candidatasDeSalida('major', 'continuar', a4('ii', 'V', 'ii', 'V'), {});
    expect(dorico.every((s) => s.path === 'contraste')).toBe(true);
  });

  it('el último compás de un pre o de un puente prepara la parte siguiente, no su principio', () => {
    // Un III7 en el último compás de un puente prepararía el vi con el que empieza,
    // y lo que viene es la vuelta a casa. En una idea, que se repite, sí.
    const toma = a4('vi', 'iii', 'IV', 'V');
    const hacia = (contexto: ContextoDeSalidas) =>
      candidatasDeSalida('major', 'retocar', toma, contexto).filter(
        (s) => s.path === 'rearmonizar' && cancionDe(s).at(-1) === 'V/vi/4',
      ).length;
    expect(hacia({})).toBeGreaterThan(0);
    expect(hacia({ papel: 'puente' })).toBe(0);
    expect(hacia({ papel: 'pre' })).toBe(0);
    expect(hacia({ papel: 'final' })).toBe(0);
  });

  it('una canción que ya cierra sigue con otra frase, y su nombre sale del papel', () => {
    const estrofa = candidatasDeSalida('major', 'continuar', a4('I', 'IV', 'V', 'I'), {
      papel: 'estrofa',
    });

    expect(estrofa.filter((s) => s.path === 'seguir').map((s) => s.secciones[1]!.name)).toContain(
      'Estribillo',
    );
    expect(
      estrofa.filter((s) => s.path === 'contraste').map((s) => s.secciones[1]!.name),
    ).toContain('Estribillo');
    const idea = candidatasDeSalida('major', 'continuar', a4('I', 'IV', 'V', 'I'));
    expect(idea.some((s) => s.que.startsWith('Añade otra frase'))).toBe(true);
    expect(idea.some((s) => s.nombre.startsWith('Un puente por'))).toBe(true);
  });

  it('un puente no cierra y vuelve a tu primer compás, mejor por su dominante', () => {
    const puentes = candidatasDeSalida('major', 'continuar', a4('I', 'V', 'vi', 'IV')).filter(
      (s) => s.path === 'contraste',
    );

    expect(puentes.length).toBeGreaterThan(0);
    for (const puente of puentes) {
      expect(añadidos(puente).at(-1)).not.toBe('I');
      expect(canFollow('major', añadidos(puente).at(-1)!, 'I')).toBe(true);
    }
    expect(puentes.some((p) => p.que.includes('desde su dominante, V'))).toBe(true);
  });
});

/** Lo que cada estilo admite de fuera, y la especie con la que suena lo nuevo. */
describe('el estilo y la especie', () => {
  const prestados = new Set(['bII', 'bIII', 'iv', 'bVI', 'bVII']);
  const conPrestamo = (estilo: StyleId) =>
    [a4('I', 'IV', 'V', 'IV'), a4('I', 'vi', 'IV', 'V'), a4('I', 'IV', 'I', 'IV')].flatMap((toma) =>
      candidatasDeSalida('major', 'continuar', toma, { estilo }).filter((s) =>
        añadidos(s).some((d) => prestados.has(d)),
      ),
    ).length;

  /** El préstamo depende del estilo: antes el 87 % de los puentes en mayor lo llevaban, también en un jazz. */
  it('un rock toma más prestado que un folk o un pop', () => {
    expect(conPrestamo('rock')).toBeGreaterThan(conPrestamo('folk'));
    expect(conPrestamo('rock')).toBeGreaterThan(conPrestamo('pop'));
  });

  it('en un jazz lo nuevo va en cuatríadas y las dominantes secundarias con séptima', () => {
    const salidas = candidatasDeSalida('major', 'continuar', a4('I', 'vi', 'ii', 'V'), {
      estilo: 'jazz',
    });
    const nuevos = salidas.flatMap((s) => s.secciones.slice(1).flatMap((x) => x.steps));

    expect(nuevos.find((p) => p.degree === 'I')?.especie).toBe('major7');
    expect(
      nuevos.filter((p) => p.degree.includes('/')).every((p) => p.especie === 'dominant7'),
    ).toBe(true);
  });

  it('lo tuyo conserva su especie, y si tocas quintas lo nuevo va en quintas', () => {
    const especies = ['quinta', 'quinta', 'quinta', 'quinta'] as const;
    const salidas = candidatasDeSalida('minor', 'continuar', a4('i', 'VII', 'VI', 'VII'), {
      especies: [...especies],
    });
    const [primera] = salidas;

    expect(primera!.secciones[0]!.steps.every((p) => p.especie === 'quinta')).toBe(true);
    expect(primera!.secciones[1]!.steps.every((p) => p.especie === 'quinta')).toBe(true);
  });

  it('las cuatríadas de lo tuyo piden cuatríadas, también sin estilo', () => {
    const salidas = candidatasDeSalida('major', 'continuar', a4('ii', 'V', 'I', 'I'), {
      especies: ['minor7', 'dominant7', 'major7', 'major7'],
    });
    const nuevos = salidas.flatMap((s) => s.secciones.slice(1).flatMap((x) => x.steps));

    expect(nuevos.find((p) => p.degree === 'vi')?.especie).toBe('minor7');
  });

  it('un riff mixolidio no se resuelve con la sensible', () => {
    const mejor = [
      ...candidatasDeSalida('major', 'continuar', a4('I', 'bVII', 'I', 'bVII'), {
        estilo: 'rock',
      }),
    ]
      .filter((s) => s.path === 'seguir')
      .sort((a, b) => b.prioridad - a.prioridad)[0]!;

    expect(añadidos(mejor)).not.toContain('V');
  });

  it('un bolero que vive de dominantes secundarias no se cierra con un bVII', () => {
    const salidas = candidatasDeSalida('major', 'continuar', a4('I', 'V/ii', 'ii', 'V'));

    expect(salidas.some((s) => añadidos(s).includes('bVII'))).toBe(false);
  });
});

/** Los seis estilos que llegaron después, cada uno con lo que construye su idioma. */
describe('los estilos que llegaron después, al construir', () => {
  const nuevosDe = (salidas: readonly SalidaPosible[]) =>
    salidas.flatMap((s) => s.secciones.slice(1).flatMap((x) => x.steps));

  it('en flamenco, una parte que baja hasta el V y reposa ahí', () => {
    const reposos = (estilo?: StyleId, mode: KeyMode = 'minor', toma = a4('i', 'VII', 'VI', 'V')) =>
      salidasPosibles(mode, 'continuar', toma, estilo === undefined ? {} : { estilo }).filter((s) =>
        s.que.includes('el final frigio del flamenco'),
      );
    const flamenco = reposos('flamenco');
    expect(flamenco.length).toBeGreaterThan(0);
    for (const salida of flamenco) {
      const grados = salida.secciones.at(-1)!.steps.map((p) => p.degree);
      expect(salida.path).toBe('contraste');
      expect(grados.at(-1)).toBe('V');
      expect(['VI', 'iv']).toContain(grados.at(-2));
      expect(salida.nombre).toContain('hasta el V');
      expect(salida.que).toContain('vuelve a tu i desde su dominante');
    }
    // Sin el estilo, y en mayor, no.
    expect(reposos()).toEqual([]);
    expect(reposos('flamenco', 'major', a4('I', 'IV', 'I', 'V'))).toEqual([]);
    // Lo que empieza en el VI vuelve a él desde el V, pero no desde su dominante.
    const desdeElSexto = reposos('flamenco', 'minor', a4('VI', 'VII', 'i', 'iv'));
    expect(desdeElSexto.length).toBeGreaterThan(0);
    expect(desdeElSexto.every((s) => s.que.endsWith('y de ahí vuelve a tu VI.'))).toBe(true);
    // Y si del V no se vuelve a tu primer acorde, no hay parte que reposar ahí.
    expect(reposos('flamenco', 'minor', a4('VII', 'VI', 'VII', 'i'))).toEqual([]);
  });

  it('el bII del flamenco es del menor: una rumba en mayor no lo recibe', () => {
    const toma = a4('I', 'IV', 'I', 'V');
    const conBII = (estilo: StyleId) =>
      candidatasDeSalida('major', 'continuar', toma, { estilo }).filter((s) =>
        añadidos(s).includes('bII'),
      );
    expect(conBII('flamenco')).toEqual([]);
    expect(
      candidatasDeSalida('minor', 'continuar', a4('i', 'VII', 'VI', 'V'), {
        estilo: 'flamenco',
      }).some((s) => añadidos(s).includes('bII')),
    ).toBe(true);
  });

  it('en funk, lo nuevo habla con séptima de dominante aunque no se diga la especie', () => {
    const nuevos = nuevosDe(
      candidatasDeSalida('major', 'continuar', a4('I', 'IV', 'I', 'IV'), { estilo: 'funk' }),
    );
    expect(nuevos.find((p) => p.degree === 'IV')?.especie).toBe('dominant7');
    expect(nuevos.find((p) => p.degree === 'I')?.especie).toBe('dominant7');
  });

  it('en bolero, cuatríadas por defecto y ninguna dominante que vuelva al IV', () => {
    const salidas = candidatasDeSalida('major', 'continuar', a4('I', 'vi', 'ii', 'V'), {
      estilo: 'bolero',
    });
    expect(nuevosDe(salidas).find((p) => p.degree === 'I')?.especie).toBe('major7');
    const vuelveAtras = salidas.filter((s) => {
      const grados = s.secciones.flatMap((x) => x.steps.map((p) => p.degree));
      return grados.some((g, i) => g === 'V' && grados[i + 1] === 'IV');
    });
    expect(vuelveAtras).toEqual([]);
  });

  it('en country, el II7 delante del V, sin cadena de secundarias ni préstamos', () => {
    const country = salidasPosibles('major', 'continuar', a4('I', 'IV', 'I', 'V'), {
      estilo: 'country',
    });
    // Entre las tres primeras: la primera es el consecuente de tu periodo, `I IV V I`,
    // que es lo que completa la forma (el quinto examen).
    expect(
      country.slice(0, 3).map((s) =>
        s.secciones
          .at(-1)!
          .steps.map((p) => p.degree)
          .join(' '),
      ),
    ).toContain('I V/V V I');
    expect(['Consecuente', 'Segunda vuelta']).toContain(country[0]!.secciones.at(-1)!.name);
    const candidatas = candidatasDeSalida('major', 'continuar', a4('I', 'IV', 'I', 'V'), {
      estilo: 'country',
    });
    for (const salida of candidatas) {
      const grados = salida.secciones.flatMap((x) => x.steps.map((p) => p.degree));
      const cadena = grados.some((g, i) => g.includes('/') && grados[i + 1]?.includes('/'));
      expect(cadena, salida.nombre).toBe(false);
      expect(añadidos(salida).some((g) => ['iv', 'bVI', 'bVII', 'bIII'].includes(g))).toBe(false);
    }
    // Si tu country ya toca un préstamo, es tu color y puede volver.
    const conSuIv = candidatasDeSalida('major', 'continuar', a4('I', 'IV', 'iv', 'I'), {
      estilo: 'country',
    });
    expect(conSuIv.some((s) => añadidos(s).includes('iv'))).toBe(true);
  });
});

/** Lo que se construye al retocar: el primer compás y la llegada no se tocan. */
describe('lo que se construye al retocar', () => {
  const POP = a4('I', 'V', 'vi', 'IV');

  it('ni el primer compás ni la llegada, ni la tónica en medio', () => {
    for (const toma of [POP, a4('I', 'IV', 'V', 'I'), a4('i', 'VI', 'III', 'VII')]) {
      const mode = toma[0]!.degree === 'i' ? 'minor' : 'major';
      for (const salida of candidatasDeSalida(mode, 'retocar', toma).filter(
        (s) => s.path === 'rearmonizar',
      )) {
        const cancion = salida.secciones[0]!.steps;
        expect(cancion[0]!.degree, salida.nombre).toBe(toma[0]!.degree);
        cancion.forEach((paso, i) => {
          if (paso.degree !== toma[i]!.degree && paso.move !== 'interrumpida') {
            expect(paso.degree).not.toBe(toma[0]!.degree);
          }
        });
      }
    }
  });

  it('la interrumpida tuerce la llegada a propósito: V vi donde se esperaba V I', () => {
    const rota = candidatasDeSalida('major', 'retocar', a4('I', 'IV', 'V', 'I')).find(
      (s) => s.familia === 'interrumpida',
    );

    expect(rota && cancionDe(rota)).toEqual(['I/4', 'IV/4', 'V/4', 'vi/4']);
    expect(rota?.colores).toContain('oscurece');
  });

  it('pone dominantes secundarias delante de lo que preparan, con séptima', () => {
    const secundaria = candidatasDeSalida('major', 'retocar', POP).find(
      (s) => s.nombre === 'Su dominante delante, en el 2',
    );

    expect(secundaria?.secciones[0]!.steps[1]).toMatchObject({
      degree: 'V/vi',
      move: 'dominante',
      especie: 'dominant7',
    });
    // Cambia una dominante por otra: no tensa más de lo que ya tensaba.
    expect(secundaria?.colores).not.toContain('tension');
  });

  it('un bucle que no acaba en casa vuelve a empezar: el último prepara el primero', () => {
    const vuelta = candidatasDeSalida('major', 'retocar', a4('vi', 'IV', 'I', 'V')).find(
      (s) => s.nombre === 'Su dominante delante, en el 4',
    );

    expect(vuelta && cancionDe(vuelta)).toEqual(['vi/4', 'IV/4', 'I/4', 'V/vi/4']);
  });

  it('el tritono solo antes de su objetivo, y en un jazz', () => {
    const jazz = candidatasDeSalida('major', 'retocar', a4('ii', 'V', 'I', 'I'), {
      estilo: 'jazz',
    });
    const tritono = jazz.find((s) => s.familia === 'tritono');

    expect(tritono?.secciones[0]!.steps[1]).toMatchObject({ degree: 'bII', especie: 'dominant7' });
    expect(tritono?.colores).toContain('tension');
    // Un V que no va a la tónica no tiene sustituto.
    const sinObjetivo = candidatasDeSalida('major', 'retocar', a4('I', 'V', 'vi', 'IV'), {
      estilo: 'jazz',
    });
    expect(sinObjetivo.some((s) => s.familia === 'tritono')).toBe(false);
  });

  it('lo que el micro leyó con duda no se rearmoniza: se corrige con lo que comparte notas', () => {
    // Encima de un compás dudoso no se pone una dominante ni un préstamo: lo que cabe
    // es lo que probablemente sonó, su relativo o el de su misma función, que
    // comparten dos notas con lo que se oyó (lo pidieron los dos arreglistas).
    const salidas = candidatasDeSalida('major', 'retocar', POP, {
      dudosos: [false, true, false, false],
    });
    const enElDudoso = salidas
      .filter((s) => s.path === 'rearmonizar')
      .map((s) => s.secciones[0]!.steps[1]!)
      .filter((paso) => paso.degree !== 'V');
    expect(enElDudoso.length).toBeGreaterThan(0);
    for (const paso of enElDudoso) {
      expect(['relativo', 'funcion']).toContain(paso.move);
    }
  });

  it('un cambio que choca con el punteo no se construye', () => {
    // Un Do fuerte en el compás 2: choca con el Si del E7 y con el del G.
    const melodia = [[], [{ nota: 0, fuerte: true }], [], []];
    const salidas = candidatasDeSalida('major', 'retocar', POP, { melodia });

    expect(salidas.some((s) => s.secciones[0]!.steps[1]!.degree === 'V/vi')).toBe(false);
    // Pero un punteo que encaja no quita nada.
    const encaja = candidatasDeSalida('major', 'retocar', POP, {
      melodia: [[], [{ nota: 4, fuerte: true }], [], []],
    });
    expect(encaja.some((s) => s.secciones[0]!.steps[1]!.degree === 'V/vi')).toBe(true);
  });

  it('otro final no cambia el largo, salvo «acaba antes», que acaba en frase', () => {
    const diez = a4('I', 'IV', 'V', 'I', 'vi', 'IV', 'V', 'vi', 'IV', 'V');
    const finales = candidatasDeSalida('major', 'retocar', diez).filter(
      (s) => s.path === 'otro-final',
    );

    expect(finales.length).toBeGreaterThan(0);
    for (const salida of finales) {
      const largo = salida.secciones[0]!.steps.length;
      expect(salida.nombre === 'Acaba antes' ? largo % 4 : largo - 10, salida.nombre).toBe(0);
    }
    const antes = finales.find((s) => s.nombre === 'Acaba antes')!;
    expect(antes.colores).toContain('mas-corto');
    expect(antes.que).toContain('en 8 compases y no en 10');
  });

  it('lo que ya cuadraba no se acorta: quitarle compases rompe la forma', () => {
    // Doce compases son tres frases, y un AABA de treinta y dos, cuatro.
    const doce = a4('I', 'IV', 'V', 'I', 'vi', 'IV', 'V', 'vi', 'IV', 'V', 'iii', 'vi');
    const nombres = candidatasDeSalida('major', 'retocar', doce).map((s) => s.nombre);
    expect(nombres).not.toContain('Acaba antes');
    // Y dos frases de tres que acaban igual son una forma: tampoco se dejan en cuatro.
    const tresYTres = a4('I', 'IV', 'V', 'vi', 'IV', 'V');
    expect(candidatasDeSalida('major', 'retocar', tresYTres).map((s) => s.nombre)).not.toContain(
      'Acaba antes',
    );
  });

  it('el último, el doble, solo si es la llegada y cuadra la frase', () => {
    const tres = candidatasDeSalida('major', 'retocar', a4('I', 'V', 'I')).map((s) => s.nombre);
    expect(tres).toContain('El último, el doble');
    expect(tres).toContain('El primero, el doble');
    const abierta = candidatasDeSalida('major', 'retocar', a4('I', 'IV', 'V')).map((s) => s.nombre);
    expect(abierta).not.toContain('El último, el doble');
  });
});

/** Cómo llega a la tónica, dicho en palabras de músico y verdad del acorde. */
describe('lo que dice cada llegada', () => {
  const llegada = (mode: KeyMode, toma: PathStep[], contexto = {}) =>
    candidatasDeSalida(mode, 'continuar', toma, contexto).find((s) => s.familia === 'resuelve')
      ?.que;

  it.each([
    ['major', ['I', 'IV', 'vii°'], 'desde el vii°, que hace de dominante'],
    ['minor', ['i', 'iv', 'v'], 'desde la dominante menor, v, sin sensible'],
    ['major', ['I', 'ii', 'bII'], 'desde el bII, medio tono por encima'],
    ['minor', ['i', 'iv', 'bII'], 'desde el bII: la cadencia frigia'],
    ['major', ['I', 'IV', 'bVII'], 'desde el bVII, sin sensible: cadencia modal'],
    ['major', ['I', 'ii', 'IV'], 'desde la subdominante, IV: suave, de plagal'],
    ['major', ['I', 'IV', 'vi'], 'desde vi, de rebote'],
  ] as const)('%s, desde %j', (mode, grados, dice) => {
    expect(llegada(mode, a4(...(grados as unknown as DegreeSymbol[])))).toContain(dice);
  });

  it('el bII con séptima es el sustituto tritonal', () => {
    expect(
      llegada('major', a4('I', 'ii', 'bII'), { especies: [null, 'minor7', 'dominant7'] }),
    ).toContain('desde el bII7, sustituto tritonal del V');
  });
});

/**
 * Cuándo encaja qué acorde según lo que ya hace tu canción: lo que el generador
 * construye y lo que se calla, porque construir lo que el juez descarta es gastar
 * un sitio del menú.
 */
describe('lo que el contexto decide al construir', () => {
  /** Lo que añade o cambia cada candidata, en grados. */
  const loNuevo = (kind: PathKind, original: readonly PathStep[], salida: SalidaPosible) => {
    const cancion = salida.secciones.flatMap((x) => x.steps);
    return kind === 'continuar'
      ? cancion.slice(original.length).map((p) => p.degree)
      : cancion.map((p) => p.degree);
  };

  it('una secundaria que no llega a lo suyo tiene su otro final: el que prepara', () => {
    const promesa = candidatasDeSalida('major', 'retocar', a4('I', 'IV', 'V/iii', 'ii'));
    const llega = promesa.find((s) => s.familia === 'final:prometido');

    expect(llega && cancionDe(llega)).toEqual(['I/4', 'IV/4', 'V/iii/4', 'iii/4']);
    expect(llega?.nombre).toBe('Llega al iii');
    // Si ya llegaba, no hay promesa que cumplir.
    const cumplida = candidatasDeSalida('major', 'retocar', a4('I', 'IV', 'V/vi', 'vi'));
    expect(cumplida.some((s) => s.familia === 'final:prometido')).toBe(false);
  });

  it('un riff mixolidio se queda abierto en su bVII, y un vamp modal no se cierra en I', () => {
    const riff = candidatasDeSalida('major', 'retocar', a4('I', 'bVII', 'IV', 'I'), {
      estilo: 'rock',
    });
    expect(riff.some((s) => s.nombre === 'Se queda en el bVII')).toBe(true);
    expect(riff.some((s) => s.nombre === 'Se queda en la dominante')).toBe(false);

    const dorico = candidatasDeSalida('major', 'retocar', a4('ii', 'V', 'ii', 'V'));
    for (const salida of dorico.filter((s) => s.path === 'otro-final')) {
      expect(cancionDe(salida).at(-1), salida.nombre).not.toBe('I/4');
    }
  });

  it('otro final no pide que tu segunda mitad siga el grafo: solo lo que pone', () => {
    // De ii° a VII no hay salto en el grafo, y eso es tuyo.
    const rara = a4('i', 'iv', 'VI', 'ii°', 'VII', 'III', 'VI', 'V');
    const finales = candidatasDeSalida('minor', 'retocar', rara).filter(
      (s) => s.path === 'otro-final',
    );
    expect(finales.length).toBeGreaterThan(0);
    expect(
      pathProblem('minor', 'otro-final', rara, [...rara.slice(0, 7), { degree: 'i', beats: 4 }]),
    ).toBeNull();
  });

  it('a doble tiempo solo si queda una frase de dos compases o más', () => {
    const nombres = (toma: PathStep[]) =>
      candidatasDeSalida('major', 'retocar', toma).map((s) => s.nombre);
    expect(nombres(a4('I', 'V'))).not.toContain('A doble tiempo');
    expect(nombres(a4('I', 'IV', 'V', 'I'))).toContain('A doble tiempo');
  });

  it('en jazz y en folk no se vuelve de la V, ni para volver a prepararla', () => {
    // `V ii V I` era la excepción, y es la retrogresión de manual: el V7 al ii7
    // deshace lo que el ii preparó. Fuera del blues ya no se construye en ninguno.
    for (const estilo of ['jazz', 'folk'] as const) {
      for (const toma of [a4('I', 'vi', 'ii', 'V'), a4('I', 'IV', 'I', 'V')]) {
        for (const salida of candidatasDeSalida('major', 'continuar', toma, { estilo })) {
          const grados = [toma.at(-1)!.degree, ...loNuevo('continuar', toma, salida)];
          grados.forEach((grado, k) => {
            expect(
              grado === 'V' && ['IV', 'ii', 'iv'].includes(grados[k + 1] ?? ''),
              `${estilo} ${grados.join(' ')}`,
            ).toBe(false);
          });
        }
      }
    }
    // En un blues, `V IV I` es el idioma.
    const doce = a4('I', 'IV', 'I', 'V');
    const blues = candidatasDeSalida('major', 'continuar', doce, { estilo: 'blues' });
    expect(
      blues.some((s) => ['V', ...loNuevo('continuar', doce, s)].join(' ').includes('V IV')),
    ).toBe(true);
  });

  it('una frase nueva no se queda dando vueltas entre dos acordes', () => {
    const tras = candidatasDeSalida('major', 'continuar', a4('I', 'V', 'vi', 'IV'), {
      estilo: 'pop',
    });
    for (const salida of tras) {
      const grados = loNuevo('continuar', a4('I', 'V', 'vi', 'IV'), salida).join(' ');
      expect(grados, salida.nombre).not.toMatch(/(\S+) (\S+) \1 \2 \1/u);
    }
  });

  it('el pop y la canción sin estilo toman prestado, menos que el rock y más que nada', () => {
    const prestados = new Set(['iv', 'bVI', 'bVII', 'bIII']);
    const tomas = [a4('I', 'V', 'vi', 'IV'), a4('I', 'IV', 'V', 'IV'), a4('I', 'vi', 'IV', 'V')];
    const conPrestamo = (estilo?: StyleId) =>
      tomas.flatMap((toma) =>
        salidasPosibles('major', 'continuar', toma, estilo === undefined ? {} : { estilo }).filter(
          (s) => loNuevo('continuar', toma, s).some((d) => prestados.has(d)),
        ),
      ).length;
    expect(conPrestamo('pop')).toBeGreaterThan(0);
    expect(conPrestamo()).toBeGreaterThan(0);
    expect(conPrestamo('rock')).toBeGreaterThan(conPrestamo('pop'));
    expect(conPrestamo('metal')).toBeGreaterThan(conPrestamo('folk'));
  });

  it('el IV iv I del pop se construye', () => {
    const toma = a4('I', 'V', 'vi', 'IV');
    const salidas = candidatasDeSalida('major', 'continuar', toma, { estilo: 'pop' });
    expect(salidas.some((s) => loNuevo('continuar', toma, s).join(' ').endsWith('IV iv I'))).toBe(
      true,
    );
  });

  it('una canción funcional admite el tritono sin estilo y no la v sin sensible', () => {
    const bolero = a4('i', 'V/iv', 'iv', 'V');
    const retoques = candidatasDeSalida('minor', 'retocar', bolero);
    expect(retoques.some((s) => s.familia === 'tritono')).toBe(true);
    for (const kind of ['continuar', 'retocar'] as const) {
      for (const salida of candidatasDeSalida('minor', kind, bolero)) {
        expect(loNuevo(kind, bolero, salida), salida.nombre).not.toContain('v');
      }
    }
  });

  it('en un blues se retoca la vuelta, y el 12 puede ser el turnaround', () => {
    const blues = a4('I', 'IV', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'I');
    const retoques = candidatasDeSalida('major', 'retocar', blues, { estilo: 'blues' }).filter(
      (s) => s.path === 'rearmonizar',
    );
    expect(retoques.length).toBeGreaterThan(0);
    for (const salida of retoques) {
      const cancion = salida.secciones[0]!.steps;
      // Menos el cambio rápido del 2, que se pone o se quita y es el mismo blues.
      cancion
        .slice(0, 7)
        .forEach(
          (paso, i) =>
            (i === 1 && salida.familia === 'cambio-rapido') ||
            expect(paso.degree).toBe(blues[i]!.degree),
        );
    }
    expect(retoques.some((s) => cancionDe(s).slice(0, 3).join(' ') === 'I/4 I/4 I/4')).toBe(true);
    expect(retoques.some((s) => cancionDe(s).slice(10).join(' ') === 'I/4 V/4')).toBe(true);
  });

  it('el VI7 del coro de jazz va a su ii, y el ii suena con su séptima', () => {
    const blues = a4('I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V');
    const coros = candidatasDeSalida('major', 'continuar', blues, { estilo: 'blues' });
    const conVI7 = coros.find((s) => s.familia === 'coro-vi7')!;
    const nuevos = conVI7.secciones[1]!.steps;
    expect(nuevos.slice(7, 10).map((p) => p.degree)).toEqual(['V/ii', 'ii', 'V']);
    expect(nuevos[8]!.especie).toBe('minor7');
  });

  it('el mismo cambio en una frase repetida va a la segunda vez', () => {
    const periodo = a4('I', 'vi', 'IV', 'V', 'I', 'vi', 'IV', 'V');
    const sueltos = candidatasDeSalida('major', 'retocar', periodo).filter(
      (s) =>
        s.familia === 'dominante' &&
        cancionDe(s).filter((p, i) => p !== `${periodo[i]!.degree}/4`).length === 1,
    );
    const enEl3 = sueltos.some((s) => cancionDe(s)[2] === 'V/V/4');
    const enEl7 = sueltos.some((s) => cancionDe(s)[6] === 'V/V/4');
    expect(enEl7).toBe(true);
    expect(enEl3).toBe(false);
  });

  it('una canción larga a dos pulsos también se sigue con una frase entera', () => {
    const larga = Array.from({ length: 22 }, (_, i) => ({
      degree: (['I', 'IV', 'V', 'IV'] as const)[i % 4]!,
      beats: 2,
    }));
    const largos = candidatasDeSalida('major', 'continuar', larga).map(
      (s) => s.secciones.slice(1).flatMap((x) => x.steps).length,
    );
    expect(Math.max(...largos)).toBeGreaterThan(8);
  });

  it('una toma con golpes sueltos sigue a compás, no a golpes', () => {
    const toma: PathStep[] = [
      { degree: 'I', beats: 1 },
      { degree: 'IV', beats: 1 },
      { degree: 'V', beats: 6 },
      { degree: 'vi', beats: 8 },
      { degree: 'IV', beats: 4 },
    ];
    const salidas = candidatasDeSalida('major', 'continuar', toma);
    expect(salidas.length).toBeGreaterThan(0);
    for (const salida of salidas) {
      for (const paso of salida.secciones.slice(1).flatMap((x) => x.steps)) {
        expect(paso.beats % 4, salida.nombre).toBe(0);
      }
    }
  });
});

/**
 * El orden del menú: el juez manda, y a igualdad, variedad. Con candidatas
 * inventadas, para probar el orden y no lo que opina el juez de cada canción.
 */
describe('la función que dice cada acorde, y adónde va lo que sigue', () => {
  /** Los compases nuevos o cambiados de una salida, en grados. */
  const nuevosDe = (kind: PathKind, original: readonly PathStep[], salida: SalidaPosible) => {
    const cancion = salida.secciones.flatMap((x) => x.steps);
    return kind === 'continuar'
      ? cancion.slice(original.length)
      : cancion.filter((p, i) => p.degree !== original[i]?.degree);
  };
  const juntos = (pasos: readonly { degree: DegreeSymbol }[]) =>
    pasos.map((p) => p.degree).join(' ');

  it('un I7 que va al IV es su dominante: no se cambia por su relativo ni por nada que no lo sea', () => {
    const gospel = [...a4('I', 'I', 'IV', 'iv'), { degree: 'I' as const, beats: 8 }];
    const contexto: ContextoDeSalidas = { especies: [null, 'dominant7', null, null, null] };
    const retoques = candidatasDeSalida('major', 'retocar', gospel, contexto);
    for (const salida of retoques.filter((s) => s.path === 'rearmonizar')) {
      expect(cancionDe(salida)[1], salida.nombre).toBe('I/4');
    }
    // Sin la séptima es una tónica más, y su relativo vale.
    const sinSeptima = candidatasDeSalida('major', 'retocar', gospel);
    expect(sinSeptima.some((s) => cancionDe(s)[1] === 'vi/4')).toBe(true);
    // Y la dominante de siempre se cambia por otra dominante: el vii° sí, el iii no.
    const v = candidatasDeSalida('major', 'retocar', a4('I', 'ii', 'V', 'I'), { estilo: 'jazz' });
    expect(v.some((s) => cancionDe(s)[2] === 'iii/4')).toBe(false);
    expect(v.some((s) => cancionDe(s)[2] === 'bII/4')).toBe(true);
  });

  it('si tu tónica suena con séptima de dominante, lo nuevo habla igual', () => {
    const funk = a4('I', 'I', 'I', 'I');
    const contexto: ContextoDeSalidas = { especies: funk.map(() => 'dominant7' as const) };
    const salidas = candidatasDeSalida('major', 'continuar', funk, contexto);
    const cuartos = salidas.flatMap((s) =>
      nuevosDe('continuar', funk, s).filter((p) => p.degree === 'IV'),
    );
    expect(cuartos.length).toBeGreaterThan(0);
    expect(cuartos.every((p) => p.especie === 'dominant7')).toBe(true);
    // El I7 de paso del gospel no es el idioma de la canción.
    const gospel = candidatasDeSalida('major', 'continuar', a4('I', 'I', 'IV', 'V'), {
      especies: [null, 'dominant7', null, null],
    });
    expect(
      gospel
        .flatMap((s) => nuevosDe('continuar', a4('I', 'I', 'IV', 'V'), s))
        .some((p) => p.degree === 'IV' && p.especie === 'dominant7'),
    ).toBe(false);
  });

  it('un vamp de un acorde se va al IV y vuelve, y casi en el tope no cabe', () => {
    const vamp = candidatasDeSalida('major', 'continuar', a4('I', 'I', 'I', 'I'), {
      especies: ['dominant7', 'dominant7', 'dominant7', 'dominant7'],
    }).find((s) => s.familia === 'vamp');
    expect(vamp && añadidos(vamp)).toEqual(['IV', 'IV', 'I', 'I']);
    expect(vamp?.nombre).toBe('Al IV y vuelta: IV IV I I');
    const menor = candidatasDeSalida('minor', 'continuar', a4('i', 'i')).find(
      (s) => s.familia === 'vamp',
    );
    expect(menor && añadidos(menor)).toEqual(['iv', 'i']);
    for (const largo of [MAX_PATH_STEPS - 1, MAX_PATH_STEPS]) {
      const lleno = Array.from({ length: largo }, () => 'I' as const);
      expect(
        candidatasDeSalida('major', 'continuar', a4(...lleno)).some((s) => s.familia === 'vamp'),
      ).toBe(false);
    }
  });

  it('el vii° no cierra un pop, un rock, un folk ni una canción sin estilo', () => {
    for (const estilo of [undefined, 'pop', 'rock', 'folk', 'blues'] as const) {
      const contexto: ContextoDeSalidas = estilo === undefined ? {} : { estilo };
      for (const tuyo of [a4('I', 'IV'), a4('I', 'vi', 'IV', 'I'), a4('I', 'IV', 'V', 'I')]) {
        for (const kind of ['continuar', 'retocar'] as const) {
          for (const salida of salidasPosibles('major', kind, tuyo, contexto)) {
            const cancion = salida.secciones.flatMap((x) => x.steps);
            const cierraConVii = cancion.some(
              (p, i) => p.degree === 'vii°' && cancion[i + 1]?.degree === 'I' && !tuyo.includes(p),
            );
            expect(cierraConVii, `${estilo} ${kind} ${salida.nombre}`).toBe(false);
          }
        }
      }
    }
  });

  it('el II7 va al V, y del V no se vuelve al ii fuera del blues', () => {
    expect(canFollow('major', 'V/V', 'I')).toBe(false);
    expect(saltosDeSalidas('major', 'V/V').map((m) => m.to)).toEqual(['V']);
    for (const estilo of [undefined, 'pop', 'folk', 'jazz', 'rock'] as const) {
      const contexto: ContextoDeSalidas = estilo === undefined ? {} : { estilo };
      for (const tuyo of [a4('I', 'I', 'V/V', 'V/V'), a4('I', 'IV', 'V/V', 'V'), a4('ii', 'V')]) {
        for (const salida of candidatasDeSalida('major', 'continuar', tuyo, contexto)) {
          const nuevos = juntos(nuevosDe('continuar', tuyo, salida));
          const todo = `${tuyo.at(-1)!.degree} ${nuevos}`;
          expect(todo, salida.nombre).not.toMatch(/V\/V I\b|(?:^| )V ii\b/u);
        }
      }
    }
  });

  it('una secundaria que no va a lo suyo cuenta menos que la que va', () => {
    // El III7 al final: lo que sigue es el vi, y la cadencia rota del IV va detrás.
    const salidas = candidatasDeSalida('major', 'continuar', a4('I', 'IV', 'I', 'V/vi'));
    const alVi = salidas.find((s) => añadidos(s)[0] === 'vi');
    const alIV = salidas.find((s) => añadidos(s)[0] === 'IV');
    expect(alVi).toBeDefined();
    expect(alIV === undefined || alIV.prioridad < alVi!.prioridad).toBe(true);
  });

  it('en menor el ii° y el iv se cambian el uno por el otro: misma función', () => {
    const conII = candidatasDeSalida('minor', 'retocar', a4('i', 'ii°', 'V', 'i'));
    const aIV = conII.find((s) => s.familia === 'funcion');
    expect(aIV && cancionDe(aIV)).toEqual(['i/4', 'iv/4', 'V/4', 'i/4']);
    expect(aIV?.que).toContain('(misma función)');
    const conIV = candidatasDeSalida('minor', 'retocar', a4('i', 'iv', 'V', 'i'));
    expect(conIV.some((s) => cancionDe(s)[1] === 'ii°/4' && s.familia === 'funcion')).toBe(true);
  });

  it('una línea de bajo que baja sigue hacia la dominante, no vuelve a casa', () => {
    const bajada = a4('I', 'iii', 'bIII', 'ii');
    for (const salida of candidatasDeSalida('major', 'continuar', bajada)) {
      expect(añadidos(salida)[0], salida.nombre).not.toBe('I');
    }
    // Lo que acaba en la dominante ya ha llegado: la andaluza resuelve.
    const andaluza = candidatasDeSalida('minor', 'continuar', a4('i', 'VII', 'VI', 'V'));
    expect(andaluza.some((s) => añadidos(s)[0] === 'i')).toBe(true);
    // Y si desde donde acaba no hay ni dominante ni escalón más abajo, lo de siempre.
    const sinEscalon = candidatasDeSalida('major', 'continuar', a4('V', 'IV', 'iii'));
    expect(sinEscalon.length).toBeGreaterThan(0);
    // Con un compás de sitio la llegada es lo único que cabe.
    const lleno = [
      ...a4(...Array.from({ length: MAX_PATH_STEPS - 5 }, () => 'I' as const)),
      ...bajada,
    ];
    expect(
      candidatasDeSalida('major', 'continuar', lleno).some((s) => añadidos(s).join(' ') === 'I'),
    ).toBe(true);
  });

  it('lo que sigue a un V lo resuelve, o lo engaña; en un blues puede ir al IV', () => {
    const country = a4('I', 'I', 'V/V', 'V');
    for (const estilo of [undefined, 'pop', 'folk', 'jazz'] as const) {
      const contexto: ContextoDeSalidas = estilo === undefined ? {} : { estilo };
      for (const salida of candidatasDeSalida('major', 'continuar', country, contexto)) {
        expect(['I', 'vi'], `${estilo} ${salida.nombre}`).toContain(añadidos(salida)[0]);
      }
    }
    // En un blues el V puede volver al IV: no tiene que resolver ya, y lo que se
    // construye lo dice en algún sitio, aunque no sea lo primero —un contraste que
    // empezara en el IV pasaría dos veces por casa antes de volver—.
    const blues = candidatasDeSalida('major', 'continuar', country, { estilo: 'blues' });
    expect(blues.some((s) => ['V', ...añadidos(s)].join(' ').includes('V IV'))).toBe(true);
  });

  it('ir y volver a la dominante, `V IV V`, es del blues y del rock', () => {
    const vaYViene = (tuyo: readonly PathStep[], contexto: ContextoDeSalidas) =>
      candidatasDeSalida('major', 'continuar', tuyo, contexto).some((s) =>
        [tuyo.at(-1)!.degree, ...añadidos(s)].join(' ').includes('V IV V'),
      );
    for (const tuyo of [a4('I', 'V'), a4('I', 'vi', 'ii', 'V')]) {
      expect(vaYViene(tuyo, {})).toBe(false);
      expect(vaYViene(tuyo, { estilo: 'pop' })).toBe(false);
    }
    expect(vaYViene(a4('I', 'V'), { estilo: 'blues' })).toBe(true);
  });

  it('los compases se cuentan en compases: dos cambios iguales del mismo compás son uno', () => {
    const golpes = (['I', 'IV', 'I', 'IV', 'V', 'I'] as const).map((degree) => ({
      degree,
      beats: 1,
    }));
    const salidas = candidatasDeSalida('major', 'retocar', golpes, { pulsosPorCompas: 4 });
    const juntosEnUno = salidas.find(
      (s) => /en el 1 \(/u.test(s.que) && s.nombre.endsWith('donde cabe'),
    );
    expect(juntosEnUno?.que).not.toMatch(/el 1 y el 1/u);
  });
});

describe('ordenar con variedad', () => {
  const c = (path: PathId, puntos: number, familia: string, prioridad = 5) => ({
    path,
    puntos,
    familia,
    prioridad,
  });

  it('manda la calidad: muy por encima sale primero aunque repita camino', () => {
    const orden = ordenarConVariedad(
      [c('seguir', 90, 'a'), c('seguir', 88, 'b'), c('contraste', 60, 'c')],
      3,
    );
    expect(orden.map((x) => x.familia)).toEqual(['a', 'b', 'c']);
  });

  it('entre casi iguales reparte caminos y clases', () => {
    const orden = ordenarConVariedad(
      [c('seguir', 70, 'a'), c('seguir', 69, 'a'), c('contraste', 67, 'c'), c('seguir', 68, 'b')],
      4,
    );
    expect(orden.map((x) => x.familia)).toEqual(['a', 'c', 'b', 'a']);
  });

  it('a igualdad, lo que cree el generador; y luego el orden de llegada', () => {
    const orden = ordenarConVariedad(
      [c('seguir', 50, 'a', 4), c('contraste', 50, 'b', 7), c('estirar', 50, 'd', 7)],
      2,
    );
    expect(orden.map((x) => x.familia)).toEqual(['b', 'd']);
  });
});

/**
 * **Lo que dice cada salida es verdad.** Los textos se leen en pantalla y se le
 * mandan al modelo como hechos, y el verificador encontró seis que mentían: «con
 * séptima» encima de una tríada, «mayor por menor» de un menor que pasaba a mayor,
 * «el doble de largo» de lo que era cuatro veces más largo, «cuadra lo que se tocó
 * desigual» de una toma regular, «cierra en la tónica» de lo que ya cerraba y «la
 * frase cuadra» de un AABA al que se le quitaban cuatro compases. Esto recorre
 * todas las salidas de los dos corpus y de canciones al azar y comprueba cada
 * afirmación contra la canción.
 */
describe('lo que dice cada salida es verdad', () => {
  const tonicaDe = (mode: KeyMode): DegreeSymbol => (mode === 'major' ? 'I' : 'i');
  const pulsosDe = (pasos: readonly { beats: number }[]) =>
    pasos.reduce((suma, paso) => suma + paso.beats, 0);
  const calidad = (mode: KeyMode, grado: DegreeSymbol) => resolveDegree(0, mode, grado).quality;
  const notas = (
    mode: KeyMode,
    grado: DegreeSymbol,
    especie: EspecieDeBloque | null | undefined,
  ) => {
    const acorde = resolveDegree(0, mode, grado);
    if (especie === null || especie === undefined) {
      return new Set(acorde.notes);
    }
    return new Set(
      esSeventhQuality(especie)
        ? seventhNotes(acorde.root, especie)
        : notasDeEspecieSimple(acorde.root, especie),
    );
  };

  /** Lo que no se sostiene de una salida, dicho; vacío si todo es verdad. */
  function mentiras(
    mode: KeyMode,
    original: readonly PathStep[],
    contexto: ContextoDeSalidas,
    salida: SalidaPosible,
  ): string[] {
    const cancion = salida.secciones.flatMap((s) => s.steps);
    const nuevos = salida.secciones.filter((s) => !s.yours).flatMap((s) => s.steps);
    const compas = contexto.pulsosPorCompas ?? 4;
    const especiesTuyas = contexto.especies ?? [];
    const texto = `${salida.nombre} | ${salida.que}`;
    const fallos: string[] = [];
    const falla = (que: string) =>
      fallos.push(
        `${que}: ${texto} [${original.map((p) => `${p.degree}/${p.beats}`).join(' ')} ${JSON.stringify(contexto.pulsosPorCompas ?? 4)}]`,
      );
    const tonica = tonicaDe(mode);

    // El compás en que empieza cada acorde: «en el 3» es el compás 3, no el tercer
    // acorde, que con dos acordes por compás es otro sitio.
    const compasDe = (i: number) => Math.floor(pulsosDe(original.slice(0, i)) / compas) + 1;
    // «Cambia A por B en el N…»
    for (const [, a, b, donde, como] of salida.que.matchAll(
      /(\S+) por (\S+) en ((?:el \d+(?:, | y )?)+)(?: y \d+ más)? \(([^)]*)\)/g,
    )) {
      for (const n of [...donde!.matchAll(/el (\d+)/g)].map((m) => Number(m[1]))) {
        const i = original.findIndex(
          (antes, k) => compasDe(k) === n && antes.degree === a && cancion[k]?.degree === b,
        );
        const antes = original[i];
        const ahora = cancion[i];
        if (antes === undefined || ahora === undefined) {
          falla(`el ${n} no es ${a} por ${b}`);
          continue;
        }
        if (
          como!.startsWith('mayor por menor') &&
          !(calidad(mode, antes.degree) === 'major' && calidad(mode, ahora.degree) === 'minor')
        ) {
          falla('dice mayor por menor y no lo es');
        }
        if (
          como!.startsWith('menor por mayor') &&
          !(calidad(mode, antes.degree) === 'minor' && calidad(mode, ahora.degree) === 'major')
        ) {
          falla('dice menor por mayor y no lo es');
        }
        if (como!.includes('con séptima') && !esSeventhQuality(ahora.especie)) {
          falla('dice con séptima y no la lleva');
        }
        if (como!.startsWith('su relativo') || como!.startsWith('misma función')) {
          const de = notas(mode, antes.degree, especiesTuyas[i]);
          const comunes = [...notas(mode, ahora.degree, ahora.especie)].filter((nota) =>
            de.has(nota),
          );
          if (comunes.length < 2) {
            falla('dice que comparte dos notas y no');
          }
        }
      }
    }
    if (
      salida.que.includes('el doble de largo') &&
      !cancion.every((p, i) => p.beats === 2 * original[i]!.beats)
    ) {
      falla('no dura el doble');
    }
    if (
      salida.que.includes('la mitad de largo') &&
      !cancion.every((p, i) => 2 * p.beats === original[i]!.beats)
    ) {
      falla('no dura la mitad');
    }
    // Desigual es lo que no va a tu paso; la tónica del final sostenida un múltiplo
    // de él es una llegada, no un accidente de la toma.
    const habitual = original[0]!.beats;
    if (
      salida.que.includes('se tocó desigual') &&
      original.every(
        (p, i) =>
          p.beats === habitual ||
          (i === original.length - 1 && p.degree === tonica && p.beats % habitual === 0),
      )
    ) {
      falla('dice desigual de una toma regular');
    }
    const total = pulsosDe(cancion);
    const tuya = pulsosDe(original);
    const formas = [4, 3, 5, 6, 7].filter((k) => k === 4 || tuya % (k * compas) === 0);
    const enFrases = formas.some((k) => total % (k * compas) === 0) || tuya % (12 * compas) === 0;
    if (salida.que.includes('cuadra lo que se tocó desigual') && !enFrases) {
      falla('dice que cuadra y deja frases cojas');
    }
    if (salida.que.includes('la frase cuadra')) {
      if (!enFrases) {
        falla('dice que la frase cuadra y no cuadra');
      }
      if (tuya % (4 * compas) === 0 && salida.nombre === 'Acaba antes') {
        falla('acorta lo que ya cuadraba');
      }
    }
    const ultimo = cancion.at(-1)!.degree;
    const ultimoTuyo = original.at(-1)!.degree;
    if (
      salida.nombre.startsWith('Cierra en la tónica') &&
      (ultimoTuyo === tonica || ultimo !== tonica)
    ) {
      falla('«cierra en la tónica» de lo que ya cerraba o no cierra');
    }
    if (salida.nombre === 'Otra cadencia' && (ultimoTuyo !== tonica || ultimo !== tonica)) {
      falla('«otra cadencia» de lo que no cerraba');
    }
    const quedaEn = /^(?:Se queda en el|Cae en el|Llega al) (\S+)/.exec(salida.nombre)?.[1];
    if (quedaEn !== undefined && ultimo !== quedaEn) {
      falla(`no acaba en ${quedaEn}`);
    }
    if (salida.nombre === 'Se queda en la dominante' && ultimo !== 'V') {
      falla('no acaba en V');
    }
    // «Desde el compás N, a b c:» son los últimos, y empiezan donde dice.
    const desde =
      /^Desde (el compás (\d+)|la mitad del compás (\d+)|el pulso (\d+) del compás (\d+)), ([^:]+):/.exec(
        salida.que,
      );
    if (desde !== null) {
      const grados = desde[6]!.split(' ');
      const cola = cancion.slice(-grados.length);
      const pulso =
        desde[2] !== undefined
          ? (Number(desde[2]) - 1) * compas
          : desde[3] !== undefined
            ? (Number(desde[3]) - 1) * compas + compas / 2
            : (Number(desde[5]) - 1) * compas + Number(desde[4]) - 1;
      if (cola.map((p) => p.degree).join(' ') !== grados.join(' ')) {
        falla('lo que dice que pone no es lo que pone');
      } else if (pulsosDe(cancion.slice(0, -grados.length)) !== pulso) {
        falla('no empieza donde dice');
      }
    }
    const enCompases = /en (\d+) compases y no en (\d+) compases/.exec(salida.que);
    if (
      enCompases !== null &&
      (pulsosDe(cancion) !== Number(enCompases[1]) * compas ||
        pulsosDe(original) !== Number(enCompases[2]) * compas)
    ) {
      falla('no mide lo que dice');
    }
    // «… que llega a la tónica desde …»
    const llega = /llega a la tónica (desde [^.]*)/.exec(salida.que)?.[1];
    if (llega !== undefined && salida.path !== 'otro-final') {
      const penultimo = cancion.at(-2)!;
      const esperado =
        /desde (?:la dominante, |la dominante menor, |el |la subdominante, |)(\S+?)[,:]/
          .exec(`${llega},`)?.[1]
          ?.replace(/7$/, '');
      if (ultimo !== tonica) {
        falla('dice que llega a la tónica y no');
      } else if (
        !llega.startsWith('desde ') ||
        (esperado !== undefined && penultimo.degree !== esperado)
      ) {
        falla(`no llega desde ${esperado}`);
      } else if (
        llega.includes('bII7') !== (penultimo.especie === 'dominant7' && penultimo.degree === 'bII')
      ) {
        falla('el bII7 no es lo que suena');
      }
    }
    if (salida.nombre.startsWith('Resuelve en la') && nuevos[0]?.degree !== tonica) {
      falla('no resuelve en la tónica');
    }
    // Resolver es deshacer la tensión de una dominante: desde un ii o un II7 se
    // llega, pero no se resuelve nada.
    if (
      (salida.nombre.startsWith('Resuelve en la') || salida.que.startsWith('Resuelve en la')) &&
      !(
        roleOfDegreeSymbol(ultimoTuyo) === 'dominant' ||
        (ultimoTuyo === 'bII' && especiesTuyas.at(-1) === 'dominant7')
      )
    ) {
      falla(`dice que resuelve desde ${ultimoTuyo}, que no es una dominante`);
    }
    // Y engañar al oído es romper lo que prometía una dominante.
    if (salida.que.includes('engaña al oído') && !['V', 'vii°'].includes(cancion.at(-2)!.degree)) {
      falla(`dice que engaña desde ${cancion.at(-2)!.degree}, que no prometía nada`);
    }
    // «…, en el N»: algo cambia en el compás N.
    const enElNombre = /, en el (\d+)$/.exec(salida.nombre)?.[1];
    if (
      enElNombre !== undefined &&
      !original.some(
        (antes, k) => compasDe(k) === Number(enElNombre) && cancion[k]?.degree !== antes.degree,
      )
    ) {
      falla(`no cambia nada en el compás ${enElNombre}`);
    }
    const seVa = /que se va a ((?:\S+(?: y )?)+?) (?:y vuelve|y desde)/.exec(salida.que)?.[1];
    for (const grado of seVa?.split(' y ') ?? []) {
      if (!nuevos.some((p) => p.degree === grado) || original.some((p) => p.degree === grado)) {
        falla(`no se va a ${grado}`);
      }
    }
    const vuelve = /vuelve a tu (\S+) desde su dominante, (\S+)\./.exec(salida.que);
    if (
      vuelve !== null &&
      (original[0]!.degree !== vuelve[1] || nuevos.at(-1)?.degree !== vuelve[2])
    ) {
      falla('no vuelve como dice');
    }
    if (salida.nombre === 'El primero, el doble' && cancion[0]!.beats !== 2 * original[0]!.beats) {
      falla('el primero no dura el doble');
    }
    if (
      salida.nombre === 'El último, el doble' &&
      cancion.at(-1)!.beats !== 2 * original.at(-1)!.beats
    ) {
      falla('el último no dura el doble');
    }
    const dura = /dura (\d+) compases, una frase entera/.exec(salida.que);
    if (dura !== null && cancion[0]!.beats !== Number(dura[1]) * compas) {
      falla('no dura una frase entera');
    }
    return fallos;
  }

  it('en los dos corpus y en cien canciones al azar, ni una afirmación falsa', () => {
    const azar = semillero(5);
    // Las que destaparon frases falsas en una prueba ciega: lo que no estaba en
    // ningún corpus. Un gospel con la tónica sostenida, una bajada que acaba en
    // el ii, una toma a dos pulsos, un final que cae en el VI desde la tónica y una
    // toma desigual que al cuadrarla deja cinco compases.
    const destapadas: { mode: KeyMode; compases: PathStep[]; contexto: ContextoDeSalidas }[] = [
      {
        mode: 'major',
        compases: [...a4('I', 'I', 'IV', 'iv'), { degree: 'I', beats: 8 }],
        contexto: { especies: [null, 'dominant7', null, null, null] },
      },
      { mode: 'major', compases: a4('I', 'iii', 'bIII', 'ii'), contexto: {} },
      { mode: 'major', compases: a4('I', 'IV', 'I', 'V/V'), contexto: {} },
      { mode: 'major', compases: a4('I', 'vi', 'IV', 'ii'), contexto: { estilo: 'pop' } },
      {
        mode: 'major',
        compases: ['I', 'vi', 'ii', 'V', 'I', 'vi', 'ii', 'V'].map((degree) => ({
          degree: degree as DegreeSymbol,
          beats: 2,
        })),
        contexto: { estilo: 'jazz' },
      },
      { mode: 'minor', compases: a4('i', 'iv', 'i', 'i', 'iv', 'i'), contexto: {} },
      {
        mode: 'major',
        compases: [
          { degree: 'I', beats: 5 },
          { degree: 'IV', beats: 3 },
          { degree: 'V', beats: 4 },
          { degree: 'I', beats: 4 },
          { degree: 'vi', beats: 4 },
        ],
        contexto: {},
      },
    ];
    const canciones = [
      ...destapadas,
      ...CORPUS,
      ...CORPUS_DE_VERIFICACION,
      ...Array.from({ length: 100 }, (_, n) => {
        const { mode, original, contexto } = cancionAlAzar(azar, n);
        return { mode, compases: original, contexto };
      }),
    ];
    const fallos: string[] = [];
    let salidas = 0;
    for (const { mode, compases, contexto } of canciones) {
      for (const kind of ['continuar', 'retocar'] as const) {
        for (const salida of candidatasDeSalida(mode, kind, compases, contexto)) {
          salidas += 1;
          fallos.push(...mentiras(mode, compases, contexto, salida));
        }
      }
    }
    expect(salidas).toBeGreaterThan(3000);
    expect(fallos).toEqual([]);
  });

  /**
   * **Lo que dice el menú entero, motivos del juez incluidos**, contra las frases
   * falsas que encontraron los corpus (`diceAlgoFalso`): las cinco del ciego y las
   * cinco del final —el nombre y el motivo que no dicen la misma parte, un acorde de
   * quintas descrito por una tercera que no tiene, «la dominante resuelve» desde una
   * v sin sensible, «en el N» contando acordes, «1 notas»—. Sobre los cuatro corpus
   * y cuatrocientas canciones al azar con especies (quintas también), papel, pulsos
   * de dos, punteo y duda: miles de salidas ya juzgadas.
   */
  // Son miles de salidas juzgadas: con la máquina cargada pasa de los cinco segundos.
  it(
    'en los cuatro corpus y en cuatrocientas canciones al azar, ni un motivo falso',
    { timeout: 30_000 },
    () => {
      const azar = semillero(11);
      const falso = diceAlgoFalso();
      const canciones = [
        ...[...CORPUS, ...CORPUS_DE_VERIFICACION].flatMap((caso) =>
          (['continuar', 'retocar'] as const).map((kind) => ({ ...caso, kind })),
        ),
        ...[...examenesCiegos(), ...examenesFinales()].map(({ caso, kind }) => ({ ...caso, kind })),
        ...Array.from({ length: 400 }, (_, n) => {
          const { mode, original, contexto } = cancionAlAzar(azar, n);
          return {
            mode,
            compases: original,
            contexto,
            kind: n % 4 < 2 ? 'continuar' : 'retocar',
          } as const;
        }),
      ];
      const fallos: string[] = [];
      let salidas = 0;
      for (const { mode, compases, contexto, kind } of canciones) {
        for (const salida of salidasPosibles(mode, kind, compases, contexto)) {
          salidas += 1;
          const examinada = examinar(mode, compases, contexto, salida);
          if (falso.cumple(examinada)) {
            // Qué frase miente, sola: así el fallo dice dónde mirar.
            const culpables = [salida.nombre, salida.que, ...examinada.palabras.motivos].filter(
              (texto) =>
                falso.cumple({
                  ...examinada,
                  palabras: {
                    nombre: texto === salida.nombre ? texto : '',
                    que: texto === salida.que ? texto : '',
                    motivos: texto === salida.nombre || texto === salida.que ? [] : [texto],
                  },
                }),
            );
            fallos.push(
              `${compases.map((p) => `${p.degree}/${p.beats}`).join(' ')} «${salida.nombre}»: ${culpables.join(' | ') || examinada.palabras.motivos.join(' / ')}`,
            );
          }
        }
      }
      expect(salidas).toBeGreaterThan(3000);
      expect(fallos).toEqual([]);
    },
  );
});

/**
 * Las causas que encontró el corpus ciego, del lado de quien construye: si una buena
 * salida no se construye nadie la elige, y si se construye una de otro idioma, el
 * juez —que no sabe de qué vive cada canción— puede ponerla primera.
 */
describe('lo que el corpus ciego enseñó al generador', () => {
  const nuevosDe = (salida: SalidaPosible) =>
    salida.secciones.filter((s) => !s.yours).flatMap((s) => s.steps.map((p) => p.degree));
  const grados = (salida: SalidaPosible) =>
    salida.secciones.flatMap((s) => s.steps).map((p) => p.degree);

  it('una llegada que se sostiene no se toca; en una frase sola, lo que la sostiene es la vuelta', () => {
    const pop = candidatasDeSalida('minor', 'retocar', a4('VI', 'VII', 'i', 'i'));
    for (const salida of pop) {
      expect(grados(salida)[2], salida.nombre).toBe('i');
    }
    expect(pop.some((s) => s.path === 'rearmonizar' && grados(s)[3] !== 'i')).toBe(true);

    // Un periodo de ocho que acaba en `I I` ha acabado: otro final es otra manera de
    // llegar al mismo compás, y lo que lo sostiene se queda.
    const periodo = a4('I', 'vi', 'V/vi', 'vi', 'IV', 'V', 'I', 'I');
    const finales = candidatasDeSalida('major', 'retocar', periodo).filter(
      (s) => s.path !== 'estirar',
    );
    expect(finales.length).toBeGreaterThan(0);
    for (const salida of finales) {
      expect(grados(salida).at(-1), salida.nombre).toBe('I');
      // La llegada solo se tuerce a propósito: con la interrumpida, que es para eso.
      if (salida.familia !== 'interrumpida') {
        expect(grados(salida).slice(-2), salida.nombre).toEqual(['I', 'I']);
      }
    }
    // Y cuando hay otra cadencia, dice lo que pone, la tónica que se sostiene incluida.
    const nueve = a4('I', 'V', 'vi', 'iii', 'IV', 'I', 'V', 'I', 'I');
    // La misma cadencia sale una vez, con el nombre de quien la construye primero: la
    // predominante delante del V cambia el mismo compás.
    const otra = candidatasDeSalida('major', 'retocar', nueve).find(
      (s) => grados(s).join(' ') === 'I V vi iii IV ii V I I',
    );
    expect(otra?.nombre).toBe('Predominante delante, en el 6');
    const sinElla = candidatasDeSalida(
      'major',
      'retocar',
      a4('I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'I', 'I'),
    );
    const cadencia = sinElla.find((s) => s.nombre === 'Otra cadencia');
    expect(cadencia?.que).toMatch(
      /^Desde el compás \d+, .*: llega a la tónica por otro camino\.$/u,
    );

    // En `ii V I I`, el compás que sostiene es el sitio de la vuelta: `ii V I vi`.
    const turnaround = candidatasDeSalida('major', 'retocar', a4('ii', 'V', 'I', 'I'));
    expect(turnaround.some((s) => grados(s).join(' ') === 'ii V I vi')).toBe(true);
  });

  it('lo que pide el papel manda sobre una línea que no ha llegado', () => {
    // Una estrofa que baja por `I iii bIII ii`: la línea pide el V o el bII, y lo que
    // contrasta con una estrofa es el estribillo, que empieza donde empiezan. Si no
    // hay nada que cumpla las dos cosas, manda el papel.
    const contrastes = candidatasDeSalida('major', 'continuar', a4('I', 'iii', 'bIII', 'ii'), {
      papel: 'estrofa',
    }).filter((s) => s.path === 'contraste');
    expect(contrastes.length).toBeGreaterThan(0);
    for (const salida of contrastes) {
      expect(['I', 'IV', 'vi'], salida.nombre).toContain(nuevosDe(salida)[0]);
    }
  });

  it('un contraste pasa por casa una vez como mucho', () => {
    for (const toma of [a4('I', 'IV', 'I', 'IV'), a4('I', 'V', 'vi', 'IV'), a4('I', 'bII')]) {
      for (const salida of candidatasDeSalida('major', 'continuar', toma).filter(
        (s) => s.path === 'contraste',
      )) {
        expect(nuevosDe(salida).filter((g) => g === 'I').length, salida.nombre).toBeLessThanOrEqual(
          1,
        );
      }
    }
  });

  it('otro reparto no sale de los treinta y dos compases', () => {
    const larga = a4(
      ...Array.from({ length: 32 }, (_, i) => (['i', 'VI', 'III', 'VII'] as const)[i % 4]!),
    );
    const repartos = candidatasDeSalida('minor', 'retocar', larga).filter(
      (s) => s.path === 'estirar',
    );
    expect(repartos.length).toBeGreaterThan(0);
    for (const salida of repartos) {
      expect(pulsosDeLaCancion(salida), salida.nombre).toBeLessThanOrEqual(32 * 4);
    }
    // Y lo que dura el doble cabe si no se pasa: dieciséis compases a medio tiempo.
    const media = candidatasDeSalida('minor', 'retocar', larga.slice(0, 16));
    expect(media.some((s) => s.nombre === 'A medio tiempo')).toBe(true);
  });

  it('la ii° en tríada solo en el menor que llega con la sensible', () => {
    const natural = [
      ...candidatasDeSalida('minor', 'retocar', a4('i', 'VI', 'III', 'VII')),
      ...candidatasDeSalida('minor', 'continuar', a4('i', 'VII', 'VI', 'VII')),
    ];
    expect(natural.some((s) => grados(s).includes('ii°'))).toBe(false);
    const armonico = candidatasDeSalida('minor', 'retocar', a4('i', 'iv', 'V', 'i'));
    expect(armonico.some((s) => grados(s)[1] === 'ii°')).toBe(true);
    // Con séptima es la del jazz y el bolero, y cabe sin V.
    const jazz = candidatasDeSalida('minor', 'continuar', a4('i', 'VI', 'III', 'VII'), {
      estilo: 'jazz',
    });
    expect(jazz.some((s) => nuevosDe(s).includes('ii°'))).toBe(true);
  });

  it('la v de paso no es un modo: la bajada `i v VI III` se cierra también con el V', () => {
    const bajada = candidatasDeSalida('minor', 'continuar', a4('i', 'v', 'VI', 'III'));
    expect(bajada.some((s) => nuevosDe(s).includes('V'))).toBe(true);
    // Con el VII al lado sí lo es, y el V no entra.
    const eolio = candidatasDeSalida('minor', 'continuar', a4('i', 'v', 'VII', 'i'));
    expect(eolio.some((s) => nuevosDe(s).includes('V'))).toBe(false);
  });

  it('una canción que llega por su color cierra como ella, y su firma entera vale más', () => {
    // El reggae en `i VII` cierra primero por el VII, y el V se queda de color.
    const reggae = candidatasDeSalida('minor', 'continuar', a4('i', 'VII', 'i', 'VII'));
    const mejor = [...reggae]
      .filter((s) => s.path === 'seguir')
      .sort((x, y) => y.prioridad - x.prioridad)[0]!;
    expect(nuevosDe(mejor)).not.toContain('V');
    // Y la de cine cierra con su escalera, `bVI bVII I`, entre lo primero que construye.
    const cine = candidatasDeSalida('major', 'continuar', a4('I', 'bVI', 'bVII', 'I'), {
      estilo: 'rock',
    });
    expect(cine.some((s) => grados(s).slice(-3).join(' ') === 'bVI bVII I')).toBe(true);
  });

  it('un idioma funcional llega por la dominante y no se pinta de rock', () => {
    // La célula ii7–V7 dice funcional aunque no haya secundarias ni estilo.
    const rnb = candidatasDeSalida('major', 'continuar', a4('I', 'vi', 'ii', 'V'), {
      especies: ['major7', 'minor7', 'minor7', 'dominant7'],
    });
    for (const salida of rnb) {
      expect(nuevosDe(salida), salida.nombre).not.toContain('bVII');
    }
    const otraFrase = candidatasDeSalida('major', 'continuar', a4('ii', 'V', 'I', 'IV'), {
      especies: ['minor7', 'dominant7', 'major7', 'major7'],
    }).filter((s) => s.path === 'seguir' && nuevosDe(s).length > 1);
    expect(otraFrase.length).toBeGreaterThan(0);
    for (const salida of otraFrase) {
      expect(
        (['V', 'vii°', 'bII'] as const).some((g) => nuevosDe(salida).includes(g)),
        salida.nombre,
      ).toBe(true);
    }
    // Y la `ii° V i` del menor también, en tríadas.
    const latin = candidatasDeSalida('minor', 'retocar', a4('i', 'ii°', 'V', 'i'));
    expect(latin.some((s) => grados(s)[2] === 'bII')).toBe(true);
    expect(latin.some((s) => grados(s)[2] === 'VII')).toBe(false);
  });

  it('el idioma de dominantes no cambia de gama', () => {
    const funk = candidatasDeSalida('major', 'retocar', a4('I', 'IV', 'I', 'IV'), {
      especies: ['dominant7', 'dominant7', 'dominant7', 'dominant7'],
    });
    for (const salida of funk) {
      expect(
        grados(salida).some((g) => ['vi', 'iii', 'bVI'].includes(g)),
        salida.nombre,
      ).toBe(false);
      // Un IV7 no pasa a su relativo: perdería la séptima, la nota de blues.
      expect(grados(salida)[1], salida.nombre).not.toBe('ii');
    }
    // El ii7–V7 de un funk sin estilo sí; en un blues con su estilo, no.
    const vamp = a4('I', 'I', 'I', 'I');
    const dominantes = { especies: Array<EspecieDeBloque>(4).fill('dominant7') };
    expect(
      candidatasDeSalida('major', 'continuar', vamp, dominantes).some((s) =>
        nuevosDe(s).includes('ii'),
      ),
    ).toBe(true);
    expect(
      candidatasDeSalida('major', 'continuar', vamp, { ...dominantes, estilo: 'blues' }).some((s) =>
        nuevosDe(s).includes('ii'),
      ),
    ).toBe(false);
  });

  it('en folk lo prestado es el bVII: el iv y el bVI no se traen a una canción que no los toca', () => {
    const country = candidatasDeSalida('major', 'continuar', a4('I', 'IV', 'I', 'V'), {
      estilo: 'folk',
    });
    for (const salida of country) {
      expect(
        nuevosDe(salida).some((g) => ['iv', 'bVI', 'bIII'].includes(g)),
        salida.nombre,
      ).toBe(false);
    }
    expect(country.some((s) => nuevosDe(s).includes('bVII'))).toBe(true);
    // Si ya tocas uno, es tu color.
    const conIv = candidatasDeSalida('major', 'continuar', a4('I', 'IV', 'iv', 'I'), {
      estilo: 'folk',
    });
    expect(conIv.some((s) => nuevosDe(s).includes('iv'))).toBe(true);
  });

  it('lo que vive de la mezcla con el menor sigue en ella', () => {
    const cine = candidatasDeSalida('major', 'continuar', a4('I', 'iv', 'I', 'iv'));
    expect(cine.length).toBeGreaterThan(0);
    for (const salida of cine) {
      expect(
        nuevosDe(salida).some((g) => g.includes('/') || ['ii', 'iii', 'vi'].includes(g)),
        salida.nombre,
      ).toBe(false);
    }
    // Un iv de paso no es vivir de ello: el soul admite su III7.
    const soul = candidatasDeSalida('major', 'continuar', a4('I', 'vi', 'IV', 'iv'));
    expect(soul.some((s) => nuevosDe(s).some((g) => g.includes('/')))).toBe(true);
  });

  it('otro final no se lleva tu color, ni cambiándolo por otro de otra casa', () => {
    const cantautor = candidatasDeSalida('major', 'retocar', a4('I', 'IV', 'iv', 'I'), {
      estilo: 'folk',
    });
    const abierto = cantautor.find((s) => s.nombre === 'Se queda en la dominante');
    expect(abierto && grados(abierto)).toEqual(['I', 'IV', 'iv', 'V']);
  });

  it('sobre lo que se oyó con duda, lo seguro', () => {
    // Una toma entera dudosa no recibe color; lo que sí se oyó bien no cuenta.
    const dudosa = candidatasDeSalida('major', 'continuar', a4('I', 'IV', 'V', 'I'), {
      dudosos: [true, true, true, true],
    });
    expect(dudosa.some((s) => nuevosDe(s).length > 0)).toBe(true);
    const clara = candidatasDeSalida('major', 'continuar', a4('I', 'IV', 'V', 'I'), {
      dudosos: [false, false, false, true],
    });
    expect(clara.some((s) => nuevosDe(s).some((g) => g.includes('/') || g === 'iv'))).toBe(true);
  });

  it('el sustituto tritonal va donde iría el V, no recién salido de casa', () => {
    const funk = candidatasDeSalida('minor', 'continuar', a4('i', 'i'), {
      estilo: 'jazz',
      especies: ['minor7', 'minor7'],
    });
    for (const salida of funk) {
      const todos = ['i', ...nuevosDe(salida)];
      todos.forEach((g, k) => {
        expect(g === 'bII' && todos[k - 1] === 'i', salida.nombre).toBe(false);
      });
    }
    // En tríadas, el bII de casa es el frigio, y sí sale de la tónica.
    const metal = candidatasDeSalida('minor', 'continuar', a4('i', 'i'), { estilo: 'metal' });
    expect(metal.some((s) => nuevosDe(s)[0] === 'bII')).toBe(true);
  });

  it('la dominante del iii, con dos notas de fuera, no se trae fuera del jazz', () => {
    const relativa = candidatasDeSalida('major', 'continuar', a4('I', 'IV', 'V/vi', 'vi'), {
      estilo: 'pop',
    });
    expect(relativa.some((s) => nuevosDe(s).includes('V/iii'))).toBe(false);
    const jazz = candidatasDeSalida('major', 'continuar', a4('I', 'IV', 'V/vi', 'vi'), {
      estilo: 'jazz',
    });
    expect(jazz.some((s) => nuevosDe(s).includes('V/iii'))).toBe(true);
  });

  it('una secundaria que no va a lo que prepara no es un camino bueno', () => {
    const country = candidatasDeSalida('major', 'continuar', a4('I', 'I', 'V/V', 'V'), {
      estilo: 'folk',
    });
    for (const salida of country) {
      const todos = grados(salida);
      todos.forEach((g, k) => {
        if (g === 'V/vi' && k < todos.length - 1) {
          expect(['vi', 'V/ii'], salida.nombre).toContain(todos[k + 1]);
        }
      });
    }
  });

  /**
   * La bajada sigue entera **en el bajo**: lo que entra se toca sobre la nota de la
   * línea —la v sobre el Sol del VII, el iv sobre el Fa del VI, el lamento de
   * manual—, y el V del final no se toca. Antes no se le cambiaba ni un acorde, y
   * con punteo el menú de la andaluza se quedaba vacío (lo encontró el corpus final).
   */
  it('la andaluza no se rompe ni se deshace: su V va a la tónica', () => {
    const andaluza = a4('i', 'VII', 'VI', 'V');
    const rearmonizadas = candidatasDeSalida('minor', 'retocar', andaluza).filter(
      (s) => s.path === 'rearmonizar',
    );
    expect(rearmonizadas.length).toBeGreaterThan(0);
    for (const salida of rearmonizadas) {
      grados(salida).forEach((grado, i) => {
        const bajo = resolveDegree(0, 'minor', andaluza[i]!.degree).root;
        expect(resolveDegree(0, 'minor', grado).notes, salida.nombre).toContain(bajo);
      });
      expect(grados(salida).at(-1), salida.nombre).toBe('V');
    }
    expect(rearmonizadas.map((s) => grados(s).join(' '))).toContain('i v iv V');
    for (const salida of candidatasDeSalida('minor', 'continuar', andaluza)) {
      expect(nuevosDe(salida)[0], salida.nombre).not.toBe('VI');
    }
  });

  it('un vamp modal no recibe la sensible de su centro, si no la tenía', () => {
    const dorico = candidatasDeSalida('major', 'retocar', a4('ii', 'V', 'ii', 'V'));
    expect(dorico.some((s) => grados(s).includes('V/ii'))).toBe(false);
    expect(dorico.length).toBeGreaterThan(0);
  });

  it('lo nuevo de un grado suspendido y resuelto suena resuelto', () => {
    const sus = candidatasDeSalida('major', 'retocar', a4('I', 'IV', 'V', 'V'), {
      especies: [null, null, 'sus4', null],
    });
    for (const salida of sus.filter((s) => s.path === 'otro-final')) {
      const pasos = salida.secciones[0]!.steps;
      pasos.forEach((paso, k) => {
        if (k >= 2 && paso.degree === 'V' && k !== 2) {
          expect(paso.especie ?? null, salida.nombre).toBeNull();
        }
      });
    }
  });

  it('la dominante sin sensible, y al revés: el bVII del rock y la puerta de delante del jazz', () => {
    const louie = candidatasDeSalida(
      'major',
      'retocar',
      [
        { degree: 'I', beats: 2 },
        { degree: 'IV', beats: 2 },
        { degree: 'V', beats: 2 },
        { degree: 'IV', beats: 2 },
      ],
      { estilo: 'rock' },
    );
    const sinSensible = louie.find((s) => grados(s)[2] === 'bVII');
    expect(sinSensible?.nombre).toBe('Sin sensible, en el 2');
    const backdoor = candidatasDeSalida('major', 'retocar', a4('iv', 'bVII', 'I', 'I'), {
      estilo: 'jazz',
      especies: ['minor7', 'dominant7', 'major7', 'major7'],
    });
    const conSensible = backdoor.find((s) => grados(s)[1] === 'V');
    expect(conSensible?.nombre).toBe('Con sensible, en el 2');
  });
});

/**
 * Lo que un arreglista echaba en falta: los cuatro movimientos que dependen del sitio
 * de la forma, y las formas que se completan.
 */
describe('los movimientos y las formas que faltaban', () => {
  const pasos = (salida: SalidaPosible) => salida.secciones.flatMap((s) => s.steps);
  const de = (salida: SalidaPosible) => pasos(salida).map((p) => p.degree);

  it('la predominante entra delante del V, con sus dos subdominantes', () => {
    const vals = candidatasDeSalida('major', 'retocar', a4('I', 'I', 'V', 'V', 'V', 'V', 'I', 'I'));
    const predominantes = vals.filter((s) => s.familia === 'predominante');
    const cancionesDe = predominantes.map((s) => de(s).join(' '));
    expect(cancionesDe).toContain('I IV V V V V I I');
    expect(cancionesDe).toContain('I ii V V V V I I');
    expect(predominantes.every((s) => pasos(s).some((p) => p.move === 'predominante'))).toBe(true);
  });

  it('el cambio rápido se pone en el 2 de un blues, y se valida en ese sitio', () => {
    const blues = a4('I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V');
    const rapido = candidatasDeSalida('major', 'retocar', blues, { estilo: 'blues' }).find(
      (s) => s.familia === 'cambio-rapido',
    );
    expect(rapido && de(rapido).slice(0, 3)).toEqual(['I', 'IV', 'I']);
    expect(rapido?.nombre).toBe('Cambio rápido, en el 2');
    // Fuera de un blues el mismo cambio no es el cambio rápido.
    expect(
      pathProblem('major', 'rearmonizar', a4('I', 'I', 'I', 'V'), [
        { degree: 'I', beats: 4 },
        { degree: 'IV', beats: 4, move: 'cambio-rapido' },
        { degree: 'I', beats: 4 },
        { degree: 'V', beats: 4 },
      ]),
    ).toBe('el movimiento declarado no es el que se ha hecho');
  });

  it('el semitono frigio entra donde es de la casa, y no en mayor sin estilo', () => {
    // En un metal, el VII que llega a la i pasa a bII: la cadencia frigia.
    const metal = candidatasDeSalida('minor', 'retocar', a4('i', 'i', 'VII', 'i'), {
      estilo: 'metal',
    });
    const frigio = metal.find((s) => s.familia === 'frigio');
    expect(frigio && de(frigio)).toEqual(['i', 'i', 'bII', 'i']);
    expect(frigio?.nombre).toBe('Semitono frigio, en el 3');
    const mayor = candidatasDeSalida('major', 'retocar', a4('I', 'IV', 'V', 'I'), {
      estilo: 'country',
    });
    expect(mayor.some((s) => s.familia === 'frigio')).toBe(false);
  });

  it('la dominante partida en su ii: dos acordes donde había uno, los mismos pulsos', () => {
    const tuyo = a4('I', 'vi', 'V', 'I');
    const partida = candidatasDeSalida('major', 'retocar', tuyo).find((s) => s.familia === 'ii-v');
    expect(partida && cancionDe(partida)).toEqual(['I/4', 'vi/4', 'ii/2', 'V/2', 'I/4']);
    expect(partida?.nombre).toBe('Partir la dominante, en el 3');
    expect(partida?.que).toContain('la primera mitad pasa a ii');
    expect(pasos(partida!).filter((p) => p.move === 'ii-v')).toHaveLength(2);
    // Y la comprobación lo empareja por pulsos.
    const propuesta: ProposedStep[] = pasos(partida!);
    expect(pathProblem('major', 'rearmonizar', tuyo, propuesta)).toBeNull();
    // Sin declararlo en las dos mitades, u otro ii, no es eso.
    expect(
      pathProblem('major', 'rearmonizar', tuyo, [
        ...propuesta.slice(0, 2),
        { degree: 'ii', beats: 2, move: 'ii-v' },
        { degree: 'V', beats: 2 },
        propuesta[4]!,
      ]),
    ).toBe('rearmonizar no cambia el largo');
    expect(
      pathProblem('major', 'rearmonizar', tuyo, [
        ...propuesta.slice(0, 2),
        { degree: 'IV', beats: 2, move: 'ii-v' },
        { degree: 'V', beats: 2, move: 'ii-v' },
        propuesta[4]!,
      ]),
    ).toBe('rearmonizar no cambia el largo');
    expect(
      pathProblem('major', 'rearmonizar', tuyo, [
        { degree: 'I', beats: 4 },
        { degree: 'vi', beats: 3 },
        { degree: 'V', beats: 5 },
        { degree: 'I', beats: 4 },
      ]),
    ).toBe('rearmonizar no cambia el reparto');
  });

  it('no se parte lo que el micro oyó con duda, ni una dominante suspendida', () => {
    const tuyo = a4('I', 'vi', 'V', 'I');
    for (const contexto of [
      { dudosos: [false, false, true, false] },
      { especies: [null, null, 'sus4', null] as const },
    ]) {
      expect(
        candidatasDeSalida('major', 'retocar', tuyo, contexto).some((s) => s.familia === 'ii-v'),
      ).toBe(false);
    }
  });

  it('un punteo que choca con el ii no deja partir la dominante', () => {
    // Un Sib fuerte, medio tono por encima del La del ii.
    const conPunteo = candidatasDeSalida('major', 'retocar', a4('I', 'vi', 'V', 'I'), {
      melodia: [[], [], [{ nota: 10, fuerte: true }], []],
    });
    expect(conPunteo.some((s) => s.familia === 'ii-v')).toBe(false);
  });

  it('A A B: vuelve la sección que ya cerraba, y la AABA queda entera', () => {
    const aab = a4('I', 'vi', 'ii', 'V', 'I', 'vi', 'V', 'I', 'IV', 'IV', 'ii', 'V');
    const vuelta = candidatasDeSalida('major', 'continuar', aab).find((s) => s.familia === 'aaba');
    expect(vuelta && añadidos(vuelta)).toEqual(['I', 'vi', 'V', 'I']);
    expect(vuelta?.path).toBe('seguir');
    expect(vuelta?.que).toContain('ya cerraba');
    const juicio = encaje(
      'major',
      'continuar',
      aab,
      {},
      {
        path: 'seguir',
        cancion: pasos(vuelta!),
        loQueSeAnade: 'misma',
      },
    );
    expect(juicio.criterios.find((c) => c.id === 'forma')?.motivo).toContain('la AABA entera');
  });

  it('A A B sin ninguna que cierre: su cabeza y un final en casa', () => {
    const aab = a4('I', 'vi', 'ii', 'V', 'I', 'vi', 'ii', 'V', 'IV', 'IV', 'ii', 'V');
    const vuelta = candidatasDeSalida('major', 'continuar', aab).find((s) => s.familia === 'aaba');
    const nuevo = vuelta && añadidos(vuelta);
    expect(nuevo?.slice(0, 2)).toEqual(['I', 'vi']);
    expect(nuevo?.at(-1)).toBe('I');
    expect(vuelta?.que).toContain('llega a la I por');
    // Con la cabeza en un solo acorde de dos compases, el cierre sale de él.
    const larga: PathStep[] = [
      ...[0, 1].flatMap(() => [{ degree: 'I' as const, beats: 8 }, ...a4('ii', 'V')]),
      ...a4('IV', 'IV', 'ii', 'V'),
    ];
    const deUnAcorde = candidatasDeSalida('major', 'continuar', larga).find(
      (s) => s.familia === 'aaba',
    );
    expect(deUnAcorde?.secciones.at(-1)!.steps[0]).toMatchObject({ degree: 'I', beats: 8 });
  });

  it('A A: la sección que contrasta va delante, y el juez la reconoce', () => {
    const aa = a4('I', 'vi', 'ii', 'V', 'I', 'vi', 'V', 'I');
    const contrastes = candidatasDeSalida('major', 'continuar', aa).filter(
      (s) => s.path === 'contraste' && añadidos(s).length === 4 && añadidos(s)[0] !== 'I',
    );
    expect(contrastes.length).toBeGreaterThan(0);
    const juicio = encaje(
      'major',
      'continuar',
      aa,
      {},
      {
        path: 'contraste',
        cancion: pasos(contrastes[0]!),
        loQueSeAnade: 'otra',
      },
    );
    expect(juicio.criterios.find((c) => c.id === 'forma')?.motivo).toContain('AABA');
  });

  it('una andaluza sin estilo puede seguir hasta reposar en su V, sin resolverlo', () => {
    const andaluza = a4('i', 'VII', 'VI', 'V');
    const reposos = candidatasDeSalida('minor', 'continuar', andaluza).filter(
      (s) => s.path === 'seguir' && de(s).at(-1) === 'V',
    );
    expect(reposos.length).toBeGreaterThan(0);
    for (const salida of reposos) {
      expect(añadidos(salida)[0], salida.nombre).toBe('i');
      expect(añadidos(salida).at(-2), salida.nombre).toBe('VI');
      expect(salida.que).toContain('sin resolverlo a la tónica');
    }
    // Lo que no es una andaluza sigue teniendo que cerrar en la tónica.
    expect(
      songProblem('minor', 'seguir', a4('i', 'iv', 'VI', 'V'), [
        { name: 'Lo que llevas', yours: true, steps: a4('i', 'iv', 'VI', 'V') },
        { name: 'Cierre', yours: false, steps: a4('i', 'III', 'VI', 'V') },
      ]),
    ).toBe('seguir tiene que cerrar en la tónica');
    // Y en un flamenco, sí puede reposar ahí.
    expect(
      songProblem(
        'minor',
        'seguir',
        a4('i', 'iv', 'VI', 'V'),
        [
          { name: 'Lo que llevas', yours: true, steps: a4('i', 'iv', 'VI', 'V') },
          { name: 'Cierre', yours: false, steps: a4('i', 'III', 'VI', 'V') },
        ],
        'flamenco',
      ),
    ).toBeNull();
  });
});
