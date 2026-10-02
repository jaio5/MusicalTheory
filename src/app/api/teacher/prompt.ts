import {
  degreesFor,
  findTheory,
  keyChordTable,
  pitchClassFromName,
  theoryReference,
} from '@core/music';
import { MARCA_PREGUNTA, topicOf, type TeacherRequest } from '@features/learn/teacher-contract';
import { CABECERA_DE_TEORIA, cabeceraDePrompt, lineaDeEscala, lineaDeTema } from '@server/prompts';

/**
 * El prompt del profesor, fuera de la ruta.
 *
 * Estaba dentro de `route.ts`, y de ahí no se podía sacar sin arrastrar
 * `next/server`, el limitador y las puertas del cupo. Lo necesita **otro sitio que
 * no es la ruta**: `scripts/examen-del-profesor.ts`, que le pregunta al modelo de
 * casa por el mismo camino que la aplicación. Un examen con su propio prompt
 * mediría otro programa.
 *
 * Lleva siempre **los acordes de la tonalidad con su papel**, y cuando la pregunta
 * casa con algo del glosario, **esa teoría resuelta en la tonalidad**: hasta
 * entonces el modelo tenía los símbolos de grado y lo demás lo sacaba de memoria
 * (`core/music/glossary.ts`, adr/0076).
 */
export function promptDelProfesor(request: TeacherRequest): string {
  const key = { tonic: pitchClassFromName(request.key.tonic), mode: request.key.mode };
  const lines = cabeceraDePrompt(request.key, degreesFor(request.key.mode));
  lines.push(keyChordTable(key));

  if (request.scale !== undefined) {
    lines.push(lineaDeEscala(request.scale));
  }
  // El título sale del temario, no de lo que mande el cliente.
  const topic = topicOf(request);
  if (topic !== undefined) {
    lines.push(lineaDeTema(topic));
  }

  // Sin nada que case no va ni la cabecera: una referencia que no viene a cuento
  // es ruido que el modelo intenta usar.
  const teoria = findTheory(request.question);
  if (teoria.length > 0) {
    lines.push(CABECERA_DE_TEORIA, ...teoria.map((entry) => `- ${theoryReference(entry, key)}`));
  }

  // La pregunta va marcada y al final: es uno de los dos textos libres que entran
  // al modelo —el otro son las directrices de una salida— y el prompt de sistema
  // dice que lo de dentro de las marcas es un dato. La marca ya se le ha quitado a la pregunta al
  // validarla, así que nadie puede cerrar el bloque antes de tiempo.
  lines.push(`${MARCA_PREGUNTA}\n${request.question}\n${MARCA_PREGUNTA}`);
  return lines.join('\n');
}
