import { describe, expect, it } from 'vitest';

import type { ContextoDeSalidas } from './contexto-de-salidas';
import { reposoFrigio } from './formas';
import {
  cadenciaPropia,
  encaje,
  ENCAJE_MINIMO,
  esUnaBajada,
  bluesAMedias,
  formaDeBlues,
  pulsosHabituales,
  sensibleDelCentro,
  PARTE_QUE_SIGUE,
  vivePrestado,
  type CriterioId,
  type Encaje,
  type LoQueSeAnade,
  type PasoJuzgado,
} from './encaje';
import type { KeyMode } from './keys';
import type { PathId, PathKind, PathStep } from './paths';
import type { DegreeSymbol } from './progressions';
import type { MoveId } from './reharmonization';
import type { StyleId } from './styles';

/**
 * «I vi ii V», «I/8 IV/8», «bII{tritono}», «V/ii/2»: grado, pulsos —cuatro si no
 * se dicen— y el movimiento entre llaves.
 */
function pasos(texto: string): PasoJuzgado[] {
  return texto.split(' ').map((token) => {
    const [, cuerpo, pulsos] = /^(.+?)(?:\/(\d+))?$/.exec(token)!;
    const [grado, move] = cuerpo!.split('{');
    return {
      degree: grado as DegreeSymbol,
      beats: Number(pulsos ?? 4),
      move: move === undefined ? null : (move.slice(0, -1) as MoveId),
    };
  });
}

interface Pregunta {
  readonly mode?: KeyMode;
  readonly kind?: PathKind;
  readonly tuyo: string;
  readonly path: PathId;
  /** Al continuar, solo lo que se añade; al retocar, la canción entera. */
  readonly salida: string;
  readonly contexto?: ContextoDeSalidas;
  /** Qué es lo añadido según quien lo construyó; sin él, el juez lo deduce. */
  readonly loQueSeAnade?: LoQueSeAnade;
}

function juzga({
  mode = 'major',
  kind = 'continuar',
  tuyo,
  path,
  salida,
  contexto = {},
  loQueSeAnade,
}: Pregunta): Encaje {
  const original: PathStep[] = pasos(tuyo).map(({ degree, beats }) => ({ degree, beats }));
  const nuevos = pasos(salida);
  const cancion = kind === 'continuar' ? [...original, ...nuevos] : nuevos;
  return encaje(mode, kind, original, contexto, {
    path,
    cancion,
    ...(loQueSeAnade === undefined ? {} : { loQueSeAnade }),
  });
}

function criterio(resultado: Encaje, id: CriterioId) {
  return resultado.criterios.find((c) => c.id === id)!;
}

const valor = (resultado: Encaje, id: CriterioId) => criterio(resultado, id).valor;
const motivo = (resultado: Encaje, id: CriterioId) => criterio(resultado, id).motivo;

/**
 * Un reparo no descarta: deja la salida por debajo del mínimo, para que solo entre
 * por la red cuando no hay tres que lleguen.
 */
function conReparo(resultado: Encaje) {
  expect(resultado.descarte).toBeNull();
  expect(resultado.puntos).toBeLessThan(ENCAJE_MINIMO);
}

describe('lo que devuelve', () => {
  it('los once criterios, siempre en el mismo orden, y unos puntos de 0 a 100', () => {
    const r = juzga({ tuyo: 'I vi ii V', path: 'seguir', salida: 'I' });
    expect(r.criterios.map((c) => c.id)).toEqual([
      'sintaxis',
      'cadencia',
      'frase',
      'ritmo-armonico',
      'bajo',
      'notas-comunes',
      'melodia',
      'estilo',
      'novedad',
      'papel',
      'forma',
    ]);
    for (const c of r.criterios) {
      expect(c.valor).toBeGreaterThanOrEqual(-1);
      expect(c.valor).toBeLessThanOrEqual(1);
    }
    expect(r.puntos).toBeGreaterThanOrEqual(0);
    expect(r.puntos).toBeLessThanOrEqual(100);
    expect(r.descarte).toBeNull();
  });

  it('es determinista: el menú se construye dos veces y tiene que salir igual', () => {
    const pregunta: Pregunta = {
      tuyo: 'I V vi IV',
      path: 'contraste',
      salida: 'ii IV V V',
      contexto: { estilo: 'pop', papel: 'estrofa' },
    };
    expect(juzga(pregunta)).toEqual(juzga(pregunta));
  });

  it('el mínimo es cincuenta: por debajo hay más en contra que a favor', () => {
    expect(ENCAJE_MINIMO).toBe(50);
  });

  it.each([
    ['lo tuyo escrito en el otro modo', 'I IV', 'V'],
    ['una salida con un grado que el modo no tiene', 'i iv', 'bVII i'],
  ])('lo que no se puede juzgar sale a cero y descartado: %s', (_, tuyo, salida) => {
    const r = juzga({ mode: 'minor', tuyo, path: 'seguir', salida });
    expect(r).toEqual({
      puntos: 0,
      criterios: [],
      descarte: 'la canción no se puede juzgar en este modo',
    });
  });

  it('sin compases tuyos, sin compases suyos o con pulsos que no son pulsos, tampoco', () => {
    const vacio = encaje('major', 'continuar', [], {}, { path: 'seguir', cancion: pasos('V I') });
    const sinSalida = encaje(
      'major',
      'retocar',
      pasos('I V'),
      {},
      { path: 'estirar', cancion: [] },
    );
    const ceroPulsos = encaje(
      'major',
      'retocar',
      pasos('I V'),
      {},
      {
        path: 'estirar',
        cancion: [{ degree: 'I', beats: 0 }],
      },
    );
    const sinNumero = encaje(
      'major',
      'retocar',
      pasos('I V'),
      {},
      {
        path: 'estirar',
        cancion: [{ degree: 'I', beats: Number.NaN }],
      },
    );
    for (const r of [vacio, sinSalida, ceroPulsos, sinNumero]) {
      expect(r.criterios).toEqual([]);
      expect(r.descarte).not.toBeNull();
    }
  });

  it('lo que depende de un contexto que no ha llegado sale a cero y no cuenta', () => {
    const sin = juzga({ tuyo: 'I vi ii V', path: 'seguir', salida: 'I' });
    expect(criterio(sin, 'melodia')).toEqual({ id: 'melodia', valor: 0, motivo: '' });
    expect(criterio(sin, 'estilo')).toEqual({ id: 'estilo', valor: 0, motivo: '' });
    expect(criterio(sin, 'papel')).toEqual({ id: 'papel', valor: 0, motivo: '' });
    // Una idea es el papel que se pone solo: no dice nada de cómo acabar.
    const idea = juzga({
      tuyo: 'I vi ii V',
      path: 'seguir',
      salida: 'I',
      contexto: { papel: 'idea' },
    });
    expect(idea.puntos).toBe(sin.puntos);
  });
});

describe('1. sintaxis funcional', () => {
  it('V I resuelve; V IV es una retrogresión que en jazz no se ofrece, y en folk resta', () => {
    const resuelve = juzga({ tuyo: 'I vi ii V', path: 'seguir', salida: 'I' });
    expect(valor(resuelve, 'sintaxis')).toBe(1);
    expect(motivo(resuelve, 'sintaxis')).toBe('V I: la dominante resuelve en la tónica.');

    const vuelve = (estilo: 'jazz' | 'folk') =>
      juzga({ tuyo: 'I vi ii V', path: 'seguir', salida: 'IV I', contexto: { estilo } });
    expect(valor(vuelve('jazz'), 'sintaxis')).toBeLessThan(0);
    expect(vuelve('jazz').descarte).toBe('V IV vuelve atrás, y en jazz no se hace.');
    // El folk de canción y el country también lo tocan: resta, pero no se descarta.
    // Antes se descartaba, y no salía de ningún repertorio sino de que el corpus
    // del equipo no tenía un folk con `V IV`.
    expect(valor(vuelve('folk'), 'sintaxis')).toBeLessThan(0);
    expect(vuelve('folk').descarte).toBeNull();
  });

  it('V IV vale en blues y en rock, pesa un poco sin estilo y algo más en pop', () => {
    const con = (estilo?: 'blues' | 'rock' | 'pop') =>
      juzga({
        tuyo: 'I IV I V',
        path: 'seguir',
        salida: 'IV',
        contexto: estilo === undefined ? {} : { estilo },
      });
    expect(motivo(con('blues'), 'sintaxis')).toBe(
      'V IV: la dominante vuelve a la subdominante, que en blues es idioma.',
    );
    // Se descarta por otra cosa —cinco compases—, no por volver atrás.
    expect(con('blues').descarte).not.toMatch(/vuelve atrás/);
    expect(valor(con('blues'), 'sintaxis')).toBeGreaterThan(valor(con('rock'), 'sintaxis'));
    // Sin estilo se juzga como la armonía de siempre, que es más estricta que el pop.
    expect(valor(con('rock'), 'sintaxis')).toBeGreaterThan(valor(con('pop'), 'sintaxis'));
    expect(valor(con('pop'), 'sintaxis')).toBeGreaterThan(valor(con(), 'sintaxis'));
    expect(motivo(con(), 'sintaxis')).toBe(
      'V IV: la dominante vuelve a la subdominante sin resolver, una retrogresión.',
    );
    expect(con().descarte).not.toMatch(/vuelve atrás/);
  });

  it('la cadencia rota solo lo es si la frase sigue', () => {
    const sigue = juzga({ tuyo: 'I IV ii V', path: 'seguir', salida: 'vi ii V I' });
    expect(JSON.stringify(sigue.criterios)).not.toContain('V vi: acaba');
    const enlaces = juzga({ tuyo: 'I IV ii V', path: 'seguir', salida: 'vi I' });
    expect(valor(enlaces, 'sintaxis')).toBeGreaterThan(0);
    const acaba = juzga({ tuyo: 'I IV ii V', path: 'seguir', salida: 'vi' });
    expect(motivo(acaba, 'sintaxis')).toBe('V vi: acaba en la relativa, sin cerrar.');
  });

  it('V III en menor ni resuelve ni es cadencia rota: la rota en menor es V VI', () => {
    const III = juzga({ mode: 'minor', tuyo: 'ii° V i i', path: 'seguir', salida: 'V III iv i' });
    expect(motivo(III, 'sintaxis')).toBe('V III: la dominante va a III sin resolver.');
    const VI = juzga({ mode: 'minor', tuyo: 'ii° V i i', path: 'seguir', salida: 'V VI iv i' });
    expect(valor(VI, 'sintaxis')).toBeGreaterThan(valor(III, 'sintaxis'));
  });

  it('la dominante que pasa a otra tensión no resuelve', () => {
    const r = juzga({ tuyo: 'I IV', path: 'seguir', salida: 'V vii° I I' });
    expect(motivo(r, 'sintaxis')).toBe('V vii°: la dominante pasa a otra tensión sin resolver.');
  });

  it('el bVII no es un V: cierra sin sensible, bien en rock y mal en jazz', () => {
    const rock = juzga({
      tuyo: 'I IV I IV',
      path: 'seguir',
      salida: 'I bVII I I',
      contexto: { estilo: 'rock' },
    });
    const jazz = juzga({
      tuyo: 'I IV I IV',
      path: 'seguir',
      salida: 'I bVII I I',
      contexto: { estilo: 'jazz' },
    });
    expect(valor(rock, 'sintaxis')).toBeGreaterThan(valor(jazz, 'sintaxis'));
    expect(motivo(jazz, 'sintaxis')).toBe(
      'bVII I: cierra sin sensible, y en jazz se llega con la dominante.',
    );
    expect(rock.puntos).toBeGreaterThan(jazz.puntos);
  });

  it('iv bVII I es la puerta de atrás del jazz, y ahí el bVII sí vale', () => {
    const r = juzga({
      tuyo: 'I vi ii V',
      path: 'seguir',
      salida: 'I iv bVII I',
      contexto: { estilo: 'jazz' },
    });
    expect(motivo(r, 'estilo')).toBe('iv bVII I, la puerta de atrás del jazz.');
    const sintaxis = juzga({
      tuyo: 'I iv',
      path: 'seguir',
      salida: 'bVII I',
      contexto: { estilo: 'jazz' },
    });
    expect(valor(sintaxis, 'sintaxis')).toBeGreaterThan(0);
  });

  it('bVII IV es el doble plagal, y bVII bVI sigue bajando por el modo', () => {
    const plagal = juzga({ tuyo: 'I bVII', path: 'seguir', salida: 'IV' });
    // Sin estilo no se nombra ninguno: el motivo decía «del rock» en un jazz.
    expect(motivo(plagal, 'sintaxis')).toBe(
      'bVII IV: el bVII se queda fuera un compás más, el doble plagal.',
    );
    const jazz = juzga({
      tuyo: 'I bVII',
      path: 'seguir',
      salida: 'IV',
      contexto: { estilo: 'jazz' },
    });
    expect(motivo(jazz, 'sintaxis')).toBe(
      'bVII IV: el bVII se queda fuera un compás más, y en jazz se llega con la dominante.',
    );
    const baja = juzga({ tuyo: 'I bVII', path: 'seguir', salida: 'bVI' });
    expect(motivo(baja, 'sintaxis')).toBe('bVII bVI: sigue fuera de casa, bajando por el modo.');
  });

  it.each([
    ['V', 'IV V: la subdominante prepara la dominante.'],
    ['bII{tritono}', 'IV bII: la subdominante prepara la dominante.'],
    ['V/V', 'IV V/V: de la salida a la tensión.'],
    ['I', 'IV I: cadencia plagal, el amén.'],
    ['vi', 'IV vi: de la salida a otro reposo.'],
    ['iv', 'IV iv: el mismo bajo con otro color.'],
    ['ii', 'IV ii: se queda en la zona blanda.'],
  ])('desde la subdominante a %s', (salida, texto) => {
    const r = juzga({ tuyo: 'I IV', path: 'seguir', salida });
    expect(motivo(r, 'sintaxis')).toBe(texto);
    expect(valor(r, 'sintaxis')).toBeGreaterThan(0);
  });

  it('ii IV retrocede dentro de la subdominante', () => {
    const r = juzga({ tuyo: 'I ii', path: 'seguir', salida: 'IV V I I' });
    expect(motivo(r, 'sintaxis')).toBe('ii IV: retrocede dentro de la subdominante.');
  });

  it('IV bVII pesa como el doble plagal según el estilo; iv bVII en jazz es la puerta de atrás', () => {
    // El folk vive del bVII —el vaivén celta, el mixolidio—: ni resta ni es préstamo.
    const folk = juzga({
      tuyo: 'I IV',
      path: 'seguir',
      salida: 'bVII I',
      contexto: { estilo: 'folk' },
    });
    expect(motivo(folk, 'sintaxis')).toBe('bVII I: cierra sin sensible.');
    expect(valor(folk, 'sintaxis')).toBeGreaterThan(0.5);
    // En pop es un préstamo.
    const pop = juzga({
      tuyo: 'I IV',
      path: 'seguir',
      salida: 'bVII',
      contexto: { estilo: 'pop' },
    });
    expect(JSON.stringify(pop.criterios)).toContain('un préstamo que cierra sin sensible');
    const enJazz = juzga({
      tuyo: 'I IV',
      path: 'seguir',
      salida: 'bVII I',
      contexto: { estilo: 'jazz' },
    });
    expect(valor(enJazz, 'sintaxis')).toBeLessThan(0);
    expect(motivo(enJazz, 'sintaxis')).toContain('y en jazz se llega con la dominante.');
    const jazz = juzga({
      tuyo: 'I iv',
      path: 'seguir',
      salida: 'bVII I',
      contexto: { estilo: 'jazz' },
    });
    expect(motivo(jazz, 'sintaxis')).not.toContain('préstamo');
    const menor = juzga({ mode: 'minor', tuyo: 'i iv', path: 'seguir', salida: 'VII i' });
    expect(valor(menor, 'sintaxis')).toBeGreaterThan(0.5);
  });

  it('del reposo se sale a cualquier sitio, y a la tónica se llega de rebote', () => {
    const rebote = juzga({ tuyo: 'I IV V vi', path: 'seguir', salida: 'I' });
    expect(motivo(rebote, 'sintaxis')).toBe(
      'vi I: llega a la tónica de rebote, desde otro reposo.',
    );
    const sale = juzga({ tuyo: 'I V I vi', path: 'seguir', salida: 'IV' });
    expect(motivo(sale, 'sintaxis')).toBe('vi IV: sale del reposo hacia IV.');
  });

  it('una dominante secundaria tiene que llegar a lo suyo', () => {
    const llega = juzga({ tuyo: 'I vi', path: 'seguir', salida: 'V/ii ii V I' });
    expect(motivo(llega, 'notas-comunes')).toBe('V/ii ii en el 3: llega a lo que preparaba.');
    const noLlega = juzga({ tuyo: 'I vi', path: 'seguir', salida: 'V/ii V I I' });
    expect(motivo(noLlega, 'sintaxis')).toBe('V/ii V: V/ii prepara otro acorde y no llega a él.');
    expect(valor(noLlega, 'notas-comunes')).toBe(-1);
  });

  it('en un vamp sin tónica, ir y volver entre sus dos acordes no es una retrogresión', () => {
    const r = juzga({ tuyo: 'ii V ii V', path: 'contraste', salida: 'IV bVII IV V' });
    expect(motivo(r, 'cadencia')).toBe('Vuelve a tu principio por V ii: el vaivén de tu vamp.');
  });

  it('lo construido sobre un compás dudoso pesa la mitad', () => {
    const seguro = juzga({ tuyo: 'I vi IV V', path: 'seguir', salida: 'IV I' });
    const dudoso = juzga({
      tuyo: 'I vi IV V',
      path: 'seguir',
      salida: 'IV I',
      contexto: { dudosos: [false, false, false, true] },
    });
    expect(valor(dudoso, 'sintaxis')).toBeGreaterThan(valor(seguro, 'sintaxis'));
    expect(valor(dudoso, 'bajo')).not.toBe(valor(seguro, 'bajo'));
  });
});

