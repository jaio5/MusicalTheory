/**
 * El examen de las salidas: **si lo que construye el dominio es lo que propondría
 * un arreglista**, medido con el corpus (`corpus-de-salidas.ts`).
 *
 * Cada caso pasa por `salidasPosibles` con su contexto, como lo pasaría la ruta, y
 * se puntúa expectativa a expectativa: las de `debe` contra las tres primeras del
 * menú —las que el modelo tiende a elegir y las que se ven sin desplazar—, las de
 * `noDebe` contra el menú entero —lo que no tiene que salir no tiene que salir en
 * ningún sitio—.
 *
 * **La aserción es una nota mínima, no el cien por cien.** Con el generador de
 * antes del juez sale lo que sale, y un examen que fallara hasta que todo
 * estuviera bien no se podría tener en verde mientras se arregla. La nota es un
 * trinquete: se sube cuando el generador mejora y ya no puede bajar sin que se
 * note. El detalle de cada fallo va a un fichero, porque Vitest se traga lo que se
 * imprime cuando el test pasa, que es justo cuando interesa leerlo.
 */

import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { EspecieDeBloque } from '../../chords';
import type { KeyMode } from '../../keys';
import { degreesFor, type DegreeSymbol } from '../../progressions';
import type { ContextoDeSalidas } from '../contexto';
import { salidasPosibles } from '../menu';
import type { PasoPosible, PathId, PathKind, SalidaPosible } from '../tipos';
import {
  acabaAMitadDeCompas,
  alarga,
  algoNuevoDura,
  algoNuevoEn,
  cadenciaDeViiTriada,
  cambiaAlgo,
  cambiaAlgunoEntre,
  cambiaElCompas,
  cambiaElCompasQueAbre,
  cambiaLoDudoso,
  cambiaTodos,
  cambiaTuEspecie,
  chocaConElPunteo,
  chocaConElPunteoDondeSuena,
  cierraCon,
  cierraEnLaTonica,
  cierraSobreLoDudoso,
  cifras,
  citaLoDudosoComoSeguro,
  claveDe,
  compasDeUnPulso,
  compasEs,
  compasQueNoEs,
  compasQueNoEsEnLosMotivos,
  conservaElFinal,
  conSuEstilo,
  contrasteQueReposaEnLaTonica,
  CORPUS,
  CORPUS_CON_SU_ESTILO,
  cruzaLaBarra,
  cuadra,
  desigualQueNoLoEs,
  diceAlgoFalso,
  dicho,
  dominanteSinSensible,
  dominanteSinSeptima,
  duraCompases,
  duraMasDe,
  empiezaEn,
  encadenaSecundarias,
  enganaSinDominante,
  enGrados,
  esCamino,
  examinar,
  examinarCaso,
  fraseCoja,
  fueraDeLaRejilla,
  grupoDe,
  informe,
  llevaTusEspecies,
  loNuevoCambiaCada,
  loNuevoComoDominantes,
  loNuevoConSeptima,
  loNuevoEn,
  loNuevoEnMultiplosDe,
  loNuevoVaA,
  meteElGiro,
  meteElGrado,
  meteLaSensible,
  meteUnaSecundaria,
  mismosAcordesA,
  no,
  notaDe,
  o,
  parteQueSeContradice,
  pasaPor,
  pierdeElPrestado,
  pierdeLaSecundaria,
  plagalQueNoLoEs,
  pluralDeUno,
  poneComo,
  PRIMERAS,
  quintaConTercera,
  relleno,
  repiteAlVecino,
  repiteLoTuyo,
  respetaFrasesDe,
  resuelveSinResolver,
  secundariaQueNoResuelve,
  sigueCon,
  soloCambiaEntre,
  tieneElGrado,
  y,
  type CasoDelCorpus,
  type NotaDeUnCaso,
} from './corpus-de-salidas';

/**
 * La nota por debajo de la cual el examen falla, de 0 a 1: expectativas cumplidas
 * entre todas.
 *
 * **Es un trinquete**: la línea base del generador anterior al juez era 0,68 (351
 * de 514 con el menú volcado el 4 de octubre); con el juez, 492 de 514; y al
 * cerrar los huecos —la forma del blues por sus compases, el préstamo por estilo,
 * el bucle que se juzga por su vuelta, la cadencia floja que repite la tuya—, 506
 * de 513 (98,6 %), con cinco expectativas corregidas por injustas y explicadas en
 * el corpus. El 5 de octubre de 2026 a las 00:40, con lo que enseñó el corpus ciego
 * —la dominante sin sensible, la bajada que es la forma, el vamp modal que no
 * recibe la sensible de su centro— y dos expectativas más corregidas con su
 * argumento: **513 de 514 y 71 de 72 casos enteros**. Se sube a mano cada vez que el
 * generador mejora: un trinquete que nadie sube no sujeta nada. El 5 de octubre de
 * 2026 a las 11:42, con los movimientos y las formas nuevas, lo mismo: 513 de 514.
 */
const NOTA_MINIMA = 0.99;

/**
 * Los casos que ya salen bien y **no pueden volver a fallar**, como `id:continuar`
 * o `id:retocar`: los 71 de la medida de arriba. El que falta, `medio-tiempo:retocar`,
 * pide «a doble tiempo» y el doble tiempo se construye, pero las tres primeras son
 * tres rearmonizaciones que encajan mejor: no es una salida que no encaje.
 *
 * La nota global deja que un arreglo compense una rotura: diez casos mejor y uno
 * peor suben la cifra. Lo que entra aquí no se negocia.
 */
const YA_NO_PUEDEN_FALLAR: readonly string[] = [
  'pop-eje:continuar',
  'pop-eje:retocar',
  'pop-sensible:continuar',
  'pop-sensible:retocar',
  'doo-wop:continuar',
  'doo-wop:retocar',
  'sec-dom:continuar',
  'sec-dom:retocar',
  'acaba-en-IV:continuar',
  'royal-road:continuar',
  'royal-road:retocar',
  'canon:continuar',
  'canon:retocar',
  'periodo-abierto:continuar',
  'periodo-abierto:retocar',
  'rock-mixo:continuar',
  'rock-mixo:retocar',
  'rock-louie:continuar',
  'rock-louie:retocar',
  'tres-acordes:continuar',
  'tres-acordes:retocar',
  'descenso-menor:continuar',
  'descenso-menor:retocar',
  'mario:continuar',
  'mario:retocar',
  'menor-vamp:continuar',
  'menor-vamp:retocar',
  'epico-menor:continuar',
  'eolico-pop:continuar',
  'eolico-pop:retocar',
  'jazz-251:continuar',
  'jazz-251:retocar',
  'jazz-turnaround:continuar',
  'jazz-turnaround:retocar',
  'rhythm-A:continuar',
  'rhythm-A:retocar',
  'menor-251:continuar',
  'menor-251:retocar',
  'bolero-menor:continuar',
  'bolero-menor:retocar',
  'bolero-mayor:continuar',
  'bolero-mayor:retocar',
  'andaluza:continuar',
  'andaluza:retocar',
  'plagal-menor:continuar',
  'plagal-menor:retocar',
  'folk-semicadencia:continuar',
  'folk-semicadencia:retocar',
  'folk-periodo:continuar',
  'folk-periodo:retocar',
  'dos-acordes:continuar',
  'dos-acordes:retocar',
  'soul-plagal:continuar',
  'blues-12:continuar',
  'blues-12:retocar',
  'blues-rapido:continuar',
  'blues-rapido:retocar',
  'dorico-como-mayor:continuar',
  'dorico-como-mayor:retocar',
  'mixo-vamp:continuar',
  'mixo-vamp:retocar',
  'un-acorde:continuar',
  'un-acorde:retocar',
  'dos-compases:continuar',
  'dos-compases:retocar',
  'dos-compases-menor:continuar',
  'dos-compases-menor:retocar',
  'desigual:continuar',
  'desigual:retocar',
  'medio-tiempo:continuar',
  'rapido:continuar',
];

/**
 * Dónde queda el informe. Fuera del repositorio por defecto: es una medida de
 * este momento, y se compara con otra pasando la ruta por la variable.
 */
const INFORME =
  process.env['INFORME_DE_LAS_SALIDAS'] ?? join(tmpdir(), 'examen-de-las-salidas.txt');

// --- Para probar los predicados a mano -----------------------------------------

/**
 * Unos compases escritos como se leen: `'V:4 I:4:major7'` es un V de cuatro pulsos
 * y un Imaj7 de cuatro. Con tuplas, el formateador ponía cada compás en su línea y
 * una prueba de una línea ocupaba diez.
 */
