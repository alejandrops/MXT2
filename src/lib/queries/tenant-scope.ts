import type { SessionData } from "@/lib/session";
import {
  getScopedAccountIds,
  type ModuleKey,
} from "@/lib/permissions";

// ═══════════════════════════════════════════════════════════════
//  Tenant scope resolver (U1)
//  ─────────────────────────────────────────────────────────────
//  Helper que las páginas y queries usan para resolver "qué
//  accountId tengo que aplicar como filtro" dado:
//   · El session del user
//   · El módulo desde el que se está consultando
//   · El accountId que vino del searchParam de la UI (filtro)
//
//  Reglas:
//   · User cross-account (SA, MA) · respeta el filtro de UI · si no
//     hay filtro, devuelve null (= sin filtro · ve todo)
//   · User scope OWN_ACCOUNT (CA, OP) · fuerza al accountId del
//     user · ignora el filtro de UI (que en estos casos no debería
//     mostrarse en la UI tampoco)
//   · User sin permiso de read · devuelve sentinel "__no_account__"
//     que garantiza que la query no devuelva nada (defense in
//     depth · igual el page.tsx debería haber redireccionado antes)
//
//  IMPORTANTE: este helper SIEMPRE se aplica en páginas que
//  consumen datos multi-tenant. No es opcional. Bug histórico: las
//  páginas tomaban accountId del searchParam directamente, lo que
//  permitía a CA u OP ver datos cross-cliente si la página no
//  hacía explicit redirect (ver ADR-005 · pendiente).
//
//  Si en el futuro se introduce holdings (un user con visibilidad
//  sobre N accounts hijos), modificar `getScopedAccountIds` para
//  que devuelva un array de N items y este helper para soportar
//  un set en vez de un único id.
// ═══════════════════════════════════════════════════════════════

/**
 * Sentinel que se devuelve cuando el user no tiene permiso de
 * read en el módulo. Las queries que reciben este valor deberían
 * filtrar por `accountId = NEVER_MATCHING_ACCOUNT`, garantizando
 * resultado vacío.
 */
export const NEVER_MATCHING_ACCOUNT = "__no_account__";

/**
 * Resuelve el accountId a usar como filtro en queries
 * multi-tenant.
 *
 * @returns
 *  - `string`  · forzar este accountId en la query
 *  - `null`    · NO filtrar por accountId (user cross-account sin filtro UI)
 *  - `NEVER_MATCHING_ACCOUNT` · query no debe devolver nada
 */
export function resolveAccountScope(
  session: SessionData,
  module: ModuleKey,
  requestedAccountId: string | null,
): string | null {
  const allowed = getScopedAccountIds(session, module);

  // null = ALL · cross-account · respetar lo que pidió la UI
  if (allowed === null) {
    return requestedAccountId;
  }

  // [] = sin permiso · query no debe devolver nada
  if (allowed.length === 0) {
    return NEVER_MATCHING_ACCOUNT;
  }

  // Forzar al primer (y único, por ahora) account permitido
  // Ignoramos lo que pidió la UI · si el user cambia el filtro a
  // otro account, igual se le aplica el suyo. La UI del filtro
  // debería ocultarse para estos users.
  // Post-guard `allowed.length === 0` arriba · allowed[0] está garantizado.
  return allowed[0]!;
}

/**
 * Helper para la UI · indica si el filtro de "Cliente" debe
 * mostrarse en la página actual. Solo se muestra si el user
 * puede ver más de una cuenta.
 */
export function canFilterByAccount(
  session: SessionData,
  module: ModuleKey,
): boolean {
  const allowed = getScopedAccountIds(session, module);
  return allowed === null || allowed.length > 1;
}
