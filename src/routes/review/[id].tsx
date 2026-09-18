import { Title } from "@solidjs/meta";
import { createAsync, useParams } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { Show } from "solid-js";
import { InactiveLink, PublicShell } from "~/components/reviews/public";
import { legacyReviewTarget } from "~/lib/public-review";

/**
 * Links and printed QR codes made before the review page moved to
 * `/company/:username/review` point here. The redirect happens on the server,
 * so the customer only ever sees the company page.
 */
export default function LegacyReviewLink() {
  const params = useParams<{ id: string }>();
  const resolved = createAsync(() => legacyReviewTarget(params.id), {
    deferStream: true,
  });

  return (
    <PublicShell>
      <Show when={resolved() !== undefined}>
        <HttpStatusCode code={404} />
        <Title>Review link not active · Flonion</Title>
        <InactiveLink />
      </Show>
    </PublicShell>
  );
}
