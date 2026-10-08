/**
 * Cómo suena un enlace de dos acordes: el corazón de la sintaxis.
 *
 * Lo usan la sintaxis, la cadencia, el papel y la forma, porque los cuatro miran
 * enlaces: el que entra, el que llega y el que vuelve.
 */
import type { StyleId } from '../../styles';
import {
  bVIIDeLaCasa,
  DOBLE_PLAGAL,
  eligioLaSensible,
  enEstilo,
  esRelativaDeLaTonica,
  estiloOno,
  llegadaDesdeLaSubdominante,
  llevaSensible,
  sinSensible,
  type Acorde,
  type Hecho,
  type Juicio,
} from './juicio';

/**
 * Cuánto vale que una dominante con sensible vuelva a la subdominante, `V IV`.
 *
 * En blues es el giro de los compases 9 y 10, y en rock y en el pop de guitarras
 * se oye a diario —`vi V IV V`—; en el folk de canción, el country y el
 * bluegrass también existe, aunque menos. Solo en jazz y en bolero es deshacer la
 * tensión sin resolverla, que allí no se hace: su idioma es la dominante que
 * resuelve. Sin estilo se juzga como la armonía de siempre, con una penalización
 * moderada.
 *
 * El folk lo descartaba, y no salía de ningún repertorio: salía de que el corpus
 * del arreglista no tenía un folk con `V IV`.
 */
const RETROGRESION: Readonly<Record<StyleId | 'ninguno', number>> = {
  blues: 0.6,
  // El funk deja la dominante sin resolver a propósito —`V7 IV7`, el vamp que vuelve—,
  // y el reggae va y viene entre los tres de siempre: `I IV V IV`.
  funk: 0.4,
  reggae: 0.4,
  rock: 0.3,
  // `V iv` es la rumba de todos los días: `i iv V iv`.
  flamenco: 0.2,
  metal: 0,
  // El honky-tonk lo tiene, sin que sea su firma: la suya es el II7 que va al V.
  country: 0,
  pop: -0.1,
  cine: -0.2,
  folk: -0.3,
  // El bolero vive de que cada dominante llegue: volver atrás es deshacer lo que es.
  bolero: -0.8,
  jazz: -1,
  ninguno: -0.4,
};

/** Los estilos donde `V IV` no se ofrece nunca: los que viven de que la dominante llegue. */
const SIN_RETROGRESION: ReadonlySet<StyleId> = new Set(['jazz', 'bolero']);

/**
 * Si un acorde con séptima de dominante **hace de dominante** de `b` aunque su
 * grado no lo sea: el I7 que va al IV es el V/IV, el VI7 de menor que baja al V es
 * el sustituto tritonal de su dominante. Quien construye las salidas ya los cuenta
 * así, y el juez tiene que oír lo mismo: sin esto, el `I7 IV` del gospel salía como
 * «sale de casa» y no como la dominante que llega.
 *
 * **Solo cuando llega**: un I7 que se queda —la tónica de un blues o de un funk—
 * es la tónica con su color, no una promesa sin cumplir. Las que ya son
 * dominantes por su grado —el V, las secundarias, el bII7, el bVII que cierra sin
 * sensible— se juzgan por lo suyo.
 */
export function llegaComoDominante(a: Acorde, b: Pick<Acorde, 'root' | 'degree'>): Hecho | null {
  const porSuGrado =
    a.funcion === 'tonica' || a.funcion === 'subdominante' || a.funcion === 'sustituto';
  if (a.especie !== 'dominant7' || !porSuGrado) {
    return null;
  }
  const de = `${a.degree}7 ${b.degree}`;
  if (b.root === (a.root + 5) % 12) {
    return {
      valor: 1,
      motivo: `${de}: el ${a.degree}7 hace de dominante del ${b.degree}, y llega.`,
    };
  }
  if (b.root === (a.root + 11) % 12 && b.degree === 'V') {
    return {
      valor: 0.8,
      motivo: `${de}: el ${a.degree}7 baja medio tono a la dominante, como un sustituto tritonal.`,
    };
  }
  return null;
}

