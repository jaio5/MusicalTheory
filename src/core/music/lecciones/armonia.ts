/**
 * Las lecciones de Armonía: lo que se estudia en el grado profesional después
 * de las funciones y las cadencias.
 *
 * Todo se escribe **con la letra de cada grado** (`spelling.ts`) y no con la
 * tecla que suena. Aquí no es un capricho: estas lecciones hablan de sensibles
 * que suben, de séptimas que bajan y de sextas aumentadas, y una sensible
 * escrita con otra letra deja de ser un semitono diatónico. En Sol# menor es
 * Fa doble sostenido, y la napolitana de Reb mayor es Mibb.
 *
 * Y todo vale en **las dos especies de modo**. En menor la dominante se trae
 * del menor armónico —la sensible sube—, y los acordes disminuidos no están en
 * el mismo grado: es lo que más se equivocaba en las lecciones de antes.
 */

import type { KeyMode } from '../keys';
import { keyName } from '../keys';
import type { LessonNotes } from '../lessons';
import { normalizePitchClass, type PitchClass } from '../notes';
import { keyDegree, spellAbove, spelledName } from '../spelling';
import { choices, homonima } from './comun';

type DeArmonia =
  'inversiones' | 'enlaces' | 'septimaDominante' | 'secundarias' | 'modulacion' | 'cromaticos';

/*
  La especie de la tríada de cada grado.

  En menor salen de la natural **menos el V**, que es mayor porque se toma del
  armónico: es el que hace cadencia. El VII se queda en el de la natural —un
  tono por debajo de la tónica—, que es el que sirve de pivote y de tono vecino.
*/
const SUFIJOS: Readonly<Record<KeyMode, readonly string[]>> = {
  major: ['', 'm', 'm', '', '', 'm', 'dim'],
  minor: ['m', 'dim', '', 'm', '', '', ''],
};

/** Lo que todas las lecciones preguntan de la tonalidad, ya escrito. */
function tonalidad(tonic: PitchClass, mode: KeyMode) {
  const nota = (numero: number, alteracion = 0) =>
    spelledName(keyDegree(tonic, mode, numero, alteracion));
  const acorde = (grado: number) => `${nota(grado)}${SUFIJOS[mode][grado - 1]!}`;
  const menor = mode === 'minor';
  return {
    nombre: keyName(tonic, mode),
    menor,
    nota,
    acorde,
    // La sensible está a medio tono de la tónica. En menor no es el séptimo
    // grado de la natural, que queda a un tono: se sube.
    sensible: nota(7, menor ? 1 : 0),
    I: acorde(1),
    IV: acorde(4),
    V: acorde(5),
  };
}

/** Una tonalidad dicha por su tónica escrita: «F# mayor», «A# menor». */
function nombreDeTono(tonica: string, mode: KeyMode): string {
  return `${tonica} ${mode === 'major' ? 'mayor' : 'menor'}`;
}

/**
 * La dominante con séptima de un grado: la fundamental una quinta por encima,
 * y la tercera, que es la sensible del grado al que va.
 */
function dominanteSecundaria(tonic: PitchClass, mode: KeyMode, destino: number) {
  const raiz = spellAbove(keyDegree(tonic, mode, destino), 7, 4);
  const notas = [raiz, spellAbove(raiz, 4, 2), spellAbove(raiz, 7, 4), spellAbove(raiz, 10, 6)].map(
    spelledName,
  );
  return { acorde: `${notas[0]!}7`, sensible: notas[1]!, notas };
}

