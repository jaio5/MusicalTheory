// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, render, screen, waitFor } from '@testing-library/react';
import { Profiler } from 'react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AudioInput, AudioInputState } from '@audio/audio-input';
import type { PitchEngine } from '@audio/pitch-engine';
import { useClaqueta } from '@state/claqueta';
import { useSessionStore } from '@state/session-store';

import { MicButton } from './MicButton';

/**
 * El botón de escuchar.
 *
 * Redondo y grande, como el de grabar de la cámara del móvil: se entiende sin
 * leer nada. Y por eso mismo **el nombre accesible tiene que decirlo con
 * palabras**, que es lo único que oye quien no ve el círculo rojo. Es lo que se
 * prueba aquí, junto con lo otro que no se ve mirando el componente: que la nota
 * que suena vive dentro del propio botón, y no en un segundo sitio de la barra.
 */

class EntradaFalsa implements AudioInput {
  state: AudioInputState = 'idle';
  readonly sampleRate = 48_000;
  readonly frameSize = 2048;
  readonly spectrumSize = 8192;
  error = null;
  readonly #oyentes = new Set<(estado: AudioInputState) => void>();

  async start(): Promise<void> {
    this.#pasar('running');
  }
  async stop(): Promise<void> {
    this.#pasar('idle');
  }
  readTimeDomain(): boolean {
    return true;
  }
  readSpectrum(): boolean {
    return true;
  }
  // Avisa de verdad: el botón traduce el estado del dispositivo al de la
  // interfaz, y sin aviso se quedaría siempre en «pidiendo permiso».
  subscribe(oyente: (estado: AudioInputState) => void): () => void {
    this.#oyentes.add(oyente);
    return () => this.#oyentes.delete(oyente);
  }

  #pasar(estado: AudioInputState): void {
    this.state = estado;
    for (const oyente of this.#oyentes) {
      oyente(estado);
    }
  }
}

class MotorCallado implements PitchEngine {
  readonly options = {} as PitchEngine['options'];
  running = false;
  async start(): Promise<void> {
    this.running = true;
  }
  stop(): void {
    this.running = false;
  }
  subscribe(): () => void {
    return () => {};
  }
  subscribeLevel(): () => void {
    return () => {};
  }
}

function pintar() {
  // La misma entrada en todas las llamadas: el micro es uno.
  const entrada = new EntradaFalsa();
  return render(<MicButton createInput={() => entrada} createEngine={() => new MotorCallado()} />);
}

beforeEach(() => {
  useSessionStore.getState().actions.reset();
});

