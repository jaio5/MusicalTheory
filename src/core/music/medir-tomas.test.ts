import { describe, expect, it } from 'vitest';

import type { CapturedChord } from './capture';
import { parseChordSymbol, type ParsedChord } from './chord-symbols';
import {
  ACORDES_DEL_ESTUDIO,
  cifradoDe,
  etiquetaDelNombre,
  leerEtiquetas,
  medirToma,
  nombreSinExtension,
  porcentaje,
  recuentoPor,
  recuentoPorAcorde,
  tablaDeRecuentos,
  TOMAS_MINIMAS,
  veredicto,
  type Recuento,
  type TomaEtiquetada,
  type TomaMedida,
} from './medir-tomas';

const acorde = (simbolo: string): ParsedChord => parseChordSymbol(simbolo)!;

/** Lo que escribiría el motor: seguro de sobra, o con duda. */
function oido(simbolo: string, dudoso = false): CapturedChord {
  const { root, notes } = acorde(simbolo);
  return dudoso
    ? { root, notes, at: 0, score: 0.8, margin: 0.01 }
    : { root, notes, at: 0, score: 0.95, margin: 0.3 };
}

const tocar = (...simbolos: string[]) => simbolos.map(acorde);

describe('lo tocado, sacado del nombre del fichero', () => {
  it('lee guitarra, micro y un acorde', () => {
    const toma = etiquetaDelNombre('/tomas/guitarra1_portatil_Am.wav');
    expect(toma).toMatchObject({ guitarra: 'guitarra1', micro: 'portatil', forma: null });
    expect(toma.acordes.map((a) => a.symbol)).toEqual(['Am']);
    expect(toma.fichero).toBe('/tomas/guitarra1_portatil_Am.wav');
  });

  it('lee una progresión con guiones, la forma y deja pasar lo de detrás', () => {
    const toma = etiquetaDelNombre('C:\\tomas\\ana_movil_C-G-Am-F_arpegio_2.m4a');
    expect(toma.acordes.map((a) => a.symbol)).toEqual(['C', 'G', 'Am', 'F']);
    expect(toma.forma).toBe('arpegio');
  });

  it('dice qué falta cuando el nombre no sirve', () => {
    expect(() => etiquetaDelNombre('sin-nombre.wav')).toThrow(/guitarra_micro_acordes/);
    expect(() => etiquetaDelNombre('_movil_C.wav')).toThrow(/guitarra_micro_acordes/);
    expect(() => etiquetaDelNombre('g__C.wav')).toThrow(/guitarra_micro_acordes/);
    expect(() => etiquetaDelNombre('g_m_.wav')).toThrow(/no dice qué se tocó/);
    expect(() => etiquetaDelNombre('g_m_Hm.wav')).toThrow(/«Hm» no es un acorde/);
  });

  it('quita la carpeta y la extensión, y deja en paz un nombre que empieza por punto', () => {
    expect(nombreSinExtension('a/b/c.d.wav')).toBe('c.d');
    expect(nombreSinExtension('sin-extension')).toBe('sin-extension');
    expect(nombreSinExtension('.oculto')).toBe('.oculto');
  });
});

describe('etiquetas.csv', () => {
  it('lee comas, comentarios, líneas en blanco, forma y tonalidad', () => {
    const etiquetas = leerEtiquetas(
      [
        'Fichero, Guitarra, Micro, Acordes, Forma, Tonalidad',
        '# una inversión no cabe en un nombre',
        '',
        'toma-1.wav, prestada, interfaz, C G Am F, rasgueo, Am',
        'toma-2.m4a, prestada, movil, C, , C',
        'toma-3.wav, prestada, movil, D',
      ].join('\r\n'),
    );
    expect([...etiquetas.keys()]).toEqual(['toma-1', 'toma-2', 'toma-3']);
    const primera = etiquetas.get('toma-1')!;
    expect(primera.acordes.map((a) => a.symbol)).toEqual(['C', 'G', 'Am', 'F']);
    expect(primera.forma).toBe('rasgueo');
    expect(primera.tonalidad).toEqual({ tonic: 9, mode: 'minor' });
    expect(etiquetas.get('toma-2')).toMatchObject({ forma: null, tonalidad: { mode: 'major' } });
    expect(etiquetas.get('toma-3')).not.toHaveProperty('tonalidad');
  });

  it('admite el punto y coma de una hoja de cálculo en español, y columnas que faltan', () => {
    const etiquetas = leerEtiquetas('fichero;guitarra;micro;acordes;forma\nx.wav;g;m;Em\n');
    expect(etiquetas.get('x')).toMatchObject({ guitarra: 'g', micro: 'm', forma: null });
    // Una fila corta deja vacía la columna que no trae, y sin acordes no vale.
    expect(() => leerEtiquetas('fichero,guitarra,micro,acordes\nx.wav,g\n')).toThrow(
      /línea 2: no dice qué se tocó/,
    );
  });

  it('sin nada, no hay etiquetas', () => {
    expect(leerEtiquetas('\n# nada\n').size).toBe(0);
  });

  it('dice qué está mal y en qué línea', () => {
    expect(() => leerEtiquetas('fichero,guitarra,acordes\n')).toThrow(/falta la columna «micro»/);
    expect(() => leerEtiquetas('fichero,guitarra,micro,acordes,forma\nx,g,m,C,punteo\n')).toThrow(
      /línea 2: la forma es «rasgueo» o «arpegio»/,
    );
    expect(() => leerEtiquetas('fichero,guitarra,micro,acordes,tonalidad\nx,g,m,C,G7\n')).toThrow(
      /«G7» no es una tonalidad/,
    );
    expect(() => leerEtiquetas('fichero,guitarra,micro,acordes,tonalidad\nx,g,m,C,Z\n')).toThrow(
      /«Z» no es una tonalidad/,
    );
  });
});