function inversiones(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const t = tonalidad(tonic, mode);
  const fundamental = t.nota(1);
  const tercera = t.nota(3);
  const quinta = t.nota(5);

  return {
    points: [
      `Lo que decide el estado de un acorde es su bajo, no el orden de las voces de arriba. ${t.I} (${fundamental}–${tercera}–${quinta}) está en estado fundamental con ${fundamental} en el bajo, en primera inversión con ${tercera} y en segunda con ${quinta}.`,
      `Se cifra por los intervalos que forman las voces con el bajo: el estado fundamental es 5/3 y no se escribe, la primera inversión es 6 y la segunda 6/4. En el cifrado americano de la guitarra la inversión va con barra: ${t.I}/${tercera} es ${t.I} con ${tercera} en el bajo.`,
      'La primera inversión es más ligera que el estado fundamental y deja al bajo moverse por grado conjunto. Se usa con libertad.',
      `La segunda no: la cuarta contra el bajo suena a disonancia y pide resolver. Solo vale en tres sitios: la cadencial (${t.I}/${quinta} → ${t.V} → ${t.I}), la de paso y la de floreo, con el bajo por grado conjunto o quieto.`,
    ],
    exercises: [
      {
        prompt: `${t.I} en primera inversión: ¿qué nota va en el bajo?`,
        choices: choices(tercera, [fundamental, quinta, t.nota(2)]),
        why: `En primera inversión el bajo es la tercera del acorde, ${tercera}. Se escribe ${t.I}/${tercera} y se cifra 6.`,
      },
      {
        prompt: '¿Cómo se cifra un acorde en segunda inversión?',
        choices: choices('6/4', ['6', 'No se cifra: es 5/3', '6/5']),
        why: `En segunda inversión el bajo es la quinta, y las otras dos notas forman con él una cuarta y una sexta: sobre ${quinta}, ${fundamental} queda a la cuarta y ${tercera} a la sexta. De ahí el 6/4.`,
      },
      {
        prompt: `¿En qué estado está ${t.V}/${t.sensible}?`,
        choices: choices('Primera inversión (6)', [
          'Segunda inversión (6/4)',
          'Estado fundamental',
          `Es otro acorde, con la fundamental en ${t.sensible}`,
        ]),
        // En menor la tercera del V es la sensible del armónico, no el séptimo
        // grado de la natural: E/G# en La menor, nunca E/G.
        why: `${t.sensible} es la tercera de ${t.V} (${t.nota(5)}–${t.sensible}–${t.nota(2)}), así que es su primera inversión. El acorde sigue siendo ${t.V}: la barra solo dice qué nota va abajo.`,
      },
      {
        prompt: `¿Cómo se escribe en cifrado americano ${t.I} en segunda inversión?`,
        choices: choices(`${t.I}/${quinta}`, [
          `${t.I}/${tercera}`,
          `${quinta}/${fundamental}`,
          t.V,
        ]),
        why: `Detrás de la barra va el bajo: ${t.I}/${quinta} es ${t.I} con su quinta abajo. ${quinta}/${fundamental} sería el acorde de ${quinta} con ${fundamental} en el bajo, que es otro acorde.`,
      },
      {
        prompt: `¿Dónde está bien usado ${t.I}/${quinta}?`,
        choices: choices(`Antes de ${t.V}, en la cadencia: ${t.I}/${quinta} → ${t.V} → ${t.I}`, [
          'Como último acorde, para cerrar la obra',
          'En cualquier sitio, igual que la primera inversión',
          `Después de ${t.V}, para resolverlo`,
        ]),
        why: `Es la 6/4 cadencial: el bajo ya está en ${quinta} y ${fundamental} y ${tercera}, encima, son apoyaturas que bajan a ${t.sensible} y ${t.nota(2)}, las notas de ${t.V}. Terminar en segunda inversión deja la frase en el aire.`,
      },
      {
        prompt: '¿Por qué la segunda inversión no se usa con la libertad de la primera?',
        choices: choices('Porque la cuarta contra el bajo suena a disonancia y pide resolver', [
          'Porque le falta la quinta',
          'Porque cambia el nombre del acorde',
          'Porque solo existe en modo mayor',
        ]),
        why: 'Sobre el bajo queda una cuarta justa, y en la armonía clásica la cuarta contra el bajo es disonancia. Por eso la 6/4 solo aparece donde ese choque se resuelve: cadencial, de paso o de floreo.',
      },
    ],
  };
}

