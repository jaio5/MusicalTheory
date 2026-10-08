/**
 * El examen de las salidas contra el modelo de verdad: **si lo que elige el modelo
 * es lo que propondría un arreglista**, con el corpus de
 * `core/music/salidas/corpus/corpus-de-salidas.ts`.
 *
 * El test del corpus (`corpus-de-salidas.test.ts`) mide el menú que construye el
 * dominio, y eso no dice lo que llega a la pantalla: de ese menú **elige el
 * modelo**, hasta tres, y escribe el porqué. Un menú con una buena salida en el
 * puesto siete aprueba si el modelo la encuentra y suspende si se queda con las de
 * arriba. Esto mide lo segundo, y por separado, porque se arregla con cosas
 * distintas:
 *
 * - **contesta**: la ruta devuelve lo del modelo, y no el respaldo del dominio ni
 *   un 502;
 * - **válidas**: de lo que propuso, cuánto pasó el validador;
 * - **nota**: si las salidas elegidas cumplen el `debe` y el `noDebe` del corpus,
 *   **examinadas como las ve quien compone**: lo elegido para las dos cosas. Al
 *   lado van la nota del menú solo —las tres primeras de seis para el `debe` y las
 *   seis para el `noDebe`, la cifra de siempre— y la del respaldo, las tres mejores
 *   con variedad examinadas como lo del modelo, que es lo que se llevaría sin él:
 *   si la del modelo es más baja, elegir está restando. **Sin directrices el modelo
 *   ve justo esas tres** y solo las explica, así que su nota tiene que ser la del
 *   respaldo, y «las cuenta todas» dice cuántas veces no se calló ninguna;
 * - **porqué verdadero**: lo que escribió antes de que `loQueNoEsta` lo cambie por
 *   la frase del dominio. Lo que se ve en pantalla nunca miente; lo que se mide
 *   aquí es cuántas veces hace falta taparlo;
 * - **tiempo**, con el reintento incluido;
 * - **elige la 1**: cuántas veces pone delante la que mejor encaja según el juez;
 *   sin directrices puede ordenarlas a su criterio, así que ya no es una orden;
 * - **directrices**: ocho peticiones del corpus con lo que pide quien toca
 *   —«más triste», «que suene a jazz», «cierra fuerte»…— y una comprobación de lo
 *   que eso quiere decir en grados. Se cuenta si alguna de las elegidas lo cumple,
 *   al lado de lo mismo con las tres primeras del menú —lo que daría el respaldo—
 *   y de si había alguna en el menú que lo cumpliera, que es el techo.
 *
 * **Va por el mismo camino que la aplicación**: la petición se lee con el contrato
 * (`parseSalidasRequest`) y la pregunta es `SALIDAS` (`app/api/salidas/salidas.ts`)
 * —prompt, esquema, validador, reintento y respaldo de la ruta— por
 * `preguntarAlModelo`. Lo único que no pasa son las puertas: frecuencia, cuenta y
 * cupo, que no cambian lo que se contesta.
 *
 *     pnpm examen:salidas [--api] [--detalle] [--solo <caso|familia|continuar|retocar|directrices>] [--tonos <mayor>:<menor>] [--json <fichero>]
 *
 * `--solo` admite varios separados por comas: `--solo pop-eje,andaluza`.
 *
 * `--tonos D:B` pregunta en Re mayor y Si menor en vez de Do y La. **Las
 * directrices son ocho peticiones**, y con la temperatura a cero un cambio pequeño
 * del prompt mueve una o dos de un lado a otro: para decidir un recorte se
 * pasaron en cinco tonalidades, cuarenta peticiones, porque el corpus está en
 * grados y lo que cambia de una a otra es lo que lee el modelo.
 *
 * Pide `OLLAMA_URL` en el `.env` y un Ollama con el modelo descargado —el modelo se
 * cambia con `OLLAMA_MODEL`—. **Contra la API de pago**, `ANTHROPIC_API_KEY` y
 * `--api`, y el modelo con `ANTHROPIC_MODEL`: sin `--api` se para y dice cuánto
 * costaría (`contra-la-api.ts`, `docs/MEDIR.md`). **No está entre los seis
 * comandos**, como el del profesor: sin modelo no hay nada que examinar.
 */
