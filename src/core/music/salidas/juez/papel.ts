/**
 * Criterio 10: el papel de la parte —estrofa, estribillo, puente— y lo que pide.
 */
import { veces } from '../../../cifras';
import type { SectionRole } from '../../song';
import { reposoFrigio } from '../formas';
import { enlace } from './enlace';
import {
  acotar,
  esRelativaDeLaTonica,
  esTension,
  NADA,
  type Acorde,
  type Final,
  type Hecho,
  type Juicio,
} from './juicio';
import { pulsosHabituales } from './ritmo-armonico';

/**
 * Qué parte viene después de la tuya cuando se continúa: **lo que se añade es otra
 * parte**, y se juzga con el papel que le toca a ella. Antes el papel de lo tuyo
 * se aplicaba a todo, y el estribillo que seguía a tu pre salía castigado con «el
 * pre cierra en la tónica».
 *
 * **Una parte, y la misma para quien la construye y para quien la juzga.** Antes
 * aquí tras una estrofa podían ir un pre o un estribillo y valía el que mejor le
 * sentara, mientras las salidas lo llamaban siempre estribillo: «Un estribillo por
 * I V/ii ii V» salía con el motivo «Lo que sigue, el pre, acaba en V». Lo encontró
 * el corpus final en casi la mitad de los menús de continuar. Ahora esta tabla es
 * la única, y las salidas la leen para nombrar lo que añaden (`salidas/`).
 *
 * Tras una estrofa, el estribillo. Seguir un estribillo es acabar la canción —el
 * final, que es corto—; contrastarlo, un puente. Tras un final no hay más que una
 * coda, que también es final. Después de un puente vuelve el estribillo, también
 * cuando se pide un contraste: lo que se va del puente tiene que entrar en casa.
 * La idea no tiene papel, y lo que la sigue tampoco.
 */
export const PARTE_QUE_SIGUE: Readonly<
  Record<'seguir' | 'contraste', Readonly<Record<SectionRole, SectionRole | null>>>
> = {
  seguir: {
    idea: null,
    intro: 'estrofa',
    estrofa: 'estribillo',
    pre: 'estribillo',
    estribillo: 'final',
    puente: 'estribillo',
    solo: 'solo',
    final: 'final',
  },
  contraste: {
    idea: null,
    intro: 'estrofa',
    estrofa: 'estribillo',
    pre: 'estribillo',
    estribillo: 'puente',
    puente: 'estribillo',
    solo: 'puente',
    final: 'final',
  },
};

const EL_PAPEL: Readonly<Record<SectionRole, string>> = {
  idea: 'la idea',
  intro: 'la intro',
  estrofa: 'la estrofa',
  pre: 'el pre',
  estribillo: 'el estribillo',
  puente: 'el puente',
  solo: 'el solo',
  final: 'el final',
};

/** Si un acorde tira hacia otro sitio: la tensión o la subdominante que lleva a la parte siguiente. */
function tira(acorde: Acorde): boolean {
  return esTension(acorde) || acorde.funcion === 'subdominante';
}

/** Las partes que pueden acabar en el aire: las que llevan a otra. */
export const QUEDAN_ABIERTAS: ReadonlySet<SectionRole> = new Set([
  'intro',
  'estrofa',
  'pre',
  'puente',
]);

/** Los papeles que se repiten: los únicos en los que lo tuyo puede ser un bucle. */
export const SE_REPITEN: ReadonlySet<SectionRole> = new Set([
  'idea',
  'intro',
  'estrofa',
  'estribillo',
  'solo',
]);

/** La parte de la canción que se juzga con un papel, y cuál. */
interface ParteConPapel {
  /** Una sola: la que dice `PARTE_QUE_SIGUE`, la misma que nombra quien la construye. */
  readonly papel: SectionRole;
  /** Desde qué paso de la canción. */
  readonly desde: number;
  /** Si es la tuya —retocada o completada— o la que viene detrás. */
  readonly tuya: boolean;
}

/**
 * A qué parte se le aplica qué papel.
 *
 * Al retocar, el tuyo a la canción entera. Al continuar, **lo que completa tu
 * frase sigue siendo tuyo** —dos compases más a una estrofa de dos son su
 * segunda mitad—, y lo que empieza en la frase siguiente es la parte que viene
 * detrás.
 */
