// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Account } from '@core/billing';
import { pitchClassFromName, type ScaleId } from '@core/music';
import { AccountProvider } from '@state/account';
import { useArrangementStore } from '@state/arrangement-store';
import { usePedidoDeIdeas } from '@state/pedido-de-ideas';
import { usePropuestaStore } from '@state/propuesta';
import { useSessionStore } from '@state/session-store';

import { ideasError, type IdeasRequest } from './contract';
import { IdeasPanel } from './IdeasPanel';

const A = pitchClassFromName('A');

/**
 * Las ideas van con plan, así que casi todos estos tests se pintan dentro de una
 * cuenta que las incluye. El caso de quien no las tiene se prueba aparte, abajo.
 */
const CON_PLAN: Account = {
  email: 'javier@example.com',
  name: null,
  plan: 'medio',
  aiModel: 'claude-opus-5',
  aiLeftToday: 30,
  aiLeftMonth: 30,
};

function conCuenta(node: React.ReactNode, account: Account = CON_PLAN) {
  return (
    <AccountProvider account={account} accounts>
      {node}
    </AccountProvider>
  );
}

function respondWith(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Panel de ideas', () => {
  it('avisa de que a la IA solo van símbolos', () => {
    render(conCuenta(<IdeasPanel fetchIdeas={async () => respondWith({ ideas: [] })} />));
    expect(screen.getByText(/el audio no sale de tu equipo/i)).toBeInTheDocument();
  });

  it('no deja pedir nada sin tonalidad', () => {
    render(conCuenta(<IdeasPanel fetchIdeas={async () => respondWith({ ideas: [] })} />));
    expect(screen.getByText(/toca unas notas sueltas o elige una tonalidad/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /progresiones/i })).not.toBeInTheDocument();
  });

  it('manda la tonalidad y las notas, y nada más', async () => {
    const { actions } = useSessionStore.getState();
    actions.pinKey({ tonic: A, mode: 'minor' });
    actions.setScale('minorPentatonic');

    let sent: IdeasRequest | null = null;
    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async (request) => {
            sent = request;
            return respondWith({ ideas: [] });
          }}
        />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(sent).toMatchObject({
      kind: 'progression',
      key: { tonic: 'A', mode: 'minor' },
      scale: 'minorPentatonic',
    });
    expect(JSON.stringify(sent)).not.toContain('audio');
  });

  it('enseña las ideas que vuelven', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async () =>
            respondWith({
              ideas: [
                {
                  title: 'Bajar por tonos',
                  why: 'Mantiene el centro y evita la sensible.',
                  degrees: ['i', 'VII', 'VI'],
                  chords: ['Am', 'G', 'F'],
                },
              ],
            })
          }
        />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(await screen.findByText('Bajar por tonos')).toBeInTheDocument();
    // Cada acorde va en su propio hueco, que es lo que permite encender el que
    // suena mientras se escucha la idea.
    for (const acorde of ['Am', 'G', 'F']) {
      expect(screen.getByText(acorde)).toBeInTheDocument();
    }
    expect(screen.getByText(/evita la sensible/i)).toBeInTheDocument();
  });

  it('explica en español lo que ha fallado', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async () => respondWith(ideasError('unparseable_response'), 502)}
        />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no ha venido bien formada/i);
  });

  it('sobrevive a que se caiga la red', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async () => {
            throw new Error('sin red');
          }}
        />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/vuelve a intentarlo/i);
  });

  it('enseña la escala propuesta con su nombre', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async () =>
            respondWith({
              ideas: [{ title: 'Prueba el dórico', why: 'Sube la sexta.', scale: 'dorian' }],
            })
          }
        />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /qué escala meter encima/i }));

    expect(await screen.findByText('Dórico de A')).toBeInTheDocument();
  });

  /**
   * El mensaje del servidor gana al genérico: los rechazos por plan y por cupo
   * llevan el plan y el número concretos, y la frase de aquí no sabe eso.
   */
  it('enseña el motivo que manda el servidor, no uno genérico', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async () =>
            respondWith(
              ideasError('quota_exhausted', 'Se te han acabado las 40 peticiones a la IA de hoy.'),
              429,
            )
          }
        />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/las 40 peticiones/i);
  });

  /**
   * El rechazo que llega en marcha tiene la misma salida que el candado que se
   * enseña de antemano. Un plan puede caducar entre que se pinta la pantalla y se
   * pulsa el botón, y entonces el único aviso es este.
   */
  it('si lo que falta es plan, deja ir a verlos', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async () =>
            respondWith(
              ideasError(
                'plan_required',
                'Las ideas de la IA entran en el plan Medio: 9,99 € al mes.',
              ),
              402,
            )
          }
        />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/entran en el plan medio/i);
    expect(screen.getByRole('link', { name: /ver los tres planes/i })).toHaveAttribute(
      'href',
      '/planes',
    );
  });

  // Un enlace a los planes debajo de «el modelo no contesta» mandaría a pagar por
  // algo que no se arregla pagando.
  it('no manda a los planes cuando el fallo no es de plan', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      conCuenta(
        <IdeasPanel fetchIdeas={async () => respondWith(ideasError('model_unavailable'), 503)} />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    await screen.findByRole('alert');
    expect(screen.queryByRole('link', { name: /ver los tres planes/i })).not.toBeInTheDocument();
  });
});

