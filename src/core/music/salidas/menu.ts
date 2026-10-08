/**
 * El menú de salidas: lo que construyen los caminos, juzgado y ordenado.
 *
 * Es la puerta del motor: `salidasPosibles` llama a cada camino, pasa lo
 * construido por el juez (`juez/`) y ordena con variedad; `porQueNoHaySalidas`
 * explica un menú vacío.
 */
import type { KeyMode } from '../keys';
import { degreesFor } from '../progressions';
import type { SectionRole } from '../song';
import { LARGO_MAXIMO_DE_LO_QUE_HACE, LARGO_MAXIMO_DEL_NOMBRE, type Borrador } from './borrador';
import { coloresDe } from './colores';
import { SIN_CONTEXTO, type ContextoDeSalidas } from './contexto';
import { contrastes } from './contraste';
import { esUnBluesAMedias } from './coros';
import { tuyo } from './especies';
import { estiramientos } from './estirar';
import { idiomaDe, PIDEN_LLEGADA, type Idioma } from './idioma';
import { encaje, ENCAJE_MINIMO } from './juez/encaje';
import { esUnaBajada } from './juez/notas-comunes';
import { otrosFinales } from './otro-final';
import { partidas, rearmonizaciones } from './rearmonizar';
import { continuaciones, laUltimaVuelta } from './seguir';
import {
  MAX_SALIDAS_POSIBLES,
  MINIMO_DEL_MENU,
  type CandidataAJuzgar,
  type LoQueSeAnade,
  type ParteDeSalida,
  type PathId,
  type PathKind,
  type PathStep,
  type SalidaPosible,
} from './tipos';
import { tonicaDe } from './tonica';
import { canFollow, MAX_PATH_STEPS, songProblem } from './validar';

function continuarCon(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const cierran = [...laUltimaVuelta(id, original), ...continuaciones(id, original)];
  // Una forma empezada se completa antes de añadir otra parte.
  if (esUnBluesAMedias(id, original)) {
    return cierran;
  }
  const llevaALaLlegada = PIDEN_LLEGADA.has(id.papel) && cierran.length >= MINIMO_DEL_MENU;
  const vuelven = llevaALaLlegada ? [] : contrastes(id, original);
  return [...(id.papel === 'intro' && vuelven.length > 0 ? [] : cierran), ...vuelven];
}

/** Lo que se le quita a una salida por cada una ya elegida del mismo camino. */
const PENA_POR_CAMINO = 3;

/** Y por cada una ya elegida de la misma clase: dos cierres desde el V, dos préstamos. */
const PENA_POR_FAMILIA = 5;

/** Lo que hace falta de una candidata para ordenarla. */
export interface CandidataDelMenu {
  readonly path: PathId;
  /** Lo que dijo el juez, de 0 a 100. */
  readonly puntos: number;
  readonly familia: string;
  /** Lo que cree el generador: desempata, no manda. */
  readonly prioridad: number;
  /** Si es relleno (`esRelleno`): la variedad no lo sube a las que se enseñan. */
  readonly relleno?: boolean;
}

/**
 * **Relleno**: estirar una toma que ya iba a tiempo y cuyos acordes se pueden
 * retocar. Los mismos acordes a otra velocidad no proponen nada; entraban entre las
 * tres que se enseñan solo porque eran de otro camino (el quinto examen).
 *
 * Estirar sí propone algo en tres casos: lo que se tocó desigual —cuadrarlo, y lo
 * dice su color—, un acorde solo, que no tiene otro compás que retocar, y una
 * bajada (`esUnaBajada`), que es la forma: ahí lo que se retoca es el reparto (los
 * pidió el corpus de verificación).
 */
export function esRelleno(
  tuyos: readonly PathStep[],
  salida: Pick<SalidaPosible, 'path' | 'colores'>,
): boolean {
  const grados = tuyos.map((paso) => paso.degree);
  // El modo sale de los grados: una bajada lo es en el modo en que existen todos.
  const bajada = (['major', 'minor'] as const).some(
    (mode) =>
      grados.every((grado) => degreesFor(mode).includes(grado)) && esUnaBajada(mode, grados),
  );
  return (
    salida.path === 'estirar' &&
    !salida.colores.includes('cuadra') &&
    new Set(grados).size > 1 &&
    !bajada
  );
}