export function parteConPapel(j: Juicio): ParteConPapel | null {
  const rol = j.contexto.papel;
  if (rol === undefined || rol === 'idea') {
    return null;
  }
  if (j.kind === 'retocar' || j.loQueSeAnade === 'tuya') {
    return { papel: rol, desde: 0, tuya: true };
  }
  const queSigue = PARTE_QUE_SIGUE[j.path === 'contraste' ? 'contraste' : 'seguir'][rol];
  if (j.loQueSeAnade !== undefined) {
    return {
      papel: j.loQueSeAnade === 'misma' ? rol : (j.papelNuevo ?? queSigue!),
      desde: j.original.length,
      tuya: false,
    };
  }
  const frontera = Math.ceil(j.largoOriginal / j.frase) * j.frase;
  const desde = j.cancion.findIndex(
    (acorde, i) => i >= j.original.length && acorde.inicio / j.pc >= frontera,
  );
  if (desde === -1) {
    return { papel: rol, desde: 0, tuya: true };
  }
  return { papel: queSigue!, desde, tuya: false };
}

/** Si la canción, acabando fuera de casa, llega a la tónica al volver a tu principio. */
function llegaAlVolver(j: Juicio): boolean {
  const ultimo = j.cancion[j.cancion.length - 1]!;
  const primero = j.original[0]!;
  return (
    primero.funcion === 'tonica' &&
    ultimo.funcion !== 'tonica' &&
    enlace({ ...j, cancion: [ultimo, primero] }, 1, true).valor >= VUELTA_QUE_LLEGA
  );
}

/**
 * Cuánto tiene que valer el enlace del último acorde al primero para que eso sea
 * una vuelta: una dominante o una subdominante que llevan a casa, el bVII que
 * cierra sin sensible, la rota `V vi`. Un `vi I` o un `III i` llegan de rebote, y
 * eso no es volver: es empezar otra vez.
 */
export const VUELTA_QUE_LLEGA = 0.3;

/**
 * Si la canción **tiene que llegar** a casa y no llega: un final que acaba en el
 * aire, o un estribillo sin llegada. Eso no es una salida floja: es no hacer lo
 * que la parte hace, y no se ofrece.
 *
 * Un estribillo llega si acaba en la tónica o si su último acorde la trae al
 * volver a empezar —`I IV bVI bVII` llega cada vez que se repite—. Lo modal no
 * llega a la tónica de manual, y no se le pide.
 */
export function faltaLaLlegada(j: Juicio, final: Final | null): string | null {
  // Un vamp sin tónica no tiene casa a la que llegar: su final es su centro. Y el V
  // de un flamenco es su reposo (`reposoFrigio`).
  if (
    final !== null ||
    j.modal === 'sin-tonica' ||
    reposoFrigio(
      j.mode,
      j.estilo,
      j.original.map((acorde) => acorde.degree),
      j.cancion.map((acorde) => acorde.degree),
    ) !== null
  ) {
    return null;
  }
  const parte = parteConPapel(j);
  if (parte === null) {
    return null;
  }
  if (parte.papel === 'final') {
    return 'un final que acaba abierto';
  }
  // Lo que sigue a un puente vuelve a casa: si contrasta, al entrar, que es lo
  // único que un contraste puede hacer.
  const entraEnCasa = !parte.tuya && j.cancion[parte.desde]!.funcion === 'tonica';
  if (j.path === 'contraste' && j.contexto.papel === 'puente' && !entraEnCasa) {
    return 'lo que sigue al puente no vuelve a casa';
  }
  // El estribillo que contrasta vuelve a tu principio por definición: de él solo
  // se mira cómo entra, en el papel.
  const estribillo = parte.papel === 'estribillo';
  if (j.path === 'contraste' || !estribillo) {
    return null;
  }
  // El que viene detrás de otra parte puede llegar al entrar: el compás fuerte
  // del estribillo, en casa, es la llegada que el pre o el puente preparaban. El
  // tuyo, si cerraba, tiene que seguir cerrando: llegar solo al repetirse es
  // quitarle el final que tenía. Si no cerraba, vale que llegue al volver, o que
  // sea modal, que llega a su manera.
  const tuCerrabas = parte.tuya && j.original[j.original.length - 1]!.funcion === 'tonica';
  if (entraEnCasa || (!tuCerrabas && (llegaAlVolver(j) || j.modal !== null))) {
    return null;
  }
  // Retocar un estribillo que ya no llegaba no le quita nada: lo que se descarta
  // es la salida que se lleva tu llegada, no la que respeta que no la tuvieras.
  const tuLlegabas =
    j.original[j.original.length - 1]!.funcion === 'tonica' ||
    llegaAlVolver({ ...j, cancion: j.original });
  return parte.tuya && !tuLlegabas ? null : 'un estribillo sin llegada';
}