function en(texto: string): PasoPosible[] {
  return texto.split(' ').map((compas) => {
    const [degree, beats, especie] = compas.split(':');
    return {
      degree: degree as DegreeSymbol,
      beats: Number(beats),
      move: null,
      ...(especie === undefined
        ? {}
        : { especie: especie === 'null' ? null : (especie as EspecieDeBloque) }),
    };
  });
}

const POP = 'I:4 V:4 vi:4 IV:4';

function salida(path: PathId, secciones: SalidaPosible['secciones']): SalidaPosible {
  return { path, secciones, nombre: '', que: '', colores: [] };
}

/** Una salida que continúa lo tuyo con estos compases. */
function continua(
  nuevos: string,
  tuyos = POP,
  opciones: { mode?: KeyMode; path?: PathId; contexto?: ContextoDeSalidas } = {},
) {
  return examinar(
    opciones.mode ?? 'major',
    en(tuyos),
    opciones.contexto ?? {},
    salida(opciones.path ?? 'seguir', [
      { name: 'Lo que llevas', yours: true, steps: en(tuyos) },
      { name: 'Cierre', yours: false, steps: en(nuevos) },
    ]),
  );
}

/** Una salida que retoca lo tuyo y deja esta canción. */
function retoca(cancion: string, tuyos = POP) {
  return examinar(
    'major',
    en(tuyos),
    {},
    salida('rearmonizar', [{ name: 'Lo que llevas', yours: false, steps: en(cancion) }]),
  );
}

describe('los predicados del corpus', () => {
  it('leen cómo acaba y por dónde sigue', () => {
    expect(cierraCon('V', 'I').cumple(continua('V:4 I:4 I:4'))).toBe(true);
    expect(cierraCon('V', 'I').cumple(continua('IV:4 I:4'))).toBe(false);
    expect(cierraCon('V', 'I').dice).toBe('termina con V→I');
    expect(cierraEnLaTonica().cumple(continua('V:4 I:4'))).toBe(true);
    expect(cierraEnLaTonica().cumple(continua('V:4 i:4', 'i:4 iv:4', { mode: 'minor' }))).toBe(
      true,
    );
    expect(cierraEnLaTonica().cumple(continua('V:4'))).toBe(false);

    expect(sigueCon('V').cumple(continua('V:4 I:4'))).toBe(true);
    expect(sigueCon('V').cumple(continua('ii:4 V:4'))).toBe(false);
    // Al retocar sin alargar no hay nada detrás de lo tuyo.
    expect(sigueCon('V').cumple(retoca('I:4 V:4 vi:4 V:4'))).toBe(false);

    expect(repiteLoTuyo().cumple(continua(POP))).toBe(true);
    expect(repiteLoTuyo().cumple(continua('I:4 V:4 IV:4 I:4'))).toBe(false);
  });

  it('cuentan un giro solo si lo trae la salida, costura incluida', () => {
    // Tu V y su IV I detrás: V→IV→I.
    expect(meteElGiro('V', 'IV', 'I').cumple(continua('IV:4 I:4', 'vi:4 V:4'))).toBe(true);
    // Ya estaba en lo tuyo, y la salida no lo repite.
    expect(meteElGiro('V', 'IV').cumple(continua('ii:4 I:4', 'V:4 IV:4 I:4 vi:4'))).toBe(false);
    // Un acorde que dura dos compases es el mismo giro.
    expect(meteElGiro('V', 'I').cumple(continua('V:4 V:4 I:4'))).toBe(true);
  });

  it('distinguen pasar por un grado de meter uno que no estaba', () => {
    expect(pasaPor('V').cumple(continua('V:4 I:4'))).toBe(true);
    expect(pasaPor('ii').cumple(continua('V:4 I:4'))).toBe(false);
    expect(meteElGrado('bVII').cumple(continua('bVII:4 I:4'))).toBe(true);
    // El V ya estaba en lo tuyo.
    expect(meteElGrado('V').cumple(continua('V:4 I:4'))).toBe(false);
    expect(meteElGrado('ii').cumple(continua('V:4 I:4'))).toBe(false);
  });

  it('miden el largo en compases y no en bloques', () => {
    expect(cuadra(4).cumple(continua('ii:4 V:4 V:4 I:4'))).toBe(true);
    expect(cuadra(4).cumple(continua('V:4 I:4'))).toBe(false);
    // Media canción no cuadra con nada.
    expect(cuadra(2).cumple(continua('V:2'))).toBe(false);
    expect(duraCompases(6).cumple(continua('V:4 I:4'))).toBe(true);
    expect(alarga(2).cumple(continua('V:4 I:4'))).toBe(true);
    expect(alarga(2).cumple(continua('I:4'))).toBe(false);
    // En tres por cuatro, doce pulsos son cuatro compases.
    const vals = continua('V:3 I:3', 'I:3 V:3', { contexto: { pulsosPorCompas: 3 } });
    expect(vals.pulsosPorCompas).toBe(3);
    expect(duraCompases(4).cumple(vals)).toBe(true);
  });

  it('dan la frase por coja con un número impar de compases, salvo el acorde final', () => {
    const coja = fraseCoja();
    // 4 + 3 = 7.
    expect(coja.cumple(continua('iv:4 bVII:4 I:4'))).toBe(true);
    // 4 + 2 = 6: par.
    expect(coja.cumple(continua('V:4 I:4'))).toBe(false);
    // 4 + 1, en la tónica: es el acorde final.
    expect(coja.cumple(continua('I:4'))).toBe(false);
    // 4 + 1 que no es la tónica: coja.
    expect(coja.cumple(continua('V:4'))).toBe(true);
    // 2 + 1 en la tónica: con dos compases, la frase cuadra de dos en dos.
    expect(coja.cumple(continua('I:4', 'I:4 V:4'))).toBe(false);
    // Medio compás no es impar: eso lo mira `acabaAMitadDeCompas`.
    expect(coja.cumple(continua('V:2'))).toBe(false);
    // Retocar sin cambiar el largo de lo tuyo, aunque fuera impar, no lo estropea.
    expect(coja.cumple(retoca('I:4 ii:4 V:4', 'I:4 IV:4 V:4'))).toBe(false);
  });

  it('miran los pulsos de lo que pone la salida', () => {
    expect(acabaAMitadDeCompas().cumple(continua('V:2'))).toBe(true);
    expect(acabaAMitadDeCompas().cumple(continua('V:4'))).toBe(false);
    // Lo tuyo ya acababa a mitad, y retocarlo sin cambiar los pulsos no es culpa suya.
    expect(acabaAMitadDeCompas().cumple(retoca('I:4 vi:2', 'I:4 V:2'))).toBe(false);

    expect(compasDeUnPulso().cumple(continua('V:1 I:3'))).toBe(true);
    expect(compasDeUnPulso().cumple(continua('V:4'))).toBe(false);

    expect(fueraDeLaRejilla().cumple(continua('V:6 I:2'))).toBe(true);
    expect(fueraDeLaRejilla().cumple(continua('V:2 I:8'))).toBe(false);
    // Rearmonizar un compás de tres pulsos de una toma no hereda nada nuevo.
    expect(fueraDeLaRejilla().cumple(retoca('I:5 bII:3', 'I:5 V:3'))).toBe(false);

    expect(loNuevoVaA(2).cumple(continua('IV:2 V:2 I:4'))).toBe(true);
    expect(loNuevoVaA(2).cumple(continua('IV:4 V:2 I:2'))).toBe(false);
    // Un I de dieciséis tras compases de cuatro es relleno; de ocho, el acorde final.
    expect(relleno().cumple(continua('I:16'))).toBe(true);
    expect(relleno().cumple(continua('V:4 I:8'))).toBe(false);
    expect(relleno().cumple(continua('I:16', 'I:8 IV:8'))).toBe(false);
    expect(algoNuevoDura(10).cumple(continua('V:10 I:6'))).toBe(true);
    expect(algoNuevoDura(10).cumple(continua('V:4'))).toBe(false);
  });

  it('piden la séptima en todo lo nuevo', () => {
    const septima = loNuevoConSeptima();
    expect(septima.cumple(continua('V:4:dominant7 I:4:major7'))).toBe(true);
    expect(septima.cumple(continua('V:4:dominant7 I:4'))).toBe(false);
    expect(septima.cumple(continua('V:4:sus4'))).toBe(false);
    // La tríada del grado, dicha con todas las letras.
    expect(septima.cumple(continua('V:4:null'))).toBe(false);
    // Al retocar sin cambiar nada no hay nada nuevo que suene con séptima.
    expect(septima.cumple(retoca(POP))).toBe(false);
  });

  it('comparan lo retocado con lo tuyo compás a compás', () => {
    expect(cambiaElCompas(1).cumple(retoca('vi:4 V:4 vi:4 IV:4'))).toBe(true);
    expect(cambiaElCompas(1).cumple(retoca('I:4 iii:4 vi:4 IV:4'))).toBe(false);
    // El iii por el I, cuando se admite, no cuenta como cambiarlo.
    const conIii = cambiaElCompas(1, ['iii']);
    expect(conIii.dice).toContain('que no es iii');
    expect(conIii.cumple(retoca('iii:4 V:4 vi:4 IV:4'))).toBe(false);
    expect(conIii.cumple(retoca('vi:4 V:4 vi:4 IV:4'))).toBe(true);
    // Un compás que desaparece también ha cambiado.
    expect(cambiaElCompas(4).cumple(retoca('I:4 V:4 vi:4'))).toBe(true);
    expect(cambiaElCompas(4, ['iii']).cumple(retoca('I:4 V:4 vi:4'))).toBe(true);

    expect(cambiaAlgunoEntre(1, 2).cumple(retoca('I:4 iii:4 vi:4 IV:4'))).toBe(true);
    expect(cambiaAlgunoEntre(1, 2).cumple(retoca('I:4 V:4 vi:4 iv:4'))).toBe(false);

    const soloElFinal = soloCambiaEntre(3, 4);
    expect(soloElFinal.cumple(retoca('I:4 V:4 vi:4 iv:4'))).toBe(true);
    expect(soloElFinal.cumple(retoca('I:4 iii:4 vi:4 iv:4'))).toBe(false);
    expect(soloElFinal.cumple(retoca('I:4 V:4 vi:4'))).toBe(false);
    expect(soloElFinal.cumple(retoca(POP))).toBe(false);

    expect(compasEs(2, 'V').cumple(retoca(POP))).toBe(true);
    expect(conservaElFinal().cumple(retoca(POP))).toBe(true);
    expect(conservaElFinal().cumple(retoca('I:4 V:4 vi:4 I:4'))).toBe(false);
    expect(cambiaAlgo().cumple(retoca('I:4 V:4 vi:4 I:4'))).toBe(true);
    expect(cambiaAlgo().cumple(retoca(POP))).toBe(false);
    expect(cambiaTodos().cumple(retoca('vi:4 iii:4 IV:4 ii:4'))).toBe(true);
    expect(cambiaTodos().cumple(retoca('vi:4 V:4 IV:4 ii:4'))).toBe(false);
  });

  it('reconocen los mismos acordes con otro reparto', () => {
    const toma = 'I:5 V:3';
    expect(mismosAcordesA(4).cumple(retoca('I:4 V:4', toma))).toBe(true);
    expect(mismosAcordesA(4).cumple(retoca('I:8 V:8', toma))).toBe(false);
    expect(mismosAcordesA(4).cumple(retoca('I:4 IV:4', toma))).toBe(false);
    expect(mismosAcordesA(4).cumple(retoca('I:4', toma))).toBe(false);
  });

  it('se combinan, y dicen lo que se les pide', () => {
    const puente = continua('V:4 I:4', POP, { path: 'contraste' });
    expect(esCamino('contraste').cumple(puente)).toBe(true);
    expect(esCamino('seguir').cumple(puente)).toBe(false);
    expect(y(cierraEnLaTonica(), cuadra(4)).cumple(puente)).toBe(false);
    expect(y(cierraEnLaTonica(), cuadra(2)).dice).toBe(
      'acaba en la tónica y dura un múltiplo de 2 compases',
    );
    expect(o(cuadra(4), cierraEnLaTonica()).cumple(puente)).toBe(true);
    expect(o(cuadra(4), cuadra(8)).dice).toBe(
      '(dura un múltiplo de 4 compases o dura un múltiplo de 8 compases)',
    );
    expect(no(cuadra(4)).cumple(puente)).toBe(true);
    expect(no(cuadra(4)).dice).toBe('no dura un múltiplo de 4 compases');
    expect(no(cuadra(4), 'queda corta').dice).toBe('queda corta');
    expect(dicho('cierra', cierraEnLaTonica()).cumple(puente)).toBe(true);
  });
});