/**
 * Lo que vale el enlace del compás `k - 1` al `k`.
 *
 * `sigue` dice si después de `k` hay más música: una cadencia rota solo lo es
 * si la frase continúa.
 */
export function enlace(j: Juicio, k: number, sigue = k < j.cancion.length - 1): Hecho {
  const a = j.cancion[k - 1]!;
  const b = j.cancion[k]!;
  const de = `${a.degree} ${b.degree}`;
  const estilo = estiloOno(j);

  // En un vamp sin tónica, sus dos acordes no son una dominante y una
  // subdominante de Do: son el centro y su vecino. Ir y volver entre ellos es
  // el idioma de lo tuyo, no una retrogresión.
  if (j.modal === 'sin-tonica' && j.vamp!.includes(a.degree) && j.vamp!.includes(b.degree)) {
    return { valor: 0.5, motivo: `${de}: el vaivén de tu vamp.` };
  }
  // La dominante con sensible y sin ella seguidas: la misma nota, natural y
  // alterada, de un acorde al siguiente. Es la falsa relación, y no hay estilo
  // que la quiera entre dos acordes que hacen lo mismo.
  if ((a.degree === 'v' && b.degree === 'V') || (a.degree === 'V' && b.degree === 'v')) {
    return {
      valor: -1,
      motivo: `${de}: la misma dominante sin sensible y con ella, una falsa relación.`,
      descarte: `${de} es una falsa relación`,
    };
  }

  const comoDominante = llegaComoDominante(a, b);
  if (comoDominante !== null) {
    return comoDominante;
  }

  switch (a.funcion) {
    case 'secundaria':
    case 'tritono': {
      // Las dos apuntan a un sitio: la secundaria una quinta abajo, el tritono
      // medio tono abajo. Llegar a otro es prometer algo y no darlo.
      const destino = (a.root + (a.funcion === 'secundaria' ? 5 : 11)) % 12;
      if (b.root === destino) {
        return { valor: 1, motivo: `${de}: ${a.degree} llega a lo que preparaba.` };
      }
      return (
        colorDeCine(j, a, b) ?? {
          valor: -0.8,
          motivo: `${de}: ${a.degree} prepara otro acorde y no llega a él.`,
        }
      );
    }
    case 'dominante':
      return desdeLaDominante(j, sigue, a, b, j.cancion[k + 1], de);
    case 'modal':
      return desdeElModal(j, k, a, b, de, estilo);
    case 'subdominante':
      return desdeLaSubdominante(j, a, b, de);
    case 'sustituto':
      return {
        valor: b.funcion === 'tonica' ? 0.2 : 0.6,
        motivo:
          b.funcion === 'tonica'
            ? `${de}: llega a la tónica de rebote, desde otro reposo.`
            : `${de}: sale del reposo hacia ${b.degree}.`,
      };
    case 'tonica':
      return { valor: 0.5, motivo: `${de}: sale de casa, que puede ir a cualquier sitio.` };
  }
}

/**
 * En el cine, una dominante secundaria **en tríada** que no va a lo suyo no es una
 * promesa rota: es color. Si salta una tercera es una **mediante cromática** —el III
 * mayor de `I V/vi`, el VI mayor de `V/ii I`—, que comparte una nota con el de al
 * lado y cambia el mundo; y el II mayor que vuelve a casa, `I V/V I`, es el **lidio**.
 * Con la séptima de dominante sí promete, y se juzga como cualquier secundaria; y
 * fuera del cine, también. Nulo si no es ninguno de los dos.
 */
export function colorDeCine(
  j: Juicio,
  a: Acorde,
  b: Pick<Acorde, 'root' | 'degree'>,
): Hecho | null {
  if (j.estilo !== 'cine' || a.funcion !== 'secundaria' || a.especie === 'dominant7') {
    return null;
  }
  const de = `${a.degree} ${b.degree}`;
  if ([3, 4, 8, 9].includes((b.root - a.root + 12) % 12)) {
    return {
      valor: 0.5,
      motivo: `${de}: el ${a.degree} en tríada no prepara, colorea: una mediante cromática.`,
    };
  }
  return a.degree === 'V/V' && b.degree === j.tonica
    ? { valor: 0.5, motivo: `${de}: el II mayor que vuelve a casa, el color lidio.` }
    : null;
}

