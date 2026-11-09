# INT-IQ

AI mock interviews for students. Practice live voice interviews with an AI interviewer that reads your resume, asks follow-up questions, and gives feedback on every answer.

Built by **TEAM DARKNIGHTS** · Live: https://int-iq.vercel.app

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, Cache Components), React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui (Radix, Nova), Motion, Lucide icons |
| Fonts | Geist (UI), Geist Mono (code), Instrument Serif (display accents) |
| Auth | Neon Auth (managed Better Auth): Google sign-in + email one-time code |
| Database | Neon Postgres (Singapore), Drizzle ORM, node-postgres |
| AI | Vercel AI SDK + Google Gemini (questions, follow-ups, grading, reports) |
| Voice | Vapi (real-time speech-to-text + text-to-speech), driven by the same Gemini interviewer |
| Hosting | Vercel (functions in `sin1`, next to the database) |
| Tests | Playwright (uses the installed Edge browser) |

## Getting started

```bash
npm install
neon env pull            # or copy .env.example to .env.local and fill it in
npm run db:migrate       # apply migrations in ./drizzle
npm run dev              # http://localhost:3000
```

### Environment variables

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (app traffic) |
| `DATABASE_URL_UNPOOLED` | Neon direct connection string (migrations) |
| `NEON_AUTH_BASE_URL` | Neon Auth URL for the branch |
| `NEON_AUTH_COOKIE_SECRET` | 32+ random characters (`openssl rand -base64 32`) |
| `GEMINI_API_KEY` | Free key from https://aistudio.google.com/apikey |
| `VAPI_PUBLIC_KEY` | Vapi public key (dashboard.vapi.ai → API Keys), used server-side only. Allow your site origin; no assistant restriction. Enables voice-call interviews |

On Vercel, set the same variables (except `DATABASE_URL_UNPOOLED`) for Production and Preview.

## Auth setup (Neon Auth)

- Email codes are sent by Neon (shared sender in development; add custom SMTP in Neon before a real launch).
- Google works out of the box with Neon's shared development keys. For your own Google client:
  1. Google Cloud Console → Google Auth Platform → Clients → Create client (Web application).
  2. Authorized redirect URI: `https://ep-billowing-cell-a1hyej21.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth/callback/google`
  3. Authorized JavaScript origins: `https://int-iq.vercel.app`, `http://localhost:3000`
  4. Save the keys into Neon Auth:
     `neon neon-auth oauth-provider update --provider-id google --oauth-client-id <ID> --oauth-client-secret <SECRET>`
- Every site origin must be trusted: `neon neon-auth domain add https://your-domain`

## Voice interviews (Vapi)

Two modes share the same interviewer, storage and reports:

- **Text & mic**: questions are read with the browser voice; answers are typed or dictated.
- **Voice call**: a real-time Vapi call. Vapi does speech-to-text and text-to-speech; after each answer it calls
  `/api/vapi/llm/[id]/chat/completions` (OpenAI format), which saves the answer and returns the next question from
  the Gemini interviewer. The browser SDK starts calls through `/api/vapi/call/web`, so the Vapi key and the
  assistant config never reach the browser (Vapi creates web calls with the public key + an allowed origin). Each interview's agent endpoint is protected by a signed token header.
- Dropped calls keep every saved answer: reconnect, or switch the same interview to text mode (`?mode=text`).
- Local dev: Vapi can't reach `localhost`. Expose the app with a tunnel and set `VAPI_LLM_BASE_URL`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (also type-checks) |
| `npm run lint` | ESLint |
| `npm run db:generate` | Create a migration from `lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to Neon |
| `npm run test:e2e` | Browser tests against a local build (`E2E_BASE_URL=https://int-iq.vercel.app` for the live site) |

## Project structure

```
app/
  page.tsx                 Landing page
  (auth)/sign-in/          Google + email code sign-in
  (app)/                   Signed-in area (sidebar layout, error screen)
  api/auth/[...path]/      Neon Auth proxy
components/                landing/, auth/, app/, brand/, ui/ (shadcn)
lib/
  auth/                    Neon Auth server + client, error helpers
  ai/                      Gemini model + interviewer prompts
  db/                      Drizzle schema, Neon connection, retry helper
  session.ts               getSession / requireUser
  profiles.ts              Profile data access
drizzle/                   SQL migrations
e2e/                       Playwright tests
proxy.ts                   Route protection (Neon Auth middleware)
neon.ts                    Neon services for the branch
```

## Notes for contributors

- **Cache Components is on.** Anything that reads the session must render inside `<Suspense>`.
- **Database calls:** wrap idempotent queries in `withRetry()` (`lib/db/retry.ts`); Neon can drop idle connections.
- **Auth calls in the browser:** go through `runAuth()` (`lib/auth/errors.ts`); the Neon SDK throws on errors.
- New public pages go in `publicRoutes` in `proxy.ts`.