describe('el boton de escuchar', () => {
  it('parado, invita a escuchar y lo dice con palabras', () => {
    pintar();

    const boton = screen.getByRole('button', { name: /escuchar la guitarra/i });
    expect(boton).toHaveAccessibleName('Escuchar la guitarra');
    expect(boton).toHaveAttribute('aria-pressed', 'false');
  });

  it('al pulsarlo escucha, y el nombre cambia a lo contrario', async () => {
    pintar();

    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /escuchar la guitarra/i })).toHaveAccessibleName(
        'Dejar de escuchar la guitarra',
      ),
    );
    expect(screen.getByRole('button', { name: /escuchar la guitarra/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('y al volver a pulsarlo, para', async () => {
    pintar();

    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /escuchar la guitarra/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /escuchar la guitarra/i })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );
  });

  /**
   * Apagado, esto es **un botón y nada más**.
   *
   * Estuvo al revés: un hueco fijo con un guion y el rótulo «sin escuchar»
   * debajo, en la esquina más cara de la pantalla y esté pasando algo o no. En la
   * cabecera de una aplicación que se usa con la guitarra puesta, media franja
   * izquierda reservada a decir que no pasa nada es sitio robado a lo que sí
   * pasa. Lo que se prueba es que ese hueco ya no existe.
   */
  it('apagado no reserva sitio para una lectura que no hay', () => {
    pintar();

    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(screen.queryByText('esperando')).not.toBeInTheDocument();
  });

  it('la nota que suena sale al lado del boton en cuanto se escucha', async () => {
    useSessionStore.setState({
      reading: { name: 'A', pitchClass: 9, octave: 2, cents: -7, frequency: 110, midi: 45 },
      hasSignal: true,
    });

    pintar();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    expect(await screen.findByText('A2')).toBeInTheDocument();
    expect(screen.getByText('-7¢')).toBeInTheDocument();
  });

  it('una desviacion hacia arriba lleva su signo', async () => {
    useSessionStore.setState({
      reading: { name: 'A', pitchClass: 9, octave: 2, cents: 12, frequency: 111, midi: 45 },
      hasSignal: true,
    });

    pintar();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    expect(await screen.findByText('+12¢')).toBeInTheDocument();
  });

  /**
   * Rasgueando no hay nota que enganchar, y decir «esperando» es decir lo
   * contrario de lo que pasa.
   *
   * El motor de tono es monofónico: con un acorde sonando no saca ninguna nota,
   * o saca un parcial grave —un `G2` con un Fa sonando—. La pastilla se quedaba
   * en «— esperando» con el micro en verde y la aplicación apuntando acordes en
   * la canción, y va dentro de un `aria-live`: a quien no ve la pantalla se le
   * anunciaba que no llegaba nada justo mientras llegaba.
   */
  it('con un acorde sonando dice el acorde, no que espera', async () => {
    useSessionStore.setState({
      heardChord: {
        symbol: 'Am',
        root: 9,
        notes: [9, 0, 4],
        score: 0.9,
        margin: 0.3,
        alternatives: [],
        at: 0,
      },
    });

    pintar();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    expect(await screen.findByText('Am')).toBeInTheDocument();
    expect(screen.getByText('acorde')).toBeInTheDocument();
    expect(screen.queryByText('esperando')).not.toBeInTheDocument();
  });

  /** Y donde no se escuchan acordes —el afinador— manda la nota, como siempre. */
  it('sin acorde que reconocer, la nota sigue mandando', async () => {
    useSessionStore.setState({
      reading: { name: 'G', pitchClass: 7, octave: 3, cents: 3, frequency: 196, midi: 55 },
      hasSignal: true,
      heardChord: null,
    });

    pintar();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    expect(await screen.findByText('G3')).toBeInTheDocument();
    expect(screen.getByText('+3¢')).toBeInTheDocument();
  });

  it('un problema con el micro se anuncia, no se traga', () => {
    // Va con `role="alert"`: quien esté mirando el mástil y no el botón tiene que
    // enterarse de que no se le está oyendo.
    useSessionStore.setState({ message: 'Has denegado el acceso al micrófono.' });

    pintar();

    expect(screen.getByRole('alert')).toHaveTextContent(/denegado/);
  });
});

/**
 * La pastilla en una barra estrecha.
 *
 * A 390, durante una toma, la pastilla se metía debajo del botón del tema. Lo que
 * cabe se mide en un navegador (la sonda del skill `arrancar`); aquí se fija lo
 * que lo hace caber, que jsdom no sabe medir: la marca que mira la barra y el
 * rótulo que se calla sin dejar de leerse.
 */
describe('la pastilla en una barra estrecha', () => {
  it('se deja ver desde la barra, para que el nombre de la marca le haga sitio', async () => {
    pintar();
    expect(document.querySelector('[data-lectura]')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    expect(await screen.findByText('esperando')).toBeInTheDocument();
    expect(screen.getByText('esperando').closest('[data-lectura]')).not.toBeNull();
  });

  it('el rotulo se calla donde se calla la marca, pero se sigue leyendo', async () => {
    pintar();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    const rotulo = await screen.findByText('esperando');
    expect(rotulo).toHaveClass('md:max-lg:sr-only', '@max-[26rem]:sr-only');
    // Dentro de la región viva: callado a la vista, no al oído.
    expect(rotulo.closest('[aria-live]')).not.toBeNull();
    // Solo «pidiendo permiso» se calla antes, que es el largo.
    expect(rotulo).not.toHaveClass('@max-[30rem]:sr-only');
  });
});

/**
 * **Cambiar de acorde no mueve la barra.** La pastilla va pegada a la derecha y
 * crecía de «C» a «Bbmaj7»: el botón del micro se iba diez píxeles a un lado y
 * volvía a cada cambio (medido en una toma, en el navegador). Lo que lo impide
 * es el sitio guardado, que jsdom no sabe medir: aquí se fija la regla.
 */
describe('la pastilla no se mueve al cambiar lo que dice', () => {
  it('la lectura y el rótulo guardan el sitio del más largo', async () => {
    pintar();
    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    expect(await screen.findByText('esperando')).toHaveClass('min-w-[9ch]');
    expect(screen.getByText('—')).toHaveClass('min-w-[6ch]', 'font-mono');
  });
});

describe('mientras se pide el micro', () => {
  /**
   * Entre pulsar y que el navegador conteste pasa un rato, y en ese rato hay que
   * decir qué se está esperando: «esperando» a secas parece que ya está abierto
   * y que no se oye nada.
   */
  it('se dice que se esta pidiendo permiso', async () => {
    class EntradaLenta extends EntradaFalsa {
      override async start(): Promise<void> {
        // No contesta nunca: es el rato entre pulsar y que el navegador decida.
        await new Promise(() => {});
      }
    }
    render(
      <MicButton createInput={() => new EntradaLenta()} createEngine={() => new MotorCallado()} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /escuchar la guitarra/i }));

    expect(await screen.findByText('pidiendo permiso')).toBeInTheDocument();
    // Es el rótulo más largo, y en una barra estrecha se calla antes que los otros.
    expect(screen.getByText('pidiendo permiso')).toHaveClass('@max-[30rem]:sr-only');
  });

  /**
   * **No se apaga, y el foco se queda en él.** Con `disabled` mientras el
   * navegador preguntaba, el foco caía al `<body>` justo después de pulsarlo con
   * Intro. Ahora se marca `aria-disabled` y otro clic no pide el micro dos veces.
   */
  it('mientras pregunta no suelta el foco ni pide dos veces', async () => {
    let pedidas = 0;
    class EntradaLenta extends EntradaFalsa {
      override async start(): Promise<void> {
        pedidas += 1;
        await new Promise(() => {});
      }
    }
    const entrada = new EntradaLenta();
    render(<MicButton createInput={() => entrada} createEngine={() => new MotorCallado()} />);
    const boton = screen.getByRole('button', { name: /escuchar la guitarra/i });

    boton.focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByText('pidiendo permiso');
    await userEvent.click(boton);

    expect(boton).toHaveFocus();
    expect(boton).not.toBeDisabled();
    expect(boton).toHaveAttribute('aria-disabled', 'true');
    expect(pedidas).toBe(1);
  });
});

