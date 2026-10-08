/**
 * El examen de verificación: **el menú que construye el dominio contra 48 casos
 * que el equipo no había visto**, con la calidad de las tres primeras
 * (`corpus-de-verificacion.ts`).
 *
 * **Este corpus es de verificación, no un trinquete del equipo.** La nota mínima
 * está en lo que dio el día que se escribió, para que no pueda bajar sin que se
 * note, y la subirá el coordinador cuando el generador y el juez terminen los
 * arreglos que la verificación pidió. Mientras tanto la cifra que importa es la
 * del informe, por familias.
 *
 * El mismo criterio se pasa también al corpus viejo (`corpus-de-salidas.ts`), y
 * el informe pone las dos notas una al lado de la otra: así se ve cuánto más duro
 * es pedir que las tres primeras suenen bien, y no solo una.
 */

import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { degreesFor } from '../../progressions';
import { salidasPosibles } from '../menu';
import type { PathId, PathKind, SalidaPosible } from '../tipos';
import {
  cierraEnLaTonica,
  cifras,
  claveDe,
  CORPUS,
  dicho,
  enLinea,
  notaDe,
  PRIMERAS,
  sigueCon,
} from './corpus-de-salidas';
import {
  CORPUS_DE_VERIFICACION,
  exigir,
  FAMILIAS_DE_VERIFICACION,
  informeExigente,
  leerPunteo,
  leerToma,
  VERIFICACION_CON_SU_ESTILO,
  type CasoExigible,
  type NotaExigente,
} from './corpus-de-verificacion';

/**
 * La nota por debajo de la cual el examen falla, de 0 a 1: expectativas cumplidas
 * entre todas, como la del corpus viejo.
 *
 * Medida el 4 de octubre de 2026 a las 21:20, con el juez y el generador todavía
 * ajustados al corpus del equipo: 967 de 1020 (0,948) y 65 de 96 casos enteros.
 * Después de arreglar por sus causas lo que esta verificación encontró —el papel
 * de lo que se añade, el modal sin sensible, el punteo, las especies, los
 * acordes de un pulso—: 998 de 1020 (0,978) y 79 de 96. **El 5 de octubre a las
 * 00:40, con lo que enseñó el corpus ciego y tres expectativas corregidas con su
 * argumento: 1017 de 1020 (0,997) y 93 de 96.** El umbral queda justo por debajo y
 * se sube a mano cada vez que algo mejora. **El 5 de octubre de 2026 a las 11:42**, con
 * los movimientos y las formas nuevas (la predominante, el cambio rápido, el semitono
 * frigio, la dominante partida, el periodo y la AABA): lo mismo, 1017 de 1020 y 93 de
 * 96. Por el camino se cayeron dos —el vals folk, porque la predominante volvía atrás
 * después del ii, y el punteo en mayor, por el semitono frigio prestado— y se
 * arreglaron por esas causas.
 *
 * **La cifra engorda con lo que nunca falla**: cada caso lleva cinco `noDebe` de
 * `NUNCA` que casi siempre se cumplen. Lo que de verdad sujeta es la lista de
 * abajo, caso por caso.
 */
const NOTA_MINIMA = 0.99;

/**
 * Los casos enteros que **no pueden volver a fallar**: los 93 de la medida de
 * arriba. Como en el corpus del equipo, una nota global deja que diez mejoras
 * tapen una rotura; esto no. Los tres que faltan piden una sustitución que el
 * catálogo de movimientos no tiene —el v por el III de un folk eólico, el bVII por
 * el IV de uno de doble tónica— o la tienen construida y detrás de otras que
 * encajan mejor (el V/V del blues de ocho).
 */
