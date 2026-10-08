import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EMPTY_ARRANGEMENT,
  arrangementLength,
  findBlock,
  findNote,
  writtenBlock,
  type Arrangement,
} from '@core/music';

import { MAX_UNDO, nuevoId, selectCanUndo, useArrangementStore } from './arrangement-store';
import { hechosDeComponer } from './hechos-de-componer';
import { useSessionStore } from './session-store';

function acciones() {
  return useArrangementStore.getState().actions;
}

function montaje() {
  return useArrangementStore.getState().arrangement;
}

beforeEach(() => {
  useArrangementStore.setState({
    arrangement: EMPTY_ARRANGEMENT,
    past: [],
    quitadosAlCambiarDeModo: null,
    selectedBlockId: null,
  });
});

describe('nuevoId', () => {
  it('no se repite', () => {
    const ids = new Set(Array.from({ length: 200 }, () => nuevoId('b')));
    expect(ids.size).toBe(200);
  });
});

describe('montar', () => {
  it('una parte con bloques', () => {
    const parte = acciones().addPart('Estrofa');
    acciones().addBlock(parte, 'I', 4);
    acciones().addBlock(parte, 'V', 4);

    expect(montaje().parts[0]?.name).toBe('Estrofa');
    expect(montaje().parts[0]?.blocks.map((b) => b.degree)).toEqual(['I', 'V']);
  });

  it('devuelve el identificador de lo que crea, para poder seguir usándolo', () => {
    const parte = acciones().addPart();
    const bloque = acciones().addBlock(parte, 'I', 4);
    expect(findBlock(montaje(), bloque)?.part.id).toBe(parte);
  });

  it('lo grabado entra con sus duraciones y en una sola parte', () => {
    acciones().addRecorded(
      [
        { degree: 'I', beats: 8, confidence: 1, alternatives: [] },
        { degree: 'IV', beats: 4, confidence: 1, alternatives: [] },
      ],
      'Lo que has tocado',
    );
    expect(montaje().parts[0]?.blocks.map((b) => b.beats)).toEqual([8, 4]);
  });
});

describe('deshacer', () => {
  it('vuelve al montaje anterior', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'I', 4);
    acciones().addBlock(parte, 'V', 4);

    acciones().undo();
    expect(arrangementLength(montaje())).toBe(1);
  });

  it('sin nada que deshacer no hace nada', () => {
    acciones().undo();
    expect(montaje()).toEqual(EMPTY_ARRANGEMENT);
    expect(selectCanUndo(useArrangementStore.getState())).toBe(false);
  });

  // Sin esto, deshacer un arrastre pide tantos pasos como veces pasó el puntero
  // por encima del mismo hueco.
  it('un cambio que no cambia nada no gasta un paso', () => {
    const parte = acciones().addPart();
    const bloque = acciones().addBlock(parte, 'I', 4);
    const antes = useArrangementStore.getState().past.length;

    acciones().moveBlock(bloque, 'no-existe', 0);
    acciones().removeBlock('tampoco-existe');

    expect(useArrangementStore.getState().past.length).toBe(antes);
  });

  it('la pila no crece sin fin', () => {
    const parte = acciones().addPart();
    for (let i = 0; i < MAX_UNDO + 10; i += 1) {
      acciones().addBlock(parte, 'I', 4);
    }
    expect(useArrangementStore.getState().past.length).toBe(MAX_UNDO);
  });

  // Una grabación entera es un gesto: se quita de una vez o no se quita.
  it('lo grabado se deshace de una vez', () => {
    acciones().addRecorded(
      [
        { degree: 'I', beats: 4, confidence: 1, alternatives: [] },
        { degree: 'V', beats: 4, confidence: 1, alternatives: [] },
      ],
      'Grabado',
    );
    acciones().undo();
    expect(montaje()).toEqual(EMPTY_ARRANGEMENT);
  });
});

