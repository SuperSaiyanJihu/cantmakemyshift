# Can’t Make My Shift

A mobile-first instruction tool that guides employees through their employer’s existing call-out process. The employee experience is driven entirely by a reusable business profile that is editable in-app under “Business profile & leadership settings”:

- organization name, main phone number, and scheduling-platform name and link
- all screen copy (home, reason, emergency-definition, and completion screens)
- the workflows themselves: add, remove, reorder, and rename them
- each workflow’s steps: add, remove, reorder, and edit text, plus an optional note and an action button per step (call the main line, open the scheduling platform, or none)

## Deploying (Railway)

A stock Next.js app — Railway detects it automatically, no Dockerfile needed.

1. **Create the service** from this repo and branch.
2. **Add a Postgres database** to the project. Railway injects `DATABASE_URL`; reference it on the service.
3. **Set the variables** (Settings → Variables), all on the same Clerk application as Performance Pulse:

   | Variable | Purpose |
   | --- | --- |
   | `DATABASE_URL` | Shared business profile. Without it each browser keeps its own copy. |
   | `CLERK_PUBLISHABLE_KEY` | Public browser key, served at request time by `/api/auth/clerk/config`. |
   | `CLERK_SECRET_KEY` | Verifies session tokens server-side. Never reaches the browser. |
   | `SUPER_ADMIN_EMAIL` | Who may edit the profile. One address, or several separated by commas. |

4. **Deploy.** Railway runs `npm run build`, then `npm run db:migrate` as the pre-deploy step, then `npm start`; Next binds to `$PORT` on its own.

Migrations run on every deploy, before the new release takes traffic, so a release can never serve code expecting a table the database does not have. With no `DATABASE_URL` the step logs that it skipped and the deploy proceeds.

Set a custom domain before printing the QR sign — the QR encodes whichever address the app is opened on.

Nothing is required for the employee flow: with no variables set at all, the app still serves call-out directions from each browser's stored copy, and the business profile screen explains what to configure.

## Getting staff to the app

Staff never sign in — they open a link. Three things make that easy:

- **Home-screen install.** A web app manifest, icons, and a no-op service worker make the app installable, so staff can keep it one tap away instead of hunting for a link mid-crisis. The home screen offers "Keep this app on your phone", which triggers the native install prompt where available and explains the Share → Add to Home Screen steps on iOS.
- **Share the link.** The same panel uses the native share sheet, falling back to copying the link.
- **A printable sign.** Leadership settings include a QR code of the deployed address with a print stylesheet, for the staff room or pool office. The QR encodes whichever address the app was opened on, so it is correct for any deployment.

The service worker deliberately caches nothing: call-out directions must never be served stale.

## Leadership sign-in

The business profile editor is gated behind the Clerk application shared with Performance Pulse, so the same work account opens both. The employee call-out flow stays anonymous and loads no auth code at all — Clerk is only fetched when someone opens the settings screen.

- The browser asks `GET /api/auth/clerk/config` for the publishable key at request time, so one build can be deployed against different Clerk instances. The variable is `CLERK_PUBLISHABLE_KEY` rather than `NEXT_PUBLIC_*` precisely because the framework inlines `NEXT_PUBLIC_*` at build time.
- After signing in, the browser exchanges its Clerk session token at `POST /api/auth/clerk`. The server verifies the token with `@clerk/backend`, takes the account's **primary** email and only when Clerk reports it **verified**, then checks it against `SUPER_ADMIN_EMAIL`. Anyone can attach an unverified address to a Clerk account, so an unverified match is refused. The allowlist and secret key never reach the browser.
- Configure `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `SUPER_ADMIN_EMAIL` (see `.env.example`). It fails closed: with any of them missing, the editor is unreachable and the screen explains which variables to set.
- Clerk is code-split into its own chunk, so an employee calling out never downloads it.

## How the profile is stored

One row in Postgres (`business_profiles`), read by every device and written only by leadership.

- **Reads are public and unauthenticated** — these are the directions employees are told to follow, and staff never sign in.
- **Writes go through the same Clerk check that guards the editor**, re-verified server-side. The editor's gate decides what to *render*; the endpoint decides what can be *written*.
- **Every browser keeps a cached copy** in local storage. The screen paints from the cache instantly, then the shared profile replaces it. If the network or the database is unavailable, the cached directions still show rather than an error.
- **Saving says which happened**: "Saved for everyone" only when the server confirmed it, and a distinct message when it could only be stored on that device.
- Payloads are normalized on write and on read, so a malformed or hostile profile cannot reach an employee's screen.

The row is keyed by a slug with exactly one row (`default`) today. Supporting a second organization later is a lookup change, not a migration.

Profiles exported by earlier versions are migrated automatically on import or first load.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

## Project layout

- `app/` — screens and API routes. `page.tsx` is the whole employee experience; `AdminGate.tsx` gates leadership settings; `api/profile` is the shared profile; `api/auth/clerk` is the sign-in exchange.
- `app/settings.ts` — the profile shape, defaults, normalization, and migration of older profiles.
- `app/superadmin.ts` / `app/auth-server.ts` — who may edit, and the server-side Clerk verification behind it.
- `db/` — Drizzle schema and connection. `drizzle/` holds generated migrations.
- `public/` — icons, web app manifest, and the service worker that makes the app installable.
- `tests/` — run with `npm test`; no server or database required.

## Useful commands

- `npm run dev` — local development on http://localhost:3000
- `npm run build` — production build
- `npm start` — serve the production build
- `npm test` — unit tests plus the profile endpoint's authorization guards
- `npm run lint` — ESLint over `app/`, `db/`, and `tests/`
- `npm run db:generate` — regenerate migrations after editing `db/schema.ts`
- `npm run db:migrate` — apply pending migrations to `DATABASE_URL` (also the deploy's pre-deploy step)

Local configuration goes in `.env.local` (gitignored). See `.env.example`.
