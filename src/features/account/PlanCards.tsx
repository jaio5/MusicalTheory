'use client';

import Link from 'next/link';

import {
  can,
  dailyAiRequests,
  gastoDeUnaSalida,
  monthlyAiRequests,
  PAID_PLANS,
  planOf,
  priceLabel,
  type Capability,
  type Plan,
  type PlanId,
} from '@core/billing';
import { useAccount } from '@state/account';
import { estiloBoton } from '@ui/Button';

/**
 * Los tres planes de pago, uno al lado del otro.
 *
 * Solo los de pago: el plan gratis no es una opción que se elija, es lo que
 * tienes, y ponerlo aquí como una cuarta columna haría que la decisión pareciera
 * de cuatro cuando es de tres. Lo que hay sin pagar se cuenta aparte, en prosa.
 *
 * Lo que enseña cada tarjeta sale de la tabla de permisos, no de una lista escrita
 * a mano: si mañana Medio deja de incluir el repaso, esto lo dice sin que nadie se
 * acuerde de venir a cambiarlo. Una tabla de precios que miente es peor que no
 * tenerla, y la forma de que mienta es escribirla dos veces.
 *
 * Y no se paga desde aquí: cada tarjeta lleva a su ventana. Un botón que cobra
 * dentro de una lista de tres se pulsa por error.
 */

/**
 * Cómo se llama cada permiso en la pantalla, y en qué orden se leen.
 *
 * **La misma lista, en el mismo orden, en las tres tarjetas**, con ✓ o — en cada
 * fila. Cada plan ponía lo suyo delante y lo que no tenía se iba al final, así
 * que la misma prestación caía en una fila distinta según la tarjeta y para
 * compararlas había que leerlas enteras una por una. Con la fila fija, comparar es
 * mirar en horizontal.
 *
 * **De lo que todos tienen a lo que solo tiene Pro**: los ✓ se agrupan arriba y
 * los — abajo, así que ninguna tarjeta empieza por lo que no tiene —Básico llegó
 * a abrir con tres líneas tachadas— y cada plan se lee como lo que añade al
 * anterior.
 *
 * Y están todas. Faltaron un tiempo **guardar tus canciones** y **las salidas de
 * lo que tocas**, que son justo lo que prometen dos de los reclamos: una tarjeta
 * que no enseña su propia razón de ser no se entiende. Las salidas van antes que
 * el profesor que sabe por dónde vas porque entran un plan antes, en Medio
 * (adr/0066).
 */
export const ETIQUETAS: ReadonlyArray<{ capability: Capability; label: string }> = [
  { capability: 'profesor', label: 'Preguntar al profesor' },
  { capability: 'sincronizar', label: 'El avance guardado en tu cuenta' },
  { capability: 'canciones', label: 'Guardar tus canciones en la cuenta' },
  { capability: 'repaso', label: 'El repaso de lo que fallaste' },
  { capability: 'grado-profesional', label: 'Los seis cursos del Grado Profesional' },
  { capability: 'versiones', label: 'Salidas de lo que tocas' },
  { capability: 'profesor-con-progreso', label: 'Un profesor que sabe por dónde vas' },
];

/**
 * El que se recomienda, y **por lo que hace y no por lo que elige la gente**.
 *
 * Es Medio porque es donde entra la IA que propone mientras compones —las salidas,
 * por dónde puede seguir lo que llevas—, que es la mitad del nombre de esta
 * aplicación: con Básico se aprende y se guarda, y a
 * partir de Medio la aplicación **te contesta mientras escribes**.
 *
 * No dice «el más elegido» ni «el más popular» a propósito: **no se ha vendido
 * ni uno**, así que sería inventarse un dato. Los documentos de este proyecto
 * hablan solo de lo que se puede comprobar, y la pantalla también.
 */
const RECOMENDADO: PlanId = 'medio';

