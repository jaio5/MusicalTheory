/**
 * **Si lo que dice una salida de sí misma es verdad en la canción.**
 *
 * Los motivos del juez (`juez/`) y las frases de quien construye las salidas
 * (`salidas/`) hablan de la canción: de un compás —«V i en el 8»—, de un enlace —«IV
 * V/vi: el bajo baja medio tono»—, de un grado —«el ii°»—, del papel —«Lo que sigue,
 * el estribillo, entra en I»— y de la forma —«Un periodo: semicadencia en V en el 4
 * y cierre en el 8»—. Se escribían con plantillas, y una plantilla no mira la
 * canción: el quinto examen encontró «la dominante en el 9» en un blues menor con
 * el VI7 en el 9, «el 1, el 5 o el 9 ya no dicen…» con esos tres sin tocar y «un
 * periodo» en un puente seguido de su vuelta.
 *
 * Aquí está **la regla general**, y no una lista de mentiras sueltas: **si el texto
 * nombra un sitio, se mira qué hay en ese sitio.** El compás N se busca en el
 * compás N, contado por pulsos; el enlace X Y se busca donde dice —en el compás N,
 * en la vuelta del bucle o en la vuelta a tu principio—, y si dice adónde llega
 * («resuelve en la tónica», «da su relativa»), se mira adónde llega; un grado
 * nombrado tiene que sonar o haber sonado; el papel del que se habla tiene que ser
 * el tuyo, y lo que se dice de la parte nueva, de la parte nueva; y una forma
 * nombrada, estar.
 *
 * Lo usan dos: el test que recorre miles de salidas (`lo-que-dice.test.ts`) —que
 * ninguna diga nada falso— y el validador de lo que escribe el modelo
 * (`features/salidas/contract.ts`), que con esto comprueba **cada frase en el sitio
 * que nombra** en vez de comparar «resuelve en la tónica» con el final de toda la
 * canción.
 *
 * **Lee grados, no acordes.** Quien tenga acordes —el validador— los traduce antes.
 * Y prefiere aceptar de menos a rechazar de más en lo que no sabe leer: una frase
 * sin sitio nombrado no se comprueba aquí.
 */

import type { EspecieDeBloque } from '../chords';
import { roleOfDegreeSymbol } from '../harmonic-function';
import type { KeyMode } from '../keys';
import { resolveDegree, type DegreeSymbol } from '../progressions';
import type { SectionRole } from '../song';
import { STYLE_IDS, type StyleId } from '../styles';
import type { ContextoDeSalidas } from './contexto';
import { compasesDe, formasDe } from './formas';
import type { PathKind, PathStep, SalidaPosible } from './tipos';
import { tonicaDe } from './tonica';

/** Un compás de la canción de la que se habla. */
export interface PasoDicho {
  readonly degree: DegreeSymbol;
  readonly beats: number;
  readonly especie?: EspecieDeBloque | null;
}

/** Lo que hay en la canción: lo que hace falta para saber si una frase es verdad. */
export interface LoQueHay {
  readonly mode: KeyMode;
  readonly kind: PathKind;
  readonly pulsosPorCompas: number;
  /** Lo tuyo, como lo tocas. */
  readonly tuyos: readonly PasoDicho[];
  /** La canción entera tal como queda: al continuar, lo tuyo y detrás lo nuevo. */
  readonly cancion: readonly PasoDicho[];
  /** El papel de tu parte, si lo dice. */
  readonly papel?: SectionRole;
  /** Lo que se oyó con duda, compás a compás de lo tuyo. */
  readonly dudosos?: readonly boolean[];
  /** Al continuar, cómo se llaman las partes que se añaden: «Estribillo», «Cierre». */
  readonly partesNuevas?: readonly string[];
  /** El estilo elegido: lo que se dice «del flamenco» solo vale con el flamenco. */
  readonly estilo?: StyleId;
}

