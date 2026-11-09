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
| `VAPI_ASSISTANT_ID` | Optional saved Vapi assistant used as the base for voice calls; INT-IQ applies interview-specific overrides |

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
  assistant config never reach the browser (Vapi creates web calls with the public key + an allowed origin). If
  `VAPI_ASSISTANT_ID` is set, that saved assistant is used with per-interview overrides while retaining its saved
  voice. Set `VAPI_VOICE_ID` only when a different voice should override it. Each interview's agent endpoint is
  protected by a signed token header.
- On localhost, Vapi cannot call a loopback Gemini URL. When `VAPI_ASSISTANT_ID` is configured, INT-IQ automatically
  uses that saved assistant's Vapi model for the live conversation and mirrors final transcript turns into the local
  database. Gemini still creates the final report. A public tunnel or Vercel switches voice follow-ups back to the
  Gemini custom-LLM endpoint.
- Dropped calls keep every saved answer: reconnect, or switch the same interview to text mode (`?mode=text`).
- Speed: the agent says a short "Got it." as soon as the candidate stops, then streams the question as Gemini
  writes it (thinking set to minimal; a second model takes over if the first is slow). LiveKit smart endpointing
  replies quickly after a finished sentence and waits during thinking pauses.

## Anti-cheat (integrity checks)

- Text mode turns on MediaPipe integrity checks (`components/interview/proctor.tsx`) for face presence, another person,
  looking away, a phone, leaving the window and paste attempts. Only counts are saved and shown in the report.
- Voice mode includes an on-device visual coach. It first calibrates to the candidate, then MediaPipe analyzes
  persistent framing, head/eye direction, eye-closure, lighting, posture, movement, face-presence and multiple-person
  issues. The call also measures speaking pace, likely filler words and long pauses from the transcript. Short coaching
  cues can be spoken during the call, and the metrics appear in the report without changing the AI content score.
  Raw camera frames are not uploaded or stored by INT-IQ in either mode.
- Local dev works with `VAPI_ASSISTANT_ID`. To use Gemini for the live voice follow-ups too, expose the app with a
  tunnel and set `VAPI_LLM_BASE_URL`.

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
app/                       Pages and API routes (Next.js App Router)
  page.tsx                 Landing page
  (auth)/sign-in/          Google + email code sign-in
  (app)/                   Signed-in area: dashboard, resume, interview, reports
  api/auth/[...path]/      Neon Auth proxy
  api/interviews/          Create, answer, finish, integrity counts
  api/resume/              Resume upload + AI analysis
  api/vapi/                Voice call proxy + custom-LLM agent endpoint
components/                React components, one folder per feature
  landing/ auth/ app/      Landing page, sign-in form, sidebar shell
  interview/ report/       Setup, text room, voice room, camera checks; report cards
  resume/ brand/ ui/       Resume form; logo and orb; shadcn primitives
lib/                       Server and shared logic
  ai/                      Gemini model + interviewer prompts and grading
  auth/                    Neon Auth server + client, error helpers
  db/                      Drizzle schema, Neon connection, retry helper
  hooks/                   React hooks
  interviews.ts            Interview data access
  profiles.ts              Profile data access
  vapi.ts  integrity.ts    Voice assistant config; anti-cheat scoring
  session.ts  api.ts       getSession / requireUser; route helpers
drizzle/                   SQL migrations (applied with npm run db:migrate)
e2e/                       Playwright tests
proxy.ts                   Route protection (Neon Auth middleware)
neon.ts                    Neon services for the branch
```

## Notes for contributors

- **Cache Components is on.** Anything that reads the session must render inside `<Suspense>`.
- **Database calls:** wrap idempotent queries in `withRetry()` (`lib/db/retry.ts`); Neon can drop idle connections.
- **Auth calls in the browser:** go through `runAuth()` (`lib/auth/errors.ts`); the Neon SDK throws on errors.
- New public pages go in `publicRoutes` in `proxy.ts`.
