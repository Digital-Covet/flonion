import ArrowRight from "lucide-solid/icons/arrow-right";
import PlayCircle from "lucide-solid/icons/play-circle";
import Star from "lucide-solid/icons/star";
import TrendingUp from "lucide-solid/icons/trending-up";
import User from "lucide-solid/icons/user";
import Store from "lucide-solid/icons/store";
import MessageSquareText from "lucide-solid/icons/message-square-text";

interface HeroSectionProps {
  reducedMotion: boolean;
}

export default function HeroSection(props: HeroSectionProps) {
  const handleTilt = (e: MouseEvent, el: HTMLDivElement) => {
    if (props.reducedMotion || window.innerWidth < 768) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateX = (0.5 - y) * 8;
    const rotateY = (x - 0.5) * 10;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translate3d(0, -3px, 0)`;
  };

  const resetTilt = (el: HTMLDivElement) => {
    el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0)";
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "50%");
  };

  return (
    <section class="hero-gradient relative overflow-hidden px-4 pb-32 pt-24 md:px-16">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.62),transparent_50%)]" aria-hidden="true" />

      <div class="relative z-10 mx-auto grid max-w-[1280px] items-center gap-12 md:grid-cols-2">
        <div class="pr-4 animate-[fade-in-up_0.6s_ease-out_both]">
          <p class="mb-5 font-heading text-5xl font-extrabold tracking-tight text-primary md:text-7xl">
            Flonion
          </p>
          <h1 class="mb-2 font-heading text-[40px] font-extrabold leading-[1.1] tracking-tight text-foreground md:text-[72px] md:leading-[1.05]">
            Get More 5-Star Reviews for Your Business with{" "}
            <span class="accent-gradient">AI Precision</span>
          </h1>
          <p class="mb-10 mt-6 max-w-lg text-lg text-muted-foreground">
            Flonion helps local Indian shops, restaurants, and salons collect reviews and grow their reputation automatically.
          </p>
          <div class="flex flex-col gap-2 sm:flex-row">
            <a
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-200 hover:bg-primary-hover hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]"
              href="#"
            >
              Get Started Free
              <ArrowRight size={20} aria-hidden="true" />
            </a>
            <a
              class="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-8 py-3.5 text-sm font-semibold text-card-foreground shadow-sm transition-all duration-200 hover:bg-muted hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]"
              href="#"
            >
              See How it Works
              <PlayCircle size={20} class="text-primary" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div class="relative mt-8 hidden h-[550px] w-full md:mt-0 md:block">
          <div
            class="tilt-card absolute inset-0 z-10 mx-auto flex max-w-[500px] translate-x-4 translate-y-4 flex-col gap-5 rounded-xl border border-border bg-card/94 p-6 shadow-md backdrop-blur-xl will-change-transform"
            onMouseMove={(e) => handleTilt(e, e.currentTarget)}
            onMouseLeave={(e) => resetTilt(e.currentTarget)}
          >
            <div class="flex items-center justify-between border-b border-border pb-4">
              <div class="font-heading text-2xl font-bold text-card-foreground">
                Dashboard
              </div>
              <div class="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5">
                <Store size={14} class="text-primary" aria-hidden="true" />
                <span class="text-sm font-semibold text-muted-foreground">
                  Swaad Restaurant
                </span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col items-center justify-center rounded-lg border border-border bg-slate-50 p-5 shadow-sm">
                <span class="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                  Total Reviews
                </span>
                <span class="text-[40px] font-bold leading-tight text-primary">
                  842
                </span>
                <div class="mt-2 flex items-center rounded bg-orange-muted px-2 py-1 text-orange">
                  <TrendingUp size={14} aria-hidden="true" />
                  <span class="ml-1 text-xs">+12% this week</span>
                </div>
              </div>
              <div class="flex flex-col items-center justify-center rounded-lg border border-border bg-slate-50 p-5 shadow-sm">
                <span class="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                  Average Rating
                </span>
                <div class="mb-2 flex items-center gap-2">
                  <span class="text-[40px] font-bold leading-tight text-card-foreground">
                    4.8
                  </span>
                  <Star size={28} class="fill-orange text-orange" aria-hidden="true" />
                </div>
                <div class="mt-2 h-2 w-full rounded-full bg-muted">
                  <div class="h-2 w-[90%] rounded-full bg-primary" />
                </div>
              </div>
            </div>

            <div class="mt-2 rounded-lg border border-border bg-slate-50 p-4 shadow-sm">
              <div class="mb-3 flex items-center justify-between">
                <div class="text-sm font-semibold text-card-foreground">
                  Recent Activity
                </div>
                <a class="text-xs text-primary hover:underline" href="#">
                  View All
                </a>
              </div>
              <div class="space-y-3">
                {[
                  { name: "Rahul S.", time: "2m ago" },
                  { name: "Priya M.", time: "1h ago" },
                ].map((item) => (
                  <div class="flex items-center gap-3">
                    <div class="flex h-8 w-8 items-center justify-center rounded-full bg-purple-muted text-purple">
                      <User size={14} aria-hidden="true" />
                    </div>
                    <div class="flex-1">
                      <div class="text-sm font-semibold text-card-foreground">
                        {item.name}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        Left a 5-star review
                      </div>
                    </div>
                    <div class="text-xs text-muted-foreground">{item.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            class="idle-float glass-card absolute -left-12 top-1/4 z-20 flex items-center gap-4 rounded-xl p-4 shadow-md will-change-transform"
          >
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-inner">
              <MessageSquareText size={24} aria-hidden="true" />
            </div>
            <div>
              <div class="text-sm font-bold text-card-foreground">
                New 5-Star Review!
              </div>
              <div class="text-xs text-muted-foreground">from Google Maps</div>
            </div>
          </div>

          <div
            class="glass-card absolute -right-8 bottom-24 z-20 rounded-xl p-5 shadow-md will-change-transform"
          >
            <div class="mb-3 flex items-center justify-between gap-4 text-sm font-bold text-card-foreground">
              <span>Weekly Growth</span>
              <span class="rounded bg-orange-muted px-2 py-0.5 text-xs font-bold text-orange">
                +24%
              </span>
            </div>
            <div class="flex h-20 items-end gap-2.5">
              {[30, 45, 60, 50, 85].map((height, i) => (
                <div
                  class={`w-5 rounded-t transition-colors hover:bg-primary ${
                    i === 4
                      ? "bg-primary shadow-[0_0_10px_rgba(15,118,110,0.4)]"
                      : "bg-slate-300"
                  }`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>

          <div
            class="idle-float-delayed glass-card absolute right-10 top-12 z-20 flex items-center gap-2 rounded-full px-4 py-2.5 shadow-md will-change-transform"
          >
            <div class="flex text-orange">
              {[0, 1, 2].map((item) => (
                <Star key={item} size={14} class="fill-orange" aria-hidden="true" />
              ))}
            </div>
            <div class="text-sm font-bold text-card-foreground">4.9/5</div>
            <div class="ml-1 text-xs text-muted-foreground">Rating</div>
          </div>

          <div class="glass-card absolute bottom-16 left-10 z-20 flex items-center gap-3 rounded-xl p-3 shadow-md">
            <div class="flex -space-x-2">
              <div class="z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white p-1.5 shadow-sm">
                <span class="text-[10px] font-bold text-primary">G</span>
              </div>
              <div class="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white p-1.5 shadow-sm">
                <span class="text-[10px] font-bold text-purple">W</span>
              </div>
            </div>
            <div class="pr-1 text-xs font-bold text-card-foreground">Synced</div>
          </div>
        </div>
      </div>
    </section>
  );
}
