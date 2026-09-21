// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS, type Account } from '@core/billing';
import {
  EMPTY_PROGRESS,
  earExercises,
  findUnit,
  pitchClassFromName,
  UNIT_ORDER,
  type EarUnit as EarUnitDef,
} from '@core/music';
import { AccountProvider } from '@state/account';
import { useSessionStore } from '@state/session-store';

import { UnitScreen } from './UnitScreen';

const empujar = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: empujar }),
  usePathname: () => '/aprender/e1-grados',
}));

/**
 * Una unidad, a pantalla completa.
 *
 * Los tres «aquí no puedes entrar» son lo que se prueba, porque los tres dicen
 * cosas distintas y el que se equivoque manda a alguien a pagar por algo que ya
 * tiene o le deja mirando una pantalla que no explica nada: la unidad que **no
 * existe** —renombrada o retirada—, la que va **con plan** y la que todavía no
 * ha abierto **el temario**. Confundir las dos últimas es lo peor: cobrar por
 * algo que solo hay que desbloquear terminando la anterior.
 *
 * El avance se lee de `localStorage`, así que empieza vacío en cada test.
 */

const PRO: Account = {
  email: 'javier@example.com',
  name: 'Javier',
  plan: 'pro',
  aiModel: 'claude-opus-5',
  aiLeftToday: 20,
  aiLeftMonth: 300,
};

function pintar(unitId: string, account: Account = ANONYMOUS) {
  return render(
    <AccountProvider account={account} accounts>
      <UnitScreen unitId={unitId} />
    </AccountProvider>,
  );
}

/** La primera unidad del temario: la única abierta sin haber hecho nada. */
const PRIMERA = UNIT_ORDER[0]!;

beforeEach(() => {
  localStorage.clear();
  empujar.mockReset();
});

describe('cuando no se puede entrar', () => {
  it('una unidad que ya no existe se dice, y se manda al camino', () => {
    // Pasa al renombrar o retirar algo del temario con un enlace guardado.
    pintar('una-que-no-existe');

    expect(screen.getByRole('heading', { name: /no existe/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Camino/ })).toHaveAttribute('href', '/aprender');
  });

  it('una del Profesional sin plan enseña el candado y dice que el Elemental es gratis', () => {
    const profesional = UNIT_ORDER.find((id) => id.startsWith('p'))!;

    pintar(profesional);

    expect(screen.getAllByText(/Grado Profesional/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Elemental son gratis/)).toBeInTheDocument();
  });

  it('una que el temario aun no ha abierto no ofrece pagar: se abre terminando la anterior', () => {
    // Es la distinción que importa. Enseñar aquí un candado de plan sería cobrar
    // por algo que ya se tiene.
    const segunda = UNIT_ORDER[1]!;

    pintar(segunda, PRO);

    expect(screen.getByText(/se abre al terminar la anterior/)).toBeInTheDocument();
    expect(screen.queryAllByText(/Grado Profesional/)).toHaveLength(0);
  });
});

describe('la unidad abierta', () => {
  it('se pinta con su titulo, su curso y su XP', () => {
    pintar(PRIMERA);

    expect(screen.getByText(/XP$/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Camino/ })).toBeInTheDocument();
  });

  it('la tonalidad va en una barra que se abre, no ocupando media pantalla', () => {
    // Cerrada ocupa una línea y dice en qué tonalidad estás, que es lo único que
    // hay que saber mientras se contesta.
    pintar(PRIMERA);

    expect(screen.getByText(/Tonalidad:/)).toBeInTheDocument();
    expect(screen.getByText(/sin elegir/)).toBeInTheDocument();
  });

  /**
   * Y sin tonalidad, la unidad **ofrece cuáles**, no señala la rueda.
   *
   * Esa barra flota sobre la caja de la unidad y se abre ella sola cuando no hay
   * tonalidad puesta, así que lo que había debajo —un estado vacío que decía
   * «está en la rueda de aquí arriba»— quedaba justo detrás del panel: en una
   * ventana de 900 se veía la rueda y medio millar de píxeles de negro. Se vio
   * mirando la pantalla, que es la única manera de ver algo tapado.
   */
  it('sin tonalidad ofrece cuatro con las que empezar, y elegir una abre la unidad', async () => {
    pintar(PRIMERA);

    const empezar = screen.getByRole('group', { name: 'Tonalidades para empezar' });
    await userEvent.click(within(empezar).getByRole('button', { name: 'C mayor' }));

    // Elegida, la unidad arranca: ni el ofrecimiento ni «sin elegir» siguen ahí.
    expect(
      screen.queryByRole('group', { name: 'Tonalidades para empezar' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/sin elegir/)).not.toBeInTheDocument();
  });
});

describe('el avance de quien mira', () => {
  it('con la anterior hecha, la siguiente se abre', () => {
    localStorage.setItem(
      'caos-ordenado:aprender',
      JSON.stringify({ ...EMPTY_PROGRESS, done: [PRIMERA] }),
    );

    pintar(UNIT_ORDER[1]!, PRO);

    expect(screen.queryByText(/se abre al terminar la anterior/)).not.toBeInTheDocument();
  });
});