const YA_NO_PUEDEN_FALLAR: readonly string[] = [
  'pop-iv-prestado-estribillo:continuar',
  'pop-iv-prestado-estribillo:retocar',
  'soul-IV-iv-estrofa:continuar',
  'soul-IV-iv-estrofa:retocar',
  'balada-sus4:continuar',
  'balada-sus4:retocar',
  'pop-cadencia-rota:continuar',
  'pop-cadencia-rota:retocar',
  'pop-desde-vi:continuar',
  'pop-desde-vi:retocar',
  'pre-estribillo:continuar',
  'pre-estribillo:retocar',
  'puente-ocho:continuar',
  'puente-ocho:retocar',
  'final-coda:continuar',
  'final-coda:retocar',
  'pop-mario:continuar',
  'pop-mario:retocar',
  'cine-heroico:continuar',
  'cine-heroico:retocar',
  'gospel-secundarias:continuar',
  'gospel-secundarias:retocar',
  'jazz-rhythm-A:continuar',
  'jazz-rhythm-A:retocar',
  'bossa-II7:continuar',
  'bossa-II7:retocar',
  'jazz-iii-VI-ii-V:continuar',
  'jazz-iii-VI-ii-V:retocar',
  'jazz-backdoor:continuar',
  'jazz-backdoor:retocar',
  'jazz-menor-turnaround:continuar',
  'jazz-menor-turnaround:retocar',
  'bolero-menor:continuar',
  'bolero-menor:retocar',
  'punk-tres-acordes:continuar',
  'punk-tres-acordes:retocar',
  'rock-bIII-bVII:continuar',
  'rock-bIII-bVII:retocar',
  'rock-mixolidio-estribillo:continuar',
  'rock-mixolidio-estribillo:retocar',
  'rock-menor-eolio:continuar',
  'rock-menor-eolio:retocar',
  'metal-frigio-vamp:continuar',
  'metal-frigio-vamp:retocar',
  'metal-neoclasico:continuar',
  'metal-neoclasico:retocar',
  'metal-escalera-rapida:continuar',
  'metal-escalera-rapida:retocar',
  'blues-ocho:continuar',
  'menor-ciclo-quintas:continuar',
  'menor-ciclo-quintas:retocar',
  'menor-V-armonico:continuar',
  'menor-V-armonico:retocar',
  'andaluza:continuar',
  'andaluza:retocar',
  'folk-eolio:continuar',
  'folk-doble-tonica:continuar',
  'vals-folk:continuar',
  'vals-folk:retocar',
  'vals-menor:continuar',
  'vals-menor:retocar',
  'tres-mas-tres:continuar',
  'tres-mas-tres:retocar',
  'sus4-resuelve:continuar',
  'sus4-resuelve:retocar',
  'melodia-mayor:continuar',
  'melodia-mayor:retocar',
  'melodia-menor:continuar',
  'melodia-menor:retocar',
  'melodia-sensible:continuar',
  'melodia-sensible:retocar',
  'duda-un-compas:continuar',
  'duda-un-compas:retocar',
  'duda-todo:continuar',
  'duda-todo:retocar',
  'septimas-pop:continuar',
  'septimas-pop:retocar',
  'intro-vamp:continuar',
  'intro-vamp:retocar',
  'raro-un-acorde:continuar',
  'raro-un-acorde:retocar',
  'raro-un-acorde-largo-menor:continuar',
  'raro-un-acorde-largo-menor:retocar',
  'raro-dos-acordes:continuar',
  'raro-dos-acordes:retocar',
  'raro-pulso-uno:continuar',
  'raro-pulso-uno:retocar',
  'raro-siete:continuar',
  'raro-siete:retocar',
  'raro-dieciseis:continuar',
  'raro-dieciseis:retocar',
  'raro-treinta-y-dos:continuar',
  'raro-treinta-y-dos:retocar',
];

/** Dónde queda el informe: fuera del repositorio por defecto, como el del corpus viejo. */
const INFORME =
  process.env['INFORME_DE_VERIFICACION'] ?? join(tmpdir(), 'examen-de-verificacion.txt');

const PETICIONES = ['continuar', 'retocar'] as const satisfies readonly PathKind[];

// --- La notación ------------------------------------------------------------------

describe('la notación del verificador', () => {
  it('lee grados, pulsos, especies y dudas', () => {
    expect(leerToma('I V/vi:2@dominant7 vi?')).toEqual({
      compases: [
        { degree: 'I', beats: 4 },
        { degree: 'V/vi', beats: 2 },
        { degree: 'vi', beats: 4 },
      ],
      especies: [null, 'dominant7', null],
      dudosos: [false, false, true],
    });
    // Sin especies ni dudas, no dice nada de ellas; los pulsos por defecto, los pedidos.
    expect(leerToma(' I  IV ', 3)).toEqual({
      compases: [
        { degree: 'I', beats: 3 },
        { degree: 'IV', beats: 3 },
      ],
    });
  });

  it('revienta con lo que no entiende, en vez de saltárselo', () => {
    expect(() => leerToma('I V:dos')).toThrow('No se entiende el compás «V:dos».');
    expect(() => leerToma('I V@septima')).toThrow('«septima» no es una especie');
  });

  it('lee el punteo de cada compás, con sus notas fuertes', () => {
    expect(leerPunteo(['0F 4', '', '11F'])).toEqual([
      [
        { nota: 0, fuerte: true },
        { nota: 4, fuerte: false },
      ],
      [],
      [{ nota: 11, fuerte: true }],
    ]);
    expect(() => leerPunteo(['12F'])).toThrow('No se entiende la nota «12F».');
    expect(() => leerPunteo(['Do'])).toThrow('No se entiende la nota «Do».');
  });
});

