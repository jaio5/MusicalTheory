/**
 * Lo que vale cada giro: el precio de un grado y de un salto en tu idioma.
 *
 * Quien busca caminos (`busqueda.ts`) y cada camino ordenan con esta vara, que no
 * es la del juez: aquí se decide qué merece construirse, y el juez decide después
 * qué encaja de lo construido.
 */
import type { EspecieDeBloque } from '../chords';
import type { KeyMode } from '../keys';
import { resolveDegree, type DegreeSymbol } from '../progressions';
import type { StyleId } from '../styles';
import { colorDelGrado } from './colores';
import {
  esFuncional,
  esPrestado,
  LARGO_DE_UNA_FRASE,
  notasDelAcorde,
  PESO_NEUTRO,
  type Idioma,
} from './idioma';
import { bVIIDeLaCasa, sensibleDelCentro } from './juez/juicio';
import { applyMove } from './movimientos';
import { saltosDe } from './validar';

/**
 * Lo que cuesta, o lo que suma, meter un grado que no estaba en lo tuyo.
 *
 * **Es lo que hace que el color dependa del estilo**, y con la misma vara para el
 * préstamo que para la dominante secundaria: el peso de `STYLES` contra el neutro.
 * Antes el desempate premiaba la novedad, y lo más nuevo siempre era lo prestado:
 * el 87 % de los puentes en mayor llevaban iv, bVII o bVI, también en un jazz, un
 * folk o un bolero. Se corrigió haciendo que el préstamo **siempre** costara —lo
 * máximo que podía valer era cero— mientras la secundaria sumaba por encima de
 * 0,4: el pop se quedó sin un préstamo y con secundarias en el 87 % del menú.
 * Ahora cuesta lo que el estilo no lo usa, suma lo que lo usa, y lo que ya tocas
 * no cuesta nada: si tu canción ya habla con el bVII, seguir con él es tu idioma.
 */
/**
 * Del peso de una familia en el estilo a lo que suma o cuesta meterla. **Suma un
 * sexto de lo que cuesta**: que un estilo admita un color no quiere decir que lo
 * busque —un rock sigue siendo sobre todo tríadas de la escala—. Con la misma
 * pendiente a los dos lados el rock acababa con un préstamo en nueve de cada diez
 * salidas, que es el 87 % de antes con otro nombre; así queda en seis de cada
 * diez, el metal en siete, y el pop, el folk y la canción sin estilo entre dos y
 * tres, que es el orden de `STYLES`.
 */
function precioDelPeso(peso: number): number {
  const distancia = peso - PESO_NEUTRO;
  return distancia * (distancia > 0 ? 0.2 : 1.2);
}

