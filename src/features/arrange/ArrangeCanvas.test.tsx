// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { EMPTY_ARRANGEMENT, MAX_BARS, pitchClassFromName, type CapturedChord } from '@core/music';
import { useArrangementStore } from '@state/arrangement-store';
import { useSessionStore } from '@state/session-store';

import { ArrangeCanvas } from './ArrangeCanvas';

const C = pitchClassFromName('C');

beforeEach(() => {
  useArrangementStore.setState({ arrangement: EMPTY_ARRANGEMENT, past: [] });
  useSessionStore.getState().actions.reset();
});

/**
 * Las propuestas de acorde, por su lista y no por su sitio en el panel.
 *
 * Se pedían con `getAllByRole('button')` sobre el panel entero y el índice, así
 * que en cuanto el panel gana algo arriba —la barra de lo elegido, por ejemplo—
 * el `[0]` pasa a ser otro botón y media docena de pruebas se rompen sin que
 * nada esté mal.
 */
function propuestas() {
  return within(screen.getByRole('list', { name: 'Acordes que pueden seguir' })).getAllByRole(
    'button',
  );
}

function conTonalidad() {
  useSessionStore.getState().actions.pinKey({ tonic: C, mode: 'major' });
}

/**
 * Pasa a la tira de bloques.
 *
 * La partitura es lo que se ve por defecto, y hay gestos que solo existen ahí
 * —arrastrar un bloque, estirarlo por el borde, el teclado sobre él—. Estas
 * pruebas van de eso, así que cambian de vista primero.
 */
async function enBloques() {
  await userEvent.click(screen.getByRole('button', { name: 'Bloques' }));
}

/** Los bloques de una parte, en la tira. */
function tiraDe(parte: string) {
  return within(screen.getByRole('list', { name: `Acordes de ${parte}` })).getAllByRole('button');
}

/**
 * Los cifrados de una parte, en orden y **se vean como se vean**.
 *
 * Los mismos acordes se dibujan como una tira de bloques o como cifrados encima
 * de un pentagrama, y una prueba sobre poner acordes no debería tener que saber
 * cuál de las dos está puesta. Lo que las dos comparten es la etiqueta de cada
 * acorde, así que se busca por ahí.
 */
function acordesDe(parte: string): string[] {
  const seccion = screen.getByRole('region', { name: parte });
  return within(seccion)
    .queryAllByLabelText(/, grado /)
    .map((nodo) => nodo.getAttribute('aria-label')?.split(',')[0] ?? '');
}

describe('sin tonalidad', () => {
  it('no enseña el lienzo, dice qué falta', () => {
    render(<ArrangeCanvas />);
    expect(screen.getByText(/Empieza eligiendo la tonalidad/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Escuchar la canción/ })).not.toBeInTheDocument();
  });
});

describe('montar', () => {
  it('el primer acorde crea la primera parte', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    expect(screen.getByText(/La canción está en blanco/)).toBeInTheDocument();
    await userEvent.click(propuestas()[0]!);

    expect(acordesDe('Estrofa')).toEqual(['C']);
  });

  /**
   * El hueco del final dice que la canción sigue.
   *
   * Con una sola parte quedaban quinientos píxeles de negro debajo del
   * pentagrama, y ese vacío no decía ni que una canción se hace de partes ni que
   * se pueden añadir. El botón existía, pero arriba en la barra y entre otros
   * seis. Con la canción en blanco no sale: entonces lo que falta es el primer
   * acorde, no la segunda parte, y ya lo dice el estado vacío.
   */
  it('con la canción empezada, se puede añadir otra parte desde el final', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    expect(screen.queryByRole('button', { name: /añadir otra parte/i })).not.toBeInTheDocument();

    await userEvent.click(propuestas()[0]!);
    await userEvent.click(screen.getByRole('button', { name: /añadir otra parte/i }));

    // La parte nueva sale con su nombre, y pasa a ser la de destino.
    expect(screen.getByRole('button', { name: 'Parte 2' })).toBeInTheDocument();
  });

  // Es lo que hace que se pueda encadenar sin elegir parte antes de cada acorde.
  it('los acordes siguientes van a la misma parte', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    for (let i = 0; i < 3; i += 1) {
      await userEvent.click(propuestas()[0]!);
    }
    expect(acordesDe('Estrofa')).toHaveLength(3);
  });

  // Se crea una parte para meter cosas en ella. Sin esto, los acordes seguían
  // cayendo en la anterior y la nueva se quedaba vacía.
  it('una parte nueva se lleva los acordes que se pulsen después', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    await userEvent.click(propuestas()[0]!);
    await userEvent.click(screen.getByRole('button', { name: '+ Parte' }));
    await userEvent.click(propuestas()[0]!);

    expect(acordesDe('Estrofa')).toHaveLength(1);
    expect(acordesDe('Parte 2')).toHaveLength(1);
  });

  it('lo que se propone sale del último acorde puesto', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    expect(screen.getByRole('heading', { name: /Para empezar/ })).toBeInTheDocument();
    await userEvent.click(propuestas()[0]!);
    expect(screen.getByRole('heading', { name: /Después de Estrofa/ })).toBeInTheDocument();
  });
});

