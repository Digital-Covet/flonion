import { createSignal, onMount, onCleanup } from "solid-js";

export function useReducedMotion(): () => boolean {
  const [reduced, setReduced] = createSignal(false);

  onMount(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", handler);
    onCleanup(() => query.removeEventListener("change", handler));
  });

  return reduced;
}
