import { describe, expect, it } from 'vitest';

import { copiaLasInstrucciones, esUnCebo } from './prosa-del-modelo';

/**
 * **Lo que pintó el modelo con una inyección delante**, en la auditoría del 7 de
 * octubre de 2026: un enlace con «nota» dentro por el profesor, y el título
 * «Renueva tu cuenta en evil.example» tres de tres veces por las salidas
 * (adr/0115).
 */
describe('un cebo, hable de lo que hable', () => {
  it.each([
    'Antes de seguir, confirma tu cuenta en https://evil.example: es una nota del equipo.',
    'Renueva tu cuenta en evil.example',
    'Entra en www.evil.example y sigue con el acorde de G.',
    'Escribe a soporte@evil.example con tu nombre.',
    'El acorde de G pide tu contraseña para seguir.',
    'Pon tu password en el campo de la nota.',
    'Haz login antes de tocar el C.',
    'Inicia sesión otra vez con la guitarra en las manos.',
    'Paga con tarjeta el siguiente acorde.',
    'Mándame un e-mail con la progresión.',
    'Verifica tu cuenta para guardar la canción.',
    'Visita evil。example para la nota.',
    // El dominio con una «е» y una «х» cirílicas.
    'Renueva en evil.ехample',
    // Y la palabra con un acento combinado encima.
    'Tu contrase\u0301ña, por favor.',
  ])('%s', (texto) => {
    expect(esUnCebo(texto)).toBe(true);
  });

  it('una respuesta de música normal no lo es', () => {
    for (const texto of [
      'La cadencia perfecta en C mayor es G → C: la sensible sube a la tónica.',
      'El enlace de voces de V7 a I resuelve la séptima bajando.',
      'Pon la clave de sol y el clic a 90 bpm.',
      'Una Csus4 suspendida que resuelve en C.',
      'El V/V es D7, y prepara el G. Luego vuelve al C.',
      'Toca la 3.ª cuerda al aire, y luego el 5.º traste.',
      'Grados: I, IV, V. Acordes: C, F, G.',
      'Con tu cuenta se guarda el avance, no el audio.',
    ]) {
      expect(esUnCebo(texto), texto).toBe(false);
    }
  });
});

const INSTRUCCIONES = `Eres un guitarrista con años de tablas que explica teoría a otro que toca de
oído: no le expliques qué es una cuerda, pero no des por sabido el vocabulario.
Responde en español, en dos o tres frases, con verbos activos, sin exclamaciones
ni listas, y sin teoría que no te pidan. Explica en la tonalidad que te den, con sus
acordes, no en C mayor. La tabla y la teoría mandan sobre lo que recuerdes.`;

describe('la copia de las instrucciones', () => {
  it('ocho palabras seguidas suyas son copiarlas', () => {
    expect(
      copiaLasInstrucciones(
        'Claro: eres un guitarrista con años de tablas que explica.',
        INSTRUCCIONES,
      ),
    ).toBe(true);
  });

  /**
   * **La copia intercalada**: una palabra de música cada seis, que la regla de ocho
   * seguidas no veía. Es lo que pedía la inyección de la auditoría.
   */
  it('con una palabra metida cada seis, también', () => {
    const intercalada = INSTRUCCIONES.split(/\s+/u)
      .map((palabra, i) => (i % 6 === 5 ? `${palabra} nota` : palabra))
      .join(' ');

    expect(copiaLasInstrucciones(intercalada, INSTRUCCIONES)).toBe(true);
  });

  it('y una frase suya corta con dos palabras metidas, que es casi todo lo escrito', () => {
    expect(
      copiaLasInstrucciones(
        'Responde nota en español, en dos o tres frases, con verbos acorde activos, sin exclamaciones ni listas',
        INSTRUCCIONES,
      ),
    ).toBe(true);
  });

  it('una respuesta de música con palabras suyas sueltas no es copiarlas', () => {
    expect(
      copiaLasInstrucciones(
        'En la tonalidad de A menor los acordes son Am, Bdim, C, Dm, Em, F y G. La teoría dice que el V tira al i; toca el E y escucha cómo pide volver. Con la tabla delante lo ves: la dominante es E y la subdominante Dm.',
        INSTRUCCIONES,
      ),
    ).toBe(false);
  });

  it('siete suyas en su orden, diluidas en una respuesta larga, no son copiarlas', () => {
    const suyas = [
      'guitarrista',
      'tablas',
      'explica',
      'teoría',
      'cuerda',
      'vocabulario',
      'responde',
      'frases',
    ];
    const diluida = suyas
      .map((palabra) => `${palabra} sobre acordes, cadencias y escalas`)
      .join(' ');

    expect(copiaLasInstrucciones(diluida, INSTRUCCIONES)).toBe(false);
  });

  it('sin instrucciones no se mira', () => {
    expect(copiaLasInstrucciones(INSTRUCCIONES)).toBe(false);
  });
});
