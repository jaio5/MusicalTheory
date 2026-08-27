import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mailer } from './index';
import { NoMailer } from './none';
import { HttpMailer, mailConfigured } from './resend';

/**
 * Por dónde sale el correo, y qué pasa cuando no sale.
 *
 * Lo que se prueba con más cuidado es lo que ya salió mal una vez: `NoMailer`
 * declaraba `sends: false`, la ruta lo comprobaba **antes** de crear el vale, y
 * el correo del registro no se escribía jamás. El comentario prometía poder
 * probar el flujo entero sin dar de alta un proveedor y era mentira. Se vio al
 * ejecutarlo por primera vez.
 *
 * De Resend se prueba la petición que se construye, no que Resend la acepte: eso
 * pide una clave de verdad y está anotado en `docs/PARA-PUBLICAR.md`.
 */

const fetchFalso = vi.fn();
const entorno = { ...process.env };

beforeEach(() => {
  fetchFalso.mockReset();
  vi.stubGlobal('fetch', fetchFalso);
  delete process.env['MAIL_API_KEY'];
  delete process.env['MAIL_FROM'];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  process.env = { ...entorno };
});

const carta = { to: 'a@b.c', subject: 'Tu contraseña', text: 'Entra aquí: https://caos.test/x' };

describe('qué proveedor hay puesto', () => {
  it('sin las dos variables, el que no manda', () => {
    // Es lo que hace que un clon recién bajado funcione entero: sin proveedor no
    // hay «he olvidado mi contraseña», y la pantalla lo dice en vez de prometer
    // un correo que no va a llegar.
    process.env['MAIL_API_KEY'] = 'clave';

    expect(mailConfigured()).toBe(false);
    expect(mailer()).toBe(NoMailer);
  });

  it('con las dos, el de HTTP', () => {
    process.env['MAIL_API_KEY'] = 'clave';
    process.env['MAIL_FROM'] = 'caos@example';

    expect(mailConfigured()).toBe(true);
    expect(mailer()).toBe(HttpMailer);
  });
});

describe('el que no manda', () => {
  it('en desarrollo cuenta como que manda', () => {
    // Escribir el correo en el registro **es** mandarlo cuando quien desarrolla
    // lo lee ahí. Con `sends: false` la ruta ni llegaba a llamarlo.
    expect(NoMailer.sends).toBe(true);
  });

  it('escribe en el registro lo que habría mandado, con el enlace', async () => {
    const registro = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    // Devuelve `false` porque no ha salido ningún correo de verdad: `sends` es
    // otra pregunta —si esta pantalla puede prometerlo— y son cosas distintas.
    expect(await NoMailer.send(carta)).toBe(false);
    expect(registro.mock.calls[0]![0]).toContain('https://caos.test/x');
  });

  it('en produccion no escribe nada', async () => {
    // Sería dejar un vale de recuperación escrito en los registros, que es justo
    // lo que la tabla evita guardando solo la huella.
    vi.stubEnv('NODE_ENV', 'production');
    const registro = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await NoMailer.send(carta);

    expect(registro).not.toHaveBeenCalled();
  });
});

describe('el de HTTP', () => {
  beforeEach(() => {
    process.env['MAIL_API_KEY'] = 'clave';
    process.env['MAIL_FROM'] = 'caos@example';
  });

  it('manda los cuatro campos y la clave en la cabecera', async () => {
    // Cambiar de proveedor es este fichero: la dirección, estos cuatro nombres y
    // la cabecera. Nada más los conoce.
    fetchFalso.mockResolvedValue(new Response('', { status: 200 }));

    expect(await HttpMailer.send(carta)).toBe(true);

    const [, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer clave');
    expect(JSON.parse(init.body as string)).toEqual({
      from: 'caos@example',
      to: ['a@b.c'],
      subject: 'Tu contraseña',
      text: 'Entra aquí: https://caos.test/x',
    });
  });

  it('si el proveedor lo rechaza, no se dice que ha salido', async () => {
    fetchFalso.mockResolvedValue(new Response('', { status: 422 }));

    expect(await HttpMailer.send(carta)).toBe(false);
  });

  it('si la red falla, tampoco, y no lanza', async () => {
    // Quien llama está sirviendo una pantalla: una excepción aquí la tumbaría
    // por no haber podido mandar un correo.
    fetchFalso.mockRejectedValue(new Error('sin red'));

    expect(await HttpMailer.send(carta)).toBe(false);
  });
});
