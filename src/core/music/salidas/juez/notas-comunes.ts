/**
 * Criterio 6: las notas comunes y la coherencia de los sustitutos.
 */
import type { KeyMode } from '../../keys';
import { gradosDeLaEscala, resolveDegree, type DegreeSymbol } from '../../progressions';
import { colorDeCine, llegaComoDominante } from './enlace';
import {
  compasDe,
  esRelativaDeLaTonica,
  familia,
  juntar,
  notasEnComun,
  TONICA,
  type Acorde,
  type Hecho,
  type Juicio,
} from './juicio';

function comunes(a: Acorde, b: Acorde): number {
  return b.notas.filter((nota) => a.notas.includes(nota)).length;
}

/**
 * El grado que se trae del modo paralelo en lugar de cada diatónico de mayor.
 *
 * Se comprueba el resultado y no la etiqueta: bajar medio tono un `bVI` da un
 * `V`, y llamar a eso «el mismo grado del modo paralelo» sería mentir.
 */
const PRESTAMO: Readonly<Partial<Record<DegreeSymbol, DegreeSymbol>>> = {
  ii: 'bII',
  iii: 'bIII',
  vi: 'bVI',
  'vii°': 'bVII',
};

/** Si el sustituto que se ha puesto en el compás `i` se sostiene. */
function sustitucion(j: Juicio, i: number): Hecho {
  const antes = j.original[i]!;
  const ahora = j.cancion[i]!;
  const de = `${antes.degree} por ${ahora.degree} en el ${compasDe(j, ahora)}`;
  const previo = j.cancion[i - 1];
  let hecho: Hecho;
  if (
    antes.funcion === 'tonica' &&
    esRelativaDeLaTonica(ahora.degree) &&
    previo?.funcion === 'dominante'
  ) {
    hecho = {
      valor: 1,
      motivo: `${de}: cadencia rota de verdad, la relativa donde se esperaba la tónica tras ${previo.degree}.`,
    };
  } else if (PRESTAMO[antes.degree] === ahora.degree) {
    hecho = {
      valor: 0.4,
      motivo: `${de}: el mismo grado traído del modo paralelo, otro color.`,
    };
  } else {
    const notas = comunes(antes, ahora);
    const mismaFuncion = familia(antes.funcion) === familia(ahora.funcion);
    hecho =
      notas >= 2 || mismaFuncion
        ? {
            valor: notas >= 2 ? 0.8 : 0.5,
            motivo: `${de}: ${notasEnComun(notas)}${mismaFuncion ? ' y hacen el mismo papel' : ''}.`,
          }
        : {
            valor: -1,
            motivo: `${de}: ${notasEnComun(notas)} y no hacen el mismo papel.`,
          };
  }
  // Lo que se oyó con duda se puede **corregir**: lo que comparte dos notas con lo que
  // se oyó es lo que probablemente sonó —el micro confunde los parientes—, y eso es
  // lo que pidieron los dos arreglistas. Lo demás sería construir encima.
  if (j.contexto.dudosos?.[i] === true && hecho.valor > 0) {
    return comunes(antes, ahora) >= 2
      ? {
          valor: 0.6,
          motivo: `El ${compasDe(j, ahora)} se oyó con duda: ${ahora.degree} comparte dos notas con lo que se oyó, y puede ser lo que sonó.`,
        }
      : {
          valor: 0,
          motivo: `El ${compasDe(j, ahora)} se oyó con duda: sustituirlo es construir sobre algo que no se sabe.`,
        };
  }
  return hecho;
}

/**
 * Cuántos acordes tiene la línea de bajo de lo tuyo que pasa por el compás `i`, o
 * cero si no hay: una que baja —o sube— por grados conjuntos durante cuatro
 * acordes o más, o que **cae por quintas**: el
 * tetracordo del lamento, el bajo de la andaluza, el ciclo de quintas de `i iv
 * VII III VI ii° V`. Esa línea es lo que se oye de la progresión, y cambiar un
 * acorde de en medio por otro con otra fundamental la rompe aunque el acorde nuevo
 * encaje. La quinta del ciclo diatónico puede ser disminuida (`VI ii°`).
 */
function lineaDeBajo(j: Juicio, i: number): number {
  const paso = (k: number) => (j.original[k + 1]!.root - j.original[k]!.root + 12) % 12;
  const maneras = [
    (p: number) => p === 10 || p === 11,
    (p: number) => p === 1 || p === 2,
    (p: number) => p === 5 || p === 6,
  ];
  const pasos = j.original.length - 1;
  let larga = 0;
  for (const va of maneras) {
    let desde = 0;
    while (desde < pasos) {
      if (!va(paso(desde))) {
        desde += 1;
        continue;
      }
      let hasta = desde;
      while (hasta + 1 < pasos && va(paso(hasta + 1))) {
        hasta += 1;
      }
      // Los pasos de `desde` a `hasta` unen los acordes de `desde` a `hasta + 1`.
      const acordes = hasta - desde + 2;
      if (acordes >= 4 && desde <= i && i <= hasta + 1) {
        larga = Math.max(larga, acordes);
      }
      desde = hasta + 1;
    }
  }
  return larga;
}

