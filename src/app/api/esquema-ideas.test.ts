import { describe, expect, it } from 'vitest';

/**
 * Que el esquema de salida exija exactamente lo que el validador exige.
 *
 * Vive en `app/` por lo mismo que `sin-clave.test.ts`: compara una cosa de
 * `server/` con una de `features/`, y esas dos capas no pueden importarse entre
 * sí —la regla 5, que ESLint vigila en los dos sentidos—. `app/` es la única que
 * ve las dos, y es donde la ruta las junta.
 *
 * **Esta es la invariante que se rompió, y costaba peticiones enteras.** El
 * esquema pedía `title` y `why`, y dejaba `degrees` y `scale` opcionales. El
 * modelo devolvía título y porqué —impecable contra el esquema, no tenía forma de
 * saber que faltaba algo— y `validateIdeas` lo barría entero, porque una idea sin
 * grados no se puede tocar. La ruta contestaba `unparseable_response` **con el
 * cupo ya gastado**, que se descuenta antes de llamar al modelo.
 *
 * La salida estructurada garantiza lo que el esquema **exige**, no lo que el
 * validador **espera**. Medido contra dos modelos locales de ocho mil millones de
 * parámetros: con el esquema viejo pasaban 0 de 4 peticiones; exigiéndolo, 4 de 4.
 */

import { degreesFor, SCALE_IDS } from '@core/music';
import { IDEA_KINDS, validateIdeas } from '@features/ideas/contract';

import { ideasSchema, type IdeasKind } from '@server/prompts';

const MODOS = ['major', 'minor'] as const;

/** Lo que el esquema declara obligatorio en una idea. */
function obligatorios(kind: IdeasKind, mode: (typeof MODOS)[number]): readonly string[] {
  const propiedades = ideasSchema(kind, mode)['properties'] as {
    ideas: { items: { required: string[] } };
  };
  return propiedades.ideas.items.required;
}

/** Una propiedad de una idea, tal y como la describe el esquema. */
function propiedad(kind: IdeasKind, mode: (typeof MODOS)[number], nombre: string): unknown {
  const propiedades = ideasSchema(kind, mode)['properties'] as {
    ideas: { items: { properties: Record<string, unknown> } };
  };
  return propiedades.ideas.items.properties[nombre];
}

describe('el esquema de las ideas y su validador dicen lo mismo', () => {
  it('las dos listas de clases de idea no se han separado', () => {
    // `server/prompts.ts` escribe las tres por su cuenta, porque no puede
    // importarlas de un feature. Esto es lo único que impide que se separen.
    expect([...IDEA_KINDS].sort()).toEqual(
      (['progression', 'scale', 'twist'] as IdeasKind[]).sort(),
    );
  });

  it('lo mínimo que el esquema permite sobrevive al validador', () => {
    for (const kind of IDEA_KINDS) {
      for (const mode of MODOS) {
        const pedidos = obligatorios(kind, mode);
        const idea: Record<string, unknown> = { title: 'Una idea', why: 'Porque encaja.' };
        if (pedidos.includes('degrees')) {
          idea['degrees'] = [degreesFor(mode)[0]];
        }
        if (pedidos.includes('scale')) {
          idea['scale'] = SCALE_IDS[0];
        }

        const ideas = validateIdeas({ ideas: [idea] }, { kind, key: { tonic: 'A', mode } });
        expect(ideas, `${kind} en ${mode}`).toHaveLength(1);
      }
    }
  });

  it('título y porqué a secas no bastan, y por eso el esquema pide más', () => {
    // El otro lado de la misma moneda. Si esto dejara de rechazarse, el campo de
    // más en `required` sobraría y estaría encareciendo la petición para nada.
    for (const kind of IDEA_KINDS) {
      const soloTexto = { ideas: [{ title: 'Una idea', why: 'Porque encaja.' }] };

      expect(validateIdeas(soloTexto, { kind, key: { tonic: 'A', mode: 'minor' } }), kind).toEqual(
        [],
      );
      expect(obligatorios(kind, 'minor').length, kind).toBeGreaterThan(2);
    }
  });

  it('los enumerados solo dejan pasar lo que el dominio conoce', () => {
    // Aquí es donde se gana de verdad: la generación constreñida no puede salirse
    // de un `enum`. Sin él, `naturalMinor` y `minorPentatonic` no se adivinan —el
    // modelo escribía «Escala natural»— y no sobrevivía ni una idea.
    expect((propiedad('scale', 'minor', 'scale') as { enum: string[] }).enum).toEqual([
      ...SCALE_IDS,
    ]);

    for (const mode of MODOS) {
      const grados = propiedad('progression', mode, 'degrees') as { items: { enum: string[] } };
      expect(grados.items.enum, mode).toEqual([...degreesFor(mode)]);
    }
  });
});
