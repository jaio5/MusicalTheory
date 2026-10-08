// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WebAudioProgressionPlayer } from '@audio/progression-player';
import {
  EAR_KINDS,
  earExercises,
  pitchClassFromName,
  presentacionDe,
  programaDe,
  type EarUnit as EarUnitDef,
} from '@core/music';
import { useSessionStore } from '@state/session-store';

import { EarUnit } from './EarUnit';

const G = pitchClassFromName('G');

const GRADOS: EarUnitDef = {
  id: 'e1-oido',
  title: 'Reconocer el I, el IV y el V',
  kind: 'ear',
  ear: 'degree',
  xp: 25,
};

/**
 * Pinta la unidad y pasa la presentación, que es lo que hace quien llega: las
 * pruebas de aquí son de la prueba.
 */
async function pintar(unit: EarUnitDef, props: Partial<Parameters<typeof EarUnit>[0]> = {}) {
  render(<EarUnit unit={unit} onDone={() => {}} {...props} />);
  await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));
}

const CALIDAD: EarUnitDef = { ...GRADOS, id: 'e2-repaso', ear: 'quality' };

beforeEach(() => {
  // Lo que se guarda de por dónde iba cada unidad vive en la pestaña: entre
  // pruebas, cada una empieza de cero.
  sessionStorage.clear();
  useSessionStore.getState().actions.reset();
  vi.restoreAllMocks();
});

function conTonalidad() {
  useSessionStore.getState().actions.pinKey({ tonic: G, mode: 'major' });
}

describe('sin tonalidad', () => {
  /**
   * Un acorde suelto no tiene grado: lo tiene dentro de una tonalidad. Sin
   * ninguna elegida, la de partida, Do mayor: la unidad no espera a que se elija.
   */
  it('pregunta en Do mayor, sin pedirla', async () => {
    await pintar(GRADOS);

    expect(screen.queryByRole('button', { name: 'C mayor' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /G \(V\)/ })).toBeInTheDocument();
  });
});

