import { getDataScopeKey, loadDataScope } from "../../lib/dataScope";
import type { AuthSession } from "../../types";

export type DataIdentity = {
  session: AuthSession | null;
  scopeKey: string;
};

export async function resolveIdentity(sessionOverride?: AuthSession | null): Promise<DataIdentity> {
  if (sessionOverride !== undefined) {
    return {
      session: sessionOverride,
      scopeKey: getDataScopeKey(sessionOverride)
    };
  }

  return loadDataScope();
}