// --- El corpus, que es un dato y se comprueba como tal ------------------------

describe('el corpus de verificación', () => {
  it('tiene los 48 casos del verificador, sin repetir', () => {
    expect(CORPUS_DE_VERIFICACION).toHaveLength(48);
    expect(new Set(CORPUS_DE_VERIFICACION.map((caso) => caso.id)).size).toBe(48);
  });

  it('reparte los casos entre las seis familias', () => {
    for (const familia of FAMILIAS_DE_VERIFICACION) {
      expect(
        CORPUS_DE_VERIFICACION.some((caso) => caso.familia === familia),
        familia,
      ).toBe(true);
    }
  });

  it('solo usa grados que existen en su modo, con todo alineado compás a compás', () => {
    for (const caso of CORPUS_DE_VERIFICACION) {
      const validos = degreesFor(caso.mode);
      for (const paso of caso.compases) {
        expect(validos, caso.id).toContain(paso.degree);
        expect(paso.beats, caso.id).toBeGreaterThan(0);
      }
      for (const alineado of [
        caso.contexto.especies,
        caso.contexto.dudosos,
        caso.contexto.melodia,
      ]) {
        if (alineado !== undefined) {
          expect(alineado, caso.id).toHaveLength(caso.compases.length);
        }
      }
    }
  });

  it('dice lo mínimo aceptable de cada petición, y los raros piden un menú con salidas', () => {
    for (const caso of CORPUS_DE_VERIFICACION) {
      for (const kind of PETICIONES) {
        expect(caso[kind].aceptable.length, `${caso.id}:${kind}`).toBeGreaterThan(0);
        if (caso.familia === 'raros') {
          expect(caso[kind].razonables, `${caso.id}:${kind}`).toBeDefined();
        }
        // Pedir menos de tres es una excepción, y se dice por qué.
        const { cuantas = PRIMERAS, porque } = caso[kind].razonables ?? {};
        expect(cuantas >= PRIMERAS || porque !== undefined, `${caso.id}:${kind}`).toBe(true);
      }
    }
  });
});

// --- La nota con la calidad de las primeras ----------------------------------------

function salida(path: PathId, tuyos: string, nuevos = ''): SalidaPosible {
  const parte = (texto: string, yours: boolean) => ({
    name: '',
    yours,
    steps: leerToma(texto).compases.map((paso) => ({ ...paso, move: null })),
  });
  return {
    path,
    secciones: nuevos === '' ? [parte(tuyos, false)] : [parte(tuyos, true), parte(nuevos, false)],
    nombre: '',
    que: '',
    colores: [],
  };
}

/** Un caso de prueba: I V que tiene que seguir a I, y no puede acabar fuera de la tónica. */
const CASO: CasoExigible = {
  id: 'prueba',
  familia: 'pruebas',
  que: 'I V',
  mode: 'major',
  compases: leerToma('I V').compases,
  contexto: {},
  continuar: {
    debe: [sigueCon('I')],
    noDebe: [dicho('deja la canción abierta', sigueCon('IV'))],
    primera: [sigueCon('I')],
    aceptable: [cierraEnLaTonica()],
  },
};

const BUENA = salida('seguir', 'I V', 'I');
const ABIERTA = salida('seguir', 'I V', 'vi IV V');
const MALA = salida('seguir', 'I V', 'IV V');