describe('el teclado, que es lo que un arrastre no da', () => {
  async function conDosAcordes() {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(propuestas()[0]!);
    await userEvent.click(propuestas()[1]!);
    await enBloques();
  }

  it('las flechas mueven el bloque de sitio', async () => {
    await conDosAcordes();
    const antes = acordesDe('Estrofa');

    const primero = tiraDe('Estrofa')[0]!;
    primero.focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(acordesDe('Estrofa')).toEqual([antes[1], antes[0]]);
  });

  it('con Shift, las flechas estiran', async () => {
    await conDosAcordes();
    const primero = tiraDe('Estrofa')[0]!;
    primero.focus();
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');

    expect(tiraDe('Estrofa')[0]!.getAttribute('aria-label')).toMatch(/5 pulsos/);
  });

  it('Supr quita el bloque', async () => {
    await conDosAcordes();
    const primero = tiraDe('Estrofa')[0]!;
    primero.focus();
    await userEvent.keyboard('{Delete}');

    expect(acordesDe('Estrofa')).toHaveLength(1);
  });
});

describe('deshacer', () => {
  it('empieza apagado y se enciende al hacer algo', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
    await userEvent.click(propuestas()[0]!);
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeEnabled();
  });

  it('quita el último acorde puesto', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(propuestas()[0]!);
    await userEvent.click(propuestas()[0]!);

    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(acordesDe('Estrofa')).toHaveLength(1);
  });
});

describe('lo grabado', () => {
  it('no se ofrece si no se ha grabado nada', () => {
    conTonalidad();
    render(<ArrangeCanvas />);
    expect(screen.queryByRole('button', { name: 'Traer lo grabado' })).not.toBeInTheDocument();
  });

  /**
   * El puente que faltaba: el motor ya medía cuánto duraba cada acorde y eso solo
   * servía para pedirle salidas a la IA. Aquí cae como una parte más, y **con sus
   * duraciones**, que es lo que `capturedDegrees` tiraba para poder guardar.
   */
  it('entra como una parte, con los compases que ocupaba de verdad', async () => {
    conTonalidad();
    const acciones = useSessionStore.getState().actions;
    acciones.setTempo(120, 4);
    acciones.startCapture(0);
    // Do dos compases y Sol uno, a 120 bpm: 500 ms el pulso.
    acciones.replaceCapture([
      { root: C, notes: [0, 4, 7], at: 0 },
      { root: 7, notes: [7, 11, 2], at: 4000 },
    ]);
    acciones.stopCapture(6000);

    render(<ArrangeCanvas />);
    await userEvent.click(screen.getByRole('button', { name: 'Traer lo grabado' }));
    await enBloques();

    const bloques = tiraDe('Lo que has tocado');
    expect(bloques[0]).toHaveAttribute('aria-label', expect.stringContaining('8 pulsos'));
    expect(bloques[1]).toHaveAttribute('aria-label', expect.stringContaining('4 pulsos'));
  });
});

