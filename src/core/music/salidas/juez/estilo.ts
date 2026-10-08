/**
 * Criterio 8: el estilo, qué familias de acordes y qué giros son de la casa.
 */
import type { EspecieDeBloque } from '../../chords';
import type { KeyMode } from '../../keys';
import type { DegreeSymbol } from '../../progressions';
import { STYLES, type ChordFamily, type StyleId } from '../../styles';
import {
  acotar,
  bVIIDeLaCasa,
  NADA,
  PRESTADOS_EN_MAYOR,
  type Acorde,
  type Hecho,
  type Juicio,
} from './juicio';

/** La familia de `styles.ts` a la que pertenece un acorde por su grado. */
export function familiaDelGrado(j: Juicio, acorde: Acorde): ChordFamily {
  switch (acorde.funcion) {
    case 'tritono':
      return 'tritoneSub';
    case 'secundaria':
      // La mediante cromática del cine es color prestado, no una dominante (`colorDeCine`).
      return j.estilo === 'cine' && acorde.especie !== 'dominant7'
        ? 'borrowed'
        : 'secondaryDominant';
    default:
      if (acorde.degree === 'bII') {
        return 'neapolitan';
      }
      // Un préstamo en quintas solo lo es si su fundamental o su quinta salen de la
      // escala: el iv5 de Do son el Fa y el Do del IV5, y lo prestado era la tercera.
      if (
        j.mode === 'major' &&
        PRESTADOS_EN_MAYOR.has(acorde.degree) &&
        !(acorde.especie === 'quinta' && quintaEnLaEscala(acorde))
      ) {
        return 'borrowed';
      }
      return acorde.degree.endsWith('°') ? 'diminished' : 'diatonic';
  }
}

/** Si las dos notas de un acorde de quintas son de la escala mayor. */
function quintaEnLaEscala(acorde: Pick<Acorde, 'notas'>): boolean {
  return acorde.notas.every((nota) => [0, 2, 4, 5, 7, 9, 11].includes(nota));
}

/** La familia que pone la especie, si la hay. */
const FAMILIA_DE_ESPECIE: Readonly<Record<EspecieDeBloque, ChordFamily>> = {
  quinta: 'power',
  sus2: 'suspended',
  sus4: 'suspended',
  dim: 'diminished',
  aug: 'altered',
  menor: 'borrowed',
  major7: 'seventh',
  dominant7: 'seventh',
  minor7: 'seventh',
  halfDiminished7: 'seventh',
  diminished7: 'diminished',
  minorMajor7: 'seventh',
  augmentedMajor7: 'altered',
};

/** Cómo se dice cada familia en un motivo. */
const NOMBRE_DE_FAMILIA: Readonly<Record<ChordFamily, string>> = {
  diatonic: 'de la tonalidad',
  power: 'una quinta sin tercera',
  suspended: 'un acorde suspendido',
  added: 'un acorde con una nota añadida',
  seventh: 'una cuatríada',
  borrowed: 'un préstamo',
  secondaryDominant: 'una dominante secundaria',
  tritoneSub: 'un sustituto tritonal',
  diminished: 'un disminuido',
  neapolitan: 'un napolitano',
  altered: 'un acorde alterado',
};

/**
 * Los giros típicos de cada estilo, buenos y malos, como grados seguidos.
 *
 * Se busca **el más largo** que acaba en cada compás nuevo, para que `ii V I` no
 * cuente además como `ii V` y como `V I`. Y por eso la puerta de atrás del jazz,
 * `iv bVII I`, gana al `bVII I` que el jazz no usa.
 */
const GIROS: Readonly<
  Record<StyleId, readonly (readonly [patron: string, bueno: boolean, texto: string])[]>
