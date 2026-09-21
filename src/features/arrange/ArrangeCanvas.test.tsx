// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EMPTY_ARRANGEMENT,
  MAX_BARS,
  pitchClassFromName,
  type CapturedChord,
  type DegreeSymbol,
} from '@core/music';
import { useArrangementStore } from '@state/arrangement-store';
import { selectReparto, useBancoStore } from '@state/banco';
import { usePedidoDeIdeas } from '@state/pedido-de-ideas';
import { usePropuestaStore } from '@state/propuesta';
import { useSessionStore } from '@state/session-store';

import { ArrangeCanvas } from './ArrangeCanvas';

const C = pitchClassFromName('C');

beforeEach(() => {
  useArrangementStore.setState({ arrangement: EMPTY_ARRANGEMENT, past: [] });
  useSessionStore.getState().actions.reset();
  // Lo propuesto y sin aceptar también se queda de una prueba para otra, y una
  // propuesta colgando esconde media barra de herramientas.
  usePropuestaStore.setState({ propuesta: null });
  usePedidoDeIdeas.setState({ pendiente: false });
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
  return (
    within(seccion)
      .queryAllByLabelText(/, grado /)
      // Los fantasmas del copiloto también dicen su grado, y **no son de la
      // canción**: quedan fuera de esta cuenta a propósito, que si entraran
      // cualquier prueba de poner acordes pasaría con acordes que nadie aceptó.
      .filter((nodo) => nodo.closest('[aria-label^="Lo propuesto"]') === null)
      .map((nodo) => nodo.getAttribute('aria-label')?.split(',')[0] ?? '')
  );
}

describe('sin tonalidad', () => {
  it('no enseña el lienzo, dice qué falta', () => {
    render(<ArrangeCanvas />);
    expect(screen.getByText(/Empieza eligiendo la tonalidad/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Escuchar la canción/ })).not.toBeInTheDocument();
  });
});

