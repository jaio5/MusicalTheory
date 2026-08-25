import { describe, expect, it } from 'vitest';

import { MAX_VERSION_DEGREES } from '@core/billing';

import { parseVersionsRequest, validateVersions, type VersionsRequest } from './contract';

const EN_DO: VersionsRequest = {
  key: { tonic: 'C', mode: 'major' },
  progression: [
    { degree: 'I', beats: 4 },
    { degree: 'V', beats: 4 },
    { degree: 'vi', beats: 4 },
    { degree: 'IV', beats: 4 },
  ],
};

/** Una versión con la forma que espera el validador. */
function version(steps: ReadonlyArray<{ degree: string; move: string | null }>) {
  return {
    title: 'Más oscura',
    why: 'Cambia la dominante por la de al lado.',
    steps: steps.map((step, index) => ({
      degree: step.degree,
      beats: EN_DO.progression[index]!.beats,
      move: step.move,
    })),
  };
}

const IGUAL = [
  { degree: 'I', move: null },
  { degree: 'V', move: null },
  { degree: 'vi', move: null },
  { degree: 'IV', move: null },
];

describe('parseVersionsRequest', () => {
  it('acepta una progresión con su tonalidad', () => {
    const parsed = parseVersionsRequest({
      key: { tonic: 'C', mode: 'major' },
      progression: [
        { degree: 'I', beats: 4 },
        { degree: 'V', beats: 2 },
      ],
      name: '  Mi canción  ',
    });

    expect(parsed).toEqual({
      key: { tonic: 'C', mode: 'major' },
      progression: [
        { degree: 'I', beats: 4 },
        { degree: 'V', beats: 2 },
      ],
      name: 'Mi canción',
    });
  });

  it('descarta los grados que no existen en ese modo', () => {
    const parsed = parseVersionsRequest({
      key: { tonic: 'A', mode: 'minor' },
      progression: [
        { degree: 'i', beats: 4 },
        { degree: 'IV', beats: 4 },
        { degree: 'VI', beats: 4 },
      ],
    });

    expect(parsed?.progression.map((step) => step.degree)).toEqual(['i', 'VI']);
  });

  it('con menos de dos acordes no hay nada que rearmonizar', () => {
    // Gastar una petición para devolver el mismo acorde otra vez es gastar
    // dinero por nada.
    expect(
      parseVersionsRequest({
        key: { tonic: 'C', mode: 'major' },
        progression: [{ degree: 'I', beats: 4 }],
      }),
    ).toBeNull();
    expect(
      parseVersionsRequest({ key: { tonic: 'C', mode: 'major' }, progression: [] }),
    ).toBeNull();
  });

  it('sin tonalidad no hay petición', () => {
    expect(parseVersionsRequest({ progression: EN_DO.progression })).toBeNull();
    expect(
      parseVersionsRequest({ key: { tonic: 'H', mode: 'major' }, progression: EN_DO.progression }),
    ).toBeNull();
    expect(parseVersionsRequest(null)).toBeNull();
  });

  it('recorta la progresión por el tope, que también es gasto', () => {
    const larga = Array.from({ length: MAX_VERSION_DEGREES + 10 }, () => ({
      degree: 'I',
      beats: 4,
    }));
    const parsed = parseVersionsRequest({ key: { tonic: 'C', mode: 'major' }, progression: larga });

    expect(parsed?.progression).toHaveLength(MAX_VERSION_DEGREES);
  });

  it('los pulsos imposibles se acercan al rango en vez de tumbar la petición', () => {
    const parsed = parseVersionsRequest({
      key: { tonic: 'C', mode: 'major' },
      progression: [
        { degree: 'I', beats: 0 },
        { degree: 'V', beats: 900 },
        { degree: 'IV', beats: 'cuatro' },
      ],
    });

    expect(parsed?.progression.map((step) => step.beats)).toEqual([1, 16, 1]);
  });
});

