// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ProgressionPlayer } from '@audio/progression-player';
import type { PitchClass, ScheduledStep } from '@core/music';
import { writtenBlock } from '@core/music';
import { useArrangementStore } from '@state/arrangement-store';
import { useSessionStore, type PathChord } from '@state/session-store';

import { CurrentChord, NextChords, Voicings } from './PathPanel';

/** Un reproductor que apunta lo que le mandan en vez de sonar. */
class ReproductorFalso implements ProgressionPlayer {
  sonadas: ScheduledStep[][] = [];
  paradas = 0;
  #avisar: ((index: number | null) => void) | null = null;

  async play(steps: readonly ScheduledStep[], onStep?: (index: number | null) => void) {
    this.sonadas.push([...steps]);
    this.#avisar = onStep ?? null;
  }
  stop() {
    this.paradas += 1;
  }
  async dispose() {}
  /** Lo que hace el reproductor de verdad al llegar al final. */
  terminar() {
    this.#avisar?.(null);
  }
  /** Y lo que hace al entrar en cada acorde. */
  vaPor(index: number) {
    this.#avisar?.(index);
  }
}

beforeEach(() => {
  useArrangementStore.setState({
    arrangement: { parts: [] },
    past: [],
    selectedBlockId: null,
  });
});

const AM: PathChord = {
  symbol: 'Am',
  label: 'i',
  root: 9,
  notes: [9, 0, 4],
  why: 'El primer grado.',
};

const G: PathChord = {
  symbol: 'G',
  label: 'bVII',
  root: 7,
  notes: [7, 11, 2],
  why: 'Baja un tono.',
};

function play(...chords: readonly PathChord[]): void {
  const { actions } = useSessionStore.getState();
  actions.pinKey({ tonic: 9, mode: 'minor' });
  for (const chord of chords) {
    actions.pushChord(chord);
  }
}

describe('El acorde actual', () => {
  it('pide una tonalidad antes que nada', () => {
    render(<CurrentChord />);

    expect(screen.getByText(/elige una tonalidad/i)).toBeInTheDocument();
  });

  it('enseña el acorde, sus notas y por qué está ahí', () => {
    play(AM);
    render(<CurrentChord />);

    // Sale dos veces: en grande arriba y como último paso de la progresión.
    expect(screen.getAllByText('Am')).toHaveLength(2);
    expect(screen.getByText('A · C · E')).toBeInTheDocument();
    expect(screen.getByText('El primer grado.')).toBeInTheDocument();
  });

  /**
   * Lo que faltaba, y lo que convertía esto en un catálogo.
   *
   * Se encadenaban cuatro acordes leyendo por qué pega cada uno con el anterior
   * y no había forma de oírlo sin coger la guitarra. La aplicación ya sabía
   * sonar progresiones en otros tres sitios; aquí no se le había pedido.
   */
  it('deja oír lo que llevas, con un acorde por cada dos pulsos', async () => {
    play(AM, G);
    const player = new ReproductorFalso();
    render(<CurrentChord createPlayer={() => player} />);

    await userEvent.click(screen.getByRole('button', { name: /escuchar lo que estás probando/i }));

    expect(player.sonadas).toHaveLength(1);
    expect(player.sonadas[0]).toHaveLength(2);
    expect(player.sonadas[0]![0]!.startMs).toBe(0);
    expect(player.sonadas[0]![1]!.startMs).toBeGreaterThan(0);
  });

  it('el mismo botón la calla: parar aparte obliga a apuntar a otro sitio', async () => {
    play(AM, G);
    const player = new ReproductorFalso();
    render(<CurrentChord createPlayer={() => player} />);

    await userEvent.click(screen.getByRole('button', { name: /escuchar lo que estás probando/i }));
    await userEvent.click(screen.getByRole('button', { name: /parar lo que estás probando/i }));

    expect(player.paradas).toBe(1);
    expect(
      screen.getByRole('button', { name: /escuchar lo que estás probando/i }),
    ).toBeInTheDocument();
  });

  it('sin progresión no hay nada que oír, y el botón no está', () => {
    useSessionStore.getState().actions.reset();
    useSessionStore.getState().actions.pinKey({ tonic: 9, mode: 'minor' });
    render(<CurrentChord />);

    expect(
      screen.queryByRole('button', { name: /escuchar lo que estás probando/i }),
    ).not.toBeInTheDocument();
  });

  /**
   * Y el botón **dice que corta**, que no es un detalle.
   *
   * Medían dieciséis por veinticuatro píxeles y se llamaban «Am»: en un teléfono
   * no se aciertan, y quien los acierta pierde la cola de la progresión sin
   * haber pedido nada. Quien no ve la pantalla oía la letra del acorde, que no
   * dice en ninguna parte que eso sea un botón de cortar.
   */
  it('recorta la progresión al pulsar un acorde anterior, y lo avisa', () => {
    play(AM, G);
    render(<CurrentChord />);

    fireEvent.click(screen.getByRole('button', { name: /cortar después de Am/i }));

    expect(useSessionStore.getState().path).toEqual([AM]);
  });

  it('el último no promete cortar nada, porque detrás no hay nada', () => {
    play(AM, G);
    render(<CurrentChord />);

    expect(screen.getByRole('button', { name: /^G, bVII, el último$/ })).toBeInTheDocument();
  });

  // El grado es el vocabulario que esta aplicación enseña, y en la tira sale
  // gratis decirlo: se lee el acorde y debajo qué papel hace.
  it('cada acorde lleva su grado debajo', () => {
    play(AM, G);
    render(<CurrentChord />);

    expect(screen.getByRole('button', { name: /cortar después de Am/i })).toHaveTextContent('i');
  });

  /**
   * El reproductor ya decía por qué acorde iba y aquí se tiraba ese aviso: solo
   * se miraba si había terminado. Mirar una progresión sonar sin ver dónde va es
   * la mitad de la gracia de poder oírla.
   */
  it('mientras suena, se enciende el acorde que va sonando', async () => {
    play(AM, G);
    const player = new ReproductorFalso();
    render(<CurrentChord createPlayer={() => player} />);
    await userEvent.click(screen.getByRole('button', { name: /escuchar lo que estás probando/i }));

    const segundo = screen.getByRole('button', { name: /^G, bVII, el último$/ });
    expect(segundo.className).not.toContain('bg-brass-dim/30');

    await act(async () => {
      player.vaPor(1);
    });

    expect(screen.getByRole('button', { name: /^G, bVII, el último$/ }).className).toContain(
      'bg-brass-dim/30',
    );
  });

  it('deja limpiar la progresión entera', () => {
    play(AM, G);
    render(<CurrentChord />);

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar lo que estás probando' }));

    expect(useSessionStore.getState().path).toEqual([]);
  });
});

