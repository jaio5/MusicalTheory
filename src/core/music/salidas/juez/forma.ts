/**
 * Criterio 11: la forma y el centro: el blues, el periodo, la AABA, el vamp.
 *
 * `formaDeBlues` y `bluesAMedias` los usan también quien construye los coros y
 * quien valida, para que los tres cuenten la misma forma.
 */
import type { KeyMode } from '../../keys';
import type { DegreeSymbol } from '../../progressions';
import type { ContextoDeSalidas } from '../contexto';
import { centroFrigio, compasesDe, formasDe, type Compas, type LoQueFalta } from '../formas';
import { tonicaDe } from '../tonica';
import {
  acordeEnCompas,
  compasDe,
  esTension,
  esVampDeFunk,
  llevaSensible,
  NADA,
  pulsos,
  sensibleDelCentro,
  type Acorde,
  type Final,
  type Hecho,
  type Juicio,
} from './juicio';
import { esUnaBajada } from './notas-comunes';
import { cuadraLaToma } from './ritmo-armonico';

/**
 * Lo que puede sonar en el compás 9 de un blues: la dominante, o lo que la
 * prepara si llega a ella en el 10 —el ii–V del blues de jazz, el II7, el bVI7 que
 * baja medio tono al V—, o su sustituto tritonal.
 */
const PREPARAN_EL_DIEZ: ReadonlySet<DegreeSymbol> = new Set(['ii', 'ii°', 'V/V', 'bVI', 'VI']);
const DOMINANTES_DEL_NUEVE: ReadonlySet<DegreeSymbol> = new Set(['V', 'v', 'bII']);

/**
 * Si doce compases son un blues, **por los compases que hacen la forma** y no por
 * los grados exactos: la tónica en el 1, la llegada al cuarto grado en el 5, la
 * vuelta a casa en el 7 o en el 11, y en el 9 la dominante, su sustituto o lo que
 * la prepara para el 10.
 *
 * Antes se pedía un V justo en el 9, y el blues de jazz —`ii V` en el 9 y el 10,
 * el II7 delante del V— salía como «rompe la forma» con el estilo blues puesto: el
 * coro más corriente de un trío de jazz descartado por no ser el de Chicago. Lo
 * que no es blues sigue sin serlo: sin tónica en el 1, sin cuarto en el 5 o sin
 * nada que tire a casa en el 9, la forma no está.
 *
 * Lo usan el juez y quien construye los coros (`coros.ts`): si cada uno
 * reconociera el blues a su manera, uno ofrecería coros que el otro descarta.
 */
export function formaDeBlues(
  mode: KeyMode,
  en: (compas: number) => DegreeSymbol | undefined,
): boolean {
  const tonica = tonicaDe(mode);
  const cuarto = mode === 'minor' ? 'iv' : 'IV';
  const nueve = en(8);
  const llegaAlDiez = en(9) === 'V' || en(9) === 'v';
  const elNueve =
    nueve !== undefined &&
    (DOMINANTES_DEL_NUEVE.has(nueve) || (PREPARAN_EL_DIEZ.has(nueve) && llegaAlDiez));
  return en(0) === tonica && en(4) === cuarto && (en(6) === tonica || en(10) === tonica) && elNueve;
}

/**
 * Si ocho compases son **los ocho primeros de un blues**: la tónica en el 1, el 3 y
 * el 4, el cuarto grado en el 5 y el 6, la vuelta a casa en el 7 y el 8, y en el 2
 * la tónica o el cambio rápido. Es una forma empezada, y lo que la sigue la
 * completa con los cuatro compases que faltan: una frase de ocho detrás deja un
 * blues de dieciséis. Lo encontró el corpus final: con los ocho primeros de un
 * blues en La, todas las salidas añadían ocho y las llamaban estribillo.
 *
 * **Y tiene que sonar a blues**: con el estilo, o con todo en séptimas de blues. `I I
 * I I IV IV I I` en tríadas es también una canción de folk de ocho compases, y esa
 * no pide doce.
 *
 * Como `formaDeBlues`, lo usan el juez y quien construye las salidas.
 */
