import { describe, expect, it } from 'vitest';

import { pitchClassFromName } from './notes';
import { chordFit, chordNotesFor, suggestChords } from './suggestions';
import { STYLE_IDS, STYLES } from './styles';

const A = pitchClassFromName('A');
const C = pitchClassFromName('C');
const F = pitchClassFromName('F');

function symbols(input: Parameters<typeof suggestChords>[0]): string[] {
  return suggestChords(input).map((suggestion) => suggestion.symbol);
}

describe('encaje con lo tocado', () => {
  it('es total cuando el acorde es exactamente lo que suena', () => {
    const notes = chordNotesFor(C, 'major');
    expect(chordFit(notes, notes)).toBe(1);
  });

  it('es cero sin nada tocado', () => {
    expect(chordFit(chordNotesFor(C, 'major'), [])).toBe(0);
  });

  it('baja cuando el acorde trae notas que no han sonado', () => {
    const played = [C, pitchClassFromName('E')];
    const triad = chordFit(chordNotesFor(C, 'major'), played);
    const exact = chordFit(played, played);
    expect(triad).toBeLessThan(exact);
  });

  it('baja cuando lo tocado no cabe en el acorde', () => {
    const played = [C, pitchClassFromName('E'), pitchClassFromName('G'), pitchClassFromName('F#')];
    expect(chordFit(chordNotesFor(C, 'major'), played)).toBeLessThan(1);
  });
});

describe('sugerencias por estilo', () => {
  it('en rock propone lo básico y las quintas, no solo los siete de la tonalidad', () => {
    const result = symbols({ tonic: A, mode: 'minor', styleId: 'rock', limit: 12 });
    expect(result).toContain('Am');
    // El bVII de A menor es Sol; en menor el VII ya es diatónico, así que lo
    // que hay que ver es que aparezcan las quintas.
    expect(result).toContain('A5');
  });

  it('las séptimas entran antes que los suspendidos', () => {
    // Un suspendido es un adorno: se pone sobre un acorde que ya sabes hacer.
    // Una séptima cambia lo que el acorde hace. Para quien está aprendiendo,
    // la séptima enseña más, así que va delante en todos los estilos.
    for (const styleId of STYLE_IDS) {
      const result = symbols({ tonic: A, mode: 'major', styleId, limit: 24 });
      const seventh = result.findIndex((symbol) => /(maj7|m7|7)/.test(symbol));
      const suspended = result.findIndex((symbol) => symbol.includes('sus'));
      if (seventh === -1 || suspended === -1) {
        continue;
      }
      expect(seventh, `en ${styleId} el suspendido sale antes que la séptima`).toBeLessThan(
        suspended,
      );
    }
  });

  it('en blues propone dominantes donde la teoría pondría tríadas', () => {
    const result = symbols({ tonic: A, mode: 'major', styleId: 'blues', limit: 12 });
    expect(result).toContain('A7');
    expect(result).toContain('D7');
  });

  it('en metal propone el napolitano, que en pop no aparece', () => {
    const metal = symbols({
      tonic: pitchClassFromName('E'),
      mode: 'minor',
      styleId: 'metal',
      limit: 14,
    });
    const pop = symbols({
      tonic: pitchClassFromName('E'),
      mode: 'minor',
      styleId: 'pop',
      limit: 14,
    });

    expect(metal).toContain('F');
    expect(pop).not.toContain('F');
  });

  it('en jazz propone cuatríadas y sustitutos tritonales', () => {
    const result = suggestChords({ tonic: C, mode: 'major', styleId: 'jazz', limit: 20 });
    expect(result.some((item) => item.family === 'seventh')).toBe(true);
    expect(result.some((item) => item.family === 'tritoneSub')).toBe(true);
  });

  it('los estilos con vocabulario propio proponen cosas distintas', () => {
    const pop = symbols({ tonic: C, mode: 'major', styleId: 'pop', limit: 8 }).join('|');

    // Rock, pop y folk comparten el mismo punto de partida —los siete acordes
    // de la tonalidad— y eso es correcto: la diferencia aparece más abajo en la
    // lista. Los que sí tienen vocabulario propio no deben coincidir.
    for (const styleId of ['blues', 'metal', 'jazz'] as const) {
      expect(symbols({ tonic: C, mode: 'major', styleId, limit: 8 }).join('|')).not.toBe(pop);
    }
  });

  it('el rock y el folk difieren en cuanto se mira un poco más abajo', () => {
    const rock = symbols({ tonic: C, mode: 'major', styleId: 'rock', limit: 12 });
    const folk = symbols({ tonic: C, mode: 'major', styleId: 'folk', limit: 12 });
    expect(rock.join('|')).not.toBe(folk.join('|'));
  });

  it('nunca propone una familia con peso cero en ese estilo', () => {
    for (const styleId of STYLE_IDS) {
      const suggestions = suggestChords({ tonic: C, mode: 'major', styleId, limit: 40 });
      for (const suggestion of suggestions) {
        expect(STYLES[styleId].weights[suggestion.family]).toBeGreaterThan(0);
      }
    }
  });
});

