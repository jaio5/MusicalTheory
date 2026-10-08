import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_ARRANGEMENT, writtenBlock, type Arrangement } from '@core/music';

import { useArrangementStore } from './arrangement-store';
import { descargarLaCancion, tituloDeLaCancion } from './descargar-la-cancion';
import { useSessionStore } from './session-store';

const descargarBytes = vi.hoisted(() => vi.fn());
vi.mock('@media/descargar', () => ({
  TIPO_MIDI: 'audio/midi',
  descargarBytes,
}));

function parte(id: string, name: string, conAcordes: boolean): Arrangement['parts'][number] {
  return {
    id,
    name,
    blocks: conAcordes ? [writtenBlock(`${id}-b`, 'I', 4)] : [],
    notes: [],
    bars: 1,
  };
}

beforeEach(() => {
  descargarBytes.mockClear();
  useSessionStore.setState({ pinnedKey: { tonic: 0, mode: 'major' }, bpm: 100, beatsPerBar: 4 });
  useArrangementStore.setState({ arrangement: EMPTY_ARRANGEMENT, past: [] });
});

afterEach(() => {
  useSessionStore.setState({ pinnedKey: null });
});

describe('el título de la canción', () => {
  // El lienzo y Canciones la titulaban cada uno a su manera, y la misma canción
  // bajaba con dos nombres.
  it('es la primera parte con acordes, aunque haya otra vacía antes', () => {
    expect(
      tituloDeLaCancion({ parts: [parte('a', 'Intro', false), parte('b', 'Estribillo', true)] }),
    ).toBe('Estribillo');
  });

  it('sin acordes en ninguna, la primera; sin partes, ninguno', () => {
    expect(tituloDeLaCancion({ parts: [parte('a', 'Intro', false)] })).toBe('Intro');
    expect(tituloDeLaCancion(EMPTY_ARRANGEMENT)).toBeNull();
  });
});

describe('descargar la canción en MIDI', () => {
  it('baja el MIDI con el nombre de la canción', () => {
    useArrangementStore.setState({
      arrangement: { parts: [parte('a', 'Intro', false), parte('b', 'Estribillo', true)] },
    });

    expect(descargarLaCancion()).toBe(true);

    expect(descargarBytes).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'estribillo.mid',
      'audio/midi',
    );
  });

  it('sin tonalidad o sin partes no baja nada, y lo dice', () => {
    expect(descargarLaCancion()).toBe(false);

    useArrangementStore.setState({ arrangement: { parts: [parte('a', 'Intro', true)] } });
    useSessionStore.setState({ pinnedKey: null, keyCandidates: [] });
    expect(descargarLaCancion()).toBe(false);

    expect(descargarBytes).not.toHaveBeenCalled();
  });
});