// --- Los predicados de cómo suena ------------------------------------------------

/** Una salida que continúa o retoca lo tuyo, con contexto y modo a mano. */
function conContexto(
  contexto: ContextoDeSalidas,
  tuyos: string,
  cancion: string,
  opciones: { mode?: KeyMode; continuar?: boolean } = {},
) {
  return examinar(
    opciones.mode ?? 'major',
    en(tuyos),
    contexto,
    opciones.continuar === true
      ? salida('seguir', [
          { name: 'Lo que llevas', yours: true, steps: en(tuyos) },
          { name: 'Cierre', yours: false, steps: en(cancion) },
        ])
      : salida('rearmonizar', [{ name: 'Lo que llevas', yours: false, steps: en(cancion) }]),
  );
}

describe('los predicados de cómo suena', () => {
  it('guardan el contexto de lo tuyo en la salida examinada', () => {
    const contexto = { estilo: 'jazz' } as const;
    expect(conContexto(contexto, POP, POP).contexto).toBe(contexto);
  });

  it('saben por dónde arranca lo nuevo', () => {
    expect(empiezaEn('I', 'IV').cumple(continua('IV:4 V:4 I:4'))).toBe(true);
    expect(empiezaEn('I', 'IV').cumple(continua('V:4 I:4'))).toBe(false);
    expect(empiezaEn('I').dice).toBe('lo nuevo arranca en I');
    // Al retocar sin alargar no arranca nada.
    expect(empiezaEn('I').cumple(retoca('I:4 V:4 vi:4 V:4'))).toBe(false);
  });

  it('ven dos compases iguales que la salida ha pegado, y no los que ya eran tuyos', () => {
    const pega = repiteAlVecino();
    // El iv por un IV detrás de otro IV.
    expect(pega.cumple(retoca('I:4 IV:4 IV:4 I:4', 'I:4 IV:4 iv:4 I:4'))).toBe(true);
    // Y delante: el compás que cambia se pega al que le sigue.
    expect(pega.cumple(retoca('I:4 vi:4 vi:4 IV:4'))).toBe(true);
    expect(pega.cumple(retoca('I:4 V:4 vi:4 iv:4'))).toBe(false);
    // Estirar no pega nada: los dos IV ya iban juntos.
    expect(pega.cumple(retoca('I:8 IV:8 IV:8', 'I:4 IV:4 IV:4'))).toBe(false);
    // La costura con lo tuyo no cuenta; dentro de lo nuevo, sí.
    expect(pega.cumple(continua('IV:4 V:4 I:4'))).toBe(false);
    expect(pega.cumple(continua('V:4 V:4 I:4'))).toBe(true);
  });

  it('oyen la sensible solo en lo que tira a la tónica, y solo si no era tuya', () => {
    const sensible = meteLaSensible();
    expect(sensible.cumple(continua('V:4 I:4', 'I:4 bVII:4 IV:4 I:4'))).toBe(true);
    // El vii° también la lleva, de fundamental.
    expect(sensible.cumple(continua('vii°:4 I:4', 'I:4 bVII:4 IV:4 I:4'))).toBe(true);
    // Un Vsus4 o un V5 no la llevan.
    expect(sensible.cumple(continua('V:4:sus4 I:4', 'I:4 bVII:4 IV:4 I:4'))).toBe(false);
    expect(sensible.cumple(continua('V:4:quinta I:4', 'I:4 bVII:4 IV:4 I:4'))).toBe(false);
    // El iii la tiene dentro, pero no tira a la tónica.
    expect(sensible.cumple(continua('iii:4 I:4', 'I:4 bVII:4 IV:4 I:4'))).toBe(false);
    // Lo tuyo ya la tenía.
    expect(sensible.cumple(continua('V:4 I:4'))).toBe(false);
    // Tu V en quintas no la tenía, y un V con tercera sí la trae.
    const quintas = { especies: ['quinta', 'quinta'] } as const;
    expect(sensible.cumple(conContexto(quintas, 'I:4 V:4', 'V:4 I:4', { continuar: true }))).toBe(
      true,
    );
    // En menor, el V armónico la lleva y la v no.
    expect(sensible.cumple(continua('V:4 i:4', 'i:4 v:4 VII:4 i:4', { mode: 'minor' }))).toBe(true);
    expect(sensible.cumple(continua('v:4 i:4', 'i:4 VII:4 VI:4 VII:4', { mode: 'minor' }))).toBe(
      false,
    );
  });

  it('piden la especie con que tocas cada grado, y la que se pide para todo', () => {
    const tuyas = llevaTusEspecies();
    const quintas = { especies: ['quinta', 'quinta', 'quinta', 'quinta'] } as const;
    const riff = 'I:4 IV:4 V:4 IV:4';
    expect(
      tuyas.cumple(conContexto(quintas, riff, 'I:4:quinta V:4:quinta', { continuar: true })),
    ).toBe(true);
    expect(tuyas.cumple(conContexto(quintas, riff, 'I:4 V:4:quinta', { continuar: true }))).toBe(
      false,
    );
    // Un grado que no tocas queda libre.
    expect(tuyas.cumple(conContexto(quintas, riff, 'vi:4', { continuar: true }))).toBe(true);
    // Sin especies, tu grado es una tríada.
    expect(tuyas.cumple(continua('I:4'))).toBe(true);
    expect(tuyas.cumple(continua('I:4:major7'))).toBe(false);

    expect(loNuevoEn('quinta').cumple(continua('I:4:quinta'))).toBe(true);
    expect(loNuevoEn('quinta').cumple(continua('I:4:quinta V:4'))).toBe(false);
    expect(loNuevoEn('quinta').cumple(retoca(POP))).toBe(false);
    expect(loNuevoEn('quinta').dice).toBe('lo nuevo suena en quinta');
    expect(algoNuevoEn('major7').cumple(continua('V:4 I:4:major7'))).toBe(true);
    expect(algoNuevoEn('major7').cumple(continua('V:4 I:4'))).toBe(false);
  });

  it('ven que cambia la especie de un acorde tuyo que se queda', () => {
    const sus = { especies: [null, null, 'sus4', null] } as const;
    const tuyos = 'I:4 IV:4 V:4 V:4';
    expect(cambiaTuEspecie().cumple(conContexto(sus, tuyos, 'I:4 IV:4 V:4 V:4'))).toBe(true);
    expect(cambiaTuEspecie().cumple(conContexto(sus, tuyos, 'I:4 IV:4 V:4:sus4 V:4'))).toBe(false);
    // Cambiar el grado no es cambiar la especie: eso lo miran otros.
    expect(cambiaTuEspecie().cumple(conContexto(sus, tuyos, 'I:4 IV:4 ii:4 V:4'))).toBe(false);
    expect(cambiaTuEspecie().cumple(conContexto(sus, tuyos, 'I:4 IV:4'))).toBe(false);
  });

  it('miden las dominantes: sin séptima, secundarias nuevas', () => {
    expect(dominanteSinSeptima().cumple(continua('V/ii:4 ii:4'))).toBe(true);
    expect(dominanteSinSeptima().cumple(continua('V:4:dominant7 I:4'))).toBe(false);
    expect(dominanteSinSeptima().cumple(continua('V:4 I:4'))).toBe(true);
    expect(meteUnaSecundaria().cumple(continua('V/V:4 V:4'))).toBe(true);
    expect(meteUnaSecundaria().cumple(continua('V:4 I:4'))).toBe(false);
    // Si lo tuyo ya tenía una, la salida no la trae.
    expect(meteUnaSecundaria().cumple(continua('V/V:4 V:4', 'I:4 V/vi:4 vi:4 IV:4'))).toBe(false);
    expect(tieneElGrado('vi').cumple(continua('V:4'))).toBe(true);
    expect(tieneElGrado('bII').cumple(continua('V:4'))).toBe(false);
  });

  it('oyen el choque de frente con una nota fuerte del punteo, no el color', () => {
    const choca = chocaConElPunteo();
    // Un Si fuerte: contra un Bb choca, contra un G lo lleva dentro.
    const si = { melodia: [[], [], [], [{ nota: 11, fuerte: true }]] };
    const tuyos = 'I:4 vi:4 IV:4 V:4';
    expect(choca.cumple(conContexto(si, tuyos, 'I:4 vi:4 IV:4 bVII:4'))).toBe(true);
    expect(choca.cumple(conContexto(si, tuyos, 'I:4 vi:4 IV:4 iii:4'))).toBe(false);
    // Un Fa fuerte sobre un Lab no es suyo, pero no roza ninguna: es color.
    const fa = { melodia: [[], [], [{ nota: 5, fuerte: true }], []] };
    expect(choca.cumple(conContexto(fa, tuyos, 'I:4 vi:4 bVI:4 V:4'))).toBe(false);
    // Y por debajo: un Mi fuerte contra un Fam choca, y contra un Rem es su novena.
    const mi = { melodia: [[], [], [{ nota: 4, fuerte: true }], []] };
    expect(choca.cumple(conContexto(mi, tuyos, 'I:4 vi:4 iv:4 V:4'))).toBe(true);
    expect(choca.cumple(conContexto(mi, tuyos, 'I:4 vi:4 bII:4 V:4'))).toBe(true);
    expect(choca.cumple(conContexto(mi, tuyos, 'I:4 vi:4 ii:4 V:4'))).toBe(false);
    // Lo que ya era tuyo no lo ha puesto la salida, aunque roce.
    expect(choca.cumple(conContexto(mi, tuyos, 'I:4 vi:4 IV:4 V:4'))).toBe(false);
    // Una nota débil no cuenta, ni un compás sin punteo.
    const debil = { melodia: [[], [], [], [{ nota: 11, fuerte: false }]] };
    expect(choca.cumple(conContexto(debil, tuyos, 'I:4 vi:4 IV:4 bVII:4'))).toBe(false);
    expect(choca.cumple(conContexto({}, tuyos, 'I:4 vi:4 IV:4 bVII:4'))).toBe(false);
  });

  it('cuentan las frases de lo que se añade', () => {
    const tres = respetaFrasesDe(3);
    const tuyos = 'I:4 IV:4 V:4 vi:4 IV:4 V:4';
    expect(tres.cumple(continua('IV:4 V:4 I:4', tuyos))).toBe(true);
    expect(tres.cumple(continua('V:4 I:4', tuyos))).toBe(false);
    expect(tres.cumple(continua('V:2', tuyos))).toBe(false);
    // Retocar sin cambiar el largo no añade nada, y nada es múltiplo de todo.
    expect(tres.cumple(retoca('I:4 ii:4 V:4 vi:4 IV:4 V:4', tuyos))).toBe(true);
  });

  it('ven que se va el préstamo entero, y que se cambia lo dudoso', () => {
    const tuyos = 'I:4 IV:4 iv:4 I:4';
    expect(pierdeElPrestado().cumple(retoca('I:4 IV:4 V:4 I:4', tuyos))).toBe(true);
    expect(pierdeElPrestado().cumple(retoca('I:4 IV:4 bVI:4 I:4', tuyos))).toBe(false);
    // Sin préstamo que perder, y en menor, nunca.
    expect(pierdeElPrestado().cumple(retoca('I:4 V:4 vi:4 V:4'))).toBe(false);
    expect(
      pierdeElPrestado().cumple(conContexto({}, 'i:4 iv:4', 'i:4 v:4', { mode: 'minor' })),
    ).toBe(false);

    const duda = { dudosos: [false, true, false, false] };
    const conDuda = 'I:4 iii:4 vi:4 IV:4';
    expect(cambiaLoDudoso().cumple(conContexto(duda, conDuda, 'I:4 V/vi:4 vi:4 IV:4'))).toBe(true);
    expect(cambiaLoDudoso().cumple(conContexto(duda, conDuda, 'I:4 iii:4 vi:4 ii:4'))).toBe(false);
    expect(cambiaLoDudoso().cumple(conContexto({}, conDuda, 'I:4 V:4 vi:4 IV:4'))).toBe(false);
  });
});