describe('escribir un acorde', () => {
  it('lo que se teclea se convierte en el grado que le toca', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    await userEvent.type(screen.getByLabelText('Escribe un acorde'), 'G');
    await userEvent.click(screen.getByRole('button', { name: 'G' }));

    expect(acordesDe('Estrofa')).toEqual(['G']);
  });

  /**
   * Una cuatríada entra como cuatríada, y la tríada sigue estando al lado.
   *
   * Antes no: el bloque solo sabía guardar el grado, un grado es una tríada, y
   * las cuatro especies de la misma fundamental se agrupaban en un botón que
   * ponía «Am». Escribir `Am7` metía un `Am` y la séptima se caía sin decirlo.
   * Ahora el bloque guarda además la especie, así que las dos son cosas
   * distintas que se pueden poner.
   */
  it('una cuatríada entra como cuatríada', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    await userEvent.type(screen.getByLabelText('Escribe un acorde'), 'Am7');
    await userEvent.click(screen.getByRole('button', { name: 'Am7' }));

    expect(acordesDe('Estrofa')).toEqual(['Am7']);
  });

  /** Y la tríada sigue siendo otra cosa que se puede poner, con el mismo grado. */
  it('la tríada del mismo grado entra aparte', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    await userEvent.type(screen.getByLabelText('Escribe un acorde'), 'Am');
    await userEvent.click(screen.getByRole('button', { name: 'Am' }));

    expect(acordesDe('Estrofa')).toEqual(['Am']);
  });

  /**
   * Un acorde que no es ninguno de los grados del modo no se puede guardar, y se
   * dice en vez de dejarlo escrito en un campo que no hace nada.
   *
   * Se prueba con Fa sostenido y no con Do sostenido, que era lo primero que se
   * escribió: **el Do sostenido sí cabe en Do mayor**, porque el catálogo de
   * grados tiene el napolitano y `bII` es justo ese. Con la fundamental en Fa
   * sostenido no hay ningún grado, ni mayor ni menor.
   */
  it('lo que no cabe en la tonalidad no se puede poner', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    await userEvent.type(screen.getByLabelText('Escribe un acorde'), 'F#');

    expect(screen.getByRole('button', { name: 'F#' })).toBeDisabled();
    // El aviso lo parte React en varios nodos, así que se busca por el trozo
    // que va entero en uno.
    expect(screen.getByText(/Ninguno de esos es un grado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'F#' })).toHaveAttribute(
      'title',
      expect.stringContaining('no es un grado de C mayor'),
    );
  });
});

describe('el punteo', () => {
  async function conAcordes() {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(propuestas()[0]!);
  }

  // La partitura es lo que se ve al entrar: es donde se escribe, y esconderla
  // detrás de un conmutador la convertía en un extra.
  it('la partitura es lo primero que se ve', async () => {
    await conAcordes();
    expect(screen.getByRole('img', { name: /Partitura de Estrofa/ })).toBeInTheDocument();
  });

  // En partitura los acordes se leen encima del pentagrama. Una tira de cajas
  // repitiendo lo mismo justo encima sería decirlo dos veces.
  it('en partitura no hay además una tira de bloques', async () => {
    await conAcordes();
    expect(screen.queryByRole('list', { name: 'Acordes de Estrofa' })).not.toBeInTheDocument();
  });

  it('en bloques se ve la rejilla y los acordes siguen en su tira', async () => {
    await conAcordes();
    await enBloques();

    expect(screen.getByRole('list', { name: 'Acordes de Estrofa' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Escribir / }).length).toBeGreaterThan(0);
  });

  /**
   * La casilla de «solo la escala» es la que separa la interfaz de quien sabe de
   * la de quien no: encendida, no hay una sola casilla que suene mal.
   */
  it('solo la escala ofrece menos filas que las doce', async () => {
    await conAcordes();
    await enBloques();

    const conEscala = screen.getAllByRole('button', { name: /^Escribir / }).length;
    await userEvent.click(screen.getByRole('button', { name: 'Solo la escala' }));
    const cromatico = screen.getAllByRole('button', { name: /^Escribir / }).length;

    expect(cromatico).toBeGreaterThan(conEscala);
  });

  it('pulsar una casilla escribe la nota', async () => {
    await conAcordes();
    await enBloques();
    await userEvent.click(screen.getAllByRole('button', { name: /^Escribir / })[0]!);

    expect(screen.getAllByRole('button', { name: /en el pulso/ }).length).toBe(1);
  });
});