describe('el cifrado de lo que escribió el motor', () => {
  it('nombra las especies de la tabla, con la grafía que se pida', () => {
    expect(cifradoDe(acorde('Am'))).toBe('Am');
    expect(cifradoDe(acorde('Bb7'), 'flat')).toBe('Bb7');
    expect(cifradoDe(acorde('Bb7'))).toBe('A#7');
  });

  it('lo que no está en la tabla sale raro, no con un nombre inventado', () => {
    expect(cifradoDe({ root: 0, notes: [0, 1, 2] })).toBe('C(0,1,2)');
  });
});

describe('medir una toma', () => {
  it('lo escrito tal cual es acierto, y sin dudas', () => {
    const medida = medirToma(
      tocar('C', 'G', 'Am', 'F'),
      ['C', 'G', 'Am', 'F'].map((s) => oido(s)),
    );
    expect(medida).toMatchObject({
      tocados: 4,
      acertados: 4,
      escritos: 4,
      dudas: 0,
      seguroYFalso: 0,
    });
  });

  it('dos iguales seguidos son uno, como los junta el motor', () => {
    const medida = medirToma(tocar('C', 'C', 'G'), [oido('C'), oido('G')]);
    expect(medida.tocados).toBe(2);
    expect(medida.acertados).toBe(2);
  });

  it('cuenta lo cambiado, lo colado y lo perdido, y si llevaba la duda', () => {
    // Tocado: Am. Escrito: un Esus4 seguro que se coló delante y el Am con duda.
    const colado = medirToma(tocar('Am'), [oido('Esus4'), oido('Am', true)]);
    expect(colado.parejas).toEqual([
      { tocado: null, escrito: 'Esus4', dudoso: false, bien: false },
      { tocado: 'Am', escrito: 'Am', dudoso: true, bien: true },
    ]);
    expect(colado).toMatchObject({ seguroYFalso: 1, dudasDeMas: 1, dudasBienPuestas: 0 });

    // Tocado: C G. Escrito: un Cmaj7 dudoso en vez del C, y el G no llegó.
    const cambiado = medirToma(tocar('C', 'G'), [oido('Cmaj7', true)]);
    expect(cambiado.parejas).toEqual([
      { tocado: 'C', escrito: 'Cmaj7', dudoso: true, bien: false },
      { tocado: 'G', escrito: null, dudoso: false, bien: false },
    ]);
    expect(cambiado).toMatchObject({ acertados: 0, dudasBienPuestas: 1, seguroYFalso: 0 });
  });

  it('empareja lo que encaja aunque sobre algo en medio', () => {
    const medida = medirToma(tocar('C', 'G'), [oido('C'), oido('E'), oido('G')]);
    expect(medida.parejas.map((p) => [p.tocado, p.escrito])).toEqual([
      ['C', 'C'],
      [null, 'E'],
      ['G', 'G'],
    ]);
  });

  it('lo perdido se dice aunque no falte nada al final', () => {
    const medida = medirToma(tocar('C', 'G', 'F'), [oido('C'), oido('F')]);
    expect(medida.parejas.map((p) => [p.tocado, p.escrito])).toEqual([
      ['C', 'C'],
      ['G', null],
      ['F', 'F'],
    ]);
  });

  it('sin nada escrito, todo perdido; sin nada tocado, todo colado', () => {
    expect(medirToma(tocar('D'), [])).toMatchObject({ tocados: 1, acertados: 0, escritos: 0 });
    expect(medirToma([], [oido('D')])).toMatchObject({ tocados: 0, seguroYFalso: 1 });
  });
});