describe('una unidad de oído', () => {
  /**
   * Sonar sin que nadie lo pida es meter ruido en una pantalla en la que se
   * acaba de entrar. El primer sonido lo pide quien está delante.
   */
  it('no suena sola al entrar', async () => {
    conTonalidad();
    await pintar(CALIDAD);
    expect(screen.getByRole('button', { name: 'Escuchar' })).toBeInTheDocument();
  });

  it('pregunta con los acordes de tu tonalidad', async () => {
    conTonalidad();
    await pintar(GRADOS);

    // En Sol mayor el V es Re, no Sol.
    expect(screen.getByRole('button', { name: /D \(V\)/ })).toBeInTheDocument();
    expect(screen.getByText(/Primero suena/)).toHaveTextContent('G');
  });

  // Un acorde suelto no tiene grado, así que la tónica suena antes y se dice:
  // no es parte de la pregunta, es el suelo desde el que se mide.
  it('las de calidad no llevan referencia', async () => {
    conTonalidad();
    await pintar(CALIDAD);
    expect(screen.queryByText(/Primero suena/)).not.toBeInTheDocument();
  });

  /**
   * El botón no se gasta ni antes ni después de contestar. Un entrenamiento
   * auditivo que deja oír una sola vez mide la memoria, no el oído, y volver a
   * oírlo **con la respuesta delante** es donde se aprende.
   */
  it('se puede escuchar las veces que haga falta, también tras contestar', async () => {
    conTonalidad();
    await pintar(CALIDAD);

    await userEvent.click(screen.getByRole('button', { name: 'Escuchar' }));
    expect(screen.getByRole('button', { name: /Escuchar otra vez/ })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Alegre' }));
    expect(screen.getByRole('button', { name: /Escuchar otra vez/ })).toBeEnabled();
  });

  it('al terminar avisa de si se acertó todo', async () => {
    conTonalidad();
    const done = vi.fn();
    await pintar(CALIDAD, { onDone: done });

    // Las buenas se sacan del mismo catálogo que escribe las preguntas: cuántas
    // son y cómo se llaman es cosa de `core/music/ear.ts`, no de esta pantalla.
    for (const ejercicio of earExercises(CALIDAD.ear, G, 'major')) {
      const buena = ejercicio.choices.find((opcion) => opcion.correct)!.text;
      await userEvent.click(screen.getByRole('button', { name: buena }));
      await userEvent.click(screen.getByRole('button', { name: /Siguiente|Terminar/ }));
    }
    expect(done).toHaveBeenCalledWith(true);
  });

  it('fallar no bloquea, y lo dice', async () => {
    conTonalidad();
    const done = vi.fn();
    const miss = vi.fn();
    await pintar(CALIDAD, { onDone: done, onMiss: miss });

    await userEvent.click(screen.getByRole('button', { name: 'Triste' }));
    expect(miss).toHaveBeenCalledWith(0);
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeInTheDocument();
  });
});

describe('contestar dos veces', () => {
  /**
   * Una vez contestada, la pregunta ya no cambia: pulsar otra opción no borra
   * lo que se respondió ni vuelve a apuntar el fallo. Sin esto, fallar y pulsar
   * la buena después parecería un acierto.
   */
  it('la segunda pulsacion no cambia lo contestado', async () => {
    conTonalidad();
    const miss = vi.fn();
    await pintar(CALIDAD, { onDone: vi.fn(), onMiss: miss });

    await userEvent.click(screen.getByRole('button', { name: 'Triste' }));
    await userEvent.click(screen.getByRole('button', { name: 'Alegre' }));

    expect(miss).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeInTheDocument();
  });
});

describe('el aviso del profesor al fallar', () => {
  /**
   * Fallar no bloquea, pero sí se dice dónde está lo que falta: volver a
   * escuchar **con la respuesta delante** es donde se pilla. El aviso se borra
   * al cerrarlo, para que no vuelva a salir en la pregunta siguiente.
   */
  it('sale al fallar, y se va al cerrarlo', async () => {
    conTonalidad();
    await pintar(CALIDAD, { onDone: vi.fn() });

    await userEvent.click(screen.getByRole('button', { name: 'Triste' }));

    const globo = await screen.findByText(/es donde se pilla/);
    expect(globo).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar el profesor' }));

    expect(screen.queryByText(/es donde se pilla/)).not.toBeInTheDocument();
  });
});

/**
 * Las dos unidades que se tocaron al arreglar el oído
 * ([adr/0044](../../../docs/adr/0044-un-ejercicio-de-oido-se-contesta-de-oido.md)).
 */
describe('cuatríadas y funciones', () => {
  const SEPTIMAS: EarUnitDef = { ...GRADOS, id: 'p2-oido', ear: 'sevenths' };
  const FUNCIONES: EarUnitDef = { ...GRADOS, id: 'p1-oido', ear: 'functions' };

  function enLaMenor() {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('A'), mode: 'minor' });
  }

  /**
   * El cifrado de la referencia se sacaba pegándole el sufijo al de la tríada, y
   * en las doce tonalidades menores salía «Ammaj7». La referencia de esta
   * pregunta es la tríada, así que tiene que decir «Am» y nada más.
   */
  it('la referencia de las septimas se escribe bien en menor', async () => {
    enLaMenor();
    await pintar(SEPTIMAS);

    const referencia = screen.getByText(/Primero suena/);
    expect(referencia).toHaveTextContent('Am');
    expect(referencia.textContent).not.toMatch(/mm/);
  });

  // La pregunta es qué **hace** el acorde, no cuál es: las tres opciones son los
  // tres papeles y ninguna nombra un cifrado.
  it('las de funcion preguntan por el papel, no por el acorde', async () => {
    enLaMenor();
    await pintar(FUNCIONES);

    expect(screen.getByRole('button', { name: /Reposa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sale de casa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tensa/ })).toBeInTheDocument();
  });
});

/**
 * La de oído también se presenta antes, pero no tiene teoría escrita: lo que
 * enseña se aprende oyendo, así que de la presentación se pasa a la prueba.
 */