describe('la nota exigente de un caso', () => {
  it('no examina lo que no se esperaba', () => {
    expect(exigir(CASO, 'retocar', [])).toBeNull();
  });

  it('da un punto por cada una de las tres primeras que suena bien', () => {
    const nota = exigir(CASO, 'continuar', [BUENA, BUENA, BUENA, MALA])!;
    // La cuarta hace lo que no debe: cuenta para el noDebe, no para la calidad.
    expect(nota.incumplidas).toEqual([
      { donde: 'noDebe', dice: 'deja la canción abierta', culpables: [4] },
    ]);
    expect(nota.total).toBe(1 + 1 + 1 + PRIMERAS);
    expect(nota.razonables).toBe(3);
  });

  it('suspende a cada una de las primeras que tiene un reparo, o que falta', () => {
    const nota = exigir(CASO, 'continuar', [BUENA, ABIERTA])!;
    expect(nota.incumplidas).toEqual([
      { donde: 'calidad', dice: 'la 2: falta: acaba en la tónica', culpables: [2] },
      { donde: 'calidad', dice: 'la 3: no hay', culpables: [3] },
    ]);
    expect(nota.cumplidas).toBe(nota.total - 2);

    // Sin menú no hay primera: el `primera` también se suspende.
    expect(exigir(CASO, 'continuar', [])!.incumplidas.map((falta) => falta.donde)).toEqual([
      'debe',
      'primera',
      'calidad',
      'calidad',
      'calidad',
    ]);

    const mala = exigir(CASO, 'continuar', [MALA])!;
    expect(mala.incumplidas.map((falta) => falta.dice)).toEqual([
      'lo primero que sigue es I',
      'deja la canción abierta',
      'lo primero que sigue es I',
      'la 1: deja la canción abierta; falta: acaba en la tónica',
      'la 2: no hay',
      'la 3: no hay',
    ]);
  });

  it('pide las razonables que se piden, y solo mira las primeras que puede haber', () => {
    const conTres: CasoExigible = {
      ...CASO,
      continuar: { ...CASO.continuar, razonables: { cuantas: 3 } },
    };
    const corto = exigir(conTres, 'continuar', [BUENA, ABIERTA])!;
    expect(corto.incumplidas).toContainEqual({
      donde: 'razonables',
      dice: '1 salidas razonables de 3',
      culpables: [],
    });
    expect(corto.total).toBe(3 + PRIMERAS + 1);

    const conUna: CasoExigible = {
      ...CASO,
      continuar: { debe: [], noDebe: [], razonables: { cuantas: 1, porque: 'no cabe más' } },
    };
    const una = exigir(conUna, 'continuar', [ABIERTA])!;
    // Sin `aceptable`, una salida sin noDebe que pasar es razonable.
    expect(una.incumplidas).toEqual([]);
    expect(una.total).toBe(2);
    expect(informeExigente([una])).toContain('(no cabe más)');
  });

  it('lo cuenta en un informe por familias y por petición', () => {
    const nota = exigir(CASO, 'continuar', [BUENA, ABIERTA, MALA, BUENA])!;
    const texto = informeExigente(
      [nota, exigir(CASO, 'continuar', [BUENA, BUENA, BUENA])!],
      ['cabecera'],
    );
    expect(texto).toContain('cabecera');
    expect(texto).toContain('  pruebas: ');
    expect(texto).toContain('  al continuar: ');
    expect(texto).toContain('  al retocar: 0/0 expectativas');
    expect(texto).toContain('MAL  prueba:continuar [pruebas] I V');
    expect(texto).toContain('BIEN prueba:continuar');
    // Con asterisco las tres primeras, sin él las demás.
    expect(texto).toContain('   *1. seguir: I/4');
    expect(texto).toContain('    4. seguir: I/4');
    expect(texto).toContain('   noDebe: deja la canción abierta (la 3)');
    expect(texto).toContain('   calidad: la 2: falta: acaba en la tónica');
  });
});

// --- El examen ---------------------------------------------------------------

/** Cada caso por las dos peticiones, como lo construiría la ruta. */
function examinarTodo(casos: readonly CasoExigible[]): NotaExigente[] {
  return casos.flatMap((caso) =>
    PETICIONES.flatMap((kind) => {
      const nota = exigir(
        caso,
        kind,
        salidasPosibles(caso.mode, kind, caso.compases, caso.contexto),
      );
      return nota === null ? [] : [nota];
    }),
  );
}

/**
 * La nota con el criterio viejo: sin la calidad de las primeras ni las razonables.
 * Es la que daría este corpus examinado como el viejo, para ver qué parte de la
 * dureza es de los casos y qué parte del criterio.
 */
function blanda(notas: readonly NotaExigente[]): string {
  const comoAntes = notas.map(({ espera, incumplidas }) => {
    const faltas = incumplidas.filter((f) => f.donde !== 'calidad' && f.donde !== 'razonables');
    const total = espera.debe.length + espera.noDebe.length + (espera.primera ?? []).length;
    return { cumplidas: total - faltas.length, total, incumplidas: faltas };
  });
  return enLinea(cifras(comoAntes));
}