// --- Los predicados de adónde va cada acorde ---------------------------------------

describe('los predicados de adónde va cada acorde', () => {
  it('quieren que una secundaria vaya a su destino, al tritonal o a otra dominante', () => {
    const resuelve = secundariaQueNoResuelve();
    expect(resuelve.dice).toBe('pone una dominante secundaria que no va a su destino');
    // El V/V que salta a la I, y el que va a su V.
    expect(resuelve.cumple(continua('V/V:4 I:4'))).toBe(true);
    expect(resuelve.cumple(continua('V/V:4 V:4 I:4'))).toBe(false);
    // Un semitono abajo es el sustituto tritonal del destino; dos compases del mismo, uno.
    expect(resuelve.cumple(continua('V/V:4 V/V:4 bII:4 I:4'))).toBe(false);
    // En cadena: el V/vi va al V/ii, que baja la quinta.
    expect(resuelve.cumple(continua('V/vi:4 V/ii:4 ii:4 V:4 I:4'))).toBe(false);
    // Colgada al final de una frase no va a ningún sitio, si la ha colgado la salida.
    expect(resuelve.cumple(continua('IV:4 V/V:4'))).toBe(true);
    expect(resuelve.cumple(retoca('I:4 ii:4 vi:4 V/V:4', 'I:4 V:4 vi:4 V/V:4'))).toBe(false);
    // Al final de un contraste va a tu primer compás: al I no, al V sí.
    const contraste = { path: 'contraste' } as const;
    expect(resuelve.cumple(continua('ii:4 V/V:4', POP, contraste))).toBe(true);
    expect(resuelve.cumple(continua('ii:4 V/V:4', 'V:4 I:4', contraste))).toBe(false);
    // La tuya, con lo suyo detrás, no la ha decidido la salida.
    expect(resuelve.cumple(continua('V:4 I:4', 'I:4 V/V:4 IV:4 I:4'))).toBe(false);
    // Lo que el arreglista admite además.
    const conIV = secundariaQueNoResuelve('IV');
    expect(conIV.dice).toContain('ni a IV');
    expect(conIV.cumple(continua('IV:4 V:4 I:4', 'I:4 V/vi:4 vi:4 V/V:4'))).toBe(false);
    expect(resuelve.cumple(continua('IV:4 V:4 I:4', 'I:4 V/vi:4 vi:4 V/V:4'))).toBe(true);
  });

  it('ven dos secundarias seguidas que pone la salida', () => {
    const cadena = encadenaSecundarias();
    expect(cadena.cumple(continua('V/vi:4 V/ii:4 ii:4 V:4'))).toBe(true);
    expect(cadena.cumple(continua('V/vi:4 vi:4 V/V:4 V:4'))).toBe(false);
    // La tuya ya estaba encadenada, y lo que sigue no es otra secundaria.
    expect(cadena.cumple(continua('ii:4 V:4', 'I:4 V/vi:4 V/ii:4 V/V:4'))).toBe(false);
    // Una secundaria al final de todo no encadena con nada.
    expect(cadena.cumple(continua('IV:4 V/V:4'))).toBe(false);
  });

  it('no dejan que una secundaria tuya se cambie por algo que ya no tira adonde iba', () => {
    const pierde = pierdeLaSecundaria();
    const gospel = { especies: [null, 'dominant7', null, null] } as const;
    const tuyos = 'I:4 I:4 IV:4 I:4';
    // El I7 que va al IV, cambiado por un vi: ya no tira.
    expect(pierde.cumple(conContexto(gospel, tuyos, 'I:4 vi:4 IV:4 I:4'))).toBe(true);
    expect(pierde.cumple(conContexto(gospel, tuyos, 'I:4 V/V:4 V:4 I:4'))).toBe(false);
    // Si cambia también el de detrás, la secundaria ya no tenía adonde ir.
    expect(pierde.cumple(conContexto(gospel, tuyos, 'I:4 vi:4 ii:4 I:4'))).toBe(false);
    // Tu I a secas no es ninguna secundaria.
    expect(pierde.cumple(conContexto({}, tuyos, 'I:4 vi:4 IV:4 I:4'))).toBe(false);
    // El iii por el V/vi deja el bajo cayendo la misma quinta: la misma llegada, más suave.
    const relativa = 'I:4 V/vi:4 vi:4 IV:4';
    expect(pierde.cumple(conContexto({}, relativa, 'I:4 iii:4 vi:4 IV:4'))).toBe(false);
    expect(pierde.cumple(conContexto({}, relativa, 'I:4 IV:4 vi:4 IV:4'))).toBe(true);
    // El tritonal del vi, un semitono por encima, sigue tirando a él.
    expect(pierde.cumple(conContexto({}, relativa, 'I:4 bVII:4 vi:4 IV:4'))).toBe(false);
    // Una secundaria tuya que no baja la quinta al de detrás no tiraba a él.
    expect(pierde.cumple(conContexto({}, 'I:4 V/vi:4 IV:4 I:4', 'I:4 ii:4 IV:4 I:4'))).toBe(false);
    // Lo que se queda sin compás no se ha cambiado por nada.
    expect(pierde.cumple(conContexto({}, relativa, 'I:4'))).toBe(false);
  });

  it('ven el vii° pelado como cadencia, y no el que lleva su séptima', () => {
    const vii = cadenciaDeViiTriada();
    expect(vii.cumple(continua('IV:4 vii°:4 I:4'))).toBe(true);
    expect(vii.cumple(continua('IV:4 vii°:4:halfDiminished7 I:4'))).toBe(false);
    expect(vii.cumple(continua('IV:4 vii°:4 iii:4 I:4'))).toBe(false);
    // El tuyo ya estaba.
    expect(vii.cumple(continua('IV:4 I:4', 'I:4 IV:4 vii°:4 I:4'))).toBe(false);
  });

  it('piden el idioma de dominantes, un acorde con su especie y los pulsos de la rejilla', () => {
    const dominantes = loNuevoComoDominantes();
    expect(dominantes.cumple(continua('IV:4:dominant7 ii:4:minor7 V:4:dominant7'))).toBe(true);
    expect(dominantes.cumple(continua('IV:4:major7 V:4:dominant7'))).toBe(false);
    expect(dominantes.cumple(continua('IV:4 V:4:dominant7'))).toBe(false);
    expect(dominantes.cumple(retoca(POP))).toBe(false);

    expect(poneComo('IV', 'dominant7').cumple(continua('IV:4:dominant7 I:4'))).toBe(true);
    expect(poneComo('IV', 'dominant7').cumple(continua('IV:4:major7 I:4'))).toBe(false);
    expect(poneComo('IV', 'dominant7').dice).toBe('pone IV en dominant7');
    expect(poneComo('vii°', null).cumple(continua('vii°:4 I:4'))).toBe(true);
    expect(poneComo('vii°', null).dice).toBe('pone vii° en tríada');

    const vals = { contexto: { pulsosPorCompas: 6 } };
    expect(loNuevoEnMultiplosDe(3).cumple(continua('IV:6 V:3 I:3', POP, vals))).toBe(true);
    expect(loNuevoEnMultiplosDe(3).cumple(continua('IV:4 V:2', POP, vals))).toBe(false);
    expect(duraMasDe(8).cumple(continua(POP))).toBe(false);
    expect(duraMasDe(4).cumple(continua('I:4'))).toBe(true);
  });

  it('ven un contraste que vuelve a casa dos veces por el camino', () => {
    const reposa = contrasteQueReposaEnLaTonica();
    const contraste = { path: 'contraste' } as const;
    expect(reposa.cumple(continua('V:4 I:4 vi:4 IV:4 I:4 V:4', POP, contraste))).toBe(true);
    // Una vez es de camino; un I de dos compases es una vez.
    expect(reposa.cumple(continua('vi:4 IV:4 I:4 I:4 V:4', POP, contraste))).toBe(false);
    expect(reposa.cumple(continua('V:4 I:4 vi:4 IV:4 I:4 V:4'))).toBe(false);
  });

  it('oyen el punteo donde suena: al estirar, y en las notas débiles que chocan', () => {
    const choca = chocaConElPunteoDondeSuena();
    // Un Si fuerte en el compás 3: al estirar, cae debajo del IV.
    const si = { melodia: [[], [], [{ nota: 11, fuerte: true }], []] };
    const tuyos = 'I:4 IV:4 V:4 I:4';
    expect(choca.cumple(conContexto(si, tuyos, 'I:8 IV:8 V:8 I:8'))).toBe(true);
    expect(choca.cumple(conContexto(si, tuyos, tuyos))).toBe(false);
    // Una débil choca si queda un semitono por encima: un Si débil sobre un Bb.
    const debil = { melodia: [[], [{ nota: 11, fuerte: false }], [], []] };
    const jazz = 'ii:4 V:4 I:4 I:4';
    expect(choca.cumple(conContexto(debil, jazz, 'ii:4 bVII:4 I:4 I:4'))).toBe(true);
    // Un Fa débil bajo un D7 es su novena aumentada, y se canta.
    const fa = { melodia: [[{ nota: 5, fuerte: false }], [], [], []] };
    expect(choca.cumple(conContexto(fa, jazz, 'V/V:4:dominant7 V:4 I:4 I:4'))).toBe(false);
    // Con dos acordes debajo, solo si choca con todos: puede caer en cualquiera.
    expect(choca.cumple(conContexto(debil, jazz, 'ii:4 bVII:2 V:2 I:4 I:4'))).toBe(false);
    expect(choca.cumple(conContexto(debil, jazz, 'ii:4 bVII:2 bVII:2 I:4 I:4'))).toBe(true);
    // Lo que se queda sin acorde debajo no choca con nada, ni sin punteo.
    expect(choca.cumple(conContexto(si, tuyos, 'I:4 IV:4'))).toBe(false);
    expect(choca.cumple(conContexto(debil, jazz, 'ii:4'))).toBe(false);
    expect(choca.cumple(conContexto({}, tuyos, 'I:8 IV:8 V:8 I:8'))).toBe(false);
  });
});

