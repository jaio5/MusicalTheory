// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { selectReparto, useBancoStore } from './banco';
import {
  DEFAULT_BANCO,
  loadPreferences,
  REPARTOS_DE_FABRICA,
  savePreferences,
  TOPES_DEL_BANCO,
} from './workspace';

/**
 * El reparto del banco de trabajo.
 *
 * Lo que se prueba aquí no son los números: es **que el reparto se recuerda sin
 * llevarse por delante lo demás**, y que lo guardado por una versión anterior
 * —o por alguien con la consola abierta— no deja la pantalla rota.
 */

const acciones = () => useBancoStore.getState().actions;
const reparto = () => selectReparto(useBancoStore.getState());
/** El reparto guardado del espacio en el que se está. */
const guardado = () => loadPreferences().banco.repartos[useBancoStore.getState().espacio];

beforeEach(() => {
  localStorage.clear();
  useBancoStore.setState({ espacio: DEFAULT_BANCO.espacio, repartos: REPARTOS_DE_FABRICA });
});

describe('mover un area', () => {
  it('se recuerda de una vez para otra', () => {
    acciones().mover('izquierda', 26);

    expect(guardado().izquierda).toBe(26);
  });

  it('se acota, que un ancho de nueve mil tapa la pantalla', () => {
    acciones().mover('izquierda', 9000);

    expect(reparto().izquierda).toBe(TOPES_DEL_BANCO.izquierda.max);
  });

  it('y el doble clic la devuelve a la de fabrica', () => {
    acciones().mover('derecha', 30);
    acciones().devolver('derecha');

    expect(reparto().derecha).toBe(REPARTOS_DE_FABRICA.tocando.derecha);
  });
});

/**
 * Arrastrando un divisor se mueve en memoria y no se guarda: guardar es leer y
 * escribir las preferencias enteras, y un arrastre son sesenta movimientos por
 * segundo. Lo que se guarda es lo del final, con `mover`.
 */
describe('arrastrar un area', () => {
  it('cambia el reparto sin guardarlo', () => {
    const guardado = loadPreferences().banco.repartos.tocando.izquierda;

    acciones().arrastrar('izquierda', 26);

    expect(selectReparto(useBancoStore.getState()).izquierda).toBe(26);
    expect(loadPreferences().banco.repartos.tocando.izquierda).toBe(guardado);
  });

  it('y tampoco se sale de los topes', () => {
    acciones().arrastrar('izquierda', 9000);

    expect(selectReparto(useBancoStore.getState()).izquierda).toBe(TOPES_DEL_BANCO.izquierda.max);
  });
});

describe('el area de abajo', () => {
  it('pulsar la que ya esta abierta la cierra', () => {
    acciones().abrirAbajo('mastil');
    expect(reparto().abajo).toBe('mastil');

    acciones().abrirAbajo('mastil');
    expect(reparto().abajo).toBeNull();
  });

  // Un editor renombrado o retirado deja el area cerrada, no abierta y vacia.
  it('un editor que ya no existe no abre nada', () => {
    savePreferences({
      ...loadPreferences(),
      banco: {
        ...DEFAULT_BANCO,
        repartos: {
          ...REPARTOS_DE_FABRICA,
          tocando: { ...REPARTOS_DE_FABRICA.tocando, abajo: 'una-pestana-que-ya-no-esta' },
        },
      },
    });

    acciones().cargar();

    expect(reparto().abajo).toBeNull();
  });

  // Los dos que de verdad se fueron: grabar es un papel de la toma (adr/0056) y
  // las ideas se retiraron (adr/0066). Quien los dejo abiertos los tiene guardados.
  it.each(['grabar', 'ideas'])('«%s», guardado de antes, abre el area cerrada', (viejo) => {
    savePreferences({
      ...loadPreferences(),
      banco: {
        ...DEFAULT_BANCO,
        repartos: {
          ...REPARTOS_DE_FABRICA,
          tocando: { ...REPARTOS_DE_FABRICA.tocando, abajo: viejo },
        },
      },
    });

    acciones().cargar();

    expect(reparto().abajo).toBeNull();
  });
});

