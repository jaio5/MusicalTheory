/**
 * El camino `rearmonizar`: los mismos compases con otros acordes.
 *
 * Cada cambio es un movimiento de `movimientos.ts` aplicado a un compás tuyo, y se
 * elige por lo que conserva —la dominante, el bajo, el punteo— además de por lo
 * que aporta. También parte una dominante larga en su ii (`partir.ts`).
 */
import type { EspecieDeBloque } from '../chords';
import { roleOfDegreeSymbol } from '../harmonic-function';
import type { KeyMode } from '../keys';
import { gradosDeLaEscala, resolveDegree, type DegreeSymbol } from '../progressions';
import {
  cambiosEnTexto,
  compasDelAcorde,
  frase,
  prioridadDe,
  retoque,
  type Borrador,
} from './borrador';
import type { NotaDelCompas } from './contexto';
import { especieNueva, paso, tuyo } from './especies';
import { esFuncional, llegadaSostenida, notasDelAcorde, type Idioma } from './idioma';
import { esUnaBajada } from './juez/notas-comunes';
import {
  destinosDelMovimiento,
  MOVES,
  nombreDelCambio,
  type Entorno,
  type Move,
  type MoveId,
} from './movimientos';
import { partirEnIiV } from './partir';
import type { PasoPosible, PathStep } from './tipos';
import { canFollow, esUnVampDeFunk, loQueSigue, pulsosDe } from './validar';
import { fuerzaDeCadencia, laIiEsDeCasa, media, pierdeLaGama, precioDelGrado } from './valor';

/**
 * Cuántas notas fuertes del punteo **chocan** con un acorde: no son suyas y caen
 * medio tono por encima de una que sí —el Fa sobre un Do mayor—. Es el choque que
 * se oye; una nota de paso o una tensión de las que se cantan no cuenta.
 */
function choquesConElPunteo(
  id: Idioma,
  i: number,
  degree: DegreeSymbol,
  especie: EspecieDeBloque | null,
): { fuertes: number; chocan: number; debiles: number } {
  const notas = id.melodia[i] ?? [];
  const acorde = notasDelAcorde(id.mode, degree, especie);
  const choca = (nota: number) => !acorde.has(nota) && acorde.has((nota + 11) % 12);
  const fuertes = notas.filter((nota) => nota.fuerte);
  return {
    fuertes: fuertes.length,
    chocan: fuertes.filter((nota) => choca(nota.nota)).length,
    // Las débiles también, si quedan medio tono por encima de una del acorde: la
    // novena menor no se aguanta en ningún pulso, y el juez le pone reparo.
    debiles: notas.filter((nota) => !nota.fuerte && choca(nota.nota)).length,
  };
}

/**
 * Lo que suena detrás del compás `i` de lo tuyo **según lo que es tu parte**.
 *
 * Detrás del último, `loQueSigue` supone un bucle —lo tuyo vuelve a empezar—, y
 * un pre o un puente no vuelven a su principio: llevan a la parte siguiente, que
 * entra en casa. Un final no tiene nada detrás. Es lo mismo que mira el juez
 * (`Juicio.bucle`): un V/vi al final de un puente prepara un vi que no va a sonar.
 */
function loQueSigueEnTuParte(
  id: Idioma,
  original: readonly PathStep[],
  i: number,
): DegreeSymbol | null {
  if (i < original.length - 1) {
    return original[i + 1]!.degree;
  }
  if (id.papel === 'final') {
    return null;
  }
  return id.papel === 'pre' || id.papel === 'puente' ? id.tonica : loQueSigue(id.mode, original, i);
}

/** Lo que pierde un retoque de un vamp de funk que no es su giro (`rearmonizaciones`). */
const DE_OTRO_IDIOMA = 1;

/**
 * Lo que prefiere el generador de cada movimiento en su sitio, antes del estilo.
 * Son matices de oficio: el IV que pasa a ii delante del V hace un ii–V, el V que
 * pasa a iii pierde la dominante, y la interrumpida al final deja la canción
 * abierta a propósito.
 */