function enlaces(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const t = tonalidad(tonic, mode);
  const [uno, dos, tres, cuatro, cinco, seis] = [1, 2, 3, 4, 5, 6].map((grado) => t.nota(grado));

  return {
    points: [
      `De ${t.I} a ${t.IV} la nota común es ${uno!}: se queda en la misma voz. Las demás van a la nota más cercana del acorde nuevo —${tres!} sube a ${cuatro!} y ${cinco!} a ${seis!}—, por el camino más corto.`,
      'Dos voces se mueven de tres maneras: directo, hacia el mismo lado; contrario, cada una hacia un lado; y oblicuo, una quieta y la otra en marcha. El contrario es el que más las separa.',
      'Las quintas y las octavas paralelas —consecutivas— están prohibidas: dos voces que se mueven juntas a quinta o a octava se funden en una, y se pierde la independencia de las voces.',
      `Hay dos notas con el camino fijo: la sensible, ${t.sensible}, sube a la tónica, ${uno!}; y la séptima de un acorde baja por grado conjunto, como ${cuatro!} en ${t.V}7 → ${t.I}, que baja a ${tres!}.`,
    ],
    exercises: [
      {
        prompt: `De ${t.I} a ${t.IV}, ¿qué nota se queda quieta en la misma voz?`,
        choices: choices(uno!, [tres!, cinco!, cuatro!]),
        why: `${uno!} está en los dos acordes —es la fundamental de ${t.I} y la quinta de ${t.IV}—, así que se mantiene: es la nota común.`,
      },
      {
        prompt: `En ${t.I} → ${t.IV}, la voz que canta ${tres!}, ¿adónde va?`,
        choices: choices(`Sube a ${cuatro!}`, [
          `Baja a ${uno!}`,
          `Sube a ${seis!}`,
          `Se queda en ${tres!}`,
        ]),
        // En mayor la tercera sube un semitono y en menor un tono, pero en los
        // dos es la nota más cercana del IV: la fundamental queda a tres o
        // cuatro semitonos por debajo.
        why: `${tres!} no está en ${t.IV}, así que tiene que moverse, y va a la nota más cercana: ${cuatro!}, a ${t.menor ? 'un tono' : 'un semitono'}. ${uno!} ya lo lleva otra voz, y saltar a ${seis!} es ir lejos sin motivo.`,
      },
      {
        prompt: `En ${t.I} → ${t.IV}, el bajo va de ${uno!} a ${cuatro!} y la soprano se queda en ${uno!}. ¿Qué movimiento hacen?`,
        choices: choices('Oblicuo', ['Contrario', 'Directo', 'Paralelo']),
        why: 'Una voz quieta y la otra en marcha es movimiento oblicuo. Contrario sería que cada una fuera hacia un lado, y directo, que las dos fueran hacia el mismo.',
      },
      {
        prompt: `En ${t.IV} → ${t.V}, el bajo sube de ${cuatro!} a ${cinco!} y la soprano de ${uno!} a ${dos!}. ¿Qué pasa?`,
        choices: choices('Quintas paralelas: no vale', [
          'Octavas paralelas: no vale',
          'Movimiento contrario: es lo correcto',
          'Nada: los dos acordes son de la tonalidad',
        ]),
        why: `De ${cuatro!} a ${uno!} hay una quinta, y de ${cinco!} a ${dos!}, otra: las dos voces se mueven juntas a quinta. Se arregla con movimiento contrario: la soprano baja de ${uno!} a ${t.sensible} mientras el bajo sube.`,
      },
      {
        prompt: '¿Por qué se evitan las quintas y las octavas paralelas?',
        choices: choices('Porque las dos voces se funden y dejan de ser independientes', [
          'Porque suenan desafinadas',
          'Porque la quinta y la octava son disonancias',
          'Porque solo se permiten en modo menor',
        ]),
        why: 'La quinta y la octava son las consonancias más perfectas: dos voces que se mueven juntas a esa distancia se oyen como una sola reforzada. La armonía clásica quiere voces independientes, y eso se lo quita.',
      },
      {
        prompt: `En ${t.V} → ${t.I}, ¿qué hace la sensible, ${t.sensible}?`,
        choices: choices(`Sube a ${uno!}`, [
          `Baja a ${seis!}`,
          `Se queda en ${t.sensible}`,
          `Sube a ${dos!}`,
        ]),
        why: t.menor
          ? `La sensible está a medio tono de la tónica y es la que más empuja: sube a ${uno!}. En menor existe gracias al menor armónico, que sube ${t.nota(7)} a ${t.sensible}.`
          : `La sensible está a medio tono de la tónica y es la que más empuja: sube a ${uno!}.`,
      },
    ],
  };
}