describe('2. cadencia por posición', () => {
  it('la tónica que llega en el compás fuerte pesa más que la que llega a destiempo', () => {
    const fuerte = juzga({ tuyo: 'I vi IV V', path: 'seguir', salida: 'I' });
    expect(motivo(fuerte, 'cadencia')).toBe(
      'V I en el 5: cadencia perfecta, y llega en el compás fuerte.',
    );
    const destiempo = juzga({ tuyo: 'I vi IV V', path: 'seguir', salida: 'V I' });
    expect(motivo(destiempo, 'cadencia')).toContain('pero llega a destiempo de la frase');
    expect(valor(fuerte, 'cadencia')).toBeGreaterThan(valor(destiempo, 'cadencia'));
  });

  it('el grupo de ocho cierra más que el de cuatro', () => {
    const ocho = juzga({ tuyo: 'I vi IV V', path: 'seguir', salida: 'ii IV V I' });
    const cuatro = juzga({ tuyo: 'I vi IV', path: 'seguir', salida: 'V I' });
    expect(valor(ocho, 'cadencia')).toBe(1);
    expect(valor(cuatro, 'cadencia')).toBeLessThan(1);
  });

  it('perfecta, sin sensible, plagal, de rebote y sin cadencia, de más a menos', () => {
    const cierre = (salida: string) =>
      valor(juzga({ tuyo: 'I vi ii IV', path: 'seguir', salida }), 'cadencia');
    expect(cierre('V I I I')).toBeGreaterThan(cierre('bVII I I I'));
    expect(cierre('bVII I I I')).toBeGreaterThan(cierre('IV I I I'));
    expect(cierre('IV I I I')).toBeGreaterThan(cierre('vi I I I'));
    const todoTonica = juzga({
      kind: 'retocar',
      tuyo: 'I I I I',
      path: 'estirar',
      salida: 'I/8 I/8',
    });
    expect(motivo(todoTonica, 'cadencia')).toBe(
      'I en el 1: todo es tónica, no hay cadencia, pero llega a destiempo de la frase.',
    );
  });

  it('la tónica que cae a mitad de compás no llega a tiempo', () => {
    const r = juzga({ tuyo: 'I/4 IV/4', path: 'seguir', salida: 'V/2 I/6' });
    expect(motivo(r, 'cadencia')).toContain('a destiempo');
  });

  it('en lo modal la cadencia fuerte es la del bVII, no la del V', () => {
    const conV = juzga({ tuyo: 'I bVII I bVII', path: 'seguir', salida: 'IV iv V I' });
    expect(motivo(conV, 'cadencia')).toBe(
      'V I en el 8: cadencia perfecta, pero lo tuyo no tiene sensible.',
    );
    const conBVII = juzga({ tuyo: 'I bVII I bVII', path: 'seguir', salida: 'IV bVI bVII I' });
    expect(valor(conBVII, 'cadencia')).toBeGreaterThan(valor(conV, 'cadencia'));
    // La plagal no cambia: en modal pesa lo mismo que fuera.
    const plagal = juzga({ tuyo: 'I bVII I bVII', path: 'seguir', salida: 'IV IV IV I' });
    expect(valor(plagal, 'cadencia')).toBeGreaterThan(0);
  });

  it('un final o un estribillo que se quedan abiertos no se ofrecen; una estrofa, un pre o un puente pueden', () => {
    // Lo tuyo cierra en casa: si acabara fuera sería un bucle, y un bucle se juzga
    // por cómo vuelve a empezar (más abajo).
    const abierto = (papel: 'estribillo' | 'final' | 'estrofa' | 'pre' | 'intro' | 'puente') =>
      juzga({
        kind: 'retocar',
        tuyo: 'I V vi I',
        path: 'otro-final',
        salida: 'I V vi V',
        contexto: { papel },
      });
    // Antes entraban con 50 o 60 puntos: un final que no cierra no es un final flojo,
    // es no hacer lo que la parte hace.
    expect(valor(abierto('estribillo'), 'cadencia')).toBe(-1);
    expect(motivo(abierto('final'), 'cadencia')).toBe('Acaba en V: un final que acaba abierto.');
    expect(abierto('final').descarte).toBe('un final que acaba abierto');
    expect(motivo(abierto('estribillo'), 'cadencia')).toBe(
      'Acaba en V: un estribillo sin llegada.',
    );
    expect(abierto('estribillo').descarte).toBe('un estribillo sin llegada');
    // Las que llevan a otra parte pueden quedar abiertas, el puente también.
    expect(valor(abierto('estrofa'), 'cadencia')).toBe(valor(abierto('puente'), 'cadencia'));
    expect(motivo(abierto('pre'), 'cadencia')).toContain('Un pre puede quedar abierto.');
    expect(motivo(abierto('puente'), 'cadencia')).toContain('Un puente puede quedar abierto.');
    expect(valor(abierto('intro'), 'cadencia')).toBeGreaterThan(0);
  });

  it('una semicadencia a mitad de un grupo, o acabar en IV o en vi, no se sostiene', () => {
    const mitad = juzga({
      kind: 'retocar',
      tuyo: 'I vi IV I',
      path: 'otro-final',
      salida: 'I vi V',
    });
    expect(motivo(mitad, 'cadencia')).toBe('Acaba en V a mitad de un grupo de cuatro.');
    const enIV = juzga({
      kind: 'retocar',
      tuyo: 'I vi IV I',
      path: 'otro-final',
      salida: 'I vi V IV',
    });
    const enVi = juzga({
      kind: 'retocar',
      tuyo: 'I vi IV I',
      path: 'otro-final',
      salida: 'I IV V vi',
    });
    expect(valor(enIV, 'cadencia')).toBeGreaterThan(valor(enVi, 'cadencia'));
    expect(motivo(enVi, 'cadencia')).toBe('Acaba en vi, ni en la tónica ni en la dominante.');
  });

  it('un contraste se juzga por cómo vuelve a tu principio', () => {
    const vuelve = juzga({ tuyo: 'I vi IV V', path: 'contraste', salida: 'vi ii IV V' });
    expect(motivo(vuelve, 'cadencia')).toBe(
      'Vuelve a tu principio por V I: la dominante resuelve en la tónica.',
    );
    const cerrado = juzga({ tuyo: 'I vi IV V', path: 'contraste', salida: 'vi ii V I' });
    expect(valor(cerrado, 'cadencia')).toBeLessThan(0);
    const igual = juzga({ tuyo: 'vi IV I V', path: 'contraste', salida: 'ii IV ii vi' });
    expect(motivo(igual, 'cadencia')).toContain('el acorde con el que empiezas');
    expect(valor(vuelve, 'cadencia')).toBeGreaterThan(valor(igual, 'cadencia'));
  });
});

describe('3. frase', () => {
  it('una canción de siete compases pierde frente a una de ocho, y no se ofrece', () => {
    const siete = juzga({ tuyo: 'I IV I V', path: 'seguir', salida: 'IV V I' });
    const ocho = juzga({ tuyo: 'I IV I V', path: 'seguir', salida: 'IV V I I' });
    expect(valor(ocho, 'frase')).toBe(1);
    expect(valor(siete, 'frase')).toBe(-1);
    expect(siete.descarte).toBe('una frase coja de 7 compases');
    expect(ocho.puntos).toBeGreaterThan(siete.puntos);
  });

  it('cinco no es coja si el quinto es la llegada: el compás fuerte del grupo siguiente', () => {
    const r = juzga({ tuyo: 'I vi IV V', path: 'seguir', salida: 'I' });
    expect(valor(r, 'frase')).toBe(0.7);
    expect(r.descarte).toBeNull();
  });

  it('seis compases no cuadran; dos son una vuelta que cabe en la frase de cuatro', () => {
    expect(valor(juzga({ tuyo: 'I IV I V', path: 'seguir', salida: 'IV I' }), 'frase')).toBe(-0.5);
    const dos = juzga({
      kind: 'retocar',
      tuyo: 'I IV I V',
      path: 'estirar',
      salida: 'I/2 IV/2 I/2 V/2',
    });
    expect(valor(dos, 'frase')).toBe(0.2);
  });

  it('tu frase de cinco, repetida, es tu frase', () => {
    const r = juzga({ tuyo: 'I IV V vi V', path: 'seguir', salida: 'I IV V vi V' });
    expect(motivo(r, 'frase')).toBe('10 compases: tu frase de 5, repetida.');
  });

  it('si mantiene tus compases no dice nada, aunque fueran tres', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I IV V',
      path: 'rearmonizar',
      salida: 'I ii{relativo} V',
    });
    expect(criterio(r, 'frase')).toEqual({
      id: 'frase',
      valor: 0,
      motivo: 'Mantiene tus 3 compases.',
    });
  });

  it('acabar a mitad de compás se descarta al continuar, y al estirar solo si no estira parejo', () => {
    const continuar = juzga({ tuyo: 'I/2 IV/2 V/2 IV/2', path: 'seguir', salida: 'V/2' });
    expect(continuar.descarte).toBe('la frase acaba a mitad de compás');
    // Lo tuyo ya acababa a mitad, y el doble también: estirar parejo solo resta.
    const parejo = juzga({
      kind: 'retocar',
      tuyo: 'I/2 IV/1 V/2 I/2',
      path: 'estirar',
      salida: 'I/4 IV/2 V/4 I/4',
    });
    expect(valor(parejo, 'frase')).toBe(-1);
    expect(parejo.descarte).toBeNull();
    // Uno que no da ni el doble ni la mitad —un acorde que no se estiró con los
    // demás— ha decidido el largo, y lo ha dejado a medias.
    const cojo = juzga({
      kind: 'retocar',
      tuyo: 'I/2 IV/2 V/2 I/2 IV/4',
      path: 'estirar',
      salida: 'I/2 IV/2 V/2 I/2 IV/2',
    });
    expect(cojo.descarte).toBe('la frase acaba a mitad de compás');
  });

  it('la tónica final sostenida no alarga la frase', () => {
    const r = juzga({ kind: 'retocar', tuyo: 'ii V I I', path: 'estirar', salida: 'ii V I I/8' });
    expect(valor(r, 'frase')).toBe(1);
  });

  it('un blues se cuenta de doce en doce', () => {
    const blues = 'I I I I IV IV I I V IV I V';
    const coro = juzga({ tuyo: blues, path: 'seguir', salida: 'I I I I IV IV I I V IV I I' });
    expect(motivo(coro, 'frase')).toBe('24 compases: la forma de doce del blues, entera.');
    const trece = juzga({ tuyo: blues, path: 'seguir', salida: 'I' });
    expect(valor(trece, 'frase')).toBe(0.7);
    const dieciseis = juzga({ tuyo: blues, path: 'contraste', salida: 'vi IV ii V' });
    expect(motivo(dieciseis, 'frase')).toBe('16 compases: rompe la forma de doce del blues.');
  });
});

describe('4. ritmo armónico', () => {
  it('los acordes nuevos duran lo que los tuyos', () => {
    const r = juzga({ tuyo: 'I vi IV V', path: 'seguir', salida: 'I' });
    expect(valor(r, 'ritmo-armonico')).toBe(1);
  });

  it('seguir a otro paso que el tuyo cambia la armonía a mitad', () => {
    const r = juzga({ tuyo: 'I/8 IV/8 V/8 I/8', path: 'seguir', salida: 'vi/4 IV/4 V/4 I/4' });
    expect(valor(r, 'ritmo-armonico')).toBeLessThan(0);
    const igual = juzga({ tuyo: 'I/8 IV/8 V/8 I/8', path: 'seguir', salida: 'vi/8 IV/8 V/8 I/8' });
    expect(igual.puntos).toBeGreaterThan(r.puntos);
  });

  it('alargar la tónica final está bien', () => {
    const r = juzga({ tuyo: 'I vi IV V', path: 'seguir', salida: 'I/8' });
    expect(motivo(r, 'ritmo-armonico')).toBe(
      'La tónica final dura 8 pulsos: la llegada se sostiene.',
    );
  });

  it('nada de compases de un pulso si lo tuyo no los tenía', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I/2 IV/2 V/2 IV/2',
      path: 'estirar',
      salida: 'I/1 IV/1 V/1 IV/1',
    });
    expect(valor(r, 'ritmo-armonico')).toBe(-1);
    expect(motivo(r, 'ritmo-armonico')).toBe(
      'El I del 1 dura un pulso, y lo tuyo no tenía ninguno así.',
    );
  });

  it('un acorde que dura lo que no cuadra con el compás, o que cambia a destiempo', () => {
    const r = juzga({ tuyo: 'I IV I IV', path: 'seguir', salida: 'V/3 I/5' });
    expect(motivo(r, 'ritmo-armonico')).toMatch(/destiempo|no cuadra/);
    expect(valor(r, 'ritmo-armonico')).toBeLessThan(0);
  });

  it('al estirar: medio tiempo respira, doble tiempo corre más que lo tuyo', () => {
    const medio = juzga({
      kind: 'retocar',
      tuyo: 'I IV V IV',
      path: 'estirar',
      salida: 'I/8 IV/8 V/8 IV/8',
    });
    expect(motivo(medio, 'ritmo-armonico')).toContain('Todo dura el doble');
    const doble = juzga({
      kind: 'retocar',
      tuyo: 'I IV V IV',
      path: 'estirar',
      salida: 'I/2 IV/2 V/2 IV/2',
    });
    expect(motivo(doble, 'ritmo-armonico')).toContain('corre más que lo tuyo');
    expect(valor(medio, 'ritmo-armonico')).toBeGreaterThan(valor(doble, 'ritmo-armonico'));
    // Doble tiempo sobre acordes de dos compases sigue siendo un compás entero.
    const entero = juzga({
      kind: 'retocar',
      tuyo: 'I/8 IV/8 V/8 I/8',
      path: 'estirar',
      salida: 'I/4 IV/4 V/4 I/4',
    });
    expect(motivo(entero, 'ritmo-armonico')).toContain('un compás entero');
    // Lo que ya tenías a dos pulsos puede seguir a dos.
    const comoTuyos = juzga({
      kind: 'retocar',
      tuyo: 'I IV V/2 I/2 IV',
      path: 'estirar',
      salida: 'I IV/2 V/2 I/2 IV',
    });
    expect(motivo(comoTuyos, 'ritmo-armonico')).toContain('como algunos tuyos');
    const otro = juzga({
      kind: 'retocar',
      tuyo: 'I IV V I',
      path: 'estirar',
      salida: 'I IV V/6 I',
    });
    expect(motivo(otro, 'ritmo-armonico')).toContain('pasa a durar 6 pulsos');
    // Más del doble que el más largo de lo tuyo es relleno: solo entra por la red.
    const relleno = juzga({
      kind: 'retocar',
      tuyo: 'I IV V I',
      path: 'estirar',
      salida: 'I IV V/12 I',
    });
    expect(motivo(relleno, 'ritmo-armonico')).toContain('rellena');
    conReparo(relleno);
  });

  it('cambiar un acorde en su sitio no cambia el paso', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I V vi IV',
      path: 'rearmonizar',
      salida: 'I V vi iv{intercambio}',
    });
    expect(criterio(r, 'ritmo-armonico')).toEqual({ id: 'ritmo-armonico', valor: 0, motivo: '' });
    const larga = juzga({
      kind: 'retocar',
      tuyo: 'I IV V',
      path: 'otro-final',
      salida: 'I IV V I',
    });
    expect(valor(larga, 'ritmo-armonico')).toBe(1);
  });

  it('una toma desigual se cuadra, y lo que no la cuadra hereda el tropiezo', () => {
    const tuyo = 'I/5 V/3 vi/6 IV/2';
    const cuadra = juzga({ kind: 'retocar', tuyo, path: 'estirar', salida: 'I V vi IV' });
    expect(motivo(cuadra, 'ritmo-armonico')).toBe(
      'Cuadra tu toma: cada acorde dura lo mismo, o compases enteros.',
    );
    expect(motivo(cuadra, 'novedad')).toBe('Cuadra tu toma sin tocar un solo acorde.');
    expect(motivo(cuadra, 'forma')).toBe('Tu toma desigual queda en 4 compases de 4 pulsos.');
    const enteros = juzga({ kind: 'retocar', tuyo, path: 'estirar', salida: 'I/8 V/4 vi/4 IV/8' });
    expect(valor(enteros, 'ritmo-armonico')).toBe(1);
    const hereda = juzga({ kind: 'retocar', tuyo, path: 'estirar', salida: 'I/10 V/6 vi/12 IV/4' });
    expect(valor(hereda, 'ritmo-armonico')).toBe(-1);
    const otroFinal = juzga({
      kind: 'retocar',
      tuyo,
      path: 'otro-final',
      salida: 'I/5 V/3 vi/6 V/2',
    });
    expect(cuadra.puntos).toBeGreaterThan(otroFinal.puntos);
  });

  it('en tres por cuatro el compás manda de tres en tres', () => {
    const r = juzga({
      tuyo: 'I/3 IV/3 V/3 I/3',
      path: 'seguir',
      salida: 'IV/3 V/3 I/6',
      contexto: { pulsosPorCompas: 3 },
    });
    expect(valor(r, 'ritmo-armonico')).toBe(1);
    expect(valor(r, 'frase')).toBe(1);
  });
});

describe('5. bajo', () => {
  /** El salto del bajo de lo último tuyo a un solo acorde nuevo. */
  const salto = (tuyo: string, salida: string, mode: KeyMode = 'major') =>
    juzga({ mode, tuyo, path: 'seguir', salida });

  it.each([
    ['I V', 'I', 'V I: el bajo baja una quinta, el enlace más fuerte.'],
    ['I IV', 'V', 'IV V: el bajo sube un tono.'],
    ['I vi', 'I', 'vi I: el bajo sube una tercera, el salto débil.'],
    ['I IV', 'I', 'IV I: el bajo sube una quinta.'],
    ['I V', 'iii', 'V iii: el bajo baja una tercera, suave.'],
    ['I bVII', 'bVI', 'bVII bVI: el bajo baja un tono.'],
    ['I IV', 'iv', 'IV iv: el bajo se queda en la misma nota.'],
    ['I IV', 'vii°', 'IV vii°: el bajo salta una cuarta aumentada.'],
  ])('%s y luego %s', (tuyo, salida, texto) => {
    expect(motivo(salto(tuyo, salida), 'bajo')).toBe(texto);
  });

  it('bajar una quinta pesa más que subir una tercera', () => {
    expect(valor(salto('I V', 'I'), 'bajo')).toBeGreaterThan(valor(salto('I vi', 'I'), 'bajo'));
  });

  it('medio tono abajo solo vale si es el sustituto que llega, o la bajada a la dominante', () => {
    const tritono = juzga({
      kind: 'retocar',
      tuyo: 'ii V I I',
      path: 'rearmonizar',
      salida: 'ii bII{tritono} I I',
    });
    expect(motivo(tritono, 'bajo')).toBe('bII I: el bajo baja medio tono hasta lo que preparaba.');
    expect(motivo(salto('I ii', 'bII{tritono}'), 'bajo')).toBe(
      'ii bII: el bajo baja por semitonos hacia el sustituto tritonal.',
    );
    expect(motivo(salto('i VI', 'V', 'minor'), 'bajo')).toBe(
      'VI V: el bajo baja medio tono hasta la dominante.',
    );
    expect(motivo(salto('I IV', 'iii'), 'bajo')).toBe(
      'IV iii: el bajo baja medio tono sin ir a ningún sitio.',
    );
  });

  it('medio tono arriba es una sensible si sale de la dominante', () => {
    expect(motivo(salto('i V', 'VI', 'minor'), 'bajo')).toBe(
      'V VI: el bajo sube medio tono, como una sensible.',
    );
    expect(motivo(salto('I', 'bII{tritono}'), 'bajo')).toBe(
      'I bII: el bajo sube medio tono sin resolver nada.',
    );
  });
});