export function bluesAMedias(
  mode: KeyMode,
  en: (compas: number) => DegreeSymbol | undefined,
  compases: number,
  { estilo, especies }: Pick<ContextoDeSalidas, 'estilo' | 'especies'>,
): boolean {
  const tonica = tonicaDe(mode);
  const cuarto = mode === 'minor' ? 'iv' : 'IV';
  const suenaABlues =
    estilo === 'blues' ||
    (especies !== undefined &&
      especies.every((especie) => especie === 'dominant7' || especie === 'minor7'));
  return (
    suenaABlues &&
    compases === 8 &&
    [0, 2, 3, 6, 7].every((compas) => en(compas) === tonica) &&
    (en(1) === tonica || en(1) === cuarto) &&
    en(4) === cuarto &&
    en(5) === cuarto
  );
}

/** Si lo que suena desde el compás `desde` es un blues de doce (`formaDeBlues`). */
export function esBluesDeDoce(j: Juicio, pasos: readonly Acorde[], desde = 0): boolean {
  if (pulsos(pasos) / j.pc - desde < 12) {
    return false;
  }
  return formaDeBlues(j.mode, (compas) => acordeEnCompas(j, pasos, desde + compas)?.degree);
}

/**
 * Si lo tuyo es **un vamp sobre la tónica** —un solo acorde, el I7 de un funk, el
 * im7 de un groove menor— y lo que se añade va al cuarto grado y vuelve: `IV IV I
 * I`. Es el movimiento de toda la vida de esa música, el del blues en el compás 5,
 * y el juez no lo veía: no hay cadencia fuerte que premiar ni sustituto que
 * validar —ir al IV y volver no es poner un acorde en lugar de otro—, así que
 * salía con lo justo y fuera del menú.
 */
export function alCuartoYVuelta(j: Juicio): Hecho | null {
  if (j.kind !== 'continuar' || !j.original.every((acorde) => acorde.funcion === 'tonica')) {
    return null;
  }
  const parte = j.cancion.slice(j.original.length);
  const cuarto = j.mode === 'minor' ? 'iv' : 'IV';
  const va = parte[0]!.degree === cuarto && parte[parte.length - 1]!.funcion === 'tonica';
  const soloEsos = parte.every((acorde) => acorde.degree === cuarto || acorde.funcion === 'tonica');
  return va && soloEsos
    ? {
        valor: 1,
        motivo: `Tu vamp en ${j.tonica} va al ${cuarto} y vuelve: el movimiento de un vamp sobre la tónica.`,
      }
    : null;
}

/** Si dos compases suenan igual: los mismos acordes, durando lo mismo. */
function mismoCompas(a: Compas, b: Compas | undefined): boolean {
  return (
    b !== undefined &&
    a.length === b.length &&
    a.every((acorde, k) => acorde.degree === b[k]!.degree && acorde.beats === b[k]!.beats)
  );
}

/** Cómo se dice lo que se ha completado, por lo que faltaba. */
const LO_COMPLETADO: Readonly<Record<LoQueFalta['que'], string>> = {
  consecuente: 'el consecuente cierra en casa con tu misma cabeza: un periodo entero',
  b: 'tras tus dos secciones que empiezan igual, una que contrasta: la AABA va por su tercera',
  'ultima-a': 'vuelve tu primera sección tras la que contrasta: la AABA entera',
};

/**
 * Si lo que se añade **completa la forma de lo tuyo** (`formasDe`, la misma vara que
 * quien construye): a lo tuyo le faltaba algo —el consecuente, la sección que
 * contrasta, la vuelta— y la canción entera ya lo tiene. Nulo si no.
 *
 * Lo que completa una forma repite a propósito: el consecuente empieza como el
 * antecedente y la última vuelta es tu primera sección. Sin esto, la novedad y la
 * frase lo leían como copiar lo tuyo. Y lo que cierra la forma, la cierra con una
 * cadencia: perfecta o sin sensible.
 */
