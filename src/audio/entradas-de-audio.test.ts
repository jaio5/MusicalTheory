import { afterEach, describe, expect, it, vi } from 'vitest';

import { listAudioInputDevices } from './entradas-de-audio';

describe('las entradas de audio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('solo las de audio', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn(async () => [
          { kind: 'audioinput', deviceId: 'mic' },
          { kind: 'videoinput', deviceId: 'cam' },
        ]),
      },
    });

    expect((await listAudioInputDevices()).map((d) => d.deviceId)).toEqual(['mic']);
  });

  it('sin navegador que las sepa listar, ninguna', async () => {
    vi.stubGlobal('navigator', {});

    expect(await listAudioInputDevices()).toEqual([]);
  });

  // En el servidor no hay `navigator`: el afinador se pinta allí también.
  it('sin navegador, ninguna', async () => {
    vi.stubGlobal('navigator', undefined);

    expect(await listAudioInputDevices()).toEqual([]);
  });
});
