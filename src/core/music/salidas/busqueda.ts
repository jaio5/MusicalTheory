/**
 * Buscar caminos por el grafo de saltos de las salidas.
 *
 * Lo usan los caminos que añaden compases —seguir, contrastar, otro final—: desde
 * un grado, qué caminos llegan a donde hace falta y cuáles valen más. El precio de
 * cada paso lo pone `valor.ts`.
 */
import type { DegreeSymbol } from '../progressions';
import { especieNueva } from './especies';
import { esPrestado, type Idioma } from './idioma';
import { canFollow, saltosDe } from './validar';
import {
  esSuDominante,
  fuerzaDeCadencia,
  media,
  PRECIO_DE_OTRO_IDIOMA,
  precioDelCamino,
  precioDelGrado,
  quintaDeLaEscala,
  retrocede,
  saltosDelCamino,
  SIN_RETROGRESION,
  valorDeCierre,
  valorDelSalto,
  vuelveDeLaDominante,
} from './valor';

/** Lo que cuesta cada vuelta al acorde de hace dos compases (`buscarCaminos`). */
const VAIVEN = 0.35;

/** Cuántos caminos a medias se guardan por paso. Con esto, ocho pasos siguen siendo instantáneos. */
const ANCHO_DE_LA_BUSQUEDA = 60;

/** Lo que se le pregunta a cada grado candidato: si puede ir en el paso `i` después de `previo`. */
export type Admite = (grado: DegreeSymbol, i: number, previo: DegreeSymbol) => boolean;

/**
 * Los mejores caminos de `largo` pasos desde un grado, por el grafo.
 *
 * Una búsqueda por haz: en cada paso se quedan los `ANCHO_DE_LA_BUSQUEDA` mejores
 * caminos a medias. Antes se generaban **todos** los caminos y se ordenaban por
 * novedad, y eso tenía dos problemas: no pasaba de cuatro pasos —el grafo crece
 * por potencias— y lo «nuevo» ganaba aunque sonara peor. Quedarse en el mismo
 * grado entra como opción, pero no dos veces seguidas: eso es un acorde que no
 * se mueve, y para durar más están los pulsos.
 */
export function buscarCaminos(
  id: Idioma,
  desde: DegreeSymbol,
  largo: number,
  admite: Admite,
  soloDeTuIdioma = true,
): DegreeSymbol[][] {
  let frentes: { grados: DegreeSymbol[]; suma: number }[] = [{ grados: [], suma: 0 }];
  const sinRetroceso = id.estilo !== null && SIN_RETROGRESION.has(id.estilo);
  for (let i = 0; i < largo; i += 1) {
    const siguientes: { grados: DegreeSymbol[]; suma: number }[] = [];
    for (const camino of frentes) {
      const previo = camino.grados.at(-1) ?? desde;
      const antePrevio = camino.grados.length >= 2 ? camino.grados.at(-2)! : desde;
      for (const grado of [previo, ...saltosDe(id.mode, previo).map((move) => move.to)]) {
        const repite = grado === previo && (i === 0 || antePrevio === previo);
        // Del V no se vuelve a su antesala fuera del blues: `V ii V I` deshace lo
        // que el ii preparó para prepararlo otra vez, y el V7 que va al ii7 es la
        // retrogresión de manual. Al IV sí, que es el idioma del rock y del pop,
        // salvo en los estilos que no vuelven nunca de la dominante.
        // Y volver a la dominante después de haberla dejado, `V IV V`, es ir y venir
        // del blues, del funk, del reggae y del rock: en lo demás deshace la cadencia
        // para rehacerla.
        const atras =
          (retrocede(previo, grado) &&
            (grado === 'IV' || grado === 'iv' ? sinRetroceso : id.estilo !== 'blues')) ||
          (grado === 'V' &&
            retrocede(antePrevio, previo) &&
            !vuelveDeLaDominante(id) &&
            id.estilo !== 'rock');
        if (
          repite ||
          atras ||
          // En quintas, el préstamo que solo lo era por su tercera no se distingue del
          // de la escala: el iv5 detrás del IV5 es el mismo acorde.
          (id.lenguaje === 'quintas' &&
            esPrestado(id.mode, grado) &&
            quintaDeLaEscala(id.mode, grado)) ||
          tritonoSinDominante(id, previo, grado) ||
          // El country usa una secundaria suelta, el II7 delante del V; dos seguidas
          // son la cadena del jazz, y el arreglista la tachó (`cadena`).
          (id.estilo === 'country' && previo.includes('/') && grado.includes('/')) ||
          (soloDeTuIdioma && deOtroIdioma(id, grado)) ||
          !admite(grado, i, previo)
        ) {
          continue;
        }
        const nuevo = camino.grados.includes(grado) ? 0 : precioDelGrado(id, grado);
        // Volver al de hace dos, `I IV I`, es un vaivén: vale una vez, y dentro de
        // una frase nueva repetirlo es dar vueltas sin ir a ningún sitio. Sin esto
        // la frase más «segura» tras un bucle era `I IV I IV I IV V I`.
        const vaiven = i > 0 && grado === antePrevio && grado !== previo ? VAIVEN : 0;
        // Y cada salto que ya se ha dado vale menos la segunda vez: una frase larga
        // que repite `IV V I` tres veces no va a ningún sitio, da vueltas.
        const repetido =
          grado !== previo && yaSalto(desde, camino.grados, previo, grado) ? VAIVEN : 0;
        siguientes.push({
          grados: [...camino.grados, grado],
          suma: camino.suma + valorDelSalto(id, previo, grado) + nuevo - vaiven - repetido,
        });
      }
    }
    frentes = siguientes
      .sort((a, b) => b.suma - a.suma || orden(a.grados, b.grados))
      .slice(0, ANCHO_DE_LA_BUSQUEDA);
  }
  // Si sin lo de otro idioma no hay camino —un acorde tuyo que solo sabe ir ahí—,
  // queda ese antes que nada: entonces lo pesa el juez.
  return frentes.length === 0 && soloDeTuIdioma
    ? buscarCaminos(id, desde, largo, admite, false)
    : frentes.map((camino) => camino.grados);
}

