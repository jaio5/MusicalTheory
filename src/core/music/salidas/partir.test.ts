import { describe, expect, it } from 'vitest';

import type { KeyMode } from '../keys';
import { pitchClassFromName, type NoteName } from '../notes';
import { resolveDegree, type DegreeSymbol } from '../progressions';
import { esPartirEnIiV, gruposPorPulsos, iiDeLaDominante, partirEnIiV } from './partir';

/** El cifrado de un grado en una tonalidad, para leer los casos como se tocan. */
function cifrado(tonica: NoteName, mode: KeyMode, grado: DegreeSymbol): string {
  return resolveDegree(pitchClassFromName(tonica), mode, grado).symbol;
}

describe('el ii de una dominante', () => {
  it('hacia un acorde mayor, el ii menor', () => {
    expect(iiDeLaDominante('major', 'V')).toBe('ii');
    // El ii del V/V es el vi: Am delante de D7 en Do, que va al G.
    expect(iiDeLaDominante('major', 'V/V')).toBe('vi');
  });

  it('hacia uno menor, el semidisminuido; si no está, el menor', () => {
    expect(iiDeLaDominante('minor', 'V')).toBe('ii°');
    expect(iiDeLaDominante('major', 'V/vi')).toBe('vii°');
    // Em7 A7 Dm7 en Do: el ii–V al ii, con el ii menor porque Mi semidisminuido no
    // es un grado del catálogo de mayor.
    expect(iiDeLaDominante('major', 'V/ii')).toBe('iii');
    expect(iiDeLaDominante('minor', 'V/iv')).toBe('v');
  });

  it('sin ninguno de los dos en el catálogo, nulo', () => {
    // Fa# menor en Do mayor y Fa# en La menor no son grados de nadie.
    expect(iiDeLaDominante('major', 'V/iii')).toBeNull();
    expect(iiDeLaDominante('minor', 'V/V')).toBeNull();
  });

  it('lo que no es una dominante con destino no tiene ii', () => {
    for (const grado of ['I', 'bVII', 'vii°', 'IV'] as const) {
      expect(iiDeLaDominante('major', grado)).toBeNull();
    }
    expect(iiDeLaDominante('minor', 'v')).toBeNull();
    // Un grado que no es del modo tampoco: la dominante del vi no existe en menor.
    expect(iiDeLaDominante('minor', 'V/vi')).toBeNull();
  });
});

