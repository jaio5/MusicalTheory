'use client';

import { signIn, signOut } from 'next-auth/react';
import { createContext, createElement, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  ANONYMOUS,
  DEFAULT_AI_MODEL,
  isSignedIn,
  planOf,
  type Account,
  type PlanId,
} from '@core/billing';

/**
 * La cuenta, para el navegador.
 *
 * Aquí es donde vive `next-auth/react`, y en ningún otro sitio. Un `feature` que
 * importase la librería de sesión quedaría atado a ella; importando esto queda
 * atado a `useAccount`, que es tres funciones y un objeto.
 *
 * La cuenta **llega ya resuelta desde el servidor**, por el layout, y no se pide
 * con un `fetch` al montar. Así no hay un primer fotograma en el que todo parece
 * gratis y bloqueado y luego se abre solo, que es exactamente el parpadeo que el
 * avance en `localStorage` evita en la pantalla de aprender.
 *
 * `refresh` vuelve a pedirla cuando algo la ha podido cambiar: cambiar de plan, o
 * gastar una pregunta del cupo.
 */

export interface AccountState {
  readonly account: Account;
  /** Si esta copia de la aplicación tiene cuentas configuradas. */
  readonly accounts: boolean;
  readonly signedIn: boolean;
  readonly planName: string;
  readonly refresh: () => Promise<void>;
}

const AccountContext = createContext<AccountState | null>(null);

/**
 * Lo que el layout pone alrededor de la aplicación.
 *
 * No es JSX porque este fichero es `.ts` y no `.tsx`: `state/` es la capa de
 * estado y no la de componentes. `createElement` a pelo para un proveedor sin
 * marcado propio es más honesto que convertir el fichero en un componente.
 */
export function AccountProvider({
  account,
  accounts,
  children,
}: {
  readonly account: Account;
  readonly accounts: boolean;
  readonly children: ReactNode;
}) {
  const [current, setCurrent] = useState(account);

  // Si el servidor vuelve a pintar con otra cuenta —al entrar, al salir, al
  // cambiar de plan— gana la del servidor. Se compara durante el render, que es
  // lo que React recomienda para esto, igual que hace LearnPanel al cambiar de
  // escala.
  const [tracked, setTracked] = useState(account);
  if (tracked !== account) {
    setTracked(account);
    setCurrent(account);
  }

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/cuenta', { cache: 'no-store' });
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as { account?: unknown };
      setCurrent(readAccount(body.account));
    } catch {
      // Sin red se queda lo que había, que es más útil que vaciar la pantalla.
    }
  }, []);

  const value = useMemo<AccountState>(
    () => ({
      account: current,
      accounts,
      signedIn: isSignedIn(current),
      planName: planOf(current.plan).name,
      refresh,
    }),
    [current, accounts, refresh],
  );

  return createElement(AccountContext.Provider, { value }, children);
}

/**
 * La cuenta de quien está mirando.
 *
 * Fuera del proveedor devuelve la anónima en vez de reventar: así un componente
 * se puede probar suelto sin montar medio árbol, y una pantalla mal envuelta
 * enseña candados en vez de una pantalla en blanco.
 */
export function useAccount(): AccountState {
  const state = useContext(AccountContext);
  return (
    state ?? {
      account: ANONYMOUS,
      accounts: false,
      signedIn: false,
      planName: planOf(ANONYMOUS.plan).name,
      refresh: async () => {},
    }
  );
}

/** Interpreta lo que contesta `/api/cuenta`. Lo que no encaje es anónimo. */
function readAccount(raw: unknown): Account {
  if (typeof raw !== 'object' || raw === null) {
    return ANONYMOUS;
  }
  const record = raw as Record<string, unknown>;
  const email = typeof record['email'] === 'string' ? record['email'] : null;
  const model = record['aiModel'];
  return {
    email,
    plan: planOf(record['plan']).id,
    aiModel: typeof model === 'string' && model !== '' ? model : DEFAULT_AI_MODEL,
    aiLeftToday: asCount(record['aiLeftToday']),
    aiLeftMonth: asCount(record['aiLeftMonth']),
  };
}

/** Un contador que llega del servidor, o nulo si no viene o no es un número. */
function asCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : null;
}

export type SignInResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * Entrar con correo y contraseña.
 *
 * `redirect: false` porque la pantalla ya sabe qué hacer después y una recarga
 * completa perdería la tonalidad detectada y el micro abierto. El mensaje de
 * error no distingue si el correo existe: eso convertiría la pantalla de entrar
 * en un buscador de cuentas.
 */
export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  try {
    const result = await signIn('credentials', { email, password, redirect: false });
    if (result?.error !== undefined && result.error !== null) {
      return { ok: false, message: 'El correo o la contraseña no son correctos.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'No hemos podido entrar. Vuelve a intentarlo en un minuto.' };
  }
}

export interface RegisterResult {
  readonly ok: boolean;
  readonly message?: string;
}

/** Crear la cuenta y entrar con ella, que es lo que espera quien se registra. */
export async function registerAccount(
  email: string,
  password: string,
  name?: string,
): Promise<RegisterResult> {
  try {
    const response = await fetch('/api/cuenta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ...(name === undefined ? {} : { name }) }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      return {
        ok: false,
        message: body?.error?.message ?? 'No hemos podido crear la cuenta.',
      };
    }

    const entered = await signInWithPassword(email, password);
    return entered.ok
      ? { ok: true }
      : {
          ok: false,
          message: 'La cuenta está creada, pero no hemos podido entrar. Prueba a entrar.',
        };
  } catch {
    return { ok: false, message: 'No hemos podido crear la cuenta. Vuelve a intentarlo.' };
  }
}

export async function signOutHere(): Promise<void> {
  await signOut({ redirect: false });
}

export type ChangePlanResult =
  | { readonly kind: 'listo'; readonly plan: PlanId }
  | { readonly kind: 'ir-a-pagar'; readonly url: string }
  | { readonly kind: 'error'; readonly message: string };

/**
 * Pedir un plan.
 *
 * Contempla ya la respuesta «vete a pagar a otro sitio» aunque el cobrador de
 * hoy no la use nunca: es la forma que tendrá cuando haya Stripe, y dejarla
 * escrita ahora cuesta cuatro líneas y evita tocar esta función entonces.
 */
export async function changePlan(plan: PlanId): Promise<ChangePlanResult> {
  try {
    const response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok) {
      const error = body?.['error'] as { message?: string } | undefined;
      return { kind: 'error', message: error?.message ?? 'No hemos podido cambiar el plan.' };
    }
    if (body?.['kind'] === 'ir-a-pagar' && typeof body['url'] === 'string') {
      return { kind: 'ir-a-pagar', url: body['url'] };
    }
    return { kind: 'listo', plan: planOf(body?.['plan']).id };
  } catch {
    return { kind: 'error', message: 'No hemos podido cambiar el plan. Vuelve a intentarlo.' };
  }
}