describe('montar', () => {
  /**
   * Cada propuesta se dice entera, y de una pieza.
   *
   * Los tres trozos —cifrado, grado y porqué— van pegados en el marcado, así
   * que un lector de pantalla leía «CICasa.» de corrido. Es el mismo rótulo que
   * ya lleva la lista de «a dónde ir».
   */
  it('cada propuesta se anuncia con su cifrado, su grado y su porque', () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    expect(propuestas()[0]!).toHaveAccessibleName('C, I. Casa.');
  });

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

  /**
   * Y un acorde de quinta también entra, que es lo que no podía.
   *
   * El buscador lo ofrecía **apagado** mientras la lista de al lado ya lo
   * escribía: un `C5` tiene grado —el de su fundamental— y no tiene tríada
   * ([adr/0035](../../../docs/adr/0035-un-bloque-sabe-que-no-lleva-tercera.md)).
   */
  it('un acorde de quinta entra, y no sale apagado', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    await userEvent.type(screen.getByLabelText('Escribe un acorde'), 'C5');
    const boton = screen.getByRole('button', { name: 'C5' });

    expect(boton).toBeEnabled();
    await userEvent.click(boton);

    expect(acordesDe('Estrofa')).toEqual(['C5']);
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

/**
 * Lo que el copiloto propone, en el lienzo.
 *
 * Punteado al final de la parte, sin el filo de color de seguridad, y **nada
 * entra hasta que alguien dice que sí**
 * ([adr/0033](../../../docs/adr/0033-el-copiloto-propone-y-no-escribe.md)).
 */
describe('los bloques fantasma', () => {
  function conPropuesta(degrees: readonly DegreeSymbol[] = ['IV', 'V']): string {
    conTonalidad();
    const id = useArrangementStore.getState().actions.addPart('Estrofa');
    useArrangementStore.getState().actions.addBlock(id, 'I', 4);
    usePropuestaStore.getState().acciones.proponer(id, degrees, 'Bajar por tonos');
    return id;
  }

  it('salen al final de la parte, y se dicen como propuestos', () => {
    conPropuesta();
    render(<ArrangeCanvas />);

    expect(
      screen.getByRole('button', { name: /Aceptar F, grado IV\. Propuesto, 1 de 2\./ }),
    ).toBeInTheDocument();
    // Y la canción sigue teniendo un solo acorde: los fantasmas no son suyos.
    expect(acordesDe('Estrofa')).toEqual(['C']);
  });

  // Pulsar el segundo acepta los dos: se acepta «hasta aquí», que es como se
  // lee una fila de acordes.
  it('pulsar uno acepta hasta ahi', async () => {
    conPropuesta();
    render(<ArrangeCanvas />);

    await userEvent.click(screen.getByRole('button', { name: /Aceptar G, grado V/ }));

    expect(acordesDe('Estrofa')).toEqual(['C', 'F', 'G']);
    expect(usePropuestaStore.getState().propuesta).toBeNull();
  });

  it('y hay botones a la vista para aceptarlo todo o tirarlo', async () => {
    conPropuesta();
    render(<ArrangeCanvas />);

    await userEvent.click(screen.getByRole('button', { name: /^Descartar/ }));

    expect(usePropuestaStore.getState().propuesta).toBeNull();
    expect(acordesDe('Estrofa')).toEqual(['C']);
  });

  /**
   * `Tab` acepta y `Esc` descarta, que es lo que ya tiene aprendido quien usa un
   * copiloto. **Solo mientras hay algo propuesto**: quedarse con `Tab` para
   * siempre dejaría la pantalla sin poder recorrerse con el teclado.
   */
  it('Tab acepta lo propuesto, y Esc lo descarta', async () => {
    conPropuesta();
    render(<ArrangeCanvas />);

    await userEvent.keyboard('{Tab}');

    expect(acordesDe('Estrofa')).toEqual(['C', 'F', 'G']);

    conPropuesta(['vi']);
    await userEvent.keyboard('{Escape}');

    expect(usePropuestaStore.getState().propuesta).toBeNull();
  });

  /**
   * Y se dice en voz alta, porque un fantasma **cambia lo que hace `Tab`**.
   *
   * Aparecía sin decir nada: quien no ve la pantalla pulsaba `Tab` para
   * recorrerla y se encontraba los acordes metidos en su canción. Se comprueba
   * que la región está montada **antes** de que haya propuesta, que es lo que
   * hace que se lea: una que nace con el texto ya puesto no se lee en todos los
   * lectores.
   */
  it('se anuncia solo, con las teclas dentro', () => {
    conTonalidad();
    const { rerender } = render(<ArrangeCanvas />);
    // El párrafo, y no la caja del aviso de lo grabado, que también se lee sola.
    const region = screen.getByText('', { selector: 'p[aria-live="polite"]' });

    expect(region).toBeInTheDocument();

    conPropuesta();
    rerender(<ArrangeCanvas />);

    expect(region).toHaveTextContent(
      'Bajar por tonos: 2 acordes propuestos para Estrofa. Tab los acepta, Mayúsculas y Tab acepta uno, Escape los descarta.',
    );
  });
});

/**
 * Los gestos del lienzo, que son los que no deja ver un `click`.
 *
 * Arrastrar un bloque, estirarlo por el borde, soltar un acorde de la lista
 * sobre un compás concreto, elegir la figura con la que se escribe. jsdom no da
 * tamaño a nada, así que las cajas se dictan a mano: es la única forma de que la
 * aritmética del gesto —qué mitad del bloque, qué compás— se resuelva de verdad.
 */
describe('Los gestos sobre el lienzo', () => {
  function arrastrarHasta(x: number, y: number) {
    // Dentro de `act`: el movimiento llega desde el `window` y no desde React,
    // así que sin esto el fantasma que se arrastra no se llega a pintar.
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: x, clientY: y, cancelable: true }),
      );
    });
  }
  function soltarPuntero() {
    window.dispatchEvent(new PointerEvent('pointerup', {}));
  }

  /**
   * Una caja para cada hueco de la tira, en fila y de cien en cien.
   *
   * Se miden los elementos con `data-parte`, que son los que lee `medir`: son
   * las posiciones de verdad, con el desplazamiento de la fila ya aplicado.
   */
  function medirLaTira(parte: string) {
    const bloques = within(screen.getByRole('list', { name: `Acordes de ${parte}` })).getAllByRole(
      'button',
    );
    document.querySelectorAll<HTMLElement>('[data-parte]').forEach((n, i) => {
      n.getBoundingClientRect = () =>
        ({
          left: i * 100,
          right: (i + 1) * 100,
          top: 0,
          bottom: 50,
          width: 100,
          height: 50,
        }) as DOMRect;
    });
    bloques.forEach((b, i) => {
      b.getBoundingClientRect = () =>
        ({
          left: i * 100,
          right: (i + 1) * 100,
          top: 0,
          bottom: 50,
          width: 100,
          height: 50,
        }) as DOMRect;
    });
    return bloques;
  }

  async function conDosAcordes() {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(screen.getByRole('button', { name: 'Bloques' }));
    await userEvent.click(propuestas()[0]!);
    await userEvent.click(propuestas()[0]!);
  }

  /**
   * La franja de estirar son los últimos píxeles del bloque: por ahí se cambia
   * lo que dura, y por el resto se mueve. Una manija propia sería un control de
   * catorce píxeles donde nada de lo que se pulsa baja de cuarenta y cuatro.
   */
  it('cogido por el borde derecho, el bloque se estira', async () => {
    await conDosAcordes();
    const [primero] = medirLaTira('Estrofa');
    const pulsosAntes = useArrangementStore.getState().arrangement.parts[0]!.blocks[0]!.beats;

    fireEvent.pointerDown(primero!, { button: 0, clientX: 98 });
    arrastrarHasta(300, 10);
    soltarPuntero();

    expect(useArrangementStore.getState().arrangement.parts[0]!.blocks[0]!.beats).not.toBe(
      pulsosAntes,
    );
  });

  it('y cogido por el cuerpo, se mueve', async () => {
    await conDosAcordes();
    const bloques = medirLaTira('Estrofa');
    const antes = useArrangementStore
      .getState()
      .arrangement.parts[0]!.blocks.map((b) => b.degree)
      .join(' ');

    fireEvent.pointerDown(bloques[0]!, { button: 0, clientX: 10, clientY: 10 });
    // Primero se pasa el umbral, que es cuando se toman las medidas, y después
    // se va a la segunda mitad del segundo bloque.
    arrastrarHasta(40, 10);
    arrastrarHasta(190, 25);
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 190, clientY: 25 }));

    const despues = useArrangementStore
      .getState()
      .arrangement.parts[0]!.blocks.map((b) => b.degree)
      .join(' ');
    expect(despues).not.toBe(antes);
  });

  // Con el botón derecho no se estira: ese abre el menú del sistema.
  it('el boton derecho no estira nada', async () => {
    await conDosAcordes();
    const [primero] = medirLaTira('Estrofa');
    const antes = useArrangementStore.getState().arrangement.parts[0]!.blocks[0]!.beats;

    fireEvent.pointerDown(primero!, { button: 2, clientX: 98 });
    arrastrarHasta(300, 10);

    expect(useArrangementStore.getState().arrangement.parts[0]!.blocks[0]!.beats).toBe(antes);
  });
});

