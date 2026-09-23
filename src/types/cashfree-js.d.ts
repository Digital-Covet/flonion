/**
 * `@cashfreepayments/cashfree-js` ships no types. This covers only the
 * surface `/upgrade` uses: loading Cashfree.js and opening subscription
 * checkout.
 */
declare module "@cashfreepayments/cashfree-js" {
  export type CashfreeMode = "sandbox" | "production";

  export interface CashfreeCheckoutResult {
    error?: { message?: string };
    redirect?: boolean;
  }

  export interface CashfreeInstance {
    subscriptionsCheckout(options: {
      subsSessionId: string;
      redirectTarget?: "_self" | "_blank" | "_top" | "_modal" | HTMLElement;
    }): Promise<CashfreeCheckoutResult>;
  }

  /** Resolves to null outside the browser. */
  export function load(options: {
    mode: CashfreeMode;
  }): Promise<CashfreeInstance | null>;
}