function preferencia(
  id: Idioma,
  move: MoveId,
  grado: DegreeSymbol,
  destino: DegreeSymbol,
  siguiente: DegreeSymbol | null,
  alFinal: boolean,
): number {
  switch (move) {
    case 'relativo':
    case 'funcion':
      // El ii o el ii° delante del V hacen un ii–V; quitarle al V su fundamental o su
      // sensible es perder la dominante.
      return (
        0.5 +
        ((destino === 'ii' || destino === 'ii°') && siguiente === 'V' ? 0.6 : 0) -
        (grado === 'V' || grado === 'v' ? 0.4 : 0)
      );
    case 'intercambio':
      return destino === 'iv' && siguiente === id.tonica
        ? 0.9
        : destino === 'V' && siguiente === id.tonica
          ? 1
          : grado === 'V'
            ? -0.3
            : 0.2;
    case 'prestamo':
      return 0.7;
    case 'interrumpida':
      return alFinal ? 0.9 : 0.6;
    case 'modal':
      return 0.5;
    case 'tritono':
      return 0.3 + 0.8 * id.tritono;
    case 'dominante':
      return destino.includes('/')
        ? 0.8
        : ['ii', 'IV', 'iv', 'ii°', 'bVI'].includes(grado)
          ? 0.6
          : 0.2;
    case 'predominante':
      // Tónica, subdominante, dominante: es lo primero que le hace un arreglista a un
      // V que llega sin preparar. El ii delante del V, si la canción ya prepara así.
      return 0.8 + (laIiEsDeCasa(id) && (destino === 'ii' || destino === 'ii°') ? 0.2 : 0);
    case 'cambio-rapido':
      // El retoque de manual del esquema de un blues, y el único que lo deja entero.
      return 1;
    case 'vaiven':
      // Lo que hace cualquiera con un vamp de funk: irse a un vecino y volver.
      return 1;
    case 'frigio':
      // Bajar medio tono a un centro es el idioma del menor —el de la andaluza, el del
      // flamenco, el del metal—. En mayor el semitono es prestado (el bVI, el bII), y
      // solo entra si el estilo los trae: en un country o un pop sin estilo era un
      // color de otra casa.
      return id.mode === 'major' ? -0.6 : id.estilo === 'flamenco' ? 1 : 0.4;
    case 'ii-v':
      // Partir la dominante en su ii es lo que hace el jazz con cualquier V largo; en
      // tríadas de pop también se oye, pero menos.
      return esFuncional(id) || id.lenguaje === 'septimas' ? 0.9 : 0.4;
  }
}

/** Un cambio de un compás que se puede hacer, con lo que vale. */
interface Cambio {
  readonly i: number;
  readonly move: Move;
  readonly destino: DegreeSymbol;
  readonly especie: EspecieDeBloque | null;
  readonly valor: number;
}

/**
 * Si un cambio deja el compás igual que el de al lado, o le pone al lado la otra
 * dominante del menor.
 *
 * Lo primero no es un sustituto, es alargar el vecino —`ii ii`, `V/V V/V`—, y
 * para que un acorde dure más está `estirar`: salían dieciséis así. Lo segundo es
 * la relación falsa del menor: la v y el V a la vez, con la sensible y sin ella
 * pegadas, como `i v V i`.
 */
function repiteAlVecino(
  destino: DegreeSymbol,
  anterior: DegreeSymbol | null,
  siguiente: DegreeSymbol | null,
): boolean {
  const vecinos = [anterior, siguiente];
  const otraDominante = destino === 'V' ? 'v' : destino === 'v' ? 'V' : null;
  return vecinos.includes(destino) || (otraDominante !== null && vecinos.includes(otraDominante));
}

/**
 * Si el movimiento es de verdad el que dice ser **con las especies que suenan**.
 *
 * Los movimientos se calculan con las tríadas del grado, y con otra especie pueden
 * dejar de ser lo que dicen: en quintas, «mayor por menor» de un IV5 da un iv5, que
 * son las mismas dos notas, y «su relativo» de un IV5 es un ii5 que no comparte
 * ninguna. Lo que no cambia el sonido no se construye, y cada movimiento conserva
 * lo que lo define: el relativo, dos notas en común; el sustituto tritonal, la
 * séptima que lleva el tritono.
 */
function esElMovimiento(
  id: Idioma,
  move: MoveId,
  grado: DegreeSymbol,
  especieDeAntes: EspecieDeBloque | null,
  destino: DegreeSymbol,
  especie: EspecieDeBloque | null,
): boolean {
  const antes = notasDelAcorde(id.mode, grado, especieDeAntes);
  const despues = notasDelAcorde(id.mode, destino, especie);
  const comunes = [...despues].filter((nota) => antes.has(nota)).length;
  if (comunes === antes.size && comunes === despues.size) {
    return false;
  }
  if (move === 'relativo' || move === 'funcion') {
    return comunes >= 2;
  }
  return move !== 'tritono' || especie === 'dominant7';
}