function desdeLaDominante(
  j: Juicio,
  sigue: boolean,
  a: Acorde,
  b: Acorde,
  despues: Acorde | undefined,
  de: string,
): Hecho {
  if (b.funcion === 'tonica') {
    // Sin la sensible —una v menor, un Vsus4— llega a casa, pero no resuelve como
    // dominante: no hay nota que suba. La de quintas sí se dice así: no tiene
    // tercera, ni mayor ni menor, y su bajo es el de la dominante.
    return {
      valor: 1,
      motivo:
        llevaSensible(a) || a.especie === 'quinta'
          ? `${de}: la dominante resuelve en la tónica.`
          : `${de}: la dominante, sin sensible, vuelve a la tónica.`,
    };
  }
  // `V bVI` es la cadencia rota con el bVI prestado, la de las baladas: la tabla
  // pone el bVI con la subdominante, y por eso salía como una retrogresión —en
  // jazz, descartada— cuando es una promesa de casa que se desvía.
  if (j.mode === 'major' && a.degree === 'V' && b.degree === 'bVI') {
    return sigue
      ? { valor: 0.3, motivo: `${de}: cadencia rota, promete la tónica y da el bVI prestado.` }
      : { valor: 0, motivo: `${de}: acaba en el bVI, sin cerrar.` };
  }
  if (
    b.funcion === 'subdominante' &&
    despues?.degree === a.degree &&
    (j.estilo === undefined || !SIN_RETROGRESION.has(j.estilo) || b.root === 2)
  ) {
    // `V ii V` no vuelve atrás: vuelve a preparar la misma dominante, que sigue
    // ahí detrás. Es el ii–V repetido del jazz y el vecino de un pedal de V, y lo
    // que deshace la tensión es irse a la subdominante y quedarse. En jazz y en
    // bolero solo el ii: `V IV V` es el vecino del rock, no su ii–V.
    return {
      valor: Math.max(0.4, RETROGRESION[estiloOno(j)]),
      motivo: `${de} ${a.degree}: vuelve a preparar la dominante, que sigue ahí.`,
    };
  }
  if (b.funcion === 'subdominante') {
    const valor = RETROGRESION[estiloOno(j)];
    const motivo =
      valor > 0
        ? `${de}: la dominante vuelve a la subdominante, que en ${j.estilo} es idioma.`
        : `${de}: la dominante vuelve a la subdominante sin resolver, una retrogresión.`;
    return j.estilo !== undefined && SIN_RETROGRESION.has(j.estilo)
      ? { valor, motivo, descarte: `${de} vuelve atrás, y ${enEstilo(j)} no se hace.` }
      : { valor, motivo };
  }
  if (esRelativaDeLaTonica(b.degree)) {
    // Una cadencia rota de verdad alarga la frase: promete la casa y sigue. Si
    // la canción se acaba ahí, no es un engaño: es un final que no llega.
    return sigue
      ? { valor: 0.3, motivo: `${de}: cadencia rota, promete la tónica y da su relativa.` }
      : { valor: 0, motivo: `${de}: acaba en la relativa, sin cerrar.` };
  }
  if (b.funcion === 'sustituto') {
    return {
      valor: -0.8,
      motivo: `${de}: la dominante va a ${b.degree} sin resolver.`,
    };
  }
  if (b.funcion === 'secundaria' && despues !== undefined && despues.root === (b.root + 5) % 12) {
    // `V III7 vi`: la tensión no se deshace, se desvía hacia otra llegada que sí
    // se da. Es una cadencia rota con su dominante delante, no una promesa rota.
    return {
      valor: 0.4,
      motivo: `${de} ${despues.degree}: la dominante se desvía hacia otra llegada, y llega.`,
    };
  }
  return { valor: -0.2, motivo: `${de}: la dominante pasa a otra tensión sin resolver.` };
}

