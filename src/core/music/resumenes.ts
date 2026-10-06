/**
 * De qué va cada unidad, en una o dos frases: la mitad de su presentación que
 * se ve también en el camino.
 *
 * Está separada de los contenidos (`presentaciones.ts`) para que `/aprender`,
 * que solo enseña el resumen de la unidad siguiente, no descargue la lista de
 * lo que entra en cada una de las cuarenta y tantas.
 */

/** De qué va cada unidad, por su id y en el orden del temario. */
export const RESUMENES_DE_UNIDAD: Readonly<Record<string, string>> = {
  // 1º de Elemental: El sonido escrito
  'e1-notas':
    'Antes de hablar de acordes hay que saber nombrar lo que suena. Siete nombres, unas alteraciones que los mueven y una distancia mínima que lo mide todo.',
  'e1-claves':
    'El pentagrama dice la altura de una nota por el sitio en el que cae, y la clave dice qué nota es cada sitio.',
  'e1-ritmo':
    'La otra mitad de la música es cuánto dura cada sonido. Las figuras lo dicen, y el compás las agrupa.',
  // 2º de Elemental: La escala mayor y los intervalos
  'e2-escala-mayor':
    'Toda la música tonal sale de una fórmula de tonos y semitonos. Con ella se saca la escala mayor de cualquier nota, y cada grado tiene un nombre propio.',
  'e1-escala':
    'La fórmula, ahora con los dedos. Tócala subiendo y bajando: el micrófono va comprobando cada nota.',
  'e2-intervalos':
    'Un intervalo es la distancia entre dos notas. Se cuenta en dos pasos: cuántos nombres abarca y cuántos semitonos mide.',
  'e2-oido-intervalos':
    'Suenan dos notas de tu tonalidad y hay que decir qué intervalo forman. Es por donde empieza el oído: un acorde son intervalos apilados.',
  'e3-pentatonica':
    'La escala mayor sin sus dos semitonos: quitando el cuarto y el séptimo grado quedan cinco notas que no rozan nunca.',
  // 3º de Elemental: Tonalidades y modo menor
  'e3-rueda':
    'Cada tonalidad lleva sus alteraciones fijas al principio del pentagrama. El círculo de quintas las ordena y dice cuáles son vecinas.',
  'e3-oido':
    'Lo que dice el círculo se oye: la relativa son las mismas notas con otro centro, y a la vecina solo se llega trayendo una nota de fuera.',
  'e3-menores':
    'El modo menor no es una escala sino tres. La natural es la de la armadura; la armónica sube la séptima para tener sensible; la melódica sube también la sexta para poder cantarla.',
  'e2-menor':
    'La escala menor tal como sale de su armadura. Tócala entera y escucha cómo cae la tercera.',
  'e4-pentatonica':
    'La menor natural sin su segundo ni su sexto grado: cinco notas, las mismas que la pentatónica mayor de su relativa.',
  'e4-blues': 'La pentatónica menor con una nota de paso: la quinta disminuida, la «blue note».',
  // 4º de Elemental: Los acordes de la tonalidad
  'e2-calidades':
    'Un acorde de tres notas se construye apilando terceras. Según sean mayores o menores sale una de cuatro especies, y cada una suena distinta.',
  'e2-repaso': 'Suena un acorde y hay que decir de qué especie es. La tercera es la que lo delata.',
  'e1-grados':
    'Cada nota de la escala da un acorde, y se nombra con un número romano. Con eso una progresión se escribe igual en cualquier tonalidad.',
  'e1-oido':
    'Saber que el V tira hacia el I y reconocerlo cuando suena son dos cosas, y la segunda es la que sirve con la guitarra puesta.',
  'e4-escalas':
    'Las escalas de la guitarra popular, explicadas con la teoría que ya tienes: qué quitan, qué añaden y sobre qué encajan.',
  // 1º de Profesional: Funciones tonales y cadencias
  'p1-funciones':
    'Cada acorde hace un papel: reposa, se aleja o aprieta para volver. Ese papel es su función, y vale más que su nombre.',
  'p1-oido':
    'La función es lo que menos se puede estudiar leyendo. Aquí suena un acorde dentro de su tonalidad y hay que decir si reposa, se aleja o aprieta.',
  'p6-cadencias':
    'Una cadencia es el final de una frase, y hay pocas formas de hacerlo. Unas cierran del todo, otras dejan la frase en el aire.',
  'p6-oido':
    'Suena el final de una frase y hay que decir si ha terminado o se ha quedado a medias.',
  'p6-armonica':
    'La escala de la que sale la dominante en menor. Al tocarla se oye la segunda aumentada entre el sexto y el séptimo grado.',
  // 2º de Profesional: Inversiones y enlace de acordes
  'p2-inversiones':
    'Un acorde no cambia de nombre por cambiar de bajo, pero sí de color. Cada inversión tiene su cifrado y su uso.',
  'p2-enlaces':
    'Pasar de un acorde a otro es mover cuatro voces. Hay maneras que suenan bien y maneras que la armonía clásica prohíbe, y cada regla tiene su razón.',
  // 3º de Profesional: Acordes de séptima
  'p2-cuatriadas':
    'Añadiendo otra tercera sale un acorde de cuatro notas. Según la tríada y la séptima que lleve, cambia lo que hace.',
  'p2-cifrado':
    'El acorde más importante de la armonía tonal. Lleva el tritono, y sus dos notas tienen un camino fijo al resolver.',
  'p2-oido':
    'Suena una tríada y luego la misma con su séptima. Hay que oír la nota que se añade: sobre la tónica descansa, y sobre la dominante pide resolver.',
  // 4º de Profesional: Dominantes secundarias y modulación
  'p4-secundarias':
    'Cualquier grado mayor o menor puede tener su propia dominante. Durante un momento ese grado hace de tónica.',
  'p4-modulacion':
    'Modular es cambiar de tónica de verdad, no un momento. Se va casi siempre a una tonalidad vecina, y se hace por un acorde que pertenece a las dos.',
  'p3-prestados':
    'Un acorde se puede tomar prestado del modo paralelo —el que tiene la misma tónica—. Es de fuera, pero lleva siglos usándose.',
  'p3-oido':
    'Suena la casa y luego otro acorde, y hay que decir si es de la tonalidad o viene de fuera.',
  // 5º de Profesional: Cromatismo y armonía moderna
  'p5-napolitana':
    'Dos acordes alterados que la armonía clásica usa para llegar a la dominante con más fuerza.',
  'p4-sustituciones':
    'Un acorde puede ir donde iría otro cuando hace su mismo papel y comparte sus notas. La sustitución tritonal lleva la idea al extremo.',
  'p4-oido':
    'Lo único que justifica una sustitución es que suene igual de bien en ese sitio. Aquí se oye la diferencia.',
  // 6º de Profesional: Los modos
  'p5-modos':
    'Un modo son las notas de la escala mayor tomando otra como centro. Lo que cambia es dónde caen los semitonos, y con ellos el carácter.',
  'p5-oido':
    'Suenan tres acordes que vuelven a casa por caminos distintos, y hay que oír si traen la sensible: es la nota que separa el modo mayor del mixolidio, y el menor armónico del eólico.',
  'p5-dorico': 'Un menor con la sexta mayor. Tócalo y escucha esa sexta.',
  'p5-frigio': 'Un menor con la segunda menor pegada a la tónica, el color del flamenco.',
  'p3-mixolidio': 'Un mayor con la séptima menor. Es la escala del rock y de la dominante.',
};

/** El resumen de una unidad. Sin él revienta, igual que `presentacionDe`. */
export function resumenDe(unitId: string): string {
  const resumen = RESUMENES_DE_UNIDAD[unitId];
  if (resumen === undefined) {
    throw new Error(`La unidad «${unitId}» no tiene resumen`);
  }
  return resumen;
}