function septimaDominante(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const t = tonalidad(tonic, mode);
  const V7 = `${t.V}7`;
  const [uno, dos, tres, cuatro, cinco] = [1, 2, 3, 4, 5].map((grado) => t.nota(grado));
  const sensible = t.sensible;

  return {
    points: [
      t.menor
        ? `${V7} se forma sobre el quinto grado: ${cinco!}–${sensible}–${dos!}–${cuatro!}. En menor la tercera es la sensible del menor armónico, ${sensible}: con el ${t.nota(7)} de la natural saldría ${cinco!}m7, que no es una dominante.`
        : `${V7} se forma sobre el quinto grado: ${cinco!}–${sensible}–${dos!}–${cuatro!}. Es una tríada mayor con la séptima menor, y en la tonalidad solo hay una.`,
      `Entre ${sensible} y ${cuatro!} hay un tritono —una quinta disminuida—, y es lo que le da prisa por resolver.`,
      `Al ir a ${t.I} el tritono se cierra: la sensible ${sensible} sube a ${uno!} y la séptima ${cuatro!} baja a ${tres!}.`,
      `Sus inversiones se cifran por el bajo: 7 en estado fundamental (${cinco!}), 6/5 con la quinta disminuida en primera (${sensible}), +6 en segunda (${dos!}) y +4 en tercera (${cuatro!}). El + señala la sensible.`,
    ],
    exercises: [
      {
        prompt: `¿Cuál es la séptima de dominante de ${t.nombre}?`,
        choices: choices(
          V7,
          t.menor
            ? [`${cinco!}m7`, `${tres!}maj7`, `${dos!}m7b5`]
            : [`${cinco!}maj7`, `${cuatro!}maj7`, `${sensible}m7b5`],
        ),
        why: t.menor
          ? `${V7}, con la sensible ${sensible} del menor armónico. ${cinco!}m7 es lo que sale de la escala natural: menor y sin tritono, no aprieta.`
          : `${V7}: sobre el quinto grado, tríada mayor y séptima menor. ${cinco!}maj7 llevaría la séptima mayor y no tendría tritono.`,
      },
      {
        prompt: `¿Entre qué dos notas de ${V7} está el tritono?`,
        choices: choices(`${sensible} y ${cuatro!}`, [
          `${cinco!} y ${dos!}`,
          `${cinco!} y ${cuatro!}`,
          `${sensible} y ${dos!}`,
        ]),
        why: `${sensible} y ${cuatro!} están a tres tonos: una quinta disminuida. ${cinco!}–${dos!} es una quinta justa, ${cinco!}–${cuatro!} la séptima menor y ${sensible}–${dos!} una tercera menor.`,
      },
      {
        prompt: `En ${V7} → ${t.I}, ¿qué hacen la sensible y la séptima?`,
        choices: choices(`${sensible} sube a ${uno!} y ${cuatro!} baja a ${tres!}`, [
          `${sensible} baja a ${cinco!} y ${cuatro!} sube a ${cinco!}`,
          `Las dos suben: ${sensible} a ${uno!} y ${cuatro!} a ${cinco!}`,
          `${sensible} sube a ${uno!} y ${cuatro!} se queda donde está`,
        ]),
        why: `Las dos tienen el camino fijo: la sensible sube medio tono a la tónica y la séptima baja por grado conjunto a la tercera de ${t.I}. El tritono ${sensible}–${cuatro!} se cierra en la tercera ${tres!}–${uno!}.`,
      },
      {
        prompt: `¿Cómo se cifra ${V7} con ${sensible} en el bajo?`,
        choices: choices('6/5, con la quinta disminuida', ['+6', '+4', '7']),
        // El cifrado del conservatorio español marca la quinta disminuida
        // tachando el 5; aquí se dice con palabras porque no hay tipografía
        // para la cifra tachada que se lea igual en todas partes.
        why: `Con ${sensible} en el bajo es la primera inversión. Sobre él quedan ${dos!} a la tercera, ${cuatro!} a la quinta —disminuida, y por eso se tacha el 5— y ${cinco!} a la sexta: 6/5.`,
      },
      {
        prompt: `¿Qué nota va en el bajo de ${V7} cifrado +6?`,
        choices: choices(dos!, [cuatro!, sensible, cinco!]),
        why: `+6 es la segunda inversión: el bajo es la quinta del acorde, ${dos!}, y la sensible ${sensible} queda a una sexta de él. El + del cifrado señala siempre dónde está la sensible.`,
      },
      {
        prompt: `${V7} cifrado +4, con ${cuatro!} en el bajo: ¿en qué resuelve?`,
        choices: choices(`${t.I}/${tres!}: ${t.I} en primera inversión`, [
          `${t.I}: ${t.I} en estado fundamental`,
          `${t.I}/${cinco!}: ${t.I} en segunda inversión`,
          `${t.IV}: ${t.IV} en estado fundamental`,
        ]),
        why: `La séptima está en el bajo y tiene que bajar por grado conjunto: ${cuatro!} → ${tres!}, que es la tercera de ${t.I}. Por eso +4 resuelve en ${t.I} en primera inversión.`,
      },
    ],
  };
}