/**
 * Lo que mira cualquier papel de la parte que le toca, leído una vez.
 *
 * Cada papel se juzga en su función (`POR_PAPEL`), y todas parten de lo mismo:
 * qué pasos son de la parte, cómo acaba, cómo acababa lo tuyo y cómo se la nombra.
 */
interface LoQueVeElPapel {
  readonly j: Juicio;
  readonly final: Final | null;
  readonly parte: ParteConPapel;
  readonly pasos: readonly Acorde[];
  readonly ultimo: Acorde;
  readonly primero: Acorde;
  readonly cierraFuerte: boolean;
  /** Al retocar, lo que trae la salida; al continuar, la parte nueva entera. */
  readonly nuevos: readonly Acorde[];
  readonly retoca: boolean;
  readonly tuyoCerraba: boolean;
  readonly tuyoTiraba: boolean;
  /** Cómo empieza el motivo: «El estribillo», «Lo que sigue, el puente,»… */
  readonly quien: string;
}

function loQueVeElPapel(
  j: Juicio,
  final: Final | null,
  rol: SectionRole,
  parte: ParteConPapel,
): LoQueVeElPapel {
  const pasos = j.cancion.slice(parte.desde);
  // Cómo acababa lo tuyo: lo que la salida respeta no es culpa suya. Y solo al
  // retocar: al continuar, lo que completa tu frase llega donde lo tuyo pedía.
  const tuUltimo = j.original[j.original.length - 1]!;
  return {
    j,
    final,
    parte,
    pasos,
    ultimo: pasos[pasos.length - 1]!,
    primero: pasos[0]!,
    cierraFuerte: final?.cierre === 'perfecta' || final?.cierre === 'sin-sensible',
    nuevos: parte.tuya ? [...j.cambiados].map((i) => j.cancion[i]!) : pasos,
    retoca: j.kind === 'retocar',
    tuyoCerraba: tuUltimo.funcion === 'tonica',
    tuyoTiraba: tira(tuUltimo),
    // Lo que se añade a un final o a un solo es más de lo mismo: se nombra así.
    quien: parte.tuya
      ? EL_PAPEL[rol].charAt(0).toUpperCase() + EL_PAPEL[rol].slice(1)
      : j.contexto.papel === rol
        ? `Lo que se añade a${EL_PAPEL[rol].replace(/^el /, 'l ').replace(/^la /, ' la ')}`
        : `Lo que sigue, ${EL_PAPEL[rol]},`,
  };
}

function estrofa({ final, quien, ultimo }: LoQueVeElPapel): Hecho {
  return final === null
    ? {
        valor: 0.5,
        motivo: `${quien} acaba en ${ultimo.degree}: queda abierta para repetirse.`,
      }
    : { valor: 0.3, motivo: `${quien} cierra en la tónica.` };
}

function intro({ quien, ultimo, cierraFuerte }: LoQueVeElPapel): Hecho {
  if (esTension(ultimo)) {
    return {
      valor: 0.6,
      motivo: `${quien} acaba en ${ultimo.degree}: deja la entrada servida.`,
    };
  }
  // Una intro que cierra con cadencia suena a final antes de empezar: lo que
  // la hace intro es que deja algo por llegar.
  return cierraFuerte
    ? { valor: -0.5, motivo: `${quien} cierra con cadencia: suena a final antes de empezar.` }
    : { valor: 0.3, motivo: `${quien} deja puesto el tono.` };
}