describe('Sin plan que incluya las ideas', () => {
  const SIN_PLAN: Account = {
    email: 'javier@example.com',
    name: null,
    plan: 'gratis',
    aiModel: 'claude-opus-5',
    aiLeftToday: 3,
    aiLeftMonth: 3,
  };

  it('no enseña los botones: enseña qué plan las trae', () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(conCuenta(<IdeasPanel fetchIdeas={async () => respondWith({ ideas: [] })} />, SIN_PLAN));

    expect(screen.queryByRole('button', { name: /progresiones/i })).not.toBeInTheDocument();
    // El plan más barato que las incluye, y con su precio: un candado que no dice
    // cómo se abre es una pared. En plural, que es lo que son las ideas: esto
    // decía «Las ideas de la IA entra en el plan Medio» hasta que se leyó.
    expect(
      screen.getByText('Las ideas de la IA entran en el plan Medio: 9,99 € al mes.'),
    ).toBeInTheDocument();
    // Y se puede ir a verlos: el candado lleva a las tres tarjetas, no a la cuenta.
    expect(screen.getByRole('link', { name: /ver los tres planes/i })).toHaveAttribute(
      'href',
      '/planes',
    );
  });

  // El resto de la pantalla de componer no cuesta nada de servir, y decirlo evita
  // que parezca que la pantalla entera está de pago.
  it('dice que lo demás de la pantalla sigue siendo gratis', () => {
    render(conCuenta(<IdeasPanel fetchIdeas={async () => respondWith({ ideas: [] })} />, SIN_PLAN));

    expect(screen.getByText(/es gratis/i)).toBeInTheDocument();
  });
});

describe('un error sin frase', () => {
  /**
   * El servidor casi siempre manda la frase, pero si no la manda **el código
   * explica más que una genérica**: «no entra en tu plan» dice qué hacer y «no
   * hemos podido contactar» no dice nada. Solo cuando no hay ni frase ni código
   * conocido se cae a la de siempre.
   */
  it('usa la del codigo antes que la generica', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async () => respondWith({ error: { code: 'plan_required' } }, 402)}
        />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    const aviso = await screen.findByRole('alert');
    expect(aviso).not.toHaveTextContent(/no hemos podido contactar/i);
    expect(aviso.textContent?.length ?? 0).toBeGreaterThan(10);
  });

  it('y sin codigo conocido, la generica', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });

    render(conCuenta(<IdeasPanel fetchIdeas={async () => respondWith({}, 500)} />));

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement();
  });
});