describe('los momentos de una unidad de oído', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('empieza por la presentación, sin nada que oír todavía', () => {
    conTonalidad();
    render(<EarUnit unit={GRADOS} onDone={() => {}} />);

    const { resumen, contenidos } = presentacionDe(GRADOS.id);
    expect(screen.getByText(resumen)).toBeInTheDocument();
    expect(screen.getByText(contenidos[0]!)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Escuchar' })).not.toBeInTheDocument();
  });

  it('son dos momentos, y empezar lleva directo a la prueba con el foco en su título', async () => {
    conTonalidad();
    await pintar(GRADOS);

    expect(
      within(screen.getByRole('list', { name: 'Momentos de la unidad' })).getAllByRole('listitem'),
    ).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Compruébalo de oído' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Repasar la teoría' })).not.toBeInTheDocument();
  });

  // Sin teoría no hay a qué saltar: el atajo de las de teoría aquí no sale.
  it('no ofrece ir directo a las preguntas, porque empezar ya es eso', () => {
    conTonalidad();
    render(<EarUnit unit={GRADOS} onDone={() => {}} />);

    expect(screen.queryByRole('button', { name: /directo/ })).not.toBeInTheDocument();
  });

  /**
   * Qué hay que hacer iba encima de cada pregunta, y la primera lo repetía con
   * otras palabras: «Suenan dos notas, una detrás de otra…» dos veces seguidas.
   */
  it('qué hay que hacer se dice en la presentación, y no otra vez encima de la pregunta', async () => {
    conTonalidad();
    render(<EarUnit unit={GRADOS} onDone={() => {}} />);
    const queHacer = EAR_KINDS.degree.lead;

    expect(screen.getByText(new RegExp(`^${queHacer}`))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));

    expect(screen.queryByText(new RegExp(queHacer))).not.toBeInTheDocument();
    expect(screen.getByText(/Primero suena/)).toHaveTextContent('Primero suena G, la referencia.');
  });

  /** Recargar a mitad volvía a la presentación y a la pregunta 1. */
  it('recargar a mitad sigue en la misma pregunta, sin mover el foco', async () => {
    conTonalidad();
    const miss = vi.fn();
    const done = vi.fn();
    const { unmount } = render(<EarUnit unit={GRADOS} onDone={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    const [primera] = earExercises('degree', G, 'major');
    const mala = primera!.choices.find((opcion) => !opcion.correct)!.text;
    await userEvent.click(screen.getByRole('button', { name: mala }));
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    unmount();

    render(<EarUnit unit={GRADOS} onDone={done} onMiss={miss} />);

    expect(screen.getByText('Pregunta 2 de 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Compruébalo de oído' })).not.toHaveFocus();
    // Y lo fallado antes de recargar cuenta: la unidad ya no sale limpia.
    for (const ejercicio of earExercises('degree', G, 'major').slice(1)) {
      const buena = ejercicio.choices.find((opcion) => opcion.correct)!.text;
      await userEvent.click(screen.getByRole('button', { name: buena }));
      await userEvent.click(screen.getByRole('button', { name: /Siguiente|Terminar/ }));
    }
    expect(done).toHaveBeenCalledWith(false);
    expect(miss).not.toHaveBeenCalled();
  });
});

/**
 * El dictado de intervalos: la única clase que suena con notas sueltas. Lo que
 * suena lo decide el dominio con sus alturas exactas (`programaDe`): una sexta
 * reducida a su clase de altura sonaría tercera.
 */
describe('una unidad de intervalos', () => {
  const INTERVALOS: EarUnitDef = { ...GRADOS, id: 'e2-oido-intervalos', ear: 'interval' };

  it('suena lo que el dominio programa, con sus alturas', async () => {
    conTonalidad();
    const tocar = vi
      .spyOn(WebAudioProgressionPlayer.prototype, 'play')
      .mockResolvedValue(undefined);
    await pintar(INTERVALOS);

    await userEvent.click(screen.getByRole('button', { name: 'Escuchar' }));

    const primero = earExercises('interval', G, 'major')[0]!;
    expect(tocar).toHaveBeenCalledWith(
      programaDe(primero, G, 'major', useSessionStore.getState().bpm),
    );
  });

  it('pregunta con las opciones del catálogo, y la siguiente suena al pasar', async () => {
    conTonalidad();
    const tocar = vi
      .spyOn(WebAudioProgressionPlayer.prototype, 'play')
      .mockResolvedValue(undefined);
    const [primero, segundo] = earExercises('interval', G, 'major');
    await pintar(INTERVALOS);

    await userEvent.click(
      screen.getByRole('button', { name: primero!.choices.find((c) => c.correct)!.text }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(tocar).toHaveBeenLastCalledWith(
      programaDe(segundo!, G, 'major', useSessionStore.getState().bpm),
    );
  });
});
