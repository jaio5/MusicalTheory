import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { parseSignatureHeader, TOLERANCE_SECONDS, verifyStripeSignature } from './stripe-signature';

const SECRET = 'whsec_de_prueba';
const BODY = '{"id":"evt_1","type":"checkout.session.completed"}';
const NOW = 1_700_000_000;

/** La cabecera que mandaría Stripe para ese cuerpo y ese instante. */
function firma(body: string, timestamp: number, secret = SECRET): string {
  const v1 = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

describe('parseSignatureHeader', () => {
  it('saca la marca de tiempo y todas las firmas', () => {
    expect(parseSignatureHeader('t=123,v1=aa,v1=bb')).toEqual({
      timestamp: 123,
      signatures: ['aa', 'bb'],
    });
  });

  it('ignora lo que no entiende en vez de rechazarlo', () => {
    // `v0` es de otra cosa, y una versión nueva no debe tumbar las que sí
    // sabemos comprobar.
    expect(parseSignatureHeader('t=123,v0=xx,v1=aa,basura')).toEqual({
      timestamp: 123,
      signatures: ['aa'],
    });
  });

  it('sin marca de tiempo o sin firma no hay cabecera', () => {
    expect(parseSignatureHeader('v1=aa')).toBeNull();
    expect(parseSignatureHeader('t=123')).toBeNull();
    expect(parseSignatureHeader('t=0,v1=aa')).toBeNull();
    expect(parseSignatureHeader('t=-5,v1=aa')).toBeNull();
    expect(parseSignatureHeader('t=hola,v1=aa')).toBeNull();
    expect(parseSignatureHeader('')).toBeNull();
    expect(parseSignatureHeader(null)).toBeNull();
    expect(parseSignatureHeader(42)).toBeNull();
  });
});

describe('verifyStripeSignature', () => {
  it('acepta la firma buena', () => {
    expect(
      verifyStripeSignature({ body: BODY, header: firma(BODY, NOW), secret: SECRET, now: NOW }),
    ).toBe('ok');
  });

  it('rechaza el cuerpo cambiado, aunque la firma sea de uno válido', () => {
    // Es el ataque que esto para: colar otro plan reusando una firma buena.
    const otro = BODY.replace('evt_1', 'evt_2');

    expect(
      verifyStripeSignature({ body: otro, header: firma(BODY, NOW), secret: SECRET, now: NOW }),
    ).toBe('no-cuadra');
  });

  it('rechaza la firma hecha con otro secreto', () => {
    expect(
      verifyStripeSignature({
        body: BODY,
        header: firma(BODY, NOW, 'otro_secreto'),
        secret: SECRET,
        now: NOW,
      }),
    ).toBe('no-cuadra');
  });

  it('caduca pasada la tolerancia, para que una firma capturada no valga mañana', () => {
    const vieja = NOW - TOLERANCE_SECONDS - 1;

    expect(
      verifyStripeSignature({ body: BODY, header: firma(BODY, vieja), secret: SECRET, now: NOW }),
    ).toBe('caducada');
  });

  it('dentro de la tolerancia sigue valiendo', () => {
    const justo = NOW - TOLERANCE_SECONDS;

    expect(
      verifyStripeSignature({ body: BODY, header: firma(BODY, justo), secret: SECRET, now: NOW }),
    ).toBe('ok');
  });

  it('una marca de tiempo en el futuro también caduca', () => {
    const futura = NOW + TOLERANCE_SECONDS + 1;

    expect(
      verifyStripeSignature({ body: BODY, header: firma(BODY, futura), secret: SECRET, now: NOW }),
    ).toBe('caducada');
  });

  it('vale cualquiera de las firmas, que es lo que permite rotar el secreto', () => {
    const buena = createHmac('sha256', SECRET).update(`${NOW}.${BODY}`).digest('hex');
    const header = `t=${NOW},v1=${'0'.repeat(64)},v1=${buena}`;

    expect(verifyStripeSignature({ body: BODY, header, secret: SECRET, now: NOW })).toBe('ok');
  });

  it('sin secreto configurado no se acepta nada', () => {
    // Fallar cerrado: sin secreto, el webhook es un formulario público para
    // darse el plan Pro.
    expect(
      verifyStripeSignature({ body: BODY, header: firma(BODY, NOW), secret: '', now: NOW }),
    ).toBe('sin-firma');
  });

  it('una firma que no es hexadecimal no revienta, se rechaza', () => {
    expect(
      verifyStripeSignature({
        body: BODY,
        header: `t=${NOW},v1=zzzz`,
        secret: SECRET,
        now: NOW,
      }),
    ).toBe('no-cuadra');
  });

  it('una firma de otra longitud se rechaza sin comparar', () => {
    expect(
      verifyStripeSignature({ body: BODY, header: `t=${NOW},v1=aabb`, secret: SECRET, now: NOW }),
    ).toBe('no-cuadra');
  });
});