describe('las dos vistas del punteo enseñan lo mismo', () => {
  /**
   * Con «solo la escala» puesta, una nota alterada no tiene fila donde
   * dibujarse. Se queda donde está —quitarla sería borrar trabajo por haber
   * cambiado de vista— y se avisa: escribir una nota y no verla parece que se ha
   * perdido.
   */
  it('avisa de las notas que no caben en la rejilla', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(propuestas()[0]!);

    // Una nota de la escala y otra alterada, escritas por debajo de la interfaz.
    const parte = useArrangementStore.getState().arrangement.parts[0]!;
    const acciones = useArrangementStore.getState().actions;
    acciones.addNote(parte.id, 0, 0, 1);
    acciones.addNote(parte.id, 1, 1, 1);

    await enBloques();
    expect(screen.getByText(/no es de la escala/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Solo la escala' }));
    expect(screen.queryByText(/no es de la escala/)).not.toBeInTheDocument();
  });
});

describe('lo que se oyó, y lo que no', () => {
  /** Deja en el estado una grabación con un acorde dudoso y otro de fuera. */
  function grabacion(chords: readonly CapturedChord[]) {
    const acciones = useSessionStore.getState().actions;
    acciones.setTempo(120, 4);
    acciones.startCapture(0);
    acciones.replaceCapture(chords);
    acciones.stopCapture(8000);
  }

  const triada = (root: number, tercera: number) =>
    [root, (root + tercera) % 12, (root + 7) % 12] as never;

  /**
   * Lo dudoso llega marcado hasta el bloque, que es lo que permite preguntarlo.
   * Antes el margen se calculaba, se emitía y se tiraba en el estado de sesión.
   */
  it('un acorde oído con poco margen sale marcado', async () => {
    conTonalidad();
    grabacion([
      { root: 0, notes: triada(0, 4), at: 0, margin: 0.01, alternatives: [] },
      { root: 7, notes: triada(7, 4), at: 4000, margin: 0.5, alternatives: [] },
    ]);

    render(<ArrangeCanvas />);
    await userEvent.click(screen.getByRole('button', { name: 'Traer lo grabado' }));
    await enBloques();

    const bloques = tiraDe('Lo que has tocado');
    expect(bloques[0]).toHaveAttribute('aria-label', expect.stringContaining('dudoso'));
    expect(bloques[1]).not.toHaveAttribute('aria-label', expect.stringContaining('dudoso'));
  });

  /**
   * Un acorde que no cabe en la tonalidad es casi siempre que la tonalidad
   * detectada está mal. Antes era un contador que nadie veía y el compás
   * desaparecía sin más.
   */
  it('lo que no cabe en la tonalidad se cuenta, con su cifrado', async () => {
    conTonalidad();
    grabacion([
      { root: 0, notes: triada(0, 4), at: 0, margin: 0.5, alternatives: [] },
      // Fa sostenido menor: no es ningún grado de Do mayor.
      { root: 6, notes: triada(6, 3), at: 4000, margin: 0.5, alternatives: [] },
    ]);

    render(<ArrangeCanvas />);
    await userEvent.click(screen.getByRole('button', { name: 'Traer lo grabado' }));

    expect(screen.getByText(/no cabe en C mayor: F#m/)).toBeInTheDocument();
    expect(screen.getByText(/cambiar la tonalidad/)).toBeInTheDocument();
  });

  // Corregir es elegir entre lo que el motor de verdad consideró, no entre los
  // doce acordes de la tonalidad.
  it('un bloque dudoso ofrece lo que también pudo ser', async () => {
    conTonalidad();
    grabacion([
      {
        root: 0,
        notes: triada(0, 4),
        at: 0,
        margin: 0.01,
        alternatives: [{ root: 9, notes: triada(9, 3) }],
      },
    ]);

    render(<ArrangeCanvas />);
    await userEvent.click(screen.getByRole('button', { name: 'Traer lo grabado' }));
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Lo que has tocado' })).getAllByLabelText(
        /, grado /,
      )[0]!,
    );

    expect(screen.getByRole('heading', { name: /No lo oí claro/ })).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Corregir el acorde' })).getByRole('button', {
        name: /^Am/,
      }),
    );

    expect(acordesDe('Lo que has tocado')).toEqual(['Am']);
    expect(screen.queryByRole('heading', { name: /No lo oí claro/ })).not.toBeInTheDocument();
  });

  // Si el motor dudó y acertó, decírselo tiene que dejar de preguntar.
  it('se puede dar por bueno lo que se oyó', async () => {
    conTonalidad();
    grabacion([
      {
        root: 0,
        notes: triada(0, 4),
        at: 0,
        margin: 0.01,
        alternatives: [{ root: 9, notes: triada(9, 3) }],
      },
    ]);

    render(<ArrangeCanvas />);
    await userEvent.click(screen.getByRole('button', { name: 'Traer lo grabado' }));
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Lo que has tocado' })).getAllByLabelText(
        /, grado /,
      )[0]!,
    );
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Corregir el acorde' })).getByRole('button', {
        name: 'Estaba bien',
      }),
    );

    expect(acordesDe('Lo que has tocado')).toEqual(['C']);
    expect(screen.queryByRole('heading', { name: /No lo oí claro/ })).not.toBeInTheDocument();
  });
});

