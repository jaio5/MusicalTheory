/**
 * Lo que se cuenta al entrar en una unidad: de qué va y qué va a entrar.
 *
 * Se entraba directo a la teoría y a las preguntas sin saber hacia dónde iban,
 * que es justo lo que no hace una clase: el profesor dice primero qué se va a
 * ver hoy, y así cada explicación cae en un sitio que ya estaba preparado. Y lo
 * que se promete aquí es **lo que luego se pregunta**: los contenidos hacen de
 * contrato con la lección, y la prueba no se sale de él (adr/0096).
 *
 * **Vive aparte del temario, y por peso.** Iba dentro de `COURSES`, y el temario
 * lo lee todo el que lee el avance: la cuenta, que no pinta ninguna, el repaso,
 * el trozo que componer descarga al sumar y el camino entero. Aquí solo lo
 * importa quien lo pinta, que es la pantalla de la unidad.
 *
 * El resumen va aparte, en `resumenes.ts`: el camino de `/aprender` enseña el de
 * la unidad siguiente y nada más, y con los contenidos en el mismo fichero se
 * los llevaba todos —el empaquetador no separa un módulo por lo que se usa de
 * él—. Los dos van por id de unidad, que es la llave que no cambia
 * (`curriculum.ts`), y en el orden del temario.
 */

import { resumenDe } from './resumenes';

/** Lo que se cuenta antes de empezar una unidad. */
export interface Presentacion {
  /** De qué va la unidad, en una o dos frases y sin tecnicismos todavía. */
  readonly resumen: string;
  /** Lo que va a entrar, punto por punto. Es lo que luego se pone a prueba. */
  readonly contenidos: readonly string[];
}

