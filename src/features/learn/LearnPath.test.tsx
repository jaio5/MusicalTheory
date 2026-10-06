// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { PlanId } from '@core/billing';
import {
  COURSES,
  EMPTY_PROGRESS,
  UNIT_ORDER,
  completeUnit,
  findUnit,
  missQuestion,
  resumenDe,
  startAt,
  type Progress,
} from '@core/music';

import { LearnPath } from './LearnPath';

/** Un instante cualquiera: el dominio lo pide por parámetro y aquí da igual cuál. */
const CUANDO = '2026-09-24T10:00:00.000Z';

const HOY = '2026-07-29';

const ELEMENTAL = COURSES.filter((course) => course.grade === 'elemental').flatMap((course) =>
  course.units.map((unit) => unit.id),
);

function pintar(progress = EMPTY_PROGRESS, plan: PlanId = 'basico', day: string | null = HOY) {
  const onPick = vi.fn();
  render(<LearnPath progress={progress} plan={plan} day={day} active={null} onPick={onPick} />);
  return onPick;
}

/**
 * El nombre accesible del nodo de una unidad, sacado de su título.
 *
 * Del temario y no escrito a mano: los títulos se reescriben con el temario, y
 * lo que estas pruebas fijan es qué unidad está abierta, no cómo se llama.
 */
function nodo(id: string, cola = ''): RegExp {
  const titulo = findUnit(id)!.unit.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(cola === '' ? `^${titulo}$` : `^${titulo}.*${cola}$`, 'i');
}

/** La primera del Profesional, la que se cobra. */
const PROFESIONAL = COURSES.find((course) => course.grade === 'profesional')!.units[0]!.id;

/** Termina unidades en orden, que es la única forma de que se abran. */
function tras(ids: readonly string[]): Progress {
  return ids.reduce((progress, id) => completeUnit(progress, id, HOY), EMPTY_PROGRESS);
}