/**
 * La razón por la que `remember` parte de lo guardado: en esa clave viven el
 * estilo, la escala, la afinación y la tonalidad, y este almacén no los conoce.
 * Sin eso, mover un divisor borraba en qué tonalidad estabas.
 */
describe('guardar el reparto no pisa el resto', () => {
  it('la tonalidad y la escala siguen ahi despues de mover un divisor', () => {
    savePreferences({
      ...loadPreferences(),
      scaleId: 'dorian',
      pinnedKey: { tonic: 9, mode: 'minor' },
    });

    acciones().mover('alto', 20);

    const preferencias = loadPreferences();
    expect(preferencias.scaleId).toBe('dorian');
    expect(preferencias.pinnedKey).toEqual({ tonic: 9, mode: 'minor' });
    expect(guardado().alto).toBe(20);
  });
});

describe('plegar un area', () => {
  /**
   * Con las cinco áreas abiertas la pantalla se lee como un panel de control:
   * cinco cosas pidiendo la mirada y ninguna mandando. Plegar es lo que le
   * devuelve el sitio a lo que se está haciendo, y **se recuerda**: quien se
   * montó su reparto no quiere volver a montárselo mañana.
   */
  it('se recuerda, como los anchos', () => {
    // La izquierda, que en `tocando` viene abierta: hace falta saber en qué
    // tonalidad estás antes de darle al botón.
    acciones().plegar('izquierda');

    expect(reparto().plegadas).toContain('izquierda');
    expect(guardado().plegadas).toContain('izquierda');
  });

  it('y volver a pulsar la despliega', () => {
    // La derecha viene plegada de fábrica en este espacio: se pulsa una vez y
    // se abre, se pulsa otra y vuelve a la tira.
    acciones().plegar('derecha');
    expect(reparto().plegadas).not.toContain('derecha');

    acciones().plegar('derecha');
    expect(reparto().plegadas).toContain('derecha');
  });
});

/**
 * Cada espacio de trabajo trae **su** reparto, y por eso los tres no enseñan lo
 * mismo: tocando hace falta la rueda; escribiendo, la canción y el acorde;
 * ensayando, solo la canción. Con un reparto único, los tres enseñaban las cinco
 * áreas a la vez.
 */
describe('un reparto por espacio', () => {
  it('cada espacio viene repartido de fabrica a su manera', () => {
    expect(REPARTOS_DE_FABRICA.tocando.plegadas).toEqual(['derecha', 'camino']);
    expect(REPARTOS_DE_FABRICA.escribir.plegadas).toEqual(['izquierda', 'camino']);
    expect(REPARTOS_DE_FABRICA.ensayar.plegadas).toEqual(['izquierda', 'derecha', 'camino']);
  });

  /**
   * «A dónde ir» viene plegada en los tres, y no es pereza: el lienzo ya lleva
   * su propia lista de acordes. Abiertas las dos, «Para empezar» y «Por dónde
   * empezar» son la misma lista dos veces en la misma pantalla
   * ([adr/0032](../../docs/adr/0032-la-progresion-y-el-montaje-son-lo-mismo.md)).
   */
  it('a donde ir no compite con la lista del lienzo', () => {
    for (const espacio of ['tocando', 'escribir', 'ensayar'] as const) {
      expect(REPARTOS_DE_FABRICA[espacio].plegadas).toContain('camino');
    }
  });

  it('mover un area en uno no toca la del otro', () => {
    acciones().mover('izquierda', 30);

    acciones().espacio('escribir');

    expect(reparto().izquierda).toBe(REPARTOS_DE_FABRICA.escribir.izquierda);
    acciones().espacio('tocando');
    expect(reparto().izquierda).toBe(30);
  });

  // La salida para quien lo ha dejado imposible: volver a como venía.
  it('se puede devolver el reparto entero de este espacio', () => {
    acciones().mover('izquierda', 30);
    acciones().plegar('izquierda');

    acciones().devolverElReparto();

    expect(reparto()).toEqual(REPARTOS_DE_FABRICA.tocando);
  });
});
