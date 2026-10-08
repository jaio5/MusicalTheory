/**
 * **Toda frase de una salida es verdad en su canción.** La regla general
 * (`lo-que-dice.ts`): si el texto nombra un sitio, se mira qué hay en ese sitio.
 *
 * Dos partes. La primera, la regla, de los dos lados: lo que dice una mentira lo
 * caza y lo que dice la verdad lo deja pasar. La segunda, **el barrido**: miles de
 * salidas —los cinco corpus y canciones al azar con contexto— y ni una frase falsa
 * en su nombre, en lo que hace ni en los motivos del juez.
 */

import { describe, expect, it } from 'vitest';

import type { KeyMode } from '../keys';
import type { DegreeSymbol } from '../progressions';
import { ROLES } from '../song';
import { STYLE_IDS } from '../styles';
import type { ContextoDeSalidas } from './contexto';
import { CORPUS_CIEGO } from './corpus/corpus-ciego';
import { CORPUS } from './corpus/corpus-de-salidas';
import { CORPUS_DE_VERIFICACION } from './corpus/corpus-de-verificacion';
import { CORPUS_FINAL } from './corpus/corpus-final';
import { CORPUS_QUINTO } from './corpus/corpus-quinto';
import {
  enlaceNombrado,
  gradoDicho,
  hablaDeUnSitio,
  loQueHayEnLaSalida,
  loQueNoEsVerdad,
  type LoQueHay,
  type PasoDicho,
} from './lo-que-dice';
import { salidasPosibles } from './menu';
import type { PathKind, PathStep } from './tipos';

/** Grados a cuatro pulsos, o a los que diga `:n`: `'I V:2 vi:2'`. */
function pasos(texto: string): PasoDicho[] {
  return texto.split(' ').map((compas) => {
    const [degree, beats] = compas.split(':');
    return { degree: degree as DegreeSymbol, beats: beats === undefined ? 4 : Number(beats) };
  });
}

/** Una canción para preguntarle: al retocar, lo tuyo y lo que queda. */
function hay(tuyos: string, cancion: string, extra: Partial<LoQueHay> = {}): LoQueHay {
  return {
    mode: 'major',
    kind: 'retocar',
    pulsosPorCompas: 4,
    tuyos: pasos(tuyos),
    cancion: pasos(cancion),
    ...extra,
  };
}

/** Lo mismo al continuar: lo tuyo delante y lo nuevo detrás. */
function sigue(tuyos: string, nuevo: string, extra: Partial<LoQueHay> = {}): LoQueHay {
  return hay(tuyos, `${tuyos} ${nuevo}`, { kind: 'continuar', ...extra });
}

const menor = { mode: 'minor' } as const;

describe('los grados que se leen', () => {
  it('con su especie pegada y sin la puntuación de detrás', () => {
    expect(gradoDicho('V/ii7')).toBe('V/ii');
    expect(gradoDicho('iv(dominant7)')).toBe('iv');
    expect(gradoDicho('I5,')).toBe('I');
    expect(gradoDicho('tónica')).toBeNull();
  });

  it('los nombres de músico de las secundarias, solo donde no son otro grado', () => {
    expect(gradoDicho('II7', 'major')).toBe('V/V');
    expect(gradoDicho('VI7', 'major')).toBe('V/ii');
    expect(gradoDicho('III', 'major')).toBe('V/vi');
    expect(gradoDicho('VII', 'major')).toBe('V/iii');
    expect(gradoDicho('VI7', 'minor')).toBe('VI');
    expect(gradoDicho('II7', 'minor')).toBe('V/V');
    expect(gradoDicho('II7')).toBe('II');
  });
});