/**
 * Si un grado es **de otro idioma** para tu canción, y no se construye. Antes solo
 * costaba, y en una frase entera el resto la compensaba: un contraste de cine salía
 * por `V vi V/V V` con todo lo demás bien enlazado, y el juez, que no sabe de qué
 * vive cada canción, lo ponía primero. Que no esté es mejor que dejárselo al juez,
 * como con los cambios sueltos que valen menos que nada (`rearmonizaciones`).
 */
function deOtroIdioma(id: Idioma, grado: DegreeSymbol): boolean {
  return precioDelGrado(id, grado) <= PRECIO_DE_OTRO_IDIOMA;
}

/**
 * Si ir de `previo` a `grado` es **un sustituto tritonal recién salido de casa**: un
 * bII que suena con séptima de dominante —en un jazz, en cuatríadas— justo detrás de
 * la tónica. El sustituto va donde iría el V: detrás de lo que lo prepara, o en su
 * lugar. Desde la tónica no hay dominante que sustituir, y el bII7 suena a otra
 * tonalidad; ahí el bII es el color frigio, en tríada (lo tachó el arreglista en un
 * funk en im7 examinado como jazz).
 */
function tritonoSinDominante(id: Idioma, previo: DegreeSymbol, grado: DegreeSymbol): boolean {
  return grado === 'bII' && previo === id.tonica && especieNueva(id, grado, null) === 'dominant7';
}

/** Si el camino ya ha ido de `de` a `a` antes. */
function yaSalto(
  desde: DegreeSymbol,
  grados: readonly DegreeSymbol[],
  de: DegreeSymbol,
  a: DegreeSymbol,
): boolean {
  return grados.some((grado, i) => grado === a && (i === 0 ? desde : grados[i - 1]) === de);
}

/** Un orden fijo entre dos listas de grados, para desempatar sin depender del idioma del sistema. */
export function orden(a: readonly string[], b: readonly string[]): number {
  const x = a.join(' ');
  const y = b.join(' ');
  return Number(x > y) - Number(x < y);
}

export interface CaminoValorado {
  readonly grados: readonly DegreeSymbol[];
  readonly valor: number;
}

/** Lo que puede quedar por debajo del mejor camino para construirse todavía. */
const DISTANCIA_AL_MEJOR = 1.5;

/** Los mejores primero, y con el mismo valor, en un orden fijo. */
function porValor(a: CaminoValorado, b: CaminoValorado): number {
  return b.valor - a.valor || orden(a.grados, b.grados);
}

/**
 * Los mejores de una lista, **uno por clave**: así tres cierres no son tres
 * maneras de llegar desde el V, sino desde el V, desde el IV y desde el bVII.
 */
export function distintos(
  caminos: readonly CaminoValorado[],
  clave: (camino: CaminoValorado) => string,
  cuantos: number,
): CaminoValorado[] {
  const vistas = new Set<string>();
  const elegidos: CaminoValorado[] = [];
  const ordenados = [...caminos].sort(porValor);
  // Lo que queda muy por debajo del mejor no se construye: un bVII en un bolero
  // entraba por ser «el mejor cierre desde el bVII», y nadie lo había pedido.
  const suelo = (ordenados[0]?.valor ?? 0) - DISTANCIA_AL_MEJOR;
  for (const camino of ordenados) {
    if (!vistas.has(clave(camino)) && elegidos.length < cuantos && camino.valor >= suelo) {
      vistas.add(clave(camino));
      elegidos.push(camino);
    }
  }
  return elegidos;
}

/**
 * Los cierres de `largo` compases desde un grado: acaban en la tónica y no la
 * tocan antes, salvo en una frase larga, donde puede sonar al principio —una frase
 * de ocho que pasa por casa y vuelve a salir— pero nunca en los tres últimos.
 */
