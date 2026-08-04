import { navLinks } from "~/constants/landing";

export default function Footer() {
  const allLinks = [
    ...navLinks,
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
  ];

  return (
    <footer class="relative z-10 w-full border-t border-slate-800 bg-slate-950 px-4 py-12 md:px-16">
      <div class="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <a
            class="mb-2 block font-heading text-2xl font-bold text-white"
            href="#"
          >
            Flonion
          </a>
          <p class="text-base text-slate-400">
            &copy; 2024 Flonion AI. Empowering Indian SMEs.
          </p>
        </div>
        <div class="flex flex-wrap gap-4">
          {allLinks.map((link) => (
            <a
              class="text-base text-slate-400 opacity-80 transition-colors hover:text-teal-300 hover:opacity-100"
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
