import { describe, expect, it } from 'vitest';

import {
  copiaParaBuscar,
  recortarALetras,
  sinMarca,
  textoLibre,
  textoVisible,
  tieneMarca,
  tokensEnElPeorCaso,
} from './marca';
import { KB_128, tarda, TOPE_128_KB_MS } from './cronometro-para-tests';

const PALABRA = 'PREGUNTA';

/**
 * **Lo que bloqueaba el hilo.** `[#♯]{2,}\s*PALABRA` probaba desde cada almohadilla
 * de una tira: 40.000 eran tres segundos, y un cuerpo de 128 KB contra
 * `/api/teacher`, cuarenta y siete sin cuenta (adr/0115). Cada función que recibe
 * texto de quien escribe tiene que despachar 128 KB del peor que se conoce en menos
 * de 50 ms. Estos son los textos que hacían trabajar de más a las expresiones de
 * antes y a las de ahora.
 */
const ATAQUES_DE_128_KB: Readonly<Record<string, string>> = {
  almohadillas: '#'.repeat(KB_128),
  'almohadillas y espacios': '## '.repeat(KB_128 / 3),
  sostenidos: '♯'.repeat(KB_128 / 3),
  'la palabra y espacios': 'PREGUNTA '.repeat(KB_128 / 9),
  'tiras sin palabra': ('#'.repeat(64) + ' '.repeat(64)).repeat(KB_128 / 128),
  'marcas a medias': '##PREGUNT'.repeat(KB_128 / 9),
  letras: 'a'.repeat(KB_128),
  'letras y puntos': 'aa.'.repeat(KB_128 / 3),
  disfraces: '#\uFE0F'.repeat(KB_128 / 2),
};

describe('128 KB no paran el hilo', () => {
  it.each(Object.entries(ATAQUES_DE_128_KB))('%s', (_, texto) => {
    for (const hacer of [
      () => sinMarca(texto, PALABRA),
      () => textoVisible(texto),
      () => copiaParaBuscar(texto),
      () => tieneMarca(texto, PALABRA),
      () => textoLibre(texto, PALABRA, 240),
      () => tokensEnElPeorCaso(texto),
      () => recortarALetras(texto, 240),
    ]) {
      expect(tarda(hacer)).toBeLessThan(TOPE_128_KB_MS);
    }
  });
});