> = {
  jazz: [
    ['iii vi ii V', true, 'iii vi ii V, el turnaround del jazz'],
    ['ii V I', true, 'ii V I, la célula del jazz'],
    ['ii° V i', true, 'ii° V i, la célula del jazz en menor'],
    ['iv bVII I', true, 'iv bVII I, la puerta de atrás del jazz'],
    ['IV iv I', true, 'IV iv I, la subdominante que se nubla'],
    ['vi ii V', true, 'vi ii V, cayendo por quintas'],
    ['bII I', true, 'bII I, el sustituto tritonal'],
    ['bII i', true, 'bII i, el sustituto tritonal'],
    ['V/ii ii', true, 'V/ii ii, una dominante secundaria'],
    ['V/V V', true, 'V/V V, la dominante de la dominante'],
    ['V/vi vi', true, 'V/vi vi, una dominante secundaria'],
    ['ii V', true, 'ii V, la preparación del jazz'],
    ['V I', true, 'V I, la resolución'],
    ['V i', true, 'V i, la resolución'],
    ['bVI bVII I', false, 'bVI bVII I es rock, no jazz'],
    ['V IV', false, 'V IV es blues, no jazz'],
    ['bVII I', false, 'bVII I cierra sin sensible, que en jazz no se usa'],
  ],
  blues: [
    ['V IV I', true, 'V IV I, el final del giro de blues'],
    ['V IV', true, 'V IV, el giro del blues'],
    ['IV I', true, 'IV I, la vuelta del blues'],
    ['I IV', true, 'I IV, el cambio del blues'],
    ['i iv', true, 'i iv, el cambio del blues menor'],
    ['iv i', true, 'iv i, la vuelta del blues menor'],
  ],
  rock: [
    ['bVI bVII I', true, 'bVI bVII I, la escalera del rock'],
    ['VI VII i', true, 'VI VII i, la escalera del rock menor'],
    ['bVII I', true, 'bVII I, la cadencia del rock'],
    ['VII i', true, 'VII i, la cadencia del rock menor'],
    ['bVII IV', true, 'bVII IV, el doble plagal'],
    ['I bVII', true, 'I bVII, el giro mixolidio'],
    ['bIII IV', true, 'bIII IV, el riff que sube'],
    ['IV I', true, 'IV I, el amén del rock'],
    ['i VII', true, 'i VII, la bajada por tonos'],
    ['ii V I', false, 'ii V I suena a jazz, no a rock'],
    ['V/ii ii', false, 'una dominante secundaria suena a otro estilo'],
  ],
  metal: [
    ['VI VII i', true, 'VI VII i, la escalera del metal'],
    ['bII i', true, 'bII i, el semitono frigio'],
    ['i bII', true, 'i bII, el color frigio'],
    ['VII i', true, 'VII i, cierra sin sensible'],
    ['i VI', true, 'i VI, la bajada del menor'],
    ['ii V I', false, 'ii V I suena a jazz, no a metal'],
  ],
  pop: [
    ['I V vi IV', true, 'I V vi IV, el eje del pop'],
    ['V vi IV', true, 'V vi IV, el eje del pop'],
    ['IV V I', true, 'IV V I, la cadencia del pop'],
    ['IV iv I', true, 'IV iv I, la subdominante que se nubla'],
    ['VI VII i', true, 'VI VII i, la subida del pop menor'],
    ['vi IV', true, 'vi IV, el eje del pop'],
    ['V/vi vi', true, 'V/vi vi, la secundaria que levanta'],
    ['iv I', true, 'iv I, la plagal menor'],
    ['IV I', true, 'IV I, la plagal'],
    ['V I', true, 'V I, la resolución'],
  ],
  folk: [
    ['IV V I', true, 'IV V I, la cadencia de siempre'],
    ['VI VII i', true, 'VI VII i, el giro eólico'],
    ['IV I', true, 'IV I, la plagal del folk'],
    ['I IV', true, 'I IV, el vaivén del folk'],
    ['V I', true, 'V I, la resolución'],
    ['VII i', true, 'VII i, la cadencia eólica'],
    ['bVII I', true, 'bVII I, la cadencia mixolidia del folk'],
    ['I bVII', true, 'I bVII, el vaivén mixolidio del folk'],
    ['iv i', true, 'iv i, la plagal menor'],
    ['bVI bVII I', false, 'bVI bVII I es rock, no folk'],
    ['bII I', false, 'el bII no es del folk'],
  ],
  // El vamp: uno o dos acordes con séptima que van y vuelven, y la dominante que no
  // tiene prisa por resolver. Lo que lo parte es la cadena de secundarias.
  funk: [
    ['bVII IV I', true, 'bVII IV I, el doble plagal del funk'],
    ['I IV', true, 'I IV, el vamp del funk'],
    ['IV I', true, 'IV I, la vuelta del vamp'],
    ['i iv', true, 'i iv, el vamp del funk menor'],
    ['iv i', true, 'iv i, la vuelta del vamp menor'],
    ['I bVII', true, 'I bVII, el mixolidio del funk'],
    ['bVII I', true, 'bVII I, vuelve sin sensible'],
    ['i VII', true, 'i VII, el vaivén del funk menor'],
    ['VII i', true, 'VII i, vuelve sin sensible'],
    // Los giros del vamp (`vaiven`, en `movimientos.ts`): el IV del IV y la v
    // menor del dórico, y la cadencia clásica que lo rompe.
    ['IV bVII', true, 'IV bVII, el IV del IV'],
    ['i v', true, 'i v, la v menor del dórico'],
    ['v i', true, 'v i, vuelve sin sensible'],
    ['iv VII', true, 'iv VII, la puerta de atrás del funk menor'],
    ['V I', false, 'V I con sensible es la cadencia clásica, no el vamp'],
    ['iv I', false, 'iv I, la plagal menor, es de balada: el vamp vuelve desde el cuarto mayor'],
    ['I iv', false, 'I iv, la subdominante menor, es de balada: el vamp va al cuarto mayor'],
    ['V i', false, 'V i con sensible es la cadencia clásica, no el vamp'],
    ['V IV', true, 'V IV, la dominante que no resuelve'],
    ['iii vi ii V', false, 'iii vi ii V es el turnaround del jazz, no un vamp de funk'],
    ['V/vi vi', false, 'una dominante secundaria parte el vamp'],
    ['V/ii ii', false, 'una dominante secundaria parte el vamp'],
  ],
  // Los tres de siempre y la dominante de la dominante delante del V: el II7.
  country: [
    ['V/V V I', true, 'V/V V I, el II7 del country'],
    ['IV V I', true, 'IV V I, la cadencia del country'],
    ['V/V V', true, 'V/V V, el II7 que empuja al V'],
    ['IV I', true, 'IV I, la vuelta del country'],
    ['I IV', true, 'I IV, el cambio del country'],
    ['V I', true, 'V I, la resolución'],
    ['bVI bVII I', false, 'bVI bVII I es rock, no country'],
    ['iii vi ii V', false, 'iii vi ii V suena a jazz, no a country'],
    ['V/ii V/V', false, 'encadenar secundarias suena a jazz, no a country'],
    ['V/vi V/ii', false, 'encadenar secundarias suena a jazz, no a country'],
    ['bII I', false, 'el bII no es del country'],
  ],
  // Dos acordes en vaivén. El contratiempo es de la guitarra y no se ve en los grados;
  // lo que sí se ve es que los dos acordes van y vienen, y que nadie prepara nada.
  reggae: [
    ['I IV', true, 'I IV, el vaivén del reggae'],
    ['IV I', true, 'IV I, la vuelta del vaivén'],
    ['I V', true, 'I V, el vaivén del reggae'],
    ['V IV', true, 'V IV, el ir y venir del reggae'],
    ['V I', true, 'V I, la resolución'],
    ['i iv', true, 'i iv, el vaivén del reggae menor'],
    ['iv i', true, 'iv i, la vuelta del vaivén menor'],
    ['i VII', true, 'i VII, el vaivén del reggae menor'],
    ['VII i', true, 'VII i, cierra sin sensible'],
    ['ii V I', false, 'ii V I suena a jazz, no a reggae'],
    ['V/V V', false, 'una dominante secundaria suena a otro estilo'],
    ['bII i', false, 'el bII no es del reggae'],
  ],
  // La cadena de dominantes y el menor armónico: cada acorde llega a lo suyo.
  bolero: [
    ['V/ii ii V I', true, 'V/ii ii V I, la cadena del bolero'],
    ['V/V V I', true, 'V/V V I, la dominante de la dominante'],
    ['ii V I', true, 'ii V I, la cadencia del bolero'],
    ['ii° V i', true, 'ii° V i, la cadencia del bolero en menor'],
    ['iv V i', true, 'iv V i, el menor armónico'],
    ['V/iv iv', true, 'V/iv iv, la tónica que se hace dominante del iv'],
    ['IV iv I', true, 'IV iv I, la subdominante que se nubla'],
    ['V/vi vi', true, 'V/vi vi, una dominante secundaria'],
    ['V/ii ii', true, 'V/ii ii, una dominante secundaria'],
    ['V/V V', true, 'V/V V, la dominante de la dominante'],
    ['bII I', true, 'bII I, el sustituto tritonal'],
    ['bII i', true, 'bII i, el sustituto tritonal'],
    ['V I', true, 'V I, la resolución'],
    ['V i', true, 'V i, la resolución'],
    ['bVI bVII I', false, 'bVI bVII I es rock, no bolero'],
    ['V IV', false, 'V IV vuelve atrás, y el bolero no lo hace'],
    ['bVII I', false, 'bVII I cierra sin sensible, que en bolero no se usa'],
    ['VII i', false, 'VII i cierra sin sensible, y el bolero llega con la dominante'],
  ],
  // La andaluza baja hasta el V y ahí reposa: el VI V es el semitono frigio que llega.
  // El V del flamenco es mayor, y la v menor le quita justo lo que lo hace centro.
  flamenco: [
    ['i VII VI V', true, 'i VII VI V, la cadencia andaluza'],
    ['VII VI V', true, 'VII VI V, la bajada andaluza'],
    ['VI V', true, 'VI V, el semitono frigio que llega al V'],
    ['iv V', true, 'iv V, la llegada al V'],
    ['V i', true, 'V i, la andaluza que vuelve a empezar'],
    ['bII i', true, 'bII i, el semitono frigio'],
    ['i bII', true, 'i bII, el color frigio'],
    ['V/iv iv', true, 'V/iv iv, la tónica mayor que va al iv'],
    ['ii V I', false, 'ii V I suena a jazz, no a flamenco'],
    ['V/V V', false, 'la dominante de la dominante no es del flamenco'],
    ['VI v', false, 'VI v: en flamenco la dominante es mayor'],
    ['v i', false, 'v i: en flamenco la dominante es mayor'],
  ],
  // El menor prestado y las mediantes que saltan una tercera; lo que suena a otro
  // sitio es la cadena funcional del jazz.
  cine: [
    ['bVI bVII I', true, 'bVI bVII I, la subida épica del cine'],
    ['VI VII i', true, 'VI VII i, la subida épica en menor'],
    ['IV iv I', true, 'IV iv I, la subdominante que se nubla'],
    ['iv I', true, 'iv I, la plagal menor del cine'],
    ['bVII I', true, 'bVII I, llega sin sensible'],
    ['I bVI', true, 'I bVI, la mediante cromática'],
    ['bVI I', true, 'bVI I, vuelve desde la mediante'],
    ['I bIII', true, 'I bIII, la mediante cromática'],
    ['I V/vi', true, 'I V/vi, el III mayor: la mediante cromática'],
    ['I V/V', true, 'I V/V, el II mayor: el color lidio'],
    ['i VI', true, 'i VI, la bajada del menor'],
    ['ii V I', false, 'ii V I suena a jazz, no a cine'],
    ['V/ii ii', false, 'una cadena de secundarias suena a otro estilo'],
  ],
};

