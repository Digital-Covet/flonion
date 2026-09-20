import {
  type AccessorWithLatest,
  createAsync,
  revalidate,
} from "@solidjs/router";
import { createContext, type JSX, useContext } from "solid-js";
import { getBusiness } from "~/server/business";
import type { BusinessInfo, TeamMember } from "~/types/business";

export type { BusinessInfo, TeamMember };

type AppContextValue = {
  /**
   * Calling this suspends until the business is loaded, so read it inside a
   * `<Suspense>`. Use `.latest` where a component must render without waiting
   * — note `.latest` rethrows if the load failed, so it needs an
   * `<ErrorBoundary>` above it either way.
   */
  business: AccessorWithLatest<BusinessInfo | undefined>;
  refetchBusiness: () => Promise<void>;
};

const AppContext = createContext<AppContextValue>();

/**
 * Loads the business once for the whole app shell, on the server, so the
 * business name is in the first HTML instead of arriving after hydration.
 *
 * `deferStream` holds the response until this resolves: `getBusiness` throws a
 * redirect for a signed-out visitor, and a redirect thrown mid-stream can only
 * be delivered as a script tag after the shell has already painted.
 */
export function AppProvider(props: { children: JSX.Element }) {
  const business = createAsync(() => getBusiness(), { deferStream: true });

  return (
    <AppContext.Provider
      value={{
        business,
        refetchBusiness: () => revalidate(getBusiness.key),
      }}
    >
      {props.children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