export function precioDelGrado(id: Idioma, degree: DegreeSymbol): number {
  // Lo que trae la sensible en una canción que eligió no tenerla: el V, y también
  // el vii°, el iii de mayor y cualquier dominante secundaria, que lleva la de su
  // destino. Va antes que lo tuyo: que la toques una vez de paso no quiere decir
  // que lo nuevo pueda volver a meterla. Es lo mismo que mira el juez.
  if (id.modales.length > 0 && traeLaSensible(id.mode, degree)) {
    return -3;
  }
  // Lo tuyo que solo se oyó con duda no es tuyo todavía: volver a apoyarse en ello es
  // construir sobre algo que no se sabe (el arreglista lo tachó en `I iii? vi IV`).
  // Si toda la toma es dudosa, no hay nada seguro que preferir, y no cuenta.
  if (!id.tomaDudosa && id.soloConDuda.has(degree)) {
    return PRECIO_DE_OTRO_IDIOMA;
  }
  if (id.tuyos.has(degree)) {
    return 0;
  }
  if (esDeOtraCasa(id, degree)) {
    return PRECIO_DE_OTRO_IDIOMA;
  }
  // Y el V con su sensible en una canción que llega a casa por su color
  // (`Idioma.cadenciaPropia`): cabe, pero suena a otra música —«a todo trapo», dijo
  // el arreglista de un reggae—, y cuesta lo que una familia que tu estilo no usa. En
  // quintas no lleva tercera, y no trae nada.
  if (degree === 'V' && id.cadenciaPropia !== null && id.lenguaje !== 'quintas') {
    return precioDelPeso(0);
  }
  if (degree.includes('/')) {
    // En quintas no hay dominante secundaria: sin tercera ni séptima, un D5 en Do es
    // el ii con otro nombre. Que no se meta.
    if (id.lenguaje === 'quintas') {
      return -3;
    }
    // Y la que trae **dos notas de fuera** de la escala ya no es un color: es otro
    // tono. En mayor es la del iii —el Si7 en Do, con su Re# y su Fa#—, la más lejana
    // de las cuatro y la que el arreglista tachó en un pop, un funk y uno de cine;
    // las demás traen una. Fuera del jazz y del bolero, que viven de cadenas de
    // dominantes, cuesta lo que una familia que el estilo no usa.
    const lejana = id.mode === 'major' && notasDeFuera(degree) >= 2 && !esFuncional(id);
    return lejana ? precioDelPeso(0) + precioDelPeso(id.secundaria) : precioDelPeso(id.secundaria);
  }
  if (degree === 'bII') {
    return -(1 - Math.max(id.tritono, id.napolitano)) * 1.2;
  }
  if (esPrestado(id.mode, degree)) {
    return precioDelPeso(id.prestamo);
  }
  if (degree === 'v' && id.tuyos.has('V')) {
    return -1.5;
  }
  // El vii° suelto es de coral y de jazz: lo que cueste lo dice el peso de los
  // disminuidos en el estilo. El ii° del menor es la subdominante de siempre…
  if (degree === 'vii°') {
    return Math.min(-0.3, precioDelPeso(id.disminuido));
  }
  return degree === 'ii°' ? -0.3 : 0;
}

/** Las notas de la escala de cada modo, en semitonos sobre la tónica. */
const ESCALA_DEL_MODO: Readonly<Record<KeyMode, ReadonlySet<number>>> = {
  major: new Set([0, 2, 4, 5, 7, 9, 11]),
  minor: new Set([0, 2, 3, 5, 7, 8, 10]),
};

/**
 * Si la quinta de un grado —su fundamental y su quinta, sin tercera— cae entera en
 * la escala: entonces, en quintas, ese grado suena igual que el de la escala con
 * la misma fundamental, y lo que lo hacía prestado era la tercera que no lleva.
 */
export function quintaDeLaEscala(mode: KeyMode, degree: DegreeSymbol): boolean {
  const { root } = resolveDegree(0, mode, degree);
  return ESCALA_DEL_MODO[mode].has(root) && ESCALA_DEL_MODO[mode].has((root + 7) % 12);
}

/** Cuántas notas de un grado en mayor caen fuera de la escala mayor. */
function notasDeFuera(degree: DegreeSymbol): number {
  const escala = new Set([0, 2, 4, 5, 7, 9, 11]);
  return resolveDegree(0, 'major', degree).notes.filter((nota) => !escala.has(nota)).length;
}