/**
 * Si un acorde de lo tuyo **hace de dominante** del que le sigue: es una dominante
 * por su grado —el V, el vii°, una secundaria— o por su especie —un I7, un VI7—, y
 * lo siguiente está una quinta por debajo, o medio tono si va por el sustituto.
 *
 * Es lo que la especie le cambia a un grado. En el gospel `I I7 IV iv I` el I7 no
 * es una tónica: es la dominante del IV, el V/IV que el catálogo no nombra, y
 * cambiarlo por «su relativo» —un vi— se cargaba la llegada al IV con la excusa de
 * que el I y el vi reposan igual. Lo que hace de dominante solo se cambia por algo
 * que siga siéndolo (`conservaLaDominante`).
 */
function haceDeDominante(
  mode: KeyMode,
  grado: DegreeSymbol,
  especie: EspecieDeBloque | null,
  siguiente: DegreeSymbol | null,
): boolean {
  if (
    siguiente === null ||
    !(roleOfDegreeSymbol(grado) === 'dominant' || grado.includes('/') || especie === 'dominant7')
  ) {
    return false;
  }
  const salto =
    (resolveDegree(0, mode, grado).root - resolveDegree(0, mode, siguiente).root + 12) % 12;
  return salto === 7 || salto === 1;
}

/** Si lo que entra sigue siendo una dominante: por su grado, por ser secundaria o por el tritono. */
function conservaLaDominante(move: MoveId, destino: DegreeSymbol): boolean {
  return move === 'tritono' || destino.includes('/') || roleOfDegreeSymbol(destino) === 'dominant';
}

/**
 * Por qué un cambio es el que dice, **con lo que suena**: el del cambio modal habla
 * de la sensible, y en quintas no hay ninguna que ganar ni que perder.
 */
function porQueDelCambio(cambio: Cambio): string {
  return cambio.move.id === 'modal' && cambio.especie === 'quinta'
    ? 'En quintas no hay tercera ni sensible: los dos tiran a casa, y lo que cambia es el bajo.'
    : cambio.move.why;
}

/**
 * Si lo que entra **se puede tocar sobre el mismo bajo**: tiene la misma
 * fundamental, o lleva dentro la de lo que había y se toca invertido sobre ella
 * —el iv6 sobre el Fa del VI, la v sobre el Sol del VII—. Es lo que deja una línea
 * de bajo entera aunque cambie el acorde.
 */
function sobreElMismoBajo(
  mode: KeyMode,
  grado: DegreeSymbol,
  destino: DegreeSymbol,
  especie: EspecieDeBloque | null,
): boolean {
  const bajo = resolveDegree(0, mode, grado).root;
  // Invertido, solo un acorde de la escala: una dominante secundaria sobre la nota de
  // otro —el A7 sobre el Mi de `I ii iii IV`— tira a otro sitio, no armoniza la línea.
  return (
    resolveDegree(0, mode, destino).root === bajo ||
    (gradosDeLaEscala(mode).includes(destino) && notasDelAcorde(mode, destino, especie).has(bajo))
  );
}

/** Cuántas rearmonizaciones de un compás se construyen como mucho: las mejores. */
const MAX_CAMBIOS_SUELTOS = 12;

/**
 * Lo que vale para todos los compases al rearmonizar: desde dónde se toca, dónde
 * está la llegada y si lo tuyo es una línea de bajo.
 */
interface PlanDeRearmonizar {
  readonly ultimo: number;
  /** Desde qué compás se prueba cualquier movimiento. */
  readonly desde: number;
  /** Desde qué compás se mira algo: en un blues, el 2, por el cambio rápido. */
  readonly primero: number;
  readonly vuelveAEmpezar: boolean;
  readonly llegada: number;
  readonly periodo: boolean;
  readonly esUnaLinea: boolean;
  readonly fuertesDelUno: readonly NotaDelCompas[];
  readonly vampDeTonica: boolean;
}