describe('6. notas comunes y coherencia de los sustitutos', () => {
  it('el relativo comparte dos notas y hace el mismo papel', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I V vi IV',
      path: 'rearmonizar',
      salida: 'I iii{relativo} vi IV',
    });
    expect(motivo(r, 'notas-comunes')).toBe('V por iii en el 2: comparten 2 notas.');
    expect(valor(r, 'notas-comunes')).toBe(0.8);
  });

  it('un sustituto sin notas en común ni papel, como un vi en lugar del V, no se sostiene', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I vi ii V',
      path: 'rearmonizar',
      salida: 'I vi ii vi{interrumpida}',
    });
    expect(motivo(r, 'notas-comunes')).toBe(
      'V por vi en el 4: no comparten ninguna nota y no hacen el mismo papel.',
    );
    const unaNota = juzga({
      kind: 'retocar',
      tuyo: 'I vi IV I',
      path: 'rearmonizar',
      salida: 'I vi I I',
    });
    expect(motivo(unaNota, 'notas-comunes')).toContain('comparten una sola nota');
    const mismoPapel = juzga({
      kind: 'retocar',
      tuyo: 'I ii V I',
      path: 'rearmonizar',
      salida: 'I ii bVII I',
    });
    expect(motivo(mismoPapel, 'notas-comunes')).toBe(
      'V por bVII en el 3: comparten una sola nota y hacen el mismo papel.',
    );
  });

  it('la cadencia rota de verdad es la relativa en el sitio de la I, detrás de un V', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'ii V I I',
      path: 'rearmonizar',
      salida: 'ii V vi{relativo} I',
    });
    expect(motivo(r, 'notas-comunes')).toContain('cadencia rota de verdad');
    expect(valor(r, 'notas-comunes')).toBe(1);
  });

  it('el préstamo trae el mismo grado del modo paralelo; un bVI que se vuelve V no lo es', () => {
    const prestamo = juzga({
      kind: 'retocar',
      tuyo: 'I V vi IV',
      path: 'rearmonizar',
      salida: 'I V bVI{prestamo} IV',
    });
    expect(motivo(prestamo, 'notas-comunes')).toBe(
      'vi por bVI en el 3: el mismo grado traído del modo paralelo, otro color.',
    );
    const falso = juzga({
      kind: 'retocar',
      tuyo: 'I bVI bVII I',
      path: 'rearmonizar',
      salida: 'I V{prestamo} bVII I',
    });
    expect(valor(falso, 'notas-comunes')).toBe(-1);
  });

  it('el sustituto tritonal tiene que bajar medio tono a lo que preparaba', () => {
    const llega = juzga({
      kind: 'retocar',
      tuyo: 'ii V I I',
      path: 'rearmonizar',
      salida: 'ii bII{tritono} I I',
    });
    expect(valor(llega, 'notas-comunes')).toBe(1);
    const noLlega = juzga({
      kind: 'retocar',
      tuyo: 'I I V IV I I',
      path: 'rearmonizar',
      salida: 'I I bII{tritono} IV I I',
    });
    expect(motivo(noLlega, 'notas-comunes')).toBe(
      'bII en el 3 prepara otro acorde, y detrás viene IV.',
    );
    // Al final de una vuelta, lo que viene detrás es el principio.
    const vuelta = juzga({
      kind: 'retocar',
      tuyo: 'I vi ii V',
      path: 'rearmonizar',
      salida: 'I vi ii bII{tritono}',
    });
    expect(valor(vuelta, 'notas-comunes')).toBe(1);
  });

  it('lo que se oyó con duda se corrige con lo que comparte notas, y no se construye encima', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I V vi IV',
      path: 'rearmonizar',
      salida: 'I iii{relativo} vi IV',
      contexto: { dudosos: [false, true, false, false] },
    });
    expect(criterio(r, 'notas-comunes')).toEqual({
      id: 'notas-comunes',
      valor: 0.6,
      motivo:
        'El 2 se oyó con duda: iii comparte dos notas con lo que se oyó, y puede ser lo que sonó.',
    });
    // Un préstamo con una sola nota en común no corrige nada: construye encima.
    const lejos = juzga({
      kind: 'retocar',
      tuyo: 'I V vi IV',
      path: 'rearmonizar',
      salida: 'I V bVI{prestamo} IV',
      contexto: { dudosos: [false, false, true, false] },
    });
    expect(motivo(lejos, 'notas-comunes')).toBe(
      'El 3 se oyó con duda: sustituirlo es construir sobre algo que no se sabe.',
    );
  });

  it('otro final no es una sustitución: pone otra música', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I vi ii V',
      path: 'otro-final',
      salida: 'I vi ii I',
    });
    expect(criterio(r, 'notas-comunes').valor).toBe(0);
  });
});

describe('7. melodía', () => {
  /** Mi fuerte en cada compás: la tercera de Do, la quinta de La menor. */
  const mi = [{ nota: 4, fuerte: true }];

  it('cuenta las notas fuertes del punteo que caben en los acordes cambiados', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I V vi IV',
      path: 'rearmonizar',
      salida: 'I iii{relativo} vi IV',
      contexto: {
        melodia: [
          mi,
          [
            { nota: 7, fuerte: true },
            { nota: 9, fuerte: false },
          ],
          mi,
          mi,
        ],
      },
    });
    expect(criterio(r, 'melodia')).toEqual({
      id: 'melodia',
      valor: 1,
      motivo: 'La nota fuerte del punteo cabe en el acorde cambiado.',
    });
  });

  it('lo que choca con el punteo no se ofrece', () => {
    const choque = [{ nota: 1, fuerte: true }];
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I V vi IV',
      path: 'rearmonizar',
      salida: 'I iii{relativo} vi ii{relativo}',
      contexto: { melodia: [mi, [...choque, ...choque], mi, choque] },
    });
    expect(valor(r, 'melodia')).toBe(-1);
    expect(r.descarte).toBe('choca con el punteo');
  });

  it('cada estilo admite sus tensiones', () => {
    const novena = [{ nota: 4, fuerte: true }];
    const pregunta = (estilo?: 'jazz') =>
      juzga({
        kind: 'retocar',
        tuyo: 'I V vi IV',
        path: 'rearmonizar',
        salida: 'I V vi ii{relativo}',
        contexto: { melodia: [[], [], [], novena], ...(estilo === undefined ? {} : { estilo }) },
      });
    // Mi sobre Re menor es la novena: el jazz la admite y sin estilo no.
    expect(valor(pregunta('jazz'), 'melodia')).toBe(1);
    expect(valor(pregunta(), 'melodia')).toBe(-1);
  });

  it('al continuar no dice nada, pero cuenta que hay punteo', () => {
    const contexto = { melodia: [mi, mi, mi, mi] };
    const continuar = juzga({ tuyo: 'I V vi IV', path: 'seguir', salida: 'V I', contexto });
    expect(criterio(continuar, 'melodia')).toEqual({ id: 'melodia', valor: 0, motivo: '' });
    const sinFuertes = juzga({
      tuyo: 'I V vi IV',
      path: 'seguir',
      salida: 'V I',
      contexto: { melodia: [[{ nota: 4, fuerte: false }]] },
    });
    // Sin notas fuertes no hay punteo que mirar: los puntos no cambian.
    expect(sinFuertes.puntos).toBe(
      juzga({ tuyo: 'I V vi IV', path: 'seguir', salida: 'V I' }).puntos,
    );
  });

  it('al estirar el punteo no se estira: cae sobre otros acordes, o sin ninguno', () => {
    const contexto = { melodia: [mi, mi, mi, mi] };
    // A medio tiempo, el Mi de tu V suena sobre tu I, que dura el doble, y el de tu
    // vi y tu IV sobre el V: una sexta, que no cabe.
    const medio = juzga({
      kind: 'retocar',
      tuyo: 'I V vi IV',
      path: 'estirar',
      salida: 'I/8 V/8 vi/8 IV/8',
      contexto,
    });
    expect(criterio(medio, 'melodia')).toEqual({
      id: 'melodia',
      valor: -0.33,
      motivo: '1 de 3 notas fuertes del punteo caben en los acordes cambiados.',
    });
    // A doble tiempo la canción se acaba en la mitad de tu punteo.
    const doble = juzga({
      kind: 'retocar',
      tuyo: 'I V vi IV',
      path: 'estirar',
      salida: 'I/2 V/2 vi/2 IV/2',
      contexto,
    });
    expect(doble.descarte).toBe('deja el punteo sin acordes debajo');
    expect(motivo(doble, 'melodia')).toBe(
      'Tu punteo sigue en el compás 3 y la canción ya se ha acabado: se queda sin acordes debajo.',
    );
    // Si lo que se queda sin acordes son notas débiles, resta pero no descarta.
    const debil = juzga({
      kind: 'retocar',
      tuyo: 'I V vi IV',
      path: 'estirar',
      salida: 'I/2 V/2 vi/2 IV/2',
      contexto: { melodia: [[], [], [{ nota: 4, fuerte: false }]] },
    });
    expect(valor(debil, 'melodia')).toBe(-1);
    expect(debil.descarte).toBeNull();
  });

  it('una nota débil que choca resta aunque no caiga en el fuerte', () => {
    // El La fuerte cabe en el Re7; el Fa débil roza su Fa#.
    const conDebil = juzga({
      kind: 'retocar',
      tuyo: 'I ii V I',
      path: 'rearmonizar',
      salida: 'I V/V V I',
      contexto: {
        melodia: [
          [],
          [
            { nota: 9, fuerte: true },
            { nota: 5, fuerte: false },
          ],
          [],
          [],
        ],
      },
    });
    expect(valor(conDebil, 'melodia')).toBe(-1);
    expect(motivo(conDebil, 'melodia')).toBe(
      'En el 2, una nota débil del punteo queda medio tono por debajo de una del V/V: se oye aunque no caiga en el fuerte.',
    );
    expect(conDebil.descarte).toBeNull();
    expect(conDebil.puntos).toBeGreaterThanOrEqual(ENCAJE_MINIMO);
    // La que queda encima es la novena menor —un Do débil sobre el Si de un Sol—:
    // tiene reparo, y solo entra por la red.
    const encima = juzga({
      kind: 'retocar',
      tuyo: 'I IV ii V',
      path: 'otro-final',
      salida: 'I IV V V',
      contexto: {
        melodia: [
          [],
          [],
          [
            { nota: 2, fuerte: true },
            { nota: 0, fuerte: false },
          ],
          [],
        ],
      },
    });
    expect(motivo(encima, 'melodia')).toBe(
      'En el 3, una nota débil del punteo queda medio tono por encima de una del V: se oye aunque no caiga en el fuerte.',
    );
    conReparo(encima);
    // Entre varias, se cuenta la primera, y la de encima manda sobre las de debajo.
    const varias = (melodia: { nota: number; fuerte: boolean }[][]) =>
      juzga({
        kind: 'retocar',
        tuyo: 'I ii ii V',
        path: 'rearmonizar',
        salida: 'I V/V V/V V',
        contexto: { melodia },
      });
    const fa = [{ nota: 5, fuerte: false }];
    const mib = [{ nota: 3, fuerte: false }];
    expect(motivo(varias([[], fa, fa, []]), 'melodia')).toContain('En el 2,');
    expect(motivo(varias([[], fa, mib, []]), 'melodia')).toContain(
      'En el 3, una nota débil del punteo queda medio tono por encima',
    );
    const sinElla = juzga({
      kind: 'retocar',
      tuyo: 'I ii V I',
      path: 'rearmonizar',
      salida: 'I V/V V I',
      contexto: { melodia: [[], [{ nota: 9, fuerte: true }], [], []] },
    });
    expect(conDebil.puntos).toBeLessThan(sinElla.puntos - 5);
    // Una nota de paso que no es del acorde pero no roza ninguna no resta.
    const dePaso = juzga({
      kind: 'retocar',
      tuyo: 'I ii V I',
      path: 'rearmonizar',
      salida: 'I V/V V I',
      contexto: {
        melodia: [
          [],
          [
            { nota: 9, fuerte: true },
            { nota: 4, fuerte: false },
          ],
          [],
          [],
        ],
      },
    });
    expect(valor(dePaso, 'melodia')).toBe(1);
    // Y un punteo de solo notas débiles que no chocan no cuenta en los puntos.
    const soloDebiles = juzga({
      kind: 'retocar',
      tuyo: 'I ii V I',
      path: 'rearmonizar',
      salida: 'I V/V V I',
      contexto: { melodia: [[], [{ nota: 4, fuerte: false }], [], []] },
    });
    expect(soloDebiles.puntos).toBe(
      juzga({ kind: 'retocar', tuyo: 'I ii V I', path: 'rearmonizar', salida: 'I V/V V I' }).puntos,
    );
  });

  it('si en los compases cambiados no hay notas fuertes, no hay nada que medir', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I V vi IV',
      path: 'rearmonizar',
      salida: 'I iii{relativo} vi IV',
      contexto: { melodia: [mi] },
    });
    expect(criterio(r, 'melodia')).toEqual({ id: 'melodia', valor: 0, motivo: '' });
  });
});

describe('8. estilo', () => {
  it('los giros del estilo suman, y los de otro restan', () => {
    const jazz = juzga({
      tuyo: 'I vi',
      path: 'seguir',
      salida: 'ii V I I',
      contexto: { estilo: 'jazz' },
    });
    expect(motivo(jazz, 'estilo')).toBe('ii V I, la célula del jazz.');
    const rock = juzga({
      tuyo: 'I vi',
      path: 'seguir',
      salida: 'ii V I I',
      contexto: { estilo: 'rock' },
    });
    expect(motivo(rock, 'estilo')).toBe('ii V I suena a jazz, no a rock.');
    expect(valor(jazz, 'estilo')).toBeGreaterThan(valor(rock, 'estilo'));
  });

  it('los préstamos pesan según el estilo', () => {
    const rock = juzga({
      tuyo: 'I IV',
      path: 'contraste',
      salida: 'iv iv bIII bIII',
      contexto: { estilo: 'rock' },
    });
    expect(motivo(rock, 'estilo')).toBe('iv es un préstamo, de casa en rock.');
    const pop = juzga({
      tuyo: 'I IV',
      path: 'contraste',
      salida: 'iv iv bIII bIII',
      contexto: { estilo: 'pop' },
    });
    expect(motivo(pop, 'estilo')).toBe('iv es un préstamo, y en pop pesa poco.');
    expect(valor(rock, 'estilo')).toBeGreaterThan(valor(pop, 'estilo'));
    // El motivo dice lo que resta: una secundaria no es «de la tonalidad».
    const folk = juzga({
      tuyo: 'I IV',
      path: 'seguir',
      salida: 'V/V V',
      contexto: { estilo: 'folk' },
    });
    expect(motivo(folk, 'estilo')).toBe('V/V es una dominante secundaria, y en folk pesa poco.');
    // Y el bVII del folk no resta: es su mixolidio.
    const celta = juzga({
      tuyo: 'I IV',
      path: 'seguir',
      salida: 'I bVII',
      contexto: { estilo: 'folk' },
    });
    expect(valor(celta, 'estilo')).toBeGreaterThan(0);
  });

  it('lo de casa es lo de casa', () => {
    const r = juzga({
      tuyo: 'I IV',
      path: 'contraste',
      salida: 'vi iii vi V',
      contexto: { estilo: 'folk' },
    });
    expect(motivo(r, 'estilo')).toBe('Acordes de la tonalidad, lo de casa en folk.');
  });

  it('la especie también cuenta: en jazz pesa la cuatríada', () => {
    const triada = juzga({
      tuyo: 'I vi',
      path: 'contraste',
      salida: 'iii vi ii V',
      contexto: { estilo: 'jazz' },
    });
    const cuatriadas = encaje(
      'major',
      'continuar',
      pasos('I vi'),
      { estilo: 'jazz' },
      {
        path: 'contraste',
        cancion: [
          ...pasos('I vi'),
          ...pasos('iii vi ii V').map((paso) => ({
            ...paso,
            especie: paso.degree === 'V' ? ('dominant7' as const) : ('minor7' as const),
          })),
        ],
      },
    );
    expect(valor(cuatriadas, 'estilo')).toBeGreaterThan(valor(triada, 'estilo'));
  });

  it('las quintas sin tercera son de casa en rock y no en jazz', () => {
    const quintas = (estilo: 'rock' | 'jazz') =>
      encaje(
        'major',
        'continuar',
        pasos('I IV'),
        { estilo },
        {
          path: 'contraste',
          cancion: [
            ...pasos('I IV'),
            ...pasos('vi IV ii V').map((paso) => ({ ...paso, especie: 'quinta' as const })),
          ],
        },
      );
    expect(valor(quintas('rock'), 'estilo')).toBeGreaterThan(valor(quintas('jazz'), 'estilo'));
  });

  it('un sustituto tritonal o un napolitano donde el estilo no los usa no se ofrece', () => {
    const folk = juzga({
      kind: 'retocar',
      tuyo: 'I IV V I',
      path: 'rearmonizar',
      salida: 'I IV bII{tritono} I',
      contexto: { estilo: 'folk' },
    });
    expect(motivo(folk, 'estilo')).toBe('bII como sustituto tritonal no se usa en folk.');
    expect(folk.descarte).toBe('bII no es de folk');
    const napolitano = juzga({
      tuyo: 'I IV',
      path: 'seguir',
      salida: 'bII V I I',
      contexto: { estilo: 'pop' },
    });
    expect(motivo(napolitano, 'estilo')).toBe('bII como napolitano no se usa en pop.');
    const metal = juzga({
      tuyo: 'I IV',
      path: 'seguir',
      salida: 'bII V I I',
      contexto: { estilo: 'metal' },
    });
    expect(metal.descarte).toBeNull();
  });

  it('las familias: secundaria, disminuido y el resto', () => {
    const r = juzga({
      tuyo: 'I IV',
      path: 'seguir',
      salida: 'V/V V vii° I',
      contexto: { estilo: 'pop' },
    });
    expect(valor(r, 'estilo')).toBeLessThan(1);
    const menor = juzga({
      mode: 'minor',
      tuyo: 'i iv',
      path: 'seguir',
      salida: 'ii° V i i',
      contexto: { estilo: 'jazz' },
    });
    expect(motivo(menor, 'estilo')).toBe('ii° V i, la célula del jazz en menor.');
  });

  it('cambiar solo los pulsos no cambia el estilo', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I bVII IV I',
      path: 'estirar',
      salida: 'I/8 bVII/8 IV/8 I/8',
      contexto: { estilo: 'jazz' },
    });
    expect(motivo(r, 'estilo')).toBe('Los mismos acordes: el estilo no cambia.');
    expect(motivo(r, 'novedad')).toBe('Los mismos acordes: lo nuevo es el reparto.');
  });
});