function completaLaForma(j: Juicio, final: Final | null): Hecho | null {
  const tuyos = j.kind === 'continuar' ? compasesDe(j.original, j.pc) : null;
  // El consecuente y la última A son tu parte, o la misma otra vez: un estribillo
  // detrás de una estrofa no es su consecuente, es otra parte. La B sí es otra.
  const otraParte = j.loQueSeAnade === 'otra';
  const cancion = compasesDe(j.cancion, j.pc);
  if (tuyos === null || cancion === null) {
    return null;
  }
  const antes = formasDe(j.mode, tuyos);
  const ahora = formasDe(j.mode, cancion);
  for (const forma of antes) {
    if (forma.falta === null || (otraParte && forma.falta.que !== 'b')) {
      continue;
    }
    // Y hace lo que faltaba: lo que tenía que repetir de lo tuyo, lo repite. Un
    // consecuente con otra cabeza también es un periodo, pero no el que faltaba.
    const { repite } = forma.falta;
    const repetido =
      repite === null ||
      tuyos
        .slice(repite.desde, repite.desde + repite.compases)
        .every((compas, k) => mismoCompas(compas, cancion[tuyos.length + k]));
    const sigue = ahora.find(
      (otra) =>
        otra.forma === forma.forma &&
        otra.compasesPorSeccion === forma.compasesPorSeccion &&
        otra.secciones.length === forma.secciones.length + 1,
    );
    // Lo que cierra la forma la cierra con una cadencia de verdad, como el periodo de
    // siempre: una plagal tras la dominante —`V IV I`— no es el consecuente que
    // faltaba, es una retrogresión con tu cabeza delante.
    const cierraBien =
      forma.falta.acaba === 'abierta' ||
      (final !== null && (final.cierre === 'perfecta' || final.cierre === 'sin-sensible'));
    if (sigue !== undefined && repetido && cierraBien) {
      return { valor: 1, motivo: `La forma: ${LO_COMPLETADO[forma.falta.que]}.` };
    }
  }
  return null;
}

/**
 * Si la canción es **un periodo**: la forma que reconoce `formasDe` —la misma vara que
 * quien construye—, con secciones de la mitad, y **una sola parte**. Lo que sigue a un
 * puente es la vuelta al estribillo, otra parte: un puente que acaba en V y un
 * estribillo que cierra no son antecedente y consecuente, aunque lo parezcan contados
 * en compases (lo encontró el quinto examen).
 */
function esUnPeriodo(j: Juicio, mitad: number): boolean {
  const compases = compasesDe(j.cancion, j.pc);
  const otraParte = j.kind === 'continuar' && j.loQueSeAnade === 'otra';
  return (
    !otraParte &&
    compases !== null &&
    formasDe(j.mode, compases).some(
      (forma) =>
        forma.forma === 'periodo' &&
        forma.compasesPorSeccion === mitad &&
        forma.secciones.length === 2,
    )
  );
}

/**
 * Cómo dice su forma un coro de blues que empieza en el compás `desde` (desde
 * cero): la tónica en su 1, el cuarto en su 5 y **lo que suena de verdad en su 9**
 * —la dominante, o el VI7 o el ii que la preparan—. Contado en compases de la
 * canción: el coro nuevo empieza en el 13. Antes era un texto fijo, y decía «la
 * dominante en el 9» de un blues menor con el VI7 ahí (el quinto examen).
 */
function comoVaElCoro(j: Juicio, desde: number): string {
  const nueve = acordeEnCompas(j, j.cancion, desde + 8)!;
  const elNueve =
    nueve.degree === 'V' || nueve.degree === 'v'
      ? 'la dominante'
      : `el ${nueve.degree}${nueve.especie?.endsWith('7') === true ? '7' : ''}`;
  return `la tónica en el ${desde + 1}, el cuarto en el ${desde + 5} y ${elNueve} en el ${desde + 9}`;
}

