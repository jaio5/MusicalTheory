/**
 * El camino `contraste`: una parte que se aleja de lo tuyo y vuelve.
 *
 * Un puente o un estribillo que empieza en otro sitio, y la bajada andaluza cuando
 * la canción la pide.
 */
import type { DegreeSymbol } from '../progressions';
import {
  CIERRE,
  conArticulo,
  conArticuloArriba,
  empiezaPor,
  laQueQuepa,
  LARGO_MAXIMO_DE_LO_QUE_HACE,
  LARGO_MAXIMO_DEL_NOMBRE,
  largosQueCuadran,
  LO_QUE_CONTRASTA,
  nuevos,
  prioridadDe,
  PUENTE,
  repartir,
  type Borrador,
} from './borrador';
import { buscarCaminos, distintos, partesQueVuelven, type Admite } from './busqueda';
import { centroFrigio } from './formas';
import type { Idioma } from './idioma';
import { faltaALaForma, primerosDeLoQueSigue } from './seguir';
import type { PathStep } from './tipos';
import { canFollow } from './validar';
import { esSuDominante, media, precioDelCamino, saltosDelCamino } from './valor';

/**
 * **Una parte que baja hasta el reposo frigio** (`centroFrigio`, la misma regla que el
 * juez y que la comprobación de `seguir`): lo que sigue llega al centro —el V mayor
 * de un menor— por el semitono de encima, o desde el iv en un flamenco, y se para
 * ahí, que es donde se para una copla. Las cadencias no lo construyen —todas acaban
 * en la tónica—, y a una andaluza solo le salía el `V i` de cualquier menor.
 *
 * **En un flamenco es un contraste**: lo que hace esa parte es irse y volver a tu
 * principio por su dominante, que es lo que un contraste promete, y así lo pidieron
 * sus casos. **En una andaluza sin estilo es un seguir**: lo tuyo ya reposa en el V,
 * y lo que sigue acaba como acaba ella, sin resolverlo a la i. Se busca por el grafo
 * sin pasar por casa en una de cuatro —el V que resuelve en tu i se la gastaría—:
 * sale `III VII VI V`, la copla que pasa por el relativo y baja, o la andaluza desde
 * el VII. Dos por largo, que no empiecen igual. Acabar con la bajada entera, `VII VI
 * V`, suma: es el idioma, no un camino más.
 */
function bajadaAndaluza(id: Idioma, original: readonly PathStep[]): Borrador[] {
  const primero = original[0]!.degree;
  const frigio = centroFrigio(
    id.mode,
    id.estilo,
    original.map((paso) => paso.degree),
  );
  const flamenco = id.estilo === 'flamenco';
  // Y en un flamenco, desde el centro tiene que poder volver a tu principio: es lo
  // que hace un contraste.
  if (frigio === null || (flamenco && !canFollow(id.mode, frigio.centro, primero))) {
    return [];
  }
  const { centro, llegan } = frigio;
  const ultimo = original.at(-1)!.degree;
  const parte = flamenco ? LO_QUE_CONTRASTA[id.papel] : CIERRE;
  const de = flamenco ? 'del flamenco' : 'de la andaluza';
  return largosQueCuadran(id, original).flatMap((añadir) => {
    const reparto = repartir(id, original, añadir);
    if (reparto === null || reparto.length < 2) {
      return [];
    }
    const n = reparto.length;
    // Sin estilo, lo que sigue a una andaluza que reposa vuelve a empezar desde la i
    // —su V va a la i, no al VI ni al iv— y baja otra vez por otro camino: la misma
    // bajada sería tu frase repetida, no lo que sigue.
    const admite: Admite = (grado, i, previo) =>
      i === n - 1
        ? grado === centro && llegan.includes(previo)
        : !flamenco && i === 0
          ? grado === id.tonica
          : grado !== centro && (grado !== id.tonica || (n >= 5 && i >= 1 && i <= n - 3));
    const tuyos = original.map((paso) => paso.degree).join(' ');
    const caminos = buscarCaminos(id, ultimo, n, admite)
      .filter((grados) => flamenco || grados.join(' ') !== tuyos)
      .map((grados) => ({
        grados,
        valor:
          media(saltosDelCamino(id, ultimo, grados)) +
          precioDelCamino(id, grados) +
          ([ultimo, ...grados].slice(-3).join(' ') === 'VII VI V' ? 0.5 : 0),
      }));
    return distintos(caminos, (camino) => camino.grados[0]!, 2).map((camino) => {
      const dicho = camino.grados.join(' ');
      const vuelta = !flamenco
        ? ', sin resolverlo a la tónica'
        : esSuDominante(id, centro, primero)
          ? `, y de ahí vuelve a tu ${primero} desde su dominante`
          : `, y de ahí vuelve a tu ${primero}`;
      return {
        path: flamenco ? ('contraste' as const) : ('seguir' as const),
        partes: [{ name: parte.nombre, yours: false, steps: nuevos(id, camino.grados, reparto) }],
        loQueSeAnade: flamenco ? ('otra' as const) : ('tuya' as const),
        nombre: laQueQuepa(
          LARGO_MAXIMO_DEL_NOMBRE,
          `${conArticuloArriba(parte)} hasta el ${centro}: ${dicho}`,
          `${conArticuloArriba(parte)} hasta el ${centro}`,
        ),
        que: laQueQuepa(
          LARGO_MAXIMO_DE_LO_QUE_HACE,
          `Añade ${conArticulo(parte)}, ${dicho}, que llega al ${centro} por el ${camino.grados.at(-2)!} y reposa ahí, el final frigio ${de}${vuelta}.`,
          `Añade ${conArticulo(parte)}, ${dicho}, que reposa en el ${centro}: el final frigio ${de}.`,
        ),
        prioridad: prioridadDe(1 + camino.valor),
        familia: `reposo-frigio:${camino.grados[0]}`,
      };
    });
  });
}