describe('los enlaces', () => {
  it('reconoce los cuatro sitios: el bucle, tu principio, un compás y suelto', () => {
    expect(enlaceNombrado('Tu bucle vuelve a empezar por V I: la dominante.')?.donde).toBe('bucle');
    expect(enlaceNombrado('Vuelve a tu principio por IV I: cadencia plagal.')?.donde).toBe(
      'principio',
    );
    expect(enlaceNombrado('V I en el 8: cadencia perfecta.')?.donde).toEqual({ compas: 8 });
    expect(enlaceNombrado('V I: la dominante resuelve en la tónica.')?.donde).toBe('suelto');
    expect(enlaceNombrado('Vuelve a tu principio por la vuelta: nada.')).toBeNull();
    expect(enlaceNombrado('Lo que llevas en el 8: nada.')).toBeNull();
    expect(enlaceNombrado('Acaba bien: nada.')).toBeNull();
  });

  it('el enlace tiene que sonar donde dice', () => {
    const bucle = hay('I IV V V', 'I IV ii V');
    expect(
      loQueNoEsVerdad(
        'Tu bucle vuelve a empezar por V I: la dominante resuelve en la tónica.',
        bucle,
      ),
    ).toBeNull();
    expect(
      loQueNoEsVerdad('Tu bucle vuelve a empezar por IV I: cadencia plagal.', bucle),
    ).toContain('donde no suena');
    const contraste = sigue('I V vi IV', 'vi IV ii V');
    expect(
      loQueNoEsVerdad(
        'Vuelve a tu principio por V I: la dominante resuelve en la tónica.',
        contraste,
      ),
    ).toBeNull();
    expect(
      loQueNoEsVerdad(
        'Vuelve a tu principio por V vi: cadencia rota, promete la tónica y da su relativa.',
        contraste,
      ),
    ).toContain('donde no suena');
    const enDos = hay('I IV V I', 'I ii:2 V:2 V I');
    expect(
      loQueNoEsVerdad('ii V en el 2: la dominante partida en su ii y ella.', enDos),
    ).toBeNull();
    expect(loQueNoEsVerdad('ii V en el 2.5: llega a lo que preparaba.', enDos)).toBeNull();
    expect(loQueNoEsVerdad('ii V en el 4: llega a lo que preparaba.', enDos)).toContain(
      'donde no suena',
    );
    expect(loQueNoEsVerdad('IV V: el bajo sube un tono.', enDos)).toContain('donde no suena');
    // Detrás del último va la vuelta, y un acorde que se queda es su propio enlace.
    expect(loQueNoEsVerdad('I I en el 4: nada.', hay('I IV V I', 'I IV V I'))).toBeNull();
    expect(loQueNoEsVerdad('V I en el 4: vuelve.', hay('I IV I V', 'I IV I V'))).toBeNull();
  });

  it('lo que dice del enlace: adónde llega y quién es la dominante', () => {
    const c = hay('I vi IV V', 'I vi ii V');
    expect(loQueNoEsVerdad('vi ii: cadencia perfecta.', c)).toContain('llega a la tónica');
    expect(loQueNoEsVerdad('vi ii: cadencia rota.', c)).toContain('relativa');
    expect(loQueNoEsVerdad('I vi: la subdominante prepara la dominante.', c)).toContain(
      'es la dominante',
    );
    expect(loQueNoEsVerdad('ii V: la subdominante prepara la dominante.', c)).toBeNull();
    expect(loQueNoEsVerdad('vi ii: la dominante va a ii.', c)).toContain('es la dominante');
    // El bII7 es el sustituto tritonal, y el bII sin ella no.
    const tritonal = hay('ii V I I', 'ii V I I', {
      cancion: [...pasos('ii'), { degree: 'bII', beats: 4, especie: 'dominant7' }, ...pasos('I I')],
    });
    expect(loQueNoEsVerdad('ii bII: la subdominante prepara la dominante.', tritonal)).toBeNull();
    expect(
      loQueNoEsVerdad(
        'ii bII: la subdominante prepara la dominante.',
        hay('ii V I I', 'ii bII I I'),
      ),
    ).toContain('es la dominante');
  });

  it('el bajo: que no vaya a ningún sitio, y el salto que dice', () => {
    const c = hay('I IV vi V', 'I IV V/vi vi');
    expect(loQueNoEsVerdad('IV V/vi: el bajo baja medio tono sin ir a ningún sitio.', c)).toContain(
      'es una llegada',
    );
    expect(
      loQueNoEsVerdad('IV V/vi: el bajo baja medio tono hasta una dominante secundaria.', c),
    ).toBeNull();
    expect(loQueNoEsVerdad('I IV: el bajo sube una quinta.', c)).toContain(
      'el bajo sube una quinta',
    );
    expect(loQueNoEsVerdad('I IV: el bajo baja una quinta, el enlace más fuerte.', c)).toBeNull();
    expect(loQueNoEsVerdad('V/vi vi: el bajo sube una tercera.', c)).toContain('una tercera');
    expect(loQueNoEsVerdad('V/vi vi: el bajo baja un tono.', c)).toContain('un tono');
  });
});