import { writeFileSync } from 'node:fs';

import { salidasPosibles, type NoteName, type SalidaPosible } from '@core/music';
import {
  CORPUS,
  enGrados,
  examinarCaso,
  grupoDe,
  PRIMERAS,
  type CasoDelCorpus,
  type NotaDeUnCaso,
} from '@core/music/salidas/corpus/corpus-de-salidas';
import { loQueNoEsta, parseSalidasRequest, type SalidaPropuesta } from '@features/salidas/contract';
import type { SalidasRequest } from '@features/salidas/peticion';
import {
  contextoDe,
  lasTresMejores,
  MAX_OPCIONES_DEL_MENU,
  salidasDe,
} from '@features/salidas/menu';
import { configuredModel, modelProvider } from '@server/ai-model';
import { preguntarAlModelo } from '@server/ai-intentos';

import { SALIDAS } from '@/app/api/salidas/salidas';

import { puertaDelExamen } from './contra-la-api';

type Kind = 'continuar' | 'retocar';
type Fuente = 'modelo' | 'dominio' | 'nada';

/** Lo que salió de un caso, para el recuento. */
interface Resultado {
  readonly caso: CasoDelCorpus;
  readonly kind: Kind;
  readonly fuente: Fuente;
  /** Las salidas del menú que se habrían visto, por su número en el menú (desde 1). */
  readonly numeros: readonly number[];
  /** Lo que propuso el modelo en el intento que valió: cuántas entradas traía. */
  readonly propuestas: number;
  readonly validas: number;
  /** Por cada salida que se ve: si su porqué, tal y como lo escribió, era verdad. */
  readonly porques: readonly {
    numero: number;
    dijo: string;
    falso: string | null;
    /** Si es una frase del prompt copiada tal cual: un motivo del juez o lo que hace. */
    copia: boolean;
    /** Si nombra algún acorde por su cifrado (G, Am7), que es lo que se lee en pantalla. */
    enAcordes: boolean;
  }[];
  readonly modelo: NotaDeUnCaso;
  /**
   * El mismo caso con el menú de seis: las tres primeras para el `debe` y las seis
   * para el `noDebe`. Es la cifra de siempre, para comparar con lo medido antes.
   */
  readonly menu: NotaDeUnCaso;
  /**
   * Lo que daría el respaldo sin IA, las tres mejores con variedad, examinado como
   * lo del modelo: lo elegido para las dos cosas. Sin directrices es el menú que ve
   * el modelo, así que su nota es el techo de la suya.
   */
  readonly respaldo: NotaDeUnCaso;
  /** Cuántas salidas tenía el menú que vio el modelo. */
  readonly vio: number;
  readonly segundos: number;
  /** Lo que pidió, si la petición llevaba directrices. */
  readonly directriz: Directriz | null;
  /** Si alguna de las elegidas lo cumple. */
  readonly sigue: boolean;
  /** Lo mismo con las tres primeras del menú, y con el menú entero. */
  readonly sigueElMenu: boolean;
  readonly hayEnElMenu: boolean;
}

/**
 * Una petición con directrices: lo que se escribe y lo que quiere decir en grados.
 *
 * La comprobación es lo que el dominio sabe contar —un color, un final, una
 * especie—, no el oído: dice si lo elegido va hacia ahí, no si suena bien.
 */
interface Directriz {
  readonly caso: string;
  readonly kind: Kind;
  readonly texto: string;
  readonly cumple: (salida: SalidaPosible, peticion: SalidasRequest) => boolean;
}

const pasosDe = (salida: SalidaPosible) => salida.secciones.flatMap((seccion) => seccion.steps);
const pulsos = (pasos: readonly { readonly beats: number }[]) =>
  pasos.reduce((total, paso) => total + paso.beats, 0);
const tonicaDe = (peticion: SalidasRequest) => (peticion.key.mode === 'major' ? 'I' : 'i');