describe('9. novedad frente a coherencia', () => {
  it('rearmonizar no toca la tónica del compás 1: es un reparo, no un descarte', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I I I I',
      path: 'rearmonizar',
      salida: 'vi{relativo} vi{relativo} vi{relativo} vi{relativo}',
    });
    conReparo(r);
    expect(motivo(r, 'novedad')).toContain('donde la canción dice su tonalidad');
  });

  it('ni quita la llegada a la tónica que ya cerraba', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I bVII IV I',
      path: 'rearmonizar',
      salida: 'I bVII IV vi{relativo}',
    });
    expect(motivo(r, 'novedad')).toBe('Quita la llegada a I del compás 4, que ya cerraba.');
  });

  it('una franja: un compás o la mitad está bien, cambiarlo todo no', () => {
    const tuyo = 'I V vi IV I V vi IV';
    const uno = juzga({
      kind: 'retocar',
      tuyo,
      path: 'rearmonizar',
      salida: 'I V vi IV I V vi iv{intercambio}',
    });
    expect(valor(uno, 'novedad')).toBe(0.7);
    const dos = juzga({
      kind: 'retocar',
      tuyo,
      path: 'rearmonizar',
      salida: 'I iii{relativo} vi IV I iii{relativo} vi IV',
    });
    expect(valor(dos, 'novedad')).toBe(1);
    const seis = juzga({
      kind: 'retocar',
      tuyo,
      path: 'rearmonizar',
      salida: 'I iii{relativo} I{relativo} ii{relativo} I iii{relativo} IV ii{relativo}',
    });
    expect(valor(seis, 'novedad')).toBe(-0.2);
    const casiTodo = juzga({
      kind: 'retocar',
      tuyo: 'IV V vi IV',
      path: 'rearmonizar',
      salida: 'ii iii I ii',
    });
    expect(motivo(casiTodo, 'novedad')).toBe('Cambia 4 de 4 compases: ya no es tu canción.');
  });

  it('un tope de préstamos fuera del rock: el blues admite dos, lo demás uno', () => {
    const contraste = (estilo: 'pop' | 'blues' | 'rock') =>
      juzga({
        tuyo: 'I V vi IV',
        path: 'contraste',
        salida: 'iv bVII bVI bVII',
        contexto: { estilo },
      });
    expect(motivo(contraste('pop'), 'novedad')).toBe(
      '4 compases prestados (iv, bVII, bVI): más de lo que pide una canción en pop.',
    );
    expect(valor(contraste('blues'), 'novedad')).toBeGreaterThan(
      valor(contraste('pop'), 'novedad'),
    );
    expect(valor(contraste('rock'), 'novedad')).toBe(1);
  });

  it('un contraste contrasta; uno que repite tus acordes, no', () => {
    const tuyo = 'I V vi IV';
    expect(valor(juzga({ tuyo, path: 'contraste', salida: 'ii iii ii V' }), 'novedad')).toBe(1);
    expect(valor(juzga({ tuyo, path: 'contraste', salida: 'vi IV ii V' }), 'novedad')).toBe(0.3);
    expect(motivo(juzga({ tuyo, path: 'contraste', salida: 'vi IV vi V' }), 'novedad')).toBe(
      'La parte nueva usa solo tus acordes: no contrasta.',
    );
  });

  it('repetir tu vuelta es otro coro en un vamp, un riff o un blues; en lo demás no aporta', () => {
    expect(
      motivo(juzga({ tuyo: 'I vi IV V', path: 'seguir', salida: 'I vi IV V' }), 'novedad'),
    ).toBe('Repite tu vuelta sin aportar nada.');
    expect(
      motivo(juzga({ tuyo: 'I IV I IV', path: 'seguir', salida: 'I IV I IV' }), 'novedad'),
    ).toBe('Repite tu vuelta, otro coro.');
    expect(
      valor(
        juzga({
          tuyo: 'I vi IV V',
          path: 'seguir',
          salida: 'I vi IV V',
          contexto: { estilo: 'rock' },
        }),
        'novedad',
      ),
    ).toBe(0.5);
  });

  it('un cierre que no usa ninguno de tus acordes, o que no añade nada', () => {
    expect(motivo(juzga({ tuyo: 'I IV', path: 'seguir', salida: 'ii V' }), 'novedad')).toBe(
      'El cierre no usa ninguno de tus acordes.',
    );
    const nada = encaje(
      'major',
      'continuar',
      pasos('I V'),
      {},
      { path: 'seguir', cancion: pasos('I V') },
    );
    expect(motivo(nada, 'novedad')).toBe('No añade ningún compás a lo tuyo.');
  });
});

describe('10. papel', () => {
  const juzgaCon = (
    rol: 'estrofa' | 'intro' | 'pre' | 'estribillo' | 'puente' | 'final' | 'solo',
    p: Omit<Pregunta, 'contexto'>,
  ) => juzga({ ...p, contexto: { papel: rol } });
  const papel = (rol: Parameters<typeof juzgaCon>[0], p: Omit<Pregunta, 'contexto'>) =>
    criterio(juzgaCon(rol, p), 'papel');
  const retoca = (tuyo: string, path: PathId, salida: string) =>
    ({ kind: 'retocar', tuyo, path, salida }) as const;

  it('la estrofa puede quedar abierta y repetir', () => {
    expect(papel('estrofa', retoca('I vi IV V', 'otro-final', 'I vi IV IV')).valor).toBe(0.5);
    expect(papel('estrofa', retoca('I vi IV V', 'otro-final', 'I vi V I')).valor).toBe(0.3);
  });

  it('lo que se añade al continuar es otra parte, con su papel y no con el tuyo', () => {
    // Detrás de una estrofa va un pre o un estribillo, y vale el que mejor siente:
    // aquí, el estribillo que llega.
    const tras = papel('estrofa', { tuyo: 'I vi IV V', path: 'seguir', salida: 'I' });
    expect(tras.valor).toBe(1);
    expect(tras.motivo).toBe('Lo que sigue, el estribillo, empieza en I y cierra fuerte.');
    // Detrás de un pre, el estribillo. Antes salía «el pre cierra en la tónica».
    const pre = papel('pre', { tuyo: 'vi IV I V', path: 'seguir', salida: 'I' });
    expect(pre.valor).toBe(1);
    expect(pre.motivo).not.toContain('pre');
    // Lo que completa tu frase sigue siendo tuyo: dos compases más a una estrofa de dos.
    expect(papel('estrofa', { tuyo: 'I V', path: 'seguir', salida: 'vi IV' }).motivo).toBe(
      'La estrofa acaba en IV: queda abierta para repetirse.',
    );
    // Contrastar un puente no tiene papel propio: es volver al estribillo.
    const otra = juzgaCon('puente', {
      tuyo: 'vi ii IV V',
      path: 'contraste',
      salida: 'vi iii IV V',
    });
    expect(otra.descarte).toBe('lo que sigue al puente no vuelve a casa');
    // Y una idea no tiene papel que juzgar.
    expect(
      criterio(
        juzga({ tuyo: 'I V', path: 'seguir', salida: 'vi IV', contexto: { papel: 'idea' } }),
        'papel',
      ).valor,
    ).toBe(0);
  });

  it('la intro deja la entrada servida, y la que cierra suena a final', () => {
    expect(papel('intro', retoca('I IV I IV', 'otro-final', 'I IV I V')).valor).toBe(0.6);
    expect(papel('intro', retoca('I IV I IV', 'otro-final', 'I IV vi I')).valor).toBe(0.3);
    expect(papel('intro', retoca('I IV I IV', 'otro-final', 'I IV V I')).valor).toBe(-0.5);
    // Detrás de una intro, una estrofa.
    expect(
      papel('intro', { tuyo: 'I IV I IV', path: 'contraste', salida: 'ii vi ii V' }).motivo,
    ).toBe('Lo que sigue, la estrofa, acaba en V: queda abierta para repetirse.');
  });

  it('el pre acaba en IV o en V; si cierra, o si pierde lo que empujaba, no se ofrece', () => {
    expect(papel('pre', retoca('vi IV I V', 'otro-final', 'vi IV I IV')).valor).toBe(1);
    const flojo = juzgaCon('pre', retoca('vi IV I V', 'otro-final', 'vi IV I vi'));
    expect(criterio(flojo, 'papel').valor).toBe(-0.5);
    expect(flojo.descarte).toBe('quita lo que llevaba a la parte siguiente');
    const cierra = juzgaCon('pre', retoca('vi IV I V', 'otro-final', 'vi IV V I'));
    expect(criterio(cierra, 'papel').motivo).toBe(
      'El pre cierra en la tónica y le quita la llegada al estribillo.',
    );
    expect(cierra.descarte).toBe('un pre que cierra');
    // Lo que ya era tuyo no se le cobra a la salida.
    expect(juzgaCon('pre', retoca('vi IV V I', 'rearmonizar', 'vi ii V I')).descarte).toBeNull();
  });

  it('el estribillo empieza en casa —o en el IV o la relativa— y cierra fuerte', () => {
    expect(papel('estribillo', retoca('I vi IV I', 'otro-final', 'I vi V I')).valor).toBe(1);
    expect(papel('estribillo', retoca('ii IV V I', 'rearmonizar', 'ii iv V I')).valor).toBe(0.4);
    expect(papel('estribillo', retoca('IV I V I', 'otro-final', 'IV I iv I')).valor).toBe(0.5);
    // Un estribillo que no cerraba y vuelve a la I al repetirse llega al volver.
    const vuelta = juzgaCon('estribillo', retoca('I vi IV V', 'otro-final', 'I vi IV IV'));
    expect(criterio(vuelta, 'papel').valor).toBe(0.3);
    expect(vuelta.descarte).toBeNull();
    // El que cerraba tiene que seguir cerrando: llegar solo al repetirse le quita el final.
    expect(juzgaCon('estribillo', retoca('I vi IV I', 'otro-final', 'I vi IV V')).descarte).toBe(
      'un estribillo sin llegada',
    );
    // El que contrasta solo se juzga por cómo entra.
    expect(
      papel('pre', { tuyo: 'ii iii IV V', path: 'contraste', salida: 'iii vi ii V' }).motivo,
    ).toBe('Lo que sigue, el estribillo, entra en iii, que no es llegar a ningún sitio.');
  });

  it('el puente evita la tónica y acaba tirando hacia ella', () => {
    expect(papel('puente', retoca('vi ii IV V', 'rearmonizar', 'vi ii iv V')).valor).toBe(1);
    expect(papel('puente', retoca('vi ii IV V', 'rearmonizar', 'vi I IV V')).motivo).toBe(
      'El puente pasa una vez por la tónica: la vuelta se gasta antes de tiempo.',
    );
    const vuelto = juzgaCon('puente', retoca('vi ii IV V', 'otro-final', 'vi ii V I'));
    expect(criterio(vuelto, 'papel').motivo).toBe(
      'El puente acaba en la tónica: ya ha vuelto, y la vuelta pierde su llegada.',
    );
    expect(vuelto.descarte).toBe('un puente que ya ha vuelto');
    expect(juzgaCon('puente', retoca('vi ii IV V', 'otro-final', 'vi ii IV vi')).descarte).toBe(
      'quita lo que llevaba a la parte siguiente',
    );
    expect(papel('puente', retoca('vi ii IV iii', 'rearmonizar', 'vi ii iv iii')).motivo).toBe(
      'El puente acaba en iii, que no prepara la vuelta.',
    );
    expect(
      papel('puente', retoca('vi ii IV iii V', 'rearmonizar', 'vi I IV I V')).motivo,
    ).toContain('2 veces');
    // Detrás de un puente vuelve el estribillo.
    expect(papel('puente', { tuyo: 'vi ii IV V', path: 'seguir', salida: 'I' }).valor).toBe(1);
  });

  it('el final cierra fuerte, admite una coda plagal y no se queda abierto', () => {
    expect(papel('final', { tuyo: 'I vi IV V', path: 'seguir', salida: 'I IV I I' }).motivo).toBe(
      'Lo que se añade al final llega con la dominante y se despide con una coda plagal.',
    );
    expect(papel('final', { tuyo: 'I vi IV V', path: 'seguir', salida: 'I' }).valor).toBe(1);
    expect(papel('final', { tuyo: 'I vi ii IV', path: 'seguir', salida: 'I' }).valor).toBe(0.5);
    const abierto = juzgaCon('final', retoca('I vi IV I', 'otro-final', 'I vi IV V'));
    expect(criterio(abierto, 'papel').valor).toBe(-1);
    expect(abierto.descarte).toBe('un final que acaba abierto');
    // También si tu final ya acababa abierto: retocarlo sin cerrarlo no lo hace final.
    expect(juzgaCon('final', retoca('I vi IV V', 'otro-final', 'I vi IV IV')).descarte).toBe(
      'un final que acaba abierto',
    );
    // Ni con otra parte detrás que vuelve a empezar.
    expect(
      juzgaCon('final', { tuyo: 'I vi IV I', path: 'contraste', salida: 'vi ii IV V' }).descarte,
    ).toBe('un final que acaba abierto');
    // Y una coda es corta: ocho compases más son otra canción, que solo entra por la red.
    const larga = juzgaCon('final', {
      tuyo: 'I vi IV V',
      path: 'seguir',
      salida: 'I vi IV V I IV V I',
    });
    expect(criterio(larga, 'papel').motivo).toContain('una coda no es otra canción');
    conReparo(larga);
  });

  it('el solo va sobre acordes que ya han sonado', () => {
    expect(papel('solo', { tuyo: 'I V vi IV', path: 'seguir', salida: 'vi IV V I' }).valor).toBe(1);
    expect(papel('solo', { tuyo: 'I V vi IV', path: 'seguir', salida: 'ii iii V I' }).motivo).toBe(
      'Lo que se añade al solo mete ii, iii, que no habían sonado.',
    );
    expect(papel('solo', retoca('I V vi IV', 'rearmonizar', 'I iii vi IV')).motivo).toBe(
      'El solo mete iii, que no habían sonado.',
    );
  });
});

describe('11. forma y centro', () => {
  const blues = 'I I I I IV IV I I V IV I V';

  it('un blues de doce: otro coro, o el acorde final en el 13', () => {
    expect(
      motivo(
        juzga({ tuyo: blues, path: 'seguir', salida: 'I IV I I IV IV I I V IV I I' }),
        'forma',
      ),
    ).toBe('Otro coro de doce: la tónica en el 13, el cuarto en el 17 y la dominante en el 21.');
    expect(valor(juzga({ tuyo: blues, path: 'seguir', salida: 'I' }), 'forma')).toBe(0.6);
  });

  it('romper la forma de doce no se ofrece en un blues, y sin estilo resta', () => {
    const conEstilo = juzga({
      tuyo: blues,
      path: 'seguir',
      salida: 'IV I',
      contexto: { estilo: 'blues' },
    });
    expect(conEstilo.descarte).toBe('rompe la forma de doce del blues');
    const sinEstilo = juzga({ tuyo: blues, path: 'seguir', salida: 'IV I' });
    expect(valor(sinEstilo, 'forma')).toBe(-0.8);
    expect(sinEstilo.descarte).toBeNull();
  });

  it('al retocar un blues, la forma de doce sigue entera o se rompe', () => {
    const entera = juzga({
      kind: 'retocar',
      tuyo: blues,
      path: 'rearmonizar',
      salida: 'I IV I I IV IV I I V IV I V',
    });
    expect(valor(entera, 'forma')).toBe(0.6);
    const corta = juzga({
      kind: 'retocar',
      tuyo: blues,
      path: 'otro-final',
      salida: 'I I I I IV IV I',
    });
    expect(motivo(corta, 'forma')).toBe('Deja el blues en 7 compases: rompe la forma de doce.');
    const rota = juzga({
      kind: 'retocar',
      tuyo: blues,
      path: 'rearmonizar',
      salida: 'I I I I IV IV I I vi{interrumpida} IV I V',
    });
    expect(valor(rota, 'forma')).toBe(-0.3);
  });

  it('el blues menor también se reconoce', () => {
    const r = juzga({
      mode: 'minor',
      tuyo: 'i i i i iv iv i i v iv i v',
      path: 'seguir',
      salida: 'i',
    });
    expect(valor(r, 'forma')).toBe(0.6);
  });

  it('un vamp sin tónica es modal: cerrar en la tónica destruye el modo', () => {
    const cierra = juzga({ tuyo: 'ii V ii V', path: 'seguir', salida: 'vi IV V I' });
    expect(motivo(cierra, 'forma')).toBe(
      'Cierra en I, y tu vamp de ii y V no la tenía: deja de ser modal.',
    );
    const queda = juzga({ tuyo: 'ii V ii V', path: 'contraste', salida: 'IV bVII IV V' });
    expect(valor(queda, 'forma')).toBe(0.6);
    expect(queda.puntos).toBeGreaterThan(cierra.puntos);
  });

  it('lo tuyo con bVII y sin V es mixolidio: el V con sensible lo saca del modo', () => {
    const conV = juzga({ tuyo: 'I bVII IV I', path: 'seguir', salida: 'vi ii V I' });
    expect(valor(conV, 'forma')).toBe(-1);
    const sinV = juzga({ tuyo: 'I bVII IV I', path: 'seguir', salida: 'IV bVII I I' });
    expect(valor(sinV, 'forma')).toBe(0.5);
  });

  it('un periodo: semicadencia en el 4 y cierre en el 8', () => {
    const r = juzga({ tuyo: 'I IV I V', path: 'seguir', salida: 'I IV V I' });
    expect(motivo(r, 'forma')).toBe(
      'Un periodo: semicadencia en V en el compás 4 y cierre en el 8.',
    );
    const sinSemicadencia = juzga({ tuyo: 'I IV I IV', path: 'seguir', salida: 'I IV V I' });
    expect(criterio(sinSemicadencia, 'forma')).toEqual({ id: 'forma', valor: 0, motivo: '' });
  });

  it('un acorde solo no es un vamp', () => {
    const r = juzga({ tuyo: 'I', path: 'seguir', salida: 'IV V I' });
    expect(valor(r, 'forma')).toBe(0);
  });
});

