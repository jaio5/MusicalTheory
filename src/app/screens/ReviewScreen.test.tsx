// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import {
  EMPTY_PROGRESS,
  findUnit,
  pitchClassFromName,
  posicionesDeLaUnidad,
  UNIT_ORDER,
} from '@core/music';
import { AccountProvider } from '@state/account';
import { useSessionStore } from '@state/session-store';

import { ReviewScreen } from './ReviewScreen';

/** La primera unidad de teoría cuya lección ya genera preguntas. */
const DE_TEORIA = UNIT_ORDER.find((id) => {
  const unit = findUnit(id)?.unit;
  return unit?.kind === 'theory' && posicionesDeLaUnidad(unit) > 0;
})!;

const empujar = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: empujar }),
  usePathname: () => '/aprender/repaso',
}));

/**
 * El repaso.
 *
 * Pantalla propia porque es una sesión con principio y final, como una unidad: la
 * cola se congela al entrar, se contesta y se sale. Metida en una pestaña del
 * camino se olvidaba, y era justo lo que no podía pasar con lo que uno ya ha
 * fallado una vez.
 *
 * Lo que se prueba con más cuidado es el candado, y **que diga la verdad**. Decía
 * que lo fallado se apuntaba igual sin plan, y no se apunta: la unidad solo lo
 * hace con plan (`UnitScreen`, y lo fijan sus pruebas). Prometerlo y no cumplirlo
 * era lo peor de las dos cosas, así que ahora se dice lo que pasa.
 */

const CON_PLAN: Account = {
  email: 'javier@example.com',
  name: 'Javier',
  plan: 'pro',
  aiModel: 'claude-opus-5',
  aiLeftToday: 20,
  aiLeftMonth: 300,
};

function pintar(account: Account = ANONYMOUS) {
  return render(
    <AccountProvider account={account} accounts>
      <ReviewScreen />
    </AccountProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  empujar.mockReset();
});

describe('sin plan', () => {
  it('se dice que va con plan, y que sin el lo fallado no se apunta', () => {
    pintar();

    expect(screen.getByRole('heading', { name: /va con plan/ })).toBeInTheDocument();
    expect(screen.getByText(/la pregunta no se apunta/)).toBeInTheDocument();
    expect(screen.queryByText(/se apunta de todas formas/)).toBeNull();
  });

  // Al lado del candado, qué es el repaso: quien llega desde el camino veía que
  // era de pago y no qué era.
  it('y al lado se cuenta como funciona', () => {
    pintar();

    expect(screen.getByRole('complementary')).toContainElement(
      screen.getByRole('region', { name: 'Cómo funciona el repaso' }),
    );
  });

  /**
   * Y cuántas hay esperando: «se apunta de todas formas» era una promesa
   * abstracta, y el número la hace comprobable. En singular con una, que es el
   * caso de quien acaba de fallar la primera.
   */
  it('dice cuantas hay esperando, en singular y en plural', () => {
    const cola = (cuantas: number) =>
      JSON.stringify({
        done: [],
        // De una unidad de tocar, que tiene un paso por nota: cuántas preguntas
        // tiene una lección lo decide su texto, y una posición que no tiene se
        // suelta al leer.
        review: Array.from({ length: cuantas }, (_, indice) => ({
          unitId: UNIT_ORDER.find((id) => findUnit(id)?.unit.kind === 'play')!,
          index: indice,
          seenOn: '1970-01-01',
          hits: 0,
        })),
      });

    localStorage.setItem('caos-ordenado:aprender', cola(1));
    pintar();
    expect(screen.getByText('hay 1 pregunta')).toBeInTheDocument();

    cleanup();

    localStorage.setItem('caos-ordenado:aprender', cola(3));
    pintar();
    expect(screen.getByText('hay 3 preguntas')).toBeInTheDocument();
  });

  it('y hay vuelta al camino, que es de donde se llega', () => {
    pintar();

    expect(screen.getByRole('link', { name: /Camino/ })).toHaveAttribute('href', '/aprender');
  });
});

