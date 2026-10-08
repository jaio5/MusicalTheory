/**
 * Medir el motor de acordes con grabaciones de verdad: **lo tocado contra lo
 * escrito**, toma a toma, y el recuento por acorde, por guitarra y por micro.
 *
 * Lo usa `scripts/medir-tomas.ts`, que lee la carpeta, pasa cada grabación por el
 * motor en diferido (`audio/offline-chords.ts`) y pinta lo que sale de aquí. La
 * cuenta vive en `core/` y no en el script porque es donde se puede equivocar sin
 * que se note: **una medida mal contada no da error, da una cifra**, y con esa
 * cifra se decide si el motor sirve (`docs/MEDIR.md`).
 *
 * Se cuentan cuatro cosas, porque fallar no es lo mismo que mentir:
 *
 * - **acierto**: de lo que se tocó, cuánto se escribió tal cual —misma fundamental
 *   y mismas notas—;
 * - **dudas**: lo escrito con «?», que es lo que la aplicación ofrece corregir;
 * - **dudas bien puestas**: las que caen sobre algo que de verdad estaba mal, y
 *   **dudas de más** las que caen sobre algo bien;
 * - **seguro y falso**: lo escrito sin «?» que no se tocó. Es el fallo caro
 *   ([adr/0043](../../../docs/adr/0043-dos-maneras-de-equivocarse.md)): quien
 *   compone no tiene por qué ir a mirarlo.
 *
 * La duda es la de la aplicación —`confianzaDe` por debajo de `DUDOSO`—, no una
 * propia: medir con otra regla sería medir otro programa.
 */

import { DUDOSO } from './arrangement';
import { confianzaDe, type CapturedChord } from './capture';
import { CHORD_SHAPES, parseChordSymbol, type ParsedChord } from './chord-symbols';
import type { KeyMode } from './keys';
import { noteName, normalizePitchClass, type Accidental, type PitchClass } from './notes';

/** Lo que decide el estudio: cada acorde abierto, al 85 % o más. */
export const UMBRAL_DE_ACIERTO = 0.85;

/**
 * Y de lo que se escribe mal, cuánto tiene que salir con «?».
 *
 * El mismo número a propósito, para que se diga en una frase: **acierta el 85 %, y
 * del resto avisa el 85 %**. Lo que queda —un fallo de cada cuarenta, más o menos—
 * es lo que se escribe mal sin avisar.
 */
export const UMBRAL_DE_FALLOS_MARCADOS = 0.85;

/** Los seis acordes abiertos del estudio, en el orden en que se enseñan. */
export const ACORDES_DEL_ESTUDIO: readonly string[] = ['C', 'G', 'D', 'Am', 'Em', 'F'];

/**
 * Por debajo de esto, la cifra de un acorde se da pero no decide.
 *
 * Cinco guitarras por tres micros: una toma de cada, que es lo mínimo que pide el
 * protocolo. Con menos, un acorde al 100 % puede ser dos tomas con suerte.
 */
export const TOMAS_MINIMAS = 15;

/** Cómo se tocó: todas a la vez o cuerda a cuerda. */
type Forma = 'rasgueo' | 'arpegio';

export interface TomaEtiquetada {
  readonly fichero: string;
  readonly guitarra: string;
  readonly micro: string;
  readonly forma: Forma | null;
  /** Lo tocado, en orden. Un acorde suelto es una lista de uno. */
  readonly acordes: readonly ParsedChord[];
  readonly tonalidad?: { readonly tonic: PitchClass; readonly mode: KeyMode };
}

const FORMAS: readonly Forma[] = ['rasgueo', 'arpegio'];

function esForma(valor: string): valor is Forma {
  return (FORMAS as readonly string[]).includes(valor);
}

function acordesDe(texto: string, separador: RegExp, donde: string): ParsedChord[] {
  const trozos = texto.split(separador).filter((trozo) => trozo !== '');
  if (trozos.length === 0) {
    throw new SyntaxError(`${donde}: no dice qué se tocó.`);
  }
  return trozos.map((trozo) => {
    const acorde = parseChordSymbol(trozo);
    if (acorde === null) {
      throw new SyntaxError(`${donde}: «${trozo}» no es un acorde que se conozca.`);
    }
    return acorde;
  });
}