/**
 * Lo que haría un arreglista, sacado del corpus de 38 canciones con que se midió
 * el juez: en cada par, la primera es lo que él pone delante y la segunda lo
 * que pone detrás o da por error. Pasan si la primera puntúa más, o si la
 * segunda se descarta.
 */
describe('el corpus del arreglista', () => {
  interface Par {
    readonly caso: string;
    readonly mode?: KeyMode;
    readonly estilo?: 'pop' | 'rock' | 'blues' | 'jazz' | 'folk';
    readonly kind?: PathKind;
    readonly tuyo: string;
    readonly mejor: readonly [PathId, string];
    readonly peor: readonly [PathId, string];
  }
  const PARES: readonly Par[] = [
    {
      caso: 'jazz-turnaround: V I antes que V IV I',
      estilo: 'jazz',
      tuyo: 'I vi ii V',
      mejor: ['seguir', 'I'],
      peor: ['seguir', 'IV I'],
    },
    {
      caso: 'jazz-turnaround: V I antes que la rota como cierre',
      estilo: 'jazz',
      tuyo: 'I vi ii V',
      mejor: ['seguir', 'I'],
      peor: ['seguir', 'vi I'],
    },
    {
      caso: 'jazz-251: el turnaround antes que el bVII',
      estilo: 'jazz',
      tuyo: 'ii V I I',
      mejor: ['seguir', 'vi ii V I'],
      peor: ['seguir', 'IV iv bVII I'],
    },
    {
      caso: 'tres-acordes: cuadrar a cuatro antes que dejar siete',
      estilo: 'rock',
      tuyo: 'I IV V',
      mejor: ['seguir', 'I'],
      peor: ['seguir', 'vi IV bVII I'],
    },
    {
      caso: 'folk-semicadencia: el consecuente antes que V I',
      estilo: 'folk',
      tuyo: 'I IV I V',
      mejor: ['seguir', 'I IV V I'],
      peor: ['seguir', 'vi I'],
    },
    {
      caso: 'folk-semicadencia: el consecuente antes que el bVII',
      estilo: 'folk',
      tuyo: 'I IV I V',
      mejor: ['seguir', 'I IV V I'],
      peor: ['seguir', 'vi IV bVII I'],
    },
    {
      caso: 'pop-sensible: vi IV V I antes que V IV I a secas',
      estilo: 'pop',
      tuyo: 'vi IV I V',
      mejor: ['seguir', 'vi IV V I'],
      peor: ['seguir', 'IV I'],
    },
    {
      caso: 'doo-wop: I antes que IV I',
      estilo: 'pop',
      tuyo: 'I vi IV V',
      mejor: ['seguir', 'I'],
      peor: ['seguir', 'IV I'],
    },
    {
      caso: 'mixo-vamp: IV I antes que V I',
      estilo: 'rock',
      tuyo: 'I bVII I bVII',
      mejor: ['seguir', 'IV I'],
      peor: ['seguir', 'V I'],
    },
    {
      caso: 'mixo-vamp: bVI bVII I antes que IV iv V I',
      estilo: 'rock',
      tuyo: 'I bVII I bVII',
      mejor: ['seguir', 'bVI bVII I I'],
      peor: ['seguir', 'IV iv V I'],
    },
    {
      caso: 'rock-mixo: el doble plagal antes que el ii V I',
      estilo: 'rock',
      tuyo: 'I bVII IV I',
      mejor: ['seguir', 'IV bVII I I'],
      peor: ['seguir', 'vi ii V I'],
    },
    {
      caso: 'dorico: seguir el vamp antes que cerrar en I',
      tuyo: 'ii V ii V',
      mejor: ['contraste', 'IV bVII IV V'],
      peor: ['seguir', 'vi IV V I'],
    },
    {
      caso: 'blues-12: el I del 13 antes que IV I',
      estilo: 'blues',
      tuyo: 'I I I I IV IV I I V IV I V',
      mejor: ['seguir', 'I'],
      peor: ['seguir', 'IV I'],
    },
    {
      caso: 'medio-tiempo: seguir a ocho pulsos antes que a cuatro',
      estilo: 'pop',
      tuyo: 'I/8 IV/8 V/8 I/8',
      mejor: ['seguir', 'vi/8 IV/8 V/8 I/8'],
      peor: ['seguir', 'vi/4 IV/4 V/4 I/4'],
    },
    {
      caso: 'rock-louie: a dos pulsos con la tónica sostenida',
      estilo: 'rock',
      tuyo: 'I/2 IV/2 V/2 IV/2',
      mejor: ['seguir', 'IV/2 V/2 I/4'],
      peor: ['seguir', 'IV/4 V/4 I/4'],
    },
    {
      caso: 'canon: I en el 9 antes que once compases',
      estilo: 'pop',
      tuyo: 'I V vi iii IV I IV V',
      mejor: ['seguir', 'I'],
      peor: ['seguir', 'IV bVII I'],
    },
    {
      caso: 'menor-251: VI ii° V i antes que VI III VII i',
      mode: 'minor',
      estilo: 'jazz',
      tuyo: 'ii° V i i',
      mejor: ['seguir', 'VI ii° V i'],
      peor: ['seguir', 'VI III VII i'],
    },
    {
      caso: 'descenso-menor: VII i antes que VII VI i',
      mode: 'minor',
      estilo: 'rock',
      tuyo: 'i VII VI VII',
      mejor: ['seguir', 'i'],
      peor: ['seguir', 'VI i'],
    },
    {
      caso: 'pop-eje: no tocar el I del compás 1',
      estilo: 'pop',
      kind: 'retocar',
      tuyo: 'I V vi IV',
      mejor: ['rearmonizar', 'I iii{relativo} vi IV'],
      peor: ['rearmonizar', 'vi{relativo} V vi IV'],
    },
    {
      caso: 'jazz-turnaround: V/ii antes que vi en lugar del V',
      estilo: 'jazz',
      kind: 'retocar',
      tuyo: 'I vi ii V',
      mejor: ['rearmonizar', 'I V/ii ii V'],
      peor: ['rearmonizar', 'I vi ii vi{interrumpida}'],
    },
    {
      caso: 'jazz-251: el tritono antes que la interrumpida',
      estilo: 'jazz',
      kind: 'retocar',
      tuyo: 'ii V I I',
      mejor: ['rearmonizar', 'ii bII{tritono} I I'],
      peor: ['rearmonizar', 'ii vi{interrumpida} I I'],
    },
    {
      caso: 'menor-251: el tritono antes que V III',
      mode: 'minor',
      estilo: 'jazz',
      kind: 'retocar',
      tuyo: 'ii° V i i',
      mejor: ['rearmonizar', 'ii° bII{tritono} i i'],
      peor: ['rearmonizar', 'ii° III{interrumpida} i i'],
    },
    {
      caso: 'un-acorde: un final antes que cambiar los cuatro I',
      kind: 'retocar',
      tuyo: 'I I I I',
      mejor: ['otro-final', 'I I V I'],
      peor: ['rearmonizar', 'vi{relativo} vi{relativo} vi{relativo} vi{relativo}'],
    },
    {
      caso: 'desigual: cuadrar antes que otro final',
      estilo: 'pop',
      kind: 'retocar',
      tuyo: 'I/5 V/3 vi/6 IV/2',
      mejor: ['estirar', 'I/4 V/4 vi/4 IV/4'],
      peor: ['otro-final', 'I/5 V/3 vi/6 V/2'],
    },
    {
      caso: 'rock-louie: no romper los dos pulsos',
      estilo: 'rock',
      kind: 'retocar',
      tuyo: 'I/2 IV/2 V/2 IV/2',
      mejor: ['estirar', 'I/4 IV/4 V/4 IV/4'],
      peor: ['estirar', 'I/1 IV/1 V/1 IV/1'],
    },
    {
      caso: 'doo-wop: ii por IV antes que IV por V',
      estilo: 'pop',
      kind: 'retocar',
      tuyo: 'I vi IV V',
      mejor: ['rearmonizar', 'I vi ii{relativo} V'],
      peor: ['otro-final', 'I vi IV IV'],
    },
    {
      caso: 'folk-periodo: el iv antes que el tritono',
      estilo: 'folk',
      kind: 'retocar',
      tuyo: 'I IV I V I IV V I',
      mejor: ['rearmonizar', 'I IV I V I iv{intercambio} V I'],
      peor: ['rearmonizar', 'I IV I bII{tritono} I IV bII{tritono} I'],
    },
  ];

  it.each(PARES)('$caso', ({ mode, estilo, kind, tuyo, mejor, peor }) => {
    const contexto = estilo === undefined ? {} : { estilo };
    const a = juzga({ mode, kind, tuyo, path: mejor[0], salida: mejor[1], contexto });
    const b = juzga({ mode, kind, tuyo, path: peor[0], salida: peor[1], contexto });
    expect(a.descarte).toBeNull();
    expect(a.puntos).toBeGreaterThanOrEqual(ENCAJE_MINIMO);
    if (b.descarte === null) {
      expect(a.puntos).toBeGreaterThan(b.puntos);
    }
  });

  it('en jazz el bVII que cierra puntúa bajo, y en rock alto', () => {
    const cierre = (estilo: 'jazz' | 'rock') =>
      juzga({ tuyo: 'I IV I IV', path: 'seguir', salida: 'I bVII I I', contexto: { estilo } });
    expect(cierre('rock').puntos - cierre('jazz').puntos).toBeGreaterThan(10);
  });
});

/**
 * Lo que el juez aprendió al cerrar los huecos del menú: cuándo encaja qué acorde
 * según lo que ya hace tu canción, y no según una tabla fija.
 */