function planDeRearmonizar(id: Idioma, original: readonly PathStep[]): PlanDeRearmonizar {
  const ultimo = original.length - 1;
  // En un blues se retoca la vuelta, no el esquema: del 8 al 12 es donde el blues
  // de jazz pone su VI7, su ii–V y su turnaround; un ii en lugar del IV7 del cambio
  // rápido, o un iv en el 2, ya no es ese blues.
  const abreConLaPredominante =
    roleOfDegreeSymbol(original[0]!.degree) === 'subdominant' && id.centroModal === null;
  // **Y la tónica del compás 1 con tu punteo encima** se puede armonizar de otra
  // manera, si lo que entra comparte dos notas con ella y lleva todas las fuertes del
  // punteo. Se construye para que exista —en la balada menor del corpus final era lo
  // único que encajaba con el punteo, `i → III` con el Sol y el Mib—, y el juez le
  // pone su reparo de siempre: cambia el sitio donde la canción dice su tonalidad, y
  // solo entra por la red, cuando no hay tres mejores.
  const fuertesDelUno = (id.melodia[0] ?? []).filter((nota) => nota.fuerte);
  const tonicaConPunteo =
    original[0]!.degree === id.tonica && fuertesDelUno.length > 0 && id.centroModal === null;
  const desde = id.blues ? 7 : abreConLaPredominante || tonicaConPunteo ? 0 : 1;
  // La llegada que se sostiene (`llegadaSostenida`) es el compás en el que llega, y
  // ese no se toca. Lo que la sostiene, según lo que acaba: en un periodo de dos
  // frases es el final y tampoco; en una frase sola es el sitio de la vuelta, y ahí
  // cabe el `VI VII i III` del arreglista —como en otro final (`otrosFinales`)—.
  const sostenida = llegadaSostenida(id, original);
  return {
    ultimo,
    desde,
    // El cambio rápido es la excepción del esquema: se mira también el compás 2.
    primero: id.blues ? 1 : desde,
    // Y en un blues el 12 no es la llegada —esa es la tónica del 11— sino la vuelta
    // que lleva al coro siguiente: detrás del 12 viene otra vez el 1, y ahí va la V
    // del turnaround.
    vuelveAEmpezar: id.blues && original[ultimo - 1]!.degree === id.tonica,
    llegada: sostenida ?? ultimo,
    periodo: sostenida !== null && pulsosDe(original) > id.frase,
    // Si tu canción entera baja por grados —la andaluza—, la bajada es la forma: no se
    // le cambia el bajo a ningún compás (`esUnaBajada`, la vara del juez, que le pone
    // reparo). Otro acorde sobre la misma nota sí, **también uno que la lleva dentro**
    // y se toca con ella debajo: la v sobre el Sol del VII, el iv sobre el Fa del VI.
    // Sin eso la andaluza no tenía ni una rearmonización, y con punteo el menú se
    // quedaba vacío (lo encontró el corpus final).
    esUnaLinea: esUnaBajada(
      id.mode,
      original.map((paso) => paso.degree),
    ),
    fuertesDelUno,
    vampDeTonica: esUnVampDeFunk(id.mode, original, id.estilo),
  };
}

/** Si un movimiento se prueba en un compás, antes de mirar adónde lleva. */
function cabeElMovimiento(
  move: MoveId,
  antesDelEsquema: boolean,
  dudoso: boolean,
  esLaTonicaDelUno: boolean,
): boolean {
  // En un blues, antes del 8 solo se pone o se quita el cambio rápido.
  if (antesDelEsquema && move !== 'cambio-rapido') {
    return false;
  }
  // Un compás que el micro leyó con duda no se rearmoniza encima: se corrige, con
  // lo que comparte dos notas con lo que se oyó —su relativo, el de su misma
  // función—, que es lo que probablemente sonó. Los dos arreglistas lo pidieron
  // así («cambiar lo dudoso por lo más probable»), y antes no se tocaba. Y la
  // tónica del compás 1, lo mismo.
  return !((dudoso || esLaTonicaDelUno) && move !== 'relativo' && move !== 'funcion');
}

/** Un cambio de un compás por otro grado, antes de saber si vale. */
interface Tanteo {
  readonly i: number;
  readonly grado: DegreeSymbol;
  readonly anterior: DegreeSymbol | null;
  readonly siguiente: DegreeSymbol | null;
  readonly move: MoveId;
  readonly destino: DegreeSymbol;
  readonly especie: EspecieDeBloque | null;
  readonly esLaTonicaDelUno: boolean;
}

