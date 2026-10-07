// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Account } from '@core/billing';
import { MAX_VERSION_DEGREES } from '@core/billing';
import {
  MAX_PARTS,
  normalizePitchClass,
  pitchClassFromName,
  type Arrangement,
  type Part,
  type PitchClass,
} from '@core/music';
import { AccountProvider } from '@state/account';
import { useArrangementStore } from '@state/arrangement-store';
import { useSessionStore } from '@state/session-store';

import {
  MAX_DIRECTRICES_LENGTH,
  versionsError,
  type Version,
  type VersionsRequest,
} from './contract';
import { compasesQueNoViajan, NO_CABEN_LAS_PARTES, VersionsPanel } from './VersionsPanel';

const C = pitchClassFromName('C');
const G = pitchClassFromName('G');

const CON_PLAN: Account = {
  email: 'javier@example.com',
  name: null,
  plan: 'medio',
  aiModel: 'claude-opus-5',
  aiLeftToday: 30,
  aiLeftMonth: 30,
};

// Básico: desde adr/0066 las salidas entran en Medio.
const SIN_PLAN: Account = { ...CON_PLAN, plan: 'basico' };

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

/**
 * Una canción de dos partes con todo lo que se perdía: una estrofa con un acorde
 * oído con duda, un G7, un punteo, su papel y dos vueltas, y un estribillo detrás.
 */
const CANCION: Arrangement = {
  parts: [
    {
      id: 'estrofa',
      name: 'Mi estrofa',
      role: 'estrofa',
      repeats: 2,
      bars: 4,
      blocks: [
        {
          id: 'e1',
          degree: 'I',
          beats: 4,
          source: 'heard',
          confidence: 0.01,
          alternatives: ['vi'],
        },
        {
          id: 'e2',
          degree: 'V',
          especie: 'dominant7',
          beats: 4,
          source: 'written',
          confidence: 1,
          alternatives: [],
        },
        { id: 'e3', degree: 'vi', beats: 4, source: 'written', confidence: 1, alternatives: [] },
      ],
      // Un Mi en el primer tiempo, y un Si a contratiempo en el segundo compás.
      notes: [
        { id: 'n1', offset: 4, start: 0, length: 1 },
        { id: 'n2', offset: 11, start: 5, length: 1 },
      ],
    },
    {
      id: 'estribillo',
      name: 'Mi estribillo',
      role: 'estribillo',
      bars: 4,
      blocks: [
        { id: 'c1', degree: 'vi', beats: 4, source: 'written', confidence: 1, alternatives: [] },
        { id: 'c2', degree: 'IV', beats: 4, source: 'written', confidence: 1, alternatives: [] },
      ],
      notes: [],
    },
  ],
};

function cancion() {
  useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
  useArrangementStore.setState({ arrangement: CANCION, past: [] });
}

/** Retocar la estrofa: el I y el G7 se quedan, el vi pasa a IV. */
const RETOCADA_PASOS = [
  { degree: 'I', beats: 4, symbol: 'C', from: 'I', fromSymbol: 'C', move: null },
  {
    degree: 'V',
    especie: 'dominant7',
    beats: 4,
    symbol: 'G7',
    from: 'V',
    fromSymbol: 'G7',
    move: null,
  },
  { degree: 'IV', beats: 4, symbol: 'F', from: 'vi', fromSymbol: 'Am', move: null },
] as const;

const RETOCADA: Version = {
  path: 'otro-final',
  title: 'Acaba en el IV',
  why: 'Deja la frase abierta.',
  sections: [{ name: 'Lo que llevas', yours: false, steps: [...RETOCADA_PASOS] }],
  steps: [...RETOCADA_PASOS],
};

/** Continuar con un cierre de dos compases. */
const CIERRE = [
  { degree: 'V', beats: 4, symbol: 'G', from: null, move: null },
  { degree: 'I', beats: 4, symbol: 'C', from: null, move: null },
] as const;

const CONTINUADA: Version = {
  path: 'seguir',
  title: 'Un cierre',
  why: 'Vuelve a la tónica.',
  sections: [
    { name: 'Lo que llevas', yours: true, steps: [] },
    { name: 'Cierre', yours: false, steps: [...CIERRE] },
  ],
  steps: [...CIERRE],
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

    expect(screen.getByRole('note')).toHaveTextContent(/plan Medio/);
  });
});