function pre(v: LoQueVeElPapel): Hecho {
  const { final, quien, ultimo, cierraFuerte, tuyoCerraba, tuyoTiraba, retoca, parte } = v;
  if (tira(ultimo)) {
    return {
      valor: 1,
      motivo: `${quien} acaba en ${ultimo.degree}: deja el estribillo servido.`,
    };
  }
  // Solo se descarta lo que trae la salida: un pre tuyo que ya cerraba, o que
  // ya acababa sin empujar, es cosa tuya.
  const cierra = final !== null && cierraFuerte && !tuyoCerraba;
  const descarte = !retoca
    ? null
    : cierra
      ? 'un pre que cierra'
      : tuyoTiraba
        ? 'quita lo que llevaba a la parte siguiente'
        : null;
  return {
    ...(final !== null
      ? {
          valor: -1,
          motivo: `${quien} cierra en la tónica y le quita la llegada al estribillo.`,
        }
      : { valor: -0.5, motivo: `${quien} acaba en ${ultimo.degree}, que no empuja.` }),
    ...(descarte !== null && parte.tuya ? { descarte } : {}),
  };
}

/**
 * Un estribillo llega: empieza en casa —o en el IV o la relativa, que son
 * llegadas de otro color— y cierra fuerte. El que contrasta vuelve a tu
 * principio, así que de él solo se mira cómo entra.
 */
function estribillo({
  j,
  final,
  parte,
  quien,
  primero,
  ultimo,
  cierraFuerte,
}: LoQueVeElPapel): Hecho {
  // Pero entrar en uno de los dos acordes de tu vaivén no es llegar: detrás de un
  // pre en `VI VII VI VII`, el VI es más de lo mismo.
  const delVaiven = !parte.tuya && j.vamp?.includes(primero.degree) === true;
  const entra =
    primero.funcion === 'tonica' ||
    (!delVaiven &&
      (primero.degree === 'IV' || primero.degree === 'iv' || esRelativaDeLaTonica(primero.degree)));
  const inicio = entra ? 0.3 : -0.3;
  if (j.path === 'contraste') {
    return {
      valor: acotar(2 * inicio),
      motivo: entra
        ? `${quien} entra en ${primero.degree}, que es llegar.`
        : `${quien} entra en ${primero.degree}, que no es llegar a ningún sitio.`,
    };
  }
  const llega = llegaAlVolver(j) || (!parte.tuya && primero.funcion === 'tonica');
  const cierre = cierraFuerte ? 0.7 : final !== null ? 0.2 : llega ? 0 : -0.7;
  return {
    valor: acotar(inicio + cierre),
    motivo: cierraFuerte
      ? `${quien} empieza en ${primero.degree} y cierra fuerte.`
      : final !== null
        ? `${quien} empieza en ${primero.degree} y cierra sin cadencia fuerte.`
        : `${quien} empieza en ${primero.degree} y acaba en ${ultimo.degree}, sin cerrar.`,
  };
}

/**
 * Un puente se va y prepara la vuelta: no pasa por casa, y su último acorde
 * tira hacia ella. El que acaba en la tónica ya ha vuelto, y lo que venía
 * detrás pierde la llegada, como un pre que cierra.
 */
