/**
 * Los planes y qué abre cada uno: dos de pago —Básico y Medio— y el que tiene
 * quien no paga. Hubo un tercero, Pro, y se fundió en Medio (adr/0104).
 *
 * Es dominio puro: aquí no hay pasarela de pago, ni base de datos, ni sesión.
 * Solo la tabla de qué incluye cada plan, que es la única pregunta que hacen
 * tanto el navegador —para enseñar un candado— como el servidor —para no gastar
 * dinero de más—. Las dos preguntan a la misma función, que es lo que evita que
 * la interfaz diga que sí y la ruta diga que no.
 *
 * Lo que se cobra es lo que **cuesta dinero al servir**: cada pregunta al
 * profesor y cada tanda de salidas son una llamada al modelo. Todo lo que
 * ocurre en el navegador —afinador, rueda, mástil, metrónomo, acordes,
 * grabación— es gratis en todos los planes y lo seguirá siendo, porque servirlo
 * no cuesta nada.
 */

/** El identificador que se guarda en la base de datos. */
export type PlanId = 'gratis' | 'basico' | 'medio';

/**
 * Lo que un plan deja hacer.
 *
 * Son permisos, no pantallas: `profesor` no es «la columna de la derecha», es
 * «preguntarle algo al modelo». Así una pantalla puede enseñarse entera con la
 * parte de IA apagada, en vez de desaparecer y dejar un hueco sin explicación.
 */
export type Capability =
  /** Preguntarle al profesor. Cada pregunta es una llamada al modelo. */
  | 'profesor'
  /** Los seis cursos del Grado Profesional. */
  | 'grado-profesional'
  /** El avance viaja entre aparatos en vez de quedarse en este navegador. */
  | 'sincronizar'
  /** El repaso de lo que se falló, que necesita guardar pregunta por pregunta. */
  | 'repaso'
  /** Guardar tus canciones en la cuenta en vez de en este navegador. */
  | 'canciones'
  /**
   * Pedirle a la IA salidas de tu canción —por dónde puede seguir—. Se llama
   * `versiones` por el nombre que tuvo (adr/0016). Cada tanda es una llamada al
   * modelo.
   */
  | 'versiones'
  /** El profesor sabe qué unidades llevas hechas antes de contestar. */
  | 'profesor-con-progreso';

export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  /** Para quién es, en una frase. Se enseña en el selector. */
  readonly claim: string;
  /**
   * Al mes y en céntimos. En céntimos y no en euros con decimales porque 4,99
   * no se puede representar en binario y sumar precios en coma flotante acaba
   * en 14,969999999999999.
   */
  readonly monthlyCents: number;
  /**
   * Al año y en céntimos: **diez meses**, dos gratis (adr/0106). Se calcula desde
   * el mensual (`MESES_QUE_SE_PAGAN_AL_AÑO`) y no se escribe, para que el
   * «dos meses gratis» de la pantalla no pueda dejar de ser verdad.
   */
  readonly annualCents: number;
  readonly capabilities: readonly Capability[];
}

/**
 * Cada cuánto se paga. El plan y lo que abre son los mismos; cambia el precio.
 *
 * El cupo tampoco cambia: se calcula con el que menos deja al mes, que es el
 * anual (`core/billing/cost.ts`, `ingresoMensualNetoMicros`).
 */
export type Periodo = 'mensual' | 'anual';

export const PERIODOS: readonly Periodo[] = ['mensual', 'anual'];

/**
 * Cuántos meses se pagan en un año: diez, o sea **dos meses gratis**.
 *
 * Dos y no uno porque es lo que se reconoce sin hacer cuentas —«dos meses
 * gratis» se entiende; «un 8 % menos», no— y porque el anual se paga una vez y
 * lleva una sola comisión fija en vez de doce. Aun así deja menos al mes —en
 * Básico, 3,06 € limpios frente a 3,44 pagando al mes—, y **el cupo de todos se
 * calcula con el anual** (adr/0106): tres meses gratis bajarían el cupo también
 * a quien paga al mes.
 */
export const MESES_QUE_SE_PAGAN_AL_AÑO = 10;

