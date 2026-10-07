import { describe, expect, it } from 'vitest';

import {
  captureMelody,
  clampOffset,
  clampStart,
  isDoubtfulNote,
  isInScaleOffset,
  MAX_LEAD_NOTES,
  MAX_OFFSET,
  midiOf,
  NOTA_DUDOSA,
  MIN_OFFSET,
  offsetOfStep,
  GRID,
  NOTE_LENGTHS,
  snapLength,
  snapToGrid,
  writeNote,
  type LeadNote,
  figuraDe,
  cuantizar,
  RETARDO_DEL_TONO_MS,
  transcribirPunteo,
  type FotogramaDeTono,
} from './melody';
import { pitchClassFromName } from './notes';

const C = pitchClassFromName('C');
const G = pitchClassFromName('G');
const Eb = pitchClassFromName('Eb');

function nota(extra: Partial<LeadNote> = {}): LeadNote {
  return { id: 'n', offset: 0, start: 0, length: 1, ...extra };
}

describe('la rejilla', () => {
  // Un cuarto de pulso: la semicorchea. Era medio —la corchea— y eso partía los
  // punteos, porque un guitarrista toca más rápido que eso.
  it('el tiempo cae en cuartos de pulso', () => {
    expect(snapToGrid(1.2)).toBe(1.25);
    expect(snapToGrid(1.3)).toBe(1.25);
    expect(snapToGrid(1.4)).toBe(1.5);
    expect(clampStart(-4)).toBe(0);
  });

  // Arrastrando el borde de una negra hacia la blanca, a mitad de camino lo que
  // se quiere es la que esté más cerca, no siempre la corta.
  it('la duración se va a la figura más cercana, no a la de abajo', () => {
    expect(snapLength(1.9)).toBe(2);
    expect(snapLength(1.1)).toBe(1);
    expect(snapLength(0.1)).toBe(0.25);
    expect(snapLength(0.4)).toBe(0.5);
    expect(snapLength(99)).toBe(4);
  });

  /**
   * **La rejilla y las figuras se mueven juntas.** Una rejilla más fina que la
   * figura más corta pone notas en sitios donde no se pueden escribir, y una más
   * gruesa las apila: con la rejilla en la corchea, un punteo de semicorcheas
   * metía dos notas en cada posición.
   */
  it('la rejilla y la figura mas corta son la misma', () => {
    expect(GRID).toBe(Math.min(...NOTE_LENGTHS));
  });

  it('toda duración que sale tiene figura con la que escribirse', () => {
    for (const pedida of [0.1, 0.7, 1.4, 2.6, 3.9, 12]) {
      expect(NOTE_LENGTHS).toContain(snapLength(pedida));
    }
  });

  it('lo que no es un número no rompe nada', () => {
    expect(snapLength(Number.NaN)).toBe(1);
    expect(clampStart(Number.NaN)).toBe(0);
    expect(clampOffset(Number.NaN)).toBe(0);
  });

  it('la altura tiene techo y suelo', () => {
    expect(clampOffset(99)).toBe(MAX_OFFSET);
    expect(clampOffset(-99)).toBe(MIN_OFFSET);
  });
});

describe('isInScaleOffset', () => {
  // Es lo que separa la interfaz de quien no sabe música de la de quien sí: a uno
  // solo se le ofrecen las de dentro, el otro escribe la de fuera.
  it('distingue las de la escala de las de fuera', () => {
    expect(isInScaleOffset(0, C, 'major')).toBe(true);
    expect(isInScaleOffset(4, C, 'major')).toBe(true);
    expect(isInScaleOffset(1, C, 'major')).toBe(false);
  });

  it('vale para cualquier octava, arriba y abajo', () => {
    expect(isInScaleOffset(12, C, 'major')).toBe(true);
    expect(isInScaleOffset(-5, C, 'major')).toBe(true);
    expect(isInScaleOffset(-11, C, 'major')).toBe(false);
  });
});

describe('midiOf', () => {
  it('el mismo punteo suena transportado al cambiar de tonalidad', () => {
    const enDo = midiOf(nota({ offset: 7 }), C);
    const enSol = midiOf(nota({ offset: 7 }), G);
    expect(enSol - enDo).toBe(7);
  });

  it('los semitonos se cuentan sobre la tónica', () => {
    expect(midiOf(nota({ offset: 12 }), C) - midiOf(nota({ offset: 0 }), C)).toBe(12);
  });
});

