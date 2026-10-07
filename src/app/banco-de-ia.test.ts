/**
 * El banco de pruebas de las salidas: **qué devuelve el modelo de verdad**.
 *
 * Es lo primero que pide el [ROADMAP](../../docs/ROADMAP.md) después de la
 * guitarra, y por una razón: lo que propone la IA es el corazón de esta
 * aplicación y **es lo único que no se puede comprobar con un test normal**. Lo
 * que hay medido sale de un modelo local de ocho mil millones, que elige del
 * menú que construye el dominio (`salidasPosibles`). Con eso no se sabe si su
 * criterio sirve o si el modelo es pequeño.
 *
 * **No corre con los demás.** Sale a la red y cuesta dinero, así que hay que
 * pedirlo:
 *
 *     pnpm banco:ia
 *
 * **Contra quién mide lo dice él en la primera línea del informe**, y no es un
 * detalle: con `ANTHROPIC_API_KEY` vacía en el `.env` —como está— contesta el
 * Ollama de casa, y medir un 8B local no contesta la pregunta. Para medir
 * contra la API, la clave va en el `.env`: es lo que `hasModelKey` mira.
 *
 * Usa **el mismo prompt, el mismo esquema y el mismo validador que la ruta**:
 * `SALIDAS` (`app/api/versiones/salidas.ts`), como el examen. Un banco con los
 * suyos propios mediría otro programa.
 *
 * **Lo cubre de sobra `pnpm examen:salidas`**, que va por la ruta con sus
 * reintentos y su respaldo, sobre el corpus entero y con directrices, y mide
 * además si lo elegido es lo que propondría un arreglista y si el porqué es
 * verdad. Este se queda como prueba de humo de cuatro llamadas, con el contexto
 * que manda la pantalla —estilo, especies, papel— para no medir otra petición.
 *
 * Lo que mide, y por qué cada cosa:
 *
 * - **Cuántas salidas devuelve** y cuántas sobreviven al validador del dominio.
 *   Es la pregunta dura: si no pasa el contrato, no llega a la pantalla.
 * - **Cuáles caen y por qué.** El validador dice el motivo, y el motivo es lo
 *   que se arregla en el prompt.
 * - **Si ha cambiado algo.** Una salida que devuelve la canción tal cual pasa
 *   el contrato y no sirve para nada, y es justo el fallo conocido de
 *   `rearmonizar`. Sin esta cuenta, el banco lo daría por bueno.
 */
import { writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const ENCENDIDO = process.env['BANCO_IA'] === '1';

/**
 * Dónde queda el informe.
 *
 * En un fichero y no solo por consola porque **Vitest se traga los `console.log`
 * cuando el test pasa**, que es justo cuando interesa leerlos. Y porque una
 * medida que no se guarda no se puede comparar con la de dentro de un mes, que
 * es para lo que existe este banco.
 */
const INFORME = process.env['BANCO_IA_INFORME'] ?? 'banco-de-ia.txt';

/**
 * Los casos, cortos a propósito.
 *
 * Cada uno cuesta una llamada. Cuatro compases bastan para ver si respeta la
 * forma, y una canción larga solo encarece la medida.
 */
const CASOS = [
  {
    nombre: 'I-IV-V-I en mayor, continuar una estrofa de rock',
    peticion: {
      key: { tonic: 'C', mode: 'major' },
      kind: 'continuar',
      role: 'estrofa',
      estilo: 'rock',
      progression: [
        { degree: 'I', beats: 4 },
        { degree: 'IV', beats: 4 },
        { degree: 'V', beats: 4 },
        { degree: 'I', beats: 4 },
      ],
    },
  },
  {
    nombre: 'I7-IV7-V7-I7 en mayor, retocar un blues',
    peticion: {
      key: { tonic: 'C', mode: 'major' },
      kind: 'retocar',
      estilo: 'blues',
      progression: [
        { degree: 'I', beats: 4, especie: 'dominant7' },
        { degree: 'IV', beats: 4, especie: 'dominant7' },
        { degree: 'V', beats: 4, especie: 'dominant7' },
        { degree: 'I', beats: 4, especie: 'dominant7' },
      ],
    },
  },
  {
    nombre: 'i-VI-III-VII en menor, retocar',
    peticion: {
      key: { tonic: 'A', mode: 'minor' },
      kind: 'retocar',
      progression: [
        { degree: 'i', beats: 4 },
        { degree: 'VI', beats: 4 },
        { degree: 'III', beats: 4 },
        { degree: 'VII', beats: 4 },
      ],
    },
  },
  {
    nombre: 'i-VI-III-VII en menor, continuar un estribillo pop',
    peticion: {
      key: { tonic: 'A', mode: 'minor' },
      kind: 'continuar',
      role: 'estribillo',
      estilo: 'pop',
      progression: [
        { degree: 'i', beats: 4 },
        { degree: 'VI', beats: 4 },
        { degree: 'III', beats: 4 },
        { degree: 'VII', beats: 4 },
      ],
    },
  },
] as const;

/** Lo que salió de un caso, para poder sumarlo al final. */
interface Resultado {
  readonly caso: string;
  readonly devueltas: number;
  readonly validas: number;
  readonly caminos: readonly string[];
  readonly iguales: number;
}

describe.skipIf(!ENCENDIDO)('El banco de las salidas', () => {
  it(
    'mide lo que devuelve el modelo contra el contrato del dominio',
    { timeout: 300_000 },
    async () => {
      // Dinámicos: sin esto, pedir los tests normales cargaría el SDK del
      // modelo para no ejecutar nada.
      const { parseVersionsRequest } = await import('@features/versions/contract');
      const { askModel } = await import('@server/ask-model');
      const { configuredModel, modelProvider } = await import('@server/ai-model');
      const { SALIDAS } = await import('@/app/api/versiones/salidas');

      const proveedor = modelProvider();
      expect(
        proveedor,
        'sin proveedor no hay nada que medir: pon ANTHROPIC_API_KEY o levanta el modelo de casa',
      ).not.toBe('ninguno');

      console.log(`\nBanco de las salidas · ${proveedor} · ${configuredModel()}\n`);

      const lineas: string[] = [`Banco de las salidas · ${proveedor} · ${configuredModel()}`, ''];
      const anotar = (linea: string) => {
        lineas.push(linea);
        console.log(linea);
      };

      const resultados: Resultado[] = [];

      for (const caso of CASOS) {
        const peticion = parseVersionsRequest(caso.peticion);
        // Si esto falla, el caso está mal escrito y no el modelo.
        expect(peticion, `el caso «${caso.nombre}» no pasa el parseo de la ruta`).not.toBeNull();
        if (peticion === null) continue;

        const payload = await askModel({
          prompt: SALIDAS.prompt(peticion),
          system: SALIDAS.system,
          schema: SALIDAS.schema(peticion),
          maxTokens: SALIDAS.maxTokens,
          sinClave: () => ({ versions: [] }),
        });

        const crudas = Array.isArray((payload as { versions?: unknown }).versions)
          ? ((payload as { versions: unknown[] }).versions as unknown[])
          : [];
        const validas = SALIDAS.validar(payload, peticion)?.versions ?? [];

        // Una salida que devuelve los mismos grados en el mismo orden pasa el
        // contrato y no sirve para nada.
        const original = peticion.progression.map((paso) => paso.degree).join(' ');
        const iguales = validas.filter((version) =>
          version.sections.every(
            (seccion) => seccion.steps.map((paso) => paso.degree).join(' ') === original,
          ),
        ).length;

        resultados.push({
          caso: caso.nombre,
          devueltas: crudas.length,
          validas: validas.length,
          caminos: validas.map((version) => version.path),
          iguales,
        });

        anotar(
          `${caso.nombre}\n  devueltas ${crudas.length} · válidas ${validas.length}` +
            `${iguales > 0 ? ` · ${iguales} devuelven lo mismo` : ''}\n` +
            `  caminos: ${validas.map((v) => v.path).join(', ') || '—'}`,
        );
      }

      const porCamino = new Map<string, number>();
      for (const resultado of resultados) {
        for (const camino of resultado.caminos) {
          porCamino.set(camino, (porCamino.get(camino) ?? 0) + 1);
        }
      }
      const devueltas = resultados.reduce((suma, r) => suma + r.devueltas, 0);
      const validas = resultados.reduce((suma, r) => suma + r.validas, 0);
      const iguales = resultados.reduce((suma, r) => suma + r.iguales, 0);

      anotar(
        `\nTotal: ${validas} de ${devueltas} pasan el contrato` +
          `${iguales > 0 ? `, y ${iguales} de las válidas devuelven la canción tal cual` : ''}.`,
      );
      anotar(
        `Por camino: ${[...porCamino].map(([id, n]) => `${id} ${n}`).join(' · ') || 'ninguno'}`,
      );

      writeFileSync(INFORME, `${lineas.join('\n')}\n`);
      console.log(`\nInforme en ${INFORME}`);

      // **El banco no se aprueba solo.** Lo que se afirma aquí es lo mínimo que
      // tiene que cumplir para que la función exista: que algo llegue y que algo
      // sirva. El número fino es para leerlo, no para que un umbral lo esconda.
      expect(devueltas, 'el modelo no devolvió ninguna salida').toBeGreaterThan(0);
      expect(validas, 'ninguna salida pasó el contrato del dominio').toBeGreaterThan(0);
    },
  );
});
