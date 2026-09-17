import type { JSX } from "solid-js";
import { Show } from "solid-js";

/**
 * Phase 1 primitive — spec §2/§6 density: dashboard/inbox/marketplace are
 * compact (row 44–52px, `text-sm`); numbers right-aligned + tabular-nums.
 * Responsive: table → stacked cards below `md` via the `cards` render prop.
 */
export interface DataColumn<T> {
  header: string;
  numeric?: boolean;
  render: (row: T) => JSX.Element;
}

export function DataTable<T>(props: {
  columns: DataColumn<T>[];
  rows: T[];
  caption: string;
  rowKey: (row: T, index: number) => string | number;
  renderCard?: (row: T) => JSX.Element;
  class?: string;
}) {
  return (
    <div class={props.class ?? ""}>
      <div class="overflow-x-auto rounded-card border border-border bg-card shadow-sm">
        <table class="w-full text-sm">
          <caption class="sr-only">{props.caption}</caption>
          <thead>
            <tr class="border-b border-border bg-muted/50">
              {props.columns.map((col) => (
                <th
                  scope="col"
                  class={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground ${col.numeric ? "text-right" : ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row) => (
              <tr class="e1-enter min-h-11 border-b border-border last:border-0 hover:bg-muted/40">
                {props.columns.map((col) => (
                  <td
                    class={`px-4 py-3 text-foreground ${col.numeric ? "tnum text-right" : ""}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Show when={props.renderCard}>
        <div class="mt-3 grid gap-2 md:hidden">
          {props.rows.map((row) => (
            <article class="rounded-card border border-border bg-card p-3 shadow-sm">
              {props.renderCard!(row)}
            </article>
          ))}
        </div>
      </Show>
    </div>
  );
}