/**
 * Si **toda la canción es una línea de bajo por grados**: cuatro acordes o más cuya
 * fundamental baja —o sube— un tono o un semitono cada vez, de principio a fin. Es
 * la andaluza, `i VII VI V`, el tetracordo del lamento: ahí la bajada es lo que se
 * oye, y es la forma aunque no llegue a seis. Lo usa también quien construye las
 * salidas (`salidas/`), que no rompe esa línea.
 */
export function esUnaBajada(mode: KeyMode, grados: readonly DegreeSymbol[]): boolean {
  if (grados.length < 4) {
    return false;
  }
  // **Tocada dos veces sigue siendo una bajada**: `i VII VI V i VII VI V` es la
  // andaluza dos veces, y entre una vuelta y otra el V sube a la i. Se mira una.
  const vuelta = [4, 5, 6, 7, 8].find(
    (largo) =>
      largo < grados.length &&
      grados.length % largo === 0 &&
      grados.every((grado, i) => grado === grados[i % largo]),
  );
  if (vuelta !== undefined) {
    return esUnaBajada(mode, grados.slice(0, vuelta));
  }
  const raices = grados.map((grado) => resolveDegree(0, mode, grado).root);
  const pasos = raices.slice(1).map((raiz, i) => (raiz - raices[i]! + 12) % 12);
  return pasos.every((p) => p === 10 || p === 11) || pasos.every((p) => p === 1 || p === 2);
}

/**
 * Una línea de seis acordes o más ya no es un detalle del bajo: **es la forma de
 * la canción**, como el ciclo de quintas que la recorre entera. Romperla no se
 * ofrece; romper una de cuatro —la andaluza con un iv en vez del VII— resta.
 */
const LINEA_QUE_ES_LA_FORMA = 6;

/**
 * Lo que vale un compás cambiado por un movimiento **que cambia el papel a
 * propósito**, o nulo si no es uno de esos.
 *
 * La predominante pone una subdominante donde había tónica, el cambio rápido el IV
 * donde había I, el semitono frigio un acorde mayor que no se parece a nada de lo
 * que había: con la vara de la sustitución —dos notas en común o el mismo papel—
 * los tres salían «no hacen el mismo papel», que es justo lo que hacen. Se
 * validan como las dominantes, con lo que viene detrás: la predominante con la
 * dominante a la que lleva, el semitono con el centro al que baja, y el cambio
 * rápido con la tónica del 3, a la que vuelve.
 */
function porSuSitio(j: Juicio, i: number): Hecho | null {
  const ahora = j.cancion[i]!;
  const siguiente = j.cancion[i + 1];
  const compas = compasDe(j, ahora);
  switch (ahora.move) {
    case 'predominante':
      return siguiente !== undefined && (siguiente.degree === 'V' || siguiente.degree === 'v')
        ? {
            valor: 0.8,
            motivo: `${ahora.degree} ${siguiente.degree} en el ${compas}: prepara la dominante, tónica, subdominante, dominante.`,
          }
        : null;
    case 'frigio':
      return siguiente !== undefined && siguiente.root === (ahora.root + 11) % 12
        ? {
            valor: 0.6,
            motivo: `${ahora.degree} ${siguiente.degree} en el ${compas}: baja medio tono sin dominante, la cadencia frigia.`,
          }
        : null;
    case 'ii-v':
      return siguiente !== undefined && siguiente.move === 'ii-v'
        ? {
            valor: 0.8,
            motivo: `${ahora.degree} ${siguiente.degree} en el ${compas}: la dominante partida en su ${ahora.degree} y ella, que llega preparada.`,
          }
        : null;
    case 'cambio-rapido':
      return {
        valor: 0.8,
        motivo: `${j.original[i]!.degree} por ${ahora.degree} en el ${compas}: el cambio rápido del blues, que vuelve a la tónica en el 3.`,
      };
    default:
      return null;
  }
}

