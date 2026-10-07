// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { pitchClassFromName } from '@core/music';

import { EscalaMini } from './EscalaMini';

/**
 * La escala dibujada en pequeño.
 *
 * Era una línea de texto —«pentatónica menor de La»— que no dice nada a quien
 * todavía no se sabe las escalas de memoria; un dibujo de la forma sí. Lo que
 * hay que defender es lo de siempre: que quien **no** ve el dibujo tenga la
 * frase, y que la tónica se distinga sin depender del color.
 */
describe('la escala en pequeño', () => {
  it('se anuncia con su nombre y su tonica', () => {
    render(<EscalaMini tonic={pitchClassFromName('A')} scaleId="minorPentatonic" />);

    expect(screen.getByRole('img')).toHaveAccessibleName(
      /Pentatónica menor de A, en los cinco primeros trastes/i,
    );
  });

  // La tónica va más grande y rellena; el resto, más pequeña y apagada.
  it('la tonica se distingue por tamaño, no solo por color', () => {
    const { container } = render(
      <EscalaMini tonic={pitchClassFromName('A')} scaleId="minorPentatonic" />,
    );

    const radios = [...container.querySelectorAll('circle')].map((c) => c.getAttribute('r'));
    expect(new Set(radios).size).toBe(2);
    expect(radios).toContain('3.4');
    expect(radios).toContain('2.4');
  });

  // Y con bemoles el nombre se escribe con bemoles: es la armadura la que manda.
  it('el nombre se escribe con la alteracion que se le diga', () => {
    render(<EscalaMini tonic={pitchClassFromName('Bb')} scaleId="major" accidental="flat" />);

    expect(screen.getByRole('img')).toHaveAccessibleName(/de Bb/);
  });
});