describe('writeNote', () => {
  // La letra es lo que decide la línea del pentagrama: un F y un F# van en la
  // misma, y la alteración es un signo delante que no la mueve de sitio.
  it('separa la letra de la alteración', () => {
    expect(writeNote(nota({ offset: 0 }), C, 'major')).toMatchObject({
      letter: 'C',
      accidental: '',
    });
    expect(writeNote(nota({ offset: 6 }), C, 'major')).toMatchObject({
      letter: 'F',
      accidental: '#',
    });
  });

  it('una tonalidad de bemoles se escribe con bemoles', () => {
    expect(writeNote(nota({ offset: 3 }), Eb, 'major').accidental).toBe('b');
  });

  // Cada escalón es media línea del pentagrama. Una octava son siete, y no doce:
  // es lo que hace que un Do# y un Do se dibujen en el mismo sitio.
  it('los escalones son diatónicos, no cromáticos', () => {
    const grave = writeNote(nota({ offset: 0 }), C, 'major').step;
    const agudo = writeNote(nota({ offset: 12 }), C, 'major').step;
    expect(agudo - grave).toBe(7);

    expect(writeNote(nota({ offset: 1 }), C, 'major').step).toBe(grave);
  });

  it('sube de escalón al pasar de nota, no al pasar de semitono', () => {
    const pasos = [0, 2, 4, 5, 7, 9, 11].map(
      (offset) => writeNote(nota({ offset }), C, 'major').step,
    );
    expect(pasos).toEqual([
      pasos[0]! + 0,
      pasos[0]! + 1,
      pasos[0]! + 2,
      pasos[0]! + 3,
      pasos[0]! + 4,
      pasos[0]! + 5,
      pasos[0]! + 6,
    ]);
  });
});

describe('offsetOfStep', () => {
  // La vuelta de writeNote. Sin ella, arrastrar una nota en el pentagrama no
  // sabría a qué altura la están soltando.
  it('deshace lo que hace writeNote', () => {
    for (const offset of [-12, -5, 0, 2, 4, 7, 12, 16, 24]) {
      const escrita = writeNote(nota({ offset }), C, 'major');
      expect(offsetOfStep(escrita.step, C, 'major'), String(offset)).toBe(offset);
    }
  });

  /**
   * En Sol mayor, subir del Mi al Fa tiene que dar un Fa **sostenido**: es lo que
   * espera cualquiera que esté escribiendo en Sol, y es la razón de que esto pase
   * por la armadura y no por la escala.
   */
  it('la armadura decide qué nota es cada línea', () => {
    const enDo = offsetOfStep(3, C, 'major');
    const enSol = offsetOfStep(3, G, 'major');
    expect(midiOf(nota({ offset: enDo }), C)).toBe(65); // Fa natural
    expect(midiOf(nota({ offset: enSol }), G)).toBe(66); // Fa sostenido
  });

  // Las siete letras, una vez cada una, incluso donde los doce nombres se pisan:
  // en Fa sostenido mayor el Mi sostenido se llama `F` y taparía al Fa sostenido
  // si esto buscara la letra entre las notas de la escala.
  it('funciona también en las tonalidades lejanas', () => {
    const Fs = pitchClassFromName('F#');
    const alturas = [0, 1, 2, 3, 4, 5, 6].map((step) =>
      midiOf(nota({ offset: offsetOfStep(step, Fs, 'major') }), Fs),
    );
    expect(new Set(alturas.map((m) => m % 12)).size).toBe(7);
  });
});

/**
 * **Cómo se escribe cada duración, en un solo sitio.**
 *
 * Esto estaba dos veces —el pentagrama y la figura suelta del selector— y al bajar
 * la rejilla a la semicorchea solo se arregló una: la semicorchea se dibujaba con
 * un corchete, igual que la corchea, y se llamaba «0.25 pulsos». Es el fallo que la
 * duplicación produce siempre, así que lo que se prueba aquí es que **todas** las
 * duraciones que se pueden escribir tienen figura y nombre.
 */
