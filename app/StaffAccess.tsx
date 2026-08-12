"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** iOS never fires beforeinstallprompt, so those users need the manual steps. */
function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Helps staff keep the app one tap away.
 *
 * Employees reach for this exactly when something has gone wrong, so the goal
 * is that they never have to hunt for a link: install it to the home screen, or
 * pass it to a co-worker.
 */
export default function StaffAccess() {
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // display-mode only exists in the browser; a lazy initializer would differ
    // from the server-rendered markup and trip hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstalled(isStandalone());

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Already on the home screen: nothing left to offer.
  if (installed) return null;

  async function share() {
    const url = window.location.origin || window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Can’t Make My Shift", url });
        return;
      } catch {
        // Cancelled or unsupported in this context — fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <div className="staff-access">
      <button className="text-button staff-access-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        Keep this app on your phone
      </button>

      {open && (
        <div className="staff-access-panel">
          {installPrompt ? (
            <>
              <p className="subtle">Add it to your home screen so it is one tap away when you need it.</p>
              <button
                className="secondary"
                onClick={async () => {
                  await installPrompt.prompt();
                  await installPrompt.userChoice;
                  setInstallPrompt(null);
                }}
              >
                Add to home screen
              </button>
            </>
          ) : isIos() ? (
            <p className="subtle">
              Tap the <strong>Share</strong> button in Safari, then choose <strong>Add to Home Screen</strong>. The app
              opens like any other app on your phone.
            </p>
          ) : (
            <p className="subtle">
              Use your browser menu and choose <strong>Add to Home Screen</strong> (or <strong>Install app</strong>) to
              keep it one tap away.
            </p>
          )}
          <button className="secondary" onClick={share}>{copied ? "Link copied ✓" : "Share the link"}</button>
        </div>
      )}
    </div>
  );
}