/** La forma de un blues de doce: otro coro al continuar, la vuelta al retocar. */
function formaDelBlues(j: Juicio, final: Final | null): Hecho {
  if (j.kind === 'continuar') {
    if (esBluesDeDoce(j, j.cancion, j.largoOriginal) && j.largo % 12 === 0) {
      return {
        valor: 1,
        motivo: `Otro coro de doce: ${comoVaElCoro(j, j.largoOriginal)}.`,
      };
    }
    // El acorde final de un blues cae en el 13, donde empezaría otro coro:
    // la vuelta del 12 resuelve ahí. Eso no rompe nada.
    if (final !== null && final.compas === j.largoOriginal && final.desde === j.original.length) {
      return {
        valor: 0.6,
        motivo: `La vuelta del 12 resuelve en ${j.tonica} en el 13: el final del blues.`,
      };
    }
    const motivo = 'Lo que se añade no es un coro de doce: rompe la forma del blues.';
    return j.estilo === 'blues'
      ? { valor: -1, motivo, descarte: 'rompe la forma de doce del blues' }
      : { valor: -0.8, motivo };
  }
  if (j.largo !== 12) {
    // Doblar o partir un coro entero no es otro reparto del mismo blues: es otro
    // largo de coro, y el 5 y el 9 dejan de caer donde caen. Igual que añadirle
    // compases al continuar, no se ofrece.
    return {
      valor: -0.8,
      motivo: `Deja el blues en ${j.largo} compases: rompe la forma de doce.`,
      descarte: 'rompe la forma de doce del blues',
    };
  }
  // Se retoca la vuelta, no el esquema: lo que cambia antes del 8 —menos poner o
  // quitar el cambio rápido al cuarto en el 2— ya es otro blues.
  const cuarto = j.mode === 'minor' ? 'iv' : 'IV';
  const esquema = [...j.cambiados].find((i) => {
    const acorde = j.cancion[i]!;
    const compas = acorde.inicio / j.pc;
    const rapido = compas === 1 && (acorde.degree === cuarto || acorde.degree === j.tonica);
    return compas < 7 && !rapido;
  });
  if (esquema !== undefined) {
    return {
      valor: -0.6,
      motivo: `Cambia el ${compasDe(j, j.cancion[esquema]!)}, que es del esquema del blues: se retoca la vuelta del 8 al 12.`,
    };
  }
  if (esBluesDeDoce(j, j.cancion)) {
    return {
      valor: 0.6,
      motivo: `La forma de doce sigue entera: ${comoVaElCoro(j, 0)}.`,
    };
  }
  // Lo que ha dejado de decir la forma, dicho con lo que suena: antes del 8 solo se
  // toca el cambio rápido (arriba), así que el 1 y el 5 siguen ahí, y lo que ya no
  // está es el 9 que lleva a la vuelta —la dominante, o lo que la prepara para el
  // 10—. Era un texto fijo, «el 1, el 5 o el 9 ya no dicen…», con los tres sin
  // tocar (el quinto examen).
  const nueve = acordeEnCompas(j, j.cancion, 8)!;
  const diez = acordeEnCompas(j, j.cancion, 9)!;
  return {
    valor: -0.3,
    motivo: `Siguen siendo doce, pero el 9 ya no lleva a la vuelta: suena ${nueve.degree}, y en el 10 ${diez.degree}.`,
  };
}

/** Un vamp sin tónica: ii V ii V en Do es un dórico sobre Re, y cerrar en Do destruye el modo. */
function formaDelVampSinTonica(j: Juicio, ultimo: Acorde): Hecho {
  const vamp = j.vamp!;
  // Y meterle la sensible de su centro —el Do# de un dórico sobre Re, que trae el
  // A7— lo vuelve un Re menor de manual: es lo mismo que meter la sensible en lo
  // que eligió no tenerla, dicho del centro del vamp (`sensibleDelCentro`).
  const suya = sensibleDelCentro(j.mode, vamp[0]);
  const laTenia = j.original.some((acorde) => acorde.notas.includes(suya));
  const intruso = laTenia
    ? undefined
    : [...j.cambiados].map((i) => j.cancion[i]!).find((acorde) => acorde.notas.includes(suya));
  if (intruso !== undefined) {
    return {
      valor: -1,
      motivo: `Tu vamp vive en ${vamp[0]} sin su sensible, y el ${intruso.degree} la trae: deja de ser modal.`,
      descarte: 'mete la sensible del centro de tu vamp',
    };
  }
  return ultimo.funcion === 'tonica'
    ? {
        valor: -1,
        motivo: `Cierra en ${j.tonica}, y tu vamp de ${vamp.join(' y ')} no la tenía: deja de ser modal.`,
      }
    : {
        valor: 0.6,
        motivo: `Se queda en el vamp de ${vamp.join(' y ')} sin forzar la ${j.tonica}.`,
      };
}