describe('sugerencias según lo que se está tocando', () => {
  it('sube el acorde que explica las notas que suenan', () => {
    const played = [F, pitchClassFromName('A'), pitchClassFromName('C')];
    const withNotes = suggestChords({
      tonic: C,
      mode: 'major',
      styleId: 'pop',
      playedNotes: played,
      limit: 3,
    });

    expect(withNotes.map((item) => item.symbol)).toContain('F');
    expect(withNotes[0]!.fit).toBeGreaterThan(0.5);
  });

  it('saca un acorde raro cuando de verdad explica lo que se toca', () => {
    // La con séptima menor y novena aumentada: la tercera mayor y la menor a la
    // vez. Ningún acorde diatónico de A mayor las explica.
    const played = [
      pitchClassFromName('A'),
      pitchClassFromName('C#'),
      pitchClassFromName('E'),
      pitchClassFromName('G'),
      pitchClassFromName('C'),
    ];
    const result = suggestChords({
      tonic: A,
      mode: 'major',
      styleId: 'blues',
      playedNotes: played,
      limit: 3,
    });

    expect(result[0]!.symbol).toBe('A7#9');
    expect(result[0]!.family).toBe('altered');
  });

  it('sin notas manda el estilo, con notas manda el encaje', () => {
    const played = [pitchClassFromName('D'), pitchClassFromName('F#'), pitchClassFromName('A')];

    const blind = symbols({ tonic: C, mode: 'major', styleId: 'pop', limit: 4 });
    const listening = symbols({
      tonic: C,
      mode: 'major',
      styleId: 'pop',
      playedNotes: played,
      limit: 4,
    });

    // D mayor no es diatónico de Do: solo aparece si se está tocando.
    expect(blind).not.toContain('D');
    expect(listening).toContain('D');
  });
});

