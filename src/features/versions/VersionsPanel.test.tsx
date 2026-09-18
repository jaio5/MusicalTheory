// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Account } from '@core/billing';
import { normalizePitchClass, pitchClassFromName, type PitchClass } from '@core/music';
import { AccountProvider } from '@state/account';
import { useArrangementStore } from '@state/arrangement-store';
import { useSessionStore } from '@state/session-store';

import { versionsError, type Version, type VersionsRequest } from './contract';
import { VersionsPanel } from './VersionsPanel';

const C = pitchClassFromName('C');
const G = pitchClassFromName('G');

const CON_PLAN: Account = {
  email: 'javier@example.com',
  name: null,
  plan: 'pro',
  aiModel: 'claude-opus-5',
  aiLeftToday: 30,
  aiLeftMonth: 30,
};

const SIN_PLAN: Account = { ...CON_PLAN, plan: 'medio' };

function conCuenta(node: React.ReactNode, account: Account = CON_PLAN) {
  return (
    <AccountProvider account={account} accounts>
      {node}
    </AccountProvider>
  );
}

function respondWith(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const PASOS = [
  { degree: 'I', beats: 4, symbol: 'C', from: 'I', move: null },
  { degree: 'bII', beats: 4, symbol: 'Db', from: 'V', move: 'tritono' },
] as const;

const UNA: Version = {
  path: 'rearmonizar',
  title: 'Más oscura',
  why: 'Cambia la dominante por la que está a un tritono.',
  sections: [{ name: 'Lo que llevas', yours: false, steps: [...PASOS] }],
  steps: [...PASOS],
};

/** Deja una tonalidad y un camino puestos, como si se hubiera compuesto. */
function componiendo(labels: readonly string[]) {
  const { actions } = useSessionStore.getState();
  actions.pinKey({ tonic: C, mode: 'major' });
  actions.clearPath();
  for (const label of labels) {
    actions.pushChord({ symbol: label, label, root: C, notes: [C], why: 'porque sí' });
  }
}

beforeEach(() => {
  useSessionStore.getState().actions.reset();
  // Y el montaje, que desde el ADR 0032 es de donde salen las salidas: sin esto,
  // lo que escribe una prueba se lo encuentra la siguiente.
  useArrangementStore.setState({
    arrangement: { parts: [] },
    past: [],
    selectedBlockId: null,
  });
});

describe('sin el plan que las incluye', () => {
  it('enseña el candado con el plan que hace falta', () => {
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} />, SIN_PLAN));

    expect(screen.getByRole('note')).toHaveTextContent(/plan Pro/);
  });
});

describe('cuándo se puede pedir', () => {
  it('sin nada dice que se grabe o se encadene', async () => {
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} />));

    expect(await screen.findByRole('status')).toHaveTextContent(/Graba un trozo o escribe/);
  });

  it('con un solo acorde no se pide, y se dice por qué', async () => {
    const fetchVersions = vi.fn();
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I']);

    expect(await screen.findByText(/al menos dos acordes/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    expect(fetchVersions).not.toHaveBeenCalled();
  });

  it('manda los grados y la tonalidad, no cifrados ni sonido', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V', 'vi', 'IV']);

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    expect(fetchVersions).toHaveBeenCalledTimes(1);
    const request = fetchVersions.mock.calls[0]![0] as VersionsRequest;
    expect(request.key).toEqual({ tonic: 'C', mode: 'major' });
    expect(request.progression.map((step) => step.degree)).toEqual(['I', 'V', 'vi', 'IV']);
  });

  it('lo que no es un grado del catálogo no se manda', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V7/vi', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    const request = fetchVersions.mock.calls[0]![0] as VersionsRequest;
    expect(request.progression.map((step) => step.degree)).toEqual(['I', 'V']);
  });
});

describe('lo que se enseña', () => {
  it('cada compás cambiado dice de dónde viene y qué movimiento se le hizo', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    expect(await screen.findByText('Más oscura')).toBeInTheDocument();
    expect(screen.getByText('V → bII')).toBeInTheDocument();
    expect(screen.getByText('Sustitución tritonal')).toBeInTheDocument();
    // El que no cambia enseña su grado a secas, sin flecha ni movimiento.
    expect(screen.getByText('I')).toBeInTheDocument();
  });

  it('el error del servidor se enseña tal y como lo escribe el servidor', async () => {
    const fetchVersions = vi
      .fn()
      .mockResolvedValue(
        respondWith(versionsError('quota_exhausted', 'Se te han acabado las 12 de hoy.'), 429),
      );
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Se te han acabado las 12 de hoy.');
  });

  it('sin red se dice, en vez de quedarse pensando para siempre', async () => {
    const fetchVersions = vi.fn().mockRejectedValue(new Error('sin red'));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/No hemos podido contactar/);
  });
});