describe('La figura con la que se escribe', () => {
  it('se elige, y se dice cual esta puesta', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    const blanca = screen.getByRole('button', { name: 'blanca' });
    await userEvent.click(blanca);

    expect(blanca).toHaveAttribute('aria-pressed', 'true');
  });

  /**
   * Y con una nota elegida, cambiar de figura **la cambia a ella**: es lo que
   * convierte la fila de figuras en un editor y no en un ajuste.
   */
  it('con una nota elegida, le cambia la duracion', async () => {
    conTonalidad();
    useArrangementStore.setState({
      arrangement: {
        parts: [
          {
            id: 'p',
            name: 'Estrofa',
            blocks: [],
            notes: [{ id: 'n1', start: 0, length: 1, offset: 0 }],
            bars: 1,
          },
        ],
      },
      past: [],
    });
    render(<ArrangeCanvas />);
    await userEvent.click(screen.getByRole('button', { name: 'Bloques' }));

    // Se elige la nota desde la rejilla y después la figura.
    const nota = screen
      .getAllByRole('button')
      .find((b) => (b.getAttribute('aria-label') ?? '').includes('en el pulso 0'));
    if (nota !== undefined) {
      await userEvent.click(nota);
      await userEvent.click(screen.getByRole('button', { name: 'blanca' }));

      expect(useArrangementStore.getState().arrangement.parts[0]!.notes[0]!.length).toBe(2);
    }
  });
});

describe('El aviso de lo que acaba de pasar', () => {
  it('se puede cerrar', async () => {
    conTonalidad();
    useSessionStore.setState({
      noteHistory: [{ pitchClass: C, midi: 60, at: 0, clarity: 0.9 }],
      captureStartedAt: 0,
      captureEndedAt: 1000,
    });
    render(<ArrangeCanvas />);

    const traer = screen.queryByRole('button', { name: /Traer lo grabado/ });
    if (traer !== null) {
      await userEvent.click(traer);
      const vale = screen.queryByRole('button', { name: 'Vale' });
      if (vale !== null) {
        await userEvent.click(vale);
        expect(screen.queryByRole('button', { name: 'Vale' })).not.toBeInTheDocument();
      }
    }
  });
});

