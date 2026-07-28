// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import type { CameraInput, CameraState } from '@media/camera-input';
import type {
  Recording,
  RecorderState,
  RecordingOptions,
  SessionRecorder,
} from '@media/session-recorder';

import { RecorderPanel } from './RecorderPanel';

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

describe('Panel de grabación', () => {
  afterEach(cleanup);

  it('explica para qué quiere la cámara y que no sube nada', () => {
    render(
      <RecorderPanel
        createCamera={() => new FakeCamera()}
        createRecorder={() => new FakeRecorder()}
      />,
    );

    expect(screen.getByText(/necesitamos la cámara para grabarte/i)).toBeInTheDocument();
    expect(screen.getByText(/no se sube a ningún servidor/i)).toBeInTheDocument();
  });

  it('graba al pulsar y avisa de que está grabando', async () => {
    const recorder = new FakeRecorder();
    render(<RecorderPanel createCamera={() => new FakeCamera()} createRecorder={() => recorder} />);

    await userEvent.click(screen.getByRole('button', { name: /grabarme tocando/i }));

    expect(await screen.findByText(/grabando/i)).toBeInTheDocument();
    expect(recorder.state).toBe('recording');
  });

  it('le pasa al grabador una función de overlay, no el store', async () => {
    const recorder = new FakeRecorder();
    render(<RecorderPanel createCamera={() => new FakeCamera()} createRecorder={() => recorder} />);

    await userEvent.click(screen.getByRole('button', { name: /grabarme tocando/i }));

    expect(typeof recorder.options?.overlay).toBe('function');
    const frame = recorder.options!.overlay();
    expect(frame).toHaveProperty('elapsedMs');
    expect(frame).toHaveProperty('noteName');
  });

  it('explica qué hacer si se deniega la cámara', async () => {
    render(
      <RecorderPanel
        createCamera={() => new FakeCamera('denied')}
        createRecorder={() => new FakeRecorder()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /grabarme tocando/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/has denegado el acceso/i);
  });

  it('suelta la cámara si el navegador no sabe grabar', async () => {
    const camera = new FakeCamera();
    render(
      <RecorderPanel createCamera={() => camera} createRecorder={() => new FakeRecorder(false)} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /grabarme tocando/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no puede grabar vídeo/i);
    expect(camera.stopped).toBe(true);
  });

  it('al parar ofrece la descarga con su nombre', async () => {
    const camera = new FakeCamera();
    render(<RecorderPanel createCamera={() => camera} createRecorder={() => new FakeRecorder()} />);

    await userEvent.click(screen.getByRole('button', { name: /grabarme tocando/i }));
    await userEvent.click(await screen.findByRole('button', { name: /parar y guardar/i }));

    expect(await screen.findByRole('button', { name: /descargar el vídeo/i })).toBeInTheDocument();
    expect(screen.getByText(/caos-ordenado-2026-07-28-1905\.webm/)).toBeInTheDocument();
    expect(camera.stopped).toBe(true);
  });
});
