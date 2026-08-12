/**
 * Registers the no-op service worker that makes the app installable.
 *
 * Kept out of the render path: installability is a nice-to-have, and a failure
 * here must never affect an employee reading their call-out steps.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability is optional; the app works the same without it.
    });
  });
}