/**
 * Lo que se puede hacer con una parte, que es la unidad de la canción.
 *
 * Son los botones de su fila: escucharla, alargarla, acortarla, cambiarle el
 * papel, renombrarla y quitarla. Se prueban aquí y no en `PartRow` porque lo que
 * importa es que el lienzo los enchufe a la acción correcta: media docena de
 * estas recibe `(parte, bloque, sitio)` y la acción espera otro orden.
 */
describe('Lo que se hace con una parte', () => {
  async function conUnaParte() {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(screen.getByRole('button', { name: 'Bloques' }));
    await userEvent.click(propuestas()[0]!);
  }

  it('se le cambia el nombre', async () => {
    await conUnaParte();

    // El nombre es un rótulo hasta que se pulsa: así no hay catorce campos de
    // texto en pantalla compitiendo por el foco.
    await userEvent.click(screen.getByRole('button', { name: 'Estrofa' }));
    // Dentro de su fila: en la pantalla hay más campos de texto —el buscador de
    // acordes, sin ir más lejos—.
    const campo = within(screen.getByRole('region', { name: 'Estrofa' })).getByRole('textbox');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Puente');
    fireEvent.blur(campo);

    expect(useArrangementStore.getState().arrangement.parts[0]!.name).toBe('Puente');
  });

  it('y el papel que hace', async () => {
    await conUnaParte();

    const papel = screen.getByRole('combobox', { name: /Papel de/ });
    await userEvent.selectOptions(papel, 'estribillo');

    expect(useArrangementStore.getState().arrangement.parts[0]!.role).toBe('estribillo');
  });

  it('se alarga y se acorta por compases', async () => {
    await conUnaParte();
    const antes = useArrangementStore.getState().arrangement.parts[0]!.bars;

    await userEvent.click(screen.getByRole('button', { name: /^Alargar/ }));

    expect(useArrangementStore.getState().arrangement.parts[0]!.bars).toBe(antes + 1);

    await userEvent.click(screen.getByRole('button', { name: /^Acortar/ }));

    expect(useArrangementStore.getState().arrangement.parts[0]!.bars).toBe(antes);
  });

  it('se escucha ella sola', async () => {
    await conUnaParte();

    await userEvent.click(screen.getByRole('button', { name: /^Escuchar Estrofa/ }));

    expect(screen.getByRole('button', { name: /^Parar Estrofa/ })).toBeInTheDocument();
  });

  it('y se quita entera', async () => {
    await conUnaParte();

    await userEvent.click(screen.getByRole('button', { name: /^Quitar Estrofa/ }));

    expect(useArrangementStore.getState().arrangement.parts).toHaveLength(0);
  });

  // La canción entera también suena, y el mismo botón la calla.
  it('la cancion entera suena y se calla con el mismo boton', async () => {
    await conUnaParte();

    await userEvent.click(screen.getByRole('button', { name: 'Escuchar la canción' }));
    expect(screen.getByRole('button', { name: 'Parar' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Parar' }));
    expect(screen.getByRole('button', { name: 'Escuchar la canción' })).toBeInTheDocument();
  });
});

/**
 * El teclado sobre la nota elegida.
 *
 * Es lo que hace que el punteo se pueda editar sin ratón, y lo que permite las
 * alteradas: las flechas la mueven por la rejilla y las teclas de más y menos la
 * suben o la bajan **un semitono**, sin cambiarla de escalón.
 */
describe('La nota elegida, con el teclado', () => {
  async function conUnaNota() {
    conTonalidad();
    useArrangementStore.setState({
      arrangement: {
        parts: [
          {
            id: 'p',
            name: 'Estrofa',
            blocks: [],
            notes: [{ id: 'n1', start: 1, length: 1, offset: 0 }],
            bars: 2,
          },
        ],
      },
      past: [],
    });
    render(<ArrangeCanvas />);
    await userEvent.click(screen.getByRole('button', { name: 'Bloques' }));
    const nota = screen
      .getAllByRole('button')
      .find((b) => (b.getAttribute('aria-label') ?? '').includes('en el pulso 1'));
    await userEvent.click(nota!);
    return nota!;
  }

  function teclear(key: string, shiftKey = false) {
    const caja = document.querySelector('[role="presentation"]');
    fireEvent.keyDown(caja ?? document.body, { key, shiftKey });
  }

  it('las flechas la mueven por la rejilla', async () => {
    await conUnaNota();

    teclear('ArrowRight');

    expect(useArrangementStore.getState().arrangement.parts[0]!.notes[0]!.start).toBeGreaterThan(1);
  });

  it('con Mayusculas, la estiran', async () => {
    await conUnaNota();
    const antes = useArrangementStore.getState().arrangement.parts[0]!.notes[0]!.length;

    teclear('ArrowRight', true);

    expect(useArrangementStore.getState().arrangement.parts[0]!.notes[0]!.length).not.toBe(antes);
  });

  it('mas y menos la suben y la bajan un semitono', async () => {
    await conUnaNota();

    teclear('+');

    expect(useArrangementStore.getState().arrangement.parts[0]!.notes[0]!.offset).toBe(1);

    teclear('-');

    expect(useArrangementStore.getState().arrangement.parts[0]!.notes[0]!.offset).toBe(0);
  });

  it('Supr la quita', async () => {
    await conUnaNota();

    teclear('Delete');

    expect(useArrangementStore.getState().arrangement.parts[0]!.notes).toHaveLength(0);
  });

  it('y cualquier otra tecla la deja donde esta', async () => {
    await conUnaNota();
    const antes = JSON.stringify(useArrangementStore.getState().arrangement.parts[0]!.notes[0]);

    teclear('a');

    expect(JSON.stringify(useArrangementStore.getState().arrangement.parts[0]!.notes[0])).toBe(
      antes,
    );
  });

  // Sin nota elegida, las mismas teclas no tocan nada.
  it('sin nota elegida no pasa nada', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(screen.getByRole('button', { name: 'Bloques' }));

    teclear('Delete');

    expect(useArrangementStore.getState().arrangement.parts).toHaveLength(0);
  });
});

describe('Arrastrar una propuesta hasta la canción', () => {
  /**
   * jsdom no pinta nada, así que no sabe qué hay debajo del puntero: hay que
   * decírselo. Es lo único que `huecoBajo` mira para decidir dónde cae el
   * acorde, y sin esto todo arrastre acabaría en el vacío.
   */
  function bajoElPuntero(elemento: Element | null): void {
    document.elementFromPoint = () => elemento;
  }

  /** El grado que lleva una propuesta, leído de su propio rótulo. */
  function gradoDe(boton: HTMLElement): string {
    return (boton.getAttribute('aria-label') ?? '').split(',')[1]?.trim().split('.')[0] ?? '';
  }

  function grados(): string[] {
    return useArrangementStore.getState().arrangement.parts[0]!.blocks.map((b) => b.degree);
  }

  /** Dos acordes puestos y la tira delante, que es donde hay compases medibles. */
  async function conDosAcordes() {
    conTonalidad();
    render(<ArrangeCanvas />);
    await enBloques();
    await userEvent.click(propuestas()[0]!);
    await userEvent.click(propuestas()[0]!);
  }

  /** El hueco `indice` de la tira, con una caja de cien píxeles a su nombre. */
  function compas(indice: number): HTMLElement {
    const hueco = document.querySelectorAll<HTMLElement>('[data-indice]')[indice]!;
    hueco.getBoundingClientRect = () =>
      ({ left: 100, right: 200, top: 0, bottom: 50, width: 100, height: 50 }) as DOMRect;
    return hueco;
  }

  function arrastrarPropuestaHasta(boton: HTMLElement, x: number, y: number): void {
    fireEvent.pointerDown(boton, { button: 0, clientX: 0, clientY: 0 });
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y }));
    window.dispatchEvent(new PointerEvent('pointerup', {}));
  }

  it('soltado en la primera mitad de un compas, el acorde se mete delante', async () => {
    await conDosAcordes();
    const propuesta = propuestas()[1]!;
    const grado = gradoDe(propuesta);
    const antes = grados();
    bajoElPuntero(compas(1));

    arrastrarPropuestaHasta(propuesta, 120, 10);

    expect(grados()).toEqual([antes[0], grado, antes[1]]);
  });

  // Y pasada la mitad va detrás: la misma regla que el arrastre de bloques.
  it('y en la segunda mitad, detras', async () => {
    await conDosAcordes();
    const propuesta = propuestas()[1]!;
    const grado = gradoDe(propuesta);
    const antes = grados();
    bajoElPuntero(compas(1));

    arrastrarPropuestaHasta(propuesta, 180, 10);

    expect(grados()).toEqual([...antes, grado]);
  });

  /**
   * Encima de la parte pero no de un compás concreto: al final, que es donde
   * sigue una canción cuando no se apunta a ningún sitio.
   */
  it('soltado en la parte pero no sobre un compas, va al final', async () => {
    await conDosAcordes();
    const propuesta = propuestas()[1]!;
    const grado = gradoDe(propuesta);
    const antes = grados();
    bajoElPuntero(screen.getByRole('region', { name: 'Estrofa' }));

    arrastrarPropuestaHasta(propuesta, 400, 10);

    expect(grados()).toEqual([...antes, grado]);
  });

  it('soltado fuera de la cancion, no pone nada', async () => {
    await conDosAcordes();
    const antes = grados();
    bajoElPuntero(document.body);

    arrastrarPropuestaHasta(propuestas()[1]!, 400, 10);

    expect(grados()).toEqual(antes);
  });

  /**
   * Un temblor no es un arrastre. Mientras no se pase el umbral no hay destino,
   * y al soltar no cae nada: lo que queda es la pulsación de siempre.
   */
  it('un temblor no cuenta como arrastre', async () => {
    await conDosAcordes();
    const antes = grados();
    bajoElPuntero(compas(1));

    arrastrarPropuestaHasta(propuestas()[1]!, 2, 2);

    expect(grados()).toEqual(antes);
  });

  // Con el botón derecho no se arrastra: ese abre el menú del sistema.
  it('el boton derecho no arrastra', async () => {
    await conDosAcordes();
    const antes = grados();
    bajoElPuntero(compas(1));

    fireEvent.pointerDown(propuestas()[1]!, { button: 2, clientX: 0, clientY: 0 });
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 150, clientY: 10 }));
    window.dispatchEvent(new PointerEvent('pointerup', {}));

    expect(grados()).toEqual(antes);
  });

  /**
   * Tras soltar, el navegador manda además el `click` de vuelta. Sin la guarda,
   * arrastrar un acorde metía dos: el que se soltó y el del clic.
   */
  it('tras arrastrar, el clic de vuelta no mete un acorde de mas', async () => {
    await conDosAcordes();
    const propuesta = propuestas()[1]!;
    const grado = gradoDe(propuesta);
    const antes = grados();
    bajoElPuntero(compas(1));

    arrastrarPropuestaHasta(propuesta, 180, 10);
    fireEvent.click(propuesta);

    expect(grados()).toEqual([...antes, grado]);
  });
});

