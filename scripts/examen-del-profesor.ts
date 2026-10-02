/**
 * El examen del profesor: **si lo que contesta es teoría cierta**.
 *
 * Nació de dos respuestas del modelo de casa a la misma pregunta —«¿qué es una
 * cadencia perfecta?» en Do mayor—: «el movimiento de I a V a I» y «el IV-V; en C
 * mayor, F-C». Las dos mal, y las dos pasaban todo lo que la ruta comprobaba,
 * porque lo único que se miraba de su prosa era que no estuviera vacía.
 *
 * Cada pregunta lleva lo que **tiene** que decir una respuesta buena y lo que
 * **no puede** decir. Las comprobaciones son de este examen y no las del
 * validador de la ruta (`core/music/glossary.ts`): si fueran las mismas, el examen
 * aprobaría por construcción todo lo que el validador deja pasar.
 *
 * **Va por el mismo camino que la aplicación**: el prompt de la ruta
 * (`app/api/teacher/prompt.ts`), el prompt de sistema y el esquema de
 * `server/prompts.ts`, el modelo de casa de `server/local-model.ts` con el tope de
 * tokens del presupuesto, el validador del contrato y un reintento con otra
 * temperatura, como `server/ai-route.ts`. Lo único que no pasa son las puertas
 * —frecuencia, cuenta y cupo—, que no cambian lo que se contesta.
 *
 *     pnpm examen:profesor
 *
 * Pide `OLLAMA_URL` en el `.env` y un Ollama con el modelo descargado. **No está
 * entre los seis comandos**: sin modelo no hay nada que examinar, y en CI no lo
 * hay. Con `--detalle` enseña también lo que dijo el modelo en cada intento.
 */
import { MAX_MODEL_ATTEMPTS, TOKEN_BUDGETS } from '@core/billing';
import type { KeyMode, NoteName } from '@core/music';
import { parseTeacherRequest, validateTeacherAnswer } from '@features/learn/teacher-contract';
import { askLocalModel } from '@server/local-model';
import { ANSWER_SCHEMA, TEACHER_SYSTEM_PROMPT } from '@server/prompts';
import { RespuestaTruncada } from '@server/respuesta-truncada';

import { promptDelProfesor } from '@/app/api/teacher/prompt';

interface Pregunta {
  readonly tonica: NoteName;
  readonly modo: KeyMode;
  readonly pregunta: string;
  /** Todo esto tiene que aparecer en la respuesta. */
  readonly debe: readonly RegExp[];
  /** Y nada de esto. */
  readonly noDebe: readonly RegExp[];
}

/**
 * Un acorde escrito, y que no sea el principio de otro ni una tonalidad: `C` no
 * casa con `C#`, con `Cm` ni con «C mayor», y `Am` sí casa con `Am7`. La séptima se acepta siempre, porque una
 * dominante con séptima sigue siendo la dominante.
 */