describe('los compases', () => {
  it('lo que dice que suena en el compás N suena en el compás N, contado por pulsos', () => {
    const blues = hay('i i i i iv iv i i VI V i V', 'i i i i iv iv i i VI V i V', menor);
    expect(
      loQueNoEsVerdad(
        'La forma de doce sigue entera: la tónica en el 1, el cuarto en el 5 y la dominante en el 9.',
        blues,
      ),
    ).toContain('en el 9 suena V o v');
    expect(
      loQueNoEsVerdad(
        'La forma de doce sigue entera: la tónica en el 1, el cuarto en el 5 y el VI7 en el 9.',
        blues,
      ),
    ).toBeNull();
    // A dos pulsos, el noveno acorde está en el compás 5.
    const rapido = hay('I:2 IV:2 V:2 I:2', 'I:2 IV:2 V:2 I:2');
    expect(loQueNoEsVerdad('Acaba en I en el compás 2.', rapido)).toBeNull();
    expect(loQueNoEsVerdad('Acaba en I en el compás 4.', rapido)).toContain('suena nada');
    // La tónica que cae en el compás de después es la vuelta.
    expect(
      loQueNoEsVerdad(
        'La vuelta del 12 resuelve en I en el 13.',
        hay('I IV V V', 'I IV V V I IV V V I IV V V'),
      ),
    ).toBeNull();
    expect(loQueNoEsVerdad('Un cierre en el 4.', hay('I IV V I', 'I IV V I'))).toBeNull();
  });

  it('dos grados seguidos: cada uno en el suyo, o el enlace en ese compás', () => {
    const jazz = hay('I I I I', 'I I ii V');
    expect(loQueNoEsVerdad('Con ii V en el 3 y el 4, el giro del blues de jazz.', jazz)).toBeNull();
    expect(loQueNoEsVerdad('Con ii V en el 2 y el 4, el giro.', jazz)).toContain(
      'ii V en el 2 y el 4',
    );
    expect(loQueNoEsVerdad('Con el giro ii V en el 3.', jazz)).toBeNull();
    expect(loQueNoEsVerdad('Con el giro ii V en el 1.', jazz)).toContain('donde no suena');
    expect(loQueNoEsVerdad('Lo que llevas en el 1.', jazz)).toBeNull();
  });

  it('«X por Y en el N»: lo tuyo era X y ahora suena Y', () => {
    const c = hay('I IV V I', 'I ii V I');
    expect(loQueNoEsVerdad('IV por ii en el 2: comparten dos notas.', c)).toBeNull();
    expect(loQueNoEsVerdad('V por ii en el 2: comparten dos notas.', c)).toContain('tocabas V');
    expect(loQueNoEsVerdad('IV por vi en el 2: comparten dos notas.', c)).toContain('suena vi');
    expect(loQueNoEsVerdad('Lo que va por otro en el 2.', c)).toBeNull();
  });

  it('lo tuyo en su compás: lo que se cambia, lo que se quita, lo dudoso y lo que dura', () => {
    const c = hay('I IV V I', 'I IV V vi', { dudosos: [false, true, false, false] });
    expect(
      loQueNoEsVerdad('Cambia el I del compás 1, que es donde la canción dice su tonalidad.', c),
    ).toBeNull();
    expect(loQueNoEsVerdad('Quita la llegada a I del compás 4, que ya cerraba.', c)).toBeNull();
    expect(loQueNoEsVerdad('Quita la llegada a I del compás 3, que ya cerraba.', c)).toContain(
      'tocabas I',
    );
    expect(loQueNoEsVerdad('Cambia el dicho del compás 3.', c)).toBeNull();
    expect(loQueNoEsVerdad('El 2 se oyó con duda: lo que sea.', c)).toBeNull();
    expect(loQueNoEsVerdad('El 3 se oyó con duda: lo que sea.', c)).toContain('se oyó con duda');
    expect(loQueNoEsVerdad('Quita V I, la dominante que no resuelve.', c)).toBeNull();
    expect(loQueNoEsVerdad('Quita IV I, la plagal.', c)).toContain('no lo tenías');
    const dura = hay('I IV V I', 'I IV:2 V:2 V I');
    expect(loQueNoEsVerdad('El IV del 2 dura 2 pulsos donde tú tenías 4.', dura)).toBeNull();
    expect(loQueNoEsVerdad('El V del 2 pasa a durar 2 pulsos.', dura)).toBeNull();
    expect(loQueNoEsVerdad('El I del 1 dura un pulso.', dura)).toContain('dura un pulsos');
    expect(loQueNoEsVerdad('El IV del 3 dura 2 pulsos.', dura)).toContain('del 3');
  });
});