function secundarias(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const t = tonalidad(tonic, mode);
  const deLaDominante = dominanteSecundaria(tonic, mode, 5);
  /*
    Qué grados se pueden tonicalizar depende del modo: todos los que no son
    disminuidos. En mayor el disminuido es el VII; en menor, el II —y el de la
    sensible—, así que en menor se tonicalizan el III, el IV, el V, el VI y el VII
    de la natural, el que está un tono por debajo de la tónica. La lista se
    quedaba en el VI y decía «todos» dejándose uno: D7 → G en La menor es de lo
    más corriente.

    Y la pregunta de adónde resuelve usa otro grado en cada modo por lo mismo
    que la nota alterada: en menor, la sensible del VI ya está en la escala
    —C7 va a Fa en La menor y su Mi no se altera—, y la del IV no.
  */
  const grados = t.menor ? [3, 4, 5, 6, 7] : [2, 3, 4, 5, 6];
  const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const lista = grados
    .map(
      (grado) =>
        `V/${ROMANOS[grado - 1]!} = ${dominanteSecundaria(tonic, mode, grado).acorde} → ${t.acorde(grado)}`,
    )
    .join(', ');
  const ejemplo = t.menor ? 4 : 6;
  const otra = dominanteSecundaria(tonic, mode, ejemplo);
  const disminuido = t.menor ? 2 : 7;
  const imposible = dominanteSecundaria(tonic, mode, disminuido).acorde;

  return {
    points: [
      'Una dominante secundaria es el V7 de un grado que no es la tónica. Mientras suena, ese grado hace de tónica un momento: se tonicaliza.',
      `En ${t.nombre}: ${lista}.`,
      `Se escribe V/ y el grado al que va: V/V se lee «quinto del quinto». Un acorde disminuido no se tonicaliza porque no puede hacer de tónica, así que no hay V/${ROMANOS[disminuido - 1]!}: ${t.acorde(disminuido)} es disminuido.`,
      t.menor
        ? `La nota alterada que trae es la sensible del grado al que va: en ${deLaDominante.acorde}, ${deLaDominante.sensible} está medio tono por debajo de ${t.nota(5)} y sube a ella. Ojo con V/III, ${dominanteSecundaria(tonic, mode, 3).acorde}: es el VII de la menor natural con su séptima y no altera nada.`
        : `La nota alterada que trae es la sensible del grado al que va: en ${deLaDominante.acorde}, ${deLaDominante.sensible} está medio tono por debajo de ${t.nota(5)} y sube a ella. La excepción es V/IV, que es ${t.I} con séptima: lo que se altera es la séptima, ${t.nota(7, -1)}, que baja.`,
    ],
    exercises: [
      {
        prompt: `¿Cuál es el V/V de ${t.nombre}?`,
        choices: choices(deLaDominante.acorde, [`${t.V}7`, `${t.nota(2)}m7`, otra.acorde]),
        why: `V/V es la dominante de ${t.V}: la séptima de dominante una quinta por encima de ${t.nota(5)}, que es ${deLaDominante.acorde}. No sale de la escala: lleva ${deLaDominante.sensible}, la sensible de ${t.V}, para que tire hacia él.`,
      },
      {
        prompt: `¿Qué nota de ${deLaDominante.acorde} es la sensible del acorde al que va?`,
        choices: choices(deLaDominante.sensible, [
          deLaDominante.notas[0]!,
          deLaDominante.notas[2]!,
          deLaDominante.notas[3]!,
        ]),
        why: `${deLaDominante.sensible} está medio tono por debajo de ${t.nota(5)}: es la sensible de ${t.V}, y en ${t.nombre} no está —la escala lleva ${t.nota(4)}—. Por eso es la nota alterada.`,
      },
      {
        prompt: `¿Hacia dónde resuelve ${otra.acorde} en ${t.nombre}?`,
        choices: choices(t.acorde(ejemplo), t.menor ? [t.I, t.V, t.acorde(6)] : [t.I, t.IV, t.V]),
        why: `${otra.acorde} es el V7 de ${t.acorde(ejemplo)}: su tercera, ${otra.sensible}, es la sensible de ${t.nota(ejemplo)} y sube a ella.`,
      },
      {
        prompt: `¿Cómo se escribe en grados ${otra.acorde} → ${t.acorde(ejemplo)} en ${t.nombre}?`,
        choices: choices(
          `V/${ROMANOS[ejemplo - 1]!}`,
          t.menor ? ['V/V', 'V/VI', 'V/III'] : ['V/III', 'V/V', 'V/II'],
        ),
        why: `Se nombra por adónde va, no por dónde está: ${otra.acorde} resuelve en ${t.acorde(ejemplo)}, que es el ${ROMANOS[ejemplo - 1]!} de ${t.nombre}, así que es V/${ROMANOS[ejemplo - 1]!}.`,
      },
      {
        prompt: `¿Por qué no se usa un V/${ROMANOS[disminuido - 1]!} en ${t.nombre}?`,
        choices: choices(
          `Porque ${t.acorde(disminuido)} es disminuido y no puede hacer de tónica`,
          [
            `Porque ${imposible} no se puede formar`,
            'Sí se usa: es la secundaria más común',
            `Porque ${t.acorde(disminuido)} no está en la tonalidad`,
          ],
        ),
        why: `Tonicalizar es tratar un grado como si fuera una tónica, y una tónica es un acorde mayor o menor. ${t.acorde(disminuido)}, con la quinta disminuida, no puede serlo, así que no tiene dominante propia.`,
      },
      {
        prompt: `Suena ${deLaDominante.acorde} → ${t.V} y se vuelve a ${t.I}. ¿Qué le ha pasado a ${t.V}?`,
        choices: choices('Ha hecho de tónica un momento: se ha tonicalizado', [
          `Se ha cambiado de tonalidad a ${t.V} mayor para el resto de la obra`,
          'Ha pasado a ser subdominante',
          `Nada: ${deLaDominante.acorde} es un acorde de la escala`,
        ]),
        why: `${deLaDominante.acorde} trata a ${t.V} como si fuera la tónica, pero solo mientras dura: sin cadencia en ${t.V}, la tonalidad sigue siendo ${t.nombre}. Es una tonicalización, no una modulación.`,
      },
    ],
  };
}