/** Un grado escrito, con la especie pegada si la lleva: `V/ii7`, `iv7`, `I5`, `IV(dominant7)`. */
const GRADO =
  /(?<![\p{L}/#\d])(b?(?:VII|VI|IV|III|II|V|I|vii|vi|iv|iii|ii|v|i)°?(?:\/(?:ii|iii|iv|vi|V))?)(?:maj7|m7|∅7|7|5|\([A-Za-z0-9]+\))?(?![\p{L}\d°/])/gu;

/** Lo mismo, entero y solo: para leer un trozo que tiene que ser un grado. */
const UN_GRADO = new RegExp(`^${GRADO.source}$`, 'u');

/**
 * Los nombres de músico de las secundarias: el II7 del country es el V/V, el VI7
 * de un blues de jazz es el V/ii. **Solo en mayor**, donde esos grados en
 * mayúscula no existen de otra manera; en menor el VI y el III son los suyos, y el
 * II mayor sigue siendo la dominante de la dominante.
 */
const ALIAS: Readonly<Record<KeyMode, Readonly<Record<string, DegreeSymbol>>>> = {
  major: { II: 'V/V', III: 'V/vi', VI: 'V/ii', VII: 'V/iii' },
  minor: { II: 'V/V' },
};

/**
 * El grado que dice un trozo de texto, sin la especie ni la puntuación de detrás;
 * nulo si no es un grado. Con el modo, los nombres de músico se leen como el grado
 * que son (`ALIAS`).
 */
export function gradoDicho(texto: string, mode?: KeyMode): DegreeSymbol | null {
  const leido = UN_GRADO.exec(texto.replace(/[,:.;]+$/u, ''));
  if (leido === null) {
    return null;
  }
  const grado = leido[1]!;
  return (mode === undefined ? undefined : ALIAS[mode][grado]) ?? (grado as DegreeSymbol);
}

/** Dónde empieza cada paso, en pulsos desde el primero. */
function inicios(pasos: readonly PasoDicho[]): number[] {
  let pulso = 0;
  return pasos.map((paso) => {
    const inicio = pulso;
    pulso += paso.beats;
    return inicio;
  });
}

/** Cuántos compases dura, contados por pulsos. */
function compases(hay: LoQueHay, pasos: readonly PasoDicho[]): number {
  return pasos.reduce((suma, paso) => suma + paso.beats, 0) / hay.pulsosPorCompas;
}

/** Los grados que suenan en el compás `n` (desde uno), en orden. */
function enElCompas(hay: LoQueHay, pasos: readonly PasoDicho[], n: number): DegreeSymbol[] {
  const pc = hay.pulsosPorCompas;
  const desde = (n - 1) * pc;
  const hasta = n * pc;
  const empiezan = inicios(pasos);
  return pasos.flatMap((paso, i) =>
    empiezan[i]! < hasta && empiezan[i]! + paso.beats > desde ? [paso.degree] : [],
  );
}

/** Lo que se añade al continuar; al retocar, la canción entera. */
function loNuevo(hay: LoQueHay): readonly PasoDicho[] {
  return hay.kind === 'continuar' ? hay.cancion.slice(hay.tuyos.length) : hay.cancion;
}

/** El último grado de unos pasos. */
function ultimo(pasos: readonly PasoDicho[]): DegreeSymbol | undefined {
  return pasos[pasos.length - 1]?.degree;
}

/** La fundamental de un grado, en semitonos sobre la tónica. */
function raiz(mode: KeyMode, degree: DegreeSymbol): number {
  return resolveDegree(0, mode, degree).root;
}

/** Si el grado tira como dominante: el V, una secundaria o el sustituto tritonal. */
function esDominante(degree: DegreeSymbol): boolean {
  return degree === 'V' || degree.startsWith('V/') || degree === 'vii°';
}

/** La relativa de la tónica, y lo que la cadencia rota da en su lugar. */
function esRelativa(mode: KeyMode, degree: DegreeSymbol): boolean {
  return mode === 'major' ? degree === 'vi' || degree === 'bVI' : degree === 'VI';
}

// --- Los sitios que nombra una frase ------------------------------------------------

/** Un enlace nombrado: de qué grado a cuál, y dónde. */
interface Enlace {
  readonly de: DegreeSymbol;
  readonly a: DegreeSymbol;
  /** Dónde lo sitúa la frase. */
  readonly donde: 'bucle' | 'principio' | { readonly compas: number } | 'suelto';
  /** Lo que dice del enlace: lo que va detrás de los dos puntos. */
  readonly dice: string;
}

/** «Tu bucle vuelve a empezar por V I: …», «Vuelve a tu principio por IV I: …». */
const VUELTA = /^(Tu bucle vuelve a empezar|Vuelve a tu principio) por (\S+) (\S+): (.*)$/su;

/** «V I en el 8: …», «bII i en el 2.5: …», «V/ii ii en el 6: …». */
const EN_EL_COMPAS = /^(\S+) (\S+) en el (\d+(?:\.5)?)(?::|,| prepara| ) ?(.*)$/su;

/** «V I: la dominante resuelve en la tónica.», «E F#, el II mayor: …». */
const SUELTO = /^(\S+) (\S+)(?::|,) (.*)$/su;

/**
 * **El enlace que nombra la frase al empezar**, si nombra alguno. Es la forma en que
 * escriben los motivos del juez, y el validador la reconoce para no leer «resuelve
 * en la tónica» como si hablara del final de la canción: habla de ese enlace.
 */
export function enlaceNombrado(texto: string, mode?: KeyMode): Enlace | null {
  const vuelta = VUELTA.exec(texto);
  if (vuelta !== null) {
    const [de, a] = [gradoDicho(vuelta[2]!, mode), gradoDicho(vuelta[3]!, mode)];
    return de === null || a === null
      ? null
      : {
          de,
          a,
          donde: vuelta[1]!.startsWith('Tu bucle') ? 'bucle' : 'principio',
          dice: vuelta[4]!,
        };
  }
  const enCompas = EN_EL_COMPAS.exec(texto);
  if (enCompas !== null) {
    const [de, a] = [gradoDicho(enCompas[1]!, mode), gradoDicho(enCompas[2]!, mode)];
    if (de !== null && a !== null) {
      return { de, a, donde: { compas: Number(enCompas[3]!) }, dice: enCompas[4]! };
    }
  }
  const suelto = SUELTO.exec(texto);
  if (suelto !== null) {
    const [de, a] = [gradoDicho(suelto[1]!, mode), gradoDicho(suelto[2]!, mode)];
    if (de !== null && a !== null) {
      return { de, a, donde: 'suelto', dice: suelto[3]! };
    }
  }
  return null;
}

/**
 * **Si la frase habla de un sitio de la canción** —un enlace, un compás, un cambio
 * en un compás—, y no de la canción entera. Lo que dice ahí («resuelve en la
 * tónica», «sin resolver») es de ese sitio, y lo comprueba `loQueNoEsVerdad` ahí:
 * leerlo como si hablara del final de la canción es lo que hacía que el validador
 * tapara 1.795 motivos verdaderos.
 */
export function hablaDeUnSitio(texto: string, mode?: KeyMode): boolean {
  const cambio = /^(\S+) por (\S+) en el \d+/u.exec(texto);
  const enUnCompas = /^(\S+) en el \d+\b/u.exec(texto);
  const quita = /^Quita (\S+) (\S+),/u.exec(texto);
  return (
    enlaceNombrado(texto, mode) !== null ||
    (quita !== null &&
      gradoDicho(quita[1]!, mode) !== null &&
      gradoDicho(quita[2]!, mode) !== null) ||
    (cambio !== null &&
      gradoDicho(cambio[1]!, mode) !== null &&
      gradoDicho(cambio[2]!, mode) !== null) ||
    (enUnCompas !== null && gradoDicho(enUnCompas[1]!, mode) !== null) ||
    /^(?:El|En el) \d+\b/u.test(texto)
  );
}

/** Si el enlace suena donde dice. */
function suenaElEnlace(hay: LoQueHay, { de, a, donde }: Enlace): boolean {
  const { cancion, tuyos } = hay;
  const fin = ultimo(cancion);
  if (donde === 'bucle') {
    return fin === de && cancion[0]!.degree === a;
  }
  if (donde === 'principio') {
    return fin === de && tuyos[0]!.degree === a;
  }
  const empiezan = inicios(cancion);
  const pc = hay.pulsosPorCompas;
  const enSuCompas = (j: number, compas: number) => {
    // «En el 2.5»: el acorde empieza a mitad del compás 2.
    const exacto = empiezan[j]! / pc + 1 === compas;
    const dentro = Number.isInteger(compas) && Math.floor(empiezan[j]! / pc) + 1 === compas;
    return exacto || dentro;
  };
  const hayEnlace = cancion.some(
    (paso, j) =>
      j > 0 &&
      paso.degree === a &&
      cancion[j - 1]!.degree === de &&
      (donde === 'suelto' || enSuCompas(j, donde.compas) || enSuCompas(j - 1, donde.compas)),
  );
  if (hayEnlace) {
    return true;
  }
  // Detrás del último va la vuelta al primer compás de la canción.
  const vuelta =
    fin === de &&
    cancion[0]!.degree === a &&
    (donde === 'suelto' || enSuCompas(cancion.length - 1, donde.compas));
  // Y el acorde que se queda: «V/iv en el 9 prepara otro acorde, y detrás viene V/iv».
  const mismo =
    de === a &&
    cancion.some(
      (paso, j) => paso.degree === de && (donde === 'suelto' || enSuCompas(j, donde.compas)),
    );
  return vuelta || mismo;
}

/**
 * Lo que dice del enlace, comprobado: si dice adónde llega, que llegue ahí.
 * Solo lo que se puede leer sin entender la frase: la tónica, la relativa, la
 * dominante, y que el bajo «no va a ningún sitio» cuando va a una dominante.
 */
function loQueDiceDelEnlace(hay: LoQueHay, { de, a, dice }: Enlace): string | null {
  const tonica = tonicaDe(hay.mode);
  const llegaALaTonica =
    /^(?:la dominante(?:, sin sensible,)? (?:resuelve en|vuelve a) la tónica|cadencia perfecta|cadencia plagal|cierra sin (?:la )?sensible|llega (?:a la tónica )?de rebote|llega a la tónica|llega desde (?:el|tu) )/u;
  if (llegaALaTonica.test(dice) && a !== tonica) {
    return `dice que ${de} ${a} llega a la tónica`;
  }
  if (/^(?:cadencia rota|acaba en la relativa)/u.test(dice) && !esRelativa(hay.mode, a)) {
    return `dice que ${de} ${a} da la relativa`;
  }
  // El bII con séptima de dominante es el sustituto tritonal: hace de dominante.
  const tritonal = (grado: DegreeSymbol) =>
    grado === 'bII' &&
    hay.cancion.some((paso) => paso.degree === 'bII' && paso.especie === 'dominant7');
  if (
    /^la subdominante prepara la dominante/u.test(dice) &&
    roleOfDegreeSymbol(a) !== 'dominant' &&
    !tritonal(a)
  ) {
    return `dice que ${a} es la dominante`;
  }
  const comoDominante = /^la dominante(?:, sin sensible,)? (?:resuelve|vuelve|pasa|va) /u;
  if (comoDominante.test(dice) && roleOfDegreeSymbol(de) !== 'dominant') {
    return `dice que ${de} es la dominante`;
  }
  if (/sin ir a ningún sitio/u.test(dice) && (esDominante(a) || a === tonica)) {
    return `dice que ${de} ${a} no va a ningún sitio, y ${a} es una llegada`;
  }
  const salto = /^el bajo (sube|baja) (medio tono|un tono|una tercera|una quinta)/u.exec(dice);
  if (salto !== null) {
    const arriba = (raiz(hay.mode, a) - raiz(hay.mode, de) + 12) % 12;
    const sube = salto[1] === 'sube';
    const valen: Record<string, readonly number[]> = {
      'medio tono': [sube ? 1 : 11],
      'un tono': [sube ? 2 : 10],
      'una tercera': sube ? [3, 4] : [8, 9],
      'una quinta': [sube ? 7 : 5],
    };
    if (!valen[salto[2]!]!.includes(arriba)) {
      return `dice que el bajo ${salto[1]!} ${salto[2]!} de ${de} a ${a}`;
    }
  }
  return null;
}

// --- Los compases que nombra una frase ----------------------------------------------

/**
 * «X en el (compás) N»: en el compás N suena X. Y las palabras que dicen un grado
 * sin escribirlo: la tónica, el cuarto, la dominante, el cierre.
 */
function compasesNombrados(hay: LoQueHay, texto: string): string | null {
  const total = compases(hay, hay.cancion);
  const tonica = tonicaDe(hay.mode);
  const cuarto: DegreeSymbol = hay.mode === 'major' ? 'IV' : 'iv';
  const porPalabra: Readonly<Record<string, readonly DegreeSymbol[]>> = {
    'la tónica': [tonica],
    'el cuarto': [cuarto],
    'la dominante': ['V', 'v'],
    cierre: [tonica],
  };
  // Un grado, o dos seguidos —«ii V en el 9 y el 10», «V I en el 8»—, o una palabra.
  const token = `(?<![\\p{L}/#\\d])[^\\s,:;]+?(?=[ ,]|$)`;
  const patron = new RegExp(
    `(?:(${token}) )??(la tónica|el cuarto|la dominante|cierre|${token}) (?:cae )?en el (?:compás )?(\\d+)(?!\\d|\\.\\d)(?: y el (\\d+))?`,
    'gu',
  );
  const suena = (grados: readonly DegreeSymbol[], n: number) => {
    const hayAhi = enElCompas(hay, hay.cancion, n);
    // La tónica que llega en el compás de después del último es la vuelta, o el
    // final del blues que cae en el 13: el compás que abre el grupo siguiente.
    return (n === total + 1 && grados.includes(tonica)) || grados.some((g) => hayAhi.includes(g));
  };
  for (const leido of texto.matchAll(patron)) {
    const antes = texto.slice(0, leido.index);
    // «X por Y en el N»: lo mira `cambioNombrado`.
    if (/ por $/u.test(antes) || leido[1] === 'por') {
      continue;
    }
    const n = Number(leido[3]!);
    const primero = leido[1] === undefined ? null : gradoDicho(leido[1], hay.mode);
    const dicho = porPalabra[leido[2]!] ?? null;
    const grado = dicho === null ? gradoDicho(leido[2]!, hay.mode) : null;
    if (dicho === null && grado === null) {
      continue;
    }
    const buscados = dicho ?? [grado!];
    if (primero !== null && grado !== null) {
      // Dos grados: «ii V en el 9 y el 10» es cada uno en el suyo; «V I en el 8», el
      // enlace con uno de los dos en ese compás.
      const m = leido[4] === undefined ? null : Number(leido[4]);
      const bien =
        m !== null
          ? suena([primero], n) && suena([grado], m)
          : suenaElEnlace(hay, { de: primero, a: grado, donde: { compas: n }, dice: '' });
      if (!bien) {
        return `nombra ${primero} ${grado} en el ${n}${m === null ? '' : ` y el ${m}`}, donde no suena`;
      }
      continue;
    }
    if (!suena(buscados, n)) {
      const hayAhi = enElCompas(hay, hay.cancion, n);
      return `dice que en el ${n} suena ${buscados.join(' o ')}, y suena ${hayAhi.join(' ') || 'nada'}`;
    }
  }
  return null;
}

/** «IV por ii en el 3»: en el 3 tocabas IV y ahora suena ii. */
function cambioNombrado(hay: LoQueHay, texto: string): string | null {
  for (const leido of texto.matchAll(/(\S+) por (\S+) en el (\d+)\b/gu)) {
    const [antes, ahora] = [gradoDicho(leido[1]!, hay.mode), gradoDicho(leido[2]!, hay.mode)];
    if (antes === null || ahora === null) {
      continue;
    }
    const n = Number(leido[3]!);
    if (!enElCompas(hay, hay.tuyos, n).includes(antes)) {
      return `dice que en el ${n} tocabas ${antes}`;
    }
    if (!enElCompas(hay, hay.cancion, n).includes(ahora)) {
      return `dice que en el ${n} suena ${ahora}`;
    }
  }
  return null;
}

/** «Cambia el i del compás 1», «Quita la llegada a I del compás 4»: lo tuyo, en ese compás. */
function loTuyoNombrado(hay: LoQueHay, texto: string): string | null {
  for (const leido of texto.matchAll(/(?:el|a) (\S+) del compás (\d+)/gu)) {
    const grado = gradoDicho(leido[1]!, hay.mode);
    const n = Number(leido[2]!);
    if (grado !== null && !enElCompas(hay, hay.tuyos, n).includes(grado)) {
      return `dice que en el ${n} tocabas ${grado}`;
    }
  }
  const dura = /^El (\S+) del (\d+) (?:dura|pasa a durar) (\d+|un) pulsos?/u.exec(texto);
  if (dura !== null) {
    const grado = gradoDicho(dura[1]!, hay.mode);
    const n = Number(dura[2]!);
    const pulsos = dura[3] === 'un' ? 1 : Number(dura[3]!);
    const empiezan = inicios(hay.cancion);
    const esta = hay.cancion.some(
      (paso, i) =>
        paso.degree === grado &&
        paso.beats === pulsos &&
        Math.floor(empiezan[i]! / hay.pulsosPorCompas) + 1 === n,
    );
    if (!esta) {
      return `dice que el ${dura[1]!} del ${n} dura ${dura[3]!} pulsos`;
    }
  }
  const quita = /^Quita (\S+) (\S+),/u.exec(texto);
  if (quita !== null) {
    const [de, a] = [gradoDicho(quita[1]!, hay.mode), gradoDicho(quita[2]!, hay.mode)];
    const loTenias = hay.tuyos.some(
      (paso, i) => i > 0 && paso.degree === a && hay.tuyos[i - 1]!.degree === de,
    );
    if (de !== null && a !== null && !loTenias) {
      return `dice que quita ${de} ${a}, y no lo tenías`;
    }
  }
  const duda = /^El (\d+) se oyó con duda/u.exec(texto);
  if (duda !== null) {
    const n = Number(duda[1]!);
    const empiezan = inicios(hay.tuyos);
    const dudoso = hay.tuyos.some(
      (paso, i) =>
        hay.dudosos?.[i] === true &&
        empiezan[i]! < n * hay.pulsosPorCompas &&
        empiezan[i]! + paso.beats > (n - 1) * hay.pulsosPorCompas,
    );
    if (!dudoso) {
      return `dice que el ${n} se oyó con duda`;
    }
  }
  return null;
}

// --- La forma -----------------------------------------------------------------------

/**
 * Si una parte que se añade, por su nombre, es **otra** que la tuya: un estribillo
 * detrás de una estrofa, la vuelta detrás de un puente. «Cierre» completa la tuya, y
 * «Otro estribillo», «Segunda vuelta» o «Consecuente» son la misma otra vez.
 */
function esOtraParte(hay: LoQueHay, nombre: string): boolean {
  if (/^(?:Cierre|Consecuente|Otr[oa]|Segunda|Última)\b/u.test(nombre)) {
    return false;
  }
  const papel = PAPELES[nombre.toLowerCase()];
  return papel === undefined ? /^(?:Vuelta|Coda)\b/u.test(nombre) : papel !== hay.papel;
}

/**
 * Lo que se dice de la forma: un periodo lo es por `formasDe` y en una sola parte;
 * «N compases» y «Mantiene tus N compases», que dure eso.
 */
function formaNombrada(hay: LoQueHay, texto: string): string | null {
  const total = compases(hay, hay.cancion);
  if (/^Un periodo:|un periodo entero/u.test(texto)) {
    // La forma la reconoce `formasDe`, la misma vara que el juez y que quien construye:
    // un antecedente abierto y un consecuente que cierra, de la mitad cada uno.
    const enCompases = compasesDe(hay.cancion, hay.pulsosPorCompas);
    const periodo =
      enCompases !== null &&
      formasDe(hay.mode, enCompases).some(
        (forma) =>
          forma.forma === 'periodo' &&
          forma.secciones.length === 2 &&
          forma.compasesPorSeccion === total / 2,
      );
    if (!periodo) {
      return 'dice que es un periodo, y no lo es';
    }
    // Y una sola parte: un puente y la vuelta al estribillo son dos.
    const otra = (hay.partesNuevas ?? []).find((nombre) => esOtraParte(hay, nombre));
    if (otra !== undefined) {
      return `dice que es un periodo, y lo que se añade se llama ${otra}: otra parte`;
    }
  }
  const largo = /^(\d+(?:\.\d+)?) compases:/u.exec(texto);
  if (largo !== null && Number(largo[1]!) !== total) {
    return `dice ${largo[1]!} compases, y son ${total}`;
  }
  const mantiene = /^Mantiene tus (\d+(?:\.\d+)?) compases/u.exec(texto);
  if (mantiene !== null && Number(mantiene[1]!) !== compases(hay, hay.tuyos)) {
    return `dice que tenías ${mantiene[1]!} compases`;
  }
  return null;
}

// --- El papel y la parte nueva ------------------------------------------------------

/** Cómo se nombra cada papel en los motivos. */
const PAPELES: Readonly<Record<string, SectionRole>> = {
  idea: 'idea',
  intro: 'intro',
  estrofa: 'estrofa',
  pre: 'pre',
  estribillo: 'estribillo',
  puente: 'puente',
  solo: 'solo',
  final: 'final',
};

/**
 * Lo que se dice de una parte: **la tuya** —«El estribillo empieza en I», «Lo que se
 * añade al pre…»— tiene que ser tu papel; **la nueva** —«Lo que sigue, el puente,
 * entra en vi»— es lo que se añade. Y lo que se dice de ella, verdad: dónde empieza,
 * dónde acaba, si pasa por la tónica.
 */
function parteNombrada(hay: LoQueHay, texto: string): string | null {
  const tonica = tonicaDe(hay.mode);
  const sigue = /^Lo que sigue, (?:el|la) (\p{L}+), (.*)$/u.exec(texto);
  const anade = /^Lo que se añade a(?:l| la) (\p{L}+) (.*)$/u.exec(texto);
  const tuya = /^(?:El|La) (\p{L}+) (.*)$/u.exec(texto);
  let parte: readonly PasoDicho[];
  let dice: string;
  if (sigue !== null) {
    parte = loNuevo(hay);
    dice = sigue[2]!;
  } else if (anade !== null || (tuya !== null && PAPELES[tuya[1]!] !== undefined)) {
    const [, papel, resto] = (anade ?? tuya)!;
    if (PAPELES[papel!] !== hay.papel) {
      return `habla de tu ${papel!}, y tu parte es ${hay.papel ?? 'una idea sin papel'}`;
    }
    parte = anade !== null ? loNuevo(hay) : hay.cancion;
    dice = resto!;
  } else {
    return null;
  }
  const empieza = /(?:empieza|entra) en (\S+?)[,:.]?(?:\s|$)/u.exec(dice);
  if (empieza !== null && gradoDicho(empieza[1]!, hay.mode) !== parte[0]!.degree) {
    return `dice que empieza en ${empieza[1]!}, y empieza en ${parte[0]!.degree}`;
  }
  const acaba = /acaba en (\S+?)[,:.]?(?: |$)/u.exec(dice);
  if (acaba !== null) {
    const grado = gradoDicho(acaba[1]!, hay.mode);
    if (grado !== null && grado !== ultimo(parte)) {
      return `dice que acaba en ${grado}, y acaba en ${ultimo(parte)!}`;
    }
  }
  const enLaTonica = /(?:cierra|acaba) en la tónica/u.test(dice);
  if (enLaTonica && ultimo(parte) !== tonica) {
    return 'dice que acaba en la tónica, y no acaba ahí';
  }
  if (/no pasa por la tónica/u.test(dice) && parte.some((paso) => paso.degree === tonica)) {
    return 'dice que no pasa por la tónica, y pasa';
  }
  return null;
}

/** Lo que se dice de la parte nueva sin nombrar su papel: «La parte nueva acaba en VI, …». */
function parteNuevaNombrada(hay: LoQueHay, texto: string): string | null {
  const nueva = loNuevo(hay);
  const acaba = /^La parte nueva acaba en (\S+), el acorde con el que empiezas/u.exec(texto);
  if (acaba !== null) {
    const grado = gradoDicho(acaba[1]!, hay.mode);
    if (grado !== ultimo(nueva) || grado !== hay.tuyos[0]!.degree) {
      return `dice que la parte nueva acaba en ${acaba[1]!}, que es con lo que empiezas`;
    }
  }
  const pasa = /^La parte nueva (?:ya llega a|pasa una vez por) la (\S+?)[,:.]?(?:\s|$)/u.exec(
    texto,
  );
  if (pasa !== null && !nueva.some((paso) => paso.degree === gradoDicho(pasa[1]!, hay.mode))) {
    return `dice que la parte nueva pasa por ${pasa[1]!}`;
  }
  const acabaEn = /^Acaba en (\S+?)(?:,| en el compás)/u.exec(texto);
  if (acabaEn !== null && gradoDicho(acabaEn[1]!, hay.mode) !== ultimo(hay.cancion)) {
    return `dice que acaba en ${acabaEn[1]!}`;
  }
  return null;
}

// --- Los grados nombrados ------------------------------------------------------------

/**
 * Las frases que nombran un grado **porque no está**: «sin forzar la i», «el
 * sustituto tritonal del V», «Quita iv», «donde tú tenías», «en lugar de V».
 */
const NOMBRA_LO_QUE_NO_ESTA =
  /(?:sin forzar la|tritonal del?|en lugar de|sin pasar por el|en vez de|no la tenía[^.]*|del modo paralelo) $/u;

/** Cada grado nombrado suena en la canción o sonaba en lo tuyo. */
function gradosNombrados(hay: LoQueHay, texto: string): string | null {
  const suenan = new Set([...hay.cancion, ...hay.tuyos].map((paso) => paso.degree));
  for (const leido of texto.matchAll(GRADO)) {
    const grado = gradoDicho(leido[0], hay.mode)!;
    if (!suenan.has(grado) && !NOMBRA_LO_QUE_NO_ESTA.test(texto.slice(0, leido.index))) {
      return `nombra ${grado}, que no suena`;
    }
  }
  return null;
}

// --- Lo que se dice de la canción entera ---------------------------------------------

/** Los estilos por su nombre, tal como los escriben los motivos: «en rock», «del flamenco». */
const NOMBRA_UN_ESTILO = new RegExp(
  `\\b(?:(?:del|en|el) (${STYLE_IDS.filter((estilo) => estilo !== 'blues').join('|')})|en (blues))\\b`,
  'gu',
);

/** Si la canción es un vaivén de dos acordes: los dos. */
function vaivenDe(pasos: readonly PasoDicho[]): readonly DegreeSymbol[] | null {
  const [a, b] = [pasos[0]?.degree, pasos[1]?.degree];
  return a !== undefined &&
    b !== undefined &&
    a !== b &&
    pasos.length >= 4 &&
    pasos.every((paso, i) => paso.degree === (i % 2 === 0 ? a : b))
    ? [a, b]
    : null;
}

/**
 * Lo que se dice de la canción sin nombrar un sitio: el estilo del que se habla
 * tiene que ser el tuyo; «cambia el orden» es que el orden cambia; y entrar en un
 * acorde «es llegar» si no es uno de los dos del vaivén que lo tuyo ya repetía.
 */
function cancionNombrada(hay: LoQueHay, texto: string): string | null {
  // El blues es también una forma —«la forma de doce del blues», «el cambio rápido
  // del blues»—, y como estilo solo se nombra «en blues».
  // Y si nombra también el tuyo, los otros son contraste: «es el turnaround del
  // jazz, no un vamp de funk».
  const nombraElTuyo =
    hay.estilo !== undefined && new RegExp(`\\b${hay.estilo}\\b`, 'u').test(texto);
  for (const leido of texto.matchAll(NOMBRA_UN_ESTILO)) {
    const estilo = leido[1] ?? leido[2]!;
    if (estilo !== hay.estilo && !nombraElTuyo) {
      return `habla del ${estilo}, y el estilo es ${hay.estilo ?? 'ninguno'}`;
    }
  }
  if (/cambia el orden/u.test(texto)) {
    const nuevo = loNuevo(hay).map((paso) => paso.degree);
    const tuyo = hay.tuyos.map((paso) => paso.degree);
    const giro = (grados: readonly DegreeSymbol[]) =>
      grados.filter((grado, i) => i === 0 || grado !== grados[i - 1]).join(' ');
    if (giro(nuevo) === giro(tuyo)) {
      return 'dice que cambia el orden, y es el mismo';
    }
  }
  const llega = /entra en (\S+?), que es llegar/u.exec(texto);
  if (llega !== null) {
    const grado = gradoDicho(llega[1]!, hay.mode);
    const vaiven = vaivenDe(hay.tuyos);
    if (grado !== tonicaDe(hay.mode) && vaiven !== null && vaiven.includes(grado!)) {
      return `dice que entrar en ${grado!} es llegar, y es uno de los dos de tu vaivén`;
    }
  }
  return null;
}

// --- Todo junto ---------------------------------------------------------------------

/**
 * **Lo primero que dice el texto y no es verdad en la canción**, o nulo si todo lo
 * que nombra está donde dice.
 */
export function loQueNoEsVerdad(texto: string, hay: LoQueHay): string | null {
  const enlace = enlaceNombrado(texto, hay.mode);
  if (enlace !== null) {
    if (!suenaElEnlace(hay, enlace)) {
      return `nombra ${enlace.de} ${enlace.a} donde no suena`;
    }
    const falso = loQueDiceDelEnlace(hay, enlace);
    if (falso !== null) {
      return falso;
    }
  }
  return (
    compasesNombrados(hay, texto) ??
    cambioNombrado(hay, texto) ??
    loTuyoNombrado(hay, texto) ??
    formaNombrada(hay, texto) ??
    parteNombrada(hay, texto) ??
    parteNuevaNombrada(hay, texto) ??
    cancionNombrada(hay, texto) ??
    gradosNombrados(hay, texto)
  );
}

/**
 * Lo que hay en una salida del menú, para preguntarle a `loQueNoEsVerdad`: la canción
 * entera con la especie que suena en cada compás —lo tuyo que no cambia de grado
 * suena como lo tocas—, y lo que sabe la petición.
 */
export function loQueHayEnLaSalida(
  mode: KeyMode,
  kind: PathKind,
  tuyos: readonly PathStep[],
  contexto: ContextoDeSalidas,
  salida: SalidaPosible,
): LoQueHay {
  const especies = contexto.especies ?? [];
  const conEspecie = tuyos.map((paso, i) => ({ ...paso, especie: especies[i] ?? null }));
  const cancion = salida.secciones
    .flatMap((seccion) => seccion.steps)
    .map((paso, i) =>
      paso.especie === undefined && conEspecie[i]?.degree === paso.degree
        ? { ...paso, especie: conEspecie[i]!.especie }
        : paso,
    );
  return {
    mode,
    kind,
    pulsosPorCompas: contexto.pulsosPorCompas ?? 4,
    tuyos: conEspecie,
    cancion,
    ...(contexto.papel === undefined ? {} : { papel: contexto.papel }),
    ...(contexto.dudosos === undefined ? {} : { dudosos: contexto.dudosos }),
    ...(contexto.estilo === undefined ? {} : { estilo: contexto.estilo }),
    ...(kind === 'continuar'
      ? {
          partesNuevas: salida.secciones
            .filter((seccion) => !seccion.yours)
            .map((seccion) => seccion.name),
        }
      : {}),
  };
}
