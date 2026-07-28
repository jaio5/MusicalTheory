// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { CameraInput, CameraState } from '@media/camera-input';
import type {
  Recording,
  RecorderState,
  RecordingOptions,
  SessionRecorder,
} from '@media/session-recorder';

import { RecordStage } from './RecordStage';

class FakeCamera implements CameraInput {
  state: CameraState = 'idle';
  stream: MediaStream | null = null;
  errorMessage: string | null = null;
  stopped = false;

  constructor(private readonly outcome: CameraState = 'running') {}

  async start(): Promise<void> {
    if (this.outcome === 'running') {
      this.state = 'running';
      this.stream = {
        getVideoTracks: () => [],
        getAudioTracks: () => [],
      } as unknown as MediaStream;
    } else {
      this.state = this.outcome;
      this.errorMessage = 'Has denegado el acceso a la cámara.';
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.state = 'idle';
    this.stream = null;
  }

  async listDevices(): Promise<MediaDeviceInfo[]> {
    return [];
  }

  subscribe(): () => void {
    return () => {};
  }
}

class FakeRecorder implements SessionRecorder {
  state: RecorderState = 'idle';
  errorMessage: string | null = null;
  options: RecordingOptions | null = null;

  constructor(private readonly supported = true) {}

  async start(options: RecordingOptions): Promise<void> {
    this.options = options;
    if (!this.supported) {
      this.state = 'unsupported';
      this.errorMessage = 'Este navegador no puede grabar vídeo.';
      return;
    }
    this.state = 'recording';
  }

  pause(): void {}
  resume(): void {}

  async stop(): Promise<Recording> {
    this.state = 'idle';
    return {
      blob: new Blob(['x'], { type: 'video/webm' }),
      mimeType: 'video/webm',
      durationMs: 12_000,
      filename: 'caos-ordenado-2026-07-28-1905.webm',
    };
  }

  subscribe(): () => void {
    return () => {};
  }
}

describe('Grabarte tocando', () => {
  it('dice para qué es antes de pedir la cámara', () => {
    render(
      <RecordStage createCamera={() => new FakeCamera()} createRecorder={() => new FakeRecorder()}>
        <p>La pantalla de componer</p>
      </RecordStage>,
    );

    expect(screen.getByRole('button', { name: /grabarte tocando/i })).toBeInTheDocument();
    expect(screen.getByText('La pantalla de componer')).toBeInTheDocument();
  });

  it('graba al pulsar y lo dice', async () => {
    const recorder = new FakeRecorder();
    render(
      <RecordStage createCamera={() => new FakeCamera()} createRecorder={() => recorder}>
        <p>contenido</p>
      </RecordStage>,
    );

    await userEvent.click(screen.getByRole('button', { name: /grabarte tocando/i }));

    expect(await screen.findByText(/grabando/i)).toBeInTheDocument();
    expect(recorder.state).toBe('recording');
  });

  it('deja la interfaz en contorno y letra mientras graba', async () => {
    const { container } = render(
      <RecordStage createCamera={() => new FakeCamera()} createRecorder={() => new FakeRecorder()}>
        <p>contenido</p>
      </RecordStage>,
    );

    expect(container.querySelector('.grabando')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /grabarte tocando/i }));

    expect(await screen.findByRole('button', { name: /parar la grabación/i })).toBeInTheDocument();
    expect(container.querySelector('.grabando')).not.toBeNull();
  });

  it('le pasa al grabador una función de overlay, no el store', async () => {
    const recorder = new FakeRecorder();
    render(
      <RecordStage createCamera={() => new FakeCamera()} createRecorder={() => recorder}>
        <p>contenido</p>
      </RecordStage>,
    );

    await userEvent.click(screen.getByRole('button', { name: /grabarte tocando/i }));

    expect(typeof recorder.options?.overlay).toBe('function');
    const frame = recorder.options!.overlay();
    expect(frame).toHaveProperty('elapsedMs');
    expect(frame).toHaveProperty('noteName');
  });

  it('explica qué hacer si se deniega la cámara', async () => {
    render(
      <RecordStage
        createCamera={() => new FakeCamera('denied')}
        createRecorder={() => new FakeRecorder()}
      >
        <p>contenido</p>
      </RecordStage>,
    );

    await userEvent.click(screen.getByRole('button', { name: /grabarte tocando/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/has denegado el acceso/i);
  });

  it('suelta la cámara si el navegador no sabe grabar', async () => {
    const camera = new FakeCamera();
    render(
      <RecordStage createCamera={() => camera} createRecorder={() => new FakeRecorder(false)}>
        <p>contenido</p>
      </RecordStage>,
    );

    await userEvent.click(screen.getByRole('button', { name: /grabarte tocando/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no puede grabar vídeo/i);
    expect(camera.stopped).toBe(true);
  });

  it('al parar ofrece la descarga y suelta la cámara', async () => {
    const camera = new FakeCamera();
    render(
      <RecordStage createCamera={() => camera} createRecorder={() => new FakeRecorder()}>
        <p>contenido</p>
      </RecordStage>,
    );

    await userEvent.click(screen.getByRole('button', { name: /grabarte tocando/i }));
    await userEvent.click(await screen.findByRole('button', { name: /parar la grabación/i }));

    expect(await screen.findByRole('button', { name: /descargar el vídeo/i })).toBeInTheDocument();
    expect(camera.stopped).toBe(true);
  });
});
