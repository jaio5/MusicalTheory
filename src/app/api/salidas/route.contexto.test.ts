import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Music from '@core/music';
import type * as AskModel from '@server/ask-model';

/**
 * **El mismo contexto en todos los sitios que construyen el menú.**
 *
 * La ruta construye el menú de salidas al leer la petición, al escribir el prompt,
 * al escribir el esquema, al validar lo que contesta el modelo y en el respaldo sin
 * IA, y **el modelo contesta por número**. Si uno de esos sitios se olvidara del
 * contexto —el estilo, las especies, el punteo—, su menú sería otro y el número
 * señalaría otra salida: lo que se enseña no sería lo que el modelo eligió.
 *
 * Aquí el generador es de mentira: lo que se comprueba no es qué salidas salen,
 * sino con qué se pidieron.
 */

const spendAi = vi.fn(async () => ({ kind: 'ok', account: {}, leftMonth: 10 }) as never);
const askModel = vi.fn();
const salidasPosibles = vi.fn();

// Una cuenta nueva en cada petición: el límite por minuto es de la cuenta
// (adr/0114), y aquí no es lo que se prueba.
vi.mock('@server/entitlements', () => ({
  spendAi: () => spendAi(),
  currentSession: async () => ({ userId: crypto.randomUUID(), account: {} }),
}));
vi.mock('@server/ask-model', async (original) => ({
  ...(await original<typeof AskModel>()),
  modelAvailable: () => true,
  askModel: (...args: unknown[]) => askModel(...args),
}));
vi.mock('@core/music', async (original) => ({
  ...(await original<typeof Music>()),
  salidasPosibles: (...args: unknown[]) => salidasPosibles(...args),
}));

const { POST } = await import('./route');

/** Un menú de dos salidas que continúan, como lo construiría el dominio. */
const MENU: Music.SalidaPosible[] = ['V I', 'IV I'].map((cierre) => ({
  path: 'seguir',
  nombre: `Cierre ${cierre}`,
  que: `Añade un cierre, ${cierre}.`,
  colores: ['cierra'],
  secciones: [
    {
      name: 'Lo que llevas',
      yours: true,
      steps: [
        { degree: 'I', beats: 4, move: null },
        { degree: 'vi', beats: 4, move: null },
      ],
    },
    {
      name: 'Cierre',
      yours: false,
      steps: cierre.split(' ').map((degree) => ({
        degree: degree as Music.DegreeSymbol,
        beats: 4,
        move: null,
      })),
    },
  ],
}));

let direccion = 0;
function pedir(body: unknown): Request {
  direccion += 1;
  return new Request('http://x/api/salidas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.4.0.${direccion}` },
    body: JSON.stringify(body),
  });
}

/** Una petición con todo el contexto que puede llevar. */
const CON_CONTEXTO = {
  key: { tonic: 'C', mode: 'major' },
  kind: 'continuar',
  role: 'estribillo',
  estilo: 'blues',
  pulsosPorCompas: 3,
  progression: [
    { degree: 'I', beats: 4, especie: 'dominant7', notas: [{ nota: 4, fuerte: true }] },
    { degree: 'vi', beats: 4, heard: true },
  ],
};

const CONTEXTO: Music.ContextoDeSalidas = {
  estilo: 'blues',
  pulsosPorCompas: 3,
  papel: 'estribillo',
  especies: ['dominant7', null],
  dudosos: [false, true],
  melodia: [[{ nota: 4, fuerte: true }], []],
};

/** El contexto con el que se pidió cada menú. */
function contextos(): unknown[] {
  return salidasPosibles.mock.calls.map((llamada) => llamada[3]);
}

beforeEach(() => {
  askModel.mockReset();
  salidasPosibles.mockReset();
  salidasPosibles.mockReturnValue(MENU);
});

describe('el contexto llega al menú', () => {
  it('al leer, al escribir el prompt y el esquema y al validar, el mismo', async () => {
    askModel.mockResolvedValue({ versions: [{ opcion: 2, title: 'Por el IV', why: 'Plagal.' }] });

    const res = await POST(pedir(CON_CONTEXTO));
    const body = (await res.json()) as { versions: { title: string }[] };

    expect(res.status).toBe(200);
    expect(body.versions.map((v) => v.title)).toEqual(['Por el IV']);
    // Leer, prompt, esquema y validar: cuatro veces, y las cuatro con lo mismo.
    expect(contextos().length).toBeGreaterThanOrEqual(4);
    for (const contexto of contextos()) {
      expect(contexto).toEqual(CONTEXTO);
    }
  });

  /**
   * El respaldo elige por número del mismo menú y lo valida el mismo validador:
   * si el dominio lo construyera sin contexto, numeraría otras salidas.
   */
  it('y en el respaldo sin IA, también', async () => {
    askModel.mockRejectedValue(new Error('sin red'));

    const res = await POST(pedir(CON_CONTEXTO));
    const body = (await res.json()) as { origen: string; versions: unknown[] };

    expect(body.origen).toBe('dominio');
    expect(body.versions).toHaveLength(2);
    for (const contexto of contextos()) {
      expect(contexto).toEqual(CONTEXTO);
    }
  });

  it('y sin clave, igual', async () => {
    askModel.mockImplementation(async (input: { sinClave: () => unknown }) => input.sinClave());

    await POST(pedir(CON_CONTEXTO));

    expect(contextos().length).toBeGreaterThanOrEqual(4);
    for (const contexto of contextos()) {
      expect(contexto).toEqual(CONTEXTO);
    }
  });

  // Los nombres los escribe quien compone: son texto libre y no llegan a ningún sitio.
  it('el nombre de la parte no llega, aunque lo manden', async () => {
    askModel.mockResolvedValue({ versions: [{ opcion: 1, title: 'Bien', why: 'Cierra.' }] });

    await POST(pedir({ ...CON_CONTEXTO, nombre: 'Mi estribillo', name: 'Mi estribillo' }));

    const { prompt } = askModel.mock.calls[0]![0] as { prompt: string };
    expect(prompt).not.toContain('Mi estribillo');
    expect(JSON.stringify(salidasPosibles.mock.calls)).not.toContain('Mi estribillo');
  });
});