export function PlanCards() {
  const { account } = useAccount();
  const tuyo = planOf(account.plan).id;

  return (
    // El `pt-3` es el sitio del sello del recomendado, que monta sobre el borde
    // de arriba de su tarjeta y se saldría de la lista sin él.
    <ul className="grid gap-4 pt-3 md:grid-cols-3">
      {PAID_PLANS.map((plan, i) => (
        <li key={plan.id}>
          <PlanCard
            plan={plan}
            // El plan de debajo, para saber qué añade éste: el primero de pago mira
            // al gratis, que es lo que se tiene sin pagar.
            anterior={PAID_PLANS[i - 1] ?? planOf('gratis')}
            current={tuyo === plan.id}
            recomendado={plan.id === RECOMENDADO}
            // Quien ya paga ya eligió: encender otra tarjeta además de la suya
            // pondría dos encendidas, y la que manda es la que tiene.
            destacada={tuyo === plan.id || (plan.id === RECOMENDADO && tuyo === 'gratis')}
            model={account.aiModel}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * «4,99 € al mes» partido en la cifra y lo demás.
 *
 * La monoespaciada es para lo que se compara en columna, y en un precio eso es
 * la cifra: «al mes» es una frase y va en la de leer
 * ([adr/0024](../../../docs/adr/0024-la-interfaz-se-lee-primero.md)). Se parte
 * aquí y no en el dominio porque `priceLabel` es la forma única de escribir un
 * precio, y partirla allí sería tener dos.
 */
function partirPrecio(precio: string): { cifra: string; resto: string } {
  const cifra = precio.replace(/ al mes$/, '');
  return { cifra, resto: precio.slice(cifra.length) };
}

function PlanCard({
  plan,
  anterior,
  current,
  recomendado,
  destacada,
  model,
}: {
  readonly plan: Plan;
  /** Lo que había un escalón por debajo. */
  readonly anterior: Plan;
  readonly current: boolean;
  /** Si es el que la pantalla recomienda. */
  readonly recomendado: boolean;
  /** Si va encendida: la tuya, o la recomendada si todavía no pagas ninguna. */
  readonly destacada: boolean;
  /** El modelo que hay puesto: de su precio sale el cupo que se enseña. */
  readonly model: string;
}) {
  const { cifra, resto } = partirPrecio(priceLabel(plan.id));

  return (
    <article
      aria-labelledby={`plan-${plan.id}`}
      aria-current={current}
      className={`relative flex h-full flex-col p-5 ${destacada ? 'superficie-viva' : 'superficie'}`}
    >
      {/* **El sello monta sobre el borde y no ocupa sitio.** Antes era un rótulo
          de doce píxeles en mono encima del nombre, y para que los tres nombres
          quedaran a la misma altura las otras dos tarjetas reservaban su hueco
          vacío: una franja de cuarenta píxeles sin nada en dos de cada tres. Fuera
          del flujo, las tres cabeceras empiezan en el mismo sitio sin reservar
          nada, y el recomendado se ve por la tarjeta encendida y el botón lleno,
          no por un rótulo que había que leer. */}
      {recomendado && (
        <p className="bg-brass text-background absolute -top-3 left-5 rounded-full px-3 py-0.5 text-xs font-medium">
          El que recomendamos
        </p>
      )}
      <header>
        <h3
          id={`plan-${plan.id}`}
          className={`text-xl ${current ? 'text-brass-bright' : 'text-text'}`}
        >
          {plan.name}
        </h3>
        <p className="text-text mt-1 text-lg">
          <span className="font-mono">{cifra}</span>
          {resto}
        </p>
        <p className="text-text-muted mt-2 text-sm">{plan.claim}</p>
      </header>

      <ul className="mt-4 flex flex-col gap-1">
        {ETIQUETAS.map(({ capability, label }) => {
          const incluido = can(plan.id, capability);
          // Lo que añade respecto al plan de debajo: es lo que se paga de más.
          const nuevo = incluido && !can(anterior.id, capability);
          return (
            <li
              key={capability}
              className={`grid grid-cols-[1rem_minmax(0,1fr)_2.5rem] items-baseline gap-2 text-sm ${
                incluido ? 'text-text' : 'text-text-muted'
              }`}
            >
              <span aria-hidden="true" className={incluido ? 'text-tube-bright' : ''}>
                {incluido ? '✓' : '—'}
              </span>
              {/* El símbolo no se lee, así que lo dice el texto: el tachado y la
                  raya los ve quien mira, y el lector de pantalla leía la
                  capacidad igual en las tres tarjetas. */}
              <span>
                <span className="sr-only">{incluido ? 'Incluye: ' : 'No incluye: '}</span>
                {label}
              </span>
              {/* La columna de «nuevo» existe en todas las filas, esté o no: con
                  la etiqueta dentro del renglón, la fila que la lleva partía el
                  texto en otro sitio y dejaba de caer a la altura de las otras. */}
              <span className="text-brass-bright text-xs font-medium">{nuevo ? 'nuevo' : ''}</span>
            </li>
          );
        })}
        {/* El cupo no está escrito en la tabla de planes: se calcula desde el
            precio del plan y el del modelo. Así el número que se promete aquí es
            exactamente el dinero que hay para gastar, y no puede separarse de él.
            Se cuenta en preguntas al profesor, y donde hay salidas se dice cuántas
            gasta una: sin eso, el número prometería el triple (adr/0067). */}
        <li className="text-brass-bright mt-2 text-sm">
          <span className="font-mono">{monthlyAiRequests(plan.id, model)}</span> preguntas al
          profesor al mes
          <span className="text-text-muted block text-xs">
            hasta <span className="font-mono">{dailyAiRequests(plan.id, model)}</span> en un mismo
            día
            {can(plan.id, 'versiones') && <>; {gastoDeUnaSalida(model)}</>}
          </span>
        </li>
      </ul>

      {/* `mt-auto`: empuja el pie hasta abajo para que los tres botones queden a
          la misma altura aunque una tarjeta tenga menos que contar. */}
      <div className="mt-auto pt-4">
        {current ? (
          <p className="text-brass-bright text-sm font-medium">Es el que tienes</p>
        ) : (
          <>
            {recomendado && (
              <p className="text-text-muted mb-2 text-xs">
                Es donde entra la IA que propone mientras compones.
              </p>
            )}
            {/* Uno lleno y dos en contorno. Tres botones de latón iguales decían
                que las tres opciones pesan lo mismo, y la pantalla recomienda una. */}
            <Link
              href={`/planes/${plan.id}`}
              className={estiloBoton(recomendado ? 'primary' : 'quiet', 'w-full')}
            >
              Elegir {plan.name}
            </Link>
          </>
        )}
      </div>
    </article>
  );
}