describe('abrir una copia', () => {
  const COPIA: Arrangement = {
    parts: [{ id: 'c', name: 'Copia', blocks: [writtenBlock('x', 'V', 4)], notes: [], bars: 1 }],
  };
  const abrir = () =>
    acciones().abrirCopia({ tonic: 7, mode: 'major', bpm: 80, beatsPerBar: 3, arrangement: COPIA });
  const ajustes = () => {
    const { pinnedKey, bpm, beatsPerBar } = useSessionStore.getState();
    return { pinnedKey, bpm, beatsPerBar };
  };

  beforeEach(() => {
    useSessionStore.setState({ pinnedKey: { tonic: 0, mode: 'major' }, bpm: 120, beatsPerBar: 4 });
  });

  // Deshacía el montaje y dejaba la canción de antes en la tonalidad y el tempo
  // de la copia: «devuelve la de antes» era media verdad.
  it('un solo deshacer devuelve el montaje, la tonalidad y el tempo de antes', () => {
    const parte = acciones().addPart('Mía');
    acciones().addBlock(parte, 'IV', 4);
    const antes = montaje();

    abrir();
    expect(montaje()).toBe(COPIA);
    expect(ajustes()).toEqual({ pinnedKey: { tonic: 7, mode: 'major' }, bpm: 80, beatsPerBar: 3 });

    acciones().undo();
    expect(montaje()).toEqual(antes);
    expect(ajustes()).toEqual({ pinnedKey: { tonic: 0, mode: 'major' }, bpm: 120, beatsPerBar: 4 });
  });

  it('sin tonalidad puesta, deshacer vuelve a seguir lo que se oye', () => {
    useSessionStore.setState({ pinnedKey: null });

    abrir();
    acciones().undo();

    expect(useSessionStore.getState().pinnedKey).toBeNull();
    expect(montaje()).toEqual(EMPTY_ARRANGEMENT);
  });

  // Los ajustes van en el paso de la pila, no en el montaje: lo que vuelve al
  // deshacer es la canción, sin nada pegado que acabara guardado con ella.
  it('lo que vuelve al deshacer es el montaje, sin los ajustes', () => {
    const parte = acciones().addPart('Mía');
    const antes = montaje();

    abrir();
    expect(useArrangementStore.getState().past[0]?.ajustesDeAntes).toEqual({
      pinnedKey: { tonic: 0, mode: 'major' },
      bpm: 120,
      beatsPerBar: 4,
    });
    acciones().undo();

    expect(montaje()).toEqual(antes);
    expect(montaje()).not.toHaveProperty('ajustesDeAntes');
    expect(montaje().parts[0]?.id).toBe(parte);
  });

  // Un cambio cualquiera apila el montaje de antes, el mismo objeto: es lo que
  // deja a quien guardó uno compararlo con la pila.
  it('un cambio que no es una copia apila el mismo montaje de antes', () => {
    acciones().addPart('Mía');
    const antes = montaje();

    acciones().addPart('Otra');

    expect(useArrangementStore.getState().past[0]).toBe(antes);
    acciones().undo();
    expect(montaje()).toBe(antes);
  });

  // El montaje de antes vuelve a la pila al tocar algo después de deshacer, y
  // deshacer eso no es deshacer la copia: no puede volver a cambiar el tempo.
  it('los ajustes se devuelven una vez', () => {
    abrir();
    acciones().undo();
    useSessionStore.setState({ bpm: 90 });
    acciones().addPart('Otra');

    acciones().undo();

    expect(useSessionStore.getState().bpm).toBe(90);
  });
});