function modulacion(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const t = tonalidad(tonic, mode);
  /*
    Los cinco vecinos son las tonalidades de los cinco grados que no son
    disminuidos, cada una en la especie de su tríada **natural**: en menor, el V
    vecino es menor —Mi menor de La menor—, no el V mayor de la cadencia.

    Se escriben con la letra del grado y no con `keyName`, que da la grafía de
    la rueda: de Fa# mayor, el vecino del V es Do# mayor, y `keyName` lo
    llamaría Reb.
  */
  const vecinos = (t.menor ? [3, 5, 7, 4, 6] : [6, 5, 3, 4, 2]).map((grado) =>
    nombreDeTono(
      t.nota(grado),
      // El III, el VI y el VII de la menor natural son mayores; el IV y el V, menores.
      t.menor
        ? [4, 5].includes(grado)
          ? 'minor'
          : 'major'
        : [2, 3, 6].includes(grado)
          ? 'minor'
          : 'major',
    ),
  );
  const listaDeVecinos = `${vecinos.slice(0, -1).join(', ')} y ${vecinos.at(-1)!}`;
  // Se modula al tono de la dominante, que en menor es el v menor.
  const destino = vecinos[1]!;
  const tonicaNueva = t.menor ? `${t.nota(5)}m` : t.nota(5);
  // La dominante del tono nuevo cae sobre el II de la tonalidad de partida.
  const dominanteNueva = t.nota(2);
  const sensibleNueva = t.nota(4, 1);
  const vecina = (semitonos: number, especie: KeyMode) =>
    keyName(normalizePitchClass(tonic + semitonos), especie);
  // La homónima con la letra de la tónica (`comun.ts`): la de Db mayor salía
  // «C# menor», y el porqué decía que tiene la misma tónica.
  const malasVecinas = [homonima(tonic, mode).nombre, vecina(2, mode), vecina(10, mode)];
  const pivote = t.menor
    ? {
        acorde: t.acorde(3),
        aqui: 'III',
        alli: 'VI',
        malas: [`${t.nota(4)}m`, t.nota(6), dominanteNueva],
      }
    : {
        acorde: t.acorde(6),
        aqui: 'VI',
        alli: 'II',
        malas: [t.nota(4), `${t.nota(2)}m`, dominanteNueva],
      };
  const porQueNo = t.menor
    ? `${t.nota(4)}m y ${t.nota(6)} llevan ${t.nota(6)}, que en ${destino} es ${t.nota(6, 1)}; y el acorde de ${dominanteNueva} no está en ${t.nombre}.`
    : `${t.nota(4)} y ${t.nota(2)}m llevan ${t.nota(4)}, que en ${destino} es ${sensibleNueva}; y el acorde de ${dominanteNueva} no está en ${t.nombre}.`;

  return {
    points: [
      `Los tonos vecinos son los que se diferencian en una alteración como mucho: el relativo, el de la dominante y el de la subdominante, cada uno con su relativo. Los de ${t.nombre} son cinco: ${listaDeVecinos}.`,
      `Se modula por un acorde pivote, uno que pertenece a las dos tonalidades. De ${t.nombre} a ${destino}, ${pivote.acorde} es el ${pivote.aqui} de una y el ${pivote.alli} de la otra, y por eso el cambio no se nota hasta después.`,
      `Tonicalizar es asomarse a otro grado un momento —una dominante secundaria y vuelta—. Modular es quedarse: la tonalidad nueva se confirma con una cadencia en ella, ${dominanteNueva} → ${tonicaNueva}.`,
    ],
    exercises: [
      {
        prompt: `¿Cuál de estas tonalidades es vecina de ${t.nombre}?`,
        choices: choices(destino, malasVecinas),
        why: `${destino} se diferencia de ${t.nombre} en una sola alteración. ${malasVecinas[0]!} tiene la misma tónica, pero tres alteraciones de diferencia: no es vecina.`,
      },
      {
        prompt: `¿Cuántos tonos vecinos tiene ${t.nombre}?`,
        choices: choices('Cinco', ['Dos', 'Siete', 'Once']),
        why: `${listaDeVecinos}: el relativo, el de la dominante y el de la subdominante, cada uno con su relativo.`,
      },
      {
        prompt: `${t.nombre} modula a ${destino}. ¿Cuál de estos acordes sirve de pivote?`,
        choices: choices(pivote.acorde, pivote.malas),
        why: `${pivote.acorde} es el ${pivote.aqui} de ${t.nombre} y el ${pivote.alli} de ${destino}: suena bien en las dos, y desde él se puede seguir en cualquiera. ${porQueNo}`,
      },
      {
        prompt: '¿Qué es un acorde pivote?',
        choices: choices('Un acorde que pertenece a las dos tonalidades', [
          'La dominante de la tonalidad nueva',
          'Un acorde disminuido que no es de ninguna',
          'El último acorde de la obra',
        ]),
        why: 'El pivote se oye en la tonalidad de partida y se entiende en la nueva, porque está en las dos. Es la bisagra: la dominante del tono nuevo viene después, y ya no es de los dos.',
      },
      {
        prompt: '¿Qué diferencia una modulación de una tonicalización?',
        choices: choices(
          'Cuánto dura: la modulación se queda y se confirma con una cadencia; la tonicalización es un momento',
          [
            'Nada: son dos nombres para lo mismo',
            'La tonicalización va a tonos lejanos y la modulación a vecinos',
            'La modulación cambia el modo y la tonicalización no',
          ],
        ),
        why: `Las dos tratan otro grado como tónica. ${dominanteSecundaria(tonic, mode, 5).acorde} → ${t.V} y vuelta a ${t.I} es una tonicalización: dura un instante. Si ${t.nombre} llega a ${destino} y cierra allí con su cadencia, ${dominanteNueva} → ${tonicaNueva}, ha modulado.`,
      },
      {
        prompt: `¿Qué confirma que ${t.nombre} ha modulado de verdad a ${destino}?`,
        choices: choices(`Una cadencia en ${destino}: ${dominanteNueva} → ${tonicaNueva}`, [
          'Un acorde pivote, sin más',
          `Que aparezca ${sensibleNueva} una vez`,
          'Cambiar la armadura en la partitura',
        ]),
        why: `El pivote abre la puerta y ${sensibleNueva} lo anuncia, pero la tonalidad nueva solo se da por establecida cuando cierra en ella con su cadencia, ${dominanteNueva} → ${tonicaNueva}. Sin eso es una tonicalización.`,
      },
    ],
  };
}