/** Los que no se pagan: lo que la pantalla llama «meses gratis». */
export const MESES_GRATIS_AL_AÑO = 12 - MESES_QUE_SE_PAGAN_AL_AÑO;

/** Un plan con su precio anual puesto desde el mensual. */
function conAnual(plan: Omit<Plan, 'annualCents'>): Plan {
  return { ...plan, annualCents: plan.monthlyCents * MESES_QUE_SE_PAGAN_AL_AÑO };
}

/**
 * Los cupos de IA **no están aquí**, y esa ausencia es la corrección más
 * importante de este fichero.
 *
 * Estuvieron escritos a mano —cuarenta al día, ciento veinte, cuatrocientas— y
 * nadie los había multiplicado por treinta días ni por el precio del modelo:
 * cuarenta al día con Opus 5 son unos veintiséis euros de coste al mes para un
 * plan de 4,99 €. Ahora se calculan desde el precio en `cost.ts`, que es el único
 * sitio donde el número prometido y el dinero disponible no pueden separarse.
 */

/**
 * En orden de precio, que es el orden en el que se enseñan y también el que usa
 * `cheapestPlanWith` para proponer el más barato que sirva.
 *
 * Tres entradas y **dos planes de pago**. El primero no se vende: es lo que tiene
 * quien no ha pagado, y está en la lista porque la pregunta «¿puede este
 * preguntarle al profesor?» hay que poder hacerla también de él. La pantalla de
 * planes enseña los de pago y cuenta aparte lo que hay sin pagar.
 *
 * Cada plan de pago tiene **una cosa que el anterior no**, y eso es a propósito:
 * un escalón que solo suba el cupo no se entiende, y quien lo mira tiene que
 * poder decir en una frase por qué pagaría el siguiente. Por eso, al retirarse las
 * ideas, las salidas bajaron de Pro a Medio (adr/0066), y por eso **Pro se fundió
 * en Medio** (adr/0104): lo único que añadía —un profesor que sabe por dónde vas—
 * no cuesta casi nada servirlo, y pedir el doble por eso era más caro que
 * Yousician con menos que lo justificara.
 */
export const PLANS: readonly Plan[] = [
  conAnual({
    id: 'gratis',
    name: 'Gratis',
    claim: 'La guitarra entera, el Grado Elemental y unas preguntas para probar el profesor.',
    monthlyCents: 0,
    capabilities: ['profesor'],
  }),
  conAnual({
    id: 'basico',
    name: 'Básico',
    claim: 'Los diez cursos, el repaso de lo que fallas y tus canciones guardadas en la cuenta.',
    monthlyCents: 499,
    capabilities: ['profesor', 'grado-profesional', 'sincronizar', 'repaso', 'canciones'],
  }),
  conAnual({
    id: 'medio',
    name: 'Medio',
    claim:
      'Lo de Básico, las salidas de la IA mientras compones y un profesor que sabe por dónde vas.',
    monthlyCents: 999,
    capabilities: [
      'profesor',
      'grado-profesional',
      'sincronizar',
      'repaso',
      'canciones',
      'versiones',
      'profesor-con-progreso',
    ],
  }),
];

/** El plan de quien no ha entrado, y el que se supone cuando algo no cuadra. */
export const DEFAULT_PLAN: PlanId = 'gratis';

/** Los que se pueden pagar, que son los que enseña la pantalla de planes. */
export const PAID_PLANS: readonly Plan[] = PLANS.filter((plan) => plan.monthlyCents > 0);

/**
 * Nombres viejos que siguen valiendo.
 *
 * Los dos planes de pago se llamaron Estudiante y Conservatorio antes de ser tres,
 * y el tercero, Pro, se fundió en Medio (adr/0104). Sin esta tabla, una fila con
 * `pro` dentro caería al plan gratis y le cerraría la puerta a alguien que había
 * pagado, en silencio y sin que nadie se enterase hasta que se quejara. Un
 * renombrado no puede degradar a nadie, y no degrada: **Medio trae todo lo que
 * traía Pro**, así que quien lo tenía no pierde nada.
 *
 * Se queda aquí hasta que no exista ninguna fila con esos valores; entonces se
 * borra, no antes.
 */
const ALIAS: Readonly<Record<string, PlanId>> = {
  estudiante: 'basico',
  conservatorio: 'medio',
  pro: 'medio',
};