describe('contestar la unidad entera', () => {
  it('al terminarla se enseña lo ganado y la salida al camino', async () => {
    // La celebración vive en esta pantalla y no en el camino porque es el final
    // de lo que se acaba de hacer. Se llega contestando: no hay forma de
    // provocarla desde fuera, y así el test recorre lo mismo que una persona.
    useSessionStore.getState().actions.reset();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });

    pintar(PRIMERA);

    // Se contesta lo primero que haya: acertar o fallar no cambia que la unidad
    // termine —fallar no bloquea— y lo que se prueba aquí es el final.
    for (let vuelta = 0; vuelta < 20; vuelta += 1) {
      const seguir = screen.queryByRole('button', { name: /Siguiente|Terminar la unidad/ });
      if (seguir !== null) {
        await userEvent.click(seguir);
        continue;
      }
      // El `fieldset` de la pregunta, que no es el desplegable de la tonalidad.
      const pregunta = screen.queryAllByRole('group').find((grupo) => grupo.tagName === 'FIELDSET');
      const opciones = pregunta === undefined ? [] : within(pregunta).queryAllByRole('button');
      if (opciones.length === 0) {
        break;
      }
      await userEvent.click(opciones[0]!);
    }

    expect(screen.getByRole('link', { name: /Volver al camino/ })).toHaveAttribute(
      'href',
      '/aprender',
    );

    // Y «Seguir» lleva a la siguiente que se haya abierto, no de vuelta al
    // camino: encadenar unidades es la mitad de por qué esto engancha.
    await userEvent.click(screen.getByRole('button', { name: 'Seguir' }));

    expect(empujar).toHaveBeenCalledWith(`/aprender/${UNIT_ORDER[1]!}`);
    // Con tiempo de sobra: contestar la unidad entera son veinte pulsaciones, y
    // con la cobertura puesta el medio segundo de holgura no llega.
  }, 30_000);
});

describe('una unidad de tocar', () => {
  /**
   * Las de tocar no preguntan: enseñan la escala sobre el mástil y esperan a que
   * suene. Lo que se comprueba aquí es que **la pantalla las trata como una
   * unidad más** —mismo marco, misma tonalidad, mismo XP— y que lo que costó
   * entra en la cola de repaso igual que una pregunta fallada. Terminarla sigue
   * siendo terminarla: aquí no se suspende.
   */
  const DE_TOCAR = UNIT_ORDER.find((id) => findUnit(id)?.unit.kind === 'play')!;

  it('se abre con su mástil, no con preguntas', () => {
    // La primera de tocar va después de la primera de teoría, así que hay que
    // haberla hecho para que esté abierta.
    const antes = UNIT_ORDER.slice(0, UNIT_ORDER.indexOf(DE_TOCAR));
    localStorage.setItem(
      'caos-ordenado:aprender',
      JSON.stringify({ ...EMPTY_PROGRESS, done: antes }),
    );
    useSessionStore.getState().actions.reset();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });

    pintar(DE_TOCAR, PRO);

    expect(screen.getByText(/XP$/)).toBeInTheDocument();
    expect(screen.getByText(/Tonalidad:/)).toBeInTheDocument();
    // Sin preguntas: lo que hay es el mástil esperando a que suene algo.
    expect(screen.queryAllByRole('group').some((g) => g.tagName === 'FIELDSET')).toBe(false);
  });
});

/**
 * Lo que fallas vuelve, y volver es cosa del plan.
 *
 * La cola de repaso es de quien tiene plan: sin él, fallar sigue sin bloquear y
 * sigue explicándose, pero la pregunta no vuelve. Esta pantalla es la que decide
 * si se apunta o no, así que se prueba desde aquí.
 */