// --- Los predicados de lo que dice de sí misma ---------------------------------------

/** Una salida que dice algo de sí misma: su nombre, su frase y los motivos del juez. */
function diciendo(
  palabras: { nombre?: string; que?: string; motivos?: string[] },
  cancion: string,
  tuyos = POP,
  opciones: {
    continuar?: boolean;
    mode?: KeyMode;
    contexto?: ContextoDeSalidas;
    path?: PathId;
    pasos?: PasoPosible[];
  } = {},
) {
  const { nombre = '', que = '', motivos } = palabras;
  const secciones: SalidaPosible['secciones'] =
    opciones.continuar === true
      ? [
          { name: 'Lo que llevas', yours: true, steps: en(tuyos) },
          { name: 'Cierre', yours: false, steps: en(cancion) },
        ]
      : [{ name: 'Lo que llevas', yours: false, steps: opciones.pasos ?? en(cancion) }];
  return examinar(opciones.mode ?? 'major', en(tuyos), opciones.contexto ?? {}, {
    path: opciones.path ?? (opciones.continuar === true ? 'seguir' : 'rearmonizar'),
    secciones,
    nombre,
    que,
    colores: [],
    ...(motivos === undefined
      ? {}
      : {
          encaje: {
            puntos: 0,
            descarte: null,
            criterios: motivos.map((motivo) => ({ id: 'cadencia' as const, valor: 0, motivo })),
          },
        }),
  });
}

