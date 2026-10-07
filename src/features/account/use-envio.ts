'use client';

import { useState } from 'react';

/**
 * El sobre de un formulario de la cuenta: en marcha, lo que falló y si salió.
 *
 * **Estaba escrito en seis formularios**, siempre igual: tres `useState`, poner
 * «en marcha», limpiar el resultado anterior y quitarlo en un `finally`. Seis
 * copias de un `finally` son seis sitios donde olvidarse de él y dejar un botón
 * apagado para siempre después de un error.
 *
 * No decide qué es un fallo: la acción pone `error` o `hecho` según lo que le
 * haya pasado, y hay un caso donde pone **los dos** —cambiar la contraseña sí
 * funcionó, pero volver a entrar con ella no—. Un sobre que los hiciera
 * excluyentes obligaría a mentir justo ahí.
 */
export function useEnvio() {
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);
  const [working, setWorking] = useState(false);

  /** Corre la acción con «en marcha» puesto, y borra el resultado anterior. */
  async function enviar(accion: () => Promise<void>): Promise<void> {
    setError(null);
    setHecho(false);
    setWorking(true);
    try {
      await accion();
    } finally {
      setWorking(false);
    }
  }

  return { error, setError, hecho, setHecho, working, enviar };
}