/**
 * El plan que corresponde a lo guardado.
 *
 * Nunca devuelve nulo a propósito: lo que llega de la base de datos puede ser
 * un plan retirado o una cadena a medio migrar, y en ese caso lo seguro es
 * tratarlo como gratis. Fallar abierto aquí sería regalar llamadas al modelo.
 */
export function planOf(id: unknown): Plan {
  const wanted = typeof id === 'string' ? (ALIAS[id] ?? id) : id;
  const found = PLANS.find((plan) => plan.id === wanted);
  return found ?? PLANS.find((plan) => plan.id === DEFAULT_PLAN)!;
}

export function can(id: unknown, capability: Capability): boolean {
  return planOf(id).capabilities.includes(capability);
}

/** Cuántas llamadas quedan de un cupo. Nunca menos de cero. */
export function remaining(quota: number, used: number): number {
  const gastadas = Number.isFinite(used) ? Math.max(0, Math.floor(used)) : 0;
  return Math.max(0, quota - gastadas);
}

/**
 * El plan más barato que incluye ese permiso, o nulo si no lo incluye ninguno.
 *
 * Es lo que hace que el candado diga «esto entra en el plan Medio: 9,99 € al mes»
 * en vez de «no tienes permiso»: un candado que no dice cómo se abre es una pared.
 */
export function cheapestPlanWith(capability: Capability): Plan | null {
  return PLANS.find((plan) => plan.capabilities.includes(capability)) ?? null;
}

/** Lo que cuesta un plan en ese periodo, en céntimos. */
export function priceCents(id: unknown, periodo: Periodo = 'mensual'): number {
  const plan = planOf(id);
  return periodo === 'anual' ? plan.annualCents : plan.monthlyCents;
}

/**
 * El precio como se escribe en español: coma decimal y el símbolo detrás, y el
 * periodo: «4,99 € al mes», «49,90 € al año».
 *
 * Vive en el dominio y no en la interfaz porque si no, cada pantalla se
 * inventa su formato y acaban conviviendo «4.99€» y «4,99 €» en la misma
 * página.
 */
export function priceLabel(id: unknown, periodo: Periodo = 'mensual'): string {
  const cents = priceCents(id, periodo);
  if (cents === 0) {
    return 'Gratis';
  }
  const euros = Math.floor(cents / 100);
  const rest = `${cents % 100}`.padStart(2, '0');
  return `${euros},${rest} € ${periodo === 'anual' ? 'al año' : 'al mes'}`;
}

/**
 * Cuántos días se conserva el plan con el cobro fallando (`past_due` en Stripe).
 *
 * **Siete.** Stripe reintenta el cobro durante días y su guía pide avisar a quien
 * paga, no cortarle en el primer fallo, que casi siempre es una tarjeta caducada.
 * Pero `past_due` conservaba el plan **sin plazo**: si la cuenta de Stripe no
 * estaba configurada para acabar en `unpaid` o `canceled`, una tarjeta muerta
 * seguía dando el plan —y su cupo de IA— para siempre. Una semana deja tiempo a
 * los reintentos de Stripe y a cambiar la tarjeta, y acota lo que se regala a una
 * cuarta parte del mes: con el 40 % del ingreso neto como tope de modelo, no se
 * pierde dinero ni gastándolo entero (adr/0114).
 */
export const DIAS_DE_GRACIA = 7;

/**
 * El plan que vale **hoy**: el guardado, salvo que el cobro lleve fallando más
 * de `DIAS_DE_GRACIA`, y entonces gratis.
 *
 * Se decide al leer y no con una tarea programada: no hay ninguna que desplegar ni
 * vigilar, y el plan vuelve solo en cuanto Stripe avisa de que se ha cobrado.
 */
export function planEnVigor(
  guardado: unknown,
  impagadaDesde: Date | null,
  ahora: Date = new Date(),
): PlanId {
  const plan = planOf(guardado).id;
  if (impagadaDesde === null) {
    return plan;
  }
  const plazo = impagadaDesde.getTime() + DIAS_DE_GRACIA * 24 * 60 * 60 * 1000;
  return ahora.getTime() > plazo ? DEFAULT_PLAN : plan;
}
