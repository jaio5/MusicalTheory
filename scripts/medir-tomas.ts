/**
 * Medir el motor de acordes con guitarras de verdad: **una carpeta de grabaciones,
 * lo que se tocó en cada una y lo que escribió el motor**, en una tabla por acorde,
 * por guitarra y por micro. El protocolo de grabación y el umbral que decide están
 * en `docs/MEDIR.md`.
 *
 *     pnpm medir:tomas <carpeta> [--etiquetas <csv>] [--detalle]
 *
 * Lo tocado sale del nombre del fichero —`guitarra1_portatil_Am.wav`,
 * `guitarra2_movil_C-G-Am-F_rasgueo.m4a`— o de un `etiquetas.csv` en la carpeta,
 * que manda sobre el nombre. Las cuentas son de `core/music/medir-tomas.ts`.
 *
 * **Pasa por el mismo motor que la aplicación**, `chordsOfRecording`, con sus
 * valores de serie: lo que se mide es lo que escribe el análisis de una grabación
 * entera, antes de repartirlo en pulsos (`captureProgression`). Lo que no pasa es
 * el motor en vivo, que decide con ventanas cortas y mirando solo hacia atrás.
 *
 * Lee WAV directamente. Lo que graba un móvil —m4a, webm, ogg, mp3…— lo convierte
 * `ffmpeg` si está instalado; si no, se dice qué ficheros se han quedado fuera.
 *
 * **El audio no sale del equipo**: esto lee del disco y escribe en la terminal.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { chordsOfRecording } from '@audio/offline-chords';
import {
  etiquetaDelNombre,
  leerEtiquetas,
  medirToma,
  nombreSinExtension,
  recuentoPor,
  recuentoPorAcorde,
  tablaDeRecuentos,
  UMBRAL_DE_ACIERTO,
  UMBRAL_DE_FALLOS_MARCADOS,
  veredicto,
  type TomaEtiquetada,
  type TomaMedida,
} from '@core/music/medir-tomas';
import { leerWav, type SenalLeida } from '@core/wav';

const argumentos = process.argv.slice(2);
const detalle = argumentos.includes('--detalle');
/** El valor que va detrás de una opción, si la opción está. */
function opcion(nombre: string): string | undefined {
  const donde = argumentos.indexOf(nombre);
  return donde === -1 ? undefined : argumentos[donde + 1];
}
const carpeta = argumentos.find(
  (a, i) => !a.startsWith('--') && argumentos[i - 1] !== '--etiquetas',
);

if (carpeta === undefined || !existsSync(carpeta) || !statSync(carpeta).isDirectory()) {
  console.error('Uso: pnpm medir:tomas <carpeta> [--etiquetas <csv>] [--detalle]');
  console.error('El protocolo, en docs/MEDIR.md.');
  process.exit(1);
}

const WAV = new Set(['.wav', '.wave']);
/** Lo que graba un móvil o un navegador, y que solo se puede leer con ffmpeg. */
const COMPRIMIDO = new Set([
  '.m4a',
  '.mp4',
  '.aac',
  '.webm',
  '.ogg',
  '.opus',
  '.mp3',
  '.flac',
  '.3gp',
  '.caf',
  '.amr',
]);

function extension(fichero: string): string {
  const punto = fichero.lastIndexOf('.');
  return punto === -1 ? '' : fichero.slice(punto).toLowerCase();
}

/** Todas las grabaciones de la carpeta, también en subcarpetas: una por guitarra, si se quiere. */
function grabaciones(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entrada) => {
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        return grabaciones(ruta);
      }
      const ext = extension(entrada.name);
      return WAV.has(ext) || COMPRIMIDO.has(ext) ? [ruta] : [];
    })
    .sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Si hay un `ffmpeg` que se pueda ejecutar.
 *
 * En WSL puede aparecer el de Windows por el `PATH`; si arranca, convierte igual.
 */