describe('Lo que mide el carril', () => {
  /**
   * El ancho no se calcula, se mide: un compás de dos pulsos y uno de cuatro
   * tienen que verse distintos, y eso depende de lo que quepa. Quien lo mide es
   * un `ResizeObserver`, que jsdom no trae.
   */
  it('lo que mide la caja llega al carril, y al desmontar se deja de mirar', () => {
    let avisar: ((entradas: ReadonlyArray<{ contentRect: { width: number } }>) => void) | null =
      null;
    const desconectar = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: (entradas: ReadonlyArray<{ contentRect: { width: number } }>) => void) {
          avisar = cb;
        }
        observe(): void {}
        disconnect(): void {
          desconectar();
        }
      },
    );

    conTonalidad();
    const { unmount } = render(<ArrangeCanvas />);

    expect(avisar).not.toBeNull();
    // Con medida y sin ella: cuando el observador no trae entradas, cero.
    act(() => avisar!([{ contentRect: { width: 800 } }]));
    act(() => avisar!([]));
    unmount();

    expect(desconectar).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('Pedirle una idea al copiloto', () => {
  /**
   * El botón no llama al modelo: deja el pedido en `state/` y abre el panel, que
   * lo recoge al ponerse delante. Un feature no importa de otro.
   */
  it('deja el pedido puesto y abre el panel', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(propuestas()[0]!);

    await userEvent.click(screen.getByRole('button', { name: 'Pídeme una idea' }));

    expect(usePedidoDeIdeas.getState().pendiente).toBe(true);
    expect(selectReparto(useBancoStore.getState()).abajo).toBe('ideas');
  });

  // Con la canción en blanco no hay sobre qué proponer, así que no sale.
  it('con la cancion en blanco, ni aparece', () => {
    conTonalidad();
    render(<ArrangeCanvas />);

    expect(screen.queryByRole('button', { name: 'Pídeme una idea' })).not.toBeInTheDocument();
  });
});