type Giro = (typeof GIROS)[StyleId][number];

/**
 * El giro más largo del estilo que acaba en el compás `k` **y pasa por algo que
 * trae la salida**, si hay alguno.
 *
 * Que pase, no que acabe: un III7 que se mete delante de tu vi hace un `V/vi vi`
 * aunque el vi ya fuera tuyo, y un ii delante de tu `V I` hace un `ii V I`. Antes
 * solo contaba el giro que acababa en un compás nuevo, y esos dos no existían.
 */
function giroEn(
  estilo: StyleId,
  grados: readonly DegreeSymbol[],
  nuevo: readonly boolean[],
  k: number,
): { readonly giro: Giro; readonly desde: number } | null {
  let mejor: { giro: Giro; desde: number } | null = null;
  for (const giro of GIROS[estilo]) {
    const patron = giro[0].split(' ');
    const desde = k - patron.length + 1;
    const coincide =
      desde >= 0 &&
      patron.every((grado, i) => grados[desde + i] === grado) &&
      nuevo.slice(desde, k + 1).some(Boolean);
    if (coincide && (mejor === null || desde < mejor.desde)) {
      mejor = { giro, desde };
    }
  }
  return mejor;
}

/**
 * Los giros del estilo en unos acordes, **los que pasan por algo cambiado** —o
 * todos, sin `cambiados`—, sin contar dos veces uno que cabe en otro: `ii V`
 * dentro de `ii V I`. Y cuántos compases nuevos hay, contados sin repetir.
 */
