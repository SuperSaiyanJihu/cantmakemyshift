# Can’t Make My Shift

A mobile-first instruction tool that guides employees through their employer’s existing call-out process. The employee experience is driven entirely by a reusable business profile that is editable in-app under “Business profile & leadership settings”:

- organization name, main phone number, and scheduling-platform name and link
- all screen copy (home, reason, emergency-definition, and completion screens)
- the workflows themselves: add, remove, reorder, and rename them
- each workflow’s steps: add, remove, reorder, and edit text, plus an optional note and an action button per step (call the main line, open the scheduling platform, or none)

## Deploying

This app compiles to a **Cloudflare Worker** (`dist/server/index.js`), not a Node server, so it belongs on Cloudflare rather than a container host. `wrangler.jsonc` is committed and validated (`npx wrangler deploy --dry-run`).

```bash
npx wrangler login                              # once, interactive
npx wrangler secret put CLERK_PUBLISHABLE_KEY   # same Clerk app as Performance Pulse
npx wrangler secret put CLERK_SECRET_KEY
npx wrangler secret put SUPER_ADMIN_EMAIL
npm run build && npx wrangler deploy
```

Secrets live in Cloudflare, never in the repo. Until all three are set the business profile screen shows a configuration notice; the employee flow is unaffected.

A custom domain (say `shifts.example.com`) is worth setting before printing the QR sign, since the QR encodes whatever address the app is opened on.

### Sharing one profile across devices

The profile currently lives in each browser's local storage, so leadership's edits do not reach staff phones. To make one profile authoritative, create a database and bind it as `DB` in `wrangler.jsonc`:

```bash
npx wrangler d1 create cantmakemyshift
```

Then the editor's Save writes through the same Clerk check that guards the editor, and every device reads from it.

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

Because the profile itself still lives in browser storage, the gate controls the editor rather than the data — someone who edits their own browser storage directly can still change their own copy. Moving the profile into D1 behind the same check is the next step if that matters.

The prototype keeps one active business profile in browser storage. Leadership can edit, export, and import profiles without employee accounts or a multi-tenant backend. Profiles exported by the previous version (v1) are migrated automatically on import or first load. A later hosted version can persist the same profile shape in a database and add administrator authentication without changing the employee flow.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

Deployment config lives in `wrangler.jsonc` (see Deploying below).

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