/**
 * Si un grado que no tocas es **de otra casa** que la de tu canción, aunque el estilo
 * lo admita (`PRECIO_DE_OTRO_IDIOMA`). Cada una es la casa de un idioma que lo tuyo
 * ya ha elegido:
 *
 * - **Funcional** (`Idioma.funcional`): el bVII, el VII y los demás grados de la
 *   mezcla con el otro modo —el bIII, el bVI—. El color de un bolero o de una cadena
 *   de secundarias es la dominante que llega, no la escalera del rock, y el
 *   arreglista los tachó en las dos. El iv no: el `IV iv I` es cadencia de gospel,
 *   de soul y de jazz.
 * - **De dominantes**, el de un blues o un funk (`deOtraGama`).
 * - **De la mezcla con el menor** (`Idioma.mezcla`): la dominante secundaria y el ii
 *   que prepara el V, que son la casa del mayor de manual, y el iii y el vi, que en
 *   esa mezcla suenan con su gemelo prestado —el bIII, el bVI—. El arreglista no dio
 *   ni uno en las tres de cine, y tachó los primeros.
 * - **Un folk que no toca préstamos oscuros** (`oscuroDeOtraCasa`).
 * - **Un menor sin sensible**: la ii° en tríada (`laIiEsDeCasa`).
 * - **Una toma que se oyó con duda** (`Idioma.tomaDudosa`): todo color —un préstamo,
 *   una secundaria, el napolitano, el vii°—. Sobre lo que no se sabe, lo seguro: los
 *   acordes de la escala valen para lo que fuera que sonó.
 * - **Un vamp modal** (`Idioma.centroModal`): lo que trae la sensible de su centro
 *   —el A7 en un dórico sobre Re—, que lo vuelve un menor de manual. La misma vara
 *   del juez (`sensibleDelCentro`).
 */
function esDeOtraCasa(id: Idioma, degree: DegreeSymbol): boolean {
  return (
    (id.funcional && MEZCLA.has(degree)) ||
    deOtraGama(id, degree) ||
    (id.mezcla && (degree.includes('/') || ['ii', 'iii', 'vi'].includes(degree))) ||
    (esPrestado(id.mode, degree) && oscuroDeOtraCasa(id, degree)) ||
    (degree === 'ii°' && !laIiEsDeCasa(id)) ||
    (id.tomaDudosa && (degree === 'vii°' || colorDelGrado(id.mode, degree, null) !== null)) ||
    traeLaSensibleDelCentro(id, degree)
  );
}

/**
 * Si un grado trae **la sensible del centro de tu vamp modal**, y tu vamp no la tenía:
 * el A7 en un dórico sobre Re (`sensibleDelCentro`, la vara del juez). Si alguno de
 * tus acordes ya la lleva, es tuya.
 */
function traeLaSensibleDelCentro(id: Idioma, degree: DegreeSymbol): boolean {
  if (id.centroModal === null) {
    return false;
  }
  const suya = sensibleDelCentro(id.mode, id.centroModal);
  const laTenia = [...id.tuyos].some((grado) => notasDelAcorde(id.mode, grado, null).has(suya));
  return !laTenia && notasDelAcorde(id.mode, degree, null).has(suya);
}

/**
 * Si la ii° es de tu menor: la subdominante que va al V con sensible, `ii° V i`.
 *
 * Es la del menor armónico, y en tríada **solo suena a casa donde está el V**: en
 * un menor natural —`i VI III VII`, un vaivén `i VII`, `i v VI III`— una tríada
 * disminuida es un acorde de coral metido en una canción que eligió no tener
 * sensible. El arreglista la tachó en seis menús de cine, funk, reggae, pop y
 * cantautor, y la pidió en los tres que ya tocaban el V: cambiar el iv por la ii°
 * delante de él es el cambio de casa del menor. Con séptima es otra cosa: la iiø7
 * es la del jazz y del bolero, y ahí se toca con cualquier dominante.
 */
export function laIiEsDeCasa(id: Idioma): boolean {
  return id.tuyos.has('V') || id.tuyos.has('ii°') || id.lenguaje === 'septimas' || id.dominantes;
}

/**
 * Si cambiar un acorde tuyo con séptima de dominante por ese grado **le quita la
 * gama** al idioma de dominantes: el IV7 de un funk cambiado por su relativo, el ii7,
 * pierde la séptima —el Mib en Do, la tercera de blues de la tonalidad— que es lo
 * que hace sonar el funk a funk. Lo tachó el arreglista en los dos menús.
 */
export function pierdeLaGama(
  id: Idioma,
  especie: EspecieDeBloque | null,
  destino: DegreeSymbol,
): boolean {
  return enDominantes(id) && especie === 'dominant7' && ['ii', 'iii', 'vi'].includes(destino);
}