describe('partir una dominante en su ii y ella', () => {
  it('un V de un compás se parte a medias, y uno de dos, compás a compás', () => {
    expect(partirEnIiV('major', { degree: 'V', beats: 4 })).toEqual([
      { degree: 'ii', beats: 2 },
      { degree: 'V', beats: 2 },
    ]);
    expect(partirEnIiV('major', { degree: 'V', beats: 8 })).toEqual([
      { degree: 'ii', beats: 4 },
      { degree: 'V', beats: 4 },
    ]);
    // En seis por ocho, tres y tres.
    expect(partirEnIiV('minor', { degree: 'V', beats: 6 })).toEqual([
      { degree: 'ii°', beats: 3 },
      { degree: 'V', beats: 3 },
    ]);
  });

  it('la secundaria igual: el V/V se parte en su ii y él', () => {
    expect(partirEnIiV('major', { degree: 'V/V', beats: 4 })).toEqual([
      { degree: 'vi', beats: 2 },
      { degree: 'V/V', beats: 2 },
    ]);
    expect(partirEnIiV('major', { degree: 'V/vi', beats: 4 })![0].degree).toBe('vii°');
  });

  it('suena como se toca, en varias tonalidades', () => {
    const enDo = partirEnIiV('major', { degree: 'V', beats: 4 })!;
    expect(enDo.map((acorde) => cifrado('C', 'major', acorde.degree))).toEqual(['Dm', 'G']);
    const enSib = partirEnIiV('major', { degree: 'V', beats: 4 })!;
    expect(enSib.map((acorde) => cifrado('Bb', 'major', acorde.degree))).toEqual(['Cm', 'F']);
    const enLaMenor = partirEnIiV('minor', { degree: 'V', beats: 4 })!;
    expect(enLaMenor.map((acorde) => cifrado('A', 'minor', acorde.degree))).toEqual(['Bdim', 'E']);
    const delVi = partirEnIiV('major', { degree: 'V/vi', beats: 4 })!;
    expect(delVi.map((acorde) => cifrado('D', 'major', acorde.degree))).toEqual(['C#dim', 'F#']);
  });

  it('no parte por debajo de dos pulsos por mitad, ni lo que no tiene mitad', () => {
    for (const beats of [2, 3, 5, 4.5]) {
      expect(partirEnIiV('major', { degree: 'V', beats })).toBeNull();
    }
  });

  it('no parte lo que ya llega preparado, ni lo que no es una dominante', () => {
    const v = { degree: 'V', beats: 4 } as const;
    expect(partirEnIiV('major', v, { anterior: 'ii' })).toBeNull();
    // Con otra subdominante delante, `IV V` partido daría `IV ii V`: prepara dos veces.
    expect(partirEnIiV('major', v, { anterior: 'IV' })).toBeNull();
    expect(partirEnIiV('minor', v, { anterior: 'iv' })).toBeNull();
    // Y el VI de la andaluza ya la prepara, bajando medio tono.
    expect(partirEnIiV('minor', v, { anterior: 'VI' })).toBeNull();
    expect(partirEnIiV('major', v, { anterior: 'bVI' })).toBeNull();
    // Desde la tónica o el relativo, sí.
    expect(partirEnIiV('major', v, { anterior: 'I' })).not.toBeNull();
    expect(partirEnIiV('major', v, { anterior: 'vi', siguiente: 'I' })).not.toBeNull();
    expect(partirEnIiV('major', { degree: 'IV', beats: 4 })).toBeNull();
    expect(partirEnIiV('major', { degree: 'V/iii', beats: 4 })).toBeNull();
  });

  it('se parte la dominante que llega adonde va, no la que vuelve atrás', () => {
    const v = { degree: 'V', beats: 4 } as const;
    expect(partirEnIiV('major', v, { siguiente: 'IV' })).toBeNull();
    expect(partirEnIiV('major', v, { siguiente: null })).not.toBeNull();
    // La secundaria, delante de su grado.
    expect(partirEnIiV('major', { degree: 'V/V', beats: 4 }, { siguiente: 'V' })).not.toBeNull();
    expect(partirEnIiV('major', { degree: 'V/V', beats: 4 }, { siguiente: 'I' })).toBeNull();
  });
});

describe('la comprobación del partido', () => {
  const v = { degree: 'V', beats: 4 } as const;

  it('confirma el reparto y el ii verdaderos', () => {
    expect(esPartirEnIiV('major', v, { degree: 'ii', beats: 2 }, { degree: 'V', beats: 2 })).toBe(
      true,
    );
  });

  it('rechaza otro ii, otro reparto u otra dominante', () => {
    expect(esPartirEnIiV('major', v, { degree: 'IV', beats: 2 }, { degree: 'V', beats: 2 })).toBe(
      false,
    );
    expect(esPartirEnIiV('major', v, { degree: 'ii', beats: 3 }, { degree: 'V', beats: 1 })).toBe(
      false,
    );
    expect(esPartirEnIiV('major', v, { degree: 'ii', beats: 2 }, { degree: 'V', beats: 3 })).toBe(
      false,
    );
    expect(esPartirEnIiV('major', v, { degree: 'ii', beats: 2 }, { degree: 'I', beats: 2 })).toBe(
      false,
    );
  });

  it('lo que no se puede partir no se da por partido', () => {
    expect(
      esPartirEnIiV(
        'major',
        { degree: 'I', beats: 4 },
        { degree: 'ii', beats: 2 },
        { degree: 'I', beats: 2 },
      ),
    ).toBe(false);
  });
});

describe('emparejar por pulsos', () => {
  const de = (...beats: number[]) => beats.map((b) => ({ beats: b }));

  it('uno a uno si duran lo mismo, y dos donde había uno si suman lo que duraba', () => {
    expect(gruposPorPulsos(de(4, 4, 4), de(4, 4, 4))).toEqual([[0], [1], [2]]);
    expect(gruposPorPulsos(de(4, 4, 4), de(4, 2, 2, 4))).toEqual([[0], [1, 2], [3]]);
  });

  it('nulo si no se pueden emparejar así, o si sobra algo', () => {
    expect(gruposPorPulsos(de(4, 4), de(3, 5))).toBeNull();
    expect(gruposPorPulsos(de(4, 4), de(4, 4, 4))).toBeNull();
    expect(gruposPorPulsos(de(4, 4), de(4))).toBeNull();
    expect(gruposPorPulsos(de(4), de(1, 1, 2))).toBeNull();
  });
});