describe('la forma', () => {
  it('un periodo lo es por `formasDe`, y en una sola parte', () => {
    const periodo = sigue('I IV V V', 'I IV V I', { partesNuevas: ['Consecuente'] });
    expect(
      loQueNoEsVerdad('Un periodo: semicadencia en V en el compás 4 y cierre en el 8.', periodo),
    ).toBeNull();
    expect(
      loQueNoEsVerdad(
        'La forma: el consecuente cierra en casa con tu misma cabeza: un periodo entero.',
        periodo,
      ),
    ).toBeNull();
    const vuelta = sigue('vi iii IV V', 'I IV V I', { papel: 'puente', partesNuevas: ['Vuelta'] });
    expect(
      loQueNoEsVerdad('Un periodo: semicadencia en V en el compás 4 y cierre en el 8.', vuelta),
    ).toContain('otra parte');
    const estribillo = sigue('I IV V V', 'I IV V I', {
      papel: 'estrofa',
      partesNuevas: ['Estribillo'],
    });
    expect(loQueNoEsVerdad('Un periodo: semicadencia.', estribillo)).toContain('Estribillo');
    const mismo = sigue('I IV V V', 'I IV V I', {
      papel: 'estrofa',
      partesNuevas: ['Estrofa', 'Cierre', 'Otra vuelta', 'Coro'],
    });
    expect(loQueNoEsVerdad('Un periodo: semicadencia.', mismo)).toBeNull();
    expect(loQueNoEsVerdad('Un periodo: semicadencia.', hay('I IV V I', 'I IV V I'))).toContain(
      'no lo es',
    );
    expect(loQueNoEsVerdad('Un periodo: semicadencia.', hay('I IV:3 V I', 'I IV:3 V I'))).toContain(
      'no lo es',
    );
  });

  it('los compases que dice que dura', () => {
    expect(
      loQueNoEsVerdad(
        '8 compases: la frase se cuenta de cuatro en cuatro.',
        sigue('I IV V V', 'I IV V I'),
      ),
    ).toBeNull();
    expect(
      loQueNoEsVerdad('6 compases: la frase no cuadra.', sigue('I IV V V', 'I IV V I')),
    ).toContain('son 8');
    expect(loQueNoEsVerdad('Mantiene tus 4 compases.', hay('I IV V I', 'I ii V I'))).toBeNull();
    expect(loQueNoEsVerdad('Mantiene tus 3 compases.', hay('I IV V I', 'I ii V I'))).toContain(
      'tenías 3',
    );
  });
});