describe('cuándo se puede pedir', () => {
  it('sin nada dice que se grabe o se encadene', async () => {
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} />));

    expect(await screen.findByRole('status')).toHaveTextContent(/Graba un trozo o escribe/);
  });

  it('sin ningún acorde no se pide, y se dice por qué', async () => {
    const fetchVersions = vi.fn();
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo([]);

    expect(await screen.findByText(/escribe algún acorde/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    expect(fetchVersions).not.toHaveBeenCalled();
  });

  /**
   * **Un acorde ya es una canción**: el dominio la sigue, la cierra o la parte, y
   * el panel decía «con uno solo no hay por dónde tirar».
   */
  it('con un solo acorde se pide', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I']);

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    const request = fetchVersions.mock.calls[0]![0] as VersionsRequest;
    expect(request.progression.map((step) => step.degree)).toEqual(['I']);
  });

  /**
   * Sin salidas, el servidor dice por qué con las palabras del dominio
   * (`porQueNoHaySalidas`), y el panel lo enseña tal cual.
   */
  it('si no hay ninguna salida, enseña el porqué del servidor', async () => {
    const porque =
      'Detrás de tus 31 acordes solo cabe uno más, y con uno no se llega a casa desde tu I. Prueba a retocarla.';
    const fetchVersions = vi
      .fn()
      .mockResolvedValue(respondWith(versionsError('invalid_request', porque), 400));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(porque);
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

/**
 * **A qué quieres que suene, con tus palabras.**
 *
 * Es la mitad que faltaba: el selector de arriba dice *qué* le mandas y esto dice
 * *qué quieres*. Sin ello el modelo continuaba siempre por lo obvio, porque nadie
 * le había dicho otra cosa.
 */
describe('las directrices', () => {
  /** Pide salidas escribiendo eso —o nada— en el campo. */
  async function pedirCon(texto?: string) {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);

    if (texto !== undefined) {
      await userEvent.type(screen.getByLabelText('A qué quieres que suene'), texto);
    }
    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    return fetchVersions.mock.calls[0]![0] as VersionsRequest;
  }

  it('lo que escribes viaja con la peticion', async () => {
    expect((await pedirCon('a rock lento')).directrices).toBe('a rock lento');
  });

  /**
   * Y sin escribir nada el campo no va: un bloque vacío en el prompt es una línea
   * que el modelo interpreta, y lo que interpreta es que le falta algo.
   */
  it('sin escribir nada no se manda el campo', async () => {
    expect(await pedirCon()).not.toHaveProperty('directrices');
  });

  it('solo espacios es no haber escrito nada', async () => {
    expect(await pedirCon('   ')).not.toHaveProperty('directrices');
  });

  // El tope es una palanca de gasto, así que el campo no deja pasarse de él.
  it('el campo no deja escribir mas que el tope', async () => {
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} />));

    expect(screen.getByLabelText('A qué quieres que suene')).toHaveAttribute(
      'maxLength',
      String(MAX_DIRECTRICES_LENGTH),
    );
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
    // Las eligió el modelo: no se dice nada más.
    expect(screen.queryByText(/sin IA/)).not.toBeInTheDocument();
  });

  /**
   * Cuando el modelo no da nada que valga, contesta el dominio con su menú. El cupo
   * ya se ha gastado, y lo que se le debe a quien lo pagó es saber que esto no lo
   * eligió el modelo.
   */
  it('si las eligió el dominio porque el modelo no dio nada, lo dice', async () => {
    const fetchVersions = vi
      .fn()
      .mockResolvedValue(respondWith({ versions: [UNA], origen: 'dominio' }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    expect(await screen.findByText(/las ha elegido la aplicación\s+sin IA/)).toBeInTheDocument();
    expect(screen.getByText(/no ha dado con nada que se sostenga/)).toBeInTheDocument();
  });

  /**
   * **Con el modelo caído, «no ha dado con nada que se sostenga» es mentira**, y
   * manda a pedirlo otra vez contra lo mismo. Lo que toca es esperar.
   */
  it('si no se pudo hablar con el modelo, dice que esperes un minuto', async () => {
    const fetchVersions = vi
      .fn()
      .mockResolvedValue(
        respondWith({ versions: [UNA], origen: 'dominio', motivo: 'model_unavailable' }),
      );
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    expect(
      await screen.findByText(/No hemos podido contactar con el modelo; vuelve a intentarlo/),
    ).toHaveTextContent(/sin IA/);
    expect(screen.queryByText(/no ha dado con nada que se sostenga/)).not.toBeInTheDocument();
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
   * Desde el camino, que no está en la canción, entra en ella como parte nueva.
   *
   * La dejaba en el camino, que era la segunda canción paralela
   * ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)):
   * te quedabas con una salida y tu canción seguía siendo la de antes.
   */
  it('lo del camino entra en la cancion, y el camino queda limpio', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V']);

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Quedarme con esta/ }));

    const partes = useArrangementStore.getState().arrangement.parts;
    expect(partes.map((parte) => parte.name)).toEqual(['Lo que llevas']);
    expect(partes[0]?.blocks.map((b) => b.degree)).toEqual(['I', 'bII']);
    expect(useSessionStore.getState().currentDegree).toBe('bII');
    expect(useSessionStore.getState().path).toEqual([]);
  });

  /**
   * **Pisaba la canción entera**: estrofa, estribillo y puente pasaban a «Lo que
   * llevas», y con ellos se iban la séptima, la duda, el papel, las vueltas y el
   * punteo. Retocar cambia los bloques de la parte que se mandó, y nada más.
   */
  it('retocar cambia solo esa parte, y conserva lo que no toca', async () => {
    cancion();
    useArrangementStore.getState().actions.elegirBloque('e1');
    const antes = useArrangementStore.getState().arrangement;
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [RETOCADA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));

    await userEvent.click(screen.getByRole('button', { name: 'Retocar estos compases' }));
    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Quedarme con esta/ }));

    const [estrofa, estribillo] = useArrangementStore.getState().arrangement.parts as [Part, Part];
    // La otra parte, ni tocada: la misma referencia.
    expect(estribillo).toBe(antes.parts[1]);
    // La suya conserva todo lo que no son sus acordes.
    expect(estrofa).toMatchObject({
      id: 'estrofa',
      name: 'Mi estrofa',
      role: 'estrofa',
      repeats: 2,
      bars: 4,
    });
    expect(estrofa.notes).toBe(antes.parts[0]!.notes);
    // El I y el G7 siguen igual —el G7 con su séptima, y el I con su duda—, y
    // solo el tercero cambia, escrito.
    const [uno, dos, tres] = estrofa.blocks;
    expect(uno).toBe(antes.parts[0]!.blocks[0]);
    expect(dos).toBe(antes.parts[0]!.blocks[1]);
    expect(dos?.especie).toBe('dominant7');
    expect(uno?.source).toBe('heard');
    expect(tres).toMatchObject({ degree: 'IV', source: 'written' });
  });

  it('continuar mete lo nuevo detras de esa parte, y lo demas sigue donde estaba', async () => {
    cancion();
    useArrangementStore.getState().actions.elegirBloque('e1');
    const antes = useArrangementStore.getState().arrangement;
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [CONTINUADA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Quedarme con esta/ }));

    const partes = useArrangementStore.getState().arrangement.parts;
    expect(partes.map((parte) => parte.name)).toEqual(['Mi estrofa', 'Cierre', 'Mi estribillo']);
    expect(partes[0]).toBe(antes.parts[0]);
    expect(partes[2]).toBe(antes.parts[1]);
    expect(partes[1]?.blocks.map((b) => b.degree)).toEqual(['V', 'I']);
  });

  /** Un solo paso del deshacer, que deja la canción como estaba. */
  it('se deshace de un golpe', async () => {
    cancion();
    const antes = useArrangementStore.getState().arrangement;
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [RETOCADA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Quedarme con esta/ }));
    useArrangementStore.getState().actions.undo();

    expect(useArrangementStore.getState().arrangement).toBe(antes);
  });

  /**
   * Probar otra salida sustituye a la anterior: si no, dos continuaciones seguidas
   * dejaban dos cierres, y quedársela dos veces, dos copias.
   */
  it('quedarsela dos veces no encadena dos copias', async () => {
    cancion();
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [CONTINUADA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    const poner = await screen.findByRole('button', { name: /Quedarme con esta/ });
    await userEvent.click(poner);
    await userEvent.click(poner);

    expect(useArrangementStore.getState().arrangement.parts).toHaveLength(3);
  });

  it('probar otra la cambia por la anterior, y deshacer vuelve a antes de las dos', async () => {
    cancion();
    const antes = useArrangementStore.getState().arrangement;
    const otra: Version = { ...CONTINUADA, title: 'Otro cierre' };
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [CONTINUADA, otra] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    const [primera, segunda] = await screen.findAllByRole('button', { name: /Quedarme con esta/ });
    await userEvent.click(primera!);
    await userEvent.click(segunda!);

    expect(useArrangementStore.getState().arrangement.parts).toHaveLength(3);
    useArrangementStore.getState().actions.undo();
    expect(useArrangementStore.getState().arrangement).toBe(antes);
  });

  /** Y si entre una y otra se ha tocado la canción, la segunda va encima. */
  it('si la cancion ha cambiado entre medias, la segunda no deshace nada', async () => {
    cancion();
    useArrangementStore.getState().actions.elegirBloque('e1');
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [CONTINUADA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    const poner = await screen.findByRole('button', { name: /Quedarme con esta/ });
    await userEvent.click(poner);
    act(() => {
      useArrangementStore.getState().actions.renamePart('estribillo', 'Otro nombre');
    });
    await userEvent.click(poner);

    const nombres = useArrangementStore.getState().arrangement.parts.map((parte) => parte.name);
    expect(nombres).toEqual(['Mi estrofa', 'Cierre', 'Cierre', 'Otro nombre']);
  });

  /**
   * El punteo no se borra: es trabajo, y una nota fuera del acorde puede ser la
   * tensión que se quería. Pero se dice que nadie lo ha oído con lo de debajo.
   */
  it('el punteo se queda, y se avisa de que debajo han cambiado acordes', async () => {
    cancion();
    useArrangementStore.getState().actions.elegirBloque('e1');
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [RETOCADA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    expect(screen.queryByText(/El punteo de la parte sigue/)).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /Quedarme con esta/ }));

    expect(useArrangementStore.getState().arrangement.parts[0]?.notes).toHaveLength(2);
    expect(screen.getByText(/El punteo de la parte sigue como estaba/)).toBeInTheDocument();
  });

  it('si no caben las partes que añade, se dice y no se toca nada', async () => {
    cancion();
    for (let i = 0; i < MAX_PARTS - 2; i += 1) {
      useArrangementStore.getState().actions.addPart(`Relleno ${i}`);
    }
    const antes = useArrangementStore.getState().arrangement;
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [CONTINUADA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Quedarme con esta/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(NO_CABEN_LAS_PARTES);
    expect(useArrangementStore.getState().arrangement).toBe(antes);
  });
});

