// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Salida } from './Salida';
import type { Version, VersionStepOut } from './contract';

/**
 * Una salida, pintada.
 *
 * Lo que hay que defender aquí es **qué separa una salida de otra**: por dónde
 * ha tirado, qué compases cambian respecto a lo que tocaste y cuáles son nuevos.
 * Sin eso, tres propuestas parecen tres caprichos.
 */
function paso(extra: Partial<VersionStepOut> = {}): VersionStepOut {
  return { degree: 'I', beats: 4, symbol: 'C', from: 'I', move: null, ...extra };
}

const TUYO = paso();
const CAMBIADO = paso({ degree: 'vi', symbol: 'Am', from: 'I', move: 'relativo' });
/** Uno que cambia sin declarar movimiento: se dice igual, sin inventarle uno. */
const CAMBIADO_SIN_MOVIMIENTO = paso({ degree: 'IV', symbol: 'F', from: 'I' });
const NUEVO = paso({ degree: 'V', symbol: 'G', from: null });

function pintar(version: Partial<Version> = {}, suena = false, compas: number | null = null) {
  const onEscuchar = vi.fn();
  const onQuedarse = vi.fn();
  render(
    <ul>
      <Salida
        version={{
          title: 'La relativa',
          why: 'Cambia el color sin cambiar de sitio.',
          path: 'rearmonizar',
          sections: [{ name: 'Lo que llevas', yours: true, steps: [TUYO] }],
          steps: [TUYO],
          ...version,
        }}
        suena={suena}
        compas={compas}
        onEscuchar={onEscuchar}
        onQuedarse={onQuedarse}
      />
    </ul>,
  );
  return { onEscuchar, onQuedarse };
}

describe('lo que se lee de una salida', () => {
  it('lleva su titulo y por donde ha tirado', () => {
    pintar();

    expect(screen.getByRole('heading', { name: 'La relativa' })).toBeInTheDocument();
    // El nombre del camino, no su identificador.
    expect(screen.getByText('Los mismos compases, otros acordes')).toBeInTheDocument();
    expect(screen.queryByText('rearmonizar')).not.toBeInTheDocument();
  });

  /**
   * El nombre de la parte solo se pinta con más de una: con una sola sería un
   * rótulo de adorno encima de lo mismo de siempre.
   */
  it('con una sola parte no se pone su nombre', () => {
    pintar();

    expect(screen.queryByText('Lo que llevas')).not.toBeInTheDocument();
  });

  it('con varias, cada una lleva el suyo, y se dice cual tocaste tu', () => {
    pintar({
      sections: [
        { name: 'Lo que llevas', yours: true, steps: [TUYO] },
        { name: 'Cierre', yours: false, steps: [NUEVO] },
      ],
      steps: [TUYO, NUEVO],
    });

    expect(screen.getByText('Lo que llevas')).toBeInTheDocument();
    expect(screen.getByText('Cierre')).toBeInTheDocument();
    expect(screen.getByText(/lo que tocaste/)).toBeInTheDocument();
  });

  /**
   * Y cada compás dice qué le pasa: el que no cambia se queda apagado, el que
   * cambia enseña de dónde viene y con qué movimiento, y el nuevo se marca.
   */
  it('cada compas dice si se queda, si cambia o si es nuevo', () => {
    pintar({
      sections: [{ name: 'Única', yours: false, steps: [TUYO, CAMBIADO, NUEVO] }],
      steps: [TUYO, CAMBIADO, NUEVO],
    });

    expect(screen.getByText('I → vi')).toBeInTheDocument();
    // Y el movimiento se nombra, con su porqué en el título.
    expect(screen.getByText('Su relativo')).toBeInTheDocument();
    expect(screen.getByText('nuevo')).toBeInTheDocument();
    expect(screen.getByTitle('Se queda como estaba')).toBeInTheDocument();
    expect(screen.getByTitle('Compás nuevo: no estaba en lo que tocaste')).toBeInTheDocument();
  });
});

describe('escucharla y quedarsela', () => {
  it('el boton de escuchar lo dice, y al sonar pasa a parar', async () => {
    const { onEscuchar } = pintar();
    await userEvent.click(screen.getByRole('button', { name: 'Escuchar' }));
    expect(onEscuchar).toHaveBeenCalled();

    pintar({ title: 'Otra' }, true, 0);
    expect(screen.getByRole('button', { name: 'Parar' })).toBeInTheDocument();
  });

  // Un compás que cambia sin movimiento declarado se dice igual, sin inventarlo.
  it('un cambio sin movimiento no se inventa uno', () => {
    pintar({
      sections: [{ name: 'Única', yours: false, steps: [CAMBIADO_SIN_MOVIMIENTO] }],
      steps: [CAMBIADO_SIN_MOVIMIENTO],
    });

    expect(screen.getByTitle('Cambia respecto a lo que tocaste')).toBeInTheDocument();
  });

  // Y el compás que va sonando se marca, para poder seguirla con la vista.
  it('el compas que suena se marca', () => {
    pintar(
      {
        sections: [{ name: 'Única', yours: false, steps: [TUYO, CAMBIADO] }],
        steps: [TUYO, CAMBIADO],
      },
      true,
      1,
    );

    const marcados = [...document.querySelectorAll('[aria-current="true"]')];
    expect(marcados).toHaveLength(1);
    expect(marcados[0]).toHaveTextContent('Am');
  });

  it('quedarsela se puede pedir', async () => {
    const { onQuedarse } = pintar();

    await userEvent.click(screen.getByRole('button', { name: 'Quedarme con esta' }));

    expect(onQuedarse).toHaveBeenCalled();
  });
});
