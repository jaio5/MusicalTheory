import { describe, expect, it } from 'vitest';

import { barajada, conOpcionesRepartidas, repartidasEnLaUnidad, semillaDe } from './baraja';

const PREGUNTA = {
  prompt: '¿Cuál es el V grado?',
  choices: [
    { text: 'G', correct: true },
    { text: 'F', correct: false },
    { text: 'Am', correct: false },
    { text: 'Dm', correct: false },
  ],
  why: 'Porque sí.',
};

describe('la baraja sin azar', () => {
  it('la misma semilla da siempre el mismo orden', () => {
    const lista = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(barajada(lista, 12345)).toEqual(barajada(lista, 12345));
  });

  it('no pierde ni repite nada', () => {
    const lista = ['a', 'b', 'c', 'd', 'e'];
    expect([...barajada(lista, semillaDe('x'))].sort()).toEqual(lista);
  });

  it('no toca la lista que recibe', () => {
    const lista = [1, 2, 3, 4];
    barajada(lista, 99);
    expect(lista).toEqual([1, 2, 3, 4]);
  });

  /**
   * Repartir es que la primera no se quede siempre en su sitio. Con cien semillas
   * distintas la buena tiene que pasar por las cuatro posiciones.
   */
  it('con semillas distintas la primera acaba en cualquier sitio', () => {
    const sitios = new Set<number>();
    for (let i = 0; i < 100; i += 1) {
      sitios.add(barajada(['buena', 'b', 'c', 'd'], semillaDe(`pregunta ${i}`)).indexOf('buena'));
    }
    expect([...sitios].sort()).toEqual([0, 1, 2, 3]);
  });

  it('la semilla sale estable del texto', () => {
    expect(semillaDe('Do mayor')).toBe(semillaDe('Do mayor'));
    expect(semillaDe('Do mayor')).not.toBe(semillaDe('La menor'));
    expect(semillaDe('')).toBeGreaterThan(0);
  });

  it('reparte las opciones de una pregunta y deja lo demás como estaba', () => {
    const repartida = conOpcionesRepartidas(PREGUNTA);

    expect(repartida.prompt).toBe(PREGUNTA.prompt);
    expect(repartida.why).toBe(PREGUNTA.why);
    expect([...repartida.choices].sort((a, b) => a.text.localeCompare(b.text))).toEqual(
      [...PREGUNTA.choices].sort((a, b) => a.text.localeCompare(b.text)),
    );
    expect(conOpcionesRepartidas(PREGUNTA).choices).toEqual(repartida.choices);
  });

  it('la sal cambia el reparto de una pregunta cuyo texto no cambia', () => {
    const ordenes = new Set(
      Array.from({ length: 20 }, (_, i) =>
        conOpcionesRepartidas(PREGUNTA, `tonalidad ${i}`)
          .choices.map((choice) => choice.text)
          .join(),
      ),
    );
    expect(ordenes.size).toBeGreaterThan(1);
  });
});

describe('el reparto de una unidad entera', () => {
  const SI_O_NO = (prompt: string) => ({
    prompt,
    choices: [
      { text: 'Sí', correct: true },
      { text: 'No', correct: false },
    ],
  });
  const sitio = (pregunta: { choices: readonly { correct: boolean }[] }) =>
    pregunta.choices.findIndex((choice) => choice.correct);

  /**
   * Se busca a propósito una sal con la que las tres caen en el mismo sitio, que es
   * lo que le pasaba a la unidad de modos, y se comprueba que la última se mueve.
   */
  it('si todas caen en el mismo sitio, la última se mueve', () => {
    const unidad = [SI_O_NO('uno'), SI_O_NO('dos'), SI_O_NO('tres')];
    const sal = Array.from({ length: 200 }, (_, i) => `sal ${i}`).find((candidata) => {
      const sitios = unidad.map((pregunta) => sitio(conOpcionesRepartidas(pregunta, candidata)));
      return sitios.every((uno) => uno === sitios[0]);
    })!;
    expect(sal).toBeDefined();

    const repartidas = repartidasEnLaUnidad(unidad, sal);
    const antes = sitio(conOpcionesRepartidas(unidad[2]!, sal));

    expect(sitio(repartidas[0]!)).toBe(antes);
    expect(sitio(repartidas[2]!)).not.toBe(antes);
    expect(new Set(repartidas.map(sitio)).size).toBe(2);
    expect(repartidasEnLaUnidad(unidad, sal)).toEqual(repartidas);
  });

  it('si ya caen repartidas, no se toca ninguna', () => {
    const unidad = [SI_O_NO('uno'), SI_O_NO('dos'), SI_O_NO('tres')];
    const sal = Array.from({ length: 200 }, (_, i) => `sal ${i}`).find((candidata) => {
      const sitios = unidad.map((pregunta) => sitio(conOpcionesRepartidas(pregunta, candidata)));
      return new Set(sitios).size > 1;
    })!;

    expect(repartidasEnLaUnidad(unidad, sal)).toEqual(
      unidad.map((pregunta) => conOpcionesRepartidas(pregunta, sal)),
    );
  });

  it('una unidad de una sola pregunta se queda como sale', () => {
    const unidad = [SI_O_NO('sola')];
    expect(repartidasEnLaUnidad(unidad, 'x')).toEqual([conOpcionesRepartidas(unidad[0]!, 'x')]);
  });
});