/** «C» es Do mayor y «Am» La menor; lo demás no es una tonalidad. */
function tonalidadDe(texto: string, donde: string): TomaEtiquetada['tonalidad'] {
  const acorde = parseChordSymbol(texto);
  if (acorde === null || (acorde.shape.suffix !== '' && acorde.shape.suffix !== 'm')) {
    throw new SyntaxError(`${donde}: «${texto}» no es una tonalidad (vale «C» o «Am»).`);
  }
  return { tonic: acorde.root, mode: acorde.shape.suffix === 'm' ? 'minor' : 'major' };
}

/** El nombre del fichero sin carpeta ni extensión. */
export function nombreSinExtension(ruta: string): string {
  const base = ruta.split(/[\\/]/).at(-1)!;
  const punto = base.lastIndexOf('.');
  return punto <= 0 ? base : base.slice(0, punto);
}

/**
 * Lo tocado, sacado del nombre: `guitarra_micro_acordes[_forma][_lo-que-sea]`.
 *
 * `guitarra1_portatil_Am.wav`, `prestada-ana_movil_C-G-Am-F_rasgueo_2.m4a`. Los
 * acordes de una progresión van con guiones; detrás puede ir la forma y cualquier
 * cosa más —un número de toma—, que no se mira. Lo que no cabe en un nombre de
 * fichero —una barra, una tonalidad— va en `etiquetas.csv`.
 */
export function etiquetaDelNombre(ruta: string): TomaEtiquetada {
  const nombre = nombreSinExtension(ruta);
  const [guitarra, micro, acordes, ...resto] = nombre.split('_');
  if (acordes === undefined || guitarra === '' || micro === '') {
    throw new SyntaxError(
      `${nombre}: el nombre tiene que ser guitarra_micro_acordes, como «guitarra1_portatil_Am».`,
    );
  }
  const forma = resto.find(esForma) ?? null;
  return {
    fichero: ruta,
    guitarra: guitarra!,
    micro: micro!,
    forma,
    acordes: acordesDe(acordes, /-/, nombre),
  };
}

/**
 * Las etiquetas de `etiquetas.csv`, por nombre de fichero.
 *
 * Cabecera obligatoria con `fichero`, `guitarra`, `micro` y `acordes`; `forma` y
 * `tonalidad` si se quieren. Los acordes, separados por espacios. **Admite `;` como
 * separador** porque es lo que guarda una hoja de cálculo en español, y las líneas
 * que empiezan por `#` son comentarios.
 */
export function leerEtiquetas(csv: string): Map<string, TomaEtiquetada> {
  const lineas = csv
    .split(/\r?\n/)
    .map((linea, i) => ({ linea: linea.trim(), numero: i + 1 }))
    .filter(({ linea }) => linea !== '' && !linea.startsWith('#'));
  const [cabecera, ...filas] = lineas;
  if (cabecera === undefined) {
    return new Map();
  }
  const separador = cabecera.linea.includes(';') ? ';' : ',';
  const columnas = cabecera.linea.split(separador).map((c) => c.trim().toLowerCase());
  const columna = (nombre: string) => columnas.indexOf(nombre);
  for (const obligatoria of ['fichero', 'guitarra', 'micro', 'acordes']) {
    if (columna(obligatoria) === -1) {
      throw new SyntaxError(`etiquetas.csv: falta la columna «${obligatoria}» en la cabecera.`);
    }
  }

  const etiquetas = new Map<string, TomaEtiquetada>();
  for (const { linea, numero } of filas) {
    const celdas = linea.split(separador).map((c) => c.trim());
    const celda = (nombre: string) => celdas[columna(nombre)] ?? '';
    const donde = `etiquetas.csv, línea ${numero}`;
    const fichero = celda('fichero');
    const forma = celda('forma');
    if (forma !== '' && !esForma(forma)) {
      throw new SyntaxError(`${donde}: la forma es «rasgueo» o «arpegio», no «${forma}».`);
    }
    const tonalidad = celda('tonalidad');
    etiquetas.set(nombreSinExtension(fichero), {
      fichero,
      guitarra: celda('guitarra'),
      micro: celda('micro'),
      forma: forma === '' ? null : forma,
      acordes: acordesDe(celda('acordes'), /\s+/, donde),
      ...(tonalidad === '' ? {} : { tonalidad: tonalidadDe(tonalidad, donde) }),
    });
  }
  return etiquetas;
}

// --- Comparar una toma -------------------------------------------------------------

/** Un acorde tal y como sale del motor o como se escribió: fundamental y notas. */
interface Acorde {
  readonly root: PitchClass;
  readonly notes: readonly PitchClass[];
}