describe('validateVersions', () => {
  it('acepta una versión cuyos movimientos son ciertos', () => {
    const versions = validateVersions(
      {
        versions: [
          version([
            { degree: 'I', move: null },
            { degree: 'bII', move: 'tritono' },
            { degree: 'vi', move: null },
            { degree: 'ii', move: 'relativo' },
          ]),
        ],
      },
      EN_DO,
    );

    expect(versions).toHaveLength(1);
    // Los cifrados se recalculan aquí, no se creen al modelo.
    expect(versions[0]!.steps.map((step) => step.symbol)).toEqual(['C', 'Db', 'Am', 'Dm']);
    expect(versions[0]!.steps.map((step) => step.from)).toEqual(['I', 'V', 'vi', 'IV']);
    expect(versions[0]!.steps[1]!.move).toBe('tritono');
  });

  it('tira la versión que declara un movimiento falso', () => {
    // Es lo que sostiene la fase entera: el acorde es razonable —IV en Do
    // mayor— pero no sale de aplicar el tritono al V.
    const versions = validateVersions(
      {
        versions: [
          version([
            { degree: 'I', move: null },
            { degree: 'IV', move: 'tritono' },
            { degree: 'vi', move: null },
            { degree: 'IV', move: null },
          ]),
        ],
      },
      EN_DO,
    );

    expect(versions).toEqual([]);
  });

  it('tira la versión que dice no haber tocado un compás que sí cambió', () => {
    const versions = validateVersions(
      {
        versions: [
          version([
            { degree: 'I', move: null },
            { degree: 'bII', move: null },
            { degree: 'vi', move: null },
            { degree: 'IV', move: null },
          ]),
        ],
      },
      EN_DO,
    );

    expect(versions).toEqual([]);
  });

  it('tira la versión que declara un movimiento en un compás que no cambia', () => {
    const versions = validateVersions(
      {
        versions: [
          version([
            { degree: 'I', move: 'relativo' },
            { degree: 'bII', move: 'tritono' },
            { degree: 'vi', move: null },
            { degree: 'IV', move: null },
          ]),
        ],
      },
      EN_DO,
    );

    expect(versions).toEqual([]);
  });

  it('tira la versión que no cambia ni un compás: eso es la canción', () => {
    expect(validateVersions({ versions: [version(IGUAL)] }, EN_DO)).toEqual([]);
  });

  it('tira la versión que cambia la forma de la canción', () => {
    const corta = {
      title: 'Corta',
      why: 'Quita un compás.',
      steps: [
        { degree: 'I', beats: 4, move: null },
        { degree: 'bII', beats: 4, move: 'tritono' },
      ],
    };

    expect(validateVersions({ versions: [corta] }, EN_DO)).toEqual([]);
  });

  it('los pulsos salen de la canción, no de lo que diga el modelo', () => {
    const mentirosa = {
      title: 'Otra',
      why: 'Cambia la dominante.',
      steps: [
        { degree: 'I', beats: 99, move: null },
        { degree: 'bII', beats: 99, move: 'tritono' },
        { degree: 'vi', beats: 99, move: null },
        { degree: 'IV', beats: 99, move: null },
      ],
    };

    const versions = validateVersions({ versions: [mentirosa] }, EN_DO);

    expect(versions[0]!.steps.map((step) => step.beats)).toEqual([4, 4, 4, 4]);
  });

  it('tira la versión con un grado que no existe en ese modo', () => {
    const versions = validateVersions(
      {
        versions: [
          version([
            { degree: 'I', move: null },
            { degree: 'iv', move: 'prestamo' },
            { degree: 'vi', move: null },
            { degree: 'IV', move: null },
          ]),
        ],
      },
      EN_DO,
    );

    expect(versions).toEqual([]);
  });

  it('una versión sin título o sin porqué se cae: el porqué es medio producto', () => {
    const sinPorque = {
      ...version([
        { degree: 'I', move: null },
        { degree: 'bII', move: 'tritono' },
        { degree: 'vi', move: null },
        { degree: 'IV', move: null },
      ]),
      why: '',
    };

    expect(validateVersions({ versions: [sinPorque] }, EN_DO)).toEqual([]);
  });

  it('se queda con las buenas aunque vengan mezcladas con malas', () => {
    const buena = version([
      { degree: 'I', move: null },
      { degree: 'bII', move: 'tritono' },
      { degree: 'vi', move: null },
      { degree: 'IV', move: null },
    ]);
    const mala = version([
      { degree: 'I', move: null },
      { degree: 'IV', move: 'tritono' },
      { degree: 'vi', move: null },
      { degree: 'IV', move: null },
    ]);

    expect(validateVersions({ versions: [mala, buena] }, EN_DO)).toHaveLength(1);
  });

  it('una respuesta que no es lo que se pidió da una lista vacía, no un error', () => {
    expect(validateVersions(null, EN_DO)).toEqual([]);
    expect(validateVersions({ versiones: [] }, EN_DO)).toEqual([]);
    expect(validateVersions({ versions: 'tres' }, EN_DO)).toEqual([]);
  });
});