/**
 * Lo que vale un cambio, o nulo si no se construye: lo que no encaja con sus
 * vecinos, pisa tu punteo, deshace tu dominante o vale menos que nada.
 */
function valorDelCambio(id: Idioma, plan: PlanDeRearmonizar, tanteo: Tanteo): number | null {
  const { i, grado, anterior, siguiente, move, destino, especie } = tanteo;
  const quitaElRapido = move === 'cambio-rapido';
  // Con séptima de dominante, el semitono frigio es el sustituto tritonal, y ese
  // solo vale donde había un V que sustituir: es el movimiento `tritono`.
  if (move === 'frigio' && especie === 'dominant7') {
    return null;
  }
  const suya = id.especies[i] ?? null;
  if (
    (plan.esUnaLinea && !sobreElMismoBajo(id.mode, grado, destino, especie)) ||
    (repiteAlVecino(destino, anterior, siguiente) && !quitaElRapido) ||
    !esElMovimiento(id, move, grado, suya, destino, especie) ||
    (haceDeDominante(id.mode, grado, suya, siguiente) && !conservaLaDominante(move, destino)) ||
    pierdeLaGama(id, suya, destino)
  ) {
    return null;
  }
  const encaja =
    (anterior === null || canFollow(id.mode, anterior, destino) ? 1 : 0) +
    (siguiente === null || canFollow(id.mode, destino, siguiente) ? 1 : 0);
  const { fuertes, chocan, debiles } = choquesConElPunteo(id, i, destino, especie);
  // Delante de la tónica, lo que entra cierra con la fuerza que tenga en su
  // estilo, y lo que pierde respecto a lo tuyo se paga: el vii° por el V es
  // cambiar la cadencia de un pop por la de un coral. El sustituto tritonal no
  // pierde nada —lleva el mismo tritono, por eso es sustituto—, y lo que cueste
  // en tu estilo ya lo dice su precio.
  const pierde =
    siguiente === id.tonica && move !== 'tritono'
      ? Math.max(0, fuerzaDeCadencia(id, grado) - fuerzaDeCadencia(id, destino))
      : 0;
  // En una bajada, lo que entra se toca sobre la nota de la línea: es otra
  // manera de armonizarla, no un color que se trae. La v sobre el Sol del VII
  // de una andaluza no deshace el V que viene detrás (el arreglista la pidió).
  const precio = plan.esUnaLinea
    ? Math.max(-0.3, precioDelGrado(id, destino))
    : precioDelGrado(id, destino);
  // En un vamp de funk lo de casa es irse y volver (`vaiven`): el relativo, la
  // misma función o el préstamo cambian el color de una balada, no el del vamp
  // —el IIImaj7 que tachó el arreglista en el quinto examen—.
  const fueraDelVamp = plan.vampDeTonica && move !== 'vaiven' ? DE_OTRO_IDIOMA : 0;
  const valor =
    preferencia(id, move, grado, destino, siguiente, i === plan.ultimo) +
    precio +
    0.25 * encaja -
    0.8 * chocan -
    pierde -
    fueraDelVamp;
  // Lo que vale menos que nada no se construye: una dominante en un riff
  // mixolidio, un préstamo en un folk que no lo usa. Que no esté es mejor que
  // dejárselo al juez.
  // La tónica del compás 1 solo cambia por lo que lleva todo tu punteo fuerte.
  const sostieneElPunteo = plan.fuertesDelUno.every((nota) =>
    notasDelAcorde(id.mode, destino, especie).has(nota.nota),
  );
  if (
    encaja === 0 ||
    (fuertes > 0 && chocan === fuertes) ||
    valor < 0 ||
    (tanteo.esLaTonicaDelUno && !sostieneElPunteo)
  ) {
    return null;
  }
  // Las débiles que rozan no la quitan —el arreglista de la verificación da por
  // bueno el iv bajo un La débil—, pero se miran **al elegir**: lo que no pisa tu
  // punteo va delante (corpus final, la balada menor).
  return valor - 0.4 * debiles;
}