describe('El camino del temario', () => {
  it('enseña los dos grados', () => {
    pintar();

    expect(screen.getByRole('region', { name: 'Grado Elemental' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Grado Profesional' })).toBeInTheDocument();
  });

  it('los diez cursos están en pantalla', () => {
    pintar();

    for (const course of COURSES) {
      expect(screen.getByText(course.title)).toBeInTheDocument();
    }
  });

  it('la primera unidad se puede pulsar y las demás no', () => {
    pintar();

    expect(screen.getByRole('button', { name: nodo(UNIT_ORDER[0]!) })).toHaveAttribute(
      'aria-disabled',
      'false',
    );

    const bloqueadas = screen.getAllByRole('button', { name: /bloqueada$/i });
    expect(bloqueadas).toHaveLength(UNIT_ORDER.length - 1);
    for (const boton of bloqueadas) {
      expect(boton).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('avisa de que se ha pulsado una unidad y dice cuál', () => {
    const onPick = pintar();

    screen.getByRole('button', { name: nodo(UNIT_ORDER[0]!) }).click();

    expect(onPick).toHaveBeenCalledWith(UNIT_ORDER[0]);
  });

  it('una unidad superada se marca y sigue pulsable, para repasarla', () => {
    pintar(tras([UNIT_ORDER[0]!]));

    expect(screen.getByRole('button', { name: /superada$/i })).toHaveAttribute(
      'aria-disabled',
      'false',
    );
  });

  /**
   * Una unidad hecha con preguntas esperando en la cola se marca **agrietada**:
   * sigue estando hecha, pero hay algo que volver a mirar. Sin la marca, la
   * cola de repaso es una lista que nadie relaciona con el camino.
   */
  it('una unidad hecha con algo pendiente sale agrietada', () => {
    const hecha = tras([UNIT_ORDER[0]!]);
    const agrietada = missQuestion(hecha, UNIT_ORDER[0]!, 0, HOY);

    const { container } = render(
      <LearnPath progress={agrietada} plan="basico" day={HOY} active={null} onPick={vi.fn()} />,
    );

    expect(container.querySelectorAll('.border-oxblood-bright').length).toBeGreaterThan(0);
  });

  // Y la que se está haciendo se enciende, para no perderla de vista al volver.
  it('la unidad activa se enciende', () => {
    const { container } = render(
      <LearnPath
        progress={EMPTY_PROGRESS}
        plan="basico"
        day={HOY}
        active={UNIT_ORDER[0]!}
        onPick={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('.halo-latón').length).toBe(1);
  });

  it('la siguiente lleva su cartel de «aquí»', () => {
    pintar(tras([UNIT_ORDER[0]!]));

    expect(screen.getByText(/aquí/)).toBeInTheDocument();
  });

  /**
   * Y dice de qué va, **solo ella**: es la que se va a pulsar. En todas serían
   * cuarenta párrafos y el camino dejaría de leerse como un camino.
   */
  it('la de «aquí» dice de qué va, y queda ligado a su nodo', () => {
    const siguiente = UNIT_ORDER[1]!;
    pintar(tras([UNIT_ORDER[0]!]));
    const resumen = resumenDe(siguiente);

    expect(screen.getByRole('button', { name: nodo(siguiente) })).toHaveAccessibleDescription(
      resumen,
    );
    // La primera ya está hecha y no lo repite.
    expect(screen.queryByText(resumenDe(UNIT_ORDER[0]!))).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: nodo(UNIT_ORDER[0]!, 'superada') }),
    ).not.toHaveAttribute('aria-describedby');
  });
});

/**
 * Los dos candados no se abren igual: uno estudiando y otro pagando. Con el mismo
 * icono, quien va por el cuarto curso del Elemental cree que le falta estudiar
 * cuando lo que le falta es un plan.
 */
describe('Los dos candados', () => {
  it('en gratis, el Profesional se bloquea por plan y no por temario', () => {
    pintar(tras(ELEMENTAL), 'gratis');

    expect(screen.getByRole('button', { name: nodo(PROFESIONAL, 'plan') })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('con plan, esa misma unidad está abierta', () => {
    pintar(tras(ELEMENTAL), 'basico');

    expect(screen.getByRole('button', { name: nodo(PROFESIONAL) })).toHaveAttribute(
      'aria-disabled',
      'false',
    );
  });

  it('lo hecho con plan sigue viéndose hecho al volver a gratis, pero cerrado', () => {
    const pagando = tras([...ELEMENTAL, PROFESIONAL]);
    pintar(pagando, 'gratis');

    const boton = screen.getByRole('button', { name: nodo(PROFESIONAL, 'plan') });
    expect(boton).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('Las unidades agrietadas', () => {
  it('una unidad hecha con preguntas pendientes se marca para repasar', () => {
    const progress = missQuestion(tras([UNIT_ORDER[0]!]), UNIT_ORDER[0]!, 0, HOY);
    pintar(progress);

    expect(screen.getByRole('button', { name: /para repasar$/i })).toBeInTheDocument();
  });

  it('sin día todavía leído no se marca ninguna: no se sabe qué toca hoy', () => {
    const progress = missQuestion(tras([UNIT_ORDER[0]!]), UNIT_ORDER[0]!, 0, HOY);
    pintar(progress, 'basico', null);

    expect(screen.queryByRole('button', { name: /para repasar$/i })).not.toBeInTheDocument();
  });
});

/**
 * Elegir por dónde empezar abre ese curso sin haber hecho nada antes. Es el cambio
 * que hace que quien ya sabe teoría no tenga once unidades de peaje.
 */
describe('El punto de partida', () => {
  it('abre el curso elegido y deja abierto lo anterior', () => {
    pintar(startAt(EMPTY_PROGRESS, 'profesional-1', CUANDO), 'basico');

    expect(screen.getByRole('button', { name: nodo(PROFESIONAL) })).toHaveAttribute(
      'aria-disabled',
      'false',
    );
    expect(screen.getByRole('button', { name: nodo(UNIT_ORDER[0]!) })).toHaveAttribute(
      'aria-disabled',
      'false',
    );
  });

  it('lo que va después del punto de partida sigue cerrado', () => {
    pintar(startAt(EMPTY_PROGRESS, 'profesional-1', CUANDO), 'basico');

    expect(
      screen.getByRole('button', {
        name: nodo(UNIT_ORDER[UNIT_ORDER.indexOf(PROFESIONAL) + 1]!, 'bloqueada'),
      }),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('sin elegir nada, solo está abierta la primera', () => {
    pintar(EMPTY_PROGRESS, 'basico');

    expect(screen.getAllByRole('button', { name: /bloqueada$/i })).toHaveLength(
      UNIT_ORDER.length - 1,
    );
  });
});

/**
 * Un nodo cerrado no es un botón muerto: al tocarlo dice qué lo abre. En táctil
 * no hay `title`, así que lo único que había era un círculo que no respondía.
 */
describe('Tocar una unidad cerrada', () => {
  it('por temario, dice que se termine la anterior y no navega', () => {
    const onPick = pintar();

    fireEvent.click(screen.getAllByRole('button', { name: /bloqueada$/i })[0]!);

    expect(screen.getByText('Termina la anterior para abrirla.')).toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('por plan, nombra el plan de verdad y enlaza a los planes', () => {
    pintar(tras(ELEMENTAL), 'gratis');

    fireEvent.click(screen.getByRole('button', { name: nodo(PROFESIONAL, 'plan') }));

    expect(screen.getByText(/Se abre con el plan Básico/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute('href', '/planes');
    // El nombre viejo, que ya no existe, no sale en ninguna parte.
    expect(document.body.innerHTML).not.toContain('Estudiante');
  });

  it('el aviso queda ligado al nodo, y solo hay uno a la vez', () => {
    pintar();
    const [primera, segunda] = screen.getAllByRole('button', { name: /bloqueada$/i });

    fireEvent.click(primera!);
    expect(primera).toHaveAccessibleDescription('Termina la anterior para abrirla.');

    fireEvent.click(segunda!);
    expect(screen.getAllByText('Termina la anterior para abrirla.')).toHaveLength(1);
    expect(primera).not.toHaveAttribute('aria-describedby');
  });
});

describe('La leyenda y el sendero', () => {
  it('la leyenda explica los dos candados con palabras', () => {
    pintar();

    expect(screen.getByText('Se abre terminando la anterior')).toBeInTheDocument();
    expect(screen.getByText('Se abre con un plan')).toBeInTheDocument();
  });

  /**
   * Los tramos unen de nodo a nodo: cada fila menos la primera de su curso trae
   * uno, y su diagonal cambia de sentido con el zigzag.
   */
  it('hay un tramo entre cada par de nodos de un curso, en los dos sentidos', () => {
    const { container } = render(
      <LearnPath
        progress={EMPTY_PROGRESS}
        plan="basico"
        day={HOY}
        active={null}
        onPick={vi.fn()}
      />,
    );

    const unidades = COURSES.reduce((total, course) => total + course.units.length, 0);
    const lineas = container.querySelectorAll('line');
    expect(lineas).toHaveLength(unidades - COURSES.length);

    const sentidos = new Set(Array.from(lineas, (linea) => linea.getAttribute('x1')));
    expect(sentidos).toEqual(new Set(['0', '1']));
  });

  it('se enciende por donde has pasado, y queda a puntos por donde no', () => {
    const { container } = render(
      <LearnPath
        progress={tras([UNIT_ORDER[0]!])}
        plan="basico"
        day={HOY}
        active={null}
        onPick={vi.fn()}
      />,
    );

    const lineas = Array.from(container.querySelectorAll('line'));
    expect(lineas.some((linea) => linea.getAttribute('class') === 'stroke-brass')).toBe(true);
    expect(lineas.some((linea) => linea.hasAttribute('stroke-dasharray'))).toBe(true);
  });

  it('un tramo con una unidad hecha se pinta macizo', () => {
    const { container } = render(
      <LearnPath
        progress={tras([UNIT_ORDER[0]!, UNIT_ORDER[1]!])}
        plan="basico"
        day={HOY}
        active={null}
        onPick={vi.fn()}
      />,
    );

    expect(container.querySelector('line.stroke-tube')).not.toBeNull();
  });
});

/**
 * Cada nodo era una parada del tabulador —cuarenta y una, casi todas cerradas—
 * y pasar de largo del camino con el teclado era un viaje. Se tabula una vez y
 * se recorre con las flechas, como la rueda de quintas.
 */
describe('el camino con el teclado', () => {
  it('una sola parada de tabulador: la unidad que toca', () => {
    pintar();

    const nodos = screen.getAllByRole('button', { name: /bloqueada|superada|^[^,]+$/ });
    const paradas = nodos.filter((nodo) => nodo.tabIndex === 0);

    expect(paradas).toHaveLength(1);
    expect(paradas[0]).toHaveAccessibleName(nodo(UNIT_ORDER[0]!));
  });

  it('las flechas van de nodo en nodo, también entre cursos, e Inicio y Fin a los extremos', () => {
    pintar();
    const primera = screen.getByRole('button', { name: nodo(UNIT_ORDER[0]!) });
    primera.focus();

    fireEvent.keyDown(primera, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: nodo(UNIT_ORDER[1]!, 'bloqueada') })).toHaveFocus();

    const nodos = document.querySelectorAll('[data-nodo]');
    const ultima = nodos[nodos.length - 1]!;
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(ultima).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(ultima).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(primera).toHaveFocus();

    fireEvent.keyDown(primera, { key: 'ArrowUp' });
    expect(primera).toHaveFocus();
  });

  it('el último nodo enfocado se queda con la parada, para volver por donde se iba', () => {
    pintar();
    const primera = screen.getByRole('button', { name: nodo(UNIT_ORDER[0]!) });
    primera.focus();
    fireEvent.keyDown(primera, { key: 'ArrowRight' });

    const segunda = screen.getByRole('button', { name: nodo(UNIT_ORDER[1]!, 'bloqueada') });
    expect(segunda).toHaveFocus();
    expect(segunda.tabIndex).toBe(0);
    expect(primera.tabIndex).toBe(-1);
  });

  it('otra tecla, o el foco fuera de un nodo, no mueve nada', () => {
    pintar();
    const primera = screen.getByRole('button', { name: nodo(UNIT_ORDER[0]!) });
    primera.focus();

    fireEvent.keyDown(primera, { key: 'Enter' });
    expect(primera).toHaveFocus();

    primera.blur();
    fireEvent.keyDown(primera, { key: 'ArrowDown' });
    expect(primera).not.toHaveFocus();
  });
});