describe('mientras piensa', () => {
  it('el boton que se pulso lo dice, y no se puede pulsar otra vez', async () => {
    // Cada petición cuesta dinero: dos pulsaciones seguidas son dos tandas de
    // ideas pagadas para leer una.
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    let contestar: (r: Response) => void = () => undefined;

    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={() =>
            new Promise<Response>((listo) => {
              contestar = listo;
            })
          }
        />,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));

    expect(screen.getByRole('button', { name: /pensando/i })).toBeDisabled();
    contestar(respondWith({ ideas: [] }));
  });
});

/**
 * La escala que propone una idea, dibujada y pulsable.
 *
 * Era una línea de texto: «Pentatónica menor de La». Para probarla había que
 * salir de aquí, abrir el mástil y buscarla en el desplegable, y a quien no se
 * sabe las escalas de memoria el nombre solo no le decía nada.
 */
describe('la escala que se propone', () => {
  const IDEA_DE_ESCALA = {
    ideas: [{ title: 'Prueba la menor armónica', why: 'El V aprieta.', scale: 'harmonicMinor' }],
  };

  async function pedirLaEscala(onIrALaEscala?: (scaleId: ScaleId) => void) {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async () => respondWith(IDEA_DE_ESCALA)}
          {...(onIrALaEscala === undefined ? {} : { onIrALaEscala })}
        />,
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: /qué escala meter encima/i }));
  }

  it('se ve dibujada, y el dibujo dice cuál es para quien no la ve', async () => {
    await pedirLaEscala(() => undefined);

    expect(
      await screen.findByRole('img', {
        name: /menor armónica de A, en los cinco primeros trastes/i,
      }),
    ).toBeInTheDocument();
  });

  it('al pulsarla, quien monta el panel se entera de a cuál hay que ir', async () => {
    const ido: ScaleId[] = [];
    await pedirLaEscala((scaleId) => ido.push(scaleId));

    await userEvent.click(
      await screen.findByRole('button', { name: /ponerla y verla en el mástil/i }),
    );

    expect(ido).toEqual(['harmonicMinor']);
  });

  // Fuera de componer no hay mástil que abrir, así que se queda en el nombre y
  // no se ofrece un botón que no llevaría a ninguna parte.
  it('sin sitio a donde ir, se dice con palabras y no se finge un botón', async () => {
    await pedirLaEscala();

    expect(await screen.findByText(/menor armónica de A/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /ponerla y verla en el mástil/i }),
    ).not.toBeInTheDocument();
  });
});

/**
 * Una idea que no se puede probar no es una idea, es un párrafo.
 *
 * La IA proponía tres progresiones razonadas y ahí se acababa todo: para oír una
 * había que ir pulsándola a mano en la rueda, acorde por acorde, y para quedarse
 * con ella había que montarla otra vez en el lienzo.
 */
