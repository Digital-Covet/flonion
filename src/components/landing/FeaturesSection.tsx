import { createSignal, onMount, onCleanup } from "solid-js";
import { featureItems } from "~/constants/landing";

export default function FeaturesSection() {
  const [visible, setVisible] = createSignal(false);
  let sectionRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!sectionRef) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(sectionRef);
    onCleanup(() => observer.disconnect());
  });

  return (
    <section class="bg-card px-4 py-32 md:px-16" id="features" ref={sectionRef}>
      <div class="mx-auto max-w-[1280px]">
        <div class="mx-auto mb-20 max-w-2xl text-center">
          <h2 class="mb-4 text-3xl font-bold text-foreground">
            Everything you need to grow locally
          </h2>
          <p class="text-lg text-muted-foreground">
            Simple tools built specifically for Indian businesses to manage reputation effortlessly.
          </p>
        </div>

        <div class="grid gap-8 md:grid-cols-2">
          {featureItems.map((feature, index) => (
            <div
              class={`tilt-card relative overflow-hidden rounded-xl border border-border bg-card p-8 shadow-md transition-all duration-300 will-change-transform ${
                visible()
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-7"
              }`}
              style={{ "transition-delay": `${index * 90}ms` }}
              onMouseMove={(e) => {
                const el = e.currentTarget;
                if (window.innerWidth < 768) return;
                const rect = el.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;
                const rotateX = (0.5 - y) * 8;
                const rotateY = (x - 0.5) * 10;
                el.style.setProperty("--mx", `${x * 100}%`);
                el.style.setProperty("--my", `${y * 100}%`);
                el.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translate3d(0, -3px, 0)`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.transform = "";
                el.style.setProperty("--mx", "50%");
                el.style.setProperty("--my", "50%");
              }}
            >
              <div class="relative z-10 flex h-full flex-col gap-6 md:flex-row md:items-center">
                <div class="flex-1">
                  <div class="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                    {feature.icon}
                  </div>
                  <h3 class="mb-3 text-2xl font-bold text-card-foreground">
                    {feature.title}
                  </h3>
                  <p class="text-base text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
                {feature.mockup && (
                  <div class="relative z-10 w-full shrink-0 md:w-48">
                    {feature.mockup}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