describe('la figura de una duración', () => {
  it('las siete que existen tienen nombre, y ninguno es un numero', () => {
    for (const length of NOTE_LENGTHS) {
      const { nombre } = figuraDe(length);

      expect(nombre, `${length} sin nombre`).not.toContain('pulsos');
      expect(nombre).not.toBe('');
    }
  });

  /**
   * El número de corchetes **es** la figura: con uno para las dos, un punteo de
   * semicorcheas se lee al doble de lo que dura.
   */
  it('la semicorchea lleva dos corchetes y la corchea uno', () => {
    expect(figuraDe(0.25)).toMatchObject({ nombre: 'semicorchea', corchetes: 2 });
    expect(figuraDe(0.5)).toMatchObject({ nombre: 'corchea', corchetes: 1 });
    expect(figuraDe(1).corchetes).toBe(0);
  });

  it('de la blanca arriba la cabeza va hueca, y la redonda no lleva plica', () => {
    expect(figuraDe(1).hueca).toBe(false);
    expect(figuraDe(2).hueca).toBe(true);
    expect(figuraDe(4).plica).toBe(false);
    expect(figuraDe(2).plica).toBe(true);
  });

  // Los puntillos son los dos valores de la lista que no son potencia de dos.
  it('solo llevan puntillo la negra y la blanca con puntillo', () => {
    expect(NOTE_LENGTHS.filter((length) => figuraDe(length).punto)).toEqual([1.5, 3]);
  });
});

describe('captureMelody', () => {
  /** Una nota oída, a 120 bpm: medio segundo el pulso. */
  const EN_DO = { tonic: C, bpm: 120 };

  it('convierte lo punteado en notas con su sitio y su figura', () => {
    // Do central y la quinta encima, un pulso cada una.
    const capture = captureMelody(
      [
        { midi: 60, at: 0 },
        { midi: 67, at: 500 },
      ],
      { ...EN_DO, endedAt: 1000 },
    );

    expect(capture.notes).toHaveLength(2);
    expect(capture.notes[0]).toMatchObject({ offset: 0, start: 0, length: 1 });
    expect(capture.notes[1]).toMatchObject({ offset: 7, start: 1, length: 1 });
  });

  /**
   * El historial de la sesión reapunta la misma altura cada cuarto de segundo
   * mientras suena, así que una negra llega partida en trozos iguales. Sin
   * fundirlos, un punteo de seis notas salía como quince —se vio grabando uno de
   * verdad—.
   *
   * Lo que se acepta con ello: dos notas iguales repetidas se escriben como una
   * sola larga. Este motor no las distingue, porque mide altura y no ataques.
   */
  it('las iguales seguidas se funden en una sola nota larga', () => {
    const capture = captureMelody(
      [
        { midi: 60, at: 0 },
        { midi: 60, at: 250 },
        { midi: 60, at: 500 },
        { midi: 64, at: 750 },
      ],
      { ...EN_DO, endedAt: 1000 },
    );
    expect(capture.notes).toHaveLength(2);
    expect(capture.notes[0]).toMatchObject({ offset: 0, start: 0, length: 1.5 });
    expect(capture.notes[1]).toMatchObject({ offset: 4, start: 1.5 });
  });

  // La peor claridad de las que se funden, por lo mismo que el peor margen en los
  // acordes: si en algún trozo la señal llegó sucia, la nota entera es dudosa.
  it('al fundir, se queda la peor claridad', () => {
    const capture = captureMelody(
      [
        { midi: 60, at: 0, clarity: 0.9 },
        { midi: 60, at: 500, clarity: 0.3 },
        { midi: 64, at: 1000, clarity: 0.9 },
      ],
      { ...EN_DO, endedAt: 1500 },
    );
    expect(capture.notes).toHaveLength(2);
  });

  // Por debajo de una semicorchea, en una guitarra, es casi siempre un roce de
  // púa o el ataque de la siguiente.
  it('lo que dura menos de una semicorchea no cuenta', () => {
    const capture = captureMelody(
      [
        { midi: 60, at: 0 },
        { midi: 62, at: 50 },
        { midi: 64, at: 500 },
      ],
      { ...EN_DO, endedAt: 1000 },
    );
    expect(capture.notes).toHaveLength(2);
    expect(capture.skipped).toBe(1);
  });

  it('el mismo punteo en otra tonalidad da otros semitonos', () => {
    const enDo = captureMelody([{ midi: 60, at: 0 }], { ...EN_DO, endedAt: 1000 });
    const enSol = captureMelody([{ midi: 60, at: 0 }], { ...EN_DO, tonic: G, endedAt: 1000 });
    expect(enSol.notes[0]!.offset - enDo.notes[0]!.offset).toBe(-7);
  });

  /**
   * Una nota arrastrada hasta el techo es una nota que no se tocó, y recortarla
   * mentiría sobre lo que sonó. Se cuenta y se deja fuera.
   */
  it('lo que no cabe en el rango se cuenta, no se recorta', () => {
    const capture = captureMelody(
      [
        { midi: 60, at: 0 },
        { midi: 120, at: 500 },
      ],
      { ...EN_DO, endedAt: 1000 },
    );
    expect(capture.notes).toHaveLength(1);
    expect(capture.outOfRange).toBe(1);
  });

  // Lo tocado antes de darle a apuntar no es parte del punteo.
  it('no apunta lo que sonó antes de empezar', () => {
    const capture = captureMelody(
      [
        { midi: 60, at: 0 },
        { midi: 64, at: 2000 },
      ],
      { ...EN_DO, startedAt: 1000, endedAt: 3000 },
    );
    expect(capture.notes).toHaveLength(1);
    expect(capture.notes[0]).toMatchObject({ offset: 4, start: 2 });
  });

  it('sin nada tocado no devuelve nada, y no revienta', () => {
    expect(captureMelody([], { ...EN_DO, endedAt: 1000 })).toEqual({
      notes: [],
      skipped: 0,
      outOfRange: 0,
    });
  });
});