/**
 * Lo que viaja de una parte: cada bloque con lo que el lienzo sabe de él, el papel
 * de la parte, el estilo y el compás. Y nada de nombres.
 */
describe('el contexto que viaja', () => {
  async function pedida(): Promise<VersionsRequest> {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    return fetchVersions.mock.calls[0]![0] as VersionsRequest;
  }

  it('la especie, la duda y las notas de cada compas, con sus pulsos fuertes', async () => {
    cancion();
    useArrangementStore.getState().actions.elegirBloque('e2');

    const request = await pedida();

    expect(request.progression).toEqual([
      { degree: 'I', beats: 4, heard: true, notas: [{ nota: 4, fuerte: true }] },
      { degree: 'V', beats: 4, especie: 'dominant7', notas: [{ nota: 11, fuerte: false }] },
      { degree: 'vi', beats: 4 },
    ]);
    expect(request.role).toBe('estrofa');
    expect(request.estilo).toBe(useSessionStore.getState().styleId);
    expect(request.pulsosPorCompas).toBe(4);
  });

  // Los nombres los escribe quien compone: son texto libre, y no viajan.
  it('el nombre de la parte se ve, pero no viaja', async () => {
    cancion();

    const request = await pedida();

    expect(screen.getByRole('status')).toHaveTextContent('«Mi estribillo»');
    expect(JSON.stringify(request)).not.toContain('Mi ');
  });

  it('sin nada elegido va la ultima parte con acordes', async () => {
    cancion();

    const request = await pedida();

    expect(request.progression.map((paso) => paso.degree)).toEqual(['vi', 'IV']);
    expect(request.role).toBe('estribillo');
  });

  it('la parte se puede elegir aqui, y manda sobre el bloque elegido', async () => {
    cancion();
    useArrangementStore.getState().actions.elegirBloque('c1');
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'De qué parte' }),
      'Mi estrofa',
    );
    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    const request = fetchVersions.mock.calls[0]![0] as VersionsRequest;
    expect(request.progression.map((paso) => paso.degree)).toEqual(['I', 'V', 'vi']);
  });

  it('con una sola parte no se pregunta de cual', () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    const parte = useArrangementStore.getState().actions.addPart('Estrofa');
    useArrangementStore.getState().actions.addBlock(parte, 'I', 4);
    useArrangementStore.getState().actions.addBlock(parte, 'V', 4);
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} />));

    expect(screen.queryByRole('combobox', { name: 'De qué parte' })).not.toBeInTheDocument();
  });

  /**
   * El papel es el de la parte, y cambiarlo aquí lo cambia en ella: había un
   * selector propio del panel que empezaba siempre en «idea».
   */
  it('el papel es el de la parte, y cambiarlo aqui lo cambia en la cancion', async () => {
    cancion();
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} />));
    const papel = screen.getByRole('combobox', { name: /Qué parte es esto/ });
    expect(papel).toHaveValue('estribillo');

    await userEvent.selectOptions(papel, 'puente');

    expect(useArrangementStore.getState().arrangement.parts[1]?.role).toBe('puente');
  });

  /** Se cortaba en silencio: quien grababa cuarenta compases no se enteraba. */
  it('mas compases de los que caben se dice, y se mandan los primeros', async () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: C, mode: 'major' });
    actions.setTempo(120, 4);
    actions.startCapture(0);
    // Cuarenta acordes de un compás, Do y Sol alternados: a 120 bpm, dos segundos.
    const tocados = MAX_VERSION_DEGREES + 8;
    actions.replaceCapture(
      Array.from({ length: tocados }, (_, i) => ({
        root: (i % 2 === 0 ? C : G) as PitchClass,
        notes: [0, 4, 7].map((paso) => normalizePitchClass((i % 2 === 0 ? C : G) + paso)),
        at: i * 2000,
        margin: 0.9,
      })),
    );
    actions.stopCapture(tocados * 2000);
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));

    expect(screen.getByText(compasesQueNoViajan(tocados))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    const request = fetchVersions.mock.calls[0]![0] as VersionsRequest;
    expect(request.progression).toHaveLength(MAX_VERSION_DEGREES);
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
    // Abrir el micro descarga sus motores la primera vez: no es al instante.
    await screen.findByRole('button', { name: 'Parar de grabar' });

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
    // Abrir el micro descarga sus motores la primera vez: no es al instante.
    await screen.findByRole('button', { name: 'Parar de grabar' });
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
    // Abrir el micro descarga sus motores la primera vez: no es al instante.
    await screen.findByRole('button', { name: 'Parar de grabar' });
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
    // Abrir el micro descarga sus motores la primera vez: no es al instante.
    await screen.findByRole('button', { name: 'Parar de grabar' });
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
    // Abrir el micro descarga sus motores la primera vez: no es al instante.
    await screen.findByRole('button', { name: 'Parar de grabar' });
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

  // Con su especie: un G7 que vuelve suena con su séptima, no como un G.
  it('suena con la especie de cada compas', async () => {
    const player = reproductor();
    cancion();
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [RETOCADA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} createPlayer={() => player} />));
    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Escuchar' }));

    const pasos = player.calls[0]!.steps as Array<{ midis: number[] }>;
    expect(pasos[1]!.midis).toHaveLength(4);
    expect(pasos[0]!.midis).toHaveLength(3);
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

  /**
   * **Dos salidas con el mismo título y el mismo camino.** El título lo escribe el
   * modelo, y con él de clave React pisaba una con la otra y «Escuchar» encendía las
   * dos a la vez (adr/0115). La que suena es la que se pulsa, y nada más.
   */
  it('dos salidas con el mismo título se pintan las dos, y suena solo la que se pulsa', async () => {
    const player = reproductor();
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {});
    const gemela: Version = { ...UNA, why: 'Otra forma de decirlo.' };
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA, gemela] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} createPlayer={() => player} />));
    componiendo(['I', 'V']);
    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));
    await screen.findByText('Otra forma de decirlo.');

    expect(screen.getAllByText('Más oscura')).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Escuchar' })[1]!);

    expect(screen.getAllByRole('button', { name: 'Parar' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Escuchar' })).toHaveLength(1);
    const avisos = errores.mock.calls.map((llamada) => String(llamada[0]));
    expect(avisos.filter((aviso) => aviso.includes('same key'))).toEqual([]);
    errores.mockRestore();
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
/**
 * Con treinta y dos compases ya no cabe nada detrás, y el panel empezaba en
 * «Continuar»: lo primero que se pedía era un 400 que decía «nos falta la
 * progresión». Con treinta y uno todavía cabe la llegada, y si no la hay lo dice
 * el servidor.
 */
describe('con la canción llena', () => {
  function llena(compases: number) {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    const { actions } = useArrangementStore.getState();
    const parte = actions.addPart('Estrofa');
    for (let i = 0; i < compases; i += 1) {
      actions.addBlock(parte, i % 2 === 0 ? 'I' : 'V', 4);
    }
  }

  it('«Continuar» se apaga, dice por qué y se pide retocar', async () => {
    llena(32);
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));

    const continuar = screen.getByRole('button', { name: 'Continuar la canción' });
    expect(continuar).toBeDisabled();
    expect(continuar).toHaveAccessibleDescription(/Ya no cabe otra parte.*Retocar/);
    expect(screen.getByRole('button', { name: 'Retocar estos compases' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Salidas de esto' }));
    expect((fetchVersions.mock.calls[0]![0] as VersionsRequest).kind).toBe('retocar');
  });

  it('con sitio para un compás, «Continuar» sigue y no se explica nada', () => {
    llena(31);
    render(conCuenta(<VersionsPanel fetchVersions={vi.fn()} />));

    expect(screen.getByRole('button', { name: 'Continuar la canción' })).toBeEnabled();
    expect(screen.queryByText(/Ya no cabe otra parte/)).not.toBeInTheDocument();
  });
});

describe('de donde salen las salidas', () => {
  it('de lo escrito en la cancion, con los pulsos de cada bloque', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
    const parte = useArrangementStore.getState().actions.addPart('Estrofa');
    useArrangementStore.getState().actions.addBlock(parte, 'I', 4);
    useArrangementStore.getState().actions.addBlock(parte, 'IV', 8);

    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));

    expect(screen.getByRole('status')).toHaveTextContent(
      'De lo que llevas escrito en «Estrofa»: I · IV.',
    );
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
 * desplegar, bastan. Se comprueba lo que llega y se dice.
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

describe('lo que se ha grabado manda sobre lo escrito', () => {
  /**
   * Y los compases de los que el motor dudó viajan marcados: el modelo tiene
   * que saber cuáles son para no construir encima de una lectura floja.
   */
  it('lo dudoso viaja marcado', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: C, mode: 'major' });
    actions.setTempo(120, 4);
    actions.startCapture(0);
    actions.replaceCapture([
      { root: C, notes: [0, 4, 7], at: 0, margin: 0.9 },
      { root: 7 as never, notes: [7, 11, 2], at: 2000, margin: 0.01 },
    ]);
    actions.stopCapture(4000);

    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    const request = fetchVersions.mock.calls[0]![0] as VersionsRequest;
    expect(request.progression.some((paso) => 'heard' in paso)).toBe(true);
  });

  // Y qué parte es lo elige quien pide: de eso depende lo que se propone.
  it('se puede decir que parte es', async () => {
    const fetchVersions = vi.fn().mockResolvedValue(respondWith({ versions: [UNA] }));
    render(conCuenta(<VersionsPanel fetchVersions={fetchVersions} />));
    componiendo(['I', 'V', 'vi', 'IV']);

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /Qué parte es esto/ }),
      'estribillo',
    );
    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    expect((fetchVersions.mock.calls[0]![0] as VersionsRequest).role).toBe('estribillo');
  });
});

describe('sin fábrica de petición', () => {
  /**
   * Se llama a `/api/versiones`, que es lo que hace en la aplicación: la
   * dirección y el cuerpo son parte del contrato con el servidor.
   */
  it('pide a /api/versiones con el cuerpo en json', async () => {
    const pedidas: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      pedidas.push({ url, init });
      return respondWith({ versions: [] });
    });
    render(conCuenta(<VersionsPanel />));
    componiendo(['I', 'V', 'vi', 'IV']);

    await userEvent.click(screen.getByRole('button', { name: /Salidas de esto/ }));

    await waitFor(() => expect(pedidas).toHaveLength(1));
    expect(pedidas[0]!.url).toBe('/api/versiones');
    expect(pedidas[0]!.init.method).toBe('POST');
    vi.unstubAllGlobals();
  });
});