export function notasComunes(j: Juicio): Hecho {
  const hechos: Hecho[] = [];
  for (const i of j.cambiados) {
    const ahora = j.cancion[i]!;
    const tuyo = j.original[i];
    // Lo que lleva dentro la nota de tu bajo se toca sobre ella —el iv6 sobre el Fa
    // del VI de una andaluza— y la bajada sigue entera: no la rompe.
    // Solo en una bajada por grados: en un ciclo de quintas lo que se oye es la
    // secuencia de acordes, y un ii° sobre el Re del iv ya la rompe.
    const sobreTuBajo =
      tuyo !== undefined &&
      ahora.root !== tuyo.root &&
      ahora.notas.includes(tuyo.root) &&
      gradosDeLaEscala(j.mode).includes(ahora.degree) &&
      esUnaBajada(
        j.mode,
        j.original.map((acorde) => acorde.degree),
      );
    const linea = ahora.root === tuyo?.root || sobreTuBajo ? 0 : lineaDeBajo(j, i);
    if (j.path === 'rearmonizar' && sobreTuBajo && lineaDeBajo(j, i) > 0) {
      hechos.push({
        valor: 0.6,
        motivo: `${tuyo.degree} por ${ahora.degree} en el ${compasDe(j, ahora)}: se toca sobre la nota de tu bajo, y la línea sigue entera.`,
      });
    }
    if (j.path === 'rearmonizar' && linea > 0) {
      // La línea es la forma si es larga o si **toda tu canción baja —o sube— por
      // grados**: la andaluza son cuatro acordes y los cuatro son su bajada, y un V/V
      // en medio ya no es ella. Un ciclo de quintas corto no: ahí cambiar un eslabón
      // por su sustituto es el oficio (`esUnaBajada`).
      const esLaForma =
        linea >= LINEA_QUE_ES_LA_FORMA ||
        esUnaBajada(
          j.mode,
          j.original.map((acorde) => acorde.degree),
        );
      hechos.push({
        valor: -1,
        motivo: `Cambia el bajo del ${compasDe(j, ahora)}, que iba en línea con los de al lado: la rompe.`,
        ...(esLaForma ? { reparo: 'rompe la línea que hace la canción' } : {}),
      });
    }
    // Los movimientos que cambian el papel a propósito no se juzgan por lo que se
    // parecen a lo que había, sino por su sitio (`porSuSitio`).
    const suSitio = j.path === 'rearmonizar' ? porSuSitio(j, i) : null;
    if (suSitio !== null) {
      hechos.push(suSitio);
      continue;
    }
    // Lo que prepara se valida con lo que viene detrás, no con lo que había: una
    // secundaria, un tritono, y también la V que entra como «su dominante delante».
    if (
      ahora.funcion === 'secundaria' ||
      ahora.funcion === 'tritono' ||
      ahora.move === 'dominante'
    ) {
      // Se valida con el siguiente. El último de un bucle vuelve al principio, y el
      // de un contraste a tu primer compás; el de una parte que va hacia fuera
      // —un pre, un puente— prepara la que viene, que empieza en casa.
      const vuelve = j.bucle || j.kind === 'continuar';
      const siguiente = j.cancion[i + 1] ?? (vuelve ? j.cancion[0]! : TONICA[j.mode]);
      // Lo que va detrás, dicho como es: lo que suena, la vuelta a tu principio, o
      // la parte siguiente, que no está en la canción y empieza en casa.
      const detras =
        j.cancion[i + 1] !== undefined
          ? `y detrás viene ${siguiente.degree}`
          : vuelve
            ? `y al volver viene ${siguiente.degree}`
            : 'y lo que sigue empieza en casa';
      const saltoQueToca = ahora.funcion === 'tritono' ? 11 : 5;
      const llega = siguiente.root === (ahora.root + saltoQueToca) % 12;
      const color = llega ? null : colorDeCine(j, ahora, siguiente);
      hechos.push(
        llega
          ? {
              valor: 1,
              motivo: `${ahora.degree} ${siguiente.degree} en el ${compasDe(j, ahora)}: llega a lo que preparaba.`,
            }
          : color !== null
            ? { valor: 0.6, motivo: `${color.motivo.slice(0, -1)}, en el ${compasDe(j, ahora)}.` }
            : {
                valor: -1,
                motivo: `${ahora.degree} en el ${compasDe(j, ahora)} prepara otro acorde, ${detras}.`,
              },
      );
      // Pero esa V sí quita lo que había: vale si el compás solo alargaba el de
      // antes —el turnaround del 12 de un blues anuncia la I, no sustituye a
      // nadie— y si no, tiene que hacer su papel. Un IV cambiado por V en `I IV I V`
      // llega a la I y aun así se lleva la subdominante.
      const antes = j.original[i];
      const prolonga = antes !== undefined && j.cancion[i - 1]?.degree === antes.degree;
      if (llega && ahora.funcion === 'dominante' && j.path === 'rearmonizar' && !prolonga) {
        hechos.push(sustitucion(j, i));
      }
    } else {
      // El I7 que va al IV es su dominante (`llegaComoDominante`): se valida igual
      // que una secundaria cuando llega, y si no llega es su grado con color.
      const siguiente = j.cancion[i + 1];
      const comoDominante = siguiente === undefined ? null : llegaComoDominante(ahora, siguiente);
      if (comoDominante !== null) {
        hechos.push({
          valor: comoDominante.valor,
          motivo: `${ahora.degree}7 ${siguiente!.degree} en el ${compasDe(j, ahora)}: llega a lo que preparaba.`,
        });
      }
      // Solo rearmonizar pone un acorde **en lugar de** otro; otro final pone
      // una música distinta, y no tiene por qué parecerse a la que había.
      if (j.path === 'rearmonizar') {
        hechos.push(sustitucion(j, i));
      }
    }
  }
  return juntar(hechos.map((hecho) => ({ hecho, peso: 1 })));
}