/**
 * Si un préstamo es **del menor y no del estilo**: el iv, el bVI o el bIII en un
 * estilo que cierra sin sensible con su bVII (`bVIIDeLaCasa`, la misma vara del
 * juez) y que pesa el préstamo por debajo de lo corriente —el folk—, en una canción
 * que no toca ninguno.
 *
 * En ese estilo lo prestado que se usa es el bVII, el mixolidio de la gaita; el peso
 * de `STYLES` es el suyo, y con él el `IV iv I` del soul y del pop salía en todos los
 * menús de folk. El arreglista lo tachó en los dos de country, que se examinaban como
 * folk. **El country, con su estilo, va más lejos**: tachó también el bVII, así que
 * ahí todo préstamo es de otra casa mientras tu canción no toque ninguno. Si ya
 * tocas uno, es tu color y no cuesta.
 */
function oscuroDeOtraCasa(id: Idioma, degree: DegreeSymbol): boolean {
  // El country no tiene préstamo de casa, ni siquiera el bVII: el iv y el bVII son de
  // vez en cuando, y solo si la canción ya los toca. El arreglista tachó los dos.
  if (id.estilo === 'country') {
    return ![...id.tuyos].some((grado) => esPrestado(id.mode, grado));
  }
  return (
    degree !== 'bVII' &&
    id.estilo !== null &&
    bVIIDeLaCasa(id.estilo) &&
    id.prestamo < PESO_NEUTRO &&
    ![...id.tuyos].some((grado) => esPrestado(id.mode, grado) && grado !== 'bVII')
  );
}

/** Los grados de la mezcla con el otro modo que no caben en un idioma funcional. */
const MEZCLA: ReadonlySet<DegreeSymbol> = new Set(['bIII', 'bVI', 'bVII', 'VII']);

/** Si tu canción vive en el idioma de dominantes de un blues o un funk, en mayor. */
function enDominantes(id: Idioma): boolean {
  return id.mode === 'major' && (id.dominantes || deDominantes(id)) && !esFuncional(id);
}

/** Los estilos del idioma de dominantes: todo con séptima menor, I7, IV7 y V7. */
export function deDominantes(id: Pick<Idioma, 'estilo'>): boolean {
  return id.estilo === 'blues' || id.estilo === 'funk';
}

/**
 * Los estilos en los que **la dominante puede quedarse sin resolver**: el `V IV` del
 * blues, la dominante que vuelve al vamp en el funk y el ir y venir del reggae.
 */
export function vuelveDeLaDominante(id: Pick<Idioma, 'estilo'>): boolean {
  return deDominantes(id) || id.estilo === 'reggae';
}

/**
 * Si un grado es **de otra gama** que la del idioma de dominantes (`enDominantes`).
 *
 * La de un blues o un funk es la mixolidia con la tercera de blues: el I7, el IV7, el
 * V7, el bVII7, el bIII. Los menores de tónica de la escala de manual —el vi y el
 * iii— son otra música, y el bVI tampoco está: la sexta menor no es de esa gama (el
 * arreglista los tachó en un funk y en un blues de dos coros). **El ii, según**: el
 * `ii7 V7 I7` de un funk lo da él por bueno, y en un blues con su estilo el ii–V es
 * el del jazz, que tachó en dos.
 */
export function deOtraGama(id: Idioma, degree: DegreeSymbol): boolean {
  return (
    enDominantes(id) &&
    (['iii', 'vi', 'bVI'].includes(degree) || (degree === 'ii' && id.estilo === 'blues'))
  );
}

/** Si lo tuyo es un menor que llega con la sensible: toca el V y ni la v ni el VII. */
function eligioLaSensible(id: Idioma): boolean {
  return id.mode === 'minor' && id.tuyos.has('V') && !id.tuyos.has('v') && !id.tuyos.has('VII');
}