describe('quedarse con una salida', () => {
  /**
   * La deja **en la canción**, con sus partes.
   *
   * La dejaba en el camino, que era la segunda canción paralela
   * ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)):
   * te quedabas con una salida y tu canción seguía siendo la de antes, así que
   * para tenerla de verdad había que volver a escribirla a mano.
   */
  it('deja la version escrita en la cancion, con sus partes', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Quedarme con esta/ }));

    const partes = useArrangementStore.getState().arrangement.parts;
    expect(partes.map((parte) => parte.name)).toEqual(['Lo que llevas']);
    expect(partes[0]?.blocks.map((b) => b.degree)).toEqual(['I', 'bII']);
    expect(useSessionStore.getState().currentDegree).toBe('bII');
    // Y el camino queda limpio: la canción ya no vive ahí.
    expect(useSessionStore.getState().path).toEqual([]);
  });

  /**
   * Pisa lo que hay, que es lo que significa quedársela, **y se deshace**: el
   * `replace` pasa por el mismo sitio que todo lo demás, así que arrepentirse
   * cuesta una tecla.
   */
  it('pisa lo que habia, y el deshacer lo devuelve', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);
    const mia = useArrangementStore.getState().actions.addPart('Lo mío');
    useArrangementStore.getState().actions.addBlock(mia, 'vi', 4);
    useArrangementStore.getState().actions.addBlock(mia, 'IV', 4);

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Quedarme con esta/ }));
    expect(useArrangementStore.getState().arrangement.parts[0]?.name).toBe('Lo que llevas');

    useArrangementStore.getState().actions.undo();

    expect(useArrangementStore.getState().arrangement.parts[0]?.name).toBe('Lo mío');
  });

  it('quedarsela dos veces no encadena dos copias', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    const poner = await screen.findByRole('button', { name: /Quedarme con esta/ });
    await userEvent.click(poner);
    await userEvent.click(poner);

    expect(
      useArrangementStore.getState().arrangement.parts.flatMap((parte) => parte.blocks),
    ).toHaveLength(2);
  });
});

describe('grabar un trozo', () => {
  /** Un acorde mayor, como lo entrega el motor de croma. */
  function oye(root: PitchClass, at: number) {
    useSessionStore.getState().actions.setHeardChord({
      symbol: 'x',
      root,
      notes: [0, 4, 7].map((interval) => normalizePitchClass(root + interval)),
      // Oído sin dudar: el segundo candidato quedaba lejos.
      margin: 0.2,
      alternatives: [],
      score: 1,
      at,
    });
  }

  it('mientras graba lo dice, y no deja pedir salidas a medias', async () => {
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: 'Grabar un trozo' }));

    expect(screen.getByRole('status')).toHaveTextContent(/Grabando lo que tocas/);
    expect(screen.getByRole('button', { name: /Salidas de esto/ })).toBeDisabled();
  });

  it('lo grabado manda sobre el camino, y trae los pulsos de verdad', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    let reloj = 0;
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} now={() => reloj} />));

    // El camino lleva otra cosa: si se mandara eso, la grabación no serviría.
    componiendo(['vi', 'IV']);

    await userEvent.click(screen.getByRole('button', { name: 'Grabar un trozo' }));
    // A 100 bpm un pulso son 600 ms. Do dos pulsos, Sol cuatro.
    oye(C, 0);
    oye(G, 1200);
    reloj = 3600;
    await userEvent.click(screen.getByRole('button', { name: 'Parar de grabar' }));

    expect(await screen.findByRole('status')).toHaveTextContent('De lo que has grabado: I · V.');

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    /**
     * Grado y pulsos, y nada más. Antes se mandaba el paso capturado entero, así
     * que la confianza y la lista de alternativas del motor viajaban al modelo
     * gastando tokens sin que nadie las leyera. De todo eso, lo único que le sirve
     * es si el compás lo oyó un micro, y eso va como `heard`.
     */
    const request = fetchVersions.mock.calls[0]![0] as VersionsRequest;
    expect(request.progression).toEqual([
      { degree: 'I', beats: 2 },
      { degree: 'V', beats: 4 },
    ]);
  });

  // Estos se oyeron con margen de sobra: no hay nada que avisar.
  it('lo oído sin dudas no se marca', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    let reloj = 0;
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} now={() => reloj} />));
    componiendo(['vi', 'IV']);

    await userEvent.click(screen.getByRole('button', { name: 'Grabar un trozo' }));
    oye(C, 0);
    oye(G, 1200);
    reloj = 3600;
    await userEvent.click(screen.getByRole('button', { name: 'Parar de grabar' }));
    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    const request = fetchVersions.mock.calls[0]![0] as VersionsRequest;
    expect(request.progression.every((paso) => paso.heard === undefined)).toBe(true);
  });

  it('olvidar lo grabado devuelve el camino', async () => {
    let reloj = 0;
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} now={() => reloj} />));
    componiendo(['vi', 'IV']);

    await userEvent.click(screen.getByRole('button', { name: 'Grabar un trozo' }));
    oye(C, 0);
    oye(G, 1200);
    reloj = 3600;
    await userEvent.click(screen.getByRole('button', { name: 'Parar de grabar' }));
    await userEvent.click(screen.getByRole('button', { name: /Olvidar lo grabado/ }));

    expect(screen.getByRole('status')).toHaveTextContent('De lo que llevas probando: vi · IV.');
  });

  it('grabar sin tocar nada no rompe nada: se sigue pudiendo usar el camino', async () => {
    let reloj = 0;
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} now={() => reloj} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: 'Grabar un trozo' }));
    reloj = 5000;
    await userEvent.click(screen.getByRole('button', { name: 'Parar de grabar' }));

    expect(screen.getByRole('status')).toHaveTextContent('De lo que llevas probando: I · V.');
  });
});