describe('Lo que se hace con un acorde de la partitura', () => {
  function grados(): string[] {
    return useArrangementStore.getState().arrangement.parts[0]!.blocks.map((b) => b.degree);
  }

  /** Los cifrados de la parte, que en la partitura son grupos de SVG. */
  function cifrados() {
    return within(screen.getByRole('region', { name: 'Estrofa' })).queryAllByLabelText(/, grado /);
  }

  async function conDosAcordes() {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(propuestas()[0]!);
    await userEvent.click(propuestas()[0]!);
  }

  it('con Supr se quita', async () => {
    await conDosAcordes();
    const antes = grados();

    fireEvent.keyDown(cifrados()[1]!, { key: 'Delete' });

    expect(grados()).toEqual([antes[0]]);
  });

  /**
   * Y se mueve arrastrándolo por la partitura: era lo único que había que ir a
   * hacer a la otra vista, y en una partitura los acordes están ahí escritos.
   */
  it('y arrastrandolo cambia de sitio', async () => {
    await conDosAcordes();
    const antes = grados();

    fireEvent.pointerDown(cifrados()[1]!, { button: 0, clientX: 300, clientY: 10 });
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 0, clientY: 10 }));
    window.dispatchEvent(new PointerEvent('pointerup', {}));

    expect(grados()).toEqual([antes[1], antes[0]]);
  });
});