/** Si un grado trae la sensible de la tonalidad, o la de otro sitio. */
function traeLaSensible(mode: KeyMode, degree: DegreeSymbol): boolean {
  return degree.includes('/') || resolveDegree(0, mode, degree).notes.includes(11);
}

/**
 * Lo que vale ir de un grado a otro: el peso del grafo, con dos matices. Quedarse
 * es legítimo pero no avanza —salvo alargar la dominante, que es un recurso—, y
 * volver de la dominante a la subdominante es el idioma del blues y una
 * retrogresión en lo demás.
 */
export function valorDelSalto(id: Idioma, de: DegreeSymbol, a: DegreeSymbol): number {
  if (de === a) {
    return de === 'V' ? -0.2 : -0.6;
  }
  // Llegar a casa sin sensible en un menor que eligió el V con ella —sin la v ni el
  // VII— es cambiarle el modo: lo mismo que meterla donde no la quieren, al revés.
  if (a === id.tonica && (de === 'VII' || de === 'v') && eligioLaSensible(id)) {
    return -3;
  }
  // Solo se pregunta por saltos que salen del grafo: los caminos se buscan en él.
  const peso = saltosDe(id.mode, de).find((move) => move.to === a)!.weight;
  return (
    peso -
    (retrocede(de, a) && !vuelveDeLaDominante(id) ? 0.5 : 0) -
    (promesaRota(id.mode, de, a) ? 1 : 0) +
    cadena(id, de, a)
  );
}

/**
 * Si una dominante secundaria **no llega a lo que prepara**: el III7 que cae en el IV
 * —la rota de la relativa— o el VI7 que se salta su ii y va al V. El grafo los
 * conoce, y existen; pero el juez los cuenta como lo que son, una promesa sin
 * cumplir, y el arreglista los tachó en todos los menús en que salieron. Llega si el
 * bajo cae una quinta —a lo suyo, o a la siguiente dominante de una cadena— o un
 * semitono, que es su sustituto.
 */
function promesaRota(mode: KeyMode, de: DegreeSymbol, a: DegreeSymbol): boolean {
  if (!de.includes('/')) {
    return false;
  }
  const baja = (resolveDegree(0, mode, de).root - resolveDegree(0, mode, a).root + 12) % 12;
  return baja !== 7 && baja !== 1;
}

/**
 * Lo que suma una cadena de dominantes —una que resuelve en otra dominante,
 * `V/vi V/ii V/V V`— en el estilo que vive de ellas.
 *
 * El grafo les da poco peso porque en el repertorio de a diario son raras, y con
 * eso un jazz no recibía nunca el puente del rhythm changes: salían puentes de
 * pop. Suma lo que el estilo usa las dominantes secundarias por encima de lo
 * corriente, y nada donde no las usa.
 */
function cadena(id: Idioma, de: DegreeSymbol, a: DegreeSymbol): number {
  const resuelveEnDominante =
    de.includes('/') && (a.includes('/') || a === 'V') && esSuDominante(id, de, a);
  // El country usa **una** secundaria, el II7 delante del V, y no la cadena: el
  // arreglista tachó `V/ii V/V V` como jazz en un country.
  const encadena = id.estilo !== 'country' || a === 'V';
  return resuelveEnDominante && encadena ? Math.max(0, id.secundaria - PESO_NEUTRO) : 0;
}

/** Si el salto vuelve de la dominante a la subdominante: `V IV`, `V ii`. */
export function retrocede(de: DegreeSymbol, a: DegreeSymbol): boolean {
  return de === 'V' && (a === 'IV' || a === 'ii' || a === 'iv' || a === 'ii°');
}

/**
 * Los estilos en los que volver de la dominante no se hace: el juez lo descarta
 * (`juez/`), así que construirlo es gastar un sitio del menú en algo que no va
 * a entrar. Y con una canción larga eso era quedarse sin menú.
 */
export const SIN_RETROGRESION: ReadonlySet<StyleId> = new Set(['jazz', 'folk', 'bolero']);