describe('las partes', () => {
  it('la tuya tiene que ser tu papel, y lo que se dice de ella, verdad', () => {
    const estribillo = hay('I vi IV V', 'I vi ii V', { papel: 'estribillo' });
    expect(
      loQueNoEsVerdad('El estribillo empieza en I y acaba en V, sin cerrar.', estribillo),
    ).toBeNull();
    expect(loQueNoEsVerdad('El estribillo empieza en vi y acaba en V.', estribillo)).toContain(
      'empieza en vi',
    );
    expect(loQueNoEsVerdad('El estribillo empieza en I y acaba en IV.', estribillo)).toContain(
      'acaba en IV',
    );
    expect(loQueNoEsVerdad('El estribillo cierra en la tónica.', estribillo)).toContain(
      'la tónica',
    );
    expect(loQueNoEsVerdad('El puente no pasa por la tónica.', estribillo)).toContain('tu puente');
    expect(
      loQueNoEsVerdad('El puente no pasa por la tónica.', hay('I vi IV V', 'I vi IV V')),
    ).toContain('sin papel');
    expect(loQueNoEsVerdad('El camino acaba en IV.', estribillo)).toBeNull();
    const puente = hay('vi IV I V', 'vi IV I V', { papel: 'puente' });
    expect(loQueNoEsVerdad('El puente no pasa por la tónica y acaba en V.', puente)).toContain(
      'pasa',
    );
    expect(loQueNoEsVerdad('El puente acaba en una cosa.', puente)).toBeNull();
  });

  it('lo que se añade a la tuya y lo que sigue, en la parte nueva', () => {
    const c = sigue('I V vi IV', 'I IV V I', { papel: 'estrofa' });
    expect(
      loQueNoEsVerdad('Lo que sigue, el estribillo, entra en I, que es llegar.', c),
    ).toBeNull();
    expect(
      loQueNoEsVerdad('Lo que sigue, el estribillo, entra en IV, que es llegar.', c),
    ).toContain('empieza en IV');
    expect(loQueNoEsVerdad('Lo que se añade a la estrofa cierra en la tónica.', c)).toBeNull();
    expect(loQueNoEsVerdad('Lo que se añade al pre cierra en la tónica.', c)).toContain('tu pre');
  });

  it('la parte nueva, sin nombrar su papel', () => {
    const c = sigue('vi IV I V', 'IV I V vi', { kind: 'continuar' });
    expect(
      loQueNoEsVerdad(
        'La parte nueva acaba en vi, el acorde con el que empiezas: la vuelta no se oye.',
        c,
      ),
    ).toBeNull();
    expect(
      loQueNoEsVerdad('La parte nueva acaba en V, el acorde con el que empiezas.', c),
    ).toContain('parte nueva acaba en V');
    expect(loQueNoEsVerdad('La parte nueva pasa una vez por la I: contrasta menos.', c)).toBeNull();
    expect(loQueNoEsVerdad('La parte nueva ya llega a la ii una vez.', c)).toContain('pasa por ii');
    expect(loQueNoEsVerdad('Acaba en vi, ni en la tónica ni en la dominante.', c)).toBeNull();
    expect(loQueNoEsVerdad('Acaba en V, ni en la tónica ni en la dominante.', c)).toContain(
      'acaba en V',
    );
  });
});

