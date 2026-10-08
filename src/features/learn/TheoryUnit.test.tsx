// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ANONYMOUS } from '@core/billing';
import {
  lessonNotes,
  pitchClassFromName,
  presentacionDe,
  type TheoryUnit as TheoryUnitDef,
} from '@core/music';
import { AccountProvider } from '@state/account';
import { useSessionStore } from '@state/session-store';

import { TheoryUnit } from './TheoryUnit';

const GRADOS: TheoryUnitDef = {
  id: 'e1-grados',
  title: 'Qué es un grado',
  kind: 'theory',
  lesson: 'degrees',
  xp: 20,
};

function pintarUnidad(props: Partial<Parameters<typeof TheoryUnit>[0]> = {}) {
  return render(
    <AccountProvider account={ANONYMOUS} accounts={false}>
      <TheoryUnit unit={GRADOS} onDone={() => {}} {...props} />
    </AccountProvider>,
  );
}

/** De la presentación a las preguntas, por la teoría: lo que hace quien la estudia. */
async function hastaLaPrueba(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));
  await userEvent.click(screen.getByRole('button', { name: 'Ponerlo a prueba' }));
}

beforeEach(() => {
  sessionStorage.clear();
  useSessionStore.getState().actions.reset();
  useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
});

describe('los encabezados de una unidad de teoría', () => {
  /**
   * Encima está el título de la unidad, que es el `h1`. «Compruébalo» era un `h3`
   * y quien navega por encabezados saltaba un nivel buscando el apartado que
   * faltaba.
   */
  it('«Compruébalo» cuelga directamente del título: es un h2', async () => {
    pintarUnidad();
    await hastaLaPrueba();

    expect(screen.getByRole('heading', { name: 'Compruébalo' })).toHaveProperty('tagName', 'H2');
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });
});

describe('fallar una pregunta', () => {
  const C = pitchClassFromName('C');
  const mala = () =>
    lessonNotes('degrees', C, 'major').exercises[0]!.choices.find((c) => !c.correct)!;

  async function pintar(onMiss?: (index: number) => void) {
    pintarUnidad(onMiss ? { onMiss } : {});
    await hastaLaPrueba();
  }

  it('avisa de cuál se ha fallado, por su posición', async () => {
    const onMiss = vi.fn();
    await pintar(onMiss);

    await userEvent.click(screen.getByRole('button', { name: mala().text }));

    expect(onMiss).toHaveBeenCalledWith(0);
  });

  it('sin nadie a quien avisar, la corrección sale igual', async () => {
    await pintar();

    await userEvent.click(screen.getByRole('button', { name: mala().text }));

    expect(screen.getByText(/^La buena era «/)).toBeInTheDocument();
  });
});

/**
 * Los tres momentos: de qué va, lo que hay que saber y las preguntas, **de uno en
 * uno**. Con la teoría y las preguntas a la vez se contestaba copiando de lo que
 * había encima.
 */
