import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ROLE,
  ROLES,
  defaultSectionName,
  degreesFromPath,
  describeSong,
  nameForRole,
  roleInfo,
  roleOf,
  MAX_SECTION_DEGREES,
  MAX_SECTIONS,
  MAX_SONG_NAME,
  parseSong,
  resolveSection,
  songLength,
  songName,
  sortSongs,
  transposeSong,
  UNNAMED_SONG,
  type Song,
} from './song';

/** Una canción mínima para no repetirla en cada prueba. */
function cancion(extra: Partial<Song> = {}): Song {
  return {
    id: 'una',
    name: 'Prueba',
    tonic: 0,
    mode: 'major',
    bpm: 120,
    sections: [{ name: 'Estrofa', degrees: ['I', 'V', 'vi', 'IV'] }],
    updatedAt: 1000,
    ...extra,
  };
}

describe('parseSong', () => {
  it('interpreta una canción entera', () => {
    const song = parseSong(
      {
        name: 'La mía',
        tonic: 7,
        mode: 'minor',
        bpm: 90,
        sections: [{ name: 'Estrofa', degrees: ['i', 'VI', 'III', 'VII'] }],
        updatedAt: 12345,
      },
      'id-1',
    );

    expect(song).toEqual({
      id: 'id-1',
      name: 'La mía',
      tonic: 7,
      mode: 'minor',
      bpm: 90,
      sections: [{ name: 'Estrofa', degrees: ['i', 'VI', 'III', 'VII'] }],
      updatedAt: 12345,
    });
  });

  it('devuelve nulo cuando no hay ni un acorde', () => {
    expect(parseSong({ name: 'Vacía', sections: [] }, 'x')).toBeNull();
    expect(
      parseSong({ name: 'Vacía', sections: [{ name: 'Estrofa', degrees: [] }] }, 'x'),
    ).toBeNull();
    expect(parseSong(null, 'x')).toBeNull();
    expect(parseSong('una canción', 'x')).toBeNull();
    expect(parseSong([1, 2, 3], 'x')).toBeNull();
  });

  it('descarta los grados que no existen en ese modo', () => {
    // «IV» es de mayor y «iv» de menor: en una canción menor solo vale el segundo.
    const song = parseSong(
      { mode: 'minor', sections: [{ name: 'A', degrees: ['i', 'IV', 'iv', 'inventado'] }] },
      'x',
    );

    expect(song?.sections[0]?.degrees).toEqual(['i', 'iv']);
  });

  it('un grado colado no revienta al resolver la sección', () => {
    // Es justo lo que evita el filtro: `resolveDegree` lanza RangeError con un
    // grado que no existe, y lo haría al pintar, no al guardar.
    const song = parseSong({ mode: 'minor', sections: [{ name: 'A', degrees: ['i', 'IV'] }] }, 'x');

    expect(() => resolveSection(song!, song!.sections[0]!)).not.toThrow();
  });

  it('pone nombre a lo que no lo tiene', () => {
    const song = parseSong({ sections: [{ degrees: ['I'] }] }, 'x');

    expect(song?.name).toBe(UNNAMED_SONG);
    expect(song?.sections[0]?.name).toBe('Parte 1');
  });

  it('recorta los nombres largos en vez de rechazarlos', () => {
    const song = parseSong({ name: 'x'.repeat(200), sections: [{ degrees: ['I'] }] }, 'x');

    expect(song?.name).toHaveLength(MAX_SONG_NAME);
  });

  it('respeta los topes de secciones y de acordes', () => {
    const song = parseSong(
      {
        sections: Array.from({ length: MAX_SECTIONS + 5 }, () => ({
          degrees: Array.from({ length: MAX_SECTION_DEGREES + 10 }, () => 'I'),
        })),
      },
      'x',
    );

    expect(song?.sections).toHaveLength(MAX_SECTIONS);
    expect(song?.sections[0]?.degrees).toHaveLength(MAX_SECTION_DEGREES);
  });

  it('el tempo ausente es nulo y el imposible se acerca al tope', () => {
    expect(parseSong({ sections: [{ degrees: ['I'] }] }, 'x')?.bpm).toBeNull();
    expect(parseSong({ bpm: 'rápido', sections: [{ degrees: ['I'] }] }, 'x')?.bpm).toBeNull();
    // 5000 es un dato roto, no una ausencia: se acerca al tope para no perder
    // la única pista de que ahí había algo.
    expect(parseSong({ bpm: 5000, sections: [{ degrees: ['I'] }] }, 'x')?.bpm).toBe(300);
  });

  it('la tonalidad fuera de rango da la vuelta en vez de romperse', () => {
    expect(parseSong({ tonic: 14, sections: [{ degrees: ['I'] }] }, 'x')?.tonic).toBe(2);
    expect(parseSong({ tonic: -1, sections: [{ degrees: ['I'] }] }, 'x')?.tonic).toBe(11);
    expect(parseSong({ tonic: 'do', sections: [{ degrees: ['I'] }] }, 'x')?.tonic).toBe(0);
  });

  it('el identificador lo pone quien llama, no lo que llega', () => {
    // Si el identificador viniera del cuerpo, cualquiera podría escribir encima
    // de la canción de otra persona mandando su id.
    const song = parseSong({ id: 'de-otro', sections: [{ degrees: ['I'] }] }, 'el-mio');

    expect(song?.id).toBe('el-mio');
  });
});

