"use client";

import { useEffect, useMemo, useState } from "react";
import { qrPath } from "./qr";

/**
 * Leadership's tool for getting staff onto the app: a printable sign with the
 * link and a QR code, for the staff room or the pool office.
 */
export default function StaffPoster({ organization }: { organization: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // The deployed address is only knowable in the browser, and the QR encodes
    // whatever address leadership actually reached the app on.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(window.location.origin);
  }, []);

  const qr = useMemo(() => (url ? qrPath(url) : null), [url]);

  if (!url || !qr) return null;

  return (
    <>
      <h2 className="settings-heading">Staff access</h2>
      <p className="subtle">
        Staff never sign in — they just open the link. Print this sign for the staff room, or send the link in your
        scheduling platform so it is easy to find in the moment.
      </p>

      <div className="poster" id="staff-poster">
        <p className="poster-eyebrow">{organization || "Your organization"}</p>
        <p className="poster-title">Can’t make your shift?</p>
        <svg className="poster-qr" viewBox={`0 0 ${qr.moduleCount} ${qr.moduleCount}`} role="img" aria-label={`QR code linking to ${url}`}>
          <rect width={qr.moduleCount} height={qr.moduleCount} fill="#ffffff" />
          <path d={qr.path} fill="#0d493f" />
        </svg>
        <p className="poster-url">{url}</p>
        <p className="poster-note">Scan for the steps you must follow.</p>
      </div>

      <div className="profile-actions">
        <button className="secondary" onClick={() => window.print()}>Print the staff sign</button>
        <button
          className="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2200);
            } catch {
              window.prompt("Copy this link:", url);
            }
          }}
        >
          {copied ? "Link copied ✓" : "Copy the staff link"}
        </button>
      </div>
    </>
  );
}
