'use client';

/**
 * El tema: negro de casa, claro si lo pides.
 *
 * Vive en `state/` y no dentro de un componente porque lo tocan dos sitios que no
 * se conocen: el conmutador de la barra de arriba y el guion que se ejecuta antes
 * de pintar. Y en `localStorage` y no en una cookie porque el guion lo lee de
 * forma síncrona en el `<head>`, antes del primer fotograma; con una cookie habría
 * que renderizar el HTML por tema y esta aplicación se sirve igual para todos.
 *
 * **Dos valores, y el oscuro no se guarda.** No hay «sistema»: esto es oscuro
 * salvo que se pida claro, y lo que se ofrece es una salida para quien lo use de
 * día, no una votación. Por eso volver al oscuro **borra** la preferencia en vez
 * de escribir otra: sin nada guardado, lo que sale es lo de la casa.
 */

export type Tema = 'claro' | 'oscuro';

export const CLAVE_TEMA = 'caos-ordenado:tema';

/**
 * El guion que se mete en el `<head>` y corre antes de pintar.
 *
 * Sin él hay **destello**: el HTML llega en oscuro, el navegador lo pinta, y al
 * arrancar React se cambia a claro. Para quien eligió claro eso es una pantalla
 * negra de un cuarto de segundo en cada carga.
 *
 * Va como cadena y no como módulo porque tiene que ejecutarse antes de que cargue
 * ningún JavaScript. Es corto a propósito: leer, escribir un atributo y callarse.
 */
export const GUION_TEMA = `(function(){try{if(localStorage.getItem('${CLAVE_TEMA}')==='claro'){document.documentElement.setAttribute('data-tema','claro')}}catch(e){}})()`;

let oyentes = new Set<() => void>();

/** El que hay puesto. Sin nada guardado, el de la casa. */
export function temaElegido(): Tema {
  if (typeof localStorage === 'undefined') {
    return 'oscuro';
  }
  try {
    return localStorage.getItem(CLAVE_TEMA) === 'claro' ? 'claro' : 'oscuro';
  } catch {
    return 'oscuro';
  }
}

/** En el servidor no hay preferencia guardada que leer: se pinta el de la casa. */
export function temaEnServidor(): Tema {
  return 'oscuro';
}

export function suscribirseAlTema(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes = new Set([...oyentes].filter((otro) => otro !== oyente));
  };
}

export function elegirTema(tema: Tema): void {
  try {
    if (tema === 'oscuro') {
      // Se borra, no se escribe «oscuro»: lo de la casa es la ausencia de
      // preferencia, y así el día que cambie el tema base cambia para todos.
      localStorage.removeItem(CLAVE_TEMA);
    } else {
      localStorage.setItem(CLAVE_TEMA, tema);
    }
  } catch {
    // Sin permiso para guardar se cambia igual, solo que no se recuerda.
  }

  if (typeof document !== 'undefined') {
    if (tema === 'oscuro') {
      document.documentElement.removeAttribute('data-tema');
    } else {
      document.documentElement.setAttribute('data-tema', 'claro');
    }
  }

  for (const oyente of oyentes) {
    oyente();
  }
}
