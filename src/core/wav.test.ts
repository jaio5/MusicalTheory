import { describe, expect, it } from 'vitest';

import { leerWav } from './wav';

/** Un bloque RIFF: cuatro letras, el tamaño y el contenido, con relleno si es impar. */
function bloque(id: string, contenido: Uint8Array, declarado = contenido.length): Uint8Array {
  const relleno = contenido.length % 2;
  const salida = new Uint8Array(8 + contenido.length + relleno);
  const vista = new DataView(salida.buffer);
  for (let i = 0; i < 4; i += 1) {
    salida[i] = id.charCodeAt(i);
  }
  vista.setUint32(4, declarado, true);
  salida.set(contenido, 8);
  return salida;
}

function juntar(...partes: Uint8Array[]): Uint8Array {
  const salida = new Uint8Array(partes.reduce((total, p) => total + p.length, 0));
  let en = 0;
  for (const parte of partes) {
    salida.set(parte, en);
    en += parte.length;
  }
  return salida;
}

function fmt(
  codigo: number,
  canales: number,
  bits: number,
  { sampleRate = 48_000, subformato }: { sampleRate?: number; subformato?: number } = {},
): Uint8Array {
  const contenido = new Uint8Array(subformato === undefined ? 16 : 40);
  const vista = new DataView(contenido.buffer);
  vista.setUint16(0, codigo, true);
  vista.setUint16(2, canales, true);
  vista.setUint32(4, sampleRate, true);
  vista.setUint32(8, (sampleRate * canales * bits) / 8, true);
  vista.setUint16(12, (canales * bits) / 8, true);
  vista.setUint16(14, bits, true);
  if (subformato !== undefined) {
    vista.setUint16(16, 22, true);
    vista.setUint16(24, subformato, true);
  }
  return bloque('fmt ', contenido);
}

function riff(...bloques: Uint8Array[]): Uint8Array {
  const cuerpo = juntar(new TextEncoder().encode('WAVE'), ...bloques);
  return bloque('RIFF', cuerpo);
}

function datos(escribir: (vista: DataView) => void, bytes: number, declarado?: number): Uint8Array {
  const contenido = new Uint8Array(bytes);
  escribir(new DataView(contenido.buffer));
  return bloque('data', contenido, declarado);
}

describe('leerWav', () => {
  it('lee PCM de 16 bits en mono, con su frecuencia', () => {
    const wav = riff(
      fmt(1, 1, 16, { sampleRate: 44_100 }),
      datos((v) => {
        v.setInt16(0, 16_384, true);
        v.setInt16(2, -32_768, true);
      }, 4),
    );
    const { sampleRate, samples } = leerWav(wav);
    expect(sampleRate).toBe(44_100);
    expect([...samples]).toEqual([0.5, -1]);
  });

  it('lee 24 bits con su signo, que es lo que graba una interfaz', () => {
    const wav = riff(
      fmt(1, 1, 24),
      datos((v) => {
        // 0x400000 = la mitad; 0xC00000 = menos la mitad.
        v.setUint8(2, 0x40);
        v.setUint8(5, 0xc0);
      }, 6),
    );
    expect([...leerWav(wav).samples]).toEqual([0.5, -0.5]);
  });

  it('lee 8 bits sin signo y 32 enteros', () => {
    const ocho = riff(
      fmt(1, 1, 8),
      datos((v) => {
        v.setUint8(0, 192);
        v.setUint8(1, 128);
      }, 2),
    );
    expect([...leerWav(ocho).samples]).toEqual([0.5, 0]);

    const treintaYDos = riff(
      fmt(1, 1, 32),
      datos((v) => v.setInt32(0, -1_073_741_824, true), 4),
    );
    expect([...leerWav(treintaYDos).samples]).toEqual([-0.5]);
  });

  it('lee coma flotante de 32 y 64 bits, también dentro de un formato extensible', () => {
    const f32 = riff(
      fmt(3, 1, 32),
      datos((v) => v.setFloat32(0, 0.25, true), 4),
    );
    expect([...leerWav(f32).samples]).toEqual([0.25]);

    const f64 = riff(
      fmt(0xfffe, 1, 64, { subformato: 3 }),
      datos((v) => v.setFloat64(0, -0.75, true), 8),
    );
    expect([...leerWav(f64).samples]).toEqual([-0.75]);
  });

  it('mezcla los canales en uno, con su media', () => {
    const wav = riff(
      fmt(1, 2, 16),
      datos((v) => {
        v.setInt16(0, 16_384, true);
        v.setInt16(2, 0, true);
      }, 4),
    );
    expect([...leerWav(wav).samples]).toEqual([0.25]);
  });

  it('se salta los bloques que no son suyos, también los de tamaño impar', () => {
    const wav = riff(
      bloque('LIST', new Uint8Array(3)),
      fmt(1, 1, 16),
      datos((v) => v.setInt16(0, 16_384, true), 2),
    );
    expect([...leerWav(wav).samples]).toEqual([0.5]);
  });

  it('lee hasta donde hay fichero cuando el tamaño declarado miente, como el de ffmpeg por tubería', () => {
    const wav = riff(
      fmt(3, 1, 32),
      datos((v) => v.setFloat32(0, 0.5, true), 4, 0xffffffff),
    );
    expect([...leerWav(wav).samples]).toEqual([0.5]);
  });

  it('dice por qué no puede leerlo', () => {
    expect(() => leerWav(new Uint8Array(4))).toThrow(/No es un WAV/);
    expect(() => leerWav(bloque('RIFX', new TextEncoder().encode('WAVE')))).toThrow(/No es un WAV/);
    expect(() => leerWav(bloque('RIFF', new TextEncoder().encode('AVI ')))).toThrow(/No es un WAV/);
    expect(() =>
      leerWav(
        riff(
          datos(() => {}, 2),
          fmt(1, 1, 16),
        ),
      ),
    ).toThrow(/antes que el formato/);
    expect(() => leerWav(riff(fmt(1, 1, 16)))).toThrow(/no trae bloque de datos/);
  });

  it('rechaza los formatos que no entiende en vez de leer ruido', () => {
    const con = (formato: Uint8Array) =>
      riff(
        formato,
        datos(() => {}, 4),
      );
    expect(() => leerWav(con(fmt(2, 1, 16)))).toThrow(/código 2/);
    expect(() => leerWav(con(fmt(1, 1, 12)))).toThrow(/12 bits/);
    expect(() => leerWav(con(fmt(3, 1, 16)))).toThrow(/no soportado/);
    expect(() => leerWav(con(fmt(1, 0, 16)))).toThrow(/0 canales/);
    // Un extensible sin sitio para el subformato se queda con su código, que no se entiende.
    expect(() => leerWav(con(fmt(0xfffe, 1, 16)))).toThrow(/código 65534/);
  });
});