function acorde(simbolo: string): string {
  const escapado = simbolo.replace(/[#]/g, '\\#');
  const septima = simbolo.endsWith('m') ? '7?' : '(?:7|maj7)?';
  // «C mayor» es la tonalidad y no un acorde: sin esto, «en C mayor, el G va a C»
  // se leía como C → G → C, que es justo el fallo que se busca.
  return `(?<![A-Za-z#])${escapado}${septima}(?![A-Za-z#0-9])(?!\\s+(?:mayor|menor))`;
}

/**
 * Un acorde y otro detrás, en la misma frase: «G → C», «de G7 a C», «el V (G)
 * puede resolver en el vi (Am)». Holgado a propósito: es para lo que **tiene** que
 * decir, y una respuesta buena no se escribe con una sola forma.
 */
function paso(...acordes: readonly string[]): RegExp {
  return new RegExp(acordes.map(acorde).join('[^.;:\\n]{0,40}?'));
}

/**
 * Una progresión escrita seguida, solo con flechas, guiones o «a»: «C a G a C»,
 * «C → G → C».
 *
 * Para lo que no se puede decir hace falta así de estrecho. Con el hueco de
 * `paso`, «el G que va a C, o el G7 que va a C» —una respuesta buena— casaba como
 * «C → G → C» saltando por encima de la coma.
 */
function seguidos(...acordes: readonly string[]): RegExp {
  return new RegExp(acordes.map(acorde).join('\\s*(?:→|->|–|—|-|a|al|hacia)\\s*'));
}

/** Una palabra o frase, sin mirar mayúsculas. */
function dice(texto: string): RegExp {
  return new RegExp(texto, 'iu');
}

/**
 * Lo mismo **mirando mayúsculas**, para lo que lleva notas: sin eso, la «D» de
 * un acorde casa con la «d» de «de» y la comprobación no dice nada.
 */
function nota(texto: string): RegExp {
  return new RegExp(texto, 'u');
}

/** Varios acordes, sueltos y en cualquier orden. */
function todos(...acordes: readonly string[]): RegExp[] {
  return acordes.map((simbolo) => new RegExp(acorde(simbolo)));
}

const PREGUNTAS: readonly Pregunta[] = [
  // Cadencias: la que destapó esto, y sus hermanas en mayor y en menor.
  {
    tonica: 'C',
    modo: 'major',
    pregunta: '¿Qué es una cadencia perfecta?',
    debe: [paso('G', 'C')],
    noDebe: [seguidos('C', 'G', 'C'), seguidos('F', 'C'), dice('IV\\s*[-–→]\\s*V\\b')],
  },
  {
    tonica: 'G',
    modo: 'major',
    pregunta: '¿Qué es una cadencia auténtica?',
    debe: [paso('D', 'G')],
    noDebe: [seguidos('G', 'D', 'G'), seguidos('C', 'G')],
  },
  {
    tonica: 'A',
    modo: 'minor',
    pregunta: '¿Qué es una cadencia perfecta?',
    debe: [paso('E', 'Am')],
    noDebe: [seguidos('Am', 'E', 'Am'), seguidos('Dm', 'Am')],
  },
  {
    tonica: 'G',
    modo: 'major',
    pregunta: '¿Qué es una cadencia plagal?',
    debe: [paso('C', 'G')],
    noDebe: [seguidos('G', 'C', 'G'), nota('plagal es (la|el) (paso|movimiento) de D')],
  },
  {
    tonica: 'D',
    modo: 'minor',
    pregunta: '¿Cómo suena la cadencia plagal en esta tonalidad?',
    debe: [paso('Gm', 'Dm')],
    noDebe: [seguidos('A', 'Dm'), seguidos('Dm', 'Gm', 'Dm')],
  },
  {
    tonica: 'C',
    modo: 'major',
    pregunta: '¿Qué es una cadencia rota?',
    debe: [paso('G', 'Am')],
    noDebe: [seguidos('G', 'Em'), seguidos('F', 'C')],
  },
  {
    tonica: 'E',
    modo: 'minor',
    pregunta: '¿Qué es una cadencia deceptiva?',
    debe: [paso('B', 'C')],
    noDebe: [seguidos('B', 'Em'), seguidos('Am', 'Em')],
  },
  {
    tonica: 'F',
    modo: 'major',
    pregunta: '¿Qué es una semicadencia?',
    debe: [new RegExp(acorde('C')), dice('dominante|\\bV\\b')],
    noDebe: [dice('termina en la t[oó]nica'), dice('acaba en (la t[oó]nica|el I\\b)')],
  },
  // La relativa, de las dos maneras.
  {
    tonica: 'A',
    modo: 'major',
    pregunta: '¿Cuál es la relativa menor de esta tonalidad?',
    debe: [nota('F#m|F# menor')],
    noDebe: [nota('relativa menor (de A mayor )?es (C#|D|E|B|G#)')],
  },
  {
    tonica: 'E',
    modo: 'minor',
    pregunta: '¿Y cuál es su relativa mayor?',
    debe: [nota('G mayor|\\bG\\b(?!m|#)')],
    noDebe: [nota('relativa mayor (de E menor )?es (C|D|B|A)\\b')],
  },
  // Funciones y acordes de la tonalidad.
  {
    // El cliente manda la tónica con sostenidos: Bb mayor viaja como A#.
    tonica: 'A#',
    modo: 'major',
    pregunta: '¿Cuál es la dominante de esta tonalidad?',
    debe: [new RegExp(acorde('F'))],
    noDebe: [nota('dominante (es|de (Bb|A#) mayor es) (Eb|Gm|C)\\b')],
  },
  {
    tonica: 'C',
    modo: 'major',
    pregunta: '¿Por qué suena tan bien un ii–V–I?',
    debe: todos('Dm', 'G', 'C'),
    noDebe: [seguidos('Em', 'A', 'D'), seguidos('Dm', 'G', 'Am')],
  },
  {
    tonica: 'G',
    modo: 'major',
    pregunta: '¿Qué acordes son el ii-V-I aquí?',
    debe: [paso('Am', 'D', 'G')],
    noDebe: [seguidos('Bm', 'E', 'A')],
  },
  {
    tonica: 'C',
    modo: 'major',
    pregunta: '¿Qué notas tiene un G7?',
    debe: [nota('\\bG\\b[^.]*\\bB\\b[^.]*\\bD\\b[^.]*\\bF\\b')],
    noDebe: [nota('\\bF#')],
  },
  {
    tonica: 'A',
    modo: 'minor',
    pregunta: '¿Qué es una séptima de dominante en esta tonalidad?',
    debe: [nota('\\bE7\\b'), nota('G#')],
    noDebe: [nota('\\bG7\\b'), nota('\\bEm7\\b')],
  },
  {
    tonica: 'C',
    modo: 'major',
    pregunta: '¿Qué es un acorde sus4?',
    debe: [dice('cuarta'), dice('tercera')],
    noDebe: [nota('Csus4 (tiene|son|lleva)[^.]*\\bE\\b')],
  },
  // Los modos.
  {
    tonica: 'C',
    modo: 'major',
    pregunta: '¿Qué es el modo dórico?',
    debe: [nota('sexta mayor|6M|6\\.ª mayor|D dórico|en D\\b|segundo grado|\\bii\\b')],
    noDebe: [dice('dórico[^.]*sexta menor')],
  },
  {
    tonica: 'G',
    modo: 'major',
    pregunta: '¿Qué modo es el mixolidio y cuándo lo uso?',
    debe: [nota('séptima menor|septima menor|7m|b7|bVII|quinto grado|D mixolidio')],
    noDebe: [dice('mixolidio[^.]*séptima mayor')],
  },
  {
    tonica: 'C',
    modo: 'major',
    pregunta: '¿Qué tiene de especial el lidio?',
    debe: [nota('cuarta aumentada|#4|cuarta sostenida|F lidio|cuarto grado|F#|tritono')],
    noDebe: [dice('lidio[^.]*cuarta justa'), dice('lidio[^.]*segunda menor')],
  },
  {
    tonica: 'A',
    modo: 'minor',
    pregunta: '¿Qué diferencia hay entre los siete modos?',
    debe: [dice('jónico|jonico'), dice('locrio'), dice('lidio')],
    noDebe: [dice('ocho modos'), dice('seis modos')],
  },
  // Intervalos.
  {
    tonica: 'C',
    modo: 'major',
    pregunta: '¿Cuántos semitonos tiene una tercera mayor?',
    debe: [dice('\\b4\\b|cuatro')],
    noDebe: [dice('tercera mayor (tiene|son|mide|es de) (3|tres|5|cinco)\\b')],
  },
  {
    tonica: 'E',
    modo: 'minor',
    pregunta: '¿Qué es un tritono?',
    debe: [dice('\\b6\\b|seis|tres tonos')],
    noDebe: [dice('tritono (tiene|son|mide|es de) (5|cinco|7|siete)\\b')],
  },
  {
    tonica: 'D',
    modo: 'major',
    pregunta: '¿Cuántos semitonos hay en una quinta justa?',
    debe: [dice('\\b7\\b|siete')],
    noDebe: [dice('quinta justa (tiene|son|mide|es de) (5|cinco|6|seis|8|ocho)\\b')],
  },
  // Escalas.
  {
    tonica: 'A',
    modo: 'minor',
    pregunta: '¿Qué diferencia hay entre la menor natural y la armónica?',
    debe: [nota('G#'), dice('séptima|septima|sensible')],
    noDebe: [dice('armónica[^.]*sube la sexta'), nota('armónica[^.]*\\bF#')],
  },
  {
    tonica: 'E',
    modo: 'minor',
    pregunta: '¿Qué notas tiene la pentatónica menor?',
    debe: [nota('\\bE\\b[^.]*\\bG\\b[^.]*\\bA\\b[^.]*\\bB\\b[^.]*\\bD\\b')],
    noDebe: [nota('pentatónica[^.]*\\bF#'), nota('pentatónica[^.]*\\bC\\b')],
  },
  // Tonalidades y progresiones.
  {
    tonica: 'D',
    modo: 'major',
    pregunta: '¿Cuántos sostenidos tiene la armadura?',
    debe: [dice('\\b2\\b|dos'), nota('F#'), nota('C#')],
    noDebe: [dice('(tres|3|uno|1) sostenidos?\\b'), nota('G#')],
  },
  {
    tonica: 'C',
    modo: 'major',
    pregunta: '¿Qué es un acorde prestado?',
    debe: [nota('Fm|Bb|Ab|Eb'), dice('menor')],
    noDebe: [nota('prestado[^.]*\\bAm\\b'), nota('prestado[^.]*\\bDm\\b')],
  },
  {
    tonica: 'C',
    modo: 'major',
    pregunta: '¿Qué es una dominante secundaria?',
    debe: [nota('\\bD7?\\b|\\bA7?\\b|\\bE7?\\b'), dice('V/|dominante de')],
    noDebe: [nota('dominante secundaria es (el|la) (G|F)\\b')],
  },
];

/** Lo que salió de una pregunta, para el recuento. */
interface Resultado {
  readonly pregunta: Pregunta;
  readonly mostrada: string | null;
  readonly intentos: readonly string[];
  readonly faltan: readonly RegExp[];
  readonly sobran: readonly RegExp[];
  readonly segundos: number;
}

const url = process.env.OLLAMA_URL?.replace(/\/+$/, '');
const modelo = process.env.OLLAMA_MODEL ?? 'qwen3:8b';
const detalle = process.argv.includes('--detalle');

if (url === undefined || url === '') {
  console.error('No hay OLLAMA_URL. Ponla en el .env apuntando a un Ollama con el modelo.');
  process.exit(1);
}

/**
 * Una pregunta, por el camino de la ruta: prompt, modelo, validador y un
 * reintento con otra temperatura. Devuelve lo que habría salido en pantalla, o
 * nulo si la ruta habría contestado «no ha venido bien formada».
 */
async function preguntar(pregunta: Pregunta): Promise<Resultado> {
  const peticion = parseTeacherRequest({
    key: { tonic: pregunta.tonica, mode: pregunta.modo },
    question: pregunta.pregunta,
  });
  /* El banco está escrito aquí: una pregunta que no se lea es un fallo del banco. */
  if (peticion === null) {
    throw new Error(`La pregunta no se lee: ${pregunta.pregunta}`);
  }

  const prompt = promptDelProfesor(peticion);
  const intentos: string[] = [];
  const antes = Date.now();
  let mostrada: string | null = null;

  for (let intento = 0; intento < MAX_MODEL_ATTEMPTS; intento += 1) {
    let payload: unknown;
    try {
      payload = await askLocalModel(
        {
          prompt,
          system: TEACHER_SYSTEM_PROMPT,
          schema: ANSWER_SCHEMA,
          maxTokens: TOKEN_BUDGETS.profesor.output,
          model: modelo,
          intento,
        },
        url as string,
      );
    } catch (fallo) {
      // Cortada por el tope: la ruta tampoco reintenta, porque se cortaría igual.
      intentos.push(fallo instanceof RespuestaTruncada ? '(cortada por el tope)' : String(fallo));
      break;
    }
    const dicho = (payload as { answer?: unknown } | null)?.answer;
    intentos.push(typeof dicho === 'string' ? dicho : JSON.stringify(payload));

    const respuesta = validateTeacherAnswer(payload, peticion);
    if (respuesta !== null) {
      mostrada = respuesta.answer;
      break;
    }
  }

  const texto = mostrada ?? '';
  return {
    pregunta,
    mostrada,
    intentos,
    faltan: mostrada === null ? [] : pregunta.debe.filter((patron) => !patron.test(texto)),
    sobran: mostrada === null ? [] : pregunta.noDebe.filter((patron) => patron.test(texto)),
    segundos: (Date.now() - antes) / 1000,
  };
}

function tonalidad(pregunta: Pregunta): string {
  return `${pregunta.tonica} ${pregunta.modo === 'major' ? 'mayor' : 'menor'}`;
}

console.log(`Examen del profesor contra ${modelo} en ${url}: ${PREGUNTAS.length} preguntas.\n`);

const resultados: Resultado[] = [];
for (const pregunta of PREGUNTAS) {
  const resultado = await preguntar(pregunta);
  resultados.push(resultado);

  const bien =
    resultado.mostrada !== null && resultado.faltan.length === 0 && resultado.sobran.length === 0;
  const marca = resultado.mostrada === null ? 'CALLA' : bien ? 'BIEN ' : 'MAL  ';
  console.log(
    `${marca} [${tonalidad(pregunta)}] ${pregunta.pregunta} (${resultado.segundos.toFixed(1)} s)`,
  );
  if (resultado.mostrada !== null && !bien) {
    console.log(`      dijo: ${resultado.mostrada}`);
    for (const patron of resultado.faltan) console.log(`      falta: ${patron.source}`);
    for (const patron of resultado.sobran) console.log(`      sobra: ${patron.source}`);
  }
  if (detalle || resultado.mostrada === null) {
    resultado.intentos.forEach((dicho, indice) =>
      console.log(`      intento ${indice + 1}: ${dicho}`),
    );
  }
}

const bien = resultados.filter(
  (r) => r.mostrada !== null && r.faltan.length === 0 && r.sobran.length === 0,
).length;
const calla = resultados.filter((r) => r.mostrada === null).length;
const mal = resultados.length - bien - calla;

/*
  Tres cifras y no una, porque no valen lo mismo. **Mal** es teoría falsa en la
  pantalla, que es lo que este examen existe para bajar. **Calla** es que la ruta
  habría contestado «no ha venido bien formada»: molesta, pero no enseña nada
  falso, y es lo que hace el validador cuando caza una respuesta mala dos veces.
*/
console.log(`\nBien: ${bien}/${resultados.length} · mal: ${mal} · calla: ${calla}`);