function girosDelEstilo(
  estilo: StyleId,
  pasos: readonly Acorde[],
  cambiados: ReadonlySet<number> | null,
): { readonly giros: readonly Giro[]; readonly enlaces: number } {
  // Los giros se buscan sobre los grados sin repetir: `ii V I I` es `ii V I`.
  const colapsado: { degree: DegreeSymbol; nuevo: boolean }[] = [];
  pasos.forEach((acorde, i) => {
    const esNuevo = cambiados === null || cambiados.has(i);
    const previo = colapsado[colapsado.length - 1];
    if (previo?.degree === acorde.degree) {
      previo.nuevo ||= esNuevo;
    } else {
      colapsado.push({ degree: acorde.degree, nuevo: esNuevo });
    }
  });
  const grados = colapsado.map((paso) => paso.degree);
  const nuevo = colapsado.map((paso) => paso.nuevo);
  const hallados = colapsado.flatMap((_, k) => {
    const giro = giroEn(estilo, grados, nuevo, k);
    return giro === null ? [] : [{ ...giro, hasta: k }];
  });
  const giros = hallados
    .filter(
      (giro) =>
        !hallados.some(
          (otro) =>
            otro !== giro &&
            otro.desde <= giro.desde &&
            giro.hasta <= otro.hasta &&
            otro.hasta - otro.desde > giro.hasta - giro.desde,
        ),
    )
    .map(({ giro }) => giro);
  return { giros, enlaces: Math.max(1, colapsado.filter((paso) => paso.nuevo).length) };
}