describe('lo que se falla', () => {
  /** El avance guardado, tal y como queda en el equipo. */
  function avance(): { readonly review?: unknown } {
    return JSON.parse(localStorage.getItem('caos-ordenado:aprender') ?? '{}');
  }

  /** Deja hechas todas las unidades anteriores a una, que es como se abre. */
  function abrir(unitId: string, mas: Partial<typeof EMPTY_PROGRESS> = {}): void {
    localStorage.setItem(
      'caos-ordenado:aprender',
      JSON.stringify({
        ...EMPTY_PROGRESS,
        done: UNIT_ORDER.slice(0, UNIT_ORDER.indexOf(unitId)),
        ...mas,
      }),
    );
    useSessionStore.getState().actions.reset();
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
  }

  /**
   * Contesta lo primero de cada pregunta hasta que una salga mal.
   *
   * No se sabe de antemano cuál es la buena —las preguntas se escriben con la
   * tonalidad que haya puesta—, así que se busca el fallo por la pista que deja
   * en pantalla: «Era tal».
   */
  async function hastaFallarUna(): Promise<boolean> {
    for (let vuelta = 0; vuelta < 20; vuelta += 1) {
      const pregunta = screen.queryAllByRole('group').find((grupo) => grupo.tagName === 'FIELDSET');
      if (pregunta === undefined) {
        return false;
      }
      await userEvent.click(within(pregunta).getAllByRole('button')[0]!);
      if (screen.queryByText(/^Era /) !== null) {
        return true;
      }
      const seguir = screen.queryByRole('button', { name: /Siguiente|Terminar la unidad/ });
      if (seguir === null) {
        return false;
      }
      await userEvent.click(seguir);
    }
    return false;
  }

  it('con plan, una pregunta de teoria vuelve a la cola', async () => {
    abrir(PRIMERA);
    pintar(PRIMERA, PRO);

    expect(await hastaFallarUna(), 'no se llegó a fallar ninguna').toBe(true);

    expect(avance().review).not.toEqual([]);

    // Y el profesor sale a explicarlo, y se va al cerrarlo: si se quedara, la
    // pregunta siguiente empezaría con el globo de la anterior encima.
    expect(await screen.findByText(/Si quieres te lo explico/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar el profesor' }));
    expect(screen.queryByText(/Si quieres te lo explico/i)).not.toBeInTheDocument();
  });

  // Y las de oído igual: fallar oyendo también se apunta.
  it('y una de oido tambien', async () => {
    const DE_OIDO = UNIT_ORDER.find((id) => findUnit(id)?.unit.kind === 'ear')!;
    const unidad = findUnit(DE_OIDO)!.unit as EarUnitDef;
    abrir(DE_OIDO);
    // La mala se saca del mismo catálogo que escribe la pregunta, y no
    // pulsando a ver qué pasa: en una unidad de oído hay tres preguntas y
    // acertarlas todas de casualidad no es raro.
    const mala = earExercises(unidad.ear, pitchClassFromName('C'), 'major')[0]!.choices.find(
      (opcion) => !opcion.correct,
    )!;
    pintar(DE_OIDO, PRO);

    await userEvent.click(screen.getByRole('button', { name: mala.text }));

    expect(screen.getByText(/^Era /)).toBeInTheDocument();
    expect(avance().review).not.toEqual([]);
  });

  // Y terminarla entera cuenta como terminada, igual que una de teoría.
  it('una de oido terminada suma su XP', async () => {
    const DE_OIDO = UNIT_ORDER.find((id) => findUnit(id)?.unit.kind === 'ear')!;
    const unidad = findUnit(DE_OIDO)!.unit as EarUnitDef;
    abrir(DE_OIDO);
    const ejercicios = earExercises(unidad.ear, pitchClassFromName('C'), 'major');
    pintar(DE_OIDO, PRO);

    for (const ejercicio of ejercicios) {
      const buena = ejercicio.choices.find((opcion) => opcion.correct)!;
      await userEvent.click(screen.getByRole('button', { name: buena.text }));
      await userEvent.click(screen.getByRole('button', { name: /Siguiente|Terminar la unidad/ }));
    }

    expect(screen.getByRole('link', { name: /Volver al camino/ })).toBeInTheDocument();
  });

  // Sin plan no hay cola: fallar se explica igual, pero la pregunta no vuelve.
  it('sin plan, lo fallado de oido no se apunta', async () => {
    const DE_OIDO = UNIT_ORDER.find((id) => findUnit(id)?.unit.kind === 'ear')!;
    const unidad = findUnit(DE_OIDO)!.unit as EarUnitDef;
    abrir(DE_OIDO);
    const mala = earExercises(unidad.ear, pitchClassFromName('C'), 'major')[0]!.choices.find(
      (opcion) => !opcion.correct,
    )!;
    pintar(DE_OIDO);

    await userEvent.click(screen.getByRole('button', { name: mala.text }));

    expect(screen.getByText(/^Era /)).toBeInTheDocument();
    expect(avance().review).toEqual([]);
  });

  /**
   * Y al terminar la última que queda, «Seguir» va al camino: no hay siguiente a
   * la que encadenar, y quedarse en la celebración sería un callejón.
   */
  it('terminada la ultima, Seguir lleva al camino', async () => {
    abrir(PRIMERA, { done: UNIT_ORDER.filter((id) => id !== PRIMERA) });
    pintar(PRIMERA, PRO);
    for (let vuelta = 0; vuelta < 20; vuelta += 1) {
      const seguir = screen.queryByRole('button', { name: /Siguiente|Terminar la unidad/ });
      if (seguir !== null) {
        await userEvent.click(seguir);
        continue;
      }
      const pregunta = screen.queryAllByRole('group').find((grupo) => grupo.tagName === 'FIELDSET');
      if (pregunta === undefined) {
        break;
      }
      await userEvent.click(within(pregunta).getAllByRole('button')[0]!);
    }

    await userEvent.click(screen.getByRole('button', { name: 'Seguir' }));

    expect(empujar).toHaveBeenCalledWith('/aprender');
  }, 30_000);

  // El curso se dice entero, y el Profesional se llama Profesional.
  it('una del Profesional lo dice en su linea', () => {
    const PROFESIONAL = UNIT_ORDER.find((id) => id.startsWith('p'))!;
    abrir(PROFESIONAL);
    pintar(PROFESIONAL, PRO);

    expect(screen.getByText(/º de Profesional ·/)).toBeInTheDocument();
  });
});