/** Si unos grados suenan como lo tuyo, en el mismo orden y sin contar lo que se repite. */
function mismoGiro(grados: readonly DegreeSymbol[], original: readonly PathStep[]): boolean {
  const giro = (todos: readonly DegreeSymbol[]) =>
    todos.filter((grado, i) => i === 0 || grado !== todos[i - 1]).join(' ');
  return giro(grados) === giro(original.map((paso) => paso.degree));
}

/** Contraste: partes que se van y saben volver a tu primer compás, del largo que cuadra la frase. */
export function contrastes(id: Idioma, original: readonly PathStep[]): Borrador[] {
  if (id.blues) {
    return [];
  }
  const primero = original[0]!.degree;
  const ultimo = original.at(-1)!.degree;
  const parte = LO_QUE_CONTRASTA[id.papel];
  // Un vaivén modal se continúa yéndose y volviendo, no cerrando; después de un
  // puente o en un final, otro contraste es lo último que se busca.
  const ajuste =
    (id.centroModal === null ? 0 : 1.5) -
    (id.papel === 'puente' || id.papel === 'final' ? 1 : 0) +
    (id.papel === 'estrofa' || id.papel === 'pre' ? 0.5 : 0);
  const borradores: Borrador[] = [...bajadaAndaluza(id, original)];
  // Tras dos secciones que empiezan igual, lo que falta es la que contrasta
  // (`formasDe`): del largo de una sección, y sin empezar como ellas.
  const laQueFalta = faltaALaForma(id, original, 'b');
  for (const añadir of largosQueCuadran(id, original)) {
    const reparto = repartir(id, original, añadir);
    if (reparto === null || reparto.length < 2) {
      continue;
    }
    const empieza = primerosDeLoQueSigue(id, original, empiezaPor(id, parte, ultimo));
    for (const camino of partesQueVuelven(id, ultimo, reparto.length, primero, 4, empieza)) {
      const grados = camino.grados.join(' ');
      const final = camino.grados.at(-1)!;
      const fuera = [...new Set(camino.grados.filter((d) => !id.tuyos.has(d)))];
      const vuelta = esSuDominante(id, final, primero)
        ? `y vuelve a tu ${primero} desde su dominante, ${final}`
        : `y desde ${final} vuelve a tu ${primero}`;
      // La sección que contrasta tras tus dos que empiezan igual es la B de tu AABA:
      // se llama puente, y así la juzga el juez (`papelNuevo`).
      const esLaB =
        laQueFalta !== null &&
        añadir === laQueFalta.compases * id.compas &&
        camino.grados[0] !== laQueFalta.vuelveA;
      const suya = esLaB ? PUENTE : parte;
      borradores.push({
        path: 'contraste',
        partes: [{ name: suya.nombre, yours: false, steps: nuevos(id, camino.grados, reparto) }],
        loQueSeAnade: 'otra',
        ...(esLaB ? { papelNuevo: 'puente' as const } : {}),
        nombre: laQueQuepa(
          LARGO_MAXIMO_DEL_NOMBRE,
          `${conArticuloArriba(suya)} por ${grados}`,
          `${conArticuloArriba(suya)} de ${reparto.length} acordes`,
        ),
        que: laQueQuepa(
          LARGO_MAXIMO_DE_LO_QUE_HACE,
          `Añade ${conArticulo(suya)}, ${grados}, ` +
            (fuera.length > 0
              ? `que se va a ${fuera.join(' y ')} `
              : mismoGiro(camino.grados, original)
                ? 'que repite tus acordes '
                : 'que cambia el orden de tus acordes ') +
            `${vuelta}.`,
          `Añade ${conArticulo(suya)}, ${grados}, ${vuelta}.`,
        ),
        prioridad: prioridadDe(
          camino.valor +
            ajuste +
            // Lo que completa la forma va por delante de lo que la deja abierta.
            (esLaB ? 1 : 0),
        ),
        familia: `contraste:${camino.grados[0]}`,
      });
    }
  }
  return borradores;
}