/**
 * Los pesos de `STYLES` **en este modo**: los de siempre, salvo el bII del flamenco
 * en mayor, que no existe —su bII es el semitono frigio de un menor—. Lo mismo mira
 * quien construye las salidas (`idioma.ts`, `napolitanoDe`).
 */
function pesosDelEstilo(mode: KeyMode, estilo: StyleId): Readonly<Record<ChordFamily, number>> {
  const pesos = STYLES[estilo].weights;
  return estilo === 'flamenco' && mode === 'major' ? { ...pesos, neapolitan: 0 } : pesos;
}

export function estilo(j: Juicio): Hecho & { readonly aplica: boolean } {
  if (j.estilo === undefined) {
    return { ...NADA, aplica: false };
  }
  const pesos = pesosDelEstilo(j.mode, j.estilo);
  const nuevos = [...j.cambiados].map((i) => j.cancion[i]!);
  if (nuevos.length === 0) {
    return { valor: 0, motivo: 'Los mismos acordes: el estilo no cambia.', aplica: true };
  }
  // Cada peso, contra el de la familia que más pesa en ese estilo: en jazz lo
  // de casa son las cuatríadas, no las tríadas, y en rock las tríadas y las
  // quintas. Por debajo de siete décimas del máximo, el acorde resta.
  const maximo = Math.max(...Object.values(pesos));
  const familias = nuevos.map((acorde) => {
    // Un bVII en un estilo que cierra sin sensible es un préstamo que no resta:
    // pesa por lo menos lo que lo de casa.
    const delGrado =
      acorde.degree === 'bVII' && bVIIDeLaCasa(j.estilo)
        ? Math.max(pesos.borrowed, 0.7 * maximo)
        : pesos[familiaDelGrado(j, acorde)];
    if (acorde.especie === null) {
      return delGrado;
    }
    // En el idioma de dominantes la séptima mayor es de otra música: el IIImaj7 o el
    // VImaj7 en un vamp de funk suenan a balada (el quinto examen), y en un blues a
    // otro grupo. Las de `STYLES` no separan las cuatríadas entre sí.
    if (acorde.especie === 'major7' && (j.estilo === 'funk' || j.estilo === 'blues')) {
      return 0;
    }
    // Un grado de la escala con su especie **es** esa especie: el peso «de la
    // tonalidad» de `STYLES` es el de la tríada, y el ii7 de un jazz no es una
    // tríada a medias. Promediándolos, lo más de casa en jazz —una cuatríada de la
    // escala— valía 0,17 y no separaba nada; al retocar, donde casi todo lo que
    // entra es de la escala, el estilo apenas movía el menú. Lo que viene de fuera
    // —un préstamo, una secundaria— sí es las dos cosas, y pesa la media.
    const deLaEspecie = pesos[FAMILIA_DE_ESPECIE[acorde.especie]];
    return familiaDelGrado(j, acorde) === 'diatonic' ? deLaEspecie : (delGrado + deLaEspecie) / 2;
  });
  const media = familias.reduce((suma, peso) => suma + peso, 0) / familias.length;
  const base = acotar((media / maximo - 0.7) * 3.4);
  // Un sustituto tritonal o un napolitano donde el estilo no los usa nunca no
  // es un color: es otro idioma. Los demás que pesan cero —un disminuido en
  // pop— restan, pero son de la tonalidad y no se descartan.
  // Si ya lo tocas, es tu idioma: un bII que abre tu canción puede volver a sonar.
  const tuyos = new Set(j.original.map((acorde) => acorde.degree));
  const ajeno = nuevos.find((acorde) => {
    const familia = familiaDelGrado(j, acorde);
    return (
      (familia === 'tritoneSub' || familia === 'neapolitan') &&
      pesos[familia] === 0 &&
      !tuyos.has(acorde.degree)
    );
  });

  const { giros, enlaces } = girosDelEstilo(j.estilo, j.cancion, j.cambiados);
  const buenos = giros.filter(([, bueno]) => bueno);
  const malos = giros.filter(([, bueno]) => !bueno);
  // **Al retocar, un giro de casa también se puede quitar**, y eso cuenta como
  // ponerlo. Al continuar lo tuyo va delante tal cual y no se pierde nada; al
  // retocar, cambiar el iv de un `IV iv I` de cine o el ii de un `ii V I` de jazz
  // salía gratis, y el estilo solo sabía premiar lo que entraba.
  // Pero cambiar un giro por otro de casa no quita nada —el bII7 en lugar del V de
  // un `ii V I` es el sustituto tritonal, jazz igual—: solo cuenta lo que se pierde
  // sin otro giro bueno en su lugar. Y cuenta una vez, y la mitad que ponerlo: un
  // acorde cambiado deshace a la vez todos los giros que pasan por él —el `I IV` y
  // el `IV V I` de un folk—, y retocar es cambiar acordes; contarlos todos y enteros
  // castigaba cualquier cambio de un acorde muy usado. Echar de menos un giro se
  // nota menos que oír uno de casa. Se nombra el más largo, que es el que más dice.
  const quedan = new Set(girosDelEstilo(j.estilo, j.cancion, null).giros);
  const quitados =
    j.kind === 'retocar'
      ? girosDelEstilo(j.estilo, j.original, j.cambiados).giros.filter(
          (giro) => giro[1] && !quedan.has(giro),
        )
      : [];
  const perdidos =
    quitados.length > buenos.length
      ? [...quitados].sort((x, y) => y[0].length - x[0].length).slice(0, 1)
      : [];
  // Un giro que el estilo no usa resta más de lo que suma uno típico: oírlo
  // fuera de sitio se nota más que echarlo de menos.
  const valor = acotar(
    0.5 * base + (0.8 * buenos.length - 0.4 * perdidos.length - 1.2 * malos.length) / enlaces,
  );

  // El motivo cuenta lo que pesa en el valor: si resta, lo que resta. Antes decía
  // «acordes de la tonalidad, lo de casa» de un V/V que restaba en folk.
  const cual = familias.indexOf(Math.min(...familias));
  const raro = nuevos[cual]!;
  const suyas = [familiaDelGrado(j, raro)];
  if (raro.especie !== null) {
    suyas.push(FAMILIA_DE_ESPECIE[raro.especie]);
  }
  const suFamilia = suyas.sort((a, b) => pesos[a] - pesos[b])[0]!;
  const nombre = `${raro.degree}${raro.especie === null ? '' : `(${raro.especie})`}`;
  const deCasa = familias[cual]! >= 0.7 * maximo;
  let motivo: string;
  if (malos.length > 0 && (valor < 0 || buenos.length === 0)) {
    motivo = `${malos[0]![2]}.`;
  } else if (perdidos.length > 0 && (valor < 0 || buenos.length === 0)) {
    motivo = `Quita ${perdidos[0]![2]}.`;
  } else if (buenos.length > 0 && valor >= 0) {
    motivo = `${buenos[buenos.length - 1]![2]}.`;
  } else if (!deCasa) {
    motivo = `${nombre} es ${NOMBRE_DE_FAMILIA[suFamilia]}, y en ${j.estilo} pesa poco.`;
  } else if (suFamilia === 'diatonic') {
    motivo = `Acordes de la tonalidad, lo de casa en ${j.estilo}.`;
  } else {
    motivo = `${nombre} es ${NOMBRE_DE_FAMILIA[suFamilia]}, de casa en ${j.estilo}.`;
  }
  if (ajeno !== undefined) {
    return {
      valor: -1,
      motivo: `${ajeno.degree} como ${ajeno.funcion === 'tritono' ? 'sustituto tritonal' : 'napolitano'} no se usa en ${j.estilo}.`,
      aplica: true,
      descarte: `${ajeno.degree} no es de ${j.estilo}`,
    };
  }
  return { valor, motivo, aplica: true };
}
