import Check from "lucide-solid/icons/check";
import X from "lucide-solid/icons/x";
import { comparisonFeatures } from "~/constants/landing";

export default function ComparisonTable() {
  const renderValue = (value: string | boolean) => {
    if (value === true) {
      return (
        <Check size={18} class="mx-auto text-primary" aria-label="Included" />
      );
    }
    if (value === false) {
      return (
        <X
          size={18}
          class="mx-auto text-muted-foreground/40"
          aria-label="Not included"
        />
      );
    }
    return (
      <span class="text-sm font-semibold text-card-foreground">{value}</span>
    );
  };

  return (
    <section class="bg-muted px-4 py-24 md:px-16" id="comparison">
      <div class="mx-auto max-w-[1024px]">
        <div class="mb-16 text-center">
          <h2 class="mb-4 text-3xl font-bold text-foreground">
            Compare plans in detail
          </h2>
          <p class="text-lg text-muted-foreground">
            See exactly what&apos;s included in each tier.
          </p>
        </div>

        <div class="overflow-x-auto rounded-2xl border border-border bg-card shadow-md">
          <table class="w-full min-w-[640px] border-collapse">
            <thead>
              <tr class="border-b border-border">
                <th class="w-2/5 p-5 text-left text-sm font-semibold text-muted-foreground">
                  Features
                </th>
                <th class="w-1/5 p-5 text-center text-sm font-semibold text-card-foreground">
                  Starter
                </th>
                <th class="w-1/5 p-5 text-center text-sm font-bold text-primary">
                  Business
                </th>
                <th class="w-1/5 p-5 text-center text-sm font-semibold text-card-foreground">
                  Enterprise
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((group) => (
                <>
                  <tr class="border-b border-border bg-muted/50">
                    <td
                      colspan={4}
                      class="px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      {group.category}
                    </td>
                  </tr>
                  {group.features.map((feature, i) => (
                    <tr
                      class={`border-b border-border last:border-b-0 ${i % 2 === 0 ? "bg-card" : "bg-muted/30"}`}
                    >
                      <td class="px-5 py-4 text-sm text-card-foreground">
                        {feature.name}
                      </td>
                      <td class="px-5 py-4 text-center">
                        {renderValue(feature.starter)}
                      </td>
                      <td class="px-5 py-4 text-center bg-primary/5">
                        {renderValue(feature.business)}
                      </td>
                      <td class="px-5 py-4 text-center">
                        {renderValue(feature.enterprise)}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
