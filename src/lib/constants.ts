
export const APP_DOMAIN =
  import.meta.env.VITE_APP_URL ?? "http://localhost:3000";
export const WORK_EMAIL_DOMAIN = "@flonion.com";
export const SUPPORT_EMAIL = "support@flonion.com";
export const COMPANY_NAME = "Flonion"


// Base URL for links the user copies from the browser. In the browser we use the
// origin the app is actually being served from (so dev copies localhost:3000
// instead of the production domain); on the server we fall back to APP_DOMAIN.
export const currentOrigin = () =>
  typeof window !== "undefined" ? window.location.origin : APP_DOMAIN;