describe('los tres momentos', () => {
  const C = pitchClassFromName('C');
  const notas = () => lessonNotes('degrees', C, 'major');

  it('empieza por la presentación, sin teoría ni preguntas a la vista', () => {
    pintarUnidad();

    expect(screen.getByRole('heading', { level: 2, name: GRADOS.title })).toBeInTheDocument();
    expect(screen.getByText(presentacionDe(GRADOS.id).contenidos[0]!)).toBeInTheDocument();
    expect(screen.queryByText(notas().points[0]!)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Compruébalo' })).not.toBeInTheDocument();
  });

  it('la teoría va sola, y las preguntas llegan al pedirlas', async () => {
    pintarUnidad();
    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));

    expect(screen.getByText(notas().points[0]!)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: notas().exercises[0]!.prompt })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Ponerlo a prueba' }));

    expect(screen.queryByText(notas().points[0]!)).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: notas().exercises[0]!.prompt })).toBeInTheDocument();
  });

  /**
   * Volver a releer no cuesta la pregunta en la que se iba: el estado de la
   * prueba vive en la unidad, no en el momento.
   */
  it('repasar la teoría y volver deja la prueba en la misma pregunta', async () => {
    pintarUnidad();
    await hastaLaPrueba();
    const primera = notas().exercises[0]!;
    await userEvent.click(
      screen.getByRole('button', { name: primera.choices.find((c) => c.correct)!.text }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await userEvent.click(screen.getByRole('button', { name: 'Repasar la teoría' }));
    expect(screen.getByText(notas().points[0]!)).toBeInTheDocument();

    // Y el botón ya no dice «ponerlo a prueba», que sonaría a empezar de nuevo.
    await userEvent.click(screen.getByRole('button', { name: 'Volver a las preguntas' }));
    expect(screen.getByText(/Pregunta 2 de/)).toBeInTheDocument();
  });

  /**
   * Y tampoco cuesta lo contestado. La respuesta elegida vive en la pregunta, y
   * al ir a la teoría se desmontaba: quien contestaba y se iba a releer antes de
   * pulsar «Siguiente» volvía a la misma pregunta en blanco y sin el porqué.
   */
  it('repasar la teoría con la pregunta contestada la deja contestada, con su porqué', async () => {
    pintarUnidad();
    await hastaLaPrueba();
    const primera = notas().exercises[0]!;
    const mala = primera.choices.find((c) => !c.correct)!;
    await userEvent.click(screen.getByRole('button', { name: mala.text }));

    await userEvent.click(screen.getByRole('button', { name: 'Repasar la teoría' }));
    // Mientras se relee, la pregunta no está a la vista: se contestaría copiando.
    expect(screen.queryByRole('group', { name: primera.prompt })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Volver a las preguntas' }));
    expect(screen.getByRole('group', { name: primera.prompt })).toBeInTheDocument();
    expect(screen.getByText(/^La buena era «/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: mala.text })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
  });

  /**
   * Lo pulsado desaparece con el momento que se va, y el foco se iría al
   * `<body>`: va al título del momento nuevo (adr/0084).
   */
  it('al cambiar de momento, el foco va al título del nuevo', async () => {
    pintarUnidad();

    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(screen.getByRole('heading', { name: 'Lo que hay que saber' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Ponerlo a prueba' }));
    expect(screen.getByRole('heading', { name: 'Compruébalo' })).toHaveFocus();
  });

  it('al llegar no roba el foco: la presentación se lee, no se anuncia', () => {
    pintarUnidad();

    expect(document.body).toHaveFocus();
  });

  it('dice en qué momento se está, y cuáles van hechos', async () => {
    pintarUnidad();
    const momentos = () => within(screen.getByRole('list', { name: 'Momentos de la unidad' }));

    expect(momentos().getAllByRole('listitem')).toHaveLength(3);
    expect(momentos().getByText('Presentación').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));

    expect(momentos().getByText('Teoría').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(momentos().getByText(', hecho')).toBeInTheDocument();
  });

  it('el profesor está en los tres momentos', async () => {
    pintarUnidad();
    expect(screen.getByRole('button', { name: /profesor/i })).toBeInTheDocument();

    await hastaLaPrueba();
    expect(screen.getByRole('button', { name: /profesor/i })).toBeInTheDocument();
  });
});

/**
 * Volver a una unidad empezada la monta de cero, y obligar a pasar otra vez por
 * la teoría para llegar a las preguntas castiga a quien ya la ha leído.
 */
describe('volver a una unidad', () => {
  it('la primera vez no hay atajo: se empieza por el principio', () => {
    pintarUnidad();

    expect(screen.queryByRole('button', { name: 'Ir directo a las preguntas' })).toBeNull();
  });

  it('ya superada, se puede ir directo a las preguntas', async () => {
    pintarUnidad({ yaHecha: true });

    await userEvent.click(screen.getByRole('button', { name: 'Ir directo a las preguntas' }));

    expect(screen.getByRole('heading', { name: 'Compruébalo' })).toHaveFocus();
  });

  /**
   * Recargar a mitad volvía a la presentación, y desde ella se ofrecía un atajo
   * a la pregunta 1: quien iba por la cuarta volvía a contestar tres.
   */
  it('recargar a mitad de la teoría vuelve a la teoría, sin mover el foco', async () => {
    const { unmount } = pintarUnidad();
    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    unmount();

    pintarUnidad();

    expect(screen.getByRole('heading', { name: 'Lo que hay que saber' })).not.toHaveFocus();
    expect(screen.getByRole('button', { name: 'Ponerlo a prueba' })).toBeInTheDocument();
  });

  it('recargar a mitad de las preguntas sigue en la misma', async () => {
    const { unmount } = pintarUnidad();
    await hastaLaPrueba();
    const [primera] = lessonNotes('degrees', pitchClassFromName('C'), 'major').exercises;
    await userEvent.click(
      screen.getByRole('button', { name: primera!.choices.find((c) => c.correct)!.text }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    unmount();

    pintarUnidad();

    expect(screen.getByRole('heading', { name: 'Compruébalo' })).toBeInTheDocument();
    expect(screen.getByText(/^Pregunta 2 de/)).toBeInTheDocument();
    // Y desde la teoría se vuelve a ellas, no se empiezan.
    await userEvent.click(screen.getByRole('button', { name: 'Repasar la teoría' }));
    expect(screen.getByRole('button', { name: 'Volver a las preguntas' })).toBeInTheDocument();
  });

  // Sin almacenamiento —navegación privada estricta— no hay atajo, y nada se rompe.
  it('sin almacenamiento no hay atajo, y empezar funciona igual', async () => {
    const leer = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const escribir = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    pintarUnidad();
    expect(screen.queryByRole('button', { name: 'Ir directo a las preguntas' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));

    expect(screen.getByRole('heading', { name: 'Lo que hay que saber' })).toBeInTheDocument();
    leer.mockRestore();
    escribir.mockRestore();
  });
});

/**
 * La presentación no depende de la tonalidad —es texto fijo del temario— y se
 * ve sin ella. Lo de después sí se escribe con sus acordes.
 */
describe('sin tonalidad', () => {
  beforeEach(() => {
    useSessionStore.getState().actions.reset();
  });

  /**
   * **No la pide: escribe la unidad en Do mayor.** La primera unidad empezaba
   * preguntando por la tonalidad a quien venía a aprender qué es una nota.
   */
  it('no ofrece tonalidades: la presentación lleva directa a empezar', () => {
    pintarUnidad();

    expect(screen.getByText(presentacionDe(GRADOS.id).resumen)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'C mayor' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeEnabled();
  });

  it('la teoría y las preguntas salen en Do mayor, sin fijarla', async () => {
    pintarUnidad();
    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));

    const C = pitchClassFromName('C');
    expect(screen.getByText(lessonNotes('degrees', C, 'major').points[0]!)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ponerlo a prueba' })).toBeInTheDocument();
    // Es la de partida, no una elegida: componer sigue pidiendo la de tu canción.
    expect(useSessionStore.getState().pinnedKey).toBeNull();
  });
});

describe('terminar la unidad', () => {
  const C = pitchClassFromName('C');
  const ejercicios = () => lessonNotes('degrees', C, 'major').exercises;

  async function contestarTodas(acertar: (indice: number) => boolean): Promise<void> {
    for (const [indice, ejercicio] of ejercicios().entries()) {
      const opcion = ejercicio.choices.find((c) => c.correct === acertar(indice))!;
      await userEvent.click(screen.getByRole('button', { name: opcion.text }));
      await userEvent.click(screen.getByRole('button', { name: /Siguiente|Terminar la unidad/ }));
    }
  }

  it('sin un fallo, lo dice al terminar', async () => {
    const onDone = vi.fn();
    pintarUnidad({ onDone });
    await hastaLaPrueba();

    await contestarTodas(() => true);

    expect(onDone).toHaveBeenCalledWith(true);
  });

  // Fallar no bloquea: se termina igual, pero sin la medalla de no fallar.
  it('con alguno fallado, se termina igual y lo dice', async () => {
    const onDone = vi.fn();
    pintarUnidad({ onDone });
    await hastaLaPrueba();

    await contestarTodas((indice) => indice !== 0);
    // El profesor salió a explicarlo; cerrarlo lo calla para la siguiente.
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar el profesor' }));

    expect(onDone).toHaveBeenCalledWith(false);
    expect(screen.queryByText(/Si quieres te lo explico/)).not.toBeInTheDocument();
  });
});
