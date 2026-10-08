'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

import { noteName } from '@core/music';
import { useAccount } from '@state/account';
import { selectActiveKey, selectEscala, useSessionStore } from '@state/session-store';
import { Button, estiloBoton } from '@ui/Button';
import { Chip } from '@ui/Chip';
import { CuatroTonalidades } from '@ui/EmpezarPorTonalidad';
import { PlansLink, seArreglaConPlan } from '@ui/PlansLink';
import { Aviso } from '@ui/Aviso';
import { TextField } from '@ui/TextField';

import {
  MAX_QUESTION_LENGTH,
  TEACHER_ERROR_MESSAGES,
  type TeacherAnswer,
  type TeacherErrorCode,
} from './teacher-contract';
import { useEnLinea } from './use-en-linea';

/**
 * Sin red la pregunta no sale de este aparato, y decirlo como «no hemos podido
 * contactar con el profesor» culpaba al modelo y mandaba a esperar un minuto.
 */
const SIN_CONEXION =
  'Sin conexión: la pregunta no ha salido de este aparato. Pregunta otra vez cuando vuelva la red.';

/**
 * De quién es una respuesta que no ha escrito el modelo, en dos palabras.
 *
 * La frase entera ya viene en la respuesta —el servidor la escribe para que la lea
 * cualquiera—, pero va dentro del párrafo y no se ve de un vistazo. Esto es la
 * marca, como el «Sin IA» de las salidas. **Y depende del motivo**: con el modelo
 * caído no hay nada que reescribir en la pregunta, y la marca no puede sonar a
 * «lo has preguntado mal».
 */
function deQuienEs(answer: TeacherAnswer): string | null {
  if (answer.fuente === undefined) {
    return null;
  }
  if (answer.motivo === 'model_unavailable') {
    return 'Sin conexión con el modelo';
  }
  return answer.fuente === 'glosario' ? 'Del glosario, sin IA' : 'Sin IA';
}

/** Preguntas para empezar, para quien no sabe ni cómo se llama lo que no sabe. */
const OPENERS: readonly string[] = [
  '¿Por qué el V tira tanto hacia el I?',
  '¿Cuándo puedo meter un acorde de fuera de la tonalidad?',
  '¿Qué diferencia hay entre la pentatónica y la escala entera?',
  '¿Cómo sé en qué tono está una canción de oído?',
];

export interface TeacherProps {
  /**
   * La unidad que se está leyendo, por su identificador.
   *
   * El id y no el título: el título lo resuelve el servidor contra el temario, y
   * así este campo deja de ser texto libre entrando a un prompt.
   */
  readonly unitId?: string;
  /**
   * Dentro del globo del muñeco: sin las preguntas de arranque.
   *
   * Ahí ocupan más que el propio formulario y sobran, porque quien abre el
   * muñeco ya sabe lo que quiere preguntar: acaba de leer la lección.
   */
  readonly compact?: boolean;
}

/**
 * El profesor: preguntas de teoría contestadas en la tonalidad en la que estás.
 *
 * Lo que viaja al modelo es la tonalidad, la escala y lo que escribas. El audio
 * no sale del equipo, y esta pantalla no lo toca.
 */