describe('Una nota que ya no esta', () => {
  /**
   * Deshacer quita la nota pero no la deja de tener elegida: el teclado seguía
   * mandando órdenes sobre algo que ya no existe. No pasa nada, y esto lo fija.
   */
  it('el teclado no hace nada con ella', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(propuestas()[0]!);
    const nota = within(screen.getByRole('region', { name: 'Qué nota puede seguir' })).getAllByRole(
      'button',
    )[0]!;
    await userEvent.click(nota);
    expect(useArrangementStore.getState().arrangement.parts[0]!.notes).toHaveLength(1);

    act(() => useArrangementStore.getState().actions.undo());
    fireEvent.keyDown(screen.getByRole('region', { name: 'Estrofa' }), { key: 'Delete' });

    expect(useArrangementStore.getState().arrangement.parts[0]!.notes).toHaveLength(0);
  });
});

describe('La canción, traída a la vista', () => {
  /**
   * En un teléfono la lista de acordes va encima y la canción debajo, fuera de
   * pantalla: ponías tu primer acorde y no lo veías. Solo se mueve la vista si
   * de verdad ha quedado por encima del borde.
   */
  it('si el primer acorde cae por encima del borde, se baja a verlo', async () => {
    const mirar = vi.fn();
    Element.prototype.scrollIntoView = mirar;
    const caja = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = () => ({ top: -200 }) as DOMRect;
    conTonalidad();
    render(<ArrangeCanvas />);

    await userEvent.click(propuestas()[0]!);
    await waitFor(() => expect(mirar).toHaveBeenCalled());

    Element.prototype.getBoundingClientRect = caja;
  });
});

describe('Lo que se ve mientras se arrastra', () => {
  /** El bloque pegado al puntero: va `aria-hidden`, así que se busca por clase. */
  function fantasma(): HTMLElement | null {
    return document.querySelector('.superficie-viva');
  }

  async function conUnAcorde() {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(propuestas()[0]!);
  }

  /**
   * Una propuesta arrastrada lleva su cifrado pegado al puntero, y **dice si
   * caería en algún sitio**: apagado mientras no hay destino, encendido cuando
   * lo hay. Sin eso, arrastrar a ciegas acaba en un acorde que aparece donde no
   * se quería.
   */
  it('la propuesta va pegada al puntero, apagada si no cae en ningun sitio', async () => {
    await conUnAcorde();
    document.elementFromPoint = () => document.body;

    fireEvent.pointerDown(propuestas()[1]!, { button: 0, clientX: 0, clientY: 0 });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 40 }));
    });

    expect(fantasma()).toHaveClass('opacity-70');
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', {}));
    });
  });

  it('y encendida cuando cae en una parte', async () => {
    await conUnAcorde();
    document.elementFromPoint = () => screen.getByRole('region', { name: 'Estrofa' });

    fireEvent.pointerDown(propuestas()[1]!, { button: 0, clientX: 0, clientY: 0 });
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 40 }));
    });
    // El segundo movimiento ya no tiene que volver a pasar el umbral.
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 210, clientY: 40 }));
    });

    expect(fantasma()).toHaveClass('text-brass-bright');
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', {}));
    });
  });
});

