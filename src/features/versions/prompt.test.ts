import { describe, expect, it } from 'vitest';

import { degreesFor, type DegreeSymbol, type KeyMode, type PathStep } from '@core/music';

import { validateVersions, type VersionsRequest } from './contract';
import { ejemplosDeRetoque, promptDeSalidas } from './prompt';

/**
 * El prompt de las salidas, en lo que toca a retocar.
 *
 * Al retocar el modelo devuelve solo el trozo que cambia y el compás donde
 * empieza (adr/0086), y lo que lo enseña son **ejemplos hechos con tus
 * compases**. Con `qwen3:8b` se copian tal cual, así que lo que se prueba aquí es
 * lo que hace que copiarlos no sea un error: que cada ejemplo pase el validador.
 */

const EN_DO: VersionsRequest = {
  key: { tonic: 'C', mode: 'major' },
  kind: 'retocar',
  progression: [
    { degree: 'I', beats: 4 },
    { degree: 'V', beats: 4 },
    { degree: 'vi', beats: 4 },
    { degree: 'IV', beats: 4 },
  ],
};

/** El prompt sin cabecera: la cabecera la pone `server/prompts.ts`. */
function prompt(request: VersionsRequest): string {
  return promptDeSalidas(request, []);
}

/** Cada ejemplo, como si lo hubiera devuelto el modelo. */
function comoSalidas(mode: KeyMode, pasos: readonly PathStep[]) {
  return ejemplosDeRetoque(mode, pasos).map((ejemplo) => ({
    path: ejemplo.path,
    desde: ejemplo.desde,
    title: 'Ejemplo',
    why: 'El del prompt.',
    sections: [{ name: 'Lo que llevas', steps: ejemplo.trozo }],
  }));
}

/** Todas las parejas de grados de un modo, con pulsos que no son siempre cuatro. */
function parejas(mode: KeyMode): PathStep[][] {
  const grados = degreesFor(mode) as readonly DegreeSymbol[];
  return grados.flatMap((a, i) =>
    grados.map((b, j) => [
      { degree: a, beats: [1, 4, 8, 16][i % 4]! },
      { degree: b, beats: [2, 4, 12][j % 3]! },
    ]),
  );
}

describe('los ejemplos de retocar', () => {
  it('cada uno pasa el validador, que es lo que hace que copiarlo valga', () => {
    const progresiones: PathStep[][] = [
      ...EN_DO.progression.map((_, i) => EN_DO.progression.slice(0, Math.max(2, i + 1))),
      [
        { degree: 'I', beats: 8 },
        { degree: 'IV', beats: 2 },
        { degree: 'V', beats: 2 },
        { degree: 'I', beats: 4 },
        { degree: 'vi', beats: 2 },
      ],
    ];
    for (const mode of ['major', 'minor'] as const) {
      for (const pasos of [...parejas(mode), ...(mode === 'major' ? progresiones : [])]) {
        const request: VersionsRequest = {
          key: { tonic: 'E', mode },
          kind: 'retocar',
          progression: pasos,
        };
        const salidas = comoSalidas(mode, pasos);

        expect(
          validateVersions({ versions: salidas }, request),
          `${mode}: ${pasos.map((p) => `${p.degree}/${p.beats}`).join(' ')}`,
        ).toHaveLength(salidas.length);
      }
    }
  });

  it('salen los tres cuando se pueden construir, y con tus compases', () => {
    expect(ejemplosDeRetoque('major', EN_DO.progression)).toEqual([
      { path: 'rearmonizar', desde: 1, trozo: [{ degree: 'vi', beats: 4, move: 'relativo' }] },
      { path: 'estirar', desde: 1, trozo: [{ degree: 'I', beats: 8, move: null }] },
      // La mitad que se queda son dos compases, y desde V se llega a la tónica.
      { path: 'otro-final', desde: 3, trozo: [{ degree: 'I', beats: 4, move: null }] },
    ]);
  });

  it('un compás largo se estira a la mitad, que el doble no cabe', () => {
    const [, estirar] = ejemplosDeRetoque('major', [
      { degree: 'I', beats: 16 },
      { degree: 'V', beats: 4 },
    ]);

    expect(estirar).toMatchObject({ path: 'estirar', trozo: [{ beats: 8 }] });
  });

  it('el final nuevo no repite el acorde de antes: eso es quedarse, no cerrar', () => {
    // Con `I V`, la tónica sería `I I`: la tónica repetida (adr/0051).
    const final = ejemplosDeRetoque('major', [
      { degree: 'I', beats: 4 },
      { degree: 'V', beats: 4 },
    ]).find((ejemplo) => ejemplo.path === 'otro-final');

    expect(final?.trozo.map((paso) => paso.degree)).toEqual(['IV']);
  });

  it('no se inventa el que no se puede construir', () => {
    // bIII y bVII no tienen movimiento en mayor: no hay nada que rearmonizar.
    const sinMovimiento = ejemplosDeRetoque('major', [
      { degree: 'bIII', beats: 4 },
      { degree: 'bVII', beats: 4 },
    ]);
    // Y desde V/iii solo se va a iii, que es el que ya había: no hay otro final.
    const sinFinal = ejemplosDeRetoque('major', [
      { degree: 'V/iii', beats: 4 },
      { degree: 'iii', beats: 4 },
    ]);

    expect(sinMovimiento.map((ejemplo) => ejemplo.path)).not.toContain('rearmonizar');
    expect(sinFinal.map((ejemplo) => ejemplo.path)).not.toContain('otro-final');
    // Sin compases no hay ninguno, y con uno no hay mitad que dejar en pie.
    expect(ejemplosDeRetoque('minor', [])).toEqual([]);
    expect(ejemplosDeRetoque('minor', [{ degree: 'i', beats: 4 }]).map((e) => e.path)).toEqual([
      'rearmonizar',
      'estirar',
    ]);
  });
});