/**
 * **Un punteo normal no se puede dibujar encima de sí mismo.**
 *
 * Con la rejilla en la corchea, seis notas a 150 ms —semicorcheas a 100 bpm, lo
 * que toca cualquiera— salían en cuatro posiciones: `0 · 0,5 · 0,5 · 1 · 1 ·
 * 1,5`. Tres pares caían en el mismo sitio y el pentagrama los dibujaba uno
 * encima de otro, que es lo que se veía al transcribir.
 */
describe('un punteo rápido no apila notas', () => {
  /** Seis notas a 150 ms: semicorcheas a 100 bpm. */
  const RAPIDO = [60, 62, 64, 65, 67, 69].map((midi, i) => ({ midi, at: i * 150 }));

  it('cada nota cae en su sitio, y ninguna en el de otra', () => {
    const capture = captureMelody(RAPIDO, { tonic: C, bpm: 100, endedAt: 6 * 150 });

    expect(capture.notes).toHaveLength(6);
    const inicios = capture.notes.map((nota) => nota.start);
    expect(new Set(inicios).size).toBe(inicios.length);
    expect(inicios).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25]);
  });

  it('y con la figura que de verdad dura, no con el doble', () => {
    const capture = captureMelody(RAPIDO, { tonic: C, bpm: 100, endedAt: 6 * 150 });

    // Semicorcheas. Con la rejilla vieja salían corcheas: el doble de lo tocado.
    expect(capture.notes.map((nota) => nota.length)).toEqual([0.25, 0.25, 0.25, 0.25, 0.25, 0.25]);
  });

  /**
   * Y la regla general, que es la que no se puede romper: en un punteo lo que se
   * dibuja es una línea, no un acorde. Dos notas en el mismo punto no son
   * ilegibles, son **imposibles de leer**: el pentagrama no tiene forma de
   * enseñarlas.
   */
  it('ninguna nota dura mas alla de donde empieza la siguiente', () => {
    const irregular = [
      { midi: 60, at: 0 },
      { midi: 62, at: 130 },
      { midi: 64, at: 900 },
      { midi: 65, at: 1000 },
      { midi: 67, at: 2600 },
    ];
    const capture = captureMelody(irregular, { tonic: C, bpm: 100, endedAt: 3200 });

    for (const [i, nota] of capture.notes.entries()) {
      const siguiente = capture.notes[i + 1];
      if (siguiente !== undefined) {
        expect(nota.start + nota.length, `la ${i + 1}ª pisa a la siguiente`).toBeLessThanOrEqual(
          siguiente.start,
        );
      }
    }
  });

  /**
   * **Y recortarla no la deja sin figura.** El hueco entre dos inicios de la
   * rejilla puede ser 0,75 pulsos —una corchea con puntillo, que no está en la
   * lista—, así que recortar al hueco exacto escribiría una nota que el
   * pentagrama no sabe dibujar. Se baja a la figura que cabe.
   */
  it('lo recortado sigue teniendo figura', () => {
    // La primera dura 0,77 pulsos y la segunda empieza en 0,75: la primera se
    // había ido a la negra y hay que recortarla, y en el hueco solo cabe media.
    const capture = captureMelody(
      [
        { midi: 60, at: 0 },
        { midi: 62, at: 460 },
        { midi: 64, at: 1200 },
      ],
      { tonic: C, bpm: 100, endedAt: 1800 },
    );

    expect(capture.notes[1]?.start).toBe(0.75);
    expect(capture.notes[0]?.length).toBe(0.5);
    for (const nota of capture.notes) {
      expect(NOTE_LENGTHS, `${nota.length} no es ninguna figura`).toContain(nota.length);
    }
  });
});