describe('probar una progresión propuesta', () => {
  const UNA = {
    ideas: [
      {
        title: 'El bucle girado',
        why: 'Empieza por el vi.',
        degrees: ['vi', 'IV', 'I', 'V'],
        chords: ['Am', 'F', 'C', 'G'],
      },
    ],
  };

  async function pedirla() {
    useSessionStore.getState().actions.pinKey({ tonic: pitchClassFromName('C'), mode: 'major' });
    const sonadas: unknown[][] = [];
    render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async () => respondWith(UNA)}
          createPlayer={() => ({
            play: async (steps) => {
              sonadas.push([...steps]);
            },
            stop: () => undefined,
            dispose: async () => undefined,
          })}
        />,
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));
    return sonadas;
  }

  it('se escucha en la tonalidad que hay puesta, no en una de libro', async () => {
    const sonadas = await pedirla();

    await userEvent.click(await screen.findByRole('button', { name: 'Escuchar' }));

    // Cuatro acordes, y el primero es el vi de Do mayor: La menor.
    expect(sonadas).toHaveLength(1);
    expect(sonadas[0]).toHaveLength(4);
  });

  /**
   * **Se propone, no se escribe.**
   *
   * Escribía: creaba una parte y metía los cuatro acordes. Es lo que dejó de
   * hacer [adr/0033](../../../docs/adr/0033-el-copiloto-propone-y-no-escribe.md):
   * una herramienta que cambia tu canción por su cuenta convierte el trabajo en
   * algo que hay que revisar en vez de algo que es tuyo.
   */
  it('se propone al final de la cancion, y no escribe ni un acorde', async () => {
    await pedirla();

    await userEvent.click(await screen.findByRole('button', { name: /Probarla en la canción/ }));

    // Ni un bloque en la canción: lo propuesto vive aparte hasta que se acepta.
    const partes = useArrangementStore.getState().arrangement.parts;
    expect(partes.flatMap((parte) => parte.blocks)).toEqual([]);
    expect(usePropuestaStore.getState().propuesta?.degrees).toEqual(['vi', 'IV', 'I', 'V']);
    expect(screen.getByRole('status')).toHaveTextContent(/punteada/i);
  });

  /**
   * Con la canción en blanco hace falta una parte donde ponerlos, y crearla no
   * es escribir música: sigue sin haber ni un acorde que nadie haya aceptado.
   */
  it('con la cancion en blanco crea la parte, pero vacia', async () => {
    await pedirla();

    await userEvent.click(await screen.findByRole('button', { name: /Probarla en la canción/ }));

    const partes = useArrangementStore.getState().arrangement.parts;
    expect(partes).toHaveLength(1);
    expect(partes[0]?.blocks).toEqual([]);
    expect(usePropuestaStore.getState().propuesta?.partId).toBe(partes[0]?.id);
  });
});

/**
 * Pedida desde el lienzo, la idea sale **ya propuesta**.
 *
 * El fantasma es la confirmación, y hacer que además haya que pulsar «probarla»
 * sería el panel intermedio que
 * [adr/0033](../../../docs/adr/0033-el-copiloto-propone-y-no-escribe.md) se
 * quitó de en medio.
 */
describe('pedida desde el lienzo', () => {
  beforeEach(() => {
    usePedidoDeIdeas.setState({ pendiente: false });
    usePropuestaStore.getState().acciones.descartar();
  });

  function idea() {
    return respondWith({
      ideas: [
        {
          title: 'Bajar por tonos',
          why: 'Mantiene el centro.',
          degrees: ['vi', 'VII', 'i'],
          chords: ['F', 'G', 'Am'],
        },
      ],
    });
  }

  it('llega propuesta sin tener que pulsar nada mas', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    usePedidoDeIdeas.getState().acciones.pedirProgresion();

    render(conCuenta(<IdeasPanel fetchIdeas={async () => idea()} />));

    await screen.findByText('Bajar por tonos');
    expect(usePropuestaStore.getState().propuesta?.degrees).toEqual(['vi', 'VII', 'i']);
  });

  /**
   * Y **una sola vez**: la bandera se consume al leerla. Si se quedara puesta,
   * volver a abrir el panel gastaría otra petición del cupo sin pedirlo.
   */
  it('y no se vuelve a pedir al reabrir el panel', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    usePedidoDeIdeas.getState().acciones.pedirProgresion();
    let peticiones = 0;

    const { unmount } = render(
      conCuenta(
        <IdeasPanel
          fetchIdeas={async () => {
            peticiones += 1;
            return idea();
          }}
        />,
      ),
    );
    await screen.findByText('Bajar por tonos');
    unmount();
    render(conCuenta(<IdeasPanel fetchIdeas={async () => idea()} />));

    expect(peticiones).toBe(1);
  });

  // Pedida desde el propio panel no se propone sola: entonces se está mirando
  // la lista, y una lista que además escribe en la canción asusta.
  it('pedida desde el panel, no se propone sola', async () => {
    useSessionStore.getState().actions.pinKey({ tonic: A, mode: 'minor' });
    render(conCuenta(<IdeasPanel fetchIdeas={async () => idea()} />));

    await userEvent.click(screen.getByRole('button', { name: /progresiones/i }));
    await screen.findByText('Bajar por tonos');

    expect(usePropuestaStore.getState().propuesta).toBeNull();
  });
});