describe('Por dónde empezar', () => {
  function startIn(tonic: PitchClass, mode: 'major' | 'minor'): void {
    const { actions } = useSessionStore.getState();
    actions.clearPath();
    actions.pinKey({ tonic, mode });
  }

  it('lo primero que propone son los tres tonales, no un disminuido', () => {
    startIn(0, 'major');
    render(<NextChords />);

    const options = screen.getAllByRole('button');
    // El rótulo lleva además qué pasa al pulsar —entra en la canción o solo se
    // prueba—, que son dos cosas distintas y la lista no puede hacerlas sin
    // avisar. Lo que se comprueba aquí es el orden.
    const first = options
      .slice(0, 3)
      .map((button) => button.getAttribute('aria-label')?.split('.')[0]);
    expect(first).toEqual(['C, I', 'F, IV', 'G, V']);
  });

  it('dice qué papel hace cada acorde', () => {
    startIn(0, 'major');
    render(<NextChords />);

    // El nombre entero, no la inicial: la letra sola no enseña nada.
    expect(screen.getAllByText('Dominante').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Subdominante').length).toBeGreaterThan(0);
  });

  it('explica por qué un acorde puede sustituir a otro', () => {
    startIn(0, 'major');
    render(<NextChords />);

    // El vi y el iii sustituyen los dos al I, así que hay más de uno.
    expect(screen.getAllByText(/Vale por I\./).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/relativo menor/i).length).toBeGreaterThan(0);
  });

  it('traduce las letras del papel ahí mismo', () => {
    startIn(0, 'major');
    render(<NextChords />);

    expect(screen.getByText('reposo')).toBeInTheDocument();
    expect(screen.getByText('salida')).toBeInTheDocument();
    expect(screen.getByText('tensión')).toBeInTheDocument();
  });
});