describe('forma de las sugerencias', () => {
  it('respeta el límite pedido', () => {
    expect(suggestChords({ tonic: C, mode: 'major', styleId: 'rock', limit: 5 })).toHaveLength(5);
  });

  it('no repite el mismo cifrado', () => {
    const result = symbols({ tonic: C, mode: 'major', styleId: 'jazz', limit: 40 });
    expect(new Set(result).size).toBe(result.length);
  });

  it('escribe los cifrados según la tonalidad', () => {
    const result = symbols({ tonic: F, mode: 'major', styleId: 'rock', limit: 20 });
    expect(result).toContain('Bb');
    expect(result).not.toContain('A#');
  });

  it('cada sugerencia explica por qué está', () => {
    for (const suggestion of suggestChords({
      tonic: C,
      mode: 'major',
      styleId: 'jazz',
      limit: 20,
    })) {
      expect(suggestion.why.length).toBeGreaterThan(10);
      expect(suggestion.label).not.toBe('');
    }
  });

  it('viene ordenado de más a menos recomendable', () => {
    const scores = suggestChords({ tonic: C, mode: 'major', styleId: 'rock', limit: 10 }).map(
      (item) => item.score,
    );
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});

describe('lo primero que se propone se puede aprender', () => {
  /**
   * El desempate era alfabético por cifrado, y en Do mayor eso sacaba
   * «Am, Bdim, C…»: el vi primero, un disminuido segundo y la tónica tercera.
   * Quien empieza no puede sacar nada de ahí.
   */
  it('empieza por los tres tonales, en su orden', () => {
    const result = symbols({ tonic: C, mode: 'major', styleId: 'pop', limit: 7 });
    expect(result.slice(0, 3)).toEqual(['C', 'F', 'G']);
  });

  it('los modales van después de los tonales y el disminuido el último', () => {
    const result = symbols({ tonic: C, mode: 'major', styleId: 'pop', limit: 7 });
    expect(result).toEqual(['C', 'F', 'G', 'Am', 'Dm', 'Em', 'Bdim']);
  });

  it('en menor manda la tónica y el disminuido también cierra', () => {
    const result = symbols({ tonic: A, mode: 'minor', styleId: 'pop', limit: 7 });
    expect(result[0]).toBe('Am');
    expect(result[6]).toBe('Bdim');
  });

  it('ningún estilo abre con un disminuido ni con un alterado', () => {
    for (const styleId of STYLE_IDS) {
      const [first] = symbols({ tonic: C, mode: 'major', styleId, limit: 4 });
      expect(first, `${styleId} abre con ${first}`).not.toMatch(/dim|b5|#9|b9/);
    }
  });
});

describe('cifrado romano de las cuatríadas', () => {
  /**
   * Antes se pegaba un «7» detrás del grado, y salían dos acordes distintos
   * llamados igual: el Cmaj7 y el C7 eran los dos «I7» en Do mayor.
   */
  it('distingue la séptima mayor de la de dominante', () => {
    const labels = new Map(
      suggestChords({ tonic: C, mode: 'major', styleId: 'blues', limit: 30 }).map((s) => [
        s.symbol,
        s.label,
      ]),
    );
    expect(labels.get('Cmaj7')).toBe('Imaj7');
    expect(labels.get('C7')).toBe('I7');
  });

  it('el semidisminuido no se escribe como disminuido entero', () => {
    const labels = new Map(
      suggestChords({ tonic: C, mode: 'major', styleId: 'jazz', limit: 30 }).map((s) => [
        s.symbol,
        s.label,
      ]),
    );
    expect(labels.get('Bm7b5')).toBe('viiø7');
  });

  it('no hay dos acordes distintos con la misma etiqueta', () => {
    for (const styleId of STYLE_IDS) {
      const suggestions = suggestChords({ tonic: C, mode: 'major', styleId, limit: 40 });
      const labels = suggestions.map((s) => s.label);
      expect(new Set(labels).size, `${styleId} repite etiqueta`).toBe(labels.length);
    }
  });
});

describe('función armónica', () => {
  it('cada sugerencia dice qué papel hace y qué significa ese papel', () => {
    for (const suggestion of suggestChords({
      tonic: C,
      mode: 'major',
      styleId: 'jazz',
      limit: 30,
    })) {
      expect(['tonic', 'subdominant', 'dominant', 'approach']).toContain(suggestion.role);
      expect(suggestion.roleWhy.length).toBeGreaterThan(10);
    }
  });

  it('reparte los grados de la mayor en los tres papeles clásicos', () => {
    const byLabel = new Map(
      suggestChords({ tonic: C, mode: 'major', styleId: 'pop', limit: 7 }).map((s) => [
        s.label,
        s.role,
      ]),
    );
    expect(byLabel.get('I')).toBe('tonic');
    expect(byLabel.get('vi')).toBe('tonic');
    expect(byLabel.get('ii')).toBe('subdominant');
    expect(byLabel.get('IV')).toBe('subdominant');
    expect(byLabel.get('V')).toBe('dominant');
    expect(byLabel.get('vii°')).toBe('dominant');
  });

  it('el que sustituye a otro lo dice y comparte su papel', () => {
    const suggestions = suggestChords({ tonic: C, mode: 'major', styleId: 'pop', limit: 7 });
    const byLabel = new Map(suggestions.map((s) => [s.label, s]));

    // El relativo menor va donde iría la tónica: mismo papel, dos notas comunes.
    expect(byLabel.get('vi')?.substitution?.of).toBe('I');
    expect(byLabel.get('vi')?.role).toBe(byLabel.get('I')?.role);

    // El ii sustituye al IV, y los dos son la salida.
    expect(byLabel.get('ii')?.substitution?.of).toBe('IV');
    expect(byLabel.get('ii')?.role).toBe(byLabel.get('IV')?.role);
  });

  it('el sustituto tritonal explica que comparte el tritono', () => {
    const sub = suggestChords({ tonic: C, mode: 'major', styleId: 'jazz', limit: 40 }).find((s) =>
      s.label.startsWith('subV7/'),
    );
    expect(sub?.substitution?.why).toContain('tritono');
  });

  it('la tónica no se anuncia como sustituta de nadie', () => {
    const tonic = suggestChords({ tonic: C, mode: 'major', styleId: 'pop', limit: 7 }).find(
      (s) => s.label === 'I',
    );
    expect(tonic?.substitution).toBeNull();
  });
});
