/**
 * El reparto de las opciones de una pregunta, **sin azar de verdad**.
 *
 * Vivía dentro de `lessons.ts` y solo lo usaban las lecciones de teoría. Las
 * unidades de oído y el repaso de lo fallado de oído escriben sus opciones con la
 * buena delante —es lo que las hace legibles— y nadie las repartía después: se
 * aprobaba una unidad de oído entera pulsando la primera sin escuchar nada. Aquí
 * está para que cualquier sitio que saque preguntas pase por la misma puerta.
 */

import type { Choice } from './lessons';

/** Lo mínimo que tiene una pregunta para poder repartirla: su enunciado y sus opciones. */
export interface ConOpciones {
  readonly prompt: string;
  readonly choices: readonly Choice[];
}

/**
 * Un número estable sacado de un texto (FNV-1a de 32 bits).
 *
 * Cuatro líneas y sin dependencias, que es todo lo que hace falta: no se está
 * cifrando nada, solo repartiendo. `>>> 0` en cada vuelta porque en JavaScript la
 * multiplicación se sale de los 32 bits y sin eso el resultado deja de ser el
 * mismo en máquinas distintas.
 */
export function semillaDe(texto: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    hash = ((hash ^ texto.charCodeAt(i)) * 0x01000193) >>> 0;
  }
  // Un cero pararía el xorshift en seco: cero desplazado y mezclado sigue siendo
  // cero, y la baraja devolvería las opciones como entraron.
  /* v8 ignore next -- dar con un texto cuyo FNV-1a sea cero es buscar una colision de 32 bits; el uno es solo para que la baraja no se pare */
  return hash === 0 ? 1 : hash;
}

/**
 * Baraja una lista con una semilla: Fisher-Yates con un generador xorshift de 32
 * bits.
 *
 * Con `Math.random()` las opciones cambiarían de sitio en cada repintado: bastaría
 * con que React volviera a pintar la pregunta —al contestar, al cambiar de
 * tonalidad, al llegar el cupo de la IA— para que el botón se moviera debajo del
 * dedo. Con la misma semilla sale siempre lo mismo.
 */
export function barajada<T>(lista: readonly T[], semilla: number): readonly T[] {
  const out = [...lista];
  let estado = semilla;

  for (let i = out.length - 1; i > 0; i -= 1) {
    estado ^= estado << 13;
    estado ^= estado >>> 17;
    estado ^= estado << 5;
    estado >>>= 0;

    const j = estado % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }

  return out;
}

/**
 * La pregunta con sus opciones repartidas.
 *
 * La semilla sale del enunciado y de las opciones en el orden en que se
 * escribieron, así que la misma pregunta sale siempre igual y dos preguntas
 * distintas salen distintas. Como las opciones de teoría se generan en tu
 * tonalidad, la misma pregunta en otra tonalidad reparte de otra forma.
 *
 * `sal` es lo que se le añade a la semilla cuando el texto no basta para
 * distinguir: las de oído dicen «Sí» y «No» en las veinticuatro tonalidades.
 */
export function conOpcionesRepartidas<T extends ConOpciones>(pregunta: T, sal = ''): T {
  const texto = `${pregunta.prompt}|${pregunta.choices.map((choice) => choice.text).join('|')}`;
  // Sin sal, el mismo texto que cuando la baraja vivía en `lessons.ts`: las
  // lecciones siguen repartiendo exactamente como antes de mudarse.
  const semilla = semillaDe(sal === '' ? texto : `${sal}|${texto}`);
  return { ...pregunta, choices: barajada(pregunta.choices, semilla) };
}

function sitioDeLaBuena(pregunta: ConOpciones): number {
  return pregunta.choices.findIndex((choice) => choice.correct);
}

/**
 * Las preguntas de una unidad, repartidas, **y sin que la buena caiga en el mismo
 * sitio en todas**.
 *
 * Con dos opciones por pregunta y tres preguntas por unidad, una baraja honrada
 * deja la buena delante en las tres una vez de cada ocho, y como no hay azar esa
 * vez es siempre la misma: la unidad de modos salía «la primera, la primera, la
 * primera» en todas las tonalidades. Cuando pasa, la última pregunta gira sus
 * opciones un puesto, y la buena cambia de sitio sin dejar de ser determinista.
 */
export function repartidasEnLaUnidad<T extends ConOpciones>(
  preguntas: readonly T[],
  sal: string,
): T[] {
  const repartidas = preguntas.map((pregunta) => conOpcionesRepartidas(pregunta, sal));
  const sitios = repartidas.map(sitioDeLaBuena);

  if (repartidas.length > 1 && sitios.every((sitio) => sitio === sitios[0])) {
    const ultima = repartidas[repartidas.length - 1]!;
    const [primera, ...resto] = ultima.choices;
    repartidas[repartidas.length - 1] = { ...ultima, choices: [...resto, primera!] };
  }

  return repartidas;
}