/**
 * Cuánto prepara la llegada a la tónica el acorde que va justo antes.
 *
 * **El bVII ya no vale lo que el V**, que es lo que pasaba cuando esto miraba el
 * papel armónico y los dos eran «dominante»: aquí el V aprieta con la sensible y
 * el bVII llega sin ella, y lo que valga el bVII lo dice el estilo —en un rock casi
 * lo mismo, en un jazz poco— y si tu canción ya es mixolidia.
 */
export function fuerzaDeCadencia(id: Idioma, penultimo: DegreeSymbol): number {
  switch (penultimo) {
    case 'V':
      // Con tu cadencia propia, el V y la tuya se cambian los papeles.
      return id.modales.length > 0 ? 0.2 : id.cadenciaPropia !== null ? 0.8 : 1.3;
    case 'vii°':
      // Cerrar con el vii° en tríada es de coral: en un pop, un rock o un folk se
      // cierra con el V. Vale lo que el estilo use los disminuidos, y sin estilo
      // casi nada, que neutro es no premiar lo raro.
      return 0.2 + id.disminuido;
    case 'v':
      return id.modales.includes('v') ? 1 : 0.6;
    case 'bII':
      return 0.3 + Math.max(id.tritono, id.napolitano) + (id.modales.includes('bII') ? 0.3 : 0);
    case 'bVII':
      return 0.3 + id.prestamo * 0.8 + (id.mixolidio ? 0.5 : 0);
    case 'VII':
      return id.cadenciaPropia === 'VII' ? 1.3 : esFuncional(id) ? 0.4 : 0.8;
    case 'IV':
    case 'iv':
      // La vuelta del IV a casa es el idioma del blues, del funk y del country.
      return id.cadenciaPropia === penultimo
        ? 1.3
        : deDominantes(id) || id.estilo === 'country'
          ? 0.9
          : 0.7;
    default:
      return 0;
  }
}

/** Lo que suma lo que va antes de la cadencia: el ii del ii–V–I, el bVI del bVI–bVII–I. */
function preparacion(id: Idioma, ante: DegreeSymbol | null, penultimo: DegreeSymbol): number {
  return preparacionDeManual(id, ante, penultimo) + (esTuFirma(id, ante, penultimo) ? 0.3 : 0);
}

/**
 * Si `ante penultimo` es **la llegada de tu canción** cuando llega a casa por su
 * color —el `bVI bVII` de `I bVI bVII I`, el `VI VII` de un eólico—: en ese idioma la
 * cadencia de la canción es su firma, y cerrar con ella entera cierra como cierra
 * ella. «bVI bVII I otra vez» es una de las tres respuestas del arreglista; sin
 * esto, la escalera perdía por poco contra `IV iv bVII I`, que llega al mismo bVII
 * por otro sitio. Con la dominante no hace falta: la perfecta ya es la fuerte.
 */
function esTuFirma(id: Idioma, ante: DegreeSymbol | null, penultimo: DegreeSymbol): boolean {
  return (
    id.suLlegada !== null &&
    (id.modales.length > 0 || id.cadenciaPropia !== null || id.mezcla) &&
    penultimo === id.suLlegada.llega &&
    ante === id.suLlegada.antes
  );
}

function preparacionDeManual(
  id: Idioma,
  ante: DegreeSymbol | null,
  penultimo: DegreeSymbol,
): number {
  if (penultimo === 'V' && (ante === 'ii' || ante === 'ii°')) {
    // El ii–V es la célula del jazz y del bolero; en un blues es otro idioma, que
    // llega por el IV.
    return esFuncional(id) ? 0.8 : id.estilo === 'blues' ? -0.4 : 0.5;
  }
  // El II7 delante del V es la firma del country.
  if (penultimo === 'V' && ante === 'V/V' && id.estilo === 'country') {
    return 0.7;
  }
  if (penultimo === 'V' && ['IV', 'iv', 'V/V', 'bVI', 'bII'].includes(ante ?? '')) {
    return 0.4;
  }
  if (penultimo === 'bII' && ante === 'ii') {
    return 0.5;
  }
  if (
    (penultimo === 'bVII' || penultimo === 'VII') &&
    ['bVI', 'VI', 'IV', 'iv'].includes(ante ?? '')
  ) {
    return 0.4;
  }
  return penultimo === 'iv' && ante === 'IV' ? 0.3 : 0;
}