describe('escuchar una versión', () => {
  /** Un reproductor de mentira: jsdom no tiene `AudioContext`. */
  function reproductor() {
    const calls: Array<{ steps: unknown; onStep?: (index: number | null) => void }> = [];
    const player = {
      calls,
      stopped: 0,
      play: vi.fn(async (steps, onStep) => {
        calls.push({ steps, onStep });
      }),
      stop: vi.fn(() => {
        player.stopped += 1;
      }),
      dispose: vi.fn(async () => {}),
    };
    return player;
  }

  async function conVersiones(player: ReturnType<typeof reproductor>) {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} createPlayer={() => player} />));
    componiendo(['I', 'V']);
    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    await screen.findByText('Más oscura');
  }

  it('suena con las notas y los pulsos que le tocan', async () => {
    const player = reproductor();
    await conVersiones(player);

    await userEvent.click(screen.getByRole('button', { name: 'Escuchar' }));

    expect(player.play).toHaveBeenCalledTimes(1);
    const pasos = player.calls[0]!.steps as Array<{ midis: number[]; durationMs: number }>;
    // C mayor y Db mayor, colocados desde su fundamental.
    expect(pasos.map((paso) => paso.midis)).toEqual([
      [48, 52, 55],
      [49, 53, 56],
    ]);
    expect(pasos.every((paso) => paso.durationMs > 0)).toBe(true);
  });

  it('el mismo botón la para: escuchando dos seguidas, lo que quieres es cortarla', async () => {
    const player = reproductor();
    await conVersiones(player);

    await userEvent.click(screen.getByRole('button', { name: 'Escuchar' }));
    expect(await screen.findByRole('button', { name: 'Parar' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Parar' }));

    expect(player.stopped).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Escuchar' })).toBeInTheDocument();
  });

  it('el compás que suena se enciende, y se apaga al terminar', async () => {
    const player = reproductor();
    await conVersiones(player);
    await userEvent.click(screen.getByRole('button', { name: 'Escuchar' }));

    const avisar = player.calls[0]!.onStep!;
    await act(async () => {
      avisar(1);
    });
    expect(screen.getByText('Db').closest('li')).toHaveAttribute('aria-current', 'true');

    await act(async () => {
      avisar(null);
    });
    expect(screen.getByText('Db').closest('li')).not.toHaveAttribute('aria-current');
  });
});

describe('grabar y volver a escucharlo', () => {
  /**
   * La razón de que exista el análisis de la grabación: lo que el motor oye en
   * vivo arrastra sus limitaciones —ventana corta, sin mirar hacia delante— y al
   * parar se puede volver a escuchar el trozo entero y corregirlo.
   *
   * Aquí no se prueba el análisis, que tiene los suyos en `audio/`: se prueba la
   * costura. Que al parar se pida la grabación, y que lo que salga sustituya a lo
   * que se oyó en vivo.
   */
  function entradaQueGraba(muestras: Float32Array) {
    const llamadas = { arrancada: 0, parada: 0 };
    return {
      llamadas,
      entrada: {
        startRecording: () => {
          llamadas.arrancada += 1;
          return true;
        },
        stopRecording: async () => {
          llamadas.parada += 1;
          return { samples: muestras, sampleRate: 48_000 };
        },
      },
    };
  }

  /** Un La menor sostenido, que el análisis de verdad sabe reconocer. */
  function laMenor(segundos: number): Float32Array {
    const n = Math.round(segundos * 48_000);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      const t = i / 48_000;
      const decae = Math.exp(-t * 0.5);
      const v =
        Math.sin(2 * Math.PI * 220 * t) +
        Math.sin(2 * Math.PI * 261.63 * t) +
        Math.sin(2 * Math.PI * 329.63 * t);
      x[i] = (v / 3) * 0.3 * decae;
    }
    return x;
  }

  it('al empezar a grabar le pide a la entrada que guarde el sonido', async () => {
    const { llamadas, entrada } = entradaQueGraba(new Float32Array(0));
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} getInput={() => entrada} />));

    await userEvent.click(screen.getByRole('button', { name: /Grabar un trozo/ }));

    expect(llamadas.arrancada).toBe(1);
  });

  it('al parar, lo que salga del análisis sustituye a lo que se oyó en vivo', async () => {
    const { entrada } = entradaQueGraba(laMenor(3));
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} getInput={() => entrada} />));

    await userEvent.click(screen.getByRole('button', { name: /Grabar un trozo/ }));
    await userEvent.click(screen.getByRole('button', { name: /Parar de grabar/ }));

    await waitFor(() => {
      expect(useSessionStore.getState().captured.length).toBeGreaterThan(0);
    });
  });

  it('si el análisis no saca nada, no borra lo que se oyó en vivo', async () => {
    // Silencio: el analizador devuelve una lista vacía, y eso no puede pisar lo
    // que el motor sí oyó. Perder la mejora es aceptable; perder la grabación no.
    const { entrada } = entradaQueGraba(new Float32Array(48_000));
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} getInput={() => entrada} />));

    await userEvent.click(screen.getByRole('button', { name: /Grabar un trozo/ }));
    const antes = useSessionStore.getState().captured;
    await userEvent.click(screen.getByRole('button', { name: /Parar de grabar/ }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Escuchándolo otra vez/ })).toBeNull();
    });
    expect(useSessionStore.getState().captured).toEqual(antes);
  });

  it('con una entrada que no sabe grabar, todo sigue funcionando', async () => {
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} getInput={() => ({})} />));

    await userEvent.click(screen.getByRole('button', { name: /Grabar un trozo/ }));

    expect(screen.getByRole('button', { name: /Parar de grabar/ })).toBeInTheDocument();
  });
});