function puente(v: LoQueVeElPapel): Hecho {
  const { j, final, parte, quien, ultimo, nuevos, retoca, cierraFuerte, tuyoCerraba, tuyoTiraba } =
    v;
  const tonicas = nuevos.filter((acorde) => acorde.funcion === 'tonica').length;
  const prepara = tira(ultimo);
  const yaHaVuelto = parte.tuya && final !== null && !tuyoCerraba;
  const descarte = !retoca
    ? null
    : yaHaVuelto && cierraFuerte
      ? 'un puente que ya ha vuelto'
      : tuyoTiraba && !prepara
        ? 'quita lo que llevaba a la parte siguiente'
        : null;
  // Al retocar se cuentan las tónicas que trae la salida, no las tuyas: si tu
  // puente ya pasaba por casa, decir que «no pasa» sería mentira, y lo que se
  // cuenta es lo que cambia.
  const lasTuyas =
    retoca && j.original.some((acorde) => acorde.funcion === 'tonica') ? 'Lo que cambia' : null;
  return {
    valor: acotar((tonicas === 0 ? 0.5 : -0.5 * tonicas) + (prepara ? 0.5 : -0.5)),
    motivo: yaHaVuelto
      ? `${quien} acaba en la tónica: ya ha vuelto, y la vuelta pierde su llegada.`
      : tonicas > 0
        ? `${lasTuyas ?? quien} pasa ${veces(tonicas)} por la tónica: la vuelta se gasta antes de tiempo.`
        : prepara
          ? lasTuyas === null
            ? `${quien} no pasa por la tónica y acaba en ${ultimo.degree}, que tira hacia ella.`
            : `${lasTuyas} no trae la tónica, y ${quien.toLowerCase()} acaba en ${ultimo.degree}, que tira hacia ella.`
          : `${quien} acaba en ${ultimo.degree}, que no prepara la vuelta.`,
    ...(descarte === null ? {} : { descarte }),
  };
}

function finalDeLaCancion({
  j,
  final,
  parte,
  pasos,
  quien,
  ultimo,
  cierraFuerte,
}: LoQueVeElPapel): Hecho {
  // Una coda plagal: después de llegar con V I, un IV I de despedida.
  const coda =
    final?.cierre === 'plagal' &&
    (final.antes!.degree === 'IV' || final.antes!.degree === 'iv') &&
    j.cancion.some(
      (acorde, i) => acorde.funcion === 'dominante' && j.cancion[i + 1]?.funcion === 'tonica',
    );
  // Lo que sigue a un final es una coda, y una coda es corta: más de una frase
  // —cuatro acordes al paso de lo tuyo— detrás de un final es otra canción.
  const largoDeLaParte = (j.largo * j.pc - pasos[0]!.inicio) / j.pc;
  const unaFrase = (4 * pulsosHabituales(j.original, j.pc)) / j.pc;
  if (!parte.tuya && largoDeLaParte > unaFrase) {
    return {
      valor: -1,
      motivo: `${quien} dura ${largoDeLaParte} compases: una coda no es otra canción.`,
      reparo: 'una coda que es otra canción',
    };
  }
  return coda
    ? { valor: 1, motivo: `${quien} llega con la dominante y se despide con una coda plagal.` }
    : cierraFuerte
      ? { valor: 1, motivo: `${quien} cierra fuerte.` }
      : final !== null
        ? { valor: 0.5, motivo: `${quien} cierra, pero sin dominante.` }
        : { valor: -1, motivo: `${quien} acaba en ${ultimo.degree}, sin cerrar.` };
}

function solo({ j, nuevos, quien }: LoQueVeElPapel): Hecho {
  const tuyos = new Set(j.original.map((acorde) => acorde.degree));
  const ajenos = new Set(
    nuevos.map((acorde) => acorde.degree).filter((grado) => !tuyos.has(grado)),
  );
  return ajenos.size === 0
    ? { valor: 1, motivo: `${quien} va sobre acordes que ya han sonado.` }
    : {
        valor: acotar(1 - 0.5 * ajenos.size),
        motivo: `${quien} mete ${[...ajenos].join(', ')}, que no habían sonado.`,
      };
}

/** Cómo juzga cada papel la parte que le toca. */
const POR_PAPEL: Readonly<Record<SectionRole, (v: LoQueVeElPapel) => Hecho>> = {
  estrofa,
  intro,
  pre,
  estribillo,
  puente,
  final: finalDeLaCancion,
  solo,
  /* v8 ignore next -- `parteConPapel` no devuelve nunca la idea: no tiene papel que juzgar */
  idea: () => NADA,
};

export function papel(j: Juicio, final: Final | null): Hecho & { readonly aplica: boolean } {
  const parte = parteConPapel(j);
  if (parte === null) {
    return { ...NADA, aplica: false };
  }
  return { ...POR_PAPEL[parte.papel](loQueVeElPapel(j, final, parte.papel, parte)), aplica: true };
}