/** Lo que va a entrar en cada unidad, por su id. */
export const CONTENIDOS_DE_UNIDAD: Readonly<Record<string, readonly string[]>> = {
  // 1º de Elemental: El sonido escrito
  'e1-notas': [
    'Los siete nombres de las notas y su orden',
    'Sostenido, bemol y becuadro: qué hace cada uno',
    'Tono y semitono, y dónde están los dos semitonos naturales',
    'Notas enarmónicas: un mismo sonido con dos nombres',
  ],
  'e1-claves': [
    'Líneas, espacios y líneas adicionales',
    'La clave de sol en segunda línea',
    'La clave de fa en cuarta línea',
    'Por qué la guitarra se escribe una octava más alta de lo que suena',
  ],
  'e1-ritmo': [
    'Las figuras, de la redonda a la semicorchea, y lo que vale cada una',
    'Sus silencios',
    'El puntillo y la ligadura',
    'Compases simples y compuestos: 2/4, 3/4, 4/4 y 6/8',
  ],
  // 2º de Elemental: La escala mayor y los intervalos
  'e2-escala-mayor': [
    'La fórmula: tono, tono, semitono, tono, tono, tono, semitono',
    'Por qué hacen falta alteraciones fuera de Do',
    'Los nombres de los grados: tónica, supertónica, mediante, subdominante, dominante, superdominante y sensible',
    'Grados tonales y grados modales',
  ],
  'e1-escala': [
    'Subir y bajar la escala mayor de la tonalidad elegida',
    'Notar dónde caen los dos semitonos en el mástil',
  ],
  'e2-intervalos': [
    'Clasificación numérica: de la segunda a la octava',
    'Justos, mayores, menores, aumentados y disminuidos',
    'Inversión de intervalos: suman nueve y cambian de especie',
    'Consonancias y disonancias',
  ],
  'e2-oido-intervalos': [
    'Segundas y terceras, mayores y menores',
    'Cuarta, quinta y octava justas, y la sexta mayor',
    'Intervalos melódicos, subiendo y bajando, y armónicos',
  ],
  'e3-pentatonica': [
    'Las cinco notas que quedan al quitar el IV y el VII',
    'Tocarla subiendo y bajando',
  ],
  // 3º de Elemental: Tonalidades y modo menor
  'e3-rueda': [
    'La armadura y el orden de los sostenidos y los bemoles',
    'Saber la tonalidad mirando la armadura',
    'Tonalidades vecinas: una quinta arriba y una abajo',
    'Tonalidad relativa: la misma armadura con otro centro',
  ],
  'e3-oido': [
    'Distinguir de oído la relativa de la vecina',
    'Notar la nota nueva que trae un cambio de tonalidad',
  ],
  'e3-menores': [
    'La menor natural y su relativa mayor',
    'La menor armónica: la sensible y la segunda aumentada',
    'La menor melódica: subiendo y bajando',
    'Modo mayor y modo menor: la tercera manda',
  ],
  'e2-menor': ['Subir y bajar la menor natural', 'Oír la tercera menor sobre la tónica'],
  'e4-pentatonica': [
    'Las cinco notas de la pentatónica menor',
    'Por qué comparte notas con la pentatónica mayor relativa',
  ],
  'e4-blues': ['Subir y bajar la escala de blues', 'Oír la quinta disminuida de paso'],
  // 4º de Elemental: Los acordes de la tonalidad
  'e2-calidades': [
    'Fundamental, tercera y quinta',
    'Tríada mayor, menor, disminuida y aumentada, por sus intervalos',
    'Qué especie sale sobre cada grado de la escala',
  ],
  'e2-repaso': ['Mayor, menor y disminuido, solo con el oído'],
  'e1-grados': [
    'Los siete acordes de la tonalidad',
    'El número romano y lo que dice su mayúscula o minúscula',
    'I, IV y V: los grados tonales, los que sostienen la tonalidad',
  ],
  'e1-oido': ['Reconocer de oído la tónica, la subdominante y la dominante'],
  'e4-escalas': [
    'Las pentatónicas como escalas sin semitonos',
    'La escala de blues y su quinta disminuida',
    'Qué escala va encima de cada tonalidad',
  ],
  // 1º de Profesional: Funciones tonales y cadencias
  'p1-funciones': [
    'Las tres funciones y qué grados hacen cada una',
    'Por qué el VI puede hacer de tónica y el II de subdominante',
    'El tritono de la dominante',
    'La dominante en modo menor, que se trae del menor armónico',
  ],
  'p1-oido': ['Reconocer de oído tónica, subdominante y dominante'],
  'p6-cadencias': [
    'Cadencia perfecta: V–I, y por qué es la más conclusiva',
    'Cadencia imperfecta: el mismo enlace sin tanto peso',
    'Cadencia plagal: IV–I',
    'Semicadencia: la frase que se para en la dominante',
    'Cadencia rota: V–VI',
  ],
  // Prometía solo conclusiva o suspensiva, y la mitad de las preguntas son la
  // plagal y la rota.
  'p6-oido': [
    'Distinguir de oído una cadencia conclusiva de una suspensiva',
    'Reconocer la plagal y la rota',
  ],
  'p6-armonica': ['Subir y bajar la menor armónica', 'Oír la sensible y la segunda aumentada'],
  // 2º de Profesional: Inversiones y enlace de acordes
  'p2-inversiones': [
    'Estado fundamental, primera y segunda inversión',
    'El cifrado: 6 y 6/4, y el acorde con barra del cifrado americano',
    'Por qué la segunda inversión se usa con cuidado',
  ],
  'p2-enlaces': [
    'La nota común se mantiene y el resto va por el camino más corto',
    'Movimiento directo, contrario y oblicuo',
    'Quintas y octavas paralelas, y por qué se evitan',
    'La sensible sube a la tónica',
  ],
  // 3º de Profesional: Acordes de séptima
  'p2-cuatriadas': [
    'Las cuatríadas de cada grado',
    'Séptima mayor, de dominante, menor, semidisminuida y disminuida',
    'Cómo se cifra cada una',
  ],
  'p2-cifrado': [
    'Cómo se forma sobre el V grado',
    'La resolución: la sensible sube y la séptima baja',
    'Sus inversiones y su cifrado: 7, 6/5, +6 y +4',
  ],
  /*
    Prometía reconocer de oído la especie de cada séptima, y lo que pregunta
    es otra cosa, más modesta y más útil: oír la nota que se añade y si
    descansa o pide resolver. Reconocer las cinco especies de oído es de otro
    nivel, y la unidad no lo hace.
  */
  'p2-oido': [
    'Oír la séptima que se añade a un acorde',
    'Distinguir la séptima que descansa de la de dominante, que pide resolver',
  ],
  // 4º de Profesional: Dominantes secundarias y modulación
  'p4-secundarias': [
    'Qué es una dominante secundaria: el V de otro grado',
    'Cómo se escribe: V/V, V/II, V/VI',
    'Qué nota alterada trae y hacia dónde resuelve',
  ],
  'p4-modulacion': [
    'Los tonos vecinos: los que se diferencian en una alteración o menos',
    'El acorde pivote',
    'Modulación y tonicalización: cuánto dura el cambio',
  ],
  'p3-prestados': [
    'El modo paralelo y qué acordes se le toman',
    'El bVII y el iv en mayor',
    // Decía «la dominante mayor en menor», que no es un préstamo: es el V de
    // la propia tonalidad menor, por la armónica.
    'En menor, la tónica mayor: la tercera de picardía',
  ],
  'p3-oido': ['Reconocer de oído un acorde de fuera', 'Oír si lo prestado aclara u oscurece'],
  // 5º de Profesional: Cromatismo y armonía moderna
  'p5-napolitana': [
    'La sexta napolitana: el II rebajado en primera inversión',
    'Las sextas aumentadas: italiana, francesa y alemana',
    'Hacia dónde resuelven las dos',
  ],
  'p4-sustituciones': [
    'Sustituir por función y por notas comunes',
    'El VI por el I y el II por el IV',
    'El sustituto tritonal de la dominante',
  ],
  'p4-oido': ['Reconocer de oído si suena el acorde o su sustituto'],
  // 6º de Profesional: Los modos
  'p5-modos': [
    'Jónico, dórico, frigio, lidio, mixolidio, eólico y locrio',
    'La nota característica de cada uno',
    'Modos mayores y modos menores',
  ],
  /*
    Prometía una melodía modal y reconocer el modo por su nota, y lo que suena
    son tres acordes que vuelven a casa: la pregunta es si traen sensible. Es
    lo que separa el jónico del mixolidio y el menor armónico del eólico, y es
    lo que se dice.
  */
  'p5-oido': [
    'Oír si una vuelta a casa lleva sensible',
    'El V, con sensible, y el VII, sin ella',
    'Volver por descanso: el IV',
  ],
  'p5-dorico': ['Subir y bajar el modo dórico', 'Oír su sexta mayor'],
  'p5-frigio': ['Subir y bajar el modo frigio', 'Oír su segunda menor'],
  'p3-mixolidio': ['Subir y bajar el modo mixolidio', 'Oír su séptima menor'],
};

/**
 * La presentación entera de una unidad, para la pantalla que la abre.
 *
 * Una unidad del temario sin presentación es un fallo del temario y no algo que
 * pueda pasar al usarla —lo vigila `presentaciones.test.ts`—, así que revienta
 * en vez de pintar una unidad que entra sin decir a qué.
 */
export function presentacionDe(unitId: string): Presentacion {
  const contenidos = CONTENIDOS_DE_UNIDAD[unitId];
  if (contenidos === undefined) {
    throw new Error(`La unidad «${unitId}» no tiene presentación`);
  }
  return { resumen: resumenDe(unitId), contenidos };
}