describe('los predicados de lo que dice de sí misma', () => {
  it('guardan lo que dice, sin los motivos vacíos', () => {
    const dicha = diciendo({ nombre: 'n', que: 'q', motivos: ['uno', ''] }, POP);
    expect(dicha.palabras).toEqual({ nombre: 'n', que: 'q', motivos: ['uno'] });
    expect(diciendo({}, POP).palabras.motivos).toEqual([]);
  });

  it('no dejan decir «resuelve en la I» detrás de algo que no resuelve', () => {
    const resuelve = resuelveSinResolver();
    const dice = { que: 'Resuelve en la I y añade otra frase, I IV V I.' };
    const continuar = { continuar: true } as const;
    // Detrás de un ii, o de la propia I, no resuelve nada.
    expect(resuelve.cumple(diciendo(dice, 'I:4 IV:4 V:4 I:4', 'I:4 bIII:4 ii:4', continuar))).toBe(
      true,
    );
    expect(resuelve.cumple(diciendo(dice, 'I:4 IV:4', 'I:4 I:4', continuar))).toBe(true);
    // Detrás del V o del IV, sí.
    expect(resuelve.cumple(diciendo(dice, 'I:4', 'I:4 IV:4 V:4', continuar))).toBe(false);
    expect(resuelve.cumple(diciendo(dice, 'I:4', 'I:4 V:4 IV:4', continuar))).toBe(false);
    // Y si la I no llega, tampoco resuelve; sin decirlo, no miente.
    expect(resuelve.cumple(diciendo(dice, 'IV:4 V:4', POP, continuar))).toBe(true);
    expect(resuelve.cumple(diciendo({}, 'I:4', 'I:4 ii:4', continuar))).toBe(false);
    // En menor, la i; y la que ya está en el primer compás no viene de nada.
    expect(
      resuelve.cumple(
        diciendo({ nombre: 'Resuelve en la i' }, 'i:4', 'i:4 VII:4', {
          continuar: true,
          mode: 'minor',
        }),
      ),
    ).toBe(false);
    expect(resuelve.cumple(diciendo(dice, 'I:4 V:4', 'vi:4 V:4'))).toBe(true);
  });

  it('solo llaman plagal a lo que llega desde el IV o el iv', () => {
    const plagal = plagalQueNoLoEs();
    const motivos = (motivo: string) => diciendo({ motivos: [motivo] }, POP);
    expect(plagal.cumple(motivos('Tu bucle vuelve a empezar por ii I: cadencia plagal.'))).toBe(
      true,
    );
    expect(plagal.cumple(motivos('IV I: cadencia plagal, el amén.'))).toBe(false);
    expect(plagal.cumple(diciendo({ que: 'iv i: cadencia plagal.' }, POP))).toBe(false);
    expect(plagal.cumple(motivos('V I: cadencia perfecta.'))).toBe(false);
  });

  it('no dejan llamar desigual a lo que ya caía en la rejilla', () => {
    const desigual = desigualQueNoLoEs();
    const dice = { que: 'Cuadra lo que se tocó desigual.' };
    // Una tónica de dos compases al final no es una toma desigual.
    expect(desigual.cumple(diciendo(dice, 'I:4 IV:4 I:4', 'I:4 IV:4 I:8'))).toBe(true);
    expect(desigual.cumple(diciendo(dice, 'I:4 V:4', 'I:5 V:3'))).toBe(false);
    expect(desigual.cumple(diciendo({}, 'I:4 IV:4 I:4', 'I:4 IV:4 I:8'))).toBe(false);
  });

  it('cuentan «en el N» por compases y no por acordes', () => {
    const compas = compasQueNoEs();
    const tuyos = 'I:2 V:2 vi:2 IV:2 I:2 V:2 vi:2 IV:2';
    // El quinto acorde está en el compás 3, y el compás 5 no existe.
    const quinto = 'I:2 V:2 vi:2 IV:2 V/V:2 V:2 vi:2 IV:2';
    expect(compas.cumple(diciendo({ nombre: 'Su dominante, en el 5' }, quinto, tuyos))).toBe(true);
    expect(compas.cumple(diciendo({ nombre: 'Su dominante, en el 3' }, quinto, tuyos))).toBe(false);
    // Los dos que nombra tienen que cambiar.
    const dos = 'I:4 ii:4 I:4 ii:4';
    const vaiven = 'I:4 IV:4 I:4 IV:4';
    const dice = (que: string) => diciendo({ que }, dos, vaiven);
    expect(compas.cumple(dice('Cambia IV por ii en el 2 y el 4.'))).toBe(false);
    expect(compas.cumple(dice('Cambia IV por ii en el 2 y el 3.'))).toBe(true);
  });

  it('solo dejan engañar al oído con una dominante delante', () => {
    const engana = enganaSinDominante();
    const dice = { que: 'Acaba en vi en vez de en la tónica: engaña al oído.' };
    expect(engana.cumple(diciendo(dice, 'I:4 IV:4 V:4 vi:4'))).toBe(false);
    expect(engana.cumple(diciendo(dice, 'I:4 IV:4 I:4 vi:4 vi:4'))).toBe(true);
    // Sin nada delante, tampoco engaña.
    expect(engana.cumple(diciendo(dice, 'vi:8', 'vi:4'))).toBe(true);
    expect(engana.cumple(diciendo({}, 'I:4 IV:4 I:4 vi:4'))).toBe(false);
  });

  it('juntan las diez mentiras en una', () => {
    const falso = diceAlgoFalso();
    expect(falso.dice).toBe('dice de sí misma algo que no es verdad');
    expect(falso.cumple(diciendo({ motivos: ['ii I: cadencia plagal.'] }, POP))).toBe(true);
    expect(falso.cumple(diciendo({ motivos: ['comparten 1 notas.'] }, POP))).toBe(true);
    expect(falso.cumple(diciendo({}, POP))).toBe(false);
  });

  // Las del corpus final, de una en una.
  it('el nombre y el motivo dicen la misma parte', () => {
    const parte = parteQueSeContradice();
    const sigue = { continuar: true, contexto: { papel: 'estrofa' } } as const;
    const nueva = 'I:4 V/ii:4 ii:4 V:4';
    const dicho = (nombre: string, motivo: string, path: PathId = 'contraste') =>
      parte.cumple(diciendo({ nombre, motivos: [motivo] }, nueva, POP, { ...sigue, path }));
    expect(dicho('Un estribillo por I V/ii ii V', 'Lo que sigue, el pre, acaba en V.')).toBe(true);
    expect(dicho('Un estribillo por I V/ii ii V', 'Lo que sigue, el estribillo, entra en I.')).toBe(
      false,
    );
    // Lo tuyo completado, o la misma parte otra vez, no son «lo que sigue».
    expect(dicho('Cierre: ii V I', 'Lo que sigue, el estribillo, cierra fuerte.', 'seguir')).toBe(
      true,
    );
    expect(dicho('Otro coro que cierra', 'Lo que sigue, el estribillo, cierra.', 'seguir')).toBe(
      true,
    );
    // El motivo que habla de tu parte cuando el nombre dice que lo añadido es otra.
    expect(dicho('Un estribillo por I V/ii ii V', 'La estrofa acaba en V: queda abierta.')).toBe(
      true,
    );
    expect(dicho('Cierre: ii V I', 'La estrofa cierra en la tónica.', 'seguir')).toBe(false);
    expect(dicho('Algo sin parte', 'La estrofa cierra en la tónica.')).toBe(false);
    expect(dicho('Un estribillo por I V/ii ii V', 'El bajo baja.')).toBe(false);
    // Sin papel no hay parte tuya que nombrar, y al retocar no se añade nada.
    expect(
      parte.cumple(
        diciendo({ nombre: 'Un estribillo', motivos: ['La estrofa acaba en V.'] }, nueva, POP, {
          continuar: true,
          path: 'contraste',
        }),
      ),
    ).toBe(false);
    expect(
      parte.cumple(
        diciendo({ nombre: 'Un estribillo', motivos: ['Lo que sigue, el pre, x.'] }, POP),
      ),
    ).toBe(false);
  });

  it('un acorde de quintas no tiene tercera: ni sensible, ni préstamo por ella', () => {
    const quinta = quintaConTercera();
    const quintas = (n: number) => ({ especies: Array<'quinta'>(n).fill('quinta') });
    const riff = 'I:4:quinta IV:4:quinta V:4:quinta IV:4:quinta';
    const conV = (nombre: string, move: 'modal' | null) =>
      diciendo({ nombre }, '', riff, {
        contexto: quintas(4),
        pasos: [
          ...en('I:4:quinta IV:4:quinta'),
          { degree: 'bVII', beats: 4, move, especie: 'quinta' },
          ...en('IV:4:quinta'),
        ],
      });
    expect(quinta.cumple(conV('Sin sensible, en el 3', 'modal'))).toBe(true);
    expect(quinta.cumple(conV('bVII en lugar de V, en el 3', 'modal'))).toBe(false);
    expect(quinta.cumple(conV('Sin sensible, en el 3', null))).toBe(false);
    // El iv5 de mayor es el IV5: nombrarlo nuevo ya es mentir; el tuyo es tuyo.
    const iv = (motivo: string, tuyos = riff) =>
      quinta.cumple(
        diciendo({ motivos: [motivo] }, 'I:4:quinta IV:4:quinta iv:4:quinta I:4:quinta', tuyos, {
          contexto: quintas(4),
        }),
      );
    expect(iv('iv I: cadencia plagal menor.')).toBe(true);
    expect(iv('iv(quinta) es un préstamo, de casa en rock.')).toBe(true);
    expect(
      iv('iv I: cadencia plagal menor.', 'I:4:quinta IV:4:quinta iv:4:quinta IV:4:quinta'),
    ).toBe(false);
    // El bVI5 sí es prestado: su La bemol no es de la escala.
    const bVI = diciendo(
      { motivos: ['bVI(quinta) es un préstamo.'] },
      'I:4:quinta IV:4:quinta bVI:4:quinta IV:4:quinta',
      riff,
      {
        contexto: quintas(4),
      },
    );
    expect(quinta.cumple(bVI)).toBe(false);
    // En menor, el III5 tampoco es préstamo.
    const menor = diciendo(
      { motivos: ['III prestado del relativo.'] },
      'i:4:quinta III:4:quinta',
      'i:4:quinta VII:4:quinta',
      { mode: 'minor', contexto: quintas(2) },
    );
    expect(quinta.cumple(menor)).toBe(true);
    // Sin quintas, nada que mirar.
    expect(
      quinta.cumple(diciendo({ nombre: 'Sin sensible, en el 3' }, 'I:4 IV:4 bVII:4 IV:4')),
    ).toBe(false);
  });

  it('«la dominante resuelve» pide un V con sensible, o de quintas', () => {
    const domina = dominanteSinSensible();
    const dice = { motivos: ['V I: la dominante resuelve en la tónica.'] };
    expect(domina.cumple(diciendo(dice, 'I:4 IV:4 V:4:menor I:4'))).toBe(true);
    expect(domina.cumple(diciendo(dice, 'I:4 IV:4 V:4 I:4'))).toBe(false);
    expect(domina.cumple(diciendo(dice, 'I:4 IV:4 V:4:quinta I:4'))).toBe(false);
    // El tuyo, con su especie; y la vuelta del bucle, del último al primero.
    expect(
      domina.cumple(
        diciendo(dice, 'I:4 V:4', 'I:4 V:4', { contexto: { especies: [null, 'menor'] } }),
      ),
    ).toBe(true);
    expect(domina.cumple(diciendo(dice, 'I:4 IV:4 vi:4 V:4'))).toBe(false);
    expect(
      domina.cumple(
        diciendo({ motivos: ['ii V: prepara.', 'bVII I: x.'] }, 'I:4 IV:4 V:4:menor I:4'),
      ),
    ).toBe(false);
  });

  it('«X Y en el N» de los motivos cuenta compases, y la vuelta del bucle también', () => {
    const compas = compasQueNoEsEnLosMotivos();
    const dos = 'I:2 V:2 vi:2 IV:2 ii:2 V:2 I:4';
    const motivo = (m: string, cancion = dos) => compas.cumple(diciendo({ motivos: [m] }, cancion));
    expect(motivo('V I en el 4: cadencia perfecta.')).toBe(false);
    expect(motivo('V I en el 7: cadencia perfecta.')).toBe(true);
    expect(motivo('ii7 V en el 3: llega a lo que preparaba.')).toBe(false);
    expect(motivo('IV por ii en el 3: comparten dos notas.')).toBe(false);
    expect(motivo('IV por ii en el 5: comparten dos notas.')).toBe(true);
    // Detrás del último, tu primer compás o la tónica.
    expect(motivo('IV I en el 2: la vuelta.', 'I:4 IV:4')).toBe(false);
    expect(motivo('IV vi en el 2: la vuelta.', 'I:4 IV:4')).toBe(true);
    expect(motivo('Sin compás.')).toBe(false);
  });

  it('«1 notas», «0 compases»: el número concuerda', () => {
    const plural = pluralDeUno();
    expect(plural.cumple(diciendo({ motivos: ['comparten 1 notas.'] }, POP))).toBe(true);
    expect(plural.cumple(diciendo({ que: 'Mantiene tus 1 compases.' }, POP))).toBe(true);
    expect(plural.cumple(diciendo({ motivos: ['comparten 2 notas; 10 compases.'] }, POP))).toBe(
      false,
    );
  });
});