describe('la canción entera', () => {
  it('el estilo del que se habla es el tuyo, y el blues como forma no es un estilo', () => {
    const c = hay('I IV V I', 'I IV V I', { estilo: 'rock' });
    expect(loQueNoEsVerdad('Es la cadencia del rock.', c)).toBeNull();
    expect(loQueNoEsVerdad('Es la cadencia del pop.', c)).toContain('del pop');
    expect(loQueNoEsVerdad('la forma de doce del blues, entera.', c)).toBeNull();
    expect(loQueNoEsVerdad('el bVII en blues es idioma.', c)).toContain('del blues');
    expect(loQueNoEsVerdad('Es del jazz, no del rock.', c)).toBeNull();
    expect(loQueNoEsVerdad('una canción sin estilo elegido.', hay('I', 'I'))).toBeNull();
    expect(loQueNoEsVerdad('es de casa en jazz.', hay('I', 'I'))).toContain('ninguno');
  });

  it('«cambia el orden» es que el orden cambia', () => {
    expect(
      loQueNoEsVerdad(
        'Añade un puente que cambia el orden de tus acordes.',
        sigue('I vi IV V', 'vi I V IV'),
      ),
    ).toBeNull();
    expect(
      loQueNoEsVerdad('Añade un puente que cambia el orden.', sigue('I vi IV V', 'I vi IV V')),
    ).toContain('el mismo');
  });

  it('entrar en uno de los dos de tu vaivén no es llegar', () => {
    const pre = sigue('VI VII VI VII', 'VI III VII i', { ...menor, papel: 'pre' });
    expect(
      loQueNoEsVerdad('Lo que sigue, el estribillo, entra en VI, que es llegar.', pre),
    ).toContain('vaivén');
    const aCasa = sigue('VI VII VI VII', 'i VI III VII', { ...menor, papel: 'pre' });
    expect(
      loQueNoEsVerdad('Lo que sigue, el estribillo, entra en i, que es llegar.', aCasa),
    ).toBeNull();
    const sinVaiven = sigue('ii IV V V', 'IV I V I', { papel: 'pre' });
    expect(
      loQueNoEsVerdad('Lo que sigue, el estribillo, entra en IV, que es llegar.', sinVaiven),
    ).toBeNull();
  });

  it('cada grado nombrado suena, o sonaba, o se nombra porque no está', () => {
    const c = hay('I IV V I', 'I ii V I');
    expect(loQueNoEsVerdad('Cambia IV por ii.', c)).toBeNull();
    expect(loQueNoEsVerdad('Mete el bVI.', c)).toContain('nombra bVI');
    expect(loQueNoEsVerdad('El sustituto tritonal del bII.', c)).toBeNull();
    expect(loQueNoEsVerdad('Se queda en el vamp sin forzar la vi.', c)).toBeNull();
    // El II7 es el V/V: nombrarlo así es verdad donde suena.
    expect(
      loQueNoEsVerdad('El II7 del country.', hay('I IV V I', 'I V/V V I', { estilo: 'country' })),
    ).toBeNull();
  });
});

describe('qué frases hablan de un sitio', () => {
  it('un enlace, un cambio, lo que se quita, un compás', () => {
    expect(hablaDeUnSitio('V I: la dominante resuelve en la tónica.')).toBe(true);
    expect(hablaDeUnSitio('E por A en el 2: el cambio rápido.')).toBe(false);
    expect(hablaDeUnSitio('IV por ii en el 2: comparten dos notas.')).toBe(true);
    expect(hablaDeUnSitio('Quita V IV, la dominante que no resuelve.')).toBe(true);
    expect(hablaDeUnSitio('Quita mucho, lo que sea.')).toBe(false);
    expect(hablaDeUnSitio('i en el 1: todo es tónica.')).toBe(true);
    expect(hablaDeUnSitio('El 3 se oyó con duda.')).toBe(true);
    expect(hablaDeUnSitio('Cierra en la tónica desde el V.')).toBe(false);
  });
});

// --- El barrido ----------------------------------------------------------------------

/** Un generador de números determinista: el barrido sale igual cada vez. */
function semilla(inicial: number): () => number {
  let estado = inicial;
  return () => {
    estado = (estado * 1103515245 + 12345) % 2147483648;
    return estado / 2147483648;
  };
}

interface Cancion {
  readonly mode: KeyMode;
  readonly kind: PathKind;
  readonly pasos: readonly PathStep[];
  readonly contexto: ContextoDeSalidas;
}

const DE_MAYOR: readonly DegreeSymbol[] = [
  'I',
  'ii',
  'iii',
  'IV',
  'V',
  'vi',
  'bVII',
  'iv',
  'bVI',
  'V/V',
  'V/vi',
];
const DE_MENOR: readonly DegreeSymbol[] = [
  'i',
  'iv',
  'V',
  'VI',
  'VII',
  'III',
  'v',
  'ii°',
  'bII',
  'V/iv',
];

/**
 * Canciones al azar **con contexto**: estilo, papel, especies, compás de tres, lo
 * dudoso y un punteo. Empiezan casi siempre en casa, como empieza casi todo.
 */