describe('el examen de verificación', () => {
  const notas = examinarTodo(CORPUS_DE_VERIFICACION);
  const nota = notaDe(notas);
  const viejo = examinarTodo(CORPUS);
  writeFileSync(
    INFORME,
    informeExigente(notas, [
      `Examen de verificación de las salidas: ${CORPUS_DE_VERIFICACION.length} casos, nota mínima ${NOTA_MINIMA}.`,
      `Debe: alguna de las ${PRIMERAS} primeras (con *). No debe: ninguna del menú.`,
      `Calidad: cada una de las ${PRIMERAS} primeras, sin noDebe y con lo aceptable.`,
      `Con el criterio viejo, este corpus daría ${blanda(notas)}.`,
      `El corpus viejo (${CORPUS.length} casos) con este criterio: ${enLinea(cifras(viejo))}.`,
      `El corpus viejo con el suyo: ${blanda(viejo)}.`,
      `Medido: ${new Date().toISOString()}.`,
      '',
    ]),
  );

  it(`no baja de la nota mínima (${NOTA_MINIMA}); el detalle, en el informe`, () => {
    expect(nota, `informe en ${INFORME}`).toBeGreaterThanOrEqual(NOTA_MINIMA);
  });

  it('no vuelve a suspender lo que ya aprobó', () => {
    for (const clave of YA_NO_PUEDEN_FALLAR) {
      const suya = notas.find((n) => claveDe(n) === clave);
      expect(suya, `${clave} no está en el corpus`).toBeDefined();
      expect(suya!.incumplidas, `${clave}; informe en ${INFORME}`).toEqual([]);
    }
  });

  it('examina las dos peticiones de cada caso', () => {
    expect(notas).toHaveLength(CORPUS_DE_VERIFICACION.length * PETICIONES.length);
  });

  it('pasa el corpus viejo por el mismo criterio', () => {
    expect(viejo.length).toBeGreaterThan(CORPUS.length);
  });
});

// --- Con su estilo -----------------------------------------------------------

/**
 * **Los que se escribieron con un giro sin estilo, examinados con el suyo** ahora que
 * `styles.ts` lo tiene: la música de cine y el bolero en menor (`conSuEstilo`). Mismo
 * caso, mismas expectativas, con el criterio de verificación.
 *
 * Medido el 5 de octubre de 2026 a las 11:25, al añadir los seis estilos: **tres de
 * cuatro menús enteros**. El que falta, `bolero-menor/bolero:retocar`, pide entre las
 * tres primeras la ii° o el VI en lugar del iv de `i V/iv iv V7`: con el estilo bolero
 * cambiar ese iv deja la V/iv sin el acorde al que va, que es su giro de casa, y la
 * ii° queda cuarta, a cuatro puntos del reparto que sube por variedad. Sin estilo y
 * como jazz entra tercera. No se ha ajustado nada para que entre. La nota de los
 * cuatro: **41 de 42** (0,976).
 */
const NOTA_MINIMA_CON_SU_ESTILO = 0.97;

const YA_NO_PUEDEN_FALLAR_CON_SU_ESTILO: readonly string[] = [
  'cine-heroico/cine:continuar',
  'cine-heroico/cine:retocar',
  'bolero-menor/bolero:continuar',
];

describe('el examen de verificación con su estilo', () => {
  const notas = examinarTodo(VERIFICACION_CON_SU_ESTILO);

  it('son los casos con un giro que ya es estilo, cada uno con el suyo', () => {
    expect(VERIFICACION_CON_SU_ESTILO.map((caso) => [caso.id, caso.contexto.estilo])).toEqual([
      ['cine-heroico/cine', 'cine'],
      ['bolero-menor/bolero', 'bolero'],
    ]);
  });

  it('no vuelve a suspender lo que ya aprobó, ni baja de la nota', () => {
    expect(notas).toHaveLength(2 * VERIFICACION_CON_SU_ESTILO.length);
    expect(notaDe(notas)).toBeGreaterThanOrEqual(NOTA_MINIMA_CON_SU_ESTILO);
    for (const clave of YA_NO_PUEDEN_FALLAR_CON_SU_ESTILO) {
      const suya = notas.find((n) => claveDe(n) === clave);
      expect(suya, `${clave} no está en el corpus`).toBeDefined();
      expect(suya!.incumplidas, clave).toEqual([]);
    }
  });
});