describe('las notas dudosas', () => {
  /**
   * La hermana del margen de los acordes. Una cuerda que roza, dos que suenan a
   * la vez o una nota apagada dan claridad baja, y ahí es donde el motor
   * monofónico se inventa alturas.
   */
  it('lo escrito a mano nunca está en duda', () => {
    expect(isDoubtfulNote(nota())).toBe(false);
  });

  it('lo oído sucio sí, y lo oído limpio no', () => {
    expect(isDoubtfulNote(nota({ clarity: NOTA_DUDOSA - 0.1 }))).toBe(true);
    expect(isDoubtfulNote(nota({ clarity: 0.95 }))).toBe(false);
  });

  it('la claridad llega desde lo que se tocó hasta la nota escrita', () => {
    const capture = captureMelody(
      [
        { midi: 60, at: 0, clarity: 0.4 },
        { midi: 64, at: 500, clarity: 0.98 },
      ],
      { tonic: C, bpm: 120, endedAt: 1000 },
    );
    expect(capture.notes.map(isDoubtfulNote)).toEqual([true, false]);
  });
});

describe('el tope del punteo al leerlo', () => {
  /**
   * Un punteo tiene tope, y pasado no se recorta por el final ni se tira entero:
   * se para de leer. Sin él, tocar diez minutos seguidos dejaría una parte con
   * miles de notas que ni se dibuja ni se puede editar.
   */
  it('se deja de leer al llegar al tope', () => {
    const muchas = Array.from({ length: MAX_LEAD_NOTES + 20 }, (_, indice) => ({
      pitchClass: pitchClassFromName('C'),
      midi: 60 + (indice % 12),
      at: indice * 500,
      clarity: 0.9,
    }));

    const punteo = captureMelody(muchas, {
      tonic: pitchClassFromName('C'),
      bpm: 120,
      startedAt: 0,
      endedAt: (MAX_LEAD_NOTES + 20) * 500,
    });

    expect(punteo.notes).toHaveLength(MAX_LEAD_NOTES);
  });
});

/**
 * **El punteo de una toma entera, desde cada análisis del motor.**
 *
 * Aquí los análisis se escriben a mano —qué altura, qué nivel, cada cincuenta
 * milisegundos— para fijar cada regla por separado. Con una guitarra sintética y
 * el clic encima se mide entero en `audio/toma-sintetica.test.ts`.
 */