function cromaticos(tonic: PitchClass, mode: KeyMode): LessonNotes {
  const t = tonalidad(tonic, mode);
  const [uno, dos, cuatro, cinco] = [1, 2, 4, 5].map((grado) => t.nota(grado));
  /*
    Los dos acordes son los mismos en mayor y en paralelo menor: los dos se
    apoyan en el VI y el III **del menor**. En menor ya están en la escala; en
    mayor se traen, y por eso se escriben con bemol aunque la tonalidad vaya de
    sostenidos —el VI rebajado de Re mayor es Sib, no La#—.
  */
  const sextoBajo = t.nota(6, t.menor ? 0 : -1);
  const terceraMenor = t.nota(3, t.menor ? 0 : -1);
  const cuartaAlta = t.nota(4, 1);
  // El II rebajado sí se rebaja en los dos modos: el II de la menor natural está
  // un tono por encima de la tónica.
  const napolitana = t.nota(2, -1);
  const N6 = `${napolitana}/${cuatro!}`;
  const segundo = t.acorde(2);
  const italiana = [sextoBajo, uno!, cuartaAlta];
  const alemana = [sextoBajo, uno!, terceraMenor, cuartaAlta];

  return {
    points: [
      `La sexta napolitana es el II rebajado, en acorde mayor y en primera inversión: en ${t.nombre}, ${napolitana} (${napolitana}–${cuatro!}–${sextoBajo}) con ${cuatro!} en el bajo, ${N6}. Se cifra N6 o bII6, y el nombre sale de la sexta que forma ${napolitana} con el bajo.`,
      `Hace de subdominante y va a la dominante, ${t.V}, a veces pasando por ${t.I}/${cinco!}. ${napolitana} baja a la sensible ${t.sensible}: un salto de tercera disminuida que es todo su color.`,
      t.menor
        ? `Las sextas aumentadas se apoyan en el VI de la escala, ${sextoBajo}, con la cuarta subida, ${cuartaAlta}: entre las dos hay una sexta aumentada.`
        : `Las sextas aumentadas se apoyan en el VI rebajado, ${sextoBajo}, con la cuarta subida, ${cuartaAlta}: entre las dos hay una sexta aumentada.`,
      `Son tres: la italiana (${italiana.join('–')}), la francesa, que añade ${dos!} (${sextoBajo}–${uno!}–${dos!}–${cuartaAlta}), y la alemana, que añade ${terceraMenor} (${alemana.join('–')}).`,
      `Al resolver en ${t.V}, la sexta aumentada se abre por movimiento contrario a una octava: ${sextoBajo} baja a ${cinco!} y ${cuartaAlta} sube a ${cinco!}. La alemana suele pasar antes por ${t.I}/${cinco!} para no hacer quintas paralelas.`,
    ],
    exercises: [
      {
        prompt: `¿Cuál es la sexta napolitana de ${t.nombre}?`,
        choices: choices(N6, [napolitana, `${segundo}/${cuatro!}`, `${napolitana}/${sextoBajo}`]),
        why: `El II rebajado de ${t.nombre} es ${napolitana}, mayor, y la napolitana lo pone en primera inversión, con su tercera ${cuatro!} en el bajo. ${segundo} es el II sin rebajar.`,
      },
      {
        prompt: `¿Hacia dónde va ${N6} en ${t.nombre}?`,
        choices: choices(`A ${t.V}, la dominante`, [
          `A ${t.IV}, la subdominante`,
          `A ${segundo}, el II sin rebajar`,
          `A ${t.acorde(6)}, el VI`,
        ]),
        why: `La napolitana hace de subdominante y prepara ${t.V}: ${napolitana} baja a la sensible ${t.sensible} y el bajo sube de ${cuatro!} a ${cinco!}. A veces pasa antes por ${t.I}/${cinco!}, la 6/4 cadencial.`,
      },
      {
        prompt: `En ${t.nombre}, ¿entre qué dos notas está la sexta aumentada?`,
        choices: choices(`${sextoBajo} y ${cuartaAlta}`, [
          `${sextoBajo} y ${cuatro!}`,
          `${sextoBajo} y ${uno!}`,
          `${uno!} y ${cuartaAlta}`,
        ]),
        why: `De ${sextoBajo} a ${cuartaAlta} hay una sexta aumentada: un semitono más que la sexta mayor que hay hasta ${cuatro!}. Es el intervalo que da nombre a los tres acordes.`,
      },
      {
        prompt: `¿Qué sexta aumentada es ${alemana.join('–')}?`,
        choices: choices('Alemana', ['Italiana', 'Francesa', 'Napolitana']),
        why: `La italiana tiene tres notas (${italiana.join('–')}); la francesa añade ${dos!} y la alemana ${terceraMenor}. Esta lleva ${terceraMenor}: es la alemana.`,
      },
      {
        prompt: '¿Qué nota añade la sexta francesa a la italiana?',
        choices: choices(dos!, [terceraMenor, cinco!, napolitana]),
        why: `La francesa es la italiana con ${dos!}: ${sextoBajo}–${uno!}–${dos!}–${cuartaAlta}. Con ${terceraMenor} sería la alemana.`,
      },
      {
        prompt: `Al resolver una sexta aumentada en ${t.V}, ¿qué hacen ${sextoBajo} y ${cuartaAlta}?`,
        choices: choices(
          `${sextoBajo} baja y ${cuartaAlta} sube: se abren a una octava de ${cinco!}`,
          [
            'Se cierran: la de abajo sube y la de arriba baja, hasta un unísono',
            `Las dos bajan: ${sextoBajo} a ${cinco!} y ${cuartaAlta} a ${cuatro!}`,
            'Se quedan quietas: la sexta aumentada ya es consonante',
          ],
        ),
        why: `Las dos notas de la sexta aumentada tiran como sensibles: ${sextoBajo} está medio tono por encima de ${cinco!} y ${cuartaAlta} medio tono por debajo. Cada una va hacia su lado y llegan a ${cinco!} en octava, la fundamental de la dominante.`,
      },
    ],
  };
}

export const LECCIONES_DE_ARMONIA: Readonly<
  Record<DeArmonia, (tonic: PitchClass, mode: KeyMode) => LessonNotes>
> = {
  inversiones,
  enlaces,
  septimaDominante,
  secundarias,
  modulacion,
  cromaticos,
};