describe('apuntar lo que se toca', () => {
  /**
   * Apuntar acordes lo hace el motor de croma en el propio equipo: no cuesta IA
   * ni gasta cupo. Estaba solo en el panel de Salidas, que va con plan Pro, y eso
   * dejaba «Traer lo grabado» sin nada que traer para quien no paga.
   */
  it('se puede apuntar sin cuenta y sin plan', async () => {
    conTonalidad();
    useSessionStore.getState().actions.setListening('listening');
    render(<ArrangeCanvas />);

    await userEvent.click(screen.getByRole('button', { name: 'Apuntar lo que toco' }));
    expect(useSessionStore.getState().capturing).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Parar de apuntar' }));
    expect(useSessionStore.getState().capturing).toBe(false);
  });

  // Sin el micro abierto no llega un acorde, y el botón sería una promesa que no
  // se puede cumplir.
  it('no se ofrece con el micro cerrado', () => {
    conTonalidad();
    render(<ArrangeCanvas />);
    expect(screen.queryByRole('button', { name: /Apuntar lo que toco/ })).not.toBeInTheDocument();
  });
});

describe('escribir un acorde donde estás', () => {
  /**
   * Con una partitura delante, elegir un compás y escribir un acorde solo puede
   * significar «aquí». Meterlo al final obligaría a escribirlo y arrastrarlo
   * después, que son dos gestos para una cosa.
   */
  it('el acorde entra detrás del que esté elegido', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    await userEvent.click(propuestas()[0]!); // C
    await userEvent.click(propuestas()[0]!); // el siguiente
    const dos = acordesDe('Estrofa');

    // Se elige el primero y se escribe: tiene que quedar en medio.
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Estrofa' })).getAllByLabelText(/, grado /)[0]!,
    );
    await userEvent.type(screen.getByLabelText('Escribe un acorde'), 'G');
    await userEvent.click(screen.getByRole('button', { name: 'G' }));

    expect(acordesDe('Estrofa')).toEqual([dos[0], 'G', dos[1]]);
  });

  // Escribiendo seguido, cada acorde queda elegido y el siguiente entra detrás:
  // se encadena sin tener que apuntar a nada.
  it('escribiendo seguido, se encadenan en orden', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    for (let i = 0; i < 3; i += 1) {
      await userEvent.click(propuestas()[0]!);
    }
    expect(acordesDe('Estrofa')).toHaveLength(3);
  });
});

