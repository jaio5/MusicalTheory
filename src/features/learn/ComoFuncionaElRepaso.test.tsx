// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EMPTY_PROGRESS, findUnit, MASTERED_HITS, REVIEW_LIMIT, UNIT_ORDER } from '@core/music';

import { ComoFuncionaElRepaso, LaColaDeHoy } from './ComoFuncionaElRepaso';

/**
 * Lo que acompaña al repaso. Sus cifras salen de `core/music/review.ts`, y se
 * prueba que salgan de ahí: si la cola cambia de reglas, esta explicación no
 * puede seguir contando las de antes.
 */
describe('como funciona el repaso', () => {
  it('cuenta los tres pasos con las cifras de la cola', () => {
    render(<ComoFuncionaElRepaso />);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(`Acertada ${MASTERED_HITS} veces seguidas, sale`)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`caben ${REVIEW_LIMIT}`))).toBeInTheDocument();
  });
});

describe('lo que vuelve hoy', () => {
  const [PRIMERA, SEGUNDA] = [UNIT_ORDER[0]!, UNIT_ORDER[1]!];
  const apunte = (unitId: string, index: number) => ({
    unitId,
    index,
    seenOn: '2020-01-01',
    hits: 0,
  });

  it('junta la cola por unidad, en singular y en plural', () => {
    render(
      <LaColaDeHoy
        progress={{
          ...EMPTY_PROGRESS,
          review: [apunte(PRIMERA, 0), apunte(PRIMERA, 1), apunte(SEGUNDA, 0)],
        }}
        day="2020-01-02"
      />,
    );

    expect(screen.getByText(findUnit(PRIMERA)!.unit.title)).toBeInTheDocument();
    expect(screen.getByText('2 preguntas')).toBeInTheDocument();
    expect(screen.getByText('1 pregunta')).toBeInTheDocument();
  });

  it('con la cola vacia, o sin dia todavia, no pinta nada', () => {
    const { container, rerender } = render(
      <LaColaDeHoy progress={EMPTY_PROGRESS} day="2020-01-02" />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <LaColaDeHoy progress={{ ...EMPTY_PROGRESS, review: [apunte(PRIMERA, 0)] }} day={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