/** Los cambios que caben en un compás, de todos los movimientos. */
function cambiosDelCompas(
  id: Idioma,
  original: readonly PathStep[],
  plan: PlanDeRearmonizar,
  i: number,
): Cambio[] {
  const { ultimo, vuelveAEmpezar, llegada, periodo } = plan;
  const grado = original[i]!.degree;
  // Delante del compás 1 no hay nada: lo que entra solo tiene que llevar al 2.
  const anterior = original[i - 1]?.degree ?? null;
  const siguiente =
    vuelveAEmpezar && i === ultimo ? original[0]!.degree : loQueSigueEnTuParte(id, original, i);
  // El compás del coro, para el cambio rápido, que no se ve en los vecinos.
  const entorno: Entorno = {
    anterior,
    siguiente,
    compasDelBlues: id.blues ? i % 12 : null,
    vampDeTonica: plan.vampDeTonica,
  };
  const esLaTonicaDelUno = i === 0 && grado === id.tonica;
  const vistos = new Set<DegreeSymbol>();
  const cambios: Cambio[] = [];
  for (const move of MOVES) {
    if (!cabeElMovimiento(move.id, i < plan.desde, id.dudosos[i] === true, esLaTonicaDelUno)) {
      continue;
    }
    // Un vamp no llega: vuelve a empezar, y su último compás es tan del giro como
    // los demás (`vaiven`).
    const tocaLaLlegada =
      grado === id.tonica &&
      !vuelveAEmpezar &&
      move.id !== 'vaiven' &&
      ((i === llegada && move.id !== 'interrumpida') || (periodo && i > llegada));
    // La predominante tiene dos destinos, el ii y el IV, y los dos se prueban.
    for (const destino of destinosDelMovimiento(id.mode, grado, move.id, entorno)) {
      // Ni poner la tónica en medio: un relativo que da la I a mitad de frase no
      // cambia el color, adelanta la llegada. Quitar el cambio rápido sí la pone, y
      // es lo que hace: la tónica del 2 es la del esquema.
      if (
        destino === grado ||
        (destino === id.tonica && move.id !== 'cambio-rapido') ||
        vistos.has(destino) ||
        tocaLaLlegada
      ) {
        continue;
      }
      const especie = especieNueva(id, destino, move.id);
      const valor = valorDelCambio(id, plan, {
        i,
        grado,
        anterior,
        siguiente,
        move: move.id,
        destino,
        especie,
        esLaTonicaDelUno,
      });
      if (valor === null) {
        continue;
      }
      // El destino es de quien lo construye primero, no de quien lo intenta: el bII
      // que el tritono no puede poner sin séptima lo pone el semitono frigio.
      vistos.add(destino);
      cambios.push({ i, move, destino, especie, valor });
    }
  }
  return cambios;
}

/** De uno en uno: el mismo cambio en el mismo sitio no se ofrece dos veces. */
function cambiosSueltos(
  id: Idioma,
  original: readonly PathStep[],
  cambios: readonly Cambio[],
  cancionCon: (elegidos: readonly Cambio[]) => PasoPosible[],
): Borrador[] {
  const vistos = new Set<string>();
  return (
    [...cambios]
      // Con el mismo valor, el más tardío: si el mismo cambio cabe en dos sitios es
      // que tu frase se repite, y lo que hace un arreglista es variar la repetición
      // —el II7 delante del V que cierra el consecuente—, no la primera vez.
      .sort((a, b) => b.valor - a.valor || b.i - a.i)
      .filter((cambio) => {
        // Con el destino: la predominante tiene dos en el mismo sitio, el ii y el IV.
        const clave = `${cambio.move.id}|${original[cambio.i - 1]?.degree}|${original[cambio.i]!.degree}|${original[cambio.i + 1]?.degree}|${cambio.destino}`;
        const nuevo = !vistos.has(clave);
        vistos.add(clave);
        return nuevo;
      })
      .slice(0, MAX_CAMBIOS_SUELTOS)
      .map((cambio) => {
        const cancion = cancionCon([cambio]);
        return {
          path: 'rearmonizar' as const,
          partes: retoque(cancion),
          nombre: `${nombreDelCambio(id.mode, cambio.move.id, original[cambio.i]!.degree, cambio.destino, cambio.especie)}, en el ${compasDelAcorde(id, original, cambio.i)}`,
          que: frase(`Cambia ${cambiosEnTexto(id, original, cancion)}.`, porQueDelCambio(cambio)),
          prioridad: prioridadDe(cambio.valor),
          familia: cambio.move.id,
        };
      })
  );
}

/**
 * El mismo movimiento en todos los compases donde cabe, sin dos seguidos: un
 * cambio mira a sus vecinos, y si los dos cambian ya no mira a lo que suena.
 */