describe('con plan', () => {
  it('se entra al repaso, con la tonalidad a la vista', () => {
    // La cola se genera otra vez en la tonalidad de hoy, así que hay que verla.
    pintar(CON_PLAN);

    expect(screen.getByRole('heading', { name: 'Repaso' })).toBeInTheDocument();
    expect(screen.getAllByText(/sin tonalidad/).length).toBeGreaterThan(0);
  });

  // Al lado de la pregunta, lo que se consulta mientras se contesta: la
  // tonalidad, lo que vuelve hoy y cómo sale una pregunta de la cola.
  it('al lado de la pregunta va la tonalidad y como funciona', () => {
    pintar(CON_PLAN);

    const lado = screen.getByRole('complementary', { name: 'Lo que acompaña al repaso' });
    expect(within(lado).getByRole('region', { name: 'Tonalidad del repaso' })).toBeInTheDocument();
    expect(within(lado).getByText(/Elige una y las preguntas/)).toBeInTheDocument();
    expect(
      within(lado).getByRole('region', { name: 'Cómo funciona el repaso' }),
    ).toBeInTheDocument();
  });

  it('sin tonalidad puesta se ofrece la rueda para elegir una', () => {
    pintar(CON_PLAN);

    expect(screen.getByText(/Lo que fallaste, otra vez/)).toBeInTheDocument();
  });
});

describe('la cola de lo que fallaste', () => {
  beforeEach(() => {
    useSessionStore.getState().actions.reset();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
  });

  it('vacia se dice, y se explica como se llena', () => {
    // Lo que falles vuelve el mismo día y otra vez al siguiente. Sin decirlo,
    // una pantalla vacía parece una avería.
    pintar(CON_PLAN);

    expect(screen.getByText('No hay nada que repasar.')).toBeInTheDocument();
    expect(screen.getByText(/vuelve el mismo día/)).toBeInTheDocument();
    // Con tonalidad puesta, lo de al lado dice para qué sirve cambiarla.
    expect(screen.getByText(/Cámbiala y las mismas preguntas/)).toBeInTheDocument();
  });

  it('con algo pendiente se pregunta, y al terminar se celebra', async () => {
    // La celebración vive aquí, como en una unidad: el repaso es una sesión con
    // principio y final.
    const hoy = new Date();
    const dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(
      hoy.getDate(),
    ).padStart(2, '0')}`;
    localStorage.setItem(
      'caos-ordenado:aprender',
      JSON.stringify({
        ...EMPTY_PROGRESS,
        // De teoría y con preguntas: una posición que su lección no tiene se
        // suelta al leer, y el repaso saldría vacío sin preguntar nada.
        review: [{ unitId: DE_TEORIA, index: 0, seenOn: dia, hits: 0 }],
      }),
    );

    pintar(CON_PLAN);
    expect(screen.queryByText('No hay nada que repasar.')).not.toBeInTheDocument();

    for (let vuelta = 0; vuelta < 20; vuelta += 1) {
      const seguir = screen.queryByRole('button', { name: /Siguiente|Terminar el repaso/ });
      if (seguir !== null) {
        await userEvent.click(seguir);
        continue;
      }
      const pregunta = screen.queryAllByRole('group').find((grupo) => grupo.tagName === 'FIELDSET');
      const opciones = pregunta === undefined ? [] : within(pregunta).queryAllByRole('button');
      if (opciones.length === 0) {
        break;
      }
      await userEvent.click(opciones[0]!);
    }

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Volver al camino' })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Volver al camino' }));

    expect(empujar).toHaveBeenCalledWith('/aprender');
  });

  it('se puede salir sin terminar, sin perder lo contestado', async () => {
    pintar(CON_PLAN);

    await userEvent.click(screen.getByRole('button', { name: 'Volver al camino' }));

    expect(empujar).toHaveBeenCalledWith('/aprender');
  });
});