describe('transcribir un punteo', () => {
  /** A 60 pulsos, un pulso es un segundo: las cuentas se leen solas. */
  const OPCIONES = { tonic: C, bpm: 60, startedAt: 0, endedAt: 60_000, retardoMs: 0 };

  /**
   * Una nota: de `desde` a `hasta` segundos, un análisis cada 50 ms, con un
   * nivel que cae desde `nivel`. Es lo que hace una cuerda pulsada.
   */
  function sonar(midi: number, desde: number, hasta: number, nivel = 0.1, final = nivel / 4) {
    const fotogramas: FotogramaDeTono[] = [];
    const n = Math.round((hasta - desde) * 20);
    for (let i = 0; i < n; i += 1) {
      fotogramas.push({
        at: desde * 1000 + i * 50,
        midi: midi + 0.03,
        clarity: 0.97,
        rms: nivel + ((final - nivel) * i) / Math.max(1, n - 1),
      });
    }
    return fotogramas;
  }

  function silencio(desde: number, hasta: number) {
    return Array.from({ length: Math.round((hasta - desde) * 20) }, (_, i) => ({
      at: desde * 1000 + i * 50,
      midi: null,
      clarity: 0,
      rms: 0.0005,
    }));
  }

  const resumen = (notas: readonly LeadNote[]) =>
    notas.map((nota) => `${nota.offset}@${nota.start}/${nota.length}`);

  it('cada nota en su sitio, con su largo y sus silencios', () => {
    const { notes } = transcribirPunteo(
      [
        ...sonar(60, 0, 0.95),
        ...sonar(64, 1, 1.45),
        ...sonar(67, 1.5, 1.95),
        ...silencio(2, 3),
        ...sonar(72, 3, 4.9),
        ...silencio(4.9, 6),
      ],
      OPCIONES,
    );
    // Do negra, Mi y Sol corcheas, un silencio de negra y un Do agudo de blanca.
    expect(resumen(notes)).toEqual(['0@0/1', '4@1/0.5', '7@1.5/0.5', '12@3/2']);
  });

  it('tres iguales seguidas son tres, porque el nivel vuelve a subir', () => {
    const { notes } = transcribirPunteo(
      [...sonar(64, 0, 1), ...sonar(64, 1, 2), ...sonar(64, 2, 3)],
      OPCIONES,
    );
    expect(resumen(notes)).toEqual(['4@0/1', '4@1/1', '4@2/1']);
  });

  it('un temblor de la cuerda no es un ataque', () => {
    // Sube un 30 %, que es lo que tiembla una cuerda sola, y no cuenta.
    const fotogramas = sonar(64, 0, 2, 0.1, 0.02).map((fotograma, i) =>
      i === 20 ? { ...fotograma, rms: fotograma.rms * 1.3 } : fotograma,
    );
    expect(resumen(transcribirPunteo(fotogramas, OPCIONES).notes)).toEqual(['4@0/2']);
  });

  // Un corte del sonido —la tarjeta con el equipo cargado— baja el nivel y lo
  // devuelve a donde estaba: es un salto sobre el valle, pero no vuelve al ataque.
  it('un hueco en el sonido no es volver a pulsar', () => {
    const fotogramas = sonar(62, 0, 2, 0.1, 0.01).map((fotograma, i) =>
      i === 25 ? { ...fotograma, rms: 0.0005 } : fotograma,
    );
    expect(resumen(transcribirPunteo(fotogramas, OPCIONES).notes)).toEqual(['2@0/2']);
  });

  it('un analisis suelto con otra altura no es una nota: es un armonico', () => {
    const fotogramas = sonar(60, 0, 1).map((fotograma, i) =>
      i === 10 ? { ...fotograma, midi: 72 } : i === 14 ? { ...fotograma, midi: null } : fotograma,
    );
    expect(resumen(transcribirPunteo(fotogramas, OPCIONES).notes)).toEqual(['0@0/1']);
  });

  it('una nota de un solo analisis tampoco, y se cuenta como saltada', () => {
    const captura = transcribirPunteo(
      [
        ...sonar(60, 0, 0.95),
        ...silencio(0.95, 1.5),
        ...sonar(65, 1.5, 1.55),
        ...silencio(1.55, 2),
      ],
      OPCIONES,
    );
    expect(resumen(captura.notes)).toEqual(['0@0/1']);
    expect(captura.skipped).toBe(1);
  });

  it('una nota que se apaga sola dura hasta la siguiente; una cortada, no', () => {
    const sola = transcribirPunteo(
      [...sonar(62, 0, 1.5, 0.05, 0.002), ...silencio(1.5, 3), ...sonar(67, 3, 3.95)],
      OPCIONES,
    );
    // Se dejó sonar: la blanca con puntillo, no una negra y media de silencio.
    expect(resumen(sola.notes)).toEqual(['2@0/3', '7@3/1']);

    const cortada = transcribirPunteo(
      [...sonar(62, 0, 1.5, 0.1, 0.05), ...silencio(1.5, 3), ...sonar(67, 3, 3.95)],
      OPCIONES,
    );
    expect(resumen(cortada.notes)).toEqual(['2@0/1.5', '7@3/1']);
  });

  it('un hueco de una semicorchea o menos es levantar la pua, no un silencio', () => {
    const { notes } = transcribirPunteo([...sonar(60, 0, 0.3), ...sonar(62, 0.5, 1)], OPCIONES);
    expect(resumen(notes)).toEqual(['0@0/0.5', '2@0.5/0.5']);
  });

  it('mas de una redonda sale partida en iguales seguidas', () => {
    const { notes } = transcribirPunteo(sonar(60, 0, 6, 0.1, 0.05), OPCIONES);
    expect(resumen(notes)).toEqual(['0@0/4', '0@4/2']);
  });

  it('dos notas en la misma casilla: la segunda se empuja a la siguiente', () => {
    const { notes } = transcribirPunteo([...sonar(60, 0, 0.1), ...sonar(62, 0.1, 1)], OPCIONES);
    // La segunda dura tres cuartos, que no tienen figura: a igual distancia entre
    // la corchea y la negra gana la negra, porque nada viene detrás.
    expect(resumen(notes)).toEqual(['0@0/0.25', '2@0.25/1']);
  });

  it('lo que no cabe en el pentagrama se cuenta y no se escribe', () => {
    const captura = transcribirPunteo([...sonar(30, 0, 1), ...sonar(60, 1, 2)], OPCIONES);
    expect(resumen(captura.notes)).toEqual(['0@1/1']);
    expect(captura.outOfRange).toBe(1);
  });

  it('lo de antes del compas uno no es de la toma, pero un pelo pronto si es el uno', () => {
    const captura = transcribirPunteo([...sonar(55, -2, -1.5), ...sonar(60, -0.1, 1)], {
      ...OPCIONES,
      startedAt: 0,
    });
    expect(resumen(captura.notes)).toEqual(['0@0/1']);
  });

  it('el retardo del motor se descuenta antes de cuadrar', () => {
    // A 240, la semicorchea dura 62 ms: sin descontar 40, caería en la siguiente.
    const tarde = sonar(60, 0.04, 0.5);
    const con = transcribirPunteo(tarde, { ...OPCIONES, bpm: 240, retardoMs: 40 });
    const sin = transcribirPunteo(tarde, { ...OPCIONES, bpm: 240, retardoMs: 0 });
    expect(con.notes[0]!.start).toBe(0);
    expect(sin.notes[0]!.start).toBe(0.25);
    // Y por defecto, el del motor.
    expect(RETARDO_DEL_TONO_MS).toBe(40);
    expect(
      transcribirPunteo(tarde, { tonic: C, bpm: 240, startedAt: 0, endedAt: 9e9 }).notes[0]!.start,
    ).toBe(0);
  });

  it('sin analisis no hay notas', () => {
    expect(transcribirPunteo([], OPCIONES)).toEqual({ notes: [], skipped: 0, outOfRange: 0 });
  });

  it('la claridad de la nota es la peor despues del ataque', () => {
    const fotogramas = sonar(60, 0, 1).map((fotograma, i) =>
      i === 0
        ? { ...fotograma, clarity: 0.3 }
        : i === 5
          ? { ...fotograma, clarity: 0.6 }
          : fotograma,
    );
    const [nota] = transcribirPunteo(fotogramas, OPCIONES).notes;
    expect(nota!.clarity).toBe(0.6);
    expect(isDoubtfulNote(nota!)).toBe(true);
  });
});

describe('cuadrar un instante en la rejilla', () => {
  it('va a la casilla mas cercana', () => {
    expect(cuantizar(0.1)).toBe(0);
    expect(cuantizar(0.2)).toBe(0.25);
    expect(cuantizar(1.6)).toBe(1.5);
  });

  // En el empate gana el sitio fuerte: el pulso a la corchea, la corchea a la
  // semicorchea. Es lo que haría quien escribe a mano.
  it('en los empates gana el sitio fuerte', () => {
    expect(cuantizar(0.125)).toBe(0);
    expect(cuantizar(0.375)).toBe(0.5);
    expect(cuantizar(0.86)).toBe(1);
  });
});
