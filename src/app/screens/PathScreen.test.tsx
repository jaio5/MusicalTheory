// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import { EMPTY_PROGRESS, findUnit, UNIT_ORDER } from '@core/music';
import { AccountProvider } from '@state/account';

import { PathScreen } from './PathScreen';

const empujar = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: empujar }),
  usePathname: () => '/aprender',
}));

/**
 * El fallo que tuvo: al pulsar el muñeco en el camino desaparecía en vez de
 * abrirse. Se prueba **dentro de la pantalla entera** y no con el muñeco suelto,
 * porque suelto ya funcionaba: lo que fallaba era la combinación.
 */
describe('El profesor dentro del camino', () => {
  it('al pulsarlo se queda y abre el formulario', async () => {
    render(
      <AccountProvider account={ANONYMOUS} accounts={false}>
        <PathScreen />
      </AccountProvider>,
    );

    const muñeco = screen.getByRole('button', { name: /preguntarle al profesor/i });
    await userEvent.click(muñeco);

    expect(screen.getByRole('button', { name: /cerrar el profesor/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/pregunta lo que quieras/i)).toBeInTheDocument();
  });
});

/**
 * Lo que se lee al abrir el camino.
 *
 * El botón grande de seguir va arriba y siempre a la misma altura: es lo que se
 * pulsa nueve de cada diez veces que se abre esta pantalla. Y cuando no queda
 * nada abierto por delante hay que decir por qué, que son dos motivos distintos
 * —el temario se acabó, o lo que viene va con plan— y solo uno de ellos se
 * arregla pagando.
 */

const UNIDAD = findUnit(UNIT_ORDER[0]!)!;

const PRO: Account = {
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
      <PathScreen />
    </AccountProvider>,
  );
}

describe('lo que se pulsa nueve de cada diez veces', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('el boton de seguir lleva a la siguiente unidad abierta', () => {
    pintar();

    const seguir = screen.getAllByRole('link').find((a) => a.textContent?.includes('seguir'));

    expect(seguir).toHaveAttribute('href', `/aprender/${UNIT_ORDER[0]!}`);
  });

  it('sin plan, al acabar el Elemental lo siguiente es el Profesional', () => {
    // Y se ofrece: aquí sí se arregla pagando.
    const elemental = UNIT_ORDER.filter((id) => id.startsWith('e'));
    localStorage.setItem(
      'caos-ordenado:aprender',
      JSON.stringify({ ...EMPTY_PROGRESS, done: elemental }),
    );

    pintar();

    expect(screen.getByText(/No queda nada abierto por delante/)).toBeInTheDocument();
    expect(screen.getByText(/Lo siguiente es el Grado Profesional/)).toBeInTheDocument();
  });

  it('con el temario entero hecho no se ofrece nada que comprar', () => {
    // Ya está todo pagado: enseñar un candado ahí sería vender lo que ya tiene.
    localStorage.setItem(
      'caos-ordenado:aprender',
      JSON.stringify({ ...EMPTY_PROGRESS, done: [...UNIT_ORDER] }),
    );

    pintar(PRO);

    expect(screen.getByText(/Has terminado el temario/)).toBeInTheDocument();
    expect(screen.queryByText(/Lo siguiente es el Grado Profesional/)).not.toBeInTheDocument();
  });

  it('el camino entero esta a la vista, no solo la siguiente', () => {
    // Las unidades del camino se pulsan, no se enlazan: la navegación la lleva
    // el router para no perder la tonalidad ni el micro abierto.
    pintar();

    expect(screen.getByRole('heading', { name: /Aprender/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(UNIT_ORDER.length / 2);
  });
});

describe('moverse por el camino', () => {
  beforeEach(() => {
    localStorage.clear();
    empujar.mockReset();
  });

  it('pulsar una unidad abierta lleva a su direccion', async () => {
    // Con `router.push` y no con un enlace: así no se recarga la página y no se
    // pierde la tonalidad detectada ni el micro abierto.
    pintar();

    // El nombre accesible es el que oye quien no ve el camino, así que es por
    // donde se busca aquí también.
    await userEvent.click(screen.getByRole('button', { name: new RegExp(UNIDAD.unit.title, 'i') }));

    expect(empujar).toHaveBeenCalledWith(`/aprender/${UNIT_ORDER[0]!}`);
  });

  it('con plan y algo pendiente, la meta del dia ofrece repasar', async () => {
    const hoy = new Date();
    const dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(
      hoy.getDate(),
    ).padStart(2, '0')}`;
    localStorage.setItem(
      'caos-ordenado:aprender',
      JSON.stringify({
        ...EMPTY_PROGRESS,
        review: [{ unitId: UNIT_ORDER[0]!, index: 0, dueOn: dia, streak: 0 }],
      }),
    );

    pintar(PRO);

    const repasar = screen
      .getAllByRole('button', { name: /repas/i })
      .find((boton) => boton.tagName === 'BUTTON')!;
    await userEvent.click(repasar);

    expect(empujar).toHaveBeenCalledWith('/aprender/repaso');
  });

  it('el punto de partida se puede mover desde aqui', async () => {
    // Elegirlo no da por hechas las unidades anteriores: es de dónde arrancas,
    // no lo que ya sabes.
    pintar(PRO);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'elemental-2');

    expect(JSON.parse(localStorage.getItem('caos-ordenado:aprender')!).startCourse).toBe(
      'elemental-2',
    );
  });
});

describe('el rótulo del botón de seguir', () => {
  it('dice el curso, el grado y si es de tocar o de teoría', () => {
    // El icono lo distingue de un vistazo y el rótulo lo dice con palabras: son
    // dos cosas distintas que se hacen —leer una lección y tocar una escala— y
    // saber cuál viene cambia si te pones la guitarra.
    const deTocar = UNIT_ORDER.find((id) => findUnit(id)?.unit.kind === 'play')!;
    const antes = UNIT_ORDER.slice(0, UNIT_ORDER.indexOf(deTocar));
    localStorage.setItem(
      'caos-ordenado:aprender',
      JSON.stringify({ ...EMPTY_PROGRESS, done: antes }),
    );

    pintar();

    const seguir = screen.getAllByRole('link').find((a) => a.textContent?.includes('seguir'));
    expect(seguir?.textContent).toContain('Elemental');
    expect(seguir).toHaveAttribute('href', `/aprender/${deTocar}`);
  });

  it('y en el Profesional lo dice también', () => {
    const profesional = UNIT_ORDER.find((id) => id.startsWith('p'))!;
    const antes = UNIT_ORDER.slice(0, UNIT_ORDER.indexOf(profesional));
    localStorage.setItem(
      'caos-ordenado:aprender',
      JSON.stringify({ ...EMPTY_PROGRESS, done: antes }),
    );

    pintar(PRO);

    const seguir = screen.getAllByRole('link').find((a) => a.textContent?.includes('seguir'));
    expect(seguir?.textContent).toContain('Profesional');
  });
});