/**
 * Las mejores primero, **con variedad**: cada vez se elige la que más puntos
 * tiene después de restarle lo que se parece a las ya elegidas —un poco por ser del
 * mismo camino, más por ser de la misma clase—.
 *
 * **Manda la calidad**: la pena es de unos pocos puntos, así que una salida que el
 * juez pone muy por encima sale primero aunque repita camino. Lo que evita es que,
 * entre dos casi iguales, las nueve del menú sean nueve cierres desde el V. Y a
 * igualdad de todo, lo que cree el generador y después el orden en que llegaron:
 * el menú se construye dos veces por petición y tiene que salir igual.
 */
export function ordenarConVariedad<C extends CandidataDelMenu>(
  candidatas: readonly C[],
  cuantas: number,
): C[] {
  const quedan = candidatas.map((candidata, orden) => ({ candidata, orden }));
  const elegidas: C[] = [];
  const porCamino = new Map<string, number>();
  const porFamilia = new Map<string, number>();
  while (elegidas.length < cuantas && quedan.length > 0) {
    const nota = ({ candidata }: { candidata: C }) =>
      candidata.puntos -
      PENA_POR_CAMINO * (porCamino.get(candidata.path) ?? 0) -
      PENA_POR_FAMILIA * (porFamilia.get(candidata.familia) ?? 0);
    // En las que se enseñan, el relleno no entra por variedad: solo si lo que queda
    // no lo supera en puntos.
    const enseñadas = elegidas.length < MINIMO_DEL_MENU;
    const mejorQue = (relleno: { candidata: C }) =>
      quedan.some(
        ({ candidata }) =>
          candidata.relleno !== true && candidata.puntos > relleno.candidata.puntos,
      );
    const vale = (q: { candidata: C }) =>
      !(enseñadas && q.candidata.relleno === true && mejorQue(q));
    let mejor = quedan.findIndex(vale);
    for (let i = mejor + 1; i < quedan.length; i += 1) {
      if (!vale(quedan[i]!)) {
        continue;
      }
      const a = quedan[i]!;
      const b = quedan[mejor]!;
      const diferencia =
        nota(a) - nota(b) || a.candidata.prioridad - b.candidata.prioridad || b.orden - a.orden;
      if (diferencia > 0) {
        mejor = i;
      }
    }
    const [{ candidata }] = quedan.splice(mejor, 1) as [{ candidata: C; orden: number }];
    elegidas.push(candidata);
    porCamino.set(candidata.path, (porCamino.get(candidata.path) ?? 0) + 1);
    porFamilia.set(candidata.familia, (porFamilia.get(candidata.familia) ?? 0) + 1);
  }
  return elegidas;
}

/**
 * Las salidas que el dominio sabe construir para tu canción, **las que mejor
 * encajan primero** y repartidas.
 *
 * **Es la respuesta a que el modelo copiara.** Con el ejemplo en el prompt,
 * `qwen3:8b` devolvía el ejemplo tal cual 21 veces de 22: lo que ponía de suyo era
 * el título. Así que lo que se le da ya no es un ejemplo, es **el menú**: todo lo
 * que hay aquí es válido por construcción —sale de los movimientos, el grafo y
 * las cadencias que lo juzgan, y aun así pasa por `songProblem` antes de
 * entrar—, y lo que hace el modelo es elegir con tus directrices delante y
 * explicar por qué. La línea de [adr/0011] no se mueve: el dominio verifica; lo
 * que cambia es que ahora también propone.
 *
 * **Válida no es buena**, y por eso se construyen muchas más de las que caben y
 * las ordena el juez (`juez/`): lo que tiene un descarte no entra nunca, lo
 * que no llega al mínimo solo entra para que haya tres donde elegir —detrás, con
 * sus puntos—, y de lo demás sale primero lo que mejor encaja, con variedad
 * (`ordenarConVariedad`). Lo que se construye ya mira el contexto —el estilo
 * decide cuánto cuesta un préstamo, el papel cómo se llama lo que sigue, la duda
 * qué no se toca—, para que lo bueno esté entre las candidatas: si una buena
 * salida no se construye, nadie puede elegirla.
 *
 * Deterministas: la ruta lo construye al escribir el prompt y otra vez al validar,
 * y las dos veces tienen que salir iguales, porque el modelo contesta por número.
 */