const DIRECTRICES: readonly Directriz[] = [
  {
    caso: 'pop-eje',
    kind: 'continuar',
    texto: 'más triste',
    cumple: (s) => s.colores.includes('oscurece'),
  },
  {
    caso: 'tres-acordes',
    kind: 'retocar',
    texto: 'que suene a jazz',
    // Una séptima, una dominante secundaria o un sustituto tritonal.
    cumple: (s) =>
      pasosDe(s).some(
        (paso) =>
          (paso.especie !== undefined && paso.especie !== null && paso.especie.endsWith('7')) ||
          paso.degree.includes('/') ||
          paso.move === 'tritono',
      ),
  },
  {
    caso: 'periodo-abierto',
    kind: 'continuar',
    texto: 'cierra fuerte',
    // Una cadencia perfecta: V y la tónica al final.
    cumple: (s, p) => {
      const pasos = pasosDe(s);
      return pasos.at(-1)!.degree === tonicaDe(p) && pasos.at(-2)?.degree === 'V';
    },
  },
  {
    caso: 'dos-acordes',
    kind: 'continuar',
    texto: 'algo más largo',
    // Que lo que añade sea al menos el doble de lo tuyo.
    cumple: (s, p) => pulsos(pasosDe(s)) >= 3 * pulsos(p.progression),
  },
  {
    caso: 'rock-mixo',
    kind: 'retocar',
    texto: 'sin acordes raros',
    // Nada prestado ni secundario.
    cumple: (s) =>
      !s.colores.includes('prestado') && !pasosDe(s).some((p) => p.degree.includes('/')),
  },
  {
    caso: 'eolico-pop',
    kind: 'retocar',
    texto: 'más alegre',
    cumple: (s) => s.colores.includes('aclara'),
  },
  {
    caso: 'canon',
    kind: 'retocar',
    texto: 'que quede abierto, que pida seguir',
    cumple: (s, p) => pasosDe(s).at(-1)!.degree !== tonicaDe(p),
  },
  {
    caso: 'folk-semicadencia',
    kind: 'retocar',
    texto: 'más lento, que respire',
    cumple: (s) => s.colores.includes('mas-lento'),
  },
];

const argumentos = process.argv.slice(2);
const detalle = argumentos.includes('--detalle');
/** El valor que va detrás de una opción, si la opción está. */
function opcion(nombre: string): string | undefined {
  const donde = argumentos.indexOf(nombre);
  return donde === -1 ? undefined : argumentos[donde + 1];
}
const solo = opcion('--solo')?.split(',');
const [MAYOR, MENOR] = (opcion('--tonos') ?? 'C:A').split(':') as [NoteName, NoteName];
const json = opcion('--json');

/**
 * El cuerpo que mandaría la pantalla de componer para este caso: la tonalidad en
 * Do o en La —o las de `--tonos`—, los grados con su especie, el papel, el estilo y el compás.
 */
function cuerpoDe(caso: CasoDelCorpus, kind: Kind, directrices?: string): unknown {
  const { estilo, papel, pulsosPorCompas, especies } = caso.contexto;
  return {
    key: { tonic: caso.mode === 'major' ? MAYOR : MENOR, mode: caso.mode },
    kind,
    progression: caso.compases.map((paso, i) => ({
      degree: paso.degree,
      beats: paso.beats,
      ...(especies?.[i] ? { especie: especies[i] } : {}),
    })),
    ...(papel === undefined ? {} : { role: papel }),
    ...(estilo === undefined ? {} : { estilo }),
    ...(pulsosPorCompas === undefined ? {} : { pulsosPorCompas }),
    ...(directrices === undefined ? {} : { directrices }),
  };
}

/** Una salida y una versión validada son la misma si suenan igual compás a compás. */
function mismaCancion(salida: SalidaPosible, version: SalidaPropuesta): boolean {
  const pasos = salida.secciones.flatMap((seccion) => seccion.steps);
  return (
    pasos.length === version.steps.length &&
    pasos.every(
      (paso, i) =>
        paso.degree === version.steps[i]!.degree && paso.beats === version.steps[i]!.beats,
    )
  );
}

