// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import { EMPTY_PROGRESS, findUnit, pitchClassFromName, UNIT_ORDER } from '@core/music';
import { AccountProvider } from '@state/account';
import { CLAVE_RECORRIDO, SIN_EMPEZAR, estadoDelRecorrido } from '@state/recorrido';
import { useSessionStore } from '@state/session-store';

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
    // El formulario solo existe con cuenta y con tonalidad: sin ellas el globo
    // ofrece entrar o elegir, y no es lo que se vigila aquí.
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    render(
      <AccountProvider account={PRO} accounts>
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
const DE_TOCAR = UNIT_ORDER.find((id) => findUnit(id)?.unit.kind === 'play')!;

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
    // Por el grado de su curso y no por la letra del id: el id se conserva aunque
    // la unidad cambie de grado, y las de blues empiezan por «e» y se cobran.
    const elemental = UNIT_ORDER.filter((id) => findUnit(id)?.course.grade === 'elemental');
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
        // De una de tocar, que siempre tiene pasos a los que volver: una posición
        // que su lección no tiene se suelta al leer, y no habría nada pendiente.
        review: [{ unitId: DE_TOCAR, index: 0, seenOn: dia, hits: 0 }],
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
    const profesional = UNIT_ORDER.find((id) => findUnit(id)?.course.grade === 'profesional')!;
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

describe('lo que se lee y se alcanza con el teclado', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Con `opacity-80` la línea de encima del título quedaba en 3,74:1 sobre el
  // latón del tema claro.
  it('la linea del boton de seguir no se apaga con opacidad', () => {
    pintar();

    const linea = screen.getByText(/· seguir/);

    expect(linea.className).not.toMatch(/opacity/);
  });

  // La columna de las medallas se desplaza sola en ancho y no tiene nada
  // enfocable dentro: sin parada propia, el teclado no bajaba por ella.
  it('la columna de las medallas se puede enfocar, y tiene nombre', () => {
    pintar();

    const medallas = screen.getByRole('region', { name: 'Medallas' });

    expect(medallas).toHaveAttribute('tabindex', '0');
  });

  // Apiladas eran quince renglones al final de la columna: van plegadas en una
  // línea que dice cuántas llevas, y abiertas en ancho.
  it('apiladas, las medallas van plegadas y dicen cuántas llevas', () => {
    pintar();

    const medallas = screen.getByRole('region', { name: 'Medallas' });
    const plegable = medallas.querySelector('details')!;

    expect(plegable).not.toHaveAttribute('open');
    expect(plegable.querySelector('summary')).toHaveTextContent('Medallas: 0 de 15');
    expect(plegable.parentElement).toHaveClass('lg:hidden');
    expect(medallas.querySelector('.hidden.lg\\:block h2')).toHaveTextContent('Medallas');
  });

  // Era una frase gris que solo se subrayaba al pasar el ratón: no parecía pulsable.
  it('volver a ver el recorrido tiene forma de botón', () => {
    pintar();

    expect(screen.getByRole('button', { name: /ver otra vez el recorrido/i })).toHaveClass(
      'border-border',
      'min-h-tap',
    );
  });
});

/**
 * El recorrido de la primera visita se vuelve a ver desde aquí: es la pantalla
 * por la que se empieza y la que está en la navegación con cualquier ancho.
 */
describe('volver a ver el recorrido', () => {
  it('el botón lo vuelve a poner en marcha desde el principio', async () => {
    localStorage.setItem(CLAVE_RECORRIDO, 'visto');
    pintar();

    await userEvent.click(
      screen.getByRole('button', { name: 'Ver otra vez el recorrido por la aplicación' }),
    );

    expect(estadoDelRecorrido()).toEqual(SIN_EMPEZAR);
  });
});