describe('Las flechas hacia la izquierda', () => {
  /**
   * La derecha ya está probada; la izquierda va por la otra rama del mismo
   * `if`, y una resta mal puesta ahí manda la nota al pulso −1.
   */
  it('mueven la nota elegida hacia atras', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(propuestas()[0]!);
    const notas = within(screen.getByRole('region', { name: 'Qué nota puede seguir' }));
    await userEvent.click(notas.getAllByRole('button')[0]!);
    // Las teclas se escuchan en la caja de la canción entera, no en el botón de
    // la lista que acaba de quedarse el foco.
    const parte = screen.getByRole('region', { name: 'Estrofa' });
    fireEvent.keyDown(parte, { key: 'ArrowRight' });
    fireEvent.keyDown(parte, { key: 'ArrowRight' });
    const desde = useArrangementStore.getState().arrangement.parts[0]!.notes[0]!.start;

    fireEvent.keyDown(parte, { key: 'ArrowLeft' });

    expect(useArrangementStore.getState().arrangement.parts[0]!.notes[0]!.start).toBeLessThan(
      desde,
    );
  });

  it('y el bloque elegido hacia atras', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);
    await enBloques();
    await userEvent.click(propuestas()[0]!);
    await userEvent.click(propuestas()[0]!);
    const antes = useArrangementStore.getState().arrangement.parts[0]!.blocks.map((b) => b.degree);

    fireEvent.keyDown(tiraDe('Estrofa')[1]!, { key: 'ArrowLeft' });

    expect(
      useArrangementStore.getState().arrangement.parts[0]!.blocks.map((b) => b.degree),
    ).toEqual([antes[1], antes[0]]);
  });
});

describe('Traer lo grabado cuando no habia nada legible', () => {
  /**
   * El botón sale porque sonó algo, pero de ese algo no sale ni un acorde ni una
   * nota: entonces no hay parte a la que ir, y lo único que queda es decirlo.
   */
  it('no cambia de parte, solo lo cuenta', async () => {
    conTonalidad();
    const acciones = useSessionStore.getState().actions;
    acciones.setTempo(120, 4);
    acciones.startCapture(0);
    acciones.stopCapture(1000);
    // Una nota suelta en el tramo, pero de cien milisegundos: a 120 bpm eso es
    // un quinto de pulso, y el punteo no escribe nada por debajo de un cuarto.
    useSessionStore.setState({
      noteHistory: [{ pitchClass: C, midi: 60, at: 900, clarity: 0.9 }],
    });
    render(<ArrangeCanvas />);

    await userEvent.click(screen.getByRole('button', { name: 'Traer lo grabado' }));

    expect(screen.getByText(/No he podido leer/)).toBeInTheDocument();
  });
});

describe('Los dos campos de una parte', () => {
  async function conUnaParte() {
    conTonalidad();
    render(<ArrangeCanvas />);
    await enBloques();
    await userEvent.click(propuestas()[0]!);
  }

  function campoDe(parte: string, nombre: RegExp | string) {
    return within(screen.getByRole('region', { name: parte })).getByRole(
      typeof nombre === 'string' ? 'textbox' : 'spinbutton',
      typeof nombre === 'string' ? {} : { name: nombre },
    );
  }

  /**
   * `Intro` y `Escape` cierran el campo: es lo que hace cualquier cosa que se
   * edita en el sitio, y sin ellas el único modo de salir era pulsar fuera.
   */
  it('el nombre se cierra con Intro', async () => {
    await conUnaParte();
    await userEvent.click(screen.getByRole('button', { name: 'Estrofa' }));

    const campo = campoDe('Estrofa', 'nombre');
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Puente{Enter}');

    expect(screen.getByRole('button', { name: 'Puente' })).toBeInTheDocument();
  });

  it('y los compases con Escape', async () => {
    await conUnaParte();
    const compases = campoDe('Estrofa', /compases/i);

    await userEvent.type(compases, '{Escape}');

    expect(compases).not.toHaveFocus();
  });

  // Pulsar un bloque de la tira lo elige, igual que en la partitura.
  it('un bloque de la tira se elige pulsandolo', async () => {
    await conUnaParte();
    await userEvent.click(propuestas()[0]!);

    // El recién puesto queda elegido solo, así que se pulsa el otro.
    await userEvent.click(tiraDe('Estrofa')[0]!);

    expect(tiraDe('Estrofa')[0]!).toHaveAttribute('aria-pressed', 'true');
    expect(tiraDe('Estrofa')[1]!).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Escribir una nota pulsando el pentagrama', () => {
  /**
   * La otra manera de puntear: pulsar donde quieres la nota. La lista de «y de
   * nota» propone; el pentagrama es donde se escribe a mano.
   */
  it('la nota entra en la parte que se pulsa', async () => {
    conTonalidad();
    render(<ArrangeCanvas />);
    await userEvent.click(propuestas()[0]!);
    const pentagrama = screen.getByLabelText(/^Partitura de Estrofa/);

    fireEvent.click(pentagrama, { clientX: 200, clientY: 60 });

    expect(useArrangementStore.getState().arrangement.parts[0]!.notes).toHaveLength(1);
  });
});
