import { businessLogos } from "~/constants/landing";

export default function TrustedBySection() {
  return (
    <section
      aria-label="Trusted by local businesses"
      class="border-b border-border bg-card px-4 py-12 md:px-8"
    >
      <div class="mx-auto max-w-[1120px]">
        <p class="mb-8 text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Trusted by local businesses across India
        </p>
        {/* Static logo grid (DS §5 perf budget): no marquee animation, no
            motion on the persuasion path. */}
        <ul class="grid grid-cols-2 items-center justify-items-center gap-6 md:grid-cols-4">
          {businessLogos.map((logo) => (
            <li class="flex min-h-11 items-center gap-2 text-muted-foreground">
              {logo.icon}
              <span class="text-sm font-medium">{logo.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
