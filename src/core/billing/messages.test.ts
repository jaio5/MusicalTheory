import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { needsPlanMessage, planAfter, quotaMessage } from './messages';
import { planOf } from './plans';

const MEDIO = planOf('medio');

/**
 * Estas frases las leen dos sitios distintos —la pantalla al pintar el candado y
 * la ruta al rechazar la petición— así que un fallo aquí sale por partida doble.
 */
describe('qué plan hace falta', () => {
  it('dice el plan y el precio', () => {
    expect(needsPlanMessage(MEDIO, 'El Grado Profesional')).toBe(
      'El Grado Profesional entra en el plan Medio: 9,99 € al mes.',
    );
  });

  /**
   * Se leyó en pantalla «Las ideas de la IA **entra** en el plan Medio». El verbo
   * estaba fijo en singular mientras la mitad de los sujetos son plurales.
   */
  it('concuerda el verbo con un sujeto plural', () => {
    expect(needsPlanMessage(MEDIO, 'Las ideas de la IA', true)).toBe(
      'Las ideas de la IA entran en el plan Medio: 9,99 € al mes.',
    );
  });

  it('sin plan que lo incluya, lo dice y también concuerda', () => {
    expect(needsPlanMessage(null, 'Esto')).toBe('Esto no está disponible.');
    expect(needsPlanMessage(null, 'Las ideas', true)).toBe('Las ideas no están disponibles.');
  });
});

describe('el plan siguiente', () => {
  it('es el de arriba, y al último no le queda ninguno', () => {
    expect(planAfter('basico')?.id).toBe('medio');
    expect(planAfter('pro')).toBeNull();
  });
});

describe('cupo gastado', () => {
  // Los dos topes no se arreglan igual: el del día se espera y el del mes se
  // sube de plan, así que la frase tiene que decir cuál de los dos ha saltado.
  it('distingue el del día del del mes', () => {
    const hoy = quotaMessage(MEDIO, 'claude-opus-5', 'dia');
    const mes = quotaMessage(MEDIO, 'claude-opus-5', 'mes');

    expect(hoy).toMatch(/de hoy/);
    expect(hoy).toMatch(/mañana/);
    expect(mes).toMatch(/de este mes/);
    expect(mes).toMatch(/día uno/);
  });

  it('al que ya está en el último plan no le ofrece otro', () => {
    expect(quotaMessage(planOf('pro'), 'claude-opus-5', 'mes')).not.toMatch(/con el plan/);
  });
});

describe('el número del sujeto lo pone quien llama, y ahí es donde se falla', () => {
  /**
   * `needsPlanMessage` concuerda bien; lo que falla es pasarle el número
   * equivocado. Ya pasó dos veces y las dos se descubrieron ejecutando: en la
   * fase 13 con «Las ideas de la IA **entra** en el plan Medio», y al levantar
   * Postgres por primera vez con «Guardar tus canciones **entran** en el plan
   * Básico».
   *
   * Así que esto no prueba la función: recoge **los sujetos de verdad** del
   * código —los de las rutas y los de los candados de pantalla— y comprueba que
   * cada uno lleve el número que le toca. Es el mismo truco que
   * `coherencia.test.ts`: leer los ficheros, porque lo que se defiende no se ve
   * en una llamada suelta.
   */
  const FICHEROS = (() => {
    const raiz = join(process.cwd(), 'src');
    const salida: string[] = [];
    const recorrer = (dir: string) => {
      for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, entrada.name);
        if (entrada.isDirectory()) {
          recorrer(ruta);
        } else if (/\.tsx?$/.test(entrada.name) && !entrada.name.includes('.test.')) {
          salida.push(readFileSync(ruta, 'utf8'));
        }
      }
    };
    recorrer(raiz);
    return salida;
  })();

  /** Cada sujeto encontrado, con si se declaró plural. */
  function sujetos(): Array<{ sujeto: string; plural: boolean }> {
    const encontrados: Array<{ sujeto: string; plural: boolean }> = [];

    for (const codigo of FICHEROS) {
      // `needsPlanMessage(algo, 'Sujeto')` con o sin `, true` detrás.
      for (const m of codigo.matchAll(/needsPlanMessage\([^,]+,\s*\n?\s*'([^']+)'(,\s*true)?/g)) {
        encontrados.push({ sujeto: m[1]!, plural: m[2] !== undefined });
      }
      // `<PlanLock … what="Sujeto" … />`, mirando el elemento entero: el
      // `plural` puede venir antes o después del `what`, y en JSX cada prop va
      // en su línea.
      for (const m of codigo.matchAll(/<PlanLock\b([\s\S]*?)\/>/g)) {
        const bloque = m[1]!;
        const what = /what="([^"]+)"/.exec(bloque);
        if (what !== null) {
          encontrados.push({ sujeto: what[1]!, plural: /^\s*plural\s*$/m.test(bloque) });
        }
      }
    }
    return encontrados;
  }

  /**
   * Si ese sujeto es plural, mirándolo.
   *
   * En español lo decide el artículo, y todos los sujetos de este proyecto
   * empiezan por uno o por un infinitivo. Un infinitivo —«Guardar», «Preguntar»—
   * concuerda en singular por mucho que lleve un plural detrás, que es
   * exactamente el fallo que esto vigila.
   */
  function esPlural(sujeto: string): boolean {
    return /^(Las|Los|Unas|Unos)\s/.test(sujeto);
  }

  it('hay sujetos que comprobar', () => {
    expect(sujetos().length).toBeGreaterThan(5);
  });

  it('cada sujeto lleva el número que le toca', () => {
    const mal = sujetos()
      .filter(({ sujeto, plural }) => plural !== esPlural(sujeto))
      .map(({ sujeto, plural }) => `«${sujeto}» declarado ${plural ? 'plural' : 'singular'}`);

    expect(mal).toEqual([]);
  });

  it('y la frase que sale concuerda', () => {
    for (const { sujeto, plural } of sujetos()) {
      const frase = needsPlanMessage(MEDIO, sujeto, plural);
      expect(frase, `«${sujeto}» no concuerda`).toContain(plural ? ' entran en ' : ' entra en ');
    }
  });
});