function mismoAcorde(a: Acorde, b: Acorde): boolean {
  return (
    a.root === b.root &&
    a.notes.length === b.notes.length &&
    a.notes.every((nota) => b.notes.includes(nota))
  );
}

/**
 * El cifrado de lo oído, con las especies que conoce la aplicación.
 *
 * Lo que no casa con ninguna sale como la fundamental y sus intervalos entre
 * paréntesis: no debería pasar —el motor solo propone especies de la tabla—, pero
 * si pasa, mejor verlo raro que verlo con un nombre inventado.
 */
export function cifradoDe(acorde: Acorde, accidental: Accidental = 'sharp'): string {
  const intervalos = [...new Set(acorde.notes.map((n) => normalizePitchClass(n - acorde.root)))];
  intervalos.sort((a, b) => a - b);
  const forma = Object.values(CHORD_SHAPES).find(
    (shape) =>
      shape.intervals.length === intervalos.length &&
      shape.intervals.every((intervalo, i) => intervalo === intervalos[i]),
  );
  const fundamental = noteName(acorde.root, accidental);
  return forma === undefined
    ? `${fundamental}(${intervalos.join(',')})`
    : `${fundamental}${forma.suffix}`;
}

/** Una línea del cotejo: lo tocado frente a lo escrito, en el sitio en que se emparejan. */
interface Pareja {
  /** Lo tocado, o nulo si el motor escribió algo que no se tocó. */
  readonly tocado: string | null;
  /** Lo escrito, o nulo si lo tocado no llegó a escribirse. */
  readonly escrito: string | null;
  readonly dudoso: boolean;
  readonly bien: boolean;
}

export interface MedidaDeUnaToma {
  readonly tocados: number;
  readonly acertados: number;
  readonly escritos: number;
  readonly dudas: number;
  /** Con «?» y mal escritos: la duda sirvió. */
  readonly dudasBienPuestas: number;
  /** Con «?» y bien escritos: la duda sobraba. */
  readonly dudasDeMas: number;
  /** Sin «?» y mal escritos. */
  readonly seguroYFalso: number;
  readonly parejas: readonly Pareja[];
}

/**
 * Coteja lo tocado con lo que escribió el motor.
 *
 * **Se emparejan por orden, con la distancia de edición**, y no por tiempo: las
 * tomas no traen cuándo cae cada acorde, y pedírselo a quien graba convertiría
 * diez minutos de guitarra en una tarde de etiquetar. A cambio, lo que se puede
 * contar es exactamente lo que importa: qué se escribió bien, qué se escribió en
 * lugar de otro, qué se coló sin tocarse y qué se perdió.
 *
 * Lo tocado se compacta antes —dos C seguidos son un C—, porque el motor junta
 * igual lo que suena seguido y si no cada repetición contaría como perdida.
 */
export function medirToma(
  tocados: readonly ParsedChord[],
  oidos: readonly CapturedChord[],
  accidental: Accidental = 'sharp',
): MedidaDeUnaToma {
  const esperado = tocados.filter((acorde, i) => i === 0 || !mismoAcorde(acorde, tocados[i - 1]!));
  const n = esperado.length;
  const m = oidos.length;

  // Distancia de edición: coste[i][j] es lo que cuesta casar los i primeros
  // tocados con los j primeros escritos. Sobrar y faltar cuestan uno, y cambiar
  // también, **salvo si se queda la fundamental**: un Cmaj7 donde iba un C es ese C
  // mal leído, no un C perdido y un Cmaj7 colado. Sin esa décima de rebaja, en un
  // empate se emparejaba con el vecino y la confusión se apuntaba al acorde que no era.
  const cambio = (tocado: Acorde, escrito: Acorde) =>
    mismoAcorde(tocado, escrito) ? 0 : tocado.root === escrito.root ? 0.9 : 1;
  const coste: number[][] = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      coste[i]![j] = Math.min(
        coste[i - 1]![j - 1]! + cambio(esperado[i - 1]!, oidos[j - 1]!),
        coste[i - 1]![j]! + 1,
        coste[i]![j - 1]! + 1,
      );
    }
  }

  // Deshacer el camino desde el final, mirando primero la diagonal: cuando dos
  // caminos cuestan lo mismo, «se escribió Esus4 donde iba Am» dice más que «sobró
  // un Esus4 y faltó un Am».
  const parejas: Pareja[] = [];
  const dudoso = (oido: CapturedChord) => confianzaDe(oido) < DUDOSO;
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const tocado = esperado[i - 1];
    const oido = oidos[j - 1];
    if (tocado !== undefined && oido !== undefined) {
      if (coste[i]![j] === coste[i - 1]![j - 1]! + cambio(tocado, oido)) {
        parejas.push({
          tocado: tocado.symbol,
          escrito: cifradoDe(oido, accidental),
          dudoso: dudoso(oido),
          bien: mismoAcorde(tocado, oido),
        });
        i -= 1;
        j -= 1;
        continue;
      }
    }
    if (oido !== undefined && (tocado === undefined || coste[i]![j] === coste[i]![j - 1]! + 1)) {
      parejas.push({
        tocado: null,
        escrito: cifradoDe(oido, accidental),
        dudoso: dudoso(oido),
        bien: false,
      });
      j -= 1;
    } else {
      parejas.push({ tocado: tocado!.symbol, escrito: null, dudoso: false, bien: false });
      i -= 1;
    }
  }
  parejas.reverse();

  const escritas = parejas.filter((p) => p.escrito !== null);
  return {
    tocados: n,
    acertados: parejas.filter((p) => p.bien).length,
    escritos: m,
    dudas: escritas.filter((p) => p.dudoso).length,
    dudasBienPuestas: escritas.filter((p) => p.dudoso && !p.bien).length,
    dudasDeMas: escritas.filter((p) => p.dudoso && p.bien).length,
    seguroYFalso: escritas.filter((p) => !p.dudoso && !p.bien).length,
    parejas,
  };
}