/** Lo que el juez necesita de una candidata: la canción entera y lo que es lo añadido. */
function aJuzgar(candidata: CandidataDeSalida): CandidataAJuzgar {
  return {
    path: candidata.path,
    cancion: candidata.secciones.flatMap((seccion) => seccion.steps),
    ...(candidata.loQueSeAnade === undefined ? {} : { loQueSeAnade: candidata.loQueSeAnade }),
    ...(candidata.papelNuevo === undefined ? {} : { papelNuevo: candidata.papelNuevo }),
  };
}

export function salidasPosibles(
  mode: KeyMode,
  kind: PathKind,
  original: readonly PathStep[],
  /** Lo que se sabe además de los grados: estilo, especies, papel, punteo… */
  contexto: ContextoDeSalidas = SIN_CONTEXTO,
): readonly SalidaPosible[] {
  const juzgadas = candidatasDeSalida(mode, kind, original, contexto).flatMap((candidata) => {
    const { prioridad, familia, path, secciones, nombre, que, colores } = candidata;
    // Lo que va al menú es la salida, sin lo que solo sirve para juzgarla y ordenarla.
    const salida: SalidaPosible = { path, secciones, nombre, que, colores };
    const juicio = encaje(mode, kind, original, contexto, aJuzgar(candidata));
    // Lo que tiene un descarte no entra nunca: es un error que el juez sabe nombrar.
    if (juicio.descarte !== null) {
      return [];
    }
    return [
      {
        path: salida.path,
        puntos: juicio.puntos,
        familia,
        prioridad,
        relleno: esRelleno(original, salida),
        salida: { ...salida, encaje: juicio },
      },
    ];
  });
  const buenas = juzgadas.filter((c) => c.puntos >= ENCAJE_MINIMO);
  // **La red**: si lo que llega al mínimo no da para elegir, entra lo mejor de lo
  // que se queda debajo, detrás de todo lo bueno y con sus puntos a la vista. Con
  // una canción rara —un acorde que ningún grado prepara, una toma que no cuadra—
  // todo encaja a medias, y un menú de una salida no deja elegir nada: la que no
  // llega a cincuenta tiene más en contra que a favor, pero no rompe nada que el
  // juez sepa nombrar, que es lo que separa «flojo» de «mal». Las que lo rompen se
  // han quedado fuera arriba, y ahí siguen.
  const faltan = Math.max(0, MINIMO_DEL_MENU - buenas.length);
  // Y en la red, primero lo que no rompe nada que el juez proteja: un reparo —tu
  // tónica del compás 1, tu color, tu línea de bajo— entra solo si no queda otra
  // cosa. Una de 49 puntos que cambiaba la i del compás 1 se colaba entre las tres
  // que se enseñan por delante de otras sin reparo (el quinto examen).
  const red = juzgadas
    .filter((c) => c.puntos < ENCAJE_MINIMO)
    .sort(
      (a, b) =>
        Number(a.salida.encaje.reparo !== undefined) -
          Number(b.salida.encaje.reparo !== undefined) ||
        b.puntos - a.puntos ||
        b.prioridad - a.prioridad,
    )
    .slice(0, faltan);
  return [...ordenarConVariedad(buenas, MAX_SALIDAS_POSIBLES), ...red].map((c) => c.salida);
}

/**
 * Por qué no hay ninguna salida que ofrecer, dicho para quien lo lee, o nulo si
 * las hay.
 *
 * Antes el menú salía vacío sin más, y la pantalla no tenía qué decir. Los motivos
 * son límites de la música o del gasto, no del generador:
 *
 * - **Continuar una canción que llena el tope**: lo tuyo va entero delante y detrás
 *   tiene que caber algo, y con `MAX_PATH_STEPS` acordes no cabe nada —el tope es
 *   el de la factura, no se estira—; con uno menos cabe un acorde, y uno solo solo
 *   sirve si es la llegada.
 * - **Que todo lo que se puede construir lo descarte el juez**: un final que no
 *   llega a casa y no puede llegar sin alargarse, un último acorde que solo sabe ir
 *   a donde la canción no quiere. Se dice con las palabras del juez.
 */