function cambiosJuntos(
  id: Idioma,
  original: readonly PathStep[],
  cambios: readonly Cambio[],
  cancionCon: (elegidos: readonly Cambio[]) => PasoPosible[],
): Borrador[] {
  return MOVES.flatMap((move) => {
    const elegidos: Cambio[] = [];
    for (const cambio of cambios.filter((c) => c.move.id === move.id)) {
      if (elegidos.at(-1) === undefined || cambio.i > elegidos.at(-1)!.i + 1) {
        elegidos.push(cambio);
      }
    }
    if (elegidos.length < 2) {
      return [];
    }
    const cancion = cancionCon(elegidos);
    // El intercambio puede ir en las dos direcciones a la vez —`I iv I IV`—, y
    // entonces se dice así.
    const nombres = new Set(
      elegidos.map((c) =>
        nombreDelCambio(id.mode, move.id, original[c.i]!.degree, c.destino, c.especie),
      ),
    );
    return [
      {
        path: 'rearmonizar' as const,
        partes: retoque(cancion),
        // En quintas el cambio modal no gana ni pierde sensible: se dice qué cambia.
        nombre: `${nombres.size === 1 ? [...nombres][0]! : elegidos.every((c) => c.especie === 'quinta') ? [...nombres].join(' y ') : `${move.name} y al revés`}, donde cabe`,
        que: frase(
          `Cambia ${cambiosEnTexto(id, original, cancion)}.`,
          porQueDelCambio(elegidos[0]!),
        ),
        prioridad: prioridadDe(media(elegidos.map((c) => c.valor)) - 0.15 * (elegidos.length - 1)),
        familia: move.id,
      },
    ];
  });
}

/**
 * Rearmonizar: cada movimiento donde cae bien, de uno en uno, y el mismo en todos
 * los compases donde cabe.
 *
 * **La tónica del primer compás y la llegada no se tocan**, que es lo que hacía
 * «donde cabe»: cambiaba la tónica del compás uno por su relativo y la canción
 * pasaba a estar en otra tonalidad. **Pero el compás 1 no siempre es la tónica**:
 * en un final `iv V i i`, un pre o un `ii V I` es la predominante, y cambiarla —el
 * ii° o el bII por el iv, el ii o el iv por el IV— es lo primero que haría un
 * arreglista (lo pidió el corpus final). Se toca si hace de subdominante y no es
 * el centro de un vaivén modal, que entonces es su tónica. La llegada solo se tuerce a propósito: con la interrumpida, que
 * existe para eso. Y un compás que el micro leyó con duda tampoco: rearmonizar lo
 * que no se sabe qué era es construir encima como si fuera seguro.
 */
export function rearmonizaciones(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const plan = planDeRearmonizar(id, original);
  const cambios: Cambio[] = [];
  for (let i = plan.primero; i <= plan.ultimo; i += 1) {
    cambios.push(...cambiosDelCompas(id, original, plan, i));
  }
  const cancionCon = (elegidos: readonly Cambio[]): PasoPosible[] =>
    original.map((_, i) => {
      const cambio = elegidos.find((c) => c.i === i);
      return cambio === undefined
        ? tuyo(id, original, i)
        : paso(cambio.destino, original[i]!.beats, cambio.move.id, cambio.especie);
    });
  return [
    ...cambiosSueltos(id, original, cambios, cancionCon),
    ...cambiosJuntos(id, original, cambios, cancionCon),
    ...sobreLaBajada(id, original, cambios, cancionCon),
  ];
}

/** Cuántas dominantes partidas se ofrecen como mucho: las mejores. */
const MAX_PARTIDAS = 2;

/**
 * **La dominante partida en su ii y ella** (`partir.ts`): el V de un compás pasa a
 * `ii V` a medias, y el de dos, a `ii | V`. Es lo que hace el jazz con cualquier V
 * largo, y la secundaria igual —el V/V se parte en su ii y él—.
 *
 * Aparte de las demás rearmonizaciones porque cambia **cuántos** acordes hay: los
 * pulsos no se mueven, y la comprobación la empareja por pulsos
 * (`gruposPorPulsos`). Los dos acordes llevan el movimiento; el V se queda con su
 * especie, y el ii toma la del idioma de la canción —el ii7, la iiø7—.
 *
 * No se parte lo que el micro oyó con duda, ni lo que ya llega preparado, ni un
 * blues antes de su vuelta, que es el esquema.
 */