function hayFfmpeg(): boolean {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Una grabación comprimida, convertida a WAV mono en coma flotante por una tubería.
 *
 * Lo que `ffmpeg` dice por su salida de errores se recoge y no se pinta: con un
 * webm de navegador avisa de cabeceras de Opus que luego decodifica bien, y ese
 * ruido tapaba la tabla. Si falla de verdad, el mensaje viaja en la excepción.
 */
function convertir(ruta: string): SenalLeida {
  let wav: Buffer;
  try {
    wav = execFileSync(
      'ffmpeg',
      [
        '-v',
        'error',
        '-i',
        ruta,
        '-ac',
        '1',
        '-ar',
        '48000',
        '-c:a',
        'pcm_f32le',
        '-f',
        'wav',
        'pipe:1',
      ],
      { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (fallo) {
    const dijo = String((fallo as { stderr?: unknown }).stderr ?? '')
      .trim()
      .split('\n')
      .at(-1);
    throw new Error(`ffmpeg no ha podido leerlo (${dijo})`);
  }
  return leerWav(new Uint8Array(wav.buffer, wav.byteOffset, wav.byteLength));
}

// --- Las etiquetas ------------------------------------------------------------------

const rutaDeEtiquetas = opcion('--etiquetas') ?? join(carpeta, 'etiquetas.csv');
let etiquetas = new Map<string, TomaEtiquetada>();
if (existsSync(rutaDeEtiquetas)) {
  try {
    etiquetas = leerEtiquetas(readFileSync(rutaDeEtiquetas, 'utf8'));
  } catch (fallo) {
    console.error((fallo as Error).message);
    process.exit(1);
  }
}

// --- Cada toma ---------------------------------------------------------------------

const ficheros = grabaciones(carpeta);
if (ficheros.length === 0) {
  console.error(`No hay grabaciones en ${carpeta} (WAV, o m4a/webm/ogg/mp3 con ffmpeg).`);
  process.exit(1);
}

const conFfmpeg = ficheros.some((f) => COMPRIMIDO.has(extension(f))) && hayFfmpeg();
const medidas: TomaMedida[] = [];
const sinMedir: string[] = [];

for (const ruta of ficheros) {
  let toma: TomaEtiquetada;
  try {
    const etiqueta = etiquetas.get(nombreSinExtension(ruta));
    toma = etiqueta === undefined ? etiquetaDelNombre(ruta) : { ...etiqueta, fichero: ruta };
  } catch (fallo) {
    sinMedir.push(`${ruta}: ${(fallo as Error).message}`);
    continue;
  }

  let senal: SenalLeida;
  try {
    if (COMPRIMIDO.has(extension(ruta))) {
      if (!conFfmpeg) {
        sinMedir.push(`${ruta}: hace falta ffmpeg para leerlo (sudo apt install ffmpeg)`);
        continue;
      }
      senal = convertir(ruta);
    } else {
      senal = leerWav(new Uint8Array(readFileSync(ruta)));
    }
  } catch (fallo) {
    sinMedir.push(`${ruta}: ${(fallo as Error).message}`);
    continue;
  }

  // Con bemoles si lo tocado se escribió con bemoles: es solo cómo se pinta.
  const accidental = toma.acordes.some((a) => /^[A-G]b/.test(a.symbol)) ? 'flat' : 'sharp';
  const oidos = chordsOfRecording(senal.samples, {
    sampleRate: senal.sampleRate,
    accidental,
    ...(toma.tonalidad === undefined ? {} : { key: toma.tonalidad }),
  });
  const medida = medirToma(toma.acordes, oidos, accidental);
  medidas.push({ toma, medida });

  if (detalle) {
    const tocado = toma.acordes.map((a) => a.symbol).join(' ');
    const escrito =
      oidos.length === 0
        ? '(nada)'
        : medida.parejas
            .filter((p) => p.escrito !== null)
            .map((p) => `${p.escrito}${p.dudoso ? '?' : ''}${p.bien ? '' : '✗'}`)
            .join(' ');
    console.log(`${nombreSinExtension(ruta)}\n  tocado:  ${tocado}\n  escrito: ${escrito}`);
  }
}

// --- El informe --------------------------------------------------------------------

if (detalle && medidas.length > 0) {
  console.log('');
}
console.log(
  `${medidas.length} tomas medidas de ${ficheros.length}. «?» es lo que la aplicación marcaría como dudoso; ✗, lo escrito mal.\n`,
);

if (medidas.length > 0) {
  const porAcorde = recuentoPorAcorde(medidas);
  console.log(tablaDeRecuentos('acorde', porAcorde));
  console.log('');
  console.log(
    tablaDeRecuentos(
      'guitarra',
      recuentoPor(medidas, (t) => t.guitarra),
    ),
  );
  console.log('');
  console.log(
    tablaDeRecuentos(
      'micro',
      recuentoPor(medidas, (t) => t.micro),
    ),
  );
  if (medidas.some((m) => m.toma.forma !== null)) {
    console.log('');
    console.log(
      tablaDeRecuentos(
        'forma',
        recuentoPor(medidas, (t) => t.forma ?? 'sin decir'),
      ),
    );
  }
  console.log('');
  console.log(
    tablaDeRecuentos(
      'todo',
      recuentoPor(medidas, () => 'todas'),
    ),
  );

  console.log(
    `\nEl umbral: cada acorde abierto con acierto ≥ ${Math.round(UMBRAL_DE_ACIERTO * 100)} % y, de lo que falla, ≥ ${Math.round(UMBRAL_DE_FALLOS_MARCADOS * 100)} % con «?».`,
  );
  for (const v of veredicto(porAcorde)) {
    console.log(`  ${v.acorde.padEnd(3)} ${v.estado.padEnd(9)} ${v.porque}`);
  }
}

if (sinMedir.length > 0) {
  console.log(`\nSin medir (${sinMedir.length}):`);
  for (const linea of sinMedir) {
    console.log(`  ${linea}`);
  }
}
