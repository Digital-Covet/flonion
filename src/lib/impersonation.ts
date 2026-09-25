import { query } from "@solidjs/router";

/**
 * Who the current session impersonates, or null. `Session.impersonatedBy` is
 * not part of the client session payload, so it is read on the server.
 */
export const getImpersonation = query(async () => {
  "use server";
  const { loadImpersonation } = await import("~/server/impersonation-data");
  return loadImpersonation();
}, "impersonation");