export function cierresDesde(
  id: Idioma,
  antes: DegreeSymbol | null,
  desde: DegreeSymbol,
  largo: number,
  cuantos: number,
  empieza: readonly DegreeSymbol[] | null = null,
): CaminoValorado[] {
  const tonica = id.tonica;
  const admite: Admite = (grado, i, previo) => {
    if (i === 0 && empieza !== null && !empieza.includes(grado)) {
      return false;
    }
    if (i === largo - 1) {
      return grado === tonica && previo !== tonica;
    }
    // La tónica en medio solo con sitio para volver a salir y llegar: al principio
    // de una frase de cuatro —el V que resuelve y la frase sigue— o en una larga.
    // Y al principio de una de tres si lo tuyo acaba en algo que solo sabe ir a
    // casa o al V —un vii°, un bII—: resolver y cerrar con un amén es lo que queda
    // cuando el V es de otro idioma.
    const resolverYa =
      i === 0 &&
      largo === 3 &&
      id.modales.length > 0 &&
      saltosDe(id.mode, previo).every((m) => m.to === tonica || m.to === 'V');
    return grado !== tonica || ((i <= largo - 4 || resolverYa) && previo !== tonica);
  };
  const todos = buscarCaminos(id, desde, largo, admite);
  // Una canción que habla en funcional llega por la dominante (`Idioma.funcional`):
  // un cierre de varios compases que no pasa por ninguna —`I vi IV I` detrás de un
  // `ii7 V7 Imaj7 IVmaj7`— cierra más flojo que lo tuyo, y el arreglista lo tachó.
  // Si ninguno pasa, quedan todos.
  const porLaDominante = todos.filter((grados) => grados.some(esUnaDominante));
  const caminos = (
    id.funcional && largo > 1 && porLaDominante.length > 0 ? porLaDominante : todos
  ).map((grados) => ({ grados, valor: valorDeCierre(id, antes, desde, grados) }));
  return distintos(caminos, (c) => [desde, ...c.grados].at(-2)!, cuantos);
}

/**
 * Si un grado es **una dominante de la tónica**: el V, el vii° o el bII que lo
 * sustituye. Una secundaria no: `V/vi vi IV I` pasa por una dominante, pero la del
 * vi, y a casa llega por la plagal.
 */
function esUnaDominante(grado: DegreeSymbol): boolean {
  return grado === 'V' || grado === 'vii°' || grado === 'bII';
}

/**
 * Las partes que se van y saben volver a tu primer compás: no acaban en la tónica
 * y su último acorde lleva a donde empezaste. **Mejor si vuelve por su dominante**
 * —el V antes de tu I, el III7 antes de tu vi—, que es lo que hace que la vuelta
 * suene a vuelta.
 */
export function partesQueVuelven(
  id: Idioma,
  desde: DegreeSymbol,
  largo: number,
  primero: DegreeSymbol,
  cuantos: number,
  empieza: readonly DegreeSymbol[] | null = null,
): CaminoValorado[] {
  const tonica = id.tonica;
  const admite: Admite = (grado, i, previo) => {
    if (grado === tonica && previo === tonica) {
      return false;
    }
    // Una estrofa o un estribillo empiezan donde empiezan, y la estrofa en casa.
    if (i === 0 && empieza !== null) {
      return empieza.includes(grado) && (grado !== tonica || largo > 1);
    }
    if (i === largo - 1) {
      return grado !== tonica && canFollow(id.mode, grado, primero);
    }
    return grado !== tonica || (largo >= 5 && i >= 1 && i <= largo - 3);
  };
  // Y por casa, una vez como mucho: un contraste que reposa dos veces en la tónica
  // —`V I vi IV I V/ii ii V`— no se ha ido. El juez lo pesaba y aun así salían
  // segundos del menú; ahora no se construyen.
  const caminos = buscarCaminos(id, desde, largo, admite)
    .filter(
      (grados) =>
        new Set(grados).size >= 2 && grados.filter((grado) => grado === tonica).length <= 1,
    )
    .map((grados) => {
      const ultimo = grados.at(-1)!;
      const nuevos = new Set(grados.filter((grado) => !id.tuyos.has(grado))).size;
      // Volver a la tónica es una cadencia, y vale lo que valga en su estilo: el V
      // en todos, el bVII en un rock. A otro grado, su dominante.
      const vuelta =
        primero === tonica
          ? 0.6 * fuerzaDeCadencia(id, ultimo)
          : esSuDominante(id, ultimo, primero)
            ? 0.8
            : ultimo === 'V' && (primero === 'vi' || primero === 'VI')
              ? 0.4
              : 0;
      return {
        grados,
        valor:
          media(saltosDelCamino(id, desde, grados)) +
          precioDelCamino(id, grados) +
          Math.min(nuevos, 3) * 0.25 +
          vuelta,
      };
    });
  return distintos(caminos, (c) => [...new Set(c.grados)].sort().join(' '), cuantos);
}
