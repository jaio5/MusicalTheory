import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { describe, expect, it, vi } from 'vitest';

import { getCloneableBody } from 'next/dist/server/body-streams';

import nextConfig from '../../next.config';
import { MAX_CUERPO } from './request-body';

/**
 * **El tope del cuerpo de la entrada** ([adr/0113](../../docs/adr/0113-los-topes-cuentan-lo-que-cabe-y-agrupan-lo-que-es-de-uno.md)).
 *
 * `/api/auth/callback/credentials` la lee Auth.js, no `readJsonBody`, así que el
 * tope de 128 KB de las demás rutas no la cubría: veinte POST con un correo de
 * 8 MB llevaron el proceso de 46 a 687 MB. Lo único que se pone delante de todas
 * las rutas es el cuerpo que guarda el proxy, con el tope de
 * `experimental.proxyClientMaxBodySize` —10 MB de serie—.
 *
 * Aquí se ejecuta **la pieza de Next que lo aplica**, con el número de nuestra
 * configuración: un cuerpo de 8 MB le llega a la ruta recortado a 128 KB.
 */
describe('el cuerpo que guarda el proxy', () => {
  it('tiene el mismo tope que readJsonBody, ni más ni menos', () => {
    // Más grande dejaría la entrada como estaba; más pequeño partiría cuerpos que
    // `readJsonBody` sí acepta, sin error y sin aviso a quien los manda.
    expect(nextConfig.experimental?.proxyClientMaxBodySize).toBe(MAX_CUERPO);
  });

  it('un cuerpo de 8 MB le llega a la ruta recortado', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const trozo = Buffer.alloc(64 * 1024, 'a');
    const peticion = Readable.from(
      (function* () {
        for (let i = 0; i < 128; i += 1) {
          yield trozo;
        }
      })(),
    ) as unknown as IncomingMessage;

    const cuerpo = getCloneableBody(
      peticion,
      nextConfig.experimental?.proxyClientMaxBodySize as number,
    );
    // Lo que lee el proxy, entero.
    for await (const pedazo of cuerpo.cloneBodyStream()) {
      void pedazo;
    }
    await cuerpo.finalize();
    // Y lo que lee la ruta después, que es lo que importa.
    let leidos = 0;
    for await (const pedazo of peticion) {
      leidos += (pedazo as Buffer).length;
    }

    expect(leidos).toBeLessThanOrEqual(MAX_CUERPO);
    expect(leidos).toBeGreaterThan(0);
    expect(String(aviso.mock.calls[0]?.[0])).toMatch(/exceeded/);
    aviso.mockRestore();
  });
});