export function media(valores: readonly number[]): number {
  return valores.reduce((total, valor) => total + valor, 0) / valores.length;
}

/** Los saltos de un camino que sale de `desde`, ya valorados. Solo se llama con caminos del grafo. */
export function saltosDelCamino(
  id: Idioma,
  desde: DegreeSymbol,
  grados: readonly DegreeSymbol[],
): number[] {
  return grados.map((grado, i) => valorDelSalto(id, i === 0 ? desde : grados[i - 1]!, grado));
}

/** Lo que cuestan los grados nuevos de un camino, cada uno una vez. */
export function precioDelCamino(id: Idioma, grados: readonly DegreeSymbol[]): number {
  return [...new Set(grados)].reduce((total, grado) => total + precioDelGrado(id, grado), 0);
}

/**
 * Lo que vale un cierre: lo bien que se encadena, lo que cuesta en su estilo y,
 * sobre todo, **cómo llega a la tónica**. Con la media de los saltos y no la suma,
 * para que un camino largo no gane por largo.
 */
export function valorDeCierre(
  id: Idioma,
  antes: DegreeSymbol | null,
  desde: DegreeSymbol,
  grados: readonly DegreeSymbol[],
): number {
  const todos = [desde, ...grados];
  const penultimo = todos.at(-2)!;
  const ante = todos.length >= 3 ? todos.at(-3)! : antes;
  return (
    media(saltosDelCamino(id, desde, grados)) +
    precioDelCamino(id, grados) +
    fuerzaDeCadencia(id, penultimo) +
    preparacion(id, ante, penultimo) +
    resolucion(id, desde, grados)
  );
}

/**
 * Si el cierre resuelve la dominante de la que sale.
 *
 * Un V pide la tónica **ya**. Antes se medía solo cómo se llegaba al final, y desde
 * un V ganaban cierres que se iban antes de volver —`V → vi IV I`, y en la
 * andaluza `V → VI VII i`—: llegaban bien, pero dejaban la dominante sin resolver.
 * En el blues `V IV I` es el idioma, así que ahí cuesta poco.
 */
function resolucion(id: Idioma, desde: DegreeSymbol, grados: readonly DegreeSymbol[]): number {
  // Una dominante secundaria pide lo suyo igual que el V pide la tónica: lo
  // primero de su grafo, u otra dominante de la cadena. Lo demás —su cadencia rota,
  // como mucho— se construye, pero detrás.
  if (desde.includes('/')) {
    const suyo = saltosDe(id.mode, desde)[0]!.to;
    const primero = grados[0]!;
    return primero === suyo || primero.includes('/') || primero === 'V' ? 0 : -0.4;
  }
  if (desde !== 'V' && desde !== 'vii°') {
    return 0;
  }
  if (grados[0] === id.tonica) {
    return 0.4;
  }
  return grados.length > LARGO_DE_UNA_FRASE ? 0 : vuelveDeLaDominante(id) ? -0.2 : -0.6;
}

/**
 * Lo que vale como poco un grado de otro idioma (`precioDelGrado`): el V en un modo
 * que eligió no tener sensible, el bVII en un bolero, el vi en un funk, una
 * secundaria en música de cine.
 */
export const PRECIO_DE_OTRO_IDIOMA = -1.5;

/** La dominante de un grado: el V de la tónica, o su dominante secundaria si el catálogo la tiene. */
export function esSuDominante(id: Idioma, grado: DegreeSymbol, de: DegreeSymbol): boolean {
  return applyMove(id.mode, de, 'dominante', { siguiente: de }) === grado;
}