function alAzar(cuantas: number): Cancion[] {
  const azar = semilla(5);
  const una = <T>(lista: readonly T[]): T => lista[Math.floor(azar() * lista.length)]!;
  return Array.from({ length: cuantas }, () => {
    const mode: KeyMode = azar() < 0.5 ? 'major' : 'minor';
    const pc = azar() < 0.15 ? 3 : 4;
    const beats = una([pc, pc, pc, 2 * pc, pc === 4 ? 2 : 3]);
    const largo = una([1, 2, 4, 4, 4, 6, 8, 8, 12]);
    const tonica: DegreeSymbol = mode === 'major' ? 'I' : 'i';
    const pasos = Array.from({ length: largo }, (_, k) => ({
      degree: k === 0 && azar() < 0.6 ? tonica : una(mode === 'major' ? DE_MAYOR : DE_MENOR),
      beats,
    }));
    const tipo = azar();
    const especie = tipo < 0.2 ? 'dominant7' : tipo < 0.3 ? 'quinta' : null;
    const contexto: ContextoDeSalidas = {
      ...(azar() < 0.8 ? { estilo: una(STYLE_IDS) } : {}),
      ...(pc === 3 ? { pulsosPorCompas: 3 } : {}),
      ...(azar() < 0.7 ? { papel: una(ROLES).id } : {}),
      ...(especie === null ? {} : { especies: pasos.map(() => especie) }),
      ...(azar() < 0.15 ? { dudosos: pasos.map(() => azar() < 0.3) } : {}),
      ...(azar() < 0.2
        ? { melodia: pasos.map(() => [{ nota: Math.floor(azar() * 12), fuerte: true }]) }
        : {}),
    };
    return { mode, kind: azar() < 0.5 ? 'continuar' : 'retocar', pasos, contexto };
  });
}

/** Los cinco corpus, cada caso con las dos peticiones si las tiene, y el azar. */
function lasCanciones(): Cancion[] {
  const conEstilo = (contexto: ContextoDeSalidas, estilo: string | undefined) =>
    estilo === undefined
      ? contexto
      : { ...contexto, estilo: estilo as ContextoDeSalidas['estilo'] };
  return [
    ...[...CORPUS, ...CORPUS_DE_VERIFICACION].flatMap((caso) =>
      (['continuar', 'retocar'] as const).map((kind) => ({
        mode: caso.mode,
        kind,
        pasos: caso.compases,
        contexto: caso.contexto,
      })),
    ),
    ...CORPUS_CIEGO.map((caso) => ({
      mode: caso.mode,
      kind: caso.kind,
      pasos: caso.compases,
      contexto: conEstilo(caso.contexto, caso.estilo),
    })),
    ...[...CORPUS_FINAL, ...CORPUS_QUINTO].map((caso) => ({
      mode: caso.mode,
      kind: caso.kind,
      pasos: caso.compases,
      contexto: caso.contexto,
    })),
    ...alAzar(600),
  ];
}

describe('el barrido: ninguna salida dice nada falso de su canción', () => {
  it('ni el nombre, ni lo que hace, ni un solo motivo del juez', () => {
    const falsos: string[] = [];
    let textos = 0;
    let salidas = 0;
    for (const { mode, kind, pasos, contexto } of lasCanciones()) {
      for (const salida of salidasPosibles(mode, kind, pasos, contexto)) {
        salidas += 1;
        const lo = loQueHayEnLaSalida(mode, kind, pasos, contexto, salida);
        const motivos = (salida.encaje?.criterios ?? [])
          .map((criterio) => criterio.motivo)
          .filter((motivo) => motivo !== '');
        for (const texto of [salida.nombre, salida.que, ...motivos]) {
          textos += 1;
          const falso = loQueNoEsVerdad(texto, lo);
          if (falso !== null) {
            falsos.push(
              `${pasos.map((p) => p.degree).join(' ')} → ${salida.nombre}: «${texto}» (${falso})`,
            );
          }
        }
      }
    }
    expect(falsos.slice(0, 20)).toEqual([]);
    // Lo que recorre: miles de salidas y decenas de miles de frases.
    expect(salidas).toBeGreaterThan(6000);
    expect(textos).toBeGreaterThan(50000);
  }, 120_000);
});