describe('lo que decide el contexto', () => {
  it('los pulsos de costumbre caen en la rejilla del compás', () => {
    expect(pulsosHabituales([{ beats: 4 }, { beats: 4 }, { beats: 2 }], 4)).toBe(4);
    // Una toma de 5, 3, 6 y 2: empatan, y la media es un compás.
    expect(
      pulsosHabituales(
        [5, 3, 6, 2].map((beats) => ({ beats })),
        4,
      ),
    ).toBe(4);
    // Lo que más se repite es un golpe de un pulso: no es un compás, vale la media.
    expect(
      pulsosHabituales(
        [1, 1, 6, 8, 4].map((beats) => ({ beats })),
        4,
      ),
    ).toBe(4);
    // En tres por cuatro no hay dos pulsos: el más cercano es el compás entero.
    expect(
      pulsosHabituales(
        [2, 2, 4].map((beats) => ({ beats })),
        3,
      ),
    ).toBe(3);
    // A igual distancia de dos, el más largo: no deja golpes sueltos.
    expect(pulsosHabituales([{ beats: 3 }, { beats: 3 }], 4)).toBe(4);
  });

  it('un compás que no se puede contar es el cuatro por cuatro de siempre', () => {
    const con = (pulsosPorCompas?: number) =>
      juzga({
        tuyo: 'I IV I V',
        path: 'seguir',
        salida: 'IV V I I',
        contexto: pulsosPorCompas === undefined ? {} : { pulsosPorCompas },
      }).puntos;
    expect(con(0)).toBe(con());
    expect(con(2.5)).toBe(con());
    expect(con(40)).toBe(con());
  });

  it('V ii V no vuelve atrás: vuelve a preparar la dominante, también en jazz', () => {
    const otraVez = juzga({
      tuyo: 'I vi ii V',
      path: 'seguir',
      salida: 'ii V I I',
      contexto: { estilo: 'jazz' },
    });
    expect(otraVez.descarte).toBeNull();
    expect(valor(otraVez, 'sintaxis')).toBeGreaterThan(0);
    // Lo que sí vuelve atrás es quedarse en la subdominante.
    const atras = juzga({
      tuyo: 'I vi ii V',
      path: 'seguir',
      salida: 'ii I',
      contexto: { estilo: 'jazz' },
    });
    expect(atras.descarte).toBe('V ii vuelve atrás, y en jazz no se hace.');
  });

  it('la dominante que se desvía a otra dominante que llega no es una promesa rota', () => {
    const desvia = juzga({ tuyo: 'I IV I V', path: 'seguir', salida: 'V/vi vi IV V I' });
    expect(valor(desvia, 'sintaxis')).toBeGreaterThan(0);
    expect(motivo(desvia, 'sintaxis')).not.toContain('sin resolver');
    // Si el III7 no llega al vi —aquí vuelve a empezar en la I—, sí se queda colgado.
    const colgada = juzga({
      kind: 'retocar',
      tuyo: 'I IV V I',
      path: 'rearmonizar',
      salida: 'I IV V V/vi{dominante}',
    });
    expect(valor(colgada, 'sintaxis')).toBeLessThan(0);
    expect(motivo(colgada, 'notas-comunes')).toContain('prepara otro acorde');
  });

  it('cerrar sin sensible vale lo que diga el estilo, también en la cadencia', () => {
    const cierre = (estilo: 'jazz' | 'rock', tuyo = 'ii° VII i i') =>
      juzga({ mode: 'minor', tuyo, path: 'seguir', salida: 'VI iv v i', contexto: { estilo } });
    expect(valor(cierre('rock'), 'cadencia')).toBeGreaterThan(valor(cierre('jazz'), 'cadencia'));
    expect(motivo(cierre('jazz'), 'cadencia')).toContain(
      'cierra sin la sensible que aquí se espera',
    );
    // El jazz menor llega con la dominante armónica: el `v i` no se ofrece.
    expect(cierre('jazz').descarte).toBe('v i cierra sin la sensible que aquí se pide');
    // Y un menor que eligió su V con sensible —sin v ni VII— no la cambia por
    // la v, ni en rock: es la misma dominante dicha de las dos maneras.
    expect(cierre('rock', 'ii° V i i').descarte).not.toBeNull();
  });

  it('la misma llegada floja que la tuya suena a otra vuelta, la perfecta no', () => {
    const bucle = 'I V vi IV';
    const plagal = juzga({ tuyo: bucle, path: 'seguir', salida: 'I vi IV I' });
    expect(motivo(plagal, 'cadencia')).toContain('Es la misma llegada que la tuya');
    const perfecta = juzga({ tuyo: bucle, path: 'seguir', salida: 'I IV V I' });
    expect(motivo(perfecta, 'cadencia')).not.toContain('misma llegada');
    expect(valor(perfecta, 'cadencia')).toBeGreaterThan(valor(plagal, 'cadencia'));
    // Con lo tuyo cerrado, la llegada es lo que va antes de tu tónica.
    const amen = juzga({ tuyo: 'I vi IV I', path: 'seguir', salida: 'V vi IV I' });
    expect(motivo(amen, 'cadencia')).toContain('misma llegada');
    // Y la llegada son los dos de antes: `ii IV I` no es la vuelta de `I V vi IV`,
    // que llega por `vi IV`; es otra manera de preparar la plagal.
    const preparada = juzga({ tuyo: bucle, path: 'seguir', salida: 'I vi ii IV I' });
    expect(motivo(preparada, 'cadencia')).not.toContain('misma llegada');
    // Pero la cadencia fuerte de tu idioma cierra por sí misma, como la perfecta: el
    // `bVII I` de lo que eligió no tener sensible es su cadencia, no una floja, y el
    // arreglista la repite a propósito («bVI bVII I otra vez»).
    const epica = juzga({ tuyo: 'I bVI bVII I', path: 'seguir', salida: 'IV vi bVII I' });
    expect(motivo(epica, 'cadencia')).not.toContain('misma llegada');
    const eolica = juzga({
      mode: 'minor',
      tuyo: 'i VII VI VII',
      path: 'seguir',
      salida: 'i VI VII i',
    });
    expect(motivo(eolica, 'cadencia')).not.toContain('misma llegada');
    // Si lo tuyo no llega a casa de ninguna manera, no hay con qué compararla.
    for (const tuyo of ['I I I I', 'vi I ii IV']) {
      const sinLlegada = juzga({ tuyo, path: 'seguir', salida: 'vi IV IV I' });
      expect(motivo(sinLlegada, 'cadencia'), tuyo).not.toContain('misma llegada');
    }
  });

  it('la llegada floja que repite la tuya es un reparo, y solo si puede venir otra vuelta', () => {
    // Otra frase que acaba como gira tu bucle: no se descarta, se queda para la red.
    const gira = juzga({ tuyo: 'I V vi IV', path: 'seguir', salida: 'I vi IV I' });
    conReparo(gira);
    // Lo que se añade a un final no da otra vuelta: el `IV I` es el amén.
    const amen = juzga({
      tuyo: 'I V vi IV',
      path: 'seguir',
      salida: 'I',
      contexto: { papel: 'final' },
    });
    expect(motivo(amen, 'cadencia')).not.toContain('misma llegada');
    expect(amen.puntos).toBeGreaterThanOrEqual(ENCAJE_MINIMO);
    // Ni la I que completa tu última frase, que estaba sin acabar: cierra como
    // cierran todas las tuyas. Es el rock de 31 compases que se quedaba sin menú.
    const completa = juzga({ tuyo: 'I bVII IV I I bVII IV', path: 'seguir', salida: 'I' });
    expect(motivo(completa, 'cadencia')).toBe(
      'IV I en el 8: cadencia plagal, el amén, y llega en el compás fuerte.',
    );
    expect(completa.puntos).toBeGreaterThanOrEqual(70);
  });

  it('un bucle retocado acaba en su vuelta al principio', () => {
    const tuyo = 'vi IV I V';
    const vuelve = juzga({
      kind: 'retocar',
      tuyo,
      path: 'rearmonizar',
      salida: 'vi IV I V/vi{dominante}',
    });
    expect(motivo(vuelve, 'cadencia')).toBe(
      'Tu bucle vuelve a empezar por V/vi vi: V/vi llega a lo que preparaba.',
    );
    // La vuelta cuenta en la sintaxis y en el bajo cuando la salida toca un extremo.
    expect(motivo(vuelve, 'bajo')).toBe('V/vi vi: el bajo baja una quinta, el enlace más fuerte.');
    const mismo = juzga({ kind: 'retocar', tuyo, path: 'otro-final', salida: 'vi IV V vi' });
    expect(motivo(mismo, 'cadencia')).toBe(
      'Tu bucle vuelve a empezar en el mismo vi en el que acaba.',
    );
    // Sin tocar los extremos, la vuelta ya era tuya y no cuenta como nueva.
    const enMedio = juzga({
      kind: 'retocar',
      tuyo,
      path: 'rearmonizar',
      salida: 'vi ii{relativo} I V',
    });
    expect(motivo(enMedio, 'bajo')).not.toContain('V vi');
  });

  it('una vuelta de un compás se dice en singular', () => {
    const uno = juzga({ kind: 'retocar', tuyo: 'I V', path: 'estirar', salida: 'I/2 V/2' });
    expect(motivo(uno, 'frase')).toBe('Una vuelta de un compás, que cabe en la frase de cuatro.');
  });

  it('la forma del blues se reconoce por los compases que la hacen', () => {
    const forma = (grados: string, mode: KeyMode = 'major') => {
      const lista = grados.split(' ') as DegreeSymbol[];
      return formaDeBlues(mode, (compas) => lista[compas]);
    };
    expect(forma('I I I I IV IV I I V IV I V')).toBe(true);
    // El blues de jazz: ii–V, el II7 o el bVI7 en el 9 que llegan al V del 10.
    expect(forma('I IV I I IV IV I V/ii ii V I V')).toBe(true);
    expect(forma('I I I I IV IV I I V/V V I I')).toBe(true);
    expect(forma('I I I I IV IV I I bVI V I I')).toBe(true);
    // La vuelta a casa puede ser en el 7 o en el 11.
    expect(forma('I I I I IV IV iii V/ii ii V I V')).toBe(true);
    expect(forma('i i i i iv iv i i v iv i i', 'minor')).toBe(true);
    // Lo que no prepara el 10, o un 9 que no tira a casa, no es la forma.
    expect(forma('I I I I IV IV I I ii IV I I')).toBe(false);
    expect(forma('I I I I IV IV I I vi IV I I')).toBe(false);
    expect(forma('I I I I IV IV iii iii V IV vi V')).toBe(false);
    expect(forma('I I I I V V I I V IV I V')).toBe(false);
    // Doce compases que no están: sin compás 9 no hay forma.
    expect(forma('I I I I IV IV I I')).toBe(false);
  });

  /**
   * Los ocho primeros compases de un blues son una forma empezada: lo que los sigue
   * los completa a doce (corpus final). Y tienen que sonar a blues —con el estilo o
   * con todo en séptimas—: en tríadas son también una canción de folk de ocho.
   */
  it('los ocho primeros de un blues piden los cuatro que faltan', () => {
    const aMedias = (grados: string, contexto: ContextoDeSalidas, mode: KeyMode = 'major') => {
      const lista = grados.split(' ') as DegreeSymbol[];
      return bluesAMedias(mode, (compas) => lista[compas], lista.length, contexto);
    };
    const ocho = 'I I I I IV IV I I';
    const septimas = { especies: Array<'dominant7'>(8).fill('dominant7') };
    expect(aMedias(ocho, { estilo: 'blues' })).toBe(true);
    expect(aMedias('I IV I I IV IV I I', septimas)).toBe(true);
    expect(
      aMedias('i i i i iv iv i i', { especies: Array<'minor7'>(8).fill('minor7') }, 'minor'),
    ).toBe(true);
    expect(aMedias(ocho, {})).toBe(false);
    expect(aMedias(ocho, { especies: [...septimas.especies.slice(1), null] })).toBe(false);
    expect(aMedias('I I I I IV IV I I V IV I I', { estilo: 'blues' })).toBe(false);
    expect(aMedias('I I I I IV I I I', { estilo: 'blues' })).toBe(false);
    // Al continuarlos, doce compases son la forma entera, y dieciséis la rompen.
    const completa = juzga({
      tuyo: ocho,
      path: 'seguir',
      salida: 'V IV I I',
      contexto: { estilo: 'blues' },
    });
    expect(motivo(completa, 'frase')).toBe('12 compases: la forma de doce del blues, entera.');
    const larga = juzga({
      tuyo: ocho,
      path: 'seguir',
      salida: 'IV V I I I IV V I',
      contexto: { estilo: 'blues' },
    });
    expect(motivo(larga, 'frase')).toContain('rompe la forma de doce');
  });

  it('el coro de un blues de jazz es otro coro, también con el estilo blues', () => {
    const tuyo = 'I I I I IV IV I I V IV I V';
    for (const salida of ['I I I I IV IV I I ii V I I', 'I I I I IV IV I V/ii ii V I I']) {
      const coro = juzga({ tuyo, path: 'seguir', salida, contexto: { estilo: 'blues' } });
      expect(coro.descarte, salida).toBeNull();
      expect(valor(coro, 'forma'), salida).toBe(1);
    }
  });

  it('los doce primeros compases de una canción más larga no la hacen un blues', () => {
    const tuyo = 'I I I I IV IV I I V IV I V I IV V I';
    const sigue = juzga({
      tuyo,
      path: 'seguir',
      salida: 'IV V I I',
      contexto: { estilo: 'blues' },
    });
    expect(sigue.descarte).toBeNull();
    expect(motivo(sigue, 'forma')).not.toContain('blues');
  });

  it('en un blues se retoca la vuelta, no el esquema', () => {
    const tuyo = 'I IV I I IV IV I I V IV I I';
    const esquema = juzga({
      kind: 'retocar',
      tuyo,
      path: 'rearmonizar',
      salida: 'I ii{relativo} I I IV IV I I V IV I I',
    });
    expect(valor(esquema, 'forma')).toBe(-0.6);
    expect(motivo(esquema, 'forma')).toBe(
      'Cambia el 2, que es del esquema del blues: se retoca la vuelta del 8 al 12.',
    );
    // Quitar el cambio rápido del 2 sí es un retoque del blues.
    const sinCambio = juzga({
      kind: 'retocar',
      tuyo,
      path: 'rearmonizar',
      salida: 'I I I I IV IV I I V IV I I',
    });
    expect(valor(sinCambio, 'forma')).toBe(0.6);
    // En menor, el cambio rápido es al iv.
    const menor = juzga({
      mode: 'minor',
      kind: 'retocar',
      tuyo: 'i iv i i iv iv i i v iv i i',
      path: 'rearmonizar',
      salida: 'i i i i iv iv i i v iv i i',
    });
    expect(valor(menor, 'forma')).toBe(0.6);
    // Y la V del 12 es el turnaround: no quita la llegada, que es la I del 11.
    const turnaround = juzga({
      kind: 'retocar',
      tuyo,
      path: 'rearmonizar',
      salida: 'I IV I I IV IV I I V IV I V{dominante}',
    });
    expect(valor(turnaround, 'novedad')).toBe(0.7);
    expect(valor(turnaround, 'notas-comunes')).toBe(1);
    expect(motivo(turnaround, 'cadencia')).toContain('Tu bucle vuelve a empezar por V I');
  });

  it('una parte que contrasta y vuelve a casa por el camino contrasta menos', () => {
    const tuyo = 'I vi IV V';
    const lejos = juzga({ tuyo, path: 'contraste', salida: 'iii ii IV V' });
    const una = juzga({ tuyo, path: 'contraste', salida: 'iii I IV V' });
    const dos = juzga({ tuyo, path: 'contraste', salida: 'I iii I V' });
    expect(motivo(una, 'novedad')).toBe('La parte nueva pasa una vez por la I: contrasta menos.');
    expect(motivo(dos, 'novedad')).toBe('La parte nueva pasa 2 veces por la I: contrasta menos.');
    expect(valor(lejos, 'novedad')).toBeGreaterThan(valor(una, 'novedad'));
    expect(valor(una, 'novedad')).toBeGreaterThan(valor(dos, 'novedad'));
  });

  it('retocar enriquece: quedarse con menos acordes distintos empobrece', () => {
    const pobre = juzga({
      kind: 'retocar',
      tuyo: 'I IV I V',
      path: 'rearmonizar',
      salida: 'I V{dominante} I V',
    });
    expect(valor(pobre, 'novedad')).toBe(-0.5);
    expect(motivo(pobre, 'novedad')).toBe(
      'Se queda con 2 acordes distintos de los 3 que tenías: empobrece.',
    );
    // Y esa V llega a la I, pero se lleva la subdominante: la sustitución cuenta.
    expect(motivo(pobre, 'notas-comunes')).toContain('no hacen el mismo papel');
  });

  it('cambiar un acorde de una línea de bajo la rompe, y si la línea es la canción no se ofrece', () => {
    const baja = juzga({
      mode: 'minor',
      kind: 'retocar',
      tuyo: 'i VII VI V',
      path: 'rearmonizar',
      salida: 'i VII V/V{dominante} V',
    });
    expect(motivo(baja, 'notas-comunes')).toBe(
      'Cambia el bajo del 3, que iba en línea con los de al lado: la rompe.',
    );
    // Cuatro acordes son un detalle del bajo: resta, pero se ofrece.
    expect(baja.descarte).toBeNull();
    const sube = juzga({
      kind: 'retocar',
      tuyo: 'I ii iii IV',
      path: 'rearmonizar',
      salida: 'I ii V/ii{dominante} IV',
    });
    expect(motivo(sube, 'notas-comunes')).toContain('la rompe');
    // El ciclo de quintas que recorre la canción entera es su forma.
    const ciclo = juzga({
      mode: 'minor',
      kind: 'retocar',
      tuyo: 'i iv VII III VI ii° V V',
      path: 'rearmonizar',
      salida: 'i VI VII III VI ii° V V',
    });
    expect(motivo(ciclo, 'notas-comunes')).toContain('la rompe');
    conReparo(ciclo);
    // Sin línea no hay nada que romper.
    const salta = juzga({
      kind: 'retocar',
      tuyo: 'I vi IV V',
      path: 'rearmonizar',
      salida: 'I vi ii{relativo} V',
    });
    expect(motivo(salta, 'notas-comunes')).not.toContain('la rompe');
  });

  it('un giro cuenta si pasa por algo que trae la salida, y no dos veces', () => {
    const levanta = juzga({
      kind: 'retocar',
      tuyo: 'IV V iii vi',
      path: 'rearmonizar',
      salida: 'IV V V/vi{dominante} vi',
      contexto: { estilo: 'pop' },
    });
    expect(motivo(levanta, 'estilo')).toBe('V/vi vi, la secundaria que levanta.');
    const celula = juzga({
      kind: 'retocar',
      tuyo: 'I IV V I',
      path: 'rearmonizar',
      salida: 'I ii{relativo} V I',
      contexto: { estilo: 'jazz' },
    });
    expect(motivo(celula, 'estilo')).toBe('ii V I, la célula del jazz.');
  });

  it('un bII que ya tocas no es de otro idioma, aunque el estilo no lo use', () => {
    const suyo = juzga({
      kind: 'retocar',
      tuyo: 'I bII I V',
      path: 'otro-final',
      salida: 'I bII I bII',
      contexto: { estilo: 'pop' },
    });
    expect(suyo.descarte).toBeNull();
    const ajeno = juzga({
      kind: 'retocar',
      tuyo: 'I IV I V',
      path: 'rearmonizar',
      salida: 'I IV I bII{tritono}',
      contexto: { estilo: 'pop' },
    });
    expect(ajeno.descarte).toBe('bII no es de pop');
  });
});

/**
 * Lo que enseñó la verificación con un corpus que el equipo no había visto: los
 * fallos caían donde el corpus del equipo no probaba —papeles, modal sin sensible,
 * punteo, especies, acordes de un pulso—, y cada prueba de aquí es una causa, no
 * un caso.
 */
describe('lo que enseñó la verificación', () => {
  it('un riff a un pulso por acorde es un ritmo regular, no una toma desigual', () => {
    expect(pulsosHabituales([{ beats: 1 }, { beats: 1 }, { beats: 1 }, { beats: 1 }], 4)).toBe(1);
    expect(pulsosHabituales([{ beats: 1 }, { beats: 1 }, { beats: 2 }], 4)).toBe(1);
    // Dos golpes sueltos entre acordes largos sí se cuadran.
    expect(
      pulsosHabituales([{ beats: 6 }, { beats: 1 }, { beats: 1 }, { beats: 6 }, { beats: 1 }], 4),
    ).toBe(4);
    const riff = juzga({ tuyo: 'I/1 IV/1 V/1 I/1', path: 'seguir', salida: 'IV/1 V/1 I/2' });
    expect(motivo(riff, 'ritmo-armonico')).not.toContain('desigual');
    expect(motivo(riff, 'ritmo-armonico')).not.toContain('destiempo');
    // Y si ya mezcla uno y dos pulsos, repetir una de sus duraciones no cambia el paso.
    const mezcla = juzga({
      tuyo: 'I/1 IV/1 V/2 I/1 IV/1 V/2',
      path: 'seguir',
      salida: 'I/1 ii/1 V/2',
    });
    expect(motivo(mezcla, 'ritmo-armonico')).not.toContain('cambia el paso');
    expect(valor(mezcla, 'ritmo-armonico')).toBeGreaterThan(0);
  });

  it('la misma dominante con y sin sensible seguidas es una falsa relación', () => {
    for (const salida of ['i v V i', 'i V v i']) {
      const r = juzga({
        mode: 'minor',
        kind: 'retocar',
        tuyo: 'i v VII i',
        path: 'rearmonizar',
        salida,
      });
      expect(r.descarte, salida).toMatch(/falsa relación/);
    }
  });

  it('iv IV vuelve a aclarar lo que se acababa de nublar', () => {
    const r = juzga({ tuyo: 'I vi', path: 'seguir', salida: 'iv IV V I' });
    expect(JSON.stringify(r.criterios)).toContain('iv IV: vuelve a aclarar');
    expect(valor(r, 'sintaxis')).toBeLessThan(
      valor(juzga({ tuyo: 'I vi', path: 'seguir', salida: 'IV iv V I' }), 'sintaxis'),
    );
  });

  it('el modal que eligió no tener sensible no la recibe, ni por un V ni por otra puerta', () => {
    // Un vaivén mixolidio: el vii° y la secundaria también traen la sensible.
    for (const salida of ['I bVII I vii°', 'I bVII V/vi vi']) {
      const r = juzga({ kind: 'retocar', tuyo: 'I bVII I bVII', path: 'rearmonizar', salida });
      expect(r.descarte, salida).toBe('mete la sensible en lo que eligió no tenerla');
    }
    // El eólico de la v y el VII, igual.
    const eolico = juzga({
      mode: 'minor',
      kind: 'retocar',
      tuyo: 'i v VII i',
      path: 'rearmonizar',
      salida: 'i v V/iv iv',
    });
    expect(motivo(eolico, 'forma')).toContain('Lo tuyo usa v y VII y no V');
    expect(eolico.descarte).toBe('mete la sensible en lo que eligió no tenerla');
    // Si lo tuyo ya suena con la sensible —un iii—, no ha elegido quitarla.
    const conIii = juzga({
      kind: 'retocar',
      tuyo: 'I bVII iii bVII',
      path: 'rearmonizar',
      salida: 'I bVII iii V',
    });
    expect(conIii.descarte).toBeNull();
  });

  it('y el menor que eligió su V no la pierde, salvo por su sustituto tritonal', () => {
    const sinV = juzga({
      mode: 'minor',
      kind: 'retocar',
      tuyo: 'i iv V i',
      path: 'otro-final',
      salida: 'i iv VI i',
    });
    expect(sinV.descarte).toBe('quita la sensible que tu V había elegido');
    const tritono = juzga({
      mode: 'minor',
      kind: 'retocar',
      tuyo: 'i iv V i',
      path: 'rearmonizar',
      salida: 'i iv bII{tritono} i',
    });
    expect(tritono.descarte).toBeNull();
    // Un V en quintas no tiene tercera: no ha elegido ninguna sensible.
    const quintas = encaje(
      'minor',
      'retocar',
      pasos('i iv V i'),
      { especies: ['quinta', 'quinta', 'quinta', 'quinta'] },
      { path: 'otro-final', cancion: pasos('i iv VI i') },
    );
    expect(quintas.descarte).toBeNull();
  });

  it('una sola nota fuerte que choca de frente basta; la novena no choca', () => {
    // Fa contra el Fa# de un Re7.
    const choca = juzga({
      kind: 'retocar',
      tuyo: 'I ii V I',
      path: 'rearmonizar',
      salida: 'I V/V V I',
      contexto: { melodia: [[], [{ nota: 5, fuerte: true }], [], []] },
    });
    expect(choca.descarte).toBe('choca con el punteo');
    expect(motivo(choca, 'melodia')).toContain('choca de frente');
    // Un Mi sobre Rem: la novena, que roza la tercera y se canta a diario.
    const novena = juzga({
      kind: 'retocar',
      tuyo: 'I IV V I',
      path: 'rearmonizar',
      salida: 'I ii V I',
      contexto: { melodia: [[], [{ nota: 4, fuerte: true }], [], []] },
    });
    expect(novena.descarte).toBeNull();
    // Lo que no cabe sin chocar resta, y casi todo el punteo fuera es un reparo.
    const fuera = juzga({
      kind: 'retocar',
      tuyo: 'I IV V I',
      path: 'rearmonizar',
      salida: 'I vi V I',
      contexto: {
        melodia: [
          [],
          [
            { nota: 2, fuerte: true },
            { nota: 2, fuerte: true },
            { nota: 2, fuerte: true },
          ],
          [],
          [],
        ],
      },
    });
    conReparo(fuera);
  });

  it('rearmonizar copiando el acorde de al lado no pone otro acorde', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I V/V ii V',
      path: 'rearmonizar',
      salida: 'I ii ii V',
    });
    conReparo(r);
    expect(motivo(r, 'novedad')).toContain('no pone otro acorde, alarga uno');
    // Lo que ya se repetía en lo tuyo no cuenta.
    const tuyo = juzga({
      kind: 'retocar',
      tuyo: 'I IV V V',
      path: 'rearmonizar',
      salida: 'I ii V V',
    });
    expect(tuyo.descarte).toBeNull();
  });

  it('quitar el color que hacía tuya la canción tiene reparo, salvo el final que cambia el final', () => {
    const iv = juzga({
      kind: 'retocar',
      tuyo: 'I IV iv I',
      path: 'rearmonizar',
      salida: 'I IV V I',
    });
    expect(motivo(iv, 'novedad')).toBe(
      'Quita iv, el color que hacía tuya la canción, y no pone otro.',
    );
    conReparo(iv);
    const sus = encaje(
      'major',
      'retocar',
      pasos('I IV V I'),
      { especies: [null, null, 'sus4', null] },
      {
        path: 'rearmonizar',
        cancion: pasos('I IV ii I'),
      },
    );
    expect(motivo(sus, 'novedad')).toContain('V(sus4)');
    // Otro color en su lugar sí vale.
    expect(
      juzga({ kind: 'retocar', tuyo: 'I IV iv I', path: 'rearmonizar', salida: 'I IV bVI I' })
        .puntos,
    ).toBeGreaterThanOrEqual(ENCAJE_MINIMO);
    // Y si el color era tu último acorde, otro final no puede dejarlo en su sitio.
    const alFinal = juzga({
      kind: 'retocar',
      tuyo: 'I IV V bVII',
      path: 'otro-final',
      salida: 'I IV V I',
    });
    expect(valor(alFinal, 'novedad')).toBe(-1);
    expect(alFinal.descarte).toBeNull();
  });

  it('las frases de tres a propósito se siguen de tres en tres', () => {
    const tres = 'I IV V vi IV V';
    expect(motivo(juzga({ tuyo: tres, path: 'seguir', salida: 'ii V I' }), 'frase')).toBe(
      '9 compases: la frase se cuenta de 3 en 3, como las tuyas.',
    );
    const ocho = juzga({ tuyo: tres, path: 'seguir', salida: 'IV I' });
    expect(motivo(ocho, 'frase')).toBe('8 compases: rompe tus frases de 3.');
    expect(ocho.descarte).toBe('rompe tus frases de 3 compases');
    // Y acabar en el aire a mitad de la tuya se dice con su largo.
    expect(motivo(juzga({ tuyo: tres, path: 'seguir', salida: 'I IV V V' }), 'cadencia')).toContain(
      'a mitad de un grupo de 3',
    );
  });

  it('un estribillo que nunca llegó no se descarta al retocarlo, ni uno modal', () => {
    const sinLlegada = (salida: string) =>
      juzga({
        kind: 'retocar',
        tuyo: 'I vi IV iii',
        path: 'otro-final',
        salida,
        contexto: { papel: 'estribillo' },
      });
    expect(sinLlegada('I vi IV vi').descarte).toBeNull();
    expect(valor(sinLlegada('I vi IV vi'), 'papel')).toBe(-0.4);
    const modal = juzga({
      kind: 'retocar',
      tuyo: 'I bVII IV bVII',
      path: 'otro-final',
      salida: 'I bVII bVI bVII',
      contexto: { papel: 'estribillo' },
    });
    expect(modal.descarte).toBeNull();
  });

  it('al continuar un pre o un puente, lo que completa tu frase no se descarta', () => {
    const puente = juzga({
      tuyo: 'vi ii IV',
      path: 'seguir',
      salida: 'I',
      contexto: { papel: 'puente' },
    });
    expect(puente.descarte).toBeNull();
    expect(motivo(puente, 'papel')).toContain('ya ha vuelto');
    const pre = juzga({
      tuyo: 'vi ii IV',
      path: 'seguir',
      salida: 'vi',
      contexto: { papel: 'pre' },
    });
    expect(pre.descarte).toBeNull();
  });

  /**
   * Quien la construye la llama «Otro estribillo» y dice que es la misma parte otra
   * vez (`loQueSeAnade`), y así se juzga. Sin decirlo, lo que sigue a un estribillo
   * es el final (`PARTE_QUE_SIGUE`), y uno de ocho compases es otra canción.
   */
  it('la coda larga detrás de un estribillo deja paso a otro estribillo', () => {
    const pregunta = {
      tuyo: 'I vi IV V',
      path: 'seguir',
      salida: 'I vi IV V I IV V I',
      contexto: { papel: 'estribillo' },
    } as const;
    const otro = juzga({ ...pregunta, loQueSeAnade: 'misma' });
    expect(otro.descarte).toBeNull();
    expect(otro.puntos).toBeGreaterThanOrEqual(ENCAJE_MINIMO);
    expect(motivo(otro, 'papel')).toContain('Lo que se añade al estribillo');
    expect(motivo(juzga(pregunta), 'papel')).toContain('Lo que sigue, el final, dura 8 compases');
  });

  it('lo que se añade se juzga como la parte que dice quien lo construye', () => {
    const pregunta = {
      tuyo: 'I IV',
      path: 'contraste',
      salida: 'vi V',
      contexto: { papel: 'intro' },
    } as const;
    // Sin decirlo, completa tu intro; dicho, es la estrofa que sigue.
    expect(motivo(juzga(pregunta), 'papel')).toMatch(/^La intro acaba en V/u);
    expect(motivo(juzga({ ...pregunta, loQueSeAnade: 'otra' }), 'papel')).toMatch(
      /^Lo que sigue, la estrofa, acaba en V/u,
    );
    expect(
      motivo(juzga({ ...pregunta, path: 'seguir', salida: 'V I', loQueSeAnade: 'tuya' }), 'papel'),
    ).toMatch(/^La intro /u);
    expect(PARTE_QUE_SIGUE.seguir.estrofa).toBe('estribillo');
    expect(PARTE_QUE_SIGUE.contraste.estribillo).toBe('puente');
  });
});

