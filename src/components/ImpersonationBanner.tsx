import { Show } from "solid-js";

/**
 * Impersonation banner — displayed at the top of the tenant app when the
 * current session was created by an operator via impersonation.
 *
 * Reads Session.impersonatedBy and renders a visible banner. The banner
 * includes a link to stop impersonation (restore the operator's own session).
 */
interface ImpersonationBannerProps {
  impersonatedBy: string | null;
}

export function ImpersonationBanner(props: ImpersonationBannerProps) {
  return (
    <Show when={props.impersonatedBy}>
      <div class="bg-yellow-500 text-black px-4 py-2 text-sm font-medium flex items-center justify-between">
        <span>
          You are impersonating this account (operator: {props.impersonatedBy}).
          Session will expire automatically.
        </span>
        <a
          href="/api/operator/stop-impersonation"
          class="underline font-medium ml-4 whitespace-nowrap"
        >
          Stop Impersonation
        </a>
      </div>
    </Show>
  );
}