describe('los recuentos', () => {
  const toma = (fichero: string, guitarra: string, micro: string): TomaEtiquetada => ({
    fichero,
    guitarra,
    micro,
    forma: null,
    acordes: [],
  });
  const medidas: TomaMedida[] = [
    { toma: toma('a', 'g1', 'movil'), medida: medirToma(tocar('Am'), [oido('Am')]) },
    {
      toma: toma('b', 'g2', 'movil'),
      medida: medirToma(tocar('Am'), [oido('Esus4'), oido('C6', true)]),
    },
    { toma: toma('c', 'g1', 'interfaz'), medida: medirToma(tocar('Bb', 'C'), [oido('C')]) },
  ];

  it('por guitarra, cada toma entera en su grupo y en orden', () => {
    const porGuitarra = recuentoPor(medidas, (t) => t.guitarra);
    expect(porGuitarra.map((r) => [r.grupo, r.tomas, r.acertados, r.tocados])).toEqual([
      ['g1', 2, 2, 3],
      ['g2', 1, 0, 1],
    ]);
  });

  it('por acorde, en el orden del estudio y lo demás detrás, con lo que se leyó en su lugar', () => {
    const porAcorde = recuentoPorAcorde(medidas);
    expect(porAcorde.map((r) => r.grupo)).toEqual(['C', 'Am', 'Bb']);
    const am = porAcorde.find((r) => r.grupo === 'Am')!;
    expect(am).toMatchObject({ tomas: 2, tocados: 2, acertados: 1, dudasBienPuestas: 1 });
    expect(am.confusiones).toEqual(['C6 ×1']);
    expect(porAcorde.find((r) => r.grupo === 'Bb')!.confusiones).toEqual(['nada ×1']);
  });

  it('dos acordes que no son del estudio van por orden alfabético', () => {
    const fuera = [
      { toma: toma('x', 'g', 'm'), medida: medirToma(tocar('E', 'B'), [oido('E'), oido('B')]) },
    ];
    expect(recuentoPorAcorde(fuera).map((r) => r.grupo)).toEqual(['B', 'E']);
  });

  it('las confusiones van de más a menos, y a igualdad por nombre', () => {
    const muchas = [
      { toma: toma('x', 'g', 'm'), medida: medirToma(tocar('C'), [oido('Cmaj7')]) },
      { toma: toma('y', 'g', 'm'), medida: medirToma(tocar('C'), [oido('C7')]) },
      { toma: toma('z', 'g', 'm'), medida: medirToma(tocar('C'), [oido('C7')]) },
      { toma: toma('w', 'g', 'm'), medida: medirToma(tocar('C'), [oido('C6')]) },
    ];
    expect(recuentoPorAcorde(muchas)[0]!.confusiones).toEqual(['C7 ×2', 'C6 ×1', 'Cmaj7 ×1']);
  });

  it('la tabla alinea las columnas y dice cuántos fallos llevaban «?»', () => {
    const tabla = tablaDeRecuentos(
      'micro',
      recuentoPor(medidas, (t) => t.micro),
    );
    const [cabecera, raya, interfaz, movil] = tabla.split('\n');
    expect(cabecera).toMatch(/^micro +tomas/);
    expect(raya).toMatch(/^-{8} {2}-{5}/);
    expect(interfaz).toMatch(/^interfaz +1 +1\/2 \(50 %\)/);
    // En el móvil: un fallo seguro (Esus4) y uno con duda (C6): la mitad avisó.
    expect(movil).toMatch(/50 % +C6 ×1$/);
    // Sin fallos no hay proporción que dar.
    expect(
      tablaDeRecuentos(
        'g',
        recuentoPor(medidas.slice(0, 1), () => 'a'),
      ),
    ).toMatch(/— *$/);
  });

  it('un porcentaje sin total es una raya', () => {
    expect(porcentaje(0, 0)).toBe('—');
    expect(porcentaje(17, 20)).toBe('85 %');
  });
});

describe('el veredicto del estudio', () => {
  const recuento = (grupo: string, cambios: Partial<Recuento>): Recuento => ({
    grupo,
    tomas: TOMAS_MINIMAS,
    tocados: 20,
    acertados: 20,
    escritos: 20,
    dudas: 0,
    dudasBienPuestas: 0,
    dudasDeMas: 0,
    seguroYFalso: 0,
    confusiones: [],
    ...cambios,
  });

  it('decide los seis abiertos, y sin tomas bastantes no decide', () => {
    const v = veredicto([
      recuento('C', {}),
      recuento('G', { acertados: 17, dudasBienPuestas: 3 }),
      recuento('D', { acertados: 16, dudasBienPuestas: 4 }),
      recuento('Am', { acertados: 18, dudasBienPuestas: 1, seguroYFalso: 1 }),
      recuento('Em', { tomas: TOMAS_MINIMAS - 1 }),
    ]);
    expect(v.map((x) => x.acorde)).toEqual(ACORDES_DEL_ESTUDIO);
    expect(v.map((x) => x.estado)).toEqual([
      'pasa',
      'pasa',
      'no pasa',
      'no pasa',
      'sin datos',
      'sin datos',
    ]);
    expect(v[0]!.porque).toBe('acierto 100 %, fallos con ? —');
    expect(v[1]!.porque).toBe('acierto 85 %, fallos con ? 100 %');
    expect(v[3]!.porque).toBe('acierto 90 %, fallos con ? 50 %');
    expect(v[4]!.porque).toBe(`${TOMAS_MINIMAS - 1} tomas de ${TOMAS_MINIMAS}`);
    expect(v[5]!.porque).toBe(`0 tomas de ${TOMAS_MINIMAS}`);
  });
});