/**
 * Meter la sensible en lo que eligió no tenerla no es un color: es cambiarle el
 * modo.
 *
 * La sensible no es solo el V: es la nota que sube a la tónica, y la traen
 * también el vii°, el iii de mayor y cualquier dominante que apunte a otro
 * sitio —una secundaria lleva la sensible de su destino—. Antes solo se miraba
 * el V, y un `vii°` o un `V/vi` metían la sensible en un vaivén mixolidio sin
 * que nada lo notara.
 */
function formaSinSensible(j: Juicio): Hecho {
  const suyo = esVampDeFunk(j.mode, j.original, j.estilo)
    ? `vamp de ${[...new Set(j.original.map((acorde) => acorde.degree))].join(' y ')}`
    : j.mode === 'major'
      ? 'bVII'
      : 'v y VII';
  const intruso = [...j.cambiados]
    .map((i) => j.cancion[i]!)
    .find((acorde) => llevaSensible(acorde) || acorde.funcion === 'secundaria');
  return intruso !== undefined
    ? {
        valor: -1,
        motivo: `${suyo.startsWith('vamp') ? `Tu ${suyo} no lleva V` : `Lo tuyo usa ${suyo} y no V`}: el ${intruso.degree}, con su sensible, lo saca del modo.`,
        descarte: 'mete la sensible en lo que eligió no tenerla',
      }
    : { valor: 0.5, motivo: `Se queda en el color de tu ${suyo}, sin meter la sensible.` };
}

/**
 * Al revés, en menor: quien eligió el V con sensible no quiere la v sin ella. Las
 * dos son la misma dominante de las dos maneras, y las dos se descartan igual.
 * Nulo si lo tuyo no la había elegido o la salida la respeta.
 */
function quitaLaSensibleDelMenor(j: Juicio): Hecho | null {
  const tuyos = new Set(j.original.map((acorde) => acorde.degree));
  // Por las notas y no por el nombre: un V en quintas no tiene tercera, y no ha
  // elegido ninguna sensible.
  if (j.mode !== 'minor' || !tuyos.has('V') || tuyos.has('v') || !j.original.some(llevaSensible)) {
    return null;
  }
  // Salvo la v que se toca sobre la nota de una bajada: en `i VII VI V` la v sobre
  // el Sol del VII es el lamento de manual —i, v6, iv6, V—, y la sensible sigue
  // llegando con el V del final, que no se toca.
  const bajada = esUnaBajada(
    j.mode,
    j.original.map((acorde) => acorde.degree),
  );
  const vSobreLaLinea = (i: number) =>
    bajada && j.original[i] !== undefined && j.cancion[i]!.notas.includes(j.original[i]!.root);
  const traeLaV = [...j.cambiados].some((i) => j.cancion[i]!.degree === 'v' && !vSobreLaLinea(i));
  if (traeLaV) {
    return {
      valor: -1,
      motivo: 'Lo tuyo usa V con sensible: la v sin ella suena a otro modo.',
      descarte: 'quita la sensible que tu V había elegido',
    };
  }
  // Y quitarla del todo es lo mismo dicho de otra manera: tu menor armónico se
  // queda en natural. Vale cambiar el V por su sustituto tritonal, que la lleva.
  if (!j.cancion.some(llevaSensible)) {
    return {
      valor: -1,
      motivo: 'Lo tuyo llegaba con la sensible del V, y aquí ya no suena en ningún acorde.',
      descarte: 'quita la sensible que tu V había elegido',
    };
  }
  return null;
}

/**
 * **Una andaluza no cierra con VII i**: eso es el cierre del pop. Lo suyo es reposar
 * en el V o llegar a la i por él. Con el estilo flamenco, o con una andaluza que
 * ya reposa en su V (`centroFrigio`, la vara de quien construye los finales).
 */
function andaluzaCerradaComoUnPop(j: Juicio, final: Final | null): Hecho | null {
  const andaluza = centroFrigio(
    j.mode,
    j.estilo,
    j.original.map((acorde) => acorde.degree),
  );
  const conVII =
    final !== null &&
    final.antes !== undefined &&
    (final.antes.degree === 'VII' || final.antes.degree === 'bVII') &&
    j.cambiados.has(final.desde - 1);
  if (andaluza === null || !conVII) {
    return null;
  }
  return {
    valor: -0.8,
    motivo: `Cierra con ${final.antes!.degree} ${j.tonica}, el cierre del pop: ${j.estilo === 'flamenco' ? 'el flamenco' : 'tu andaluza'} reposa en el ${andaluza.centro} o llega a la ${j.tonica} por él.`,
    reparo: 'cierra una andaluza como un pop',
  };
}