describe('Formas del acorde', () => {
  it('enseña varias maneras de hacerlo a lo largo del mástil', () => {
    play(AM);
    render(<Voicings />);

    const shapes = screen.getByRole('list', { name: /formas de hacer am/i });
    expect(shapes.children.length).toBeGreaterThan(1);
  });

  /**
   * Sin acorde no hay nada, **ni el rótulo**.
   *
   * Estuvo diciendo «Pulsa un acorde de la lista y aquí sale cómo se hace» justo
   * debajo de otro panel que ya decía lo mismo con otras palabras. Dos veces la
   * misma instrucción en una pantalla vacía no ayuda el doble: se lee como que
   * algo no ha cargado.
   */
  it('sin acorde elegido no enseña nada, ni su rótulo', () => {
    const { container } = render(<Voicings />);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Buscar un acorde a mano', () => {
  it('lo añade al camino con su nombre y sus notas', async () => {
    // Es la puerta para lo que el dominio no propone: un acorde prestado, uno
    // que has oído en un disco. Entra al camino igual que uno sugerido.
    const usuario = userEvent.setup();
    useSessionStore.getState().actions.reset();
    useSessionStore.getState().actions.pinKey({ tonic: 9, mode: 'minor' });
    render(<NextChords />);

    await usuario.type(screen.getByRole('combobox'), 'F');
    await usuario.keyboard('{Enter}');

    expect(useSessionStore.getState().path.at(-1)?.symbol).toBe('F');
  });
});

describe('Los colores de la forma', () => {
  it('un acorde con notas de fuera se marca distinto', () => {
    // El color va al lado de lo que significa: preguntarse qué era el ámbar y no
    // tenerlo delante es perder el hilo de lo que tocas.
    useSessionStore.getState().actions.reset();
    play(AM);
    render(<NextChords />);

    // La leyenda de los tres colores está en la pantalla, para poder leerla sin
    // salir de ella.
    expect(screen.getByText(/entra/i)).toBeInTheDocument();
  });
});

describe('Un acorde que no cabe en el mástil', () => {
  it('se dice, en vez de dejar el hueco vacío', () => {
    // Pasa con acordes de cinco notas muy abiertos: no hay forma con la
    // fundamental al bajo dentro de cuatro trastes.
    useSessionStore.getState().actions.reset();
    // Siete notas cromáticas seguidas: no hay forma con la fundamental al bajo
    // que quepa en cuatro trastes.
    play({
      symbol: 'Xraro',
      label: 'raro',
      root: 0,
      notes: [0, 1, 2, 3, 4, 5, 6] as PitchClass[],
      why: 'x',
    });

    render(<Voicings />);

    expect(screen.getByText(/No cabe en cuatro trastes/)).toBeInTheDocument();
  });
});

/**
 * Elegir un bloque de la canción manda sobre el camino.
 *
 * Es lo que arregla que componer tuviera dos progresiones a la vez: la canción
 * de verdad y el camino que se iba probando, cada una enseñando su acorde en
 * sitios distintos de la misma pantalla
 * ([adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).
 */
describe('el acorde elegido es el de la cancion', () => {
  /** Una canción en Do mayor con el IV elegido: un Fa. */
  function conElFaElegido(): void {
    const { actions } = useSessionStore.getState();
    actions.clearPath();
    actions.pinKey({ tonic: 0, mode: 'major' });
    useArrangementStore.setState({
      arrangement: {
        parts: [
          {
            id: 'estrofa',
            name: 'Estrofa',
            blocks: [writtenBlock('a', 'I', 4), writtenBlock('b', 'IV', 4)],
            notes: [],
            bars: 2,
          },
        ],
      },
      past: [],
      selectedBlockId: 'b',
    });
  }

  it('el mastil ensena las formas del bloque elegido, y lo dice', () => {
    conElFaElegido();
    // Y con algo en el camino, para que se vea cuál de los dos gana.
    useSessionStore.getState().actions.pushChord(AM);
    render(<Voicings />);

    expect(screen.getByText('En la canción')).toBeInTheDocument();
    // Las formas son las del Fa del bloque, no las del Am del camino.
    expect(screen.getByRole('list', { name: /formas de hacer f$/i })).toBeInTheDocument();
  });

  /**
   * Con un bloque elegido, «Elige el primer acorde» sobra: estaba saliendo justo
   * encima de las formas del acorde ya elegido, que es pedirle a alguien que
   * empiece lo que acaba de hacer.
   */
  it('no pide elegir el primer acorde si ya hay uno elegido en la cancion', () => {
    conElFaElegido();
    const { container } = render(<CurrentChord />);

    expect(screen.queryByText('Elige el primer acorde')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('las propuestas salen desde el bloque elegido', () => {
    conElFaElegido();
    render(<NextChords />);

    expect(screen.getByText('Desde F')).toBeInTheDocument();
  });

  // Un bloque que ya no está no puede seguir elegido: se vuelve al camino.
  it('si el bloque elegido desaparece, se vuelve al camino', () => {
    conElFaElegido();
    useSessionStore.getState().actions.pushChord(AM);
    useArrangementStore.setState({ arrangement: { parts: [] } });
    render(<Voicings />);

    expect(screen.getByText('Elegido')).toBeInTheDocument();
  });

  /**
   * Pinchar una propuesta con un bloque elegido es **irse a probar**, no
   * escribir: la lista ofrece especies —`Fmaj7`, `F5`— que un grado no sabe
   * guardar. Si no se soltara la elección, la lista se quedaría clavada.
   */
  it('pinchar una propuesta suelta lo elegido y sigue por el camino', async () => {
    conElFaElegido();
    render(<NextChords />);

    await userEvent.click(screen.getAllByRole('button')[1]!);

    expect(useArrangementStore.getState().selectedBlockId).toBeNull();
    expect(useSessionStore.getState().path).toHaveLength(1);
  });
});

/**
 * «A dónde ir» escribe en la canción, que es lo que decidió
 * [adr/0032](../../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md):
 * la lista ya está en su sitio y solo falta decir que sí.
 *
 * Y lo que **no cabe en un bloque** —un `F5` no tiene tercera, así que no tiene
 * grado— sigue el camino de siempre. Eso no es una limitación escondida: el
 * botón lo dice antes de pulsarlo.
 */
describe('poner lo propuesto en la cancion', () => {
  function enDoMayor(): void {
    const { actions } = useSessionStore.getState();
    actions.clearPath();
    actions.pinKey({ tonic: 0, mode: 'major' });
  }

  it('un acorde con grado entra en la cancion, con su septima', async () => {
    enDoMayor();
    const puestos: Array<[string, string | undefined]> = [];
    render(<NextChords onPoner={(degree, seventh) => puestos.push([degree, seventh])} />);

    await userEvent.click(screen.getByRole('button', { name: /^C, I\./ }));

    expect(puestos).toEqual([['I', undefined]]);
    // Y no se va al camino: ya está donde tenía que ir.
    expect(useSessionStore.getState().path).toEqual([]);
  });

  it('y el boton dice que va a entrar, antes de pulsarlo', () => {
    enDoMayor();
    render(<NextChords onPoner={() => {}} />);

    expect(
      screen.getByRole('button', { name: /^C, I\. Ponerlo en la canción/ }),
    ).toBeInTheDocument();
  });

  /**
   * Y el buscador escribe donde escribe la lista: si no, la misma área haría dos
   * cosas distintas según dónde pulsaras.
   */
  it('el buscador tambien escribe en la cancion', async () => {
    enDoMayor();
    const puestos: Array<[string, string | undefined]> = [];
    render(<NextChords onPoner={(degree, seventh) => puestos.push([degree, seventh])} />);

    await userEvent.type(screen.getByRole('combobox', { name: /Buscar un acorde/ }), 'Fmaj7');
    await userEvent.keyboard('{Enter}');

    expect(puestos).toEqual([['IV', 'major7']]);
  });

  // Sin sitio donde escribir, la lista hace lo de siempre: llevar al camino.
  it('sin donde escribir, sigue llevando al camino', async () => {
    enDoMayor();
    render(<NextChords />);

    await userEvent.click(screen.getByRole('button', { name: /^C, I\. Probarlo/ }));

    expect(useSessionStore.getState().path).toHaveLength(1);
  });
});

/**
 * La columna del acorde enseña **el bloque**, con su especie.
 *
 * Con el grado a secas enseñaba las formas de un `F` teniendo elegido un `F5`:
 * con su tercera, que es justo la nota que no se toca
 * ([adr/0035](../../../docs/adr/0035-un-bloque-sabe-que-no-lleva-tercera.md)).
 */
describe('el acorde elegido lleva su especie', () => {
  it('un bloque de quinta se enseña como quinta', () => {
    useSessionStore.getState().actions.pinKey({ tonic: 0, mode: 'major' });
    useArrangementStore.setState({
      arrangement: {
        parts: [
          {
            id: 'e',
            name: 'Riff',
            blocks: [writtenBlock('a', 'IV', 4, 'quinta')],
            notes: [],
            bars: 1,
          },
        ],
      },
      past: [],
      selectedBlockId: 'a',
    });

    render(<Voicings />);

    expect(screen.getByRole('list', { name: /formas de hacer f5/i })).toBeInTheDocument();
  });
});