describe('lo que enseñó la prueba ciega', () => {
  /** Unos compases con especie: `'I:dominant7 IV'`. */
  function conEspecies(texto: string): PasoJuzgado[] {
    return texto.split(' ').map((token) => {
      const [grado, especie] = token.split(':');
      return {
        degree: grado as DegreeSymbol,
        beats: 4,
        ...(especie === undefined ? {} : { especie: especie as PasoJuzgado['especie'] }),
      };
    });
  }

  it('la plagal es IV I; ii I llega a casa, pero no es el amén', () => {
    const desde = (salida: string) => juzga({ tuyo: 'I vi', path: 'seguir', salida });
    expect(motivo(desde('IV I'), 'sintaxis')).toBe('IV I: cadencia plagal, el amén.');
    expect(motivo(desde('iv I'), 'sintaxis')).toBe('iv I: cadencia plagal menor.');
    expect(motivo(desde('ii I'), 'sintaxis')).toBe(
      'ii I: llega desde el ii sin pasar por la dominante.',
    );
    expect(motivo(desde('ii I'), 'cadencia')).toBe(
      'ii I en el 4: llega desde el ii sin pasar por la dominante, y llega en el compás fuerte.',
    );
    // Y la perfecta desde el bII7 dice que es la del sustituto tritonal.
    expect(motivo(desde('ii bII{tritono}'), 'cadencia')).not.toContain('perfecta');
    expect(
      motivo(juzga({ tuyo: 'I vi ii', path: 'seguir', salida: 'bII{tritono} I' }), 'cadencia'),
    ).toBe(
      'bII I en el 5: cadencia perfecta por el sustituto tritonal, y llega en el compás fuerte.',
    );
    // Una coda plagal es IV I, no cualquier subdominante.
    const coda = (salida: string) =>
      juzga({ tuyo: 'I vi IV V', path: 'seguir', salida, contexto: { papel: 'final' } });
    expect(motivo(coda('I ii I I'), 'papel')).not.toContain('coda plagal');
  });

  it('el vii° tríada no cierra como la dominante, y en un estilo de canción casi nada', () => {
    const cierre = (salida: string, estilo?: 'pop') =>
      juzga({
        tuyo: 'I vi ii IV',
        path: 'seguir',
        salida,
        contexto: estilo === undefined ? {} : { estilo },
      });
    expect(motivo(cierre('ii IV vii° I'), 'cadencia')).toBe(
      'vii° I en el 8: llega desde el vii°, con la sensible y sin la dominante entera, y llega en el compás fuerte.',
    );
    expect(valor(cierre('ii IV vii° I'), 'cadencia')).toBeLessThan(
      valor(cierre('ii IV V I'), 'cadencia'),
    );
    expect(valor(cierre('ii IV vii° I', 'pop'), 'cadencia')).toBeLessThan(
      valor(cierre('ii IV vii° I'), 'cadencia'),
    );
    // No es un cierre fuerte para el papel de final.
    const final = juzga({
      tuyo: 'I vi ii IV',
      path: 'seguir',
      salida: 'ii IV vii° I',
      contexto: { papel: 'final' },
    });
    expect(motivo(final, 'papel')).toContain('cierra, pero sin dominante');
    // Con su séptima es la dominante de novena sin bajo, y cierra como ella.
    const conSeptima = encaje(
      'major',
      'continuar',
      pasos('I vi ii IV'),
      {},
      {
        path: 'seguir',
        cancion: [...pasos('I vi ii IV ii IV'), ...conEspecies('vii°:halfDiminished7 I')],
      },
    );
    expect(motivo(conSeptima, 'cadencia')).toContain('cadencia perfecta');
  });

  it('V bVI es una cadencia rota, no una retrogresión, también en jazz', () => {
    const rota = juzga({
      tuyo: 'I IV',
      path: 'seguir',
      salida: 'V bVI IV V',
      contexto: { estilo: 'jazz' },
    });
    expect(motivo(rota, 'sintaxis')).not.toContain('retrogresión');
    expect(rota.descarte).toBeNull();
    expect(valor(rota, 'sintaxis')).toBeGreaterThan(0);
    const alFinal = juzga({ tuyo: 'I V', path: 'seguir', salida: 'bVI' });
    expect(motivo(alFinal, 'sintaxis')).toBe('V bVI: acaba en el bVI, sin cerrar.');
    const sigue = juzga({ tuyo: 'I IV', path: 'seguir', salida: 'V bVI bVII I' });
    expect(motivo(sigue, 'sintaxis')).not.toContain('vuelve a la subdominante');
  });

  it('el I7 que va al IV hace de dominante, como lo construye quien hace las salidas', () => {
    const gospel = encaje(
      'major',
      'retocar',
      pasos('I vi IV IV'),
      {},
      { path: 'rearmonizar', cancion: conEspecies('I I:dominant7 IV IV') },
    );
    expect(motivo(gospel, 'sintaxis')).toBe('I7 IV: el I7 hace de dominante del IV, y llega.');
    expect(motivo(gospel, 'notas-comunes')).toContain('I7 IV en el 2: llega a lo que preparaba.');
    // El VI7 de menor que baja al V es el sustituto tritonal de su dominante.
    const menor = encaje(
      'minor',
      'continuar',
      pasos('i VI'),
      { especies: [null, 'dominant7'] },
      { path: 'seguir', cancion: [...pasos('i VI'), ...conEspecies('V')] },
    );
    expect(criterio(menor, 'sintaxis')).toEqual({
      id: 'sintaxis',
      valor: 0.8,
      motivo: 'VI7 V: el VI7 baja medio tono a la dominante, como un sustituto tritonal.',
    });
    // Y el I7 que se queda es la tónica de un blues, no una promesa sin cumplir.
    const blues = encaje(
      'major',
      'continuar',
      pasos('I I IV IV'),
      { estilo: 'blues', especies: ['dominant7', 'dominant7', 'dominant7', 'dominant7'] },
      {
        path: 'seguir',
        cancion: [
          ...pasos('I I IV IV'),
          ...conEspecies('I:dominant7 V:dominant7 I:dominant7 I:dominant7'),
        ],
      },
    );
    expect(motivo(blues, 'notas-comunes')).not.toContain('prepara otro acorde');
  });

  it('un contraste que pasa por la tónica gasta su vuelta antes de tiempo', () => {
    const limpio = juzga({ tuyo: 'I V vi IV', path: 'contraste', salida: 'vi IV ii V' });
    const conCasa = juzga({ tuyo: 'I V vi IV', path: 'contraste', salida: 'IV V I vi IV I V/V V' });
    expect(motivo(conCasa, 'cadencia')).toBe(
      'La parte nueva ya llega a la I 2 veces antes de volver: la vuelta se gasta antes de tiempo.',
    );
    expect(valor(conCasa, 'cadencia')).toBeLessThan(0);
    expect(conCasa.puntos).toBeLessThan(limpio.puntos - 5);
    // Y con el papel de puente, cada tónica resta medio punto.
    const puente = juzga({
      tuyo: 'I V vi IV',
      path: 'contraste',
      salida: 'IV V I vi IV I V/V V',
      contexto: { papel: 'estribillo' },
    });
    expect(valor(puente, 'papel')).toBe(-0.5);
  });

  it('al retocar el estilo también pesa: la cuatríada de la escala es de casa en jazz', () => {
    const jazz = (cancion: string) =>
      encaje(
        'major',
        'retocar',
        pasos('I IV I IV'),
        { estilo: 'jazz', especies: ['major7', 'major7', 'major7', 'major7'] },
        { path: 'rearmonizar', cancion: conEspecies(cancion) },
      );
    const ii7 = jazz('I:major7 ii:minor7 I:major7 IV:major7');
    expect(motivo(ii7, 'estilo')).toBe('Acordes de la tonalidad, lo de casa en jazz.');
    expect(valor(ii7, 'estilo')).toBe(0.5);
    // La tríada pelada, en cambio, no es lo de casa.
    expect(valor(jazz('I:major7 ii I:major7 IV:major7'), 'estilo')).toBeLessThan(0);
    // Y lo que viene de fuera es las dos cosas: un préstamo con su séptima.
    expect(valor(jazz('I:major7 iv:minor7 I:major7 IV:major7'), 'estilo')).toBeLessThan(
      valor(ii7, 'estilo'),
    );
  });

  it('al retocar, quitar un giro de casa resta, y cambiarlo por otro no', () => {
    const jazz = (cancion: string) =>
      juzga({
        kind: 'retocar',
        tuyo: 'I vi ii V I',
        path: 'rearmonizar',
        salida: cancion,
        contexto: { estilo: 'jazz' },
      });
    const quita = jazz('I vi IV V I');
    expect(motivo(quita, 'estilo')).toBe('Quita vi ii V, cayendo por quintas.');
    // El sustituto tritonal cambia un giro por otro: no quita nada.
    const tritono = jazz('I vi ii bII{tritono} I');
    expect(motivo(tritono, 'estilo')).not.toContain('Quita');
    expect(valor(tritono, 'estilo')).toBeGreaterThan(valor(quita, 'estilo'));
  });

  it('un vamp sobre la tónica que va al cuarto y vuelve es su movimiento de siempre', () => {
    const vamp = (tuyo: string, salida: string, mode: KeyMode = 'major') =>
      juzga({ mode, tuyo, path: 'seguir', salida });
    const funk = vamp('i i', 'iv iv i i', 'minor');
    expect(motivo(funk, 'forma')).toBe(
      'Tu vamp en i va al iv y vuelve: el movimiento de un vamp sobre la tónica.',
    );
    // Y su vuelta cierra como un modo sin sensible, no como una plagal floja.
    expect(valor(funk, 'cadencia')).toBeGreaterThan(
      valor(vamp('i iv', 'iv iv i i', 'minor'), 'cadencia'),
    );
    // Solo si va al cuarto y vuelve, sin nada más.
    expect(motivo(vamp('I I', 'IV V I I'), 'forma')).not.toContain('vamp');
    expect(motivo(vamp('I I', 'vi IV I I'), 'forma')).not.toContain('vamp');
    expect(motivo(vamp('I I', 'IV IV IV V'), 'forma')).not.toContain('vamp');
  });

  it('semicadencia es pararse en el V; lo demás queda en tensión', () => {
    const vii = juzga({ tuyo: 'I vi', path: 'seguir', salida: 'IV vii°' });
    expect(motivo(vii, 'cadencia')).toBe(
      'Acaba en vii° en el compás 4: queda en tensión, pide seguir.',
    );
    const v = juzga({ tuyo: 'I vi', path: 'seguir', salida: 'IV V' });
    expect(motivo(v, 'cadencia')).toBe('Acaba en V en el compás 4: semicadencia, pide seguir.');
  });
});

/**
 * Las causas que encontró el corpus ciego, cada una con su regla: no son casos,
 * son maneras de oír una canción que el juez no tenía.
 */
