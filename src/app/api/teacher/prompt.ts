import {
  degreesFor,
  findTheory,
  keyChordTable,
  pitchClassFromName,
  theoryReference,
} from '@core/music';
import { TOKEN_BUDGETS } from '@core/billing';
import {
  MARCA_PREGUNTA,
  respaldoDelProfesor,
  topicOf,
  validateTeacherAnswer,
  type TeacherAnswer,
  type TeacherRequest,
} from '@features/learn/teacher-contract';
import type { PreguntaAlModelo } from '@server/ai-intentos';
import { respuestaSinIA } from '@server/fake-model';
import {
  ANSWER_SCHEMA,
  CABECERA_DE_TEORIA,
  cabeceraDePrompt,
  lineaDeEscala,
  lineaDeTema,
  RECORDATORIO_DE_LA_PREGUNTA,
  TEACHER_SYSTEM_PROMPT,
} from '@server/prompts';

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
  // Y detrás, que es un dato: es lo último que lee antes de contestar.
  lines.push(RECORDATORIO_DE_LA_PREGUNTA);
  return lines.join('\n');
}

/**
 * Lo que el profesor le pregunta al modelo y cómo comprueba lo que vuelve.
 *
 * Aquí y no en `route.ts` por lo mismo que el prompt: el examen del profesor lo usa
 * tal cual, y la ruta lo extiende con lo que es de HTTP —el limitador, la puerta y
 * cómo se lee el cuerpo—.
 *
 * `max_tokens` sale de `TOKEN_BUDGETS`, en el dominio, y no de un número escrito
 * aquí. Es el mismo número con el que se calculan los cupos, así que el peor caso
 * que supone la aritmética **es** el tope que impone el servidor.
 */
export const PROFESOR: PreguntaAlModelo<TeacherRequest, TeacherAnswer> = {
  prompt: promptDelProfesor,
  system: TEACHER_SYSTEM_PROMPT,
  schema: () => ANSWER_SCHEMA,
  maxTokens: TOKEN_BUDGETS.profesor.output,
  sinClave: respuestaSinIA,
  // Con las instrucciones, para tirar la respuesta que las copie: viven aquí, en
  // el servidor, y el contrato no puede abrirlas.
  validar: (payload, peticion) => validateTeacherAnswer(payload, peticion, TEACHER_SYSTEM_PROMPT),
  respaldo: respaldoDelProfesor,
};