/** Lo que dijo el modelo para la opción `numero`, en el intento que valió. */
function loQueDijo(payload: unknown, numero: number): string | null {
  const versiones = (payload as { versions?: unknown } | null)?.versions;
  if (!Array.isArray(versiones)) return null;
  const suya = versiones.find(
    (v): v is { opcion: number; why: unknown } =>
      typeof v === 'object' && v !== null && (v as { opcion?: unknown }).opcion === numero,
  );
  return typeof suya?.why === 'string' ? suya.why.trim().slice(0, 200) : null;
}

/** Un cifrado escrito: `C`, `F#m`, `Bb7`. La «A» suelta delante de minúscula es la preposición. */
const CIFRADO =
  /(?<![\p{L}#\d/])(?:[B-G]|A(?!\s+\p{Ll}))(?:#|b)?(?:maj7|m7|m|dim|aug|sus2|sus4|7|5)?(?![\p{L}#\d])/u;

async function examinarUno(
  caso: CasoDelCorpus,
  kind: Kind,
  directriz: Directriz | null,
): Promise<Resultado | null> {
  const peticion: SalidasRequest | null = parseSalidasRequest(
    cuerpoDe(caso, kind, directriz?.texto),
  );
  /* El corpus está escrito aquí: un caso que no se lea es un fallo del corpus. */
  if (peticion === null) {
    throw new Error(`El caso no se lee como petición: ${caso.id} (${kind})`);
  }
  // Lo que vio el modelo: sin directrices, las tres mejores; con ellas, las seis.
  const menu = salidasDe(peticion);
  const seis = salidasPosibles(
    peticion.key.mode,
    peticion.kind,
    peticion.progression,
    contextoDe(peticion),
  ).slice(0, MAX_OPCIONES_DEL_MENU);
  const tres = lasTresMejores(seis, peticion.progression).map((i) => seis[i]!);
  const delMenu = examinarCaso(caso, kind, seis.slice(0, PRIMERAS), seis);
  if (delMenu === null) return null;

  const dichos: unknown[] = [];
  const antes = Date.now();
  const desenlace = await preguntarAlModelo(SALIDAS, peticion, {
    alIntentar: (dicho) => {
      dichos.push(dicho);
      if (detalle) console.log(`      intento: ${JSON.stringify(dicho)}`);
    },
  });
  const segundos = (Date.now() - antes) / 1000;

  const fuente: Fuente =
    desenlace.kind === 'error' ? 'nada' : desenlace.kind === 'modelo' ? 'modelo' : 'dominio';
  const versiones = desenlace.kind === 'error' ? [] : desenlace.respuesta.versions;
  const numeros = versiones.map((version) => menu.findIndex((s) => mismaCancion(s, version)) + 1);
  const elegidas = numeros.map((numero) => menu[numero - 1]!);

  // El intento que valió es el último: el bucle para en cuanto uno pasa.
  const valio = fuente === 'modelo' ? dichos[dichos.length - 1] : null;
  const propuestas = Array.isArray((valio as { versions?: unknown } | null)?.versions)
    ? (valio as { versions: unknown[] }).versions.length
    : 0;
  const prompt = SALIDAS.prompt(peticion);
  const porques =
    fuente === 'modelo'
      ? versiones.map((version, i) => {
          const dijo = loQueDijo(valio, numeros[i]!) ?? '';
          return {
            numero: numeros[i]!,
            dijo,
            falso: loQueNoEsta(dijo, version, peticion),
            copia: dijo.length > 20 && prompt.includes(dijo.replace(/\.$/u, '')),
            enAcordes: CIFRADO.test(dijo),
          };
        })
      : [];

  return {
    caso,
    kind,
    fuente,
    numeros,
    propuestas,
    validas: fuente === 'modelo' ? versiones.length : 0,
    porques,
    // Lo elegido para las dos cosas: es lo que llega a la pantalla.
    modelo: examinarCaso(caso, kind, elegidas, elegidas)!,
    menu: delMenu,
    respaldo: examinarCaso(caso, kind, tres, tres)!,
    vio: menu.length,
    segundos,
    directriz,
    sigue: directriz !== null && elegidas.some((s) => directriz.cumple(s, peticion)),
    // Lo que daría el respaldo, y si había algo en el menú que vio que lo cumpliera.
    sigueElMenu: directriz !== null && tres.some((s) => directriz.cumple(s, peticion)),
    hayEnElMenu: directriz !== null && menu.some((s) => directriz.cumple(s, peticion)),
  };
}

const banco = [
  ...CORPUS.flatMap((caso) =>
    (['continuar', 'retocar'] as const)
      .filter((kind) => caso[kind] !== undefined)
      .map((kind) => ({ caso, kind, directriz: null as Directriz | null })),
  ),
  ...DIRECTRICES.map((directriz) => {
    const caso = CORPUS.find((c) => c.id === directriz.caso);
    /* Las directrices se escriben sobre casos del corpus: si falta uno, es un fallo de aquí. */
    if (caso === undefined) throw new Error(`No hay caso ${directriz.caso} en el corpus`);
    return { caso, kind: directriz.kind, directriz };
  }),
].filter(
  ({ caso, kind, directriz }) =>
    solo === undefined ||
    solo.some(
      (s) =>
        s === caso.id ||
        s === caso.familia ||
        s === kind ||
        (s === 'directrices' && directriz !== null),
    ),
);

puertaDelExamen('salidas', banco.length, argumentos);
console.log(
  `Examen de las salidas contra ${configuredModel()} (${modelProvider()}), en ${MAYOR} mayor y ${MENOR} menor: ${banco.length} peticiones.\n`,
);

const resultados: Resultado[] = [];
for (const { caso, kind, directriz } of banco) {
  const r = await examinarUno(caso, kind, directriz);
  if (r === null) continue;
  resultados.push(r);

  const marca =
    r.fuente !== 'modelo' ? 'CALLA' : r.modelo.incumplidas.length === 0 ? 'BIEN ' : 'MAL  ';
  console.log(
    `${marca} ${caso.id}:${kind}${directriz === null ? '' : ` «${directriz.texto}» ${r.sigue ? 'la sigue' : 'NO la sigue'} (respaldo ${r.sigueElMenu ? 'sí' : 'no'}, hay ${r.hayEnElMenu ? 'sí' : 'no'})`} [${grupoDe(r.modelo)}] elige ${r.numeros.join(', ') || '—'} de ${r.vio} · ${r.modelo.cumplidas}/${r.modelo.total} (menú ${r.menu.cumplidas}/${r.menu.total}, respaldo ${r.respaldo.cumplidas}/${r.respaldo.total}) · ${r.fuente}, ${r.segundos.toFixed(1)} s`,
  );
  if (r.fuente === 'modelo' && (detalle || r.modelo.incumplidas.length > 0)) {
    r.modelo.elegidas.forEach((salida, i) =>
      console.log(`      ${r.numeros[i]}. ${enGrados(caso, kind, salida)}`),
    );
    for (const { donde, dice } of r.modelo.incumplidas) console.log(`      ${donde}: ${dice}`);
  }
  for (const { numero, dijo, falso } of r.porques) {
    if (falso !== null || detalle) {
      console.log(
        `      porqué de la ${numero}${falso === null ? '' : ` (FALSO: ${falso})`}: ${dijo}`,
      );
    }
  }
}

/*
  Cinco cifras y no una, porque no se arreglan con lo mismo. **No contesta** es el
  modelo caído o un JSON que no pasa dos veces: lo tapa el respaldo, pero el que
  eligió fue el dominio. **Válidas** es el contrato. **La nota** es el criterio, y
  va al lado de la del menú: el modelo solo aporta si la suya es más alta. **El
  porqué** es la prosa que había que tapar. **El tiempo** es lo que espera quien
  pulsa el botón.
*/
function cifras(grupo: readonly Resultado[]): string {
  const n = grupo.length;
  const delModelo = grupo.filter((r) => r.fuente === 'modelo');
  const suma = (f: (r: Resultado) => number) => grupo.reduce((t, r) => t + f(r), 0);
  const porques = delModelo.flatMap((r) => r.porques);
  const por100 = (a: number, b: number) => (b === 0 ? '—' : `${Math.round((a / b) * 100)} %`);
  const cumplidas = suma((r) => r.modelo.cumplidas);
  const total = suma((r) => r.modelo.total);
  const delMenu = suma((r) => r.menu.cumplidas);
  const totalMenu = suma((r) => r.menu.total);
  const delRespaldo = suma((r) => r.respaldo.cumplidas);
  const totalRespaldo = suma((r) => r.respaldo.total);
  return [
    `contesta ${delModelo.length}/${n}`,
    `válidas ${suma((r) => r.validas)}/${suma((r) => r.propuestas)}`,
    `nota ${cumplidas}/${total} (${por100(cumplidas, total)})`,
    `enteros ${grupo.filter((r) => r.modelo.incumplidas.length === 0).length}/${n}`,
    `menú solo ${delMenu}/${totalMenu} (${por100(delMenu, totalMenu)})`,
    `respaldo ${delRespaldo}/${totalRespaldo} (${por100(delRespaldo, totalRespaldo)})`,
    // Sin directrices tiene que contarlas todas: cuántas veces lo hizo.
    `las cuenta todas ${delModelo.filter((r) => new Set(r.numeros).size === r.vio).length}/${delModelo.length}`,
    `porqué verdad ${porques.filter((p) => p.falso === null).length}/${porques.length}`,
    `copiado ${porques.filter((p) => p.copia).length}`,
    `en acordes ${porques.filter((p) => p.enAcordes).length}`,
    `elige la 1 ${delModelo.filter((r) => r.numeros[0] === 1).length}/${delModelo.length}`,
    `${n === 0 ? 0 : (suma((r) => r.segundos) / n).toFixed(1)} s de media`,
  ].join(' · ');
}

const sinDirectrices = resultados.filter((r) => r.directriz === null);
const conDirectrices = resultados.filter((r) => r.directriz !== null);
console.log(`\nTodas: ${cifras(sinDirectrices)}`);
for (const grupo of [...new Set(sinDirectrices.map((r) => grupoDe(r.modelo)))]) {
  console.log(`  ${grupo}: ${cifras(sinDirectrices.filter((r) => grupoDe(r.modelo) === grupo))}`);
}
if (conDirectrices.length > 0) {
  const cuenta = (f: (r: Resultado) => boolean) => conDirectrices.filter(f).length;
  console.log(
    `Con directrices: ${cifras(conDirectrices)}\n` +
      `  sigue lo pedido: el modelo ${cuenta((r) => r.sigue)}/${conDirectrices.length} · ` +
      `el respaldo ${cuenta((r) => r.sigueElMenu)} · ` +
      `había en el menú ${cuenta((r) => r.hayEnElMenu)}`,
  );
}
const enV = sinDirectrices.filter(
  (r) => r.kind === 'continuar' && r.caso.compases[r.caso.compases.length - 1]!.degree === 'V',
);
if (enV.length > 0) console.log(`  continuar lo que acaba en V: ${cifras(enV)}`);

if (json !== undefined) {
  writeFileSync(
    json,
    JSON.stringify(
      resultados.map((r) => ({
        caso: r.caso.id,
        kind: r.kind,
        directrices: r.directriz?.texto ?? null,
        sigue: r.sigue,
        sigueElMenu: r.sigueElMenu,
        hayEnElMenu: r.hayEnElMenu,
        grupo: grupoDe(r.modelo),
        fuente: r.fuente,
        elige: r.numeros,
        salidas: r.modelo.elegidas.map((s) => enGrados(r.caso, r.kind, s)),
        propuestas: r.propuestas,
        validas: r.validas,
        porques: r.porques,
        cumplidas: r.modelo.cumplidas,
        total: r.modelo.total,
        incumplidas: r.modelo.incumplidas,
        menu: { cumplidas: r.menu.cumplidas, total: r.menu.total },
        respaldo: { cumplidas: r.respaldo.cumplidas, total: r.respaldo.total },
        vio: r.vio,
        segundos: r.segundos,
      })),
      null,
      2,
    ),
  );
}