describe('cambiar de modo', () => {
  it('dice cada grado en el modo nuevo en vez de tirarlo', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'I', 4);
    acciones().addBlock(parte, 'V', 4);

    acciones().keepMode('minor');
    // El I pasa a i: la casa sigue siendo la casa. Filtrando, como se hacía
    // antes, el primer bloque desaparecía y la canción se quedaba coja.
    expect(montaje().parts[0]?.blocks.map((b) => b.degree)).toEqual(['i', 'V']);
  });

  // Un montaje que ya cuadra no es un cambio: si gastara un paso, el deshacer se
  // llenaría de pasos que no hicieron nada. Importa más que antes, porque ahora
  // esto lo llama una vigilancia que salta con cada cambio de montaje.
  it('si no se cae nada, no gasta un paso del deshacer', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'V', 4);
    const antes = useArrangementStore.getState().past.length;

    acciones().keepMode('minor');
    expect(useArrangementStore.getState().past.length).toBe(antes);
  });

  /**
   * **Traducir no gasta un paso del deshacer, ni siquiera cuando cambia algo.**
   * Lo gastaba, y el botón se quedaba atascado: deshacer devolvía los grados del
   * modo viejo, la vigilancia los traducía y apilaba otra vez, y la pila no
   * bajaba nunca.
   */
  it('traducir reemplaza la cima y no apila', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'I', 4);
    acciones().addBlock(parte, 'vi', 4);
    const pila = useArrangementStore.getState().past;

    acciones().keepMode('minor');

    expect(montaje().parts[0]?.blocks.map((b) => b.degree)).toEqual(['i', 'VI']);
    expect(useArrangementStore.getState().past).toBe(pila);
  });

  /**
   * Lo que se queda fuera se dice. Hoy solo la dominante del ii, que en menor no
   * tiene dónde caer: se guarda tal como era para que la pantalla pueda contar
   * qué acorde se ha perdido.
   */
  it('lo que no cabe en el modo nuevo se apunta para avisar, y se puede olvidar', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'I', 4);
    const secundaria = acciones().addBlock(parte, 'V/ii', 4);
    acciones().elegirBloque(secundaria);

    acciones().keepMode('minor');

    const quitados = useArrangementStore.getState().quitadosAlCambiarDeModo;
    expect(quitados?.hacia).toBe('minor');
    expect(quitados?.bloques.map((b) => b.degree)).toEqual(['V/ii']);
    // Elegido y fuera de la canción no puede ser: la columna del acorde
    // enseñaría algo que ya no está.
    expect(useArrangementStore.getState().selectedBlockId).toBeNull();

    acciones().olvidarQuitados();
    expect(useArrangementStore.getState().quitadosAlCambiarDeModo).toBeNull();
  });

  it('si lo que se cae no es lo elegido, lo elegido sigue', () => {
    const parte = acciones().addPart();
    const tonica = acciones().addBlock(parte, 'I', 4);
    acciones().addBlock(parte, 'V/ii', 4);
    acciones().elegirBloque(tonica);

    acciones().keepMode('minor');

    expect(useArrangementStore.getState().selectedBlockId).toBe(tonica);
  });

  // Un cambio que no deja nada fuera no borra el aviso del anterior: el aviso
  // se quita cuando quien lo lee lo cierra.
  it('un cambio sin pérdidas no pisa el aviso de antes', () => {
    const parte = acciones().addPart();
    acciones().addBlock(parte, 'V/ii', 4);
    acciones().addBlock(parte, 'vi', 4);
    acciones().keepMode('minor');
    const aviso = useArrangementStore.getState().quitadosAlCambiarDeModo;

    acciones().keepMode('major');

    expect(useArrangementStore.getState().quitadosAlCambiarDeModo).toBe(aviso);
  });
});

describe('un gesto entero es un paso atrás', () => {
  // Arrastrar una nota son veinte cambios y una sola cosa que deshacer. Sin esto
  // hacían falta veinte pulsaciones para devolverla a su sitio.
  it('el arrastre no llena la pila', () => {
    const parte = acciones().addPart();
    const nota = acciones().addNote(parte, 0, 0, 1);
    const antes = useArrangementStore.getState().past.length;

    acciones().beginGesture();
    for (let i = 1; i <= 8; i += 1) {
      acciones().moveNote(nota, i * 0.5, i);
    }
    acciones().endGesture();

    expect(useArrangementStore.getState().past.length).toBe(antes + 1);
  });

  it('y deshacerlo devuelve la nota a donde estaba', () => {
    const parte = acciones().addPart();
    const nota = acciones().addNote(parte, 0, 0, 1);

    acciones().beginGesture();
    acciones().moveNote(nota, 2, 5);
    acciones().moveNote(nota, 3, 7);
    acciones().endGesture();
    acciones().undo();

    expect(findNote(montaje(), nota)?.note).toMatchObject({ start: 0, offset: 0 });
  });

  it('cerrado el gesto, cada cambio vuelve a contar', () => {
    const parte = acciones().addPart();
    const nota = acciones().addNote(parte, 0, 0, 1);
    acciones().beginGesture();
    acciones().moveNote(nota, 1, 1);
    acciones().endGesture();

    const antes = useArrangementStore.getState().past.length;
    acciones().moveNote(nota, 2, 2);
    expect(useArrangementStore.getState().past.length).toBe(antes + 1);
  });
});

