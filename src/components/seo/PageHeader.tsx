import type { Component } from "solid-js";
import type { PageHeaderData } from "../../types";

/** DS §6 Local SEO header: Jost H1 (via base) + muted subtitle. */
const PageHeader: Component<PageHeaderData> = (props) => {
  return (
    <header class="mb-6">
      <h1 class="text-foreground">{props.title}</h1>
      <p class="mt-1 text-base text-muted-foreground">{props.subtitle}</p>
    </header>
  );
};
export default PageHeader;
