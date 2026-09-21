// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BADGES, EMPTY_PROGRESS } from '@core/music';

import { Badges } from './Badges';

/**
 * Las medallas, las que se tienen y las que faltan.
 *
 * Se enseñan todas y no solo las conseguidas: una lista de lo que falta es lo
 * que dice por dónde se puede seguir. Lo que separa una de otra es el punto
 * —lleno cuando está, hueco cuando falta— y no solo el color.
 */
describe('la lista de medallas', () => {
  it('estan todas, tenidas y por tener', () => {
    render(<Badges progress={EMPTY_PROGRESS} />);

    for (const badge of BADGES) {
      expect(screen.getByText(badge.name)).toBeInTheDocument();
    }
  });

  it('la que se tiene se distingue de la que falta', () => {
    const primera = BADGES[0]!;
    const { container } = render(<Badges progress={{ ...EMPTY_PROGRESS, badges: [primera.id] }} />);

    const puntos = [...container.querySelectorAll('[aria-hidden]')];
    // Una llena y el resto huecas: el punto lo dice sin depender del color.
    expect(puntos.filter((p) => p.className.includes('bg-brass-bright'))).toHaveLength(1);
    expect(puntos.filter((p) => p.className.includes('border'))).toHaveLength(BADGES.length - 1);
  });
});