export function porQueNoHaySalidas(
  mode: KeyMode,
  kind: PathKind,
  original: readonly PathStep[],
  contexto: ContextoDeSalidas = SIN_CONTEXTO,
): string | null {
  if (original.length === 0) {
    return 'No hay nada tocado todavía: toca algo y vuelve a pedirlo.';
  }
  const ultimo = original.at(-1)!.degree;
  const tonica = tonicaDe(mode);
  if (kind === 'continuar' && original.length >= MAX_PATH_STEPS) {
    return `Tu canción ya tiene ${original.length} acordes, lo más largo que puede ser una salida: detrás no cabe nada más. Prueba a retocarla.`;
  }
  if (
    kind === 'continuar' &&
    original.length === MAX_PATH_STEPS - 1 &&
    (ultimo === tonica || !canFollow(mode, ultimo, tonica))
  ) {
    return `Detrás de tus ${original.length} acordes solo cabe uno más, y con uno no se llega a casa desde tu ${ultimo}. Prueba a retocarla.`;
  }
  if (salidasPosibles(mode, kind, original, contexto).length > 0) {
    return null;
  }
  // Lo que se construye y el juez descarta, dicho con sus palabras: lo que más se
  // repite. Pasa con un último acorde que solo sabe ir a donde la canción no quiere
  // ir —un VII7 que lleva al iii, con su sensible, en un riff que eligió no tenerla—.
  // Todas tienen descarte: lo que no lo tiene entra en el menú por la red.
  const descartes = candidatasDeSalida(mode, kind, original, contexto)
    .map((candidata) => encaje(mode, kind, original, contexto, aJuzgar(candidata)).descarte)
    .filter((descarte): descarte is string => descarte !== null);
  /* v8 ignore next 3 -- no debería pasar nunca, y lo vigila la prueba de «siempre hay
     donde elegir»: si no hay nada construido, es que el generador no sabe, no la música */
  if (descartes.length === 0) {
    return SIN_SALIDA;
  }
  const veces = (motivo: string) => descartes.filter((d) => d === motivo).length;
  const motivo = [...descartes].sort((a, b) => veces(b) - veces(a))[0]!;
  return `Lo que se puede construir desde tu ${ultimo} no encaja: ${motivo}. Prueba a cambiar el final.`;
}

/**
 * Lo que se dice cuando no hay salida y no se sabe decir por qué. **No debería
 * verse nunca**: está para que la pantalla no se quede muda, y la prueba de «siempre
 * hay donde elegir» exige que no salga.
 */
export const SIN_SALIDA =
  'No hay ninguna salida que encaje con lo que llevas. Prueba a cambiar algo.';

/** Lo tuyo con cada acorde en un compás solo, si lo tocas con un ritmo armónico lento. */
interface RitmoLento {
  readonly original: readonly PathStep[];
  readonly contexto: ContextoDeSalidas;
  /** Los pulsos de cada compás tuyo: los que tiene que llevar lo nuevo. */
  readonly pasos: number;
}

/**
 * Si lo tuyo **cambia de acorde cada dos compases o más**, escrito compás a compás
 * —`i i VI VI III III VII VII`—, lo mismo con cada acorde en un solo paso.
 *
 * Lo que se añadía iba a un acorde por compás, porque ese era el largo de tus
 * pasos, y el ritmo armónico de la canción —un acorde cada dos compases— se
 * rompía en todas las salidas menos en la que copiaba tu frase. Lo encontró el
 * corpus final. Ahora lo que sigue se construye sobre tus acordes enteros y se
 * escribe como tú, compás a compás (`alPasoDeLoTuyo`).
 *
 * Solo con todo regular: los mismos pulsos en cada paso, cada acorde el mismo
 * número de pasos —dos o más— y al menos tres acordes, que es cuando un ritmo es
 * un ritmo y no un acorde que se alarga.
 */
function ritmoLento(original: readonly PathStep[], contexto: ContextoDeSalidas): RitmoLento | null {
  const pasos = original[0]!.beats;
  if (original.some((paso) => paso.beats !== pasos)) {
    return null;
  }
  const rachas: number[][] = [];
  original.forEach((paso, i) => {
    if (i > 0 && original[i - 1]!.degree === paso.degree) {
      rachas.at(-1)!.push(i);
    } else {
      rachas.push([i]);
    }
  });
  const largo = rachas[0]!.length;
  if (largo < 2 || rachas.length < 3 || rachas.some((racha) => racha.length !== largo)) {
    return null;
  }
  const deLaRacha = <T>(lista: readonly T[] | undefined, junta: (de: readonly T[]) => T) =>
    lista === undefined ? undefined : rachas.map((racha) => junta(racha.map((i) => lista[i]!)));
  const especies = deLaRacha(contexto.especies, (de) =>
    de.every((especie) => especie === de[0]) ? de[0]! : null,
  );
  const dudosos = deLaRacha(contexto.dudosos, (de) => de.some(Boolean));
  const melodia = deLaRacha(contexto.melodia, (de) => de.flat());
  return {
    original: rachas.map((racha) => ({
      degree: original[racha[0]!]!.degree,
      beats: pasos * largo,
    })),
    contexto: {
      ...contexto,
      ...(especies === undefined ? {} : { especies }),
      ...(dudosos === undefined ? {} : { dudosos }),
      ...(melodia === undefined ? {} : { melodia }),
    },
    pasos,
  };
}