describe('el refuerzo de qué nota puede seguir', () => {
  async function conUnAcorde() {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(propuestas()[0]!);
  }

  it('se ofrece siempre que hay una parte, sin cambiar de vista', async () => {
    await conUnAcorde();
    expect(screen.getByRole('region', { name: 'Qué nota puede seguir' })).toBeInTheDocument();
  });

  it('pulsar una nota la escribe en la partitura', async () => {
    await conUnAcorde();
    const notas = within(screen.getByRole('region', { name: 'Qué nota puede seguir' }));
    await userEvent.click(notas.getAllByRole('button')[0]!);

    expect(
      within(screen.getByRole('region', { name: 'Estrofa' })).getAllByLabelText(/en el pulso/),
    ).toHaveLength(1);
  });

  /**
   * Lo que puede seguir no depende solo de la escala, sino sobre todo del acorde
   * que hay debajo. Sin eso, la propuesta sería la misma en toda la canción.
   */
  it('lo que se ofrece cambia con la nota anterior', async () => {
    await conUnAcorde();
    const region = () => within(screen.getByRole('region', { name: 'Qué nota puede seguir' }));

    const antes = region()
      .getAllByRole('button')
      .map((b) => b.textContent);
    await userEvent.click(region().getAllByRole('button')[0]!);
    const despues = region()
      .getAllByRole('button')
      .map((b) => b.textContent);

    expect(despues).not.toEqual(antes);
  });

  // El vocabulario de la aplicación, también aquí: cada nota dice qué hace.
  it('cada nota lleva su porqué', async () => {
    await conUnAcorde();
    const primera = within(
      screen.getByRole('region', { name: 'Qué nota puede seguir' }),
    ).getAllByRole('button')[0]!;
    expect(primera.getAttribute('aria-label')).toMatch(/acorde|paso|escala/i);
  });
});

describe('el punteo grabado', () => {
  /**
   * La otra mitad de grabar: los acordes ya caían en el lienzo y las notas
   * sueltas no, aunque el motor de tono las viniera midiendo desde el principio.
   */
  it('lo punteado entra en la partitura como notas', async () => {
    conTonalidad();
    const acciones = useSessionStore.getState().actions;
    acciones.setTempo(120, 4);
    acciones.setListening('listening');
    acciones.startCapture(0);
    // Do, re y mi, una negra cada una a 120 bpm.
    for (const [i, midi] of [60, 62, 64].entries()) {
      acciones.setPitch(440 * 2 ** ((midi - 69) / 12), 0.9, i * 500);
    }
    acciones.stopCapture(1500);

    render(<ArrangeCanvas />);
    await userEvent.click(screen.getByRole('button', { name: 'Traer lo grabado' }));

    const notas = within(
      screen.getByRole('region', { name: 'Lo que has tocado' }),
    ).getAllByLabelText(/en el pulso/);
    expect(notas).toHaveLength(3);
    expect(notas[0]?.getAttribute('aria-label')).toMatch(/^C4/);
    expect(notas[2]?.getAttribute('aria-label')).toMatch(/^E4/);
  });

  it('lo dice al traerlo', async () => {
    conTonalidad();
    const acciones = useSessionStore.getState().actions;
    acciones.setTempo(120, 4);
    acciones.startCapture(0);
    acciones.setPitch(440, 0.9, 0);
    acciones.stopCapture(1000);

    render(<ArrangeCanvas />);
    await userEvent.click(screen.getByRole('button', { name: 'Traer lo grabado' }));
    expect(screen.getByText(/He apuntado 1 nota de punteo/)).toBeInTheDocument();
  });
});

