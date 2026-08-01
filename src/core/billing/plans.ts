/**
 * Los planes y qué abre cada uno: tres de pago —Básico, Medio y Pro— y el que
 * tiene quien no paga.
 *
 * Es dominio puro: aquí no hay pasarela de pago, ni base de datos, ni sesión.
 * Solo la tabla de qué incluye cada plan, que es la única pregunta que hacen
 * tanto el navegador —para enseñar un candado— como el servidor —para no gastar
 * dinero de más—. Las dos preguntan a la misma función, que es lo que evita que
 * la interfaz diga que sí y la ruta diga que no.
 *
 * Lo que se cobra es lo que **cuesta dinero al servir**: cada pregunta al
 * profesor y cada idea de progresión son una llamada al modelo. Todo lo que
 * ocurre en el navegador —afinador, rueda, mástil, metrónomo, acordes,
 * grabación— es gratis en todos los planes y lo seguirá siendo, porque servirlo
 * no cuesta nada.
 */

/** El identificador que se guarda en la base de datos. */
export type PlanId = 'gratis' | 'basico' | 'medio' | 'pro';

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
  /** Pedir ideas de progresión. Cada idea es una llamada al modelo. */
  | 'ideas'
  /** Los seis cursos del Grado Profesional. */
  | 'grado-profesional'
  /** El avance viaja entre aparatos en vez de quedarse en este navegador. */
  | 'sincronizar'
  /** El repaso de lo que se falló, que necesita guardar pregunta por pregunta. */
  | 'repaso'
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
  readonly capabilities: readonly Capability[];
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
 * Cuatro entradas y **tres planes de pago**. El primero no se vende: es lo que
 * tiene quien no ha pagado, y está en la lista porque la pregunta «¿puede este
 * pedir una idea?» hay que poder hacerla también de él. La pantalla de planes
 * enseña los tres de pago y cuenta aparte lo que hay sin pagar.
 *
 * Cada plan de pago tiene **una cosa que el anterior no**, y eso es a propósito:
 * un escalón que solo suba el cupo no se entiende, y quien lo mira tiene que
 * poder decir en una frase por qué pagaría el siguiente.
 */
export const PLANS: readonly Plan[] = [
  {
    id: 'gratis',
    name: 'Gratis',
    claim: 'La guitarra entera, el Grado Elemental y unas preguntas para probar el profesor.',
    monthlyCents: 0,
    capabilities: ['profesor'],
  },
  {
    id: 'basico',
    name: 'Básico',
    claim: 'Los diez cursos, el repaso de lo que fallas y el avance guardado en tu cuenta.',
    monthlyCents: 499,
    capabilities: ['profesor', 'grado-profesional', 'sincronizar', 'repaso'],
  },
  {
    id: 'medio',
    name: 'Medio',
    claim: 'Lo de Básico y las ideas de progresión de la IA mientras compones.',
    monthlyCents: 999,
    capabilities: ['profesor', 'ideas', 'grado-profesional', 'sincronizar', 'repaso'],
  },
  {
    id: 'pro',
    name: 'Pro',
    claim: 'Lo de Medio, con un profesor que ya sabe por dónde vas y el cupo más alto.',
    monthlyCents: 1999,
    capabilities: [
      'profesor',
      'ideas',
      'grado-profesional',
      'sincronizar',
      'repaso',
      'profesor-con-progreso',
    ],
  },
];

/** El plan de quien no ha entrado, y el que se supone cuando algo no cuadra. */
export const DEFAULT_PLAN: PlanId = 'gratis';

/** Los que se pueden pagar, que son los que enseña la pantalla de planes. */
export const PAID_PLANS: readonly Plan[] = PLANS.filter((plan) => plan.monthlyCents > 0);

/**
 * Nombres viejos que siguen valiendo.
 *
 * Los dos planes de pago se llamaron Estudiante y Conservatorio antes de ser tres.
 * Sin esta tabla, una fila con `estudiante` dentro caería al plan gratis y le
 * cerraría la puerta a alguien que había pagado, en silencio y sin que nadie se
 * enterase hasta que se quejara. Un renombrado no puede degradar a nadie.
 *
 * Se queda aquí hasta que no exista ninguna fila con esos valores; entonces se
 * borra, no antes.
 */
const ALIAS: Readonly<Record<string, PlanId>> = {
  estudiante: 'basico',
  conservatorio: 'pro',
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

/**
 * El precio como se escribe en español: coma decimal y el símbolo detrás.
 *
 * Vive en el dominio y no en la interfaz porque si no, cada pantalla se
 * inventa su formato y acaban conviviendo «4.99€» y «4,99 €» en la misma
 * página.
 */
export function priceLabel(id: unknown): string {
  const cents = planOf(id).monthlyCents;
  if (cents === 0) {
    return 'Gratis';
  }
  const euros = Math.floor(cents / 100);
  const rest = `${cents % 100}`.padStart(2, '0');
  return `${euros},${rest} € al mes`;
}
