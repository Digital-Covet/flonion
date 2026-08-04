import { businessLogos } from "~/constants/landing";

export default function TrustedBySection() {
  return (
    <section class="border-b border-border bg-card px-4 py-12 md:px-16">
      <div class="mx-auto max-w-[1280px] overflow-hidden">
        <p class="mb-8 text-center text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Trusted by local businesses across India
        </p>
        <div class="trusted-marquee flex w-max min-w-full items-center justify-center gap-6 md:gap-10">
          {businessLogos.map((logo) => (
            <div class="flex items-center gap-2 text-muted-foreground opacity-60 transition-colors hover:text-card-foreground hover:opacity-100">
              {logo.icon}
              <span class="text-sm font-bold">{logo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