describe('decir qué parte es', () => {
  it('lo apunta como un hecho de componer, para que el avance se entere', () => {
    // El emisor existe por las capas: quien sabe que has decidido esto es el
    // lienzo, y quien lleva la racha es `features/learn`, que no se pueden
    // importar entre sí.
    const oido: string[] = [];
    const baja = hechosDeComponer.suscribir((hecho) => oido.push(hecho));
    const { actions } = useArrangementStore.getState();
    const id = actions.addPart();

    actions.setPartRole(id, 'estribillo');
    baja();

    expect(oido).toEqual(['parte']);
    expect(useArrangementStore.getState().arrangement.parts[0]?.role).toBe('estribillo');
  });

  it('y se puede deshacer, como cualquier otro cambio del lienzo', () => {
    const { actions } = useArrangementStore.getState();
    const id = actions.addPart();
    actions.setPartRole(id, 'puente');

    useArrangementStore.getState().actions.undo();

    expect(useArrangementStore.getState().arrangement.parts[0]?.role).toBeUndefined();
  });
});

describe('mover una parte de sitio y vaciarlo todo', () => {
  /**
   * El orden de las partes es el orden de la canción: mover el estribillo
   * delante de la estrofa cambia lo que suena, no cómo se ve.
   */
  it('una parte se mueve, y se puede deshacer', () => {
    acciones().addPart('Estrofa');
    acciones().addPart('Estribillo');
    const [estrofa, estribillo] = montaje().parts.map((parte) => parte.id);

    acciones().movePart(estribillo!, 0);

    expect(montaje().parts.map((parte) => parte.id)).toEqual([estribillo, estrofa]);
    acciones().undo();
    expect(montaje().parts.map((parte) => parte.id)).toEqual([estrofa, estribillo]);
  });

  /**
   * Y vaciarlo deja de elegido lo que ya no existe: sin esto, la columna del
   * acorde seguía enseñando las formas de un bloque que no está en la canción.
   */
  it('vaciarlo tambien suelta el bloque elegido', () => {
    const parte = acciones().addPart('Estrofa');
    const bloque = acciones().addBlock(parte, 'I', 4);
    acciones().elegirBloque(bloque);
    expect(useArrangementStore.getState().selectedBlockId).toBe(bloque);

    acciones().clear();

    expect(montaje().parts).toEqual([]);
    expect(useArrangementStore.getState().selectedBlockId).toBeNull();
  });

  // Y dar por bueno un bloque que ya no está no hace nada.
  it('confirmar un bloque que ya no esta no hace nada', () => {
    const parte = acciones().addPart('Estrofa');
    acciones().addBlock(parte, 'I', 4);
    const antes = montaje();

    acciones().confirmBlock('uno-que-no-existe');

    expect(montaje()).toBe(antes);
  });
});

describe('los identificadores sin crypto', () => {
  /**
   * `crypto.randomUUID` no está en todos los navegadores ni fuera de un origen
   * seguro. Sin respaldo, abrir la aplicación por `http://` desde otro equipo de
   * la red reventaba al poner el primer acorde.
   */
  it('siguen saliendo distintos', () => {
    vi.stubGlobal('crypto', {});

    const unos = new Set(Array.from({ length: 50 }, () => nuevoId('bloque')));

    expect(unos.size).toBe(50);
    expect([...unos].every((id) => id.startsWith('bloque-'))).toBe(true);
    vi.unstubAllGlobals();
  });
});