describe('la longitud de la partitura', () => {
  async function conUnaParte() {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(screen.getByRole('button', { name: '+ Parte' }));
  }

  /**
   * Antes, la única manera de hacer sitio para escribir en el compás cuatro era
   * rellenar antes los tres primeros: al revés de como se escribe música, donde
   * primero hay papel y luego se llena.
   */
  /** El campo donde se leen y se escriben los compases de una parte. */
  function compases(parte = 'Parte 1'): HTMLInputElement {
    return screen.getByRole('spinbutton', { name: `Compases de ${parte}` });
  }

  it('una parte nueva ya trae compases donde escribir', async () => {
    await conUnaParte();
    expect(screen.getByRole('img', { name: /Partitura de Parte 1/ })).toBeInTheDocument();
    expect(compases()).toHaveValue(4);
  });

  it('el más y el menos van de uno en uno', async () => {
    // De dos en dos el número saltaba distinto según lo que hubiera escrito
    // dentro, porque el tope de abajo recortaba el salto a la mitad.
    await conUnaParte();

    await userEvent.click(screen.getByRole('button', { name: 'Alargar Parte 1' }));
    expect(compases()).toHaveValue(5);

    await userEvent.click(screen.getByRole('button', { name: 'Alargar Parte 1' }));
    expect(compases()).toHaveValue(6);

    await userEvent.click(screen.getByRole('button', { name: 'Acortar Parte 1' }));
    expect(compases()).toHaveValue(5);
  });

  it('y el número se escribe, para no pulsar doce veces', async () => {
    await conUnaParte();

    await userEvent.clear(compases());
    await userEvent.type(compases(), '10');
    await userEvent.tab();

    expect(compases()).toHaveValue(10);
  });

  it('lo que se teclea se acota al salir, no a cada tecla', async () => {
    // Acotando a cada tecla, borrar el campo para escribir «10» lo dejaba en el
    // mínimo al primer dígito y el segundo ya no entraba.
    await conUnaParte();

    await userEvent.clear(compases());
    await userEvent.type(compases(), '99');
    await userEvent.tab();

    expect(compases()).toHaveValue(MAX_BARS);
  });

  // Un botón que borra compases con acordes dentro borra trabajo sin decirlo.
  it('el menos se apaga al llegar a lo que hay escrito, y dice por qué', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);
    // Cinco acordes de un compás: la parte ocupa cinco y no se puede bajar.
    for (let i = 0; i < 5; i += 1) {
      await userEvent.click(propuestas()[0]!);
    }

    const menos = screen.getByRole('button', { name: 'Acortar Estrofa' });
    expect(menos).toBeDisabled();
    expect(menos).toHaveAttribute('title', expect.stringContaining('sin borrar'));
  });
});

describe('quitar lo que has puesto', () => {
  async function conAcordeYNota() {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(propuestas()[0]!);
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Qué nota puede seguir' })).getAllByRole(
        'button',
      )[0]!,
    );
  }

  const quitar = async () =>
    userEvent.click(
      within(screen.getByRole('region', { name: 'Lo elegido' })).getByRole('button', {
        name: /^Quitar/,
      }),
    );

  const notasDe = (parte: string) =>
    within(screen.getByRole('region', { name: parte })).queryAllByLabelText(/en el pulso/);

  /**
   * Borrar se podía **solo con el teclado** —`Supr` sobre el elemento enfocado—
   * y en un teléfono no hay teclado que valga: lo que se ponía no se podía
   * quitar. Es medio editor.
   */
  it('una nota se quita pulsando, sin teclado', async () => {
    await conAcordeYNota();
    expect(notasDe('Estrofa')).toHaveLength(1);

    await quitar();
    expect(notasDe('Estrofa')).toHaveLength(0);
  });

  it('un acorde también', async () => {
    await conAcordeYNota();
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Estrofa' })).getAllByLabelText(/, grado /)[0]!,
    );

    await quitar();
    expect(acordesDe('Estrofa')).toHaveLength(0);
  });

  /**
   * Uno y solo uno. Eran dos estados sueltos y podían estar los dos puestos a la
   * vez, así que «quitar lo elegido» no tenía respuesta.
   */
  it('elegir un acorde suelta la nota que hubiera elegida', async () => {
    await conAcordeYNota();
    // Con la nota recién puesta, lo elegido es la nota.
    expect(screen.getByRole('region', { name: 'Lo elegido' }).textContent).toMatch(/pulso/);

    await userEvent.click(
      within(screen.getByRole('region', { name: 'Estrofa' })).getAllByLabelText(/, grado /)[0]!,
    );
    expect(screen.getByRole('region', { name: 'Lo elegido' }).textContent).toMatch(/compás/);
  });

  it('sin nada elegido no hay nada que quitar', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);
    expect(screen.queryByRole('region', { name: 'Lo elegido' })).not.toBeInTheDocument();
  });

  // Quitar es un cambio como otro cualquiera: se deshace.
  it('lo quitado se puede deshacer', async () => {
    await conAcordeYNota();
    await quitar();
    await userEvent.click(screen.getByRole('button', { name: 'Deshacer' }));

    expect(notasDe('Estrofa')).toHaveLength(1);
  });
});