describe('songName', () => {
  it('solo espacios es lo mismo que sin nombre', () => {
    expect(songName('   ')).toBe(UNNAMED_SONG);
    expect(songName('')).toBe(UNNAMED_SONG);
    expect(songName(null)).toBe(UNNAMED_SONG);
    expect(songName('  Mi canción  ')).toBe('Mi canción');
  });
});

describe('resolveSection', () => {
  it('los grados se convierten en los acordes de esa tonalidad', () => {
    const song = cancion({ tonic: 0, mode: 'major' });
    const chords = resolveSection(song, song.sections[0]!);

    expect(chords.map((chord) => chord.symbol)).toEqual(['C', 'G', 'Am', 'F']);
  });
});

describe('transposeSong', () => {
  it('cambiar de tonalidad es cambiar un número, no traducir cifrados', () => {
    const song = cancion({ tonic: 0 });
    const sol = transposeSong(song, 7, 2000);

    expect(sol.sections).toEqual(song.sections);
    expect(resolveSection(sol, sol.sections[0]!).map((chord) => chord.symbol)).toEqual([
      'G',
      'D',
      'Em',
      'C',
    ]);
    expect(sol.updatedAt).toBe(2000);
  });
});

describe('songLength y describeSong', () => {
  it('cuenta los acordes de todas las secciones', () => {
    const song = cancion({
      sections: [
        { name: 'Estrofa', degrees: ['I', 'V'] },
        { name: 'Estribillo', degrees: ['vi', 'IV', 'I'] },
      ],
    });

    expect(songLength(song)).toBe(5);
    expect(describeSong(song)).toBe('2 secciones · 5 acordes · 120 bpm');
  });

  it('concuerda en singular y no dice el tempo que no hay', () => {
    const song = cancion({ bpm: null, sections: [{ name: 'A', degrees: ['I'] }] });

    expect(describeSong(song)).toBe('1 sección · 1 acorde');
  });
});

describe('sortSongs', () => {
  it('las más recientes primero, sin tocar la lista original', () => {
    const vieja = cancion({ id: 'vieja', updatedAt: 1 });
    const nueva = cancion({ id: 'nueva', updatedAt: 9 });
    const lista = [vieja, nueva];

    expect(sortSongs(lista).map((song) => song.id)).toEqual(['nueva', 'vieja']);
    expect(lista.map((song) => song.id)).toEqual(['vieja', 'nueva']);
  });
});

describe('degreesFromPath', () => {
  it('se queda con los grados y cuenta lo que se cae', () => {
    // Los préstamos modales —bIII, bVI, bVII— sí están en el catálogo de mayor,
    // así que se guardan. Lo que se cae es el dominante secundario, que se
    // escribe con barra y no es un grado.
    const { degrees, dropped } = degreesFromPath(['I', 'V7/vi', 'vi', 'bIII', 'IV'], 'major');

    expect(degrees).toEqual(['I', 'vi', 'bIII', 'IV']);
    expect(dropped).toBe(1);
  });

  it('un grado de mayor en una canción menor se cae', () => {
    // «IV» y «iv» se parecen y no son el mismo grado. Guardar el de mayor en una
    // canción menor reventaría al pintarla.
    expect(degreesFromPath(['i', 'IV', 'iv'], 'minor')).toEqual({
      degrees: ['i', 'iv'],
      dropped: 1,
    });
  });

  it('un camino entero de grados no pierde nada', () => {
    expect(degreesFromPath(['i', 'VI', 'III', 'VII'], 'minor')).toEqual({
      degrees: ['i', 'VI', 'III', 'VII'],
      dropped: 0,
    });
  });

  it('un camino vacío no es un error', () => {
    expect(degreesFromPath([], 'major')).toEqual({ degrees: [], dropped: 0 });
  });

  it('recorta por el mismo tope que una sección, y lo cuenta como caído', () => {
    const largo = Array.from({ length: MAX_SECTION_DEGREES + 4 }, () => 'I');

    expect(degreesFromPath(largo, 'major')).toEqual({
      degrees: Array.from({ length: MAX_SECTION_DEGREES }, () => 'I'),
      dropped: 4,
    });
  });
});