describe('qué se le pide, elegido antes de pedirlo', () => {
  /**
   * No es un adorno: de la clase que se elija depende qué esquema se le manda al
   * modelo, y el esquema es lo único que le impide declarar un camino que el
   * validador no sabe comprobar. Se elige aquí y viaja en la petición.
   */
  it('viene puesto continuar, y se puede cambiar a retocar', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V', 'vi', 'IV']);

    await userEvent.click(screen.getByRole('button', { name: 'Retocar estos compases' }));
    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    await waitFor(() => expect(fetchVersions).toHaveBeenCalled());
    expect((fetchVersions.mock.calls[0]![0] as VersionsRequest).kind).toBe('retocar');
  });

  it('la elegida se marca, para saber qué se va a pedir sin leer', async () => {
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: 'Retocar estos compases' }));

    expect(screen.getByRole('button', { name: 'Retocar estos compases' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Continuar la canción' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

/**
 * Las salidas salen de **la canción**, no del camino.
 *
 * Salían del camino, y el camino dejó de ser donde se escribe
 * ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)):
 * con tres acordes escritos, este panel decía «encadena al menos dos acordes» y
 * no dejaba pedir nada. Se vio abriendo el panel con una canción delante.
 */
describe('de donde salen las salidas', () => {
  it('de lo escrito en la cancion, con los pulsos de cada bloque', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    const parte = useArrangementStore.getState().actions.addPart('Estrofa');
    useArrangementStore.getState().actions.addBlock(parte, 'I', 4);
    useArrangementStore.getState().actions.addBlock(parte, 'IV', 8);

    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));

    expect(screen.getByRole('status')).toHaveTextContent('De lo que llevas escrito: I · IV.');
    await userEvent.click(screen.getByRole('button', { name: 'Salidas de esto' }));

    const request = fetchVersions.mock.calls[0]![0] as VersionsRequest;
    // Los pulsos salen del bloque y no de un cuatro fijo: un acorde que dura dos
    // compases no es lo mismo que dos acordes.
    expect(request.progression.map((paso) => [paso.degree, paso.beats])).toEqual([
      ['I', 4],
      ['IV', 8],
    ]);
  });
});

/**
 * Un 200 con el cuerpo cambiado no puede dejar la pantalla en blanco.
 *
 * Pasaba: el panel leía `versions.length` de un `undefined` y se caía entero.
 * Un proxy que contesta otra cosa, o una ruta y un cliente desincronizados al
 * desplegar, bastan. Se comprueba lo que llega y se dice, que es lo que ya hace
 * el panel de ideas con esto mismo.
 */
describe('lo que llega mal', () => {
  it('un 200 sin salidas se dice, y no tumba el panel', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    componiendo(['I', 'V']);
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ otraCosa: true }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Vuelve a pedirlo/);
    // Y el panel sigue en pie: se puede volver a pedir.
    expect(screen.getByRole('button', { name: /Salidas de esto/ })).toBeInTheDocument();
  });
});