export function partidas(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const ii = MOVES.find((move) => move.id === 'ii-v')!;
  const borradores: { borrador: Borrador; valor: number }[] = [];
  original.forEach((dominante, i) => {
    const anterior = original[i - 1]?.degree ?? null;
    // Un V suspendido ya se prepara a sí mismo: su cuarta es la que resuelve.
    const suspendido = id.especies[i] === 'sus4' || id.especies[i] === 'sus2';
    const partido =
      id.dudosos[i] === true || (id.blues && i < 7) || suspendido
        ? null
        : partirEnIiV(id.mode, dominante, {
            anterior,
            siguiente: loQueSigueEnTuParte(id, original, i),
          });
    if (partido === null) {
      return;
    }
    const [suIi, ella] = partido;
    const especie = especieNueva(id, suIi.degree, 'ii-v');
    const { fuertes, chocan } = choquesConElPunteo(id, i, suIi.degree, especie);
    const valor =
      preferencia(id, 'ii-v', dominante.degree, suIi.degree, dominante.degree, false) +
      precioDelGrado(id, suIi.degree) +
      (anterior === null || canFollow(id.mode, anterior, suIi.degree) ? 0.25 : 0) -
      0.8 * chocan;
    if ((fuertes > 0 && chocan === fuertes) || valor < 0) {
      return;
    }
    const pasos: PasoPosible[] = original.flatMap((_, k) =>
      k === i
        ? [
            paso(suIi.degree, suIi.beats, 'ii-v', especie),
            paso(ella.degree, ella.beats, 'ii-v', id.especies[i] ?? null),
          ]
        : [tuyo(id, original, k)],
    );
    const compas = compasDelAcorde(id, original, i);
    borradores.push({
      valor,
      borrador: {
        path: 'rearmonizar',
        partes: retoque(pasos),
        nombre: `${ii.name}, en el ${compas}`,
        que: frase(
          `Parte el ${dominante.degree} del ${compas}: la primera mitad pasa a ${suIi.degree}, que lo prepara, y la segunda sigue siendo ${dominante.degree}.`,
          'Llega preparada sin cambiar los pulsos.',
        ),
        prioridad: prioridadDe(valor),
        familia: 'ii-v',
      },
    });
  });
  return borradores
    .sort((a, b) => b.valor - a.valor)
    .slice(0, MAX_PARTIDAS)
    .map(({ borrador }) => borrador);
}

/**
 * **La bajada armonizada entera**: en una canción que baja por grados, cada acorde
 * que se puede tocar sobre la nota de la línea, todos a la vez. Es el lamento de
 * manual —`i v iv V` sobre `i VII VI V`, la v sobre el Sol y el iv sobre el Fa—, y
 * aquí sí van seguidos: el bajo no se mueve, así que cada uno sigue mirando a lo que
 * suena. Con el mejor de cada compás; si solo cabe uno, ya está entre los sueltos.
 */
function sobreLaBajada(
  id: Idioma,
  original: readonly PathStep[],
  cambios: readonly Cambio[],
  cancionCon: (elegidos: readonly Cambio[]) => PasoPosible[],
): Borrador[] {
  const linea = esUnaBajada(
    id.mode,
    original.map((paso) => paso.degree),
  );
  const invertidos = cambios.filter(
    (c) =>
      resolveDegree(0, id.mode, c.destino).root !==
      resolveDegree(0, id.mode, original[c.i]!.degree).root,
  );
  const mejores = [...new Set(invertidos.map((c) => c.i))].map(
    (i) => [...invertidos.filter((c) => c.i === i)].sort((a, b) => b.valor - a.valor)[0]!,
  );
  if (!linea || mejores.length < 2) {
    return [];
  }
  const cancion = cancionCon(mejores);
  return [
    {
      path: 'rearmonizar',
      partes: retoque(cancion),
      nombre: 'Otros acordes sobre tu bajada',
      que: frase(
        `Cambia ${cambiosEnTexto(id, original, cancion)}.`,
        'Cada uno se toca sobre la nota de tu bajo, y la línea que baja sigue entera: el lamento de siempre.',
      ),
      prioridad: prioridadDe(media(mejores.map((c) => c.valor)) - 0.1),
      familia: 'bajada',
    },
  ];
}
