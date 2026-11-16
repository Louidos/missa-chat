import { checkConnection, type ConnectionCheck } from './client';
import { ApiError } from './errors';

export type EndpointKind = 'internal' | 'external';

export interface Endpoints {
  external: string;
  internal?: string | null;
}

export interface ResolvedEndpoint extends ConnectionCheck {
  kind: EndpointKind;
}

/** Zeitlimit für die Heimnetz-Adresse: kurz, damit es unterwegs schnell weitergeht. */
export const INTERNAL_TIMEOUT = 2_500;

/**
 * Wählt die erreichbare Adresse: Heimnetz zuerst, sonst extern.
 * Ein falscher Key bricht sofort ab (er wäre auch extern falsch).
 */
export async function resolveEndpoint(
  endpoints: Endpoints,
  key: string,
  signal?: AbortSignal,
): Promise<ResolvedEndpoint> {
  if (endpoints.internal) {
    try {
      const r = await checkConnection(endpoints.internal, key, { signal, timeoutMs: INTERNAL_TIMEOUT });
      return { ...r, kind: 'internal' };
    } catch (e) {
      if (e instanceof ApiError && (e.kind === 'unauthorized' || e.kind === 'aborted')) throw e;
    }
  }
  const r = await checkConnection(endpoints.external, key, { signal });
  return { ...r, kind: 'external' };
}

export interface SetupCheck {
  /** Adresse, über die gerade verbunden wurde. */
  active: ResolvedEndpoint;
  /** Hinweis, wenn eine der beiden Adressen nicht funktioniert hat. */
  warning?: string;
}

/**
 * Prüfung beim Einrichten: beide Adressen werden getestet. Ein falscher Key bei einer
 * erreichbaren Adresse lässt die Einrichtung scheitern. Mindestens eine muss klappen.
 */
export async function checkSetup(
  endpoints: Endpoints,
  key: string,
  signal?: AbortSignal,
): Promise<SetupCheck> {
  const [ext, int] = await Promise.allSettled([
    checkConnection(endpoints.external, key, { signal }),
    endpoints.internal
      ? checkConnection(endpoints.internal, key, { signal, timeoutMs: INTERNAL_TIMEOUT })
      : Promise.reject(null),
  ]);
  const errOf = (r: PromiseSettledResult<unknown>) =>
    r.status === 'rejected' && r.reason instanceof ApiError ? r.reason : null;

  for (const r of [ext, int]) {
    const e = errOf(r);
    if (e && (e.kind === 'unauthorized' || e.kind === 'aborted')) throw e;
  }
  if (int.status === 'fulfilled') {
    const warning =
      ext.status === 'rejected'
        ? `Verbunden über das Heimnetz. Die externe Adresse funktioniert gerade nicht: ${errOf(ext)?.message ?? 'unbekannter Fehler'}`
        : undefined;
    return { active: { ...int.value, kind: 'internal' }, warning };
  }
  if (ext.status === 'fulfilled') {
    const e = errOf(int);
    const warning = e
      ? `Die Heimnetz-Adresse ist von hier aus nicht erreichbar (${e.message}) – das ist normal, wenn du unterwegs bist.`
      : undefined;
    return { active: { ...ext.value, kind: 'external' }, warning };
  }
  throw errOf(ext) ?? new ApiError('unreachable');
}
