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

/**
 * La especie es parte del acorde: un `I` que pasa a `Imaj7` cambia aunque el grado
 * sea el mismo, y decir «se queda como estaba» sería mentir.
 */
describe('la especie', () => {
  it('un compas que solo cambia de especie se dice que cambia, con sus cifrados', () => {
    const conSeptima = paso({ especie: 'major7', symbol: 'Cmaj7', fromSymbol: 'C' });
    pintar({
      sections: [{ name: 'Única', yours: false, steps: [conSeptima] }],
      steps: [conSeptima],
    });

    expect(screen.getByText('Cmaj7')).toBeInTheDocument();
    expect(screen.getByText('C → Cmaj7')).toBeInTheDocument();
    expect(screen.getByTitle('Cambia respecto a lo que tocaste')).toBeInTheDocument();
  });

  it('el que la conserva se queda como estaba', () => {
    const igual = paso({
      especie: 'dominant7',
      symbol: 'G7',
      degree: 'V',
      from: 'V',
      fromSymbol: 'G7',
    });
    pintar({ sections: [{ name: 'Única', yours: false, steps: [igual] }], steps: [igual] });

    expect(screen.getByTitle('Se queda como estaba')).toHaveTextContent('G7');
  });
});

/**
 * Lo que dura también es el acorde: el V de un ii–V partido tiene el mismo grado, la
 * misma especie y el mismo cifrado, y suena la mitad. Se pintaba apagado y con «Se
 * queda como estaba».
 */
describe('lo que dura', () => {
  const II = paso({
    degree: 'ii',
    symbol: 'Dm',
    from: 'V',
    fromSymbol: 'G',
    beats: 2,
    fromBeats: 4,
    move: 'ii-v',
  });
  const V_PARTIDO = paso({
    degree: 'V',
    symbol: 'G',
    from: 'V',
    fromSymbol: 'G',
    beats: 2,
    fromBeats: 4,
    move: 'ii-v',
  });

  it('la mitad de la dominante partida cambia, y dice por que', () => {
    pintar(
      {
        sections: [{ name: 'Única', yours: false, steps: [TUYO, II, V_PARTIDO] }],
        steps: [TUYO, II, V_PARTIDO],
      },
      true,
      2,
    );

    const v = screen.getByTitle('Ahora dura la mitad: la otra mitad es su ii, que la prepara');
    expect(v).toHaveClass('superficie-viva');
    expect(v).toHaveTextContent('V · 4 → 2 pulsos');
    // Y sigue encendiéndose cuando suena.
    expect(v).toHaveAttribute('aria-current', 'true');
    // El ii cambia de grado, y lo cuenta el movimiento.
    expect(screen.getByText('V → ii')).toBeInTheDocument();
    // Lo único que se queda es el I de delante.
    expect(screen.getAllByTitle('Se queda como estaba')).toHaveLength(1);
  });

  it('sin movimiento, dice cuanto dura ahora', () => {
    const mitad = paso({ beats: 2, fromBeats: 4 });
    const doble = paso({ beats: 8, fromBeats: 4 });
    const otro = paso({ beats: 3, fromBeats: 4 });
    pintar({
      sections: [{ name: 'Única', yours: false, steps: [mitad, doble, otro] }],
      steps: [mitad, doble, otro],
    });

    expect(screen.getByTitle('Ahora dura la mitad que en lo que tocaste')).toHaveClass(
      'superficie-viva',
    );
    expect(screen.getByTitle('Ahora dura el doble que en lo que tocaste')).toHaveTextContent(
      'I · 4 → 8 pulsos',
    );
    expect(screen.getByTitle('Ahora dura 3 pulsos, y en lo que tocaste 4')).toBeInTheDocument();
  });

  it('un movimiento declarado es un cambio aunque no se vea en lo demas', () => {
    const conMovimiento = paso({ fromSymbol: 'C', fromBeats: 4, move: 'relativo' });
    pintar({
      sections: [{ name: 'Única', yours: false, steps: [conMovimiento] }],
      steps: [conMovimiento],
    });

    expect(
      screen.getByTitle(
        'Comparte dos de sus tres notas y hace el mismo papel: cambia el color sin cambiar la función.',
      ),
    ).toHaveClass('superficie-viva');
  });

  it('con lo mismo que duraba, se queda como estaba', () => {
    const igual = paso({ fromSymbol: 'C', fromBeats: 4 });
    pintar({ sections: [{ name: 'Única', yours: false, steps: [igual] }], steps: [igual] });

    expect(screen.getByTitle('Se queda como estaba')).toHaveClass('text-text-muted');
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

  /**
   * El reproductor cuenta los compases de la salida entera y cada parte numera
   * los suyos desde cero: comparándolos a pelo, con lo tuyo y un cierre detrás
   * se encendía el primero de las dos partes a la vez.
   */
  it('con varias partes se enciende el compas que suena, no el de la misma posicion', () => {
    pintar(
      {
        sections: [
          { name: 'Lo que llevas', yours: true, steps: [TUYO, CAMBIADO] },
          { name: 'Cierre', yours: false, steps: [NUEVO] },
        ],
        steps: [TUYO, CAMBIADO, NUEVO],
      },
      true,
      2,
    );

    const marcados = [...document.querySelectorAll('[aria-current="true"]')];
    expect(marcados).toHaveLength(1);
    expect(marcados[0]).toHaveTextContent('G');
  });

  it('quedarsela se puede pedir', async () => {
    const { onQuedarse } = pintar();

    await userEvent.click(screen.getByRole('button', { name: 'Quedarme con esta' }));

    expect(onQuedarse).toHaveBeenCalled();
  });
});