function desdeElModal(
  j: Juicio,
  k: number,
  a: Acorde,
  b: Acorde,
  de: string,
  estilo: StyleId | 'ninguno',
): Hecho {
  if (b.funcion === 'tonica') {
    // iv bVII I es la «puerta de atrás» del jazz: ahí el bVII sí es idioma.
    if (estilo === 'jazz' && a.degree === 'bVII' && j.cancion[k - 2]?.degree === 'iv') {
      return { valor: 0.3, motivo: `iv ${de}: la puerta de atrás, el bVII del jazz.` };
    }
    const valor = sinSensible(j);
    // Donde cerrar sin sensible no cabe —un jazz menor, un menor que eligió su V—
    // no es un color flojo: es otro idioma, y no se ofrece. Salvo que ese acorde
    // ya sea tuyo: entonces el idioma es el tuyo. Y solo como cadencia final: de
    // paso, en medio de la frase, el VII no cierra nada.
    const tuyo = j.original.some((acorde) => acorde.degree === a.degree);
    const cierra = k === j.cancion.length - 1;
    return {
      valor,
      motivo:
        valor > 0
          ? `${de}: cierra sin sensible.`
          : eligioLaSensible(j)
            ? `${de}: cierra sin sensible, y lo tuyo llega con la del V.`
            : `${de}: cierra sin sensible, y ${enEstilo(j)} se llega con la dominante.`,
      ...(valor <= -1 && !tuyo && cierra
        ? { descarte: `${de} cierra sin la sensible que aquí se pide` }
        : {}),
    };
  }
  if (b.degree === 'IV' || b.degree === 'iv') {
    const valor = DOBLE_PLAGAL[estilo];
    return {
      valor,
      motivo:
        valor >= 0
          ? `${de}: el ${a.degree} se queda fuera un compás más, el doble plagal.`
          : `${de}: el ${a.degree} se queda fuera un compás más, y ${enEstilo(j)} se llega con la dominante.`,
    };
  }
  return { valor: 0.3, motivo: `${de}: sigue fuera de casa, bajando por el modo.` };
}

function desdeLaSubdominante(j: Juicio, a: Acorde, b: Acorde, de: string): Hecho {
  switch (b.funcion) {
    case 'dominante':
    case 'tritono':
      return { valor: 1, motivo: `${de}: la subdominante prepara la dominante.` };
    case 'modal':
      // IV bVII es el mismo idioma que bVII IV, y pesa lo mismo según el estilo;
      // iv bVII en jazz es la puerta de atrás. En menor el VII es de la escala.
      if (b.degree === 'bVII' && !(j.estilo === 'jazz' && a.degree === 'iv')) {
        const valor = DOBLE_PLAGAL[estiloOno(j)];
        const que = bVIIDeLaCasa(j.estilo) ? 'que' : 'un préstamo que';
        return {
          valor,
          motivo:
            valor >= 0
              ? `${de}: de la salida al bVII, ${que} cierra sin sensible.`
              : `${de}: de la salida al bVII, y ${enEstilo(j)} se llega con la dominante.`,
        };
      }
      return { valor: 0.6, motivo: `${de}: de la salida a la tensión.` };
    case 'secundaria':
      return { valor: 0.6, motivo: `${de}: de la salida a la tensión.` };
    case 'tonica':
      return { valor: 0.6, motivo: `${de}: ${llegadaDesdeLaSubdominante(a.degree)}.` };
    case 'sustituto':
      return { valor: 0.3, motivo: `${de}: de la salida a otro reposo.` };
    case 'subdominante':
      // `IV iv` nubla la subdominante camino de casa; `iv IV` la vuelve a aclarar,
      // que es deshacer el color que se acababa de poner.
      if (j.mode === 'major' && a.degree === 'iv' && b.degree === 'IV') {
        return { valor: -0.6, motivo: `${de}: vuelve a aclarar lo que el iv acababa de nublar.` };
      }
      if (b.root === a.root) {
        return { valor: 0.6, motivo: `${de}: el mismo bajo con otro color.` };
      }
      // ii IV vuelve atrás dentro de la misma función; IV ii se adelanta.
      return a.root === 2
        ? { valor: -0.1, motivo: `${de}: retrocede dentro de la subdominante.` }
        : { valor: 0.3, motivo: `${de}: se queda en la zona blanda.` };
  }
}
