"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { ClerkLoaded, ClerkLoading, ClerkProvider, SignIn, SignedIn, SignedOut, useAuth, useClerk } from "@clerk/clerk-react";

/** How long Clerk's script may take before we tell the user it is not arriving. */
const CLERK_LOAD_TIMEOUT_MS = 10_000;

function SignInIntro() {
  return (
    <>
      <h1>Leadership sign-in</h1>
      <p className="subtle">
        The business profile is edited by leadership only. Sign in with the same work account you use for Performance
        Pulse.
      </p>
    </>
  );
}

type GateConfig = { publishableKey: string | null; ready: boolean; missing: string[] };

function ConfigNotice({ missing }: { missing: string[] }) {
  return (
    <div className="notice gate-notice">
      <strong>Leadership sign-in is not configured yet.</strong>
      <span>
        Set {missing.length ? missing.join(", ") : "the Clerk environment variables"} in this deployment, using the same
        Clerk application as Performance Pulse. Until then nobody can open the business profile.
      </span>
    </div>
  );
}

/**
 * Trades the Clerk session token for the server's super-admin decision.
 *
 * The browser never decides this: it asks `/api/auth/clerk`, which verifies the
 * token against Clerk and checks the allowlist server-side.
 */
function ClerkBridge({ children }: { children: ReactNode }) {
  const { isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const [state, setState] = useState<"checking" | "allowed" | "denied">("checking");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const attempted = useRef(false);

  useEffect(() => {
    if (!isSignedIn || attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Sign in again to continue.");

        const response = await fetch("/api/auth/clerk", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await response.json().catch(() => ({}))) as {
          allowed?: boolean;
          email?: string;
          message?: string;
        };

        if (!response.ok || !data.allowed) {
          throw new Error(data.message || "This account is not authorized to edit the business profile.");
        }
        setEmail(data.email ?? "");
        setState("allowed");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Sign-in could not be completed.");
        setState("denied");
      }
    })();
  }, [isSignedIn, getToken]);

  if (state === "checking") return <p className="subtle gate-status">Checking your access…</p>;

  if (state === "denied") {
    return (
      <div className="gate-panel">
        <div className="notice gate-notice">
          <strong>You are signed in, but not as a leadership account.</strong>
          <span>{message}</span>
        </div>
        <button className="secondary" onClick={() => signOut()}>Sign out and try another account</button>
      </div>
    );
  }

  return (
    <>
      <div className="admin-bar">
        <span>
          <strong>Signed in as leadership</strong>
          <small>{email}</small>
        </span>
        <button className="mini-button" onClick={() => signOut()}>Sign out</button>
      </div>
      {children}
    </>
  );
}

/**
 * Gates the business profile editor behind the shared staff Clerk sign-in.
 *
 * Clerk only loads when someone opens this screen, so the employee call-out
 * flow stays anonymous and carries none of the auth weight.
 */
export default function AdminGate({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<GateConfig | null>(null);
  const [failed, setFailed] = useState(false);
  const [slowToLoad, setSlowToLoad] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlowToLoad(true), CLERK_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/auth/clerk/config");
        if (!response.ok) throw new Error("config unavailable");
        const data = (await response.json()) as GateConfig;
        if (!cancelled) setConfig(data);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <div className="notice gate-notice">
        <strong>Could not reach the sign-in service.</strong>
        <span>Check your connection and reload the page.</span>
      </div>
    );
  }

  if (!config) return <p className="subtle gate-status">Loading leadership sign-in…</p>;
  if (!config.publishableKey || !config.ready) return <ConfigNotice missing={config.missing} />;

  return (
    <ClerkProvider publishableKey={config.publishableKey} afterSignOutUrl="/">
      {/* Clerk's components render nothing until its script loads, so without
          this the screen would sit blank whenever that script cannot arrive. */}
      <ClerkLoading>
        <div className="gate-panel">
          <SignInIntro />
          {slowToLoad ? (
            <div className="notice gate-notice">
              <strong>The sign-in form is not loading.</strong>
              <span>
                Check your connection and reload. If it keeps failing, the Clerk publishable key for this deployment may
                point at the wrong instance.
              </span>
            </div>
          ) : (
            <p className="subtle">Loading the secure sign-in form…</p>
          )}
        </div>
      </ClerkLoading>
      <ClerkLoaded>
        <SignedOut>
          <div className="gate-panel">
            <SignInIntro />
            <div className="clerk-mount">
              <SignIn routing="hash" />
            </div>
          </div>
        </SignedOut>
        <SignedIn>
          <ClerkBridge>{children}</ClerkBridge>
        </SignedIn>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