describe('los predicados del corpus final', () => {
  it('ven el ritmo armónico de lo que se añade, racha a racha', () => {
    const lenta = 'i:4 i:4 VI:4 VI:4';
    const cada = loNuevoCambiaCada(8);
    expect(cada.cumple(continua('i:4 i:4 VII:4 VII:4', lenta))).toBe(true);
    expect(cada.cumple(continua('i:4 VII:4 i:8', lenta))).toBe(false);
    expect(cada.cumple(continua('i:8 iv:8', lenta))).toBe(true);
    expect(cada.cumple(retoca(POP))).toBe(false);
  });

  it('ven un acorde que empieza a mitad de compás y cruza la barra', () => {
    const cruza = cruzaLaBarra();
    expect(cruza.cumple(continua('ii°:2 V:4 i:2', 'i:4'))).toBe(true);
    expect(cruza.cumple(continua('ii°:2 V:2 i:4', 'i:4'))).toBe(false);
  });

  it('no dejan fiarse de lo que se oyó con duda: ni cerrar encima ni citarlo', () => {
    const duda = { dudosos: [false, false, true] };
    const tuyos = 'i:4 VI:4 VII:4';
    const cierra = cierraSobreLoDudoso();
    const cita = citaLoDudosoComoSeguro();
    const llegada = (que: string, nuevos = 'i:4') =>
      diciendo({ que }, nuevos, tuyos, { continuar: true, mode: 'minor', contexto: duda });
    expect(cierra.cumple(llegada(''))).toBe(true);
    expect(cierra.cumple(llegada('', 'i:4 i:4'))).toBe(true);
    expect(cierra.cumple(llegada('', 'VI:4 VII:4 i:4'))).toBe(false);
    expect(cierra.cumple(llegada('', 'VI:4'))).toBe(false);
    expect(cita.cumple(llegada('Añade la llegada: de tu VII a la i.'))).toBe(true);
    expect(cita.cumple(llegada('De tu VII, que se oyó con duda, a la i.'))).toBe(false);
    expect(cita.cumple(llegada('De tu VI a la i.'))).toBe(false);
    // Si la salida lo cambia, ya no se apoya en él.
    expect(
      cierra.cumple(
        diciendo({}, 'i:4 VI:4 V:4 i:4', tuyos, {
          mode: 'minor',
          contexto: { dudosos: [false, false, true, false] },
        }),
      ),
    ).toBe(false);
  });

  it('el compás 1 se queda si abre la frase, y no si es la predominante', () => {
    const quieto = cambiaElCompasQueAbre();
    expect(quieto.dice).toContain('que abre la frase');
    expect(quieto.cumple(retoca('vi:4 V:4 vi:4 IV:4'))).toBe(true);
    // La predominante de un `IV V I I` sí se cambia.
    expect(quieto.cumple(retoca('ii:4 V:4 I:4 I:4', 'IV:4 V:4 I:4 I:4'))).toBe(false);
    // Salvo que sea el centro de un vaivén: `ii V ii V` es dórico, y su ii es la casa.
    expect(quieto.cumple(retoca('IV:4 V:4 ii:4 V:4', 'ii:4 V:4 ii:4 V:4'))).toBe(true);
    expect(quieto.cumple(retoca('IV:4 V:4 ii:4 IV:4', 'ii:4 V:4 ii:4 IV:4'))).toBe(false);
  });
});

