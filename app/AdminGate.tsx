"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { ClerkProvider, SignIn, useAuth, useClerk } from "@clerk/clerk-react";

type GateConfig = { publishableKey: string | null; ready: boolean; missing: string[] };

/** How long Clerk's script may take before we tell the user it is not arriving. */
const CLERK_LOAD_TIMEOUT_MS = 10_000;

/**
 * Where Clerk sends the browser after a successful sign-in. The app keeps its
 * screen in React state rather than the URL, so without this marker a sign-in
 * would land the admin back on the employee home screen with no sign that
 * anything worked.
 */
export const LEADERSHIP_RETURN_PARAM = "leadership";

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

type CheckState = "checking" | "allowed" | "denied" | "unavailable";

/**
 * Trades the Clerk session token for the server's super-admin decision.
 *
 * The browser never decides this: it asks `/api/auth/clerk`, which verifies the
 * token against Clerk and checks the allowlist server-side. A refusal and a
 * failure to ask are kept apart, because telling someone they are unauthorized
 * when the network merely blipped sends them hunting for the wrong problem.
 */
function ClerkBridge({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const [state, setState] = useState<CheckState>("checking");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const check = useCallback(async () => {
    // Re-entrant: the effect runs it once on mount, and "Try again" runs it
    // afterwards, which is why the state resets here rather than at the call site.
    setState("checking");
    try {
      const token = await getToken();
      if (!token) throw new Error("no-token");

      const response = await fetch("/api/auth/clerk", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => ({}))) as {
        allowed?: boolean;
        email?: string;
        message?: string;
      };

      if (response.ok && data.allowed) {
        setEmail(data.email ?? "");
        setState("allowed");
        return;
      }

      // 401/403 are answers: this account may not edit the profile. Anything
      // else means we never got an answer and retrying is worthwhile.
      setMessage(data.message || "This account is not authorized to edit the business profile.");
      setState(response.status === 401 || response.status === 403 ? "denied" : "unavailable");
    } catch {
      setMessage("We could not reach the sign-in service to check your access.");
      setState("unavailable");
    }
  }, [getToken]);

  useEffect(() => {
    // Asking the server whether this account is authorized is the whole point
    // of mounting; there is nothing to render until the answer arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
  }, [check]);

  if (state === "checking") return <p className="subtle gate-status">Checking your access…</p>;

  if (state === "unavailable") {
    return (
      <div className="gate-panel">
        <div className="notice gate-notice">
          <strong>Your access could not be checked.</strong>
          <span>{message}</span>
        </div>
        <button className="secondary" onClick={() => void check()}>Try again</button>
      </div>
    );
  }

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
 * Decides what to show once Clerk is in play.
 *
 * `useAuth().isLoaded` is the single source of truth for whether Clerk arrived.
 * Clerk's own <ClerkLoading>/<ClerkLoaded> pair cannot express "it failed" —
 * both render nothing when loading ends without success, which would leave this
 * screen silently blank exactly when something is wrong.
 */
function GateBody({ children, slowToLoad }: { children: ReactNode; slowToLoad: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
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
    );
  }

  if (!isSignedIn) {
    const returnUrl = `/?${LEADERSHIP_RETURN_PARAM}=1`;
    return (
      <div className="gate-panel">
        <SignInIntro />
        <div className="clerk-mount">
          <SignIn routing="hash" forceRedirectUrl={returnUrl} fallbackRedirectUrl={returnUrl} />
        </div>
      </div>
    );
  }

  return <ClerkBridge>{children}</ClerkBridge>;
}

/**
 * Gates the business profile editor behind the shared staff Clerk sign-in.
 *
 * Loaded lazily by the page, so the employee call-out flow never downloads any
 * of this and stays anonymous.
 */
export default function AdminGate({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<GateConfig | null>(null);
  const [failed, setFailed] = useState(false);
  const [slowToLoad, setSlowToLoad] = useState(false);

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

  // Timed from when Clerk is actually asked for, not from mount, so a slow
  // config fetch cannot burn the allowance before Clerk has begun loading.
  useEffect(() => {
    if (!config?.publishableKey) return;
    const timer = window.setTimeout(() => setSlowToLoad(true), CLERK_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [config?.publishableKey]);

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
      <GateBody slowToLoad={slowToLoad}>{children}</GateBody>
    </ClerkProvider>
  );
}