describe('el punteo y la procedencia, guardados', () => {
  /**
   * Lo que hay en la base de datos lo escribió el navegador de alguien, así que
   * una nota se interpreta igual al leer que al recibir: la misma rejilla y los
   * mismos topes que si se acabara de escribir en el lienzo.
   */
  it('las notas pasan por la rejilla y por los topes', () => {
    const song = parseSong(
      {
        mode: 'major',
        sections: [{ name: 'A', degrees: ['I'], lead: [[7, 1.3, 1.9]] }],
      },
      'x',
    );
    expect(song?.sections[0]?.lead).toEqual([[7, 1.5, 2]]);
  });

  // Redondear un dato roto a cero pondría una nota en la tónica que nadie tocó.
  it('una nota con algo que no es un número se cae entera', () => {
    const song = parseSong(
      {
        mode: 'major',
        sections: [
          {
            name: 'A',
            degrees: ['I'],
            lead: [
              [7, 0, 1],
              ['x', 0, 1],
              [999, 0, 1],
            ],
          },
        ],
      },
      'x',
    );
    expect(song?.sections[0]?.lead).toEqual([[7, 0, 1]]);
  });

  it('la procedencia vuelve tal cual, y lo que no se reconoce es escrito a mano', () => {
    const song = parseSong(
      {
        mode: 'major',
        sections: [{ name: 'A', degrees: ['I', 'V', 'vi'], sources: ['heard', 'fixed', 'ruido'] }],
      },
      'x',
    );
    expect(song?.sections[0]?.sources).toEqual(['heard', 'fixed', 'written']);
  });

  /**
   * Leer y guardar tienen que dar lo mismo. Sin esto, una canción de antes del
   * punteo crecería sola cada vez que alguien la abre y la vuelve a guardar.
   */
  it('una canción sin punteo ni procedencia se lee sin añadirle nada', () => {
    const song = parseSong({ mode: 'major', sections: [{ name: 'A', degrees: ['I'] }] }, 'x');
    expect(song?.sections[0]).toEqual({ name: 'A', degrees: ['I'] });
  });
});

describe('el papel de cada parte', () => {
  it('una parte sin papel es una idea', () => {
    expect(roleOf({})).toBe('idea');
    expect(roleOf({ role: undefined })).toBe('idea');
    expect(DEFAULT_ROLE).toBe('idea');
  });

  it('los ocho papeles se explican, y la explicación se le manda al modelo', () => {
    // Misma regla que los caminos de `paths.ts`: el catálogo del prompt sale de
    // aquí, así que un papel sin frase es un papel que el modelo no entiende.
    for (const role of ROLES) {
      expect(role.name.length).toBeGreaterThan(0);
      expect(role.what.length).toBeGreaterThan(0);
    }
    expect(new Set(ROLES.map((role) => role.id)).size).toBe(ROLES.length);
  });

  it('un papel desconocido cae en idea en vez de reventar', () => {
    expect(roleInfo('lo-que-sea' as never).id).toBe('idea');
  });

  describe('al guardar y volver a leer', () => {
    it('el papel sobrevive', () => {
      const leida = parseSong(
        {
          name: 'Una',
          tonic: 0,
          mode: 'major',
          sections: [{ degrees: ['I'], role: 'estribillo' }],
        },
        'x',
      );

      expect(leida?.sections[0]?.role).toBe('estribillo');
    });

    it('idea no se escribe, porque es el valor por omisión', () => {
      // Leer y volver a guardar tiene que dar lo mismo, o una canción crecería
      // sola cada vez que se abre. Es la regla del resto del fichero.
      const leida = parseSong(
        { name: 'Una', tonic: 0, mode: 'major', sections: [{ degrees: ['I'], role: 'idea' }] },
        'x',
      );

      expect(leida?.sections[0]).not.toHaveProperty('role');
    });

    it('y un papel inventado se lee como idea, no tira la canción', () => {
      const leida = parseSong(
        { name: 'Una', tonic: 0, mode: 'major', sections: [{ degrees: ['I'], role: 'coda-rara' }] },
        'x',
      );

      expect(leida?.sections).toHaveLength(1);
      expect(roleOf(leida!.sections[0]!)).toBe('idea');
    });
  });

  describe('el nombre que acompaña al papel', () => {
    it('un nombre puesto por la aplicación sí se cambia', () => {
      expect(nameForRole(defaultSectionName(2), 2, 'estribillo')).toBe('Estribillo');
    });

    it('y un hueco vacío también', () => {
      expect(nameForRole('   ', 0, 'puente')).toBe('Puente');
    });

    it('pero lo que escribió una persona no se pisa nunca', () => {
      expect(nameForRole('lo del puente de Marta', 1, 'estribillo')).toBe('lo del puente de Marta');
    });

    it('cambiar de papel dos veces seguidas no deja el nombre anterior pegado', () => {
      // Sin esto, «Estribillo» contaría como nombre escrito a mano y pasar a
      // puente lo dejaría llamándose «Estribillo» para siempre.
      const primero = nameForRole(defaultSectionName(0), 0, 'estribillo');

      expect(nameForRole(primero, 0, 'puente')).toBe('Puente');
    });

    it('y volver a idea devuelve el nombre numerado', () => {
      const conPapel = nameForRole(defaultSectionName(3), 3, 'solo');

      expect(nameForRole(conPapel, 3, 'idea')).toBe('Parte 4');
    });
  });
});