// --- El recuento -------------------------------------------------------------------

export interface Recuento {
  readonly grupo: string;
  readonly tomas: number;
  readonly tocados: number;
  readonly acertados: number;
  readonly escritos: number;
  readonly dudas: number;
  readonly dudasBienPuestas: number;
  readonly dudasDeMas: number;
  readonly seguroYFalso: number;
  /** Por qué se cambió lo tocado, de más a menos veces: «Esus4 ×3». */
  readonly confusiones: readonly string[];
}

export interface TomaMedida {
  readonly toma: TomaEtiquetada;
  readonly medida: MedidaDeUnaToma;
}

/**
 * Suma las tomas por lo que diga `grupo`: la guitarra, el micro, la forma.
 *
 * Una toma cuenta entera en su grupo. Por acorde no sirve así, porque una
 * progresión tiene cuatro: para eso está `recuentoPorAcorde`.
 */
export function recuentoPor(
  medidas: readonly TomaMedida[],
  grupo: (toma: TomaEtiquetada) => string,
): Recuento[] {
  const grupos = new Map<string, TomaMedida[]>();
  for (const medida of medidas) {
    const clave = grupo(medida.toma);
    grupos.set(clave, [...(grupos.get(clave) ?? []), medida]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([clave, delGrupo]) =>
      sumar(
        clave,
        delGrupo.length,
        delGrupo.map((m) => m.medida.parejas),
      ),
    );
}

/**
 * Por acorde tocado: cada pareja cuenta en el acorde que se tocó.
 *
 * Lo que se coló sin tocarse no es de ningún acorde y aquí no aparece; sí en los
 * otros recuentos, que suman por toma.
 */
export function recuentoPorAcorde(medidas: readonly TomaMedida[]): Recuento[] {
  const porAcorde = new Map<string, { tomas: Set<string>; parejas: Pareja[] }>();
  for (const { toma, medida } of medidas) {
    for (const pareja of medida.parejas) {
      if (pareja.tocado === null) {
        continue;
      }
      const grupo = porAcorde.get(pareja.tocado) ?? { tomas: new Set<string>(), parejas: [] };
      grupo.tomas.add(toma.fichero);
      grupo.parejas.push(pareja);
      porAcorde.set(pareja.tocado, grupo);
    }
  }
  const orden = (acorde: string) => {
    const i = ACORDES_DEL_ESTUDIO.indexOf(acorde);
    return i === -1 ? ACORDES_DEL_ESTUDIO.length : i;
  };
  return [...porAcorde.entries()]
    .sort(([a], [b]) => orden(a) - orden(b) || a.localeCompare(b, 'es'))
    .map(([acorde, { tomas, parejas }]) => sumar(acorde, tomas.size, [parejas]));
}

function sumar(grupo: string, tomas: number, listas: readonly (readonly Pareja[])[]): Recuento {
  const parejas = listas.flat();
  const escritas = parejas.filter((p) => p.escrito !== null);
  const confusiones = new Map<string, number>();
  for (const p of parejas) {
    if (p.tocado !== null && !p.bien) {
      const como = p.escrito ?? 'nada';
      confusiones.set(como, (confusiones.get(como) ?? 0) + 1);
    }
  }
  return {
    grupo,
    tomas,
    tocados: parejas.filter((p) => p.tocado !== null).length,
    acertados: parejas.filter((p) => p.bien).length,
    escritos: escritas.length,
    dudas: escritas.filter((p) => p.dudoso).length,
    dudasBienPuestas: escritas.filter((p) => p.dudoso && !p.bien).length,
    dudasDeMas: escritas.filter((p) => p.dudoso && p.bien).length,
    seguroYFalso: escritas.filter((p) => !p.dudoso && !p.bien).length,
    confusiones: [...confusiones.entries()]
      .sort(([a, x], [b, y]) => y - x || a.localeCompare(b, 'es'))
      .map(([como, veces]) => `${como} ×${veces}`),
  };
}

/** Una proporción como se lee aquí: «85 %», o una raya si no hay de qué. */
export function porcentaje(parte: number, total: number): string {
  return total === 0 ? '—' : `${Math.round((parte / total) * 100)} %`;
}

/**
 * Los recuentos como tabla de texto, con las columnas alineadas.
 *
 * «Fallos con ?» es la columna que decide la segunda mitad del umbral: de lo que se
 * escribió mal, cuánto llevaba la duda puesta.
 */
export function tablaDeRecuentos(titulo: string, recuentos: readonly Recuento[]): string {
  const cabecera = [
    titulo,
    'tomas',
    'acierto',
    'escritos',
    'con ?',
    '? bien puesta',
    '? de más',
    'seguro y falso',
    'fallos con ?',
    'se leyó como',
  ];
  const filas = recuentos.map((r) => {
    const fallos = r.dudasBienPuestas + r.seguroYFalso;
    return [
      r.grupo,
      String(r.tomas),
      `${r.acertados}/${r.tocados} (${porcentaje(r.acertados, r.tocados)})`,
      String(r.escritos),
      String(r.dudas),
      String(r.dudasBienPuestas),
      String(r.dudasDeMas),
      String(r.seguroYFalso),
      porcentaje(r.dudasBienPuestas, fallos),
      r.confusiones.slice(0, 3).join(', '),
    ];
  });
  const anchos = cabecera.map((_, c) => Math.max(...[cabecera, ...filas].map((f) => f[c]!.length)));
  const linea = (celdas: readonly string[]) =>
    celdas
      .map((celda, c) => celda.padEnd(anchos[c]!))
      .join('  ')
      .trimEnd();
  return [linea(cabecera), linea(anchos.map((a) => '-'.repeat(a))), ...filas.map(linea)].join('\n');
}

// --- El veredicto ------------------------------------------------------------------

export interface Veredicto {
  readonly acorde: string;
  /** `pasa`, `no pasa`, o `sin datos` si no hay tomas bastantes para decidir. */
  readonly estado: 'pasa' | 'no pasa' | 'sin datos';
  readonly porque: string;
}

/**
 * Lo que decide el estudio, acorde por acorde: **acierto ≥ 85 % y, de lo que
 * falla, ≥ 85 % con «?»**. Un acorde con menos de `TOMAS_MINIMAS` no decide: se
 * dice cuántas faltan en vez de darle una nota que no se ha ganado.
 */
export function veredicto(porAcorde: readonly Recuento[]): Veredicto[] {
  return ACORDES_DEL_ESTUDIO.map((acorde) => {
    const r = porAcorde.find((recuento) => recuento.grupo === acorde);
    if (r === undefined || r.tomas < TOMAS_MINIMAS) {
      const hay = r?.tomas ?? 0;
      return { acorde, estado: 'sin datos', porque: `${hay} tomas de ${TOMAS_MINIMAS}` } as const;
    }
    const acierto = r.acertados / r.tocados;
    const fallos = r.dudasBienPuestas + r.seguroYFalso;
    const marcados = fallos === 0 ? 1 : r.dudasBienPuestas / fallos;
    const pasa = acierto >= UMBRAL_DE_ACIERTO && marcados >= UMBRAL_DE_FALLOS_MARCADOS;
    return {
      acorde,
      estado: pasa ? 'pasa' : 'no pasa',
      porque: `acierto ${porcentaje(r.acertados, r.tocados)}, fallos con ? ${fallos === 0 ? '—' : porcentaje(r.dudasBienPuestas, fallos)}`,
    } as const;
  });
}