describe('lo que el corpus ciego enseñó al juez', () => {
  it('una canción que llega a casa por su color tiene su cadencia: el VII eólico, el iv de cine', () => {
    expect(cadenciaPropia('minor', ['i', 'VII', 'i', 'VII'])).toBe('VII');
    expect(cadenciaPropia('minor', ['i', 'VI', 'III', 'VII'])).toBe('VII');
    expect(cadenciaPropia('major', ['I', 'iv', 'I', 'iv'])).toBe('iv');
    // Con una dominante que lleve la sensible, la cadencia es la de siempre.
    expect(cadenciaPropia('minor', ['i', 'VII', 'V', 'i'])).toBeNull();
    expect(cadenciaPropia('major', ['I', 'iv', 'V/ii', 'iv'])).toBeNull();
    // Y el IV de la escala no es un color elegido.
    expect(cadenciaPropia('major', ['I', 'IV', 'I', 'IV'])).toBeNull();
    expect(cadenciaPropia('minor', ['i', 'iv', 'VI', 'III'])).toBeNull();

    // Las dos cadencias se cambian los papeles: cerrar como tú cierra entero.
    const reggae = (salida: string) =>
      juzga({ mode: 'minor', tuyo: 'i VII i VII', path: 'seguir', salida });
    expect(valor(reggae('VI VII i i'), 'cadencia')).toBeGreaterThan(
      valor(reggae('VI V i i'), 'cadencia'),
    );
    expect(motivo(reggae('VI V i i'), 'cadencia')).toContain('pero lo tuyo llega por el VII');
    const cine = (salida: string) => juzga({ tuyo: 'I iv I iv', path: 'seguir', salida });
    expect(valor(cine('I IV iv I'), 'cadencia')).toBeGreaterThan(
      valor(cine('I IV V I'), 'cadencia'),
    );
    // La v sin sensible no es la tuya: no se lleva lo que es del VII.
    expect(valor(reggae('VI iv v i'), 'cadencia')).toBeLessThan(
      valor(reggae('VI VI VII i'), 'cadencia'),
    );
  });

  it('una frase que llega y se sostiene se repite; un periodo que acaba así, ha acabado', () => {
    // En `ii V I I` el compás que sostiene es el sitio de la vuelta: cambiarlo no
    // quita la llegada, y se juzga por cómo vuelve a empezar.
    const vuelta = juzga({
      kind: 'retocar',
      tuyo: 'ii V I I',
      path: 'rearmonizar',
      salida: 'ii V I vi{relativo}',
    });
    expect(motivo(vuelta, 'novedad')).not.toContain('Quita la llegada');
    expect(motivo(vuelta, 'cadencia')).toContain('Tu bucle vuelve a empezar');
    // En un periodo de dos frases la tónica sostenida es el final.
    const periodo = juzga({
      kind: 'retocar',
      tuyo: 'I vi IV V I vi V I I',
      path: 'rearmonizar',
      salida: 'I vi IV V I vi V I vi{relativo}',
    });
    expect(motivo(periodo, 'novedad')).toBe('Quita la llegada a I del compás 8, que ya cerraba.');
    // Y tocar el compás en que llega es quitarla, también en una frase sola.
    const llegada = juzga({
      kind: 'retocar',
      tuyo: 'VI VII i i',
      mode: 'minor',
      path: 'rearmonizar',
      salida: 'VI VII III{relativo} i',
    });
    expect(motivo(llegada, 'novedad')).toBe('Quita la llegada a i del compás 3, que ya cerraba.');
  });

  it('un contraste que reposa dos veces en casa tiene reparo', () => {
    const reposa = juzga({ tuyo: 'I IV I IV', path: 'contraste', salida: 'V I vi I V/ii ii IV V' });
    conReparo(reposa);
    const pasa = juzga({ tuyo: 'I IV I IV', path: 'contraste', salida: 'V I vi ii V/ii ii IV V' });
    expect(pasa.puntos).toBeGreaterThanOrEqual(ENCAJE_MINIMO);
  });

  it('el color se pierde por clases: un III7 no repone el iv de un soul', () => {
    const soul = juzga({
      kind: 'retocar',
      tuyo: 'I vi IV iv',
      path: 'otro-final',
      salida: 'I vi V/vi vi',
    });
    expect(motivo(soul, 'novedad')).toBe(
      'Quita iv, el color que hacía tuya la canción, y no pone otro.',
    );
    conReparo(soul);
    // En menor el bII es de la casa: cambiarlo por el iv que inflexiona no quita nada.
    const napolitano = juzga({
      kind: 'retocar',
      mode: 'minor',
      tuyo: 'i VI bII V',
      path: 'rearmonizar',
      salida: 'i VI iv{funcion} V',
    });
    expect(motivo(napolitano, 'novedad')).not.toContain('el color');
    expect(napolitano.puntos).toBeGreaterThanOrEqual(ENCAJE_MINIMO);
  });

  it('la bajada que es toda la canción no se rompe; un ciclo de quintas corto sí se retoca', () => {
    expect(esUnaBajada('minor', ['i', 'VII', 'VI', 'V'])).toBe(true);
    expect(esUnaBajada('major', ['I', 'ii', 'iii', 'IV'])).toBe(true);
    expect(esUnaBajada('minor', ['i', 'iv', 'VII', 'III'])).toBe(false);
    expect(esUnaBajada('minor', ['i', 'VII', 'VI'])).toBe(false);
    const andaluza = juzga({
      kind: 'retocar',
      mode: 'minor',
      tuyo: 'i VII VI V',
      path: 'rearmonizar',
      salida: 'i VII V/V{dominante} V',
    });
    conReparo(andaluza);
    const ciclo = juzga({
      kind: 'retocar',
      mode: 'minor',
      tuyo: 'i iv VII III',
      path: 'rearmonizar',
      salida: 'i ii°{funcion} VII III',
    });
    expect(ciclo.puntos).toBeGreaterThanOrEqual(ENCAJE_MINIMO);
  });

  it('un vamp modal no se queda con la sensible de su centro', () => {
    // El Do# de un dórico sobre Re, escrito en Do: el A7 lo vuelve un Re menor.
    expect(sensibleDelCentro('major', 'ii')).toBe(1);
    const dorico = juzga({
      kind: 'retocar',
      tuyo: 'ii V ii V',
      path: 'rearmonizar',
      salida: 'ii V/ii{dominante} ii V',
    });
    expect(dorico.descarte).toBe('mete la sensible del centro de tu vamp');
    expect(motivo(dorico, 'forma')).toBe(
      'Tu vamp vive en ii sin su sensible, y el V/ii la trae: deja de ser modal.',
    );
    // Si tu vamp ya la tenía, es tuya: el VII de `III VII` lleva la del III.
    const suya = juzga({
      mode: 'minor',
      tuyo: 'III VII III VII',
      path: 'contraste',
      salida: 'VI VII',
    });
    expect(suya.descarte).toBeNull();
  });

  it('lo que vive de lo prestado no tiene tope de préstamos, y lo tuyo no cuenta para él', () => {
    expect(vivePrestado('major', ['I', 'iv', 'I', 'iv'])).toBe(true);
    expect(vivePrestado('major', ['I', 'bVI', 'bVII', 'I'])).toBe(true);
    expect(vivePrestado('major', ['I', 'IV', 'iv', 'I'])).toBe(false);
    expect(vivePrestado('major', ['I', 'iv', 'V/vi', 'iv'])).toBe(false);
    expect(vivePrestado('minor', ['i', 'iv', 'i', 'iv'])).toBe(false);
    const cine = juzga({ tuyo: 'I iv I iv', path: 'contraste', salida: 'bVII IV iv bVI' });
    expect(motivo(cine, 'novedad')).not.toContain('compases prestados');
    // Sin vivir de ello, el iv que ya tocabas tampoco cuenta.
    const soul = juzga({ tuyo: 'I vi IV iv', path: 'seguir', salida: 'I vi IV iv bVII I V I' });
    expect(motivo(soul, 'novedad')).not.toContain('compases prestados');
  });
});

/**
 * Los seis estilos que llegaron después: cada uno con su idioma, y el juez lo oye
 * solo cuando se dice. Sin estilo, lo de siempre.
 */
describe('los estilos que llegaron después', () => {
  const con = (estilo: StyleId | undefined): ContextoDeSalidas =>
    estilo === undefined ? {} : { estilo };

  it('el V de un flamenco es su reposo: llegar a él es llegar', () => {
    const reposo = (estilo: StyleId | undefined, mode: KeyMode, grados: DegreeSymbol[]) =>
      reposoFrigio(mode, estilo, grados, grados);
    expect(reposo('flamenco', 'minor', ['i', 'VII', 'VI', 'V'])).toBe(3);
    expect(reposo('flamenco', 'minor', ['i', 'iv', 'V', 'V'])).toBe(2);
    // Sin el estilo, solo si lo tuyo es la andaluza entera (`andaluzaFrigia`); en
    // mayor, sin el semitono o el iv delante, no es el reposo.
    expect(reposo(undefined, 'minor', ['i', 'VII', 'VI', 'V'])).toBe(3);
    expect(reposo(undefined, 'minor', ['i', 'iv', 'V', 'V'])).toBeNull();
    expect(reposo('flamenco', 'major', ['I', 'vi', 'IV', 'V'])).toBeNull();
    expect(reposo('flamenco', 'minor', ['i', 'VII', 'V'])).toBeNull();
    expect(reposo('flamenco', 'minor', ['V'])).toBeNull();
    expect(reposo('flamenco', 'minor', ['i', 'VI'])).toBeNull();

    const final = (estilo?: StyleId) =>
      juzga({
        mode: 'minor',
        kind: 'retocar',
        tuyo: 'i iv i i',
        path: 'otro-final',
        salida: 'i VII VI V',
        contexto: { papel: 'final', ...con(estilo) },
      });
    expect(final().descarte).toBe('un final que acaba abierto');
    expect(final('flamenco').descarte).toBeNull();
    expect(motivo(final('flamenco'), 'cadencia')).toBe(
      'VI V en el 4: llega al V, el reposo frigio del flamenco.',
    );
    expect(valor(final('flamenco'), 'cadencia')).toBeGreaterThan(0.7);
  });

  it('y llega a destiempo si cae donde no cierra la frase', () => {
    const corta = juzga({
      mode: 'minor',
      kind: 'retocar',
      tuyo: 'i iv i',
      path: 'otro-final',
      salida: 'i VI V',
      contexto: { estilo: 'flamenco' },
    });
    expect(motivo(corta, 'cadencia')).toBe(
      'VI V en el 3: llega al V, el reposo frigio del flamenco, pero a destiempo de la frase.',
    );
  });

  it('en flamenco, la novena menor sobre el V es la nota, y sobre lo demás choca', () => {
    // Fa fuerte —8 sobre La— en el compás que pasa a Mi mayor.
    const fa = [{ nota: 8, fuerte: true }];
    const sobre = (grado: DegreeSymbol, estilo?: StyleId) =>
      juzga({
        mode: 'minor',
        kind: 'retocar',
        tuyo: 'i VII VI VII',
        path: 'rearmonizar',
        salida: `i VII VI ${grado}`,
        contexto: { melodia: [[], [], [], fa], ...con(estilo) },
      });
    expect(sobre('V').descarte).toBe('choca con el punteo');
    expect(sobre('V', 'flamenco').descarte).toBeNull();
    expect(valor(sobre('V', 'flamenco'), 'melodia')).toBe(1);
    // El Si bemol sobre el La de la tónica no es del frigio mayor: choca igual.
    const sib = juzga({
      mode: 'minor',
      kind: 'retocar',
      tuyo: 'VII VI VII VI',
      path: 'rearmonizar',
      salida: 'VII VI VII i',
      contexto: { melodia: [[], [], [], [{ nota: 1, fuerte: true }]], estilo: 'flamenco' },
    });
    expect(sib.descarte).toBe('choca con el punteo');
  });

  it('el bII del flamenco es el del menor: en mayor no es suyo', () => {
    const napolitano = (mode: KeyMode) =>
      juzga({
        mode,
        tuyo: mode === 'major' ? 'I IV I IV' : 'i iv i iv',
        path: 'seguir',
        salida: mode === 'major' ? 'bII I' : 'bII i',
        contexto: { estilo: 'flamenco' },
      });
    expect(napolitano('major').descarte).toBe('bII no es de flamenco');
    expect(napolitano('minor').descarte).toBeNull();
    expect(motivo(napolitano('minor'), 'estilo')).toBe('bII i, el semitono frigio.');
  });

  it('en cine, una secundaria en tríada que salta una tercera es una mediante', () => {
    const mediante = (estilo?: StyleId, salida = 'I V/vi I I') =>
      juzga({
        kind: 'retocar',
        tuyo: 'I vi I I',
        path: 'rearmonizar',
        salida,
        contexto: con(estilo),
      });
    expect(valor(mediante(), 'sintaxis')).toBeLessThan(0);
    expect(motivo(mediante('cine'), 'sintaxis')).toBe(
      'V/vi I: el V/vi en tríada no prepara, colorea: una mediante cromática.',
    );
    expect(valor(mediante('cine'), 'notas-comunes')).toBeGreaterThan(0);
    expect(motivo(mediante('cine'), 'estilo')).toBe('I V/vi, el III mayor: la mediante cromática.');
    // El II mayor que vuelve a casa es el lidio; y el VII mayor, que no salta una
    // tercera ni es el lidio, sigue siendo una promesa rota.
    expect(motivo(mediante('cine', 'I V/V I I'), 'sintaxis')).toBe(
      'V/V I: el II mayor que vuelve a casa, el color lidio.',
    );
    expect(valor(mediante('cine', 'I V/iii I I'), 'sintaxis')).toBeLessThan(0);
    expect(valor(mediante('cine', 'I V/V ii I'), 'sintaxis')).toBeLessThan(0);
  });

  it('y con la séptima de dominante promete, también en cine', () => {
    const r = encaje(
      'major',
      'retocar',
      pasos('I vi I I'),
      { estilo: 'cine' },
      {
        path: 'rearmonizar',
        cancion: [
          ...pasos('I'),
          { degree: 'V/vi', beats: 4, especie: 'dominant7' },
          ...pasos('I I'),
        ],
      },
    );
    expect(motivo(r, 'sintaxis')).toBe('V/vi I: V/vi prepara otro acorde y no llega a él.');
  });

  it('el reggae cambia a medio compás, y eso no es otro paso', () => {
    const medio = (estilo: StyleId) =>
      juzga({
        tuyo: 'I IV I IV',
        path: 'seguir',
        salida: 'I/2 V/2 IV/2 V/2 I',
        contexto: { estilo },
      });
    expect(motivo(medio('reggae'), 'ritmo-armonico')).not.toContain('cambia el paso');
    expect(valor(medio('reggae'), 'ritmo-armonico')).toBeGreaterThan(
      valor(medio('pop'), 'ritmo-armonico'),
    );
  });

  it('la dominante que vuelve al IV: idioma en funk y en reggae, fuera en bolero', () => {
    const vuelve = (estilo: StyleId) =>
      juzga({ tuyo: 'I IV I V', path: 'seguir', salida: 'IV', contexto: { estilo } });
    expect(motivo(vuelve('funk'), 'sintaxis')).toBe(
      'V IV: la dominante vuelve a la subdominante, que en funk es idioma.',
    );
    expect(valor(vuelve('reggae'), 'sintaxis')).toBeGreaterThan(0);
    expect(vuelve('bolero').descarte).toBe('V IV vuelve atrás, y en bolero no se hace.');
  });

  it('cerrar sin sensible: de casa en reggae y en cine, fuera en bolero', () => {
    const eolico = (estilo: StyleId) =>
      juzga({
        mode: 'minor',
        tuyo: 'i iv i iv',
        path: 'seguir',
        salida: 'VII i',
        contexto: { estilo },
      });
    expect(valor(eolico('reggae'), 'cadencia')).toBeGreaterThan(
      valor(eolico('bolero'), 'cadencia'),
    );
    expect(eolico('bolero').descarte).toBe('VII i cierra sin la sensible que aquí se pide');
    expect(valor(eolico('cine'), 'sintaxis')).toBeGreaterThan(0);
  });

  it('cada uno reconoce su giro', () => {
    const giro = (estilo: StyleId, mode: KeyMode, tuyo: string, salida: string) =>
      motivo(juzga({ mode, tuyo, path: 'seguir', salida, contexto: { estilo } }), 'estilo');
    expect(giro('country', 'major', 'I IV I IV', 'I V/V V I')).toBe('V/V V I, el II7 del country.');
    expect(giro('cine', 'major', 'I iv I iv', 'I bVI bVII I')).toBe(
      'bVI bVII I, la subida épica del cine.',
    );
    expect(giro('bolero', 'major', 'I IV I IV', 'V/ii ii V I')).toBe(
      'V/ii ii V I, la cadena del bolero.',
    );
    expect(giro('flamenco', 'minor', 'i iv i iv', 'i VII VI V')).toBe(
      'i VII VI V, la cadencia andaluza.',
    );
    expect(giro('funk', 'major', 'I I I I', 'IV IV I I')).toBe('IV I, la vuelta del vamp.');
    expect(giro('reggae', 'minor', 'i iv i iv', 'i VII i i')).toBe('VII i, cierra sin sensible.');
  });

  it('y el que no es suyo resta: la cadena de secundarias en un country', () => {
    const contraste = (salida: string) =>
      juzga({ tuyo: 'I IV I IV', path: 'contraste', salida, contexto: { estilo: 'country' } });
    // Las dos llevan el II7 delante del V; la primera llega a él por otra secundaria.
    expect(valor(contraste('I V/ii V/V V'), 'estilo')).toBeLessThan(
      valor(contraste('I vi V/V V'), 'estilo'),
    );
  });

  it('repetir tu vuelta es otro coro en funk, reggae, flamenco y cine; en country no', () => {
    const otraVez = (estilo: StyleId) =>
      motivo(
        juzga({ tuyo: 'I IV V I', path: 'seguir', salida: 'I IV V I', contexto: { estilo } }),
        'novedad',
      );
    for (const estilo of ['funk', 'reggae', 'flamenco', 'cine'] as const) {
      expect(otraVez(estilo), estilo).toBe('Repite tu vuelta, otro coro.');
    }
    expect(otraVez('country')).toBe('Repite tu vuelta sin aportar nada.');
  });

  it('el cine no pone tope a lo prestado; el funk y el flamenco, dos', () => {
    const prestados = (estilo: StyleId) =>
      motivo(
        juzga({ tuyo: 'I IV I IV', path: 'seguir', salida: 'bVI iv bIII I', contexto: { estilo } }),
        'novedad',
      );
    expect(prestados('cine')).not.toContain('compases prestados');
    expect(prestados('funk')).toContain('3 compases prestados');
    expect(prestados('country')).toContain('3 compases prestados');
  });
});

/** Los movimientos que cambian el papel a propósito se juzgan por su sitio. */
describe('lo que se juzga por su sitio', () => {
  it('la dominante partida: el juez la empareja por pulsos, y el ii prepara la suya', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I vi V I',
      path: 'rearmonizar',
      salida: 'I vi ii{ii-v}/2 V{ii-v}/2 I',
    });
    expect(motivo(r, 'notas-comunes')).toContain('la dominante partida en su ii y ella');
    expect(r.descarte).toBeNull();
  });

  it('lo que dice serlo sin estar en su sitio se juzga como cualquier sustitución', () => {
    const r = juzga({
      kind: 'retocar',
      tuyo: 'I vi IV V',
      path: 'rearmonizar',
      salida: 'I vi IV ii{ii-v}',
    });
    expect(motivo(r, 'notas-comunes')).not.toContain('partida');
  });

  it('la predominante y el cambio rápido no se castigan por no parecerse a lo que había', () => {
    const vals = juzga({
      kind: 'retocar',
      tuyo: 'I I V V',
      path: 'rearmonizar',
      salida: 'I IV{predominante} V V',
    });
    expect(valor(vals, 'notas-comunes')).toBeGreaterThan(0);
    const blues = juzga({
      kind: 'retocar',
      tuyo: 'I I I I IV IV I I V IV I V',
      path: 'rearmonizar',
      salida: 'I IV{cambio-rapido} I I IV IV I I V IV I V',
      contexto: { estilo: 'blues' },
    });
    expect(motivo(blues, 'notas-comunes')).toContain('el cambio rápido del blues');
  });
});
