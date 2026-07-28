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
  it('en rock propone lo básico y el bVII, no solo los siete de la tonalidad', () => {
    const result = symbols({ tonic: A, mode: 'minor', styleId: 'rock', limit: 12 });
    expect(result).toContain('Am');
    // El bVII de La menor es Sol; en menor el VII ya es diatónico, así que lo
    // que hay que ver es que aparezcan quintas y suspendidos.
    expect(result).toContain('A5');
    expect(result.some((symbol) => symbol.includes('sus'))).toBe(true);
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
    // vez. Ningún acorde diatónico de La mayor las explica.
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

    // Re mayor no es diatónico de Do: solo aparece si se está tocando.
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
