// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

window.addEventListener("error", (e) => {
  if (
    e.message === "ResizeObserver loop completed with undelivered notifications."
  ) {
    e.stopImmediatePropagation();
  }
});

mount(() => <StartClient />, document.getElementById("app")!);
