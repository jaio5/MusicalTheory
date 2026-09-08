import { describe, expect, it } from 'vitest';

import { FORMAT_CANDIDATES, pickFormat, recordingFilename } from './recording-format';

/**
 * Qué contenedor se le pide al navegador, y cómo se llama el fichero.
 *
 * Es lo único de esta capa que se puede probar sin navegador, y por eso vive
 * aparte del grabador. Lo que defiende es que **no hay un formato que valga en
 * todas partes**: Safari no graba WebM y los demás prefieren Opus, así que se
 * prueba por orden y se acepta que ninguno valga.
 */
describe('elegir formato', () => {
  it('coge el primero que el navegador acepte', () => {
    const elegido = pickFormat((mimeType) => mimeType.includes('mp4'));

    expect(elegido?.extension).toBe('m4a');
  });

  it('prefiere opus cuando se puede: es lo que mejor suena por bit', () => {
    const elegido = pickFormat(() => true);

    expect(elegido?.mimeType).toContain('opus');
  });

  it('devuelve null si no vale ninguno, en vez de fallar al pulsar el boton', () => {
    // Devolver null es una respuesta válida: la interfaz tiene que poder
    // explicar que ese navegador no graba.
    expect(pickFormat(() => false)).toBeNull();
  });

  it('todos los candidatos son de sonido: aqui ya no se graba video', () => {
    for (const candidato of FORMAT_CANDIDATES) {
      expect(candidato.mimeType.startsWith('audio/'), candidato.mimeType).toBe(true);
    }
  });
});

describe('nombre del fichero', () => {
  it('lleva la fecha y la hora, para que dos tomas no se pisen', () => {
    const nombre = recordingFilename(
      { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
      new Date(2026, 8, 8, 19, 5),
    );

    expect(nombre).toBe('caos-ordenado-2026-09-08-1905.webm');
  });

  it('usa la extension del formato que se haya negociado', () => {
    const nombre = recordingFilename(
      { mimeType: 'audio/mp4', extension: 'm4a' },
      new Date(2026, 0, 1, 0, 0),
    );

    expect(nombre.endsWith('.m4a')).toBe(true);
  });
});