/** El periodo de manual: tensión en la mitad y cierre fuerte al final, de ocho o de dieciséis. */
function periodoDeManual(j: Juicio, final: Final | null): Hecho | null {
  const mitad = j.largo / 2;
  if (
    j.frase !== 4 ||
    (j.largo !== 8 && j.largo !== 16) ||
    final === null ||
    !esUnPeriodo(j, mitad)
  ) {
    return null;
  }
  const enLaMitad = acordeEnCompas(j, j.cancion, mitad - 1)!;
  if (!esTension(enLaMitad) || (final.cierre !== 'perfecta' && final.cierre !== 'sin-sensible')) {
    return null;
  }
  return {
    valor: 1,
    motivo: `Un periodo: ${enLaMitad.degree === 'V' ? 'semicadencia' : 'queda en tensión'} en ${enLaMitad.degree} en el compás ${mitad} y cierre en el ${j.largo}.`,
  };
}

export function forma(j: Juicio, final: Final | null, blues: boolean): Hecho {
  if (blues) {
    return formaDelBlues(j, final);
  }
  const alCuarto = alCuartoYVuelta(j);
  if (alCuarto !== null) {
    return alCuarto;
  }
  if (cuadraLaToma(j) === true) {
    return {
      valor: 0.8,
      motivo: `Tu toma desigual queda en ${j.largo} compases de ${j.pc} pulsos.`,
    };
  }
  if (j.modal === 'sin-tonica') {
    return formaDelVampSinTonica(j, j.cancion[j.cancion.length - 1]!);
  }
  if (j.modal === 'sin-sensible') {
    return formaSinSensible(j);
  }
  // Y si no es el periodo de manual, lo que completa la forma de lo tuyo; o lo que
  // deja sin cerrar un antecedente.
  return (
    quitaLaSensibleDelMenor(j) ??
    andaluzaCerradaComoUnPop(j, final) ??
    periodoDeManual(j, final) ??
    completaLaForma(j, final) ??
    periodoSinCerrar(j) ??
    NADA
  );
}

/**
 * **Lo que deja sin cerrar un antecedente**: tu frase de cuatro u ocho empieza en
 * casa y acaba en la dominante —una semicadencia, la mitad de un periodo (`formasDe`)— y lo que sigue
 * se va a otra parte sin el consecuente. Un contraste que vuelve a acabar en V
 * deja dos semicadencias seguidas y el periodo no cierra nunca: tiene reparo. Otra
 * parte que cierra resta menos, pero va detrás de lo que completa la forma (el
 * quinto examen). Solo con la dominante: una frase que acaba en el IV es un bucle,
 * y lo que la sigue puede ser cualquier cosa.
 */
function periodoSinCerrar(j: Juicio): Hecho | null {
  const ultimo = j.original[j.original.length - 1]!;
  const tuyos = compasesDe(j.original, j.pc);
  // Un antecedente empieza en casa: `vi IV I V` es un bucle que vuelve al vi por la
  // rota, y la andaluza, que baja entera hasta el V, reposa ahí (`esUnaBajada`).
  const grados = j.original.map((acorde) => acorde.degree);
  const antecedente =
    j.kind === 'continuar' &&
    grados[0] === j.tonica &&
    (ultimo.degree === 'V' || ultimo.degree === 'v') &&
    !esUnaBajada(j.mode, grados) &&
    tuyos !== null &&
    formasDe(j.mode, tuyos).some((forma) => forma.falta?.que === 'consecuente');
  if (!antecedente || j.loQueSeAnade === 'tuya' || j.loQueSeAnade === 'misma') {
    return null;
  }
  const motivo = `Tu frase empieza en casa y acaba en ${ultimo.degree}, como un antecedente, y lo que sigue se va a otra parte: el periodo se queda a medias.`;
  return j.path === 'contraste'
    ? { valor: -1, motivo, reparo: 'deja el periodo sin cerrar' }
    : { valor: -0.4, motivo };
}