// --- El corpus, que es un dato y se comprueba como tal ------------------------

describe('el corpus', () => {
  it('no repite casos', () => {
    expect(new Set(CORPUS.map((caso) => caso.id)).size).toBe(CORPUS.length);
  });

  it('solo usa grados que existen en su modo, con pulsos y especies alineados', () => {
    for (const caso of CORPUS) {
      const validos = degreesFor(caso.mode);
      for (const paso of caso.compases) {
        expect(validos, caso.id).toContain(paso.degree);
        expect(paso.beats, caso.id).toBeGreaterThan(0);
      }
      if (caso.contexto.especies !== undefined) {
        expect(caso.contexto.especies, caso.id).toHaveLength(caso.compases.length);
      }
    }
  });

  it('espera algo de cada caso al continuar', () => {
    for (const caso of CORPUS) {
      expect(caso.continuar.debe.length + caso.continuar.noDebe.length, caso.id).toBeGreaterThan(0);
    }
  });
});

// --- La nota ---------------------------------------------------------------------

describe('la nota de un caso', () => {
  const caso = CORPUS.find((c) => c.id === 'jazz-turnaround')!;
  const suya = 'I:4 vi:4 ii:4 V:4';
  const seguir = (nuevos: string) =>
    salida('seguir', [
      { name: 'Lo que llevas', yours: true, steps: en(suya) },
      { name: 'Cierre', yours: false, steps: en(nuevos) },
    ]);

  it('no examina lo que no se esperaba', () => {
    const sinRetocar = CORPUS.find((c) => c.retocar === undefined)!;
    expect(examinarCaso(sinRetocar, 'retocar', [])).toBeNull();
  });

  it('suspende el debe y la primera si no hay nada que examinar, y aprueba el noDebe', () => {
    const nota = examinarCaso(caso, 'continuar', [])!;
    expect(nota.incumplidas.map((i) => i.donde)).toEqual(['debe', 'debe', 'primera']);
    expect(nota.cumplidas).toBe(nota.total - 3);
  });

  it('dice qué salidas hacen lo que no debían', () => {
    // V→vi de primeras, y siete compases nuevos: once en total.
    const mala = seguir('vi:4 IV:4 iv:4 bVII:4 bVI:4 bVII:4 I:4');
    const nota = examinarCaso(caso, 'continuar', [mala])!;
    expect(nota.incumplidas).toContainEqual({
      donde: 'primera',
      dice: 'la primera va de V a vi',
      culpables: [1],
    });
    expect(nota.incumplidas).toContainEqual({
      donde: 'noDebe',
      dice: 'deja la frase coja: un número impar de compases',
      culpables: [1],
    });
    expect(claveDe(nota)).toBe('jazz-turnaround:continuar');
    expect(grupoDe(nota)).toBe('acaba-en-V');
    expect(enGrados(caso, 'continuar', mala)).toBe(
      'seguir: vi/4 IV/4 iv/4 bVII/4 bVI/4 bVII/4 I/4',
    );

    const texto = informe([nota], ['cabecera']);
    expect(texto).toContain('cabecera');
    expect(texto).toContain('MAL  jazz-turnaround:continuar');
    expect(texto).toContain('noDebe: deja la frase coja: un número impar de compases (la 1)');
    // Lo que no cuenta para el debe sale sin asterisco.
    const conMenu = examinarCaso(caso, 'continuar', [], [mala])!;
    expect(informe([conMenu])).toContain('    1. seguir');
    expect(grupoDe(examinarCaso(caso, 'retocar', [])!)).toBe('retocar');
  });

  it('cuenta las especies y lo que sale bien', () => {
    const buena = seguir('I:4:major7');
    const nota = examinarCaso(caso, 'continuar', [buena])!;
    expect(nota.incumplidas).toEqual([]);
    expect(enGrados(caso, 'continuar', buena)).toBe('seguir: I(major7)/4');
    expect(informe([nota])).toContain('BIEN jazz-turnaround:continuar');
    expect(enGrados(caso, 'retocar', salida('rearmonizar', buena.secciones.slice(0, 1)))).toBe(
      'rearmonizar: I/4 vi/4 ii/4 V/4',
    );
  });

  it('da un diez a nada que examinar', () => {
    expect(notaDe([])).toBe(1);
    expect(cifras([])).toEqual({ cumplidas: 0, total: 0, aprobados: 0, casos: 0 });
    expect(informe([])).toContain('0/0 expectativas (100 %)');
  });
});

// --- El examen ---------------------------------------------------------------

/** Cada caso por las dos peticiones, como lo construiría la ruta. */
function examinarElCorpus(corpus: readonly CasoDelCorpus[] = CORPUS): NotaDeUnCaso[] {
  const notas: NotaDeUnCaso[] = [];
  for (const caso of corpus) {
    for (const kind of ['continuar', 'retocar'] as const satisfies readonly PathKind[]) {
      const menu = salidasPosibles(caso.mode, kind, caso.compases, caso.contexto);
      const nota = examinarCaso(caso, kind, menu.slice(0, PRIMERAS), menu);
      if (nota !== null) {
        notas.push(nota);
      }
    }
  }
  return notas;
}

describe('el examen de las salidas', () => {
  const notas = examinarElCorpus();
  const nota = notaDe(notas);
  writeFileSync(
    INFORME,
    informe(notas, [
      `Examen de las salidas del dominio: ${CORPUS.length} casos, nota mínima ${NOTA_MINIMA}.`,
      `Debe: alguna de las ${PRIMERAS} primeras (con *). No debe: ninguna del menú.`,
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

  it('examina todos los casos al continuar', () => {
    expect(notas.filter((n) => n.kind === 'continuar')).toHaveLength(CORPUS.length);
  });
});

// --- Con su estilo -----------------------------------------------------------

/**
 * **Los que se escribieron con un giro sin estilo, examinados con el suyo** ahora que
 * `styles.ts` lo tiene: el bolero en mayor y en menor y la andaluza. Mismo caso y
 * mismas expectativas del arreglista (`conSuEstilo`).
 *
 * Medido el 5 de octubre de 2026 a las 11:25, al añadir los seis estilos: **los seis
 * menús enteros**. No pueden volver a fallar.
 */
const YA_NO_PUEDEN_FALLAR_CON_SU_ESTILO: readonly string[] = [
  'bolero-menor/bolero:continuar',
  'bolero-menor/bolero:retocar',
  'bolero-mayor/bolero:continuar',
  'bolero-mayor/bolero:retocar',
  'andaluza/flamenco:continuar',
  'andaluza/flamenco:retocar',
];

describe('el examen con su estilo', () => {
  const notas = examinarElCorpus(CORPUS_CON_SU_ESTILO);

  it('son los casos con un giro que ya es estilo, cada uno con el suyo', () => {
    expect(CORPUS_CON_SU_ESTILO.map((caso) => caso.id)).toEqual([
      'bolero-menor/bolero',
      'bolero-mayor/bolero',
      'andaluza/flamenco',
    ]);
    for (const caso of CORPUS_CON_SU_ESTILO) {
      const original = CORPUS.find((otro) => `${otro.id}/${otro.giro!}` === caso.id)!;
      expect(caso.contexto).toEqual({ ...original.contexto, estilo: original.giro });
      expect(caso.continuar).toBe(original.continuar);
    }
    // Un giro que no es estilo —el soul, el punk— no se examina dos veces.
    expect(conSuEstilo([{ id: 'x', giro: 'punk', contexto: {} }])).toEqual([]);
  });

  it('no vuelve a suspender lo que ya aprobó', () => {
    expect(notas).toHaveLength(YA_NO_PUEDEN_FALLAR_CON_SU_ESTILO.length);
    for (const clave of YA_NO_PUEDEN_FALLAR_CON_SU_ESTILO) {
      const suya = notas.find((n) => claveDe(n) === clave);
      expect(suya, `${clave} no está en el corpus`).toBeDefined();
      expect(suya!.incumplidas, clave).toEqual([]);
    }
  });
});