/** Lo que se construyó con tus acordes enteros, escrito compás a compás como lo tuyo. */
function alPasoDeLoTuyo(borrador: Borrador, pasos: number): Borrador {
  return {
    ...borrador,
    partes: borrador.partes.map((parte) => ({
      ...parte,
      steps: parte.steps.flatMap((paso) =>
        // Compás a compás; lo que no llegue a uno entero —cerca del tope, con lo que
        // sobra repartido de pulso en pulso— se queda con lo que dura.
        Array.from({ length: Math.ceil(paso.beats / pasos) }, (_, k) => ({
          ...paso,
          beats: Math.min(pasos, paso.beats - k * pasos),
        })),
      ),
    })),
  };
}

/** Una salida construida y válida, antes de que la juzgue nadie. */
export interface CandidataDeSalida extends SalidaPosible {
  /** Lo que cree el generador que vale: desempata lo que el juez deja igual. */
  readonly prioridad: number;
  /** Qué clase de salida es, para repartir el menú. */
  readonly familia: string;
  /** Al continuar, qué es lo añadido según quien lo nombra: así lo juzga el juez. */
  readonly loQueSeAnade?: LoQueSeAnade;
  /** Y qué papel tiene, si no es el de `PARTE_QUE_SIGUE`: la B de una AABA es un puente. */
  readonly papelNuevo?: SectionRole;
}

/**
 * Todo lo que el dominio sabe construir para tu canción, **válido y sin juzgar**:
 * lo que `salidasPosibles` le pasa al juez. Aparte para poder mirar qué se
 * construye sin depender de lo que el juez opine, que es otra pregunta.
 */
export function candidatasDeSalida(
  mode: KeyMode,
  kind: PathKind,
  original: readonly PathStep[],
  contexto: ContextoDeSalidas = SIN_CONTEXTO,
): readonly CandidataDeSalida[] {
  if (original.length === 0) {
    return [];
  }
  const id = idiomaDe(mode, original, contexto);
  const tuyos = original.map((_, i) => tuyo(id, original, i));
  const lento = kind === 'continuar' ? ritmoLento(original, contexto) : null;
  const borradores =
    kind === 'retocar'
      ? [
          ...rearmonizaciones(id, original),
          ...partidas(id, original),
          ...estiramientos(id, original),
          ...otrosFinales(id, original),
        ]
      : lento === null
        ? continuarCon(id, original)
        : continuarCon(idiomaDe(mode, lento.original, lento.contexto), lento.original).map(
            (borrador) => alPasoDeLoTuyo(borrador, lento.pasos),
          );

  const vistas = new Set<string>();
  const candidatas: CandidataDeSalida[] = [];
  for (const borrador of borradores) {
    const secciones: ParteDeSalida[] =
      kind === 'continuar'
        ? [{ name: 'Lo que llevas', yours: true, steps: tuyos }, ...borrador.partes]
        : [...borrador.partes];
    const cancion = secciones.flatMap((seccion) => seccion.steps);
    const clave = cancion.map((paso) => `${paso.degree}/${paso.beats}`).join(' ');
    if (
      vistas.has(clave) ||
      songProblem(mode, borrador.path, original, secciones, contexto.estilo ?? null) !== null
    ) {
      continue;
    }
    vistas.add(clave);
    const colores = coloresDe(mode, original, cancion);
    candidatas.push({
      path: borrador.path,
      secciones,
      nombre: borrador.nombre.slice(0, LARGO_MAXIMO_DEL_NOMBRE),
      que: borrador.que.slice(0, LARGO_MAXIMO_DE_LO_QUE_HACE),
      colores: borrador.cuadra === true ? [...colores, 'cuadra'] : colores,
      prioridad: borrador.prioridad,
      familia: borrador.familia,
      ...(borrador.loQueSeAnade === undefined ? {} : { loQueSeAnade: borrador.loQueSeAnade }),
      ...(borrador.papelNuevo === undefined ? {} : { papelNuevo: borrador.papelNuevo }),
    });
  }
  return candidatas;
}