/**
 * Lo que se anuncia, y cuándo se calla.
 *
 * La pastilla vive en una región viva para que quien no ve la pantalla oiga la
 * respuesta a lo que toca. Pero hay dos sitios donde hablar estorba: **durante la
 * toma**, donde lo que importa es el clic (adr/0072), y **en el afinador**, que
 * ya tiene su propia región y la nota se oía dos veces.
 */
describe('lo que anuncia el boton', () => {
  function region(): HTMLElement {
    return screen.getByText('A2').closest('[aria-live]') as HTMLElement;
  }

  beforeEach(() => {
    useClaqueta.setState({ enLaToma: false });
    useSessionStore.getState().actions.setListening('listening');
    useSessionStore.setState({
      reading: { name: 'A', pitchClass: 9, octave: 2, cents: 0, frequency: 110, midi: 45 },
      hasSignal: true,
    });
  });

  it('fuera de la toma, la nota se anuncia', () => {
    render(<MicButton />);

    expect(region()).toHaveAttribute('aria-live', 'polite');
  });

  it('durante la toma se calla, y vuelve a hablar al acabar', () => {
    useClaqueta.setState({ enLaToma: true });
    render(<MicButton />);

    expect(region()).toHaveAttribute('aria-live', 'off');
    // Se sigue viendo: lo que se calla es el anuncio, no la pastilla.
    expect(screen.getByText('A2')).toBeVisible();

    act(() => useClaqueta.setState({ enLaToma: false }));
    expect(region()).toHaveAttribute('aria-live', 'polite');
  });

  it('donde otro ya lo anuncia, se calla', () => {
    render(<MicButton anuncia={false} />);

    expect(region()).toHaveAttribute('aria-live', 'off');
  });
});

/**
 * **Solo repinta cuando cambia lo que escribe.** El botón está en la barra de
 * todas las pantallas y la lectura llega nueva veinte veces por segundo: suscrito
 * al objeto entero, se repintaba a ese ritmo para escribir la misma nota.
 */
describe('lo que repinta el boton', () => {
  beforeEach(() => {
    useSessionStore.getState().actions.reset();
  });

  it('la misma nota con el mismo cent no lo repinta', () => {
    useSessionStore.getState().actions.setListening('listening');
    let pintadas = 0;
    render(
      <Profiler id="boton" onRender={() => (pintadas += 1)}>
        <MicButton />
      </Profiler>,
    );
    const { actions } = useSessionStore.getState();
    act(() => actions.setPitch(440.05, 0.95, 0));
    const conLaNota = pintadas;
    expect(screen.getByText('A4')).toBeInTheDocument();

    // Dentro del mismo cent: 440,05 Hz y 440,1 Hz se escriben los dos «+0¢».
    for (let at = 50; at <= 500; at += 50) {
      act(() => actions.setPitch(440.1, 0.95, at));
    }
    expect(pintadas).toBe(conLaNota);

    act(() => actions.setPitch(445, 0.95, 550));
    expect(pintadas).toBe(conLaNota + 1);
  });
});