describe('lo que se le dice al retocar', () => {
  it('tus compases van numerados, que es lo que cuenta desde', () => {
    expect(prompt(EN_DO)).toContain('1: I x4 | 2: V x4 | 3: vi x4 | 4: IV x4');
  });

  it('cada ejemplo dice el trozo y lo que queda, rotulados', () => {
    const texto = prompt(EN_DO);

    expect(texto).toContain(
      '- rearmonizar: desde 1, trozo vi x4 (relativo). Con lo demas, queda vi x4 | V x4 | vi x4 | IV x4',
    );
    expect(texto).toContain(
      '- otro-final: desde 3, trozo I x4. Con lo demas, queda I x4 | V x4 | I x4',
    );
  });

  it('y lo que no puede cambiar cada una, con tus números', () => {
    const texto = prompt({
      ...EN_DO,
      progression: [...EN_DO.progression, { degree: 'V', beats: 4 }],
    });

    // Cinco compases: la mitad que se queda son tres, así que otro final empieza en el 4.
    expect(texto).toContain('no pasa del 5');
    expect(texto).toContain('desde va del 4 al 5');
  });

  it('con muchos compases, lo que queda se corta a los ocho', () => {
    const largos: VersionsRequest = {
      ...EN_DO,
      progression: Array.from({ length: 12 }, (_, i) => EN_DO.progression[i % 4]!),
    };

    expect(prompt(largos)).toContain(
      'queda vi x4 | V x4 | vi x4 | IV x4 | I x4 | V x4 | vi x4 | IV x4 | …',
    );
  });

  it('al continuar no se habla de desde ni se numera nada', () => {
    const texto = prompt({ ...EN_DO, kind: 'continuar' });

    expect(texto).not.toContain('desde va del');
    expect(texto).toContain('Lo que lleva tocado (grado y pulsos): I x4 | V x4 | vi x4 | IV x4');
  });

  /**
   * El guardián de lo que esto añade al presupuesto de entrada. El de todo el
   * prompt está en `server/prompts.test.ts`, que no puede abrir `features/`; aquí
   * se mide lo que solo se escribe al retocar —los números de tus compases y los
   * ejemplos—, en el peor caso de treinta y dos compases de dieciséis pulsos, con
   * los mismos 3,2 caracteres por token que allí. Medido: unos 300.
   */
  it('lo que se añade al retocar no pasa de 320 tokens', () => {
    for (const mode of ['major', 'minor'] as const) {
      for (const degree of degreesFor(mode)) {
        const progression = Array.from({ length: 32 }, () => ({ degree, beats: 16 }));
        const texto = prompt({ key: { tonic: 'C', mode }, kind: 'retocar', progression });
        const bloque = texto.slice(texto.indexOf('Al retocar'), texto.indexOf('\nDevuelve hasta'));
        const numerada = texto.split('\n').find((linea) => linea.startsWith('Lo que lleva'))!;
        const sinNumeros = `Lo que lleva tocado (grado y pulsos): ${progression
          .map((paso) => `${paso.degree} x${paso.beats}`)
          .join(' | ')}`;
        const añadido = bloque.length + numerada.length - sinNumeros.length;

        expect(Math.ceil(añadido / 3.2), `${mode}, ${degree}`).toBeLessThanOrEqual(320);
      }
    }
  });
});