export function Teacher({ unitId, compact = false }: TeacherProps = {}) {
  const { account, accounts, signedIn, refresh } = useAccount();
  const activeKey = useSessionStore(selectActiveKey);
  const scaleId = useSessionStore(selectEscala);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<TeacherAnswer | null>(null);
  // Con su código, no solo la frase: es lo que decide si debajo hay algo que
  // pulsar. Un «no entra en tu plan» se arregla en la pantalla de planes; un
  // modelo caído, esperando.
  const [message, setMessage] = useState<{
    code: TeacherErrorCode | null;
    text: string;
  } | null>(null);
  const [asking, setAsking] = useState(false);
  // Lo que falta solo se marca después de intentarlo: un campo en rojo antes de
  // escribir nada es una regañina. Es el trato de los formularios de la cuenta.
  const [intentado, setIntentado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const enLinea = useEnLinea();

  // Lo único que se marca en el campo es el blanco: sin cuenta o sin tonalidad el
  // campo ni se pinta, y se dice lo que toca en su lugar.
  const falta = question.trim() === '' ? 'Escribe lo que quieres preguntar.' : null;

  /**
   * **«Preguntar» no se apaga por estar el campo en blanco.** Un botón gris no
   * dice por qué: quien no veía la pantalla oía «Preguntar, no disponible» y nada
   * más. Se pulsa siempre, el motivo se dice en el campo —`aria-invalid` y su
   * frase— y el foco va a él, que es como se entera un lector de pantalla. Solo
   * se apaga mientras piensa.
   */
  function enviar(): void {
    setIntentado(true);
    if (falta !== null) {
      campo.current?.focus();
      return;
    }
    void ask(question);
  }

  async function ask(text: string): Promise<void> {
    /* v8 ignore next 3 -- el formulario solo se pinta con cuenta y tonalidad, y `enviar` ya ha parado el campo en blanco */
    if (activeKey === null || text.trim() === '') {
      return;
    }

    setMessage(null);
    setAnswer(null);
    if (!navigator.onLine) {
      setMessage({ code: null, text: SIN_CONEXION });
      return;
    }
    setAsking(true);

    try {
      const response = await fetch('/api/teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: { tonic: noteName(activeKey.tonic), mode: activeKey.mode },
          question: text,
          scale: scaleId,
          ...(unitId === undefined ? {} : { unitId }),
        }),
      });

      // El cupo ha cambiado, se haya contestado o se haya rechazado: la petición
      // se cobra al intentarla. Se vuelve a pedir la cuenta para que el contador
      // de arriba diga la verdad sin recargar la página.
      void refresh();

      const payload: unknown = await response.json();
      if (!response.ok) {
        const error = (payload as { error?: { code?: string; message?: string } }).error;
        const code = typeof error?.code === 'string' ? (error.code as TeacherErrorCode) : null;
        setMessage({
          code,
          text: error?.message ?? TEACHER_ERROR_MESSAGES.model_unavailable,
        });
        return;
      }

      setAnswer(payload as TeacherAnswer);
    } catch {
      // La red se puede ir a mitad de la pregunta: entonces es eso, no el modelo.
      setMessage(
        navigator.onLine
          ? { code: 'model_unavailable', text: TEACHER_ERROR_MESSAGES.model_unavailable }
          : { code: null, text: SIN_CONEXION },
      );
    } finally {
      setAsking(false);
    }
  }

  // **Tres estados y no un formulario con avisos.** Sin cuenta el campo y su
  // botón estaban activos y acababan en un 401: se invitaba a escribir lo que
  // luego no salía. Sin tonalidad era un error en rojo por no haber hecho algo que
  // se resuelve con un toque. Ahora cada falta cambia lo que hay que hacer: entrar,
  // elegir tono o preguntar; el campo solo existe cuando la pregunta puede salir.
  if (!signedIn) {
    return (
      <div className="flex flex-col gap-2">
        {/*
          **Entrar no es la acción de esta pantalla, y sin cuentas no es ninguna.**
          Iba en latón, y en el globo del muñeco salía al lado de «Siguiente»,
          también en latón: dos acciones principales compitiendo, y la segunda
          llevaba a una pantalla que, en una copia sin cuentas, solo decía que no
          las hay. La salida de aquí es la secundaria —`quiet`—, y si no hay
          cuentas configuradas se dice aquí mismo y no hay a dónde mandar.
        */}
        {accounts ? (
          <>
            <p className="text-text-muted text-base">
              El profesor pide cuenta: es lo que permite contar el gasto por persona y no por
              navegador.
            </p>
            <div>
              <Link href="/cuenta" className={estiloBoton('quiet', '', 'compacto')}>
                Entrar para preguntar
              </Link>
            </div>
          </>
        ) : (
          <p className="text-text-muted text-base">
            El profesor todavía no está disponible aquí: contesta una IA, cada pregunta se paga y
            por eso va con cuenta, y aquí aún no se pueden abrir.
          </p>
        )}

        {/* Lo que se podrá preguntar, como vista previa y no como botones: son
            lo único que dice qué clase de cosas se le pueden preguntar, pero
            pulsarlas sin cuenta acabaría en lo mismo que escribir. */}
        {!compact && (
          <ul aria-label="Ejemplos de preguntas" className="grid gap-2 sm:grid-cols-2">
            {OPENERS.map((opener) => (
              <li
                key={opener}
                className="border-border text-text-muted rounded-md border px-3 py-2 text-base"
              >
                {opener}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (activeKey === null) {
    return (
      <CuatroTonalidades>
        Elige una tonalidad y el profesor te contesta con sus acordes:
      </CuatroTonalidades>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Se dice antes de escribir, no después de pulsar: escribir una pregunta
          entera para enterarse de que no va a salir es tiempo tirado. */}
      {!enLinea && (
        <p role="status" className="text-text-muted text-base">
          Sin conexión. El profesor contesta desde el servidor, así que tendrá que esperar a que
          vuelva la red; el camino, componer y afinar siguen funcionando sin ella.
        </p>
      )}
      <form
        // Sin la validación del navegador, como `ui/Formulario`: lo que falta se
        // dice aquí, en español y junto al campo. Va escrito a mano porque este
        // formulario es una fila —el campo y su botón— y aquel, una columna.
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          enviar();
        }}
        className="flex flex-wrap items-start gap-2"
      >
        <TextField
          ref={campo}
          compact
          ancho="crece"
          label="Pregúntale al profesor"
          value={question}
          maxLength={MAX_QUESTION_LENGTH}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Pregunta lo que quieras de teoría"
          {...(intentado && falta !== null ? { error: falta } : {})}
        />
        <Button type="submit" cargando={asking} disabled={asking}>
          {asking ? 'Pensando…' : 'Preguntar'}
        </Button>
      </form>

      {/* El cupo, como un contador y no como una frase: es un número que se mira
          de reojo antes de preguntar otra vez. */}
      {account.aiLeftToday !== null && (
        <p
          className={`font-mono text-xs ${
            account.aiLeftToday === 0 ? 'text-oxblood-bright' : 'text-text-muted'
          }`}
        >
          {account.aiLeftToday === 0
            ? 'Sin preguntas a la IA hoy'
            : `Quedan ${account.aiLeftToday} hoy`}
          {account.aiLeftMonth !== null && (
            <span className="text-text-muted"> · {account.aiLeftMonth} este mes</span>
          )}
        </p>
      )}

      {!compact && answer === null && message === null && !asking && (
        // En rejilla de dos, no en fila que envuelve: las cuatro miden cosas
        // distintas y envueltas salían dos arriba y dos abajo con anchos
        // desiguales, que se lee como una lista rota. En dos columnas iguales se
        // recorren de un vistazo, que es para lo que están.
        <ul className="grid gap-2 sm:grid-cols-2">
          {OPENERS.map((opener) => (
            <li key={opener} className="flex">
              <Chip
                tone="quiet"
                tamano="compacto"
                className="w-full justify-start text-left"
                onClick={() => {
                  setQuestion(opener);
                  void ask(opener);
                }}
              >
                {opener}
              </Chip>
            </li>
          ))}
        </ul>
      )}

      {message !== null && (
        <div role="alert">
          <Aviso mensaje={message.text} anuncio="ninguno" />
          {/* Si lo que falta es plan, la salida está a un clic y en la pantalla
              donde se ve qué trae cada uno. */}
          {seArreglaConPlan(message.code, account.plan) && (
            <PlansLink className="mt-1 inline-block" />
          )}
          {/* Y la salida de este, que es entrar. Va aquí y no arriba porque
              arriba ya no está: es la misma línea, no una segunda. */}
          {message.code === 'account_required' && (
            <Link href="/cuenta" className="enlace mt-1 inline-block text-xs">
              Entrar con tu cuenta
            </Link>
          )}
        </div>
      )}

      {answer !== null && (
        <div className="border-border border-l-2 pl-3">
          {deQuienEs(answer) !== null && (
            <p className="text-text-muted mb-1 text-xs">{deQuienEs(answer)}</p>
          )}
          <p className="text-text text-base">{answer.answer}</p>
          {answer.example !== undefined && (
            <p className="text-text-muted mt-1 text-xs">
              {answer.example.chords.join(' → ')}
              <span className="ml-2">({answer.example.degrees.join(' ')})</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
