# INT-IQ platform plan

Goal: turn INT-IQ into an autonomous, goal-oriented career and recruitment platform for candidates and recruiters, without rebuilding what already works.

This file is the source of truth across sessions. Update the status table after every step.

| Step | What | Status |
|---|---|---|
| 1 | Audit, reference review, plan, free APIs | Done (2026-11-11) |
| 2 | Auth and role security, recruiter approval, security fixes | Done (2026-11-11); live after you migrate and deploy |
| 3 | Candidate and recruiter workflow gaps, notifications | Next |
| 4 | Resume intelligence | Planned |
| 5 | Mock interview engine (Vapi) | Planned |
| 6 | Human-to-human interviews | Planned |
| 7 | Recruiter Copilot | Planned |
| 8 | Career agent (core) | Planned |
| 9 | Recruiter agent | Planned |
| 10 | Goal tracking, memory, replanning | Planned |
| 11 | Full testing and production release | Planned |

The order follows the "final development priorities" in the brief. Database work (phase 9 of the brief) and dashboard work (phase 10) happen inside each step, not as separate steps.

---

## 1. Where INT-IQ is today

| Layer | What it is |
|---|---|
| Frontend | Next.js 16.4.5 App Router (Cache Components, `proxy.ts`), React 19.3, Tailwind v4, shadcn/Radix, motion, Aceternity-based effects in `components/effects/` |
| Backend | Route handlers in `app/api/**`, data access in `lib/*.ts` (every function scoped by the signed-in user's id) |
| Database | Neon Postgres, Drizzle ORM over node-postgres, migrations in `drizzle/` |
| Auth | Neon Auth (managed Better Auth): email one-time code and Google. Role (`student` or `recruiter`) in `profiles.role`, locked once chosen (`roleChosen`) |
| AI | Gemini through the AI SDK (`lib/ai/model.ts`): structured output with zod, model fallback chain, hedged streaming for voice |
| Voice | Vapi web calls created server-side (`/api/vapi/call/web`); Vapi calls back a signed "custom LLM" endpoint that runs the same Gemini interviewer |
| Live video | WebRTC peer-to-peer, signaling stored in Postgres and polled every 1.25 s, STUN only |
| Proctoring | MediaPipe face detection in the AI interview room (client-side), counts saved as integrity data, never video |
| Tests | Playwright e2e (sign-in, roles, dashboard, layout); other flows checked with one-off scripts |
| Hosting | Vercel (region `sin1`) |

Working features (checked in earlier sessions): sign-in with role lock, resume upload and analysis, text and Vapi voice mock interviews with adaptive follow-ups, reports, jobs, applications, AI and live invitations, recruiter reports, live interview room with consented transcript, Copilot plan, suggestions and evaluation draft.

Data on the live branch (2026-11-11): 11 users, 14 interviews, 2 jobs, 3 applications, 3 invitations, 3 live sessions.

## 2. Problems found

| Sev | Problem | Where | Fix in |
|---|---|---|---|
| P1 | Password sign-up is open with no email check ("Require Verification: false"), though the UI never offers passwords. Someone can register another person's email and keep a password on that account if the owner later signs in with Google. | Neon Auth config | Step 2 |
| P1 | A candidate can write the interviewer's questions into their own interview: the voice transcript endpoint accepts "assistant" lines for any interview, text and recruiter-invited ones included. | `app/api/interviews/[id]/voice-turn` | Step 2 |
| P1 | Anti-cheat counts can be overwritten after an interview has finished. | `app/api/interviews/[id]/integrity` | Step 2 |
| P1 | No rate limits on AI endpoints: any signed-in user can burn the Gemini and Vapi quota. | interview, resume, Copilot, Vapi routes | Step 2 |
| P2 | Resume text and answers go into prompts unguarded, so instructions hidden in them can sway scores. | `lib/ai/*` | Step 2 |
| P2 | A role conflict after Google sign-in redirects to `/auth/role-conflict`, which is a 404 (the page is `/role-conflict`). | `app/api/auth/complete`, `sign-in-form.tsx` | Step 2 |
| P2 | No security headers (frame, sniffing, referrer, camera and microphone permissions). | `next.config.ts` | Step 2 |
| P2 | PDF parsing caps size but not pages or time. | `app/api/resume` | Step 2 |
| P2 | Multi-step writes without transactions (invitation plus room plus status, live completion, interview completion). | `lib/recruiting.ts`, `lib/live-interviews.ts`, `lib/interviews.ts` | Step 2 |
| P2 | Live video uses STUN only, so calls fail on strict networks (many campus and mobile networks). Needs a TURN server. | `live-interview-room.tsx` | Step 6 |
| P2 | Signaling rows are never cleaned up (98 so far). | `live_interview_signals` | Step 6 |
| P2 | Schema drift: the database has an `assessments` table from a migration that is not in this repo (applied 2026-11-09 22:05, between 0005 and 0006). `npm run db:push` would try to drop it. Use `db:generate` plus `db:migrate` only. | `drizzle/` | Noted |
| P3 | Google sign-in doesn't force Google's account chooser. | `sign-in-form.tsx`, Neon Auth provider config | Step 2 |
| P3 | Duplicate code: `completeInvitationForInterview` repeats logic in `completeInterview` and is unused. | `lib/recruiting.ts` | Step 3 |
| P3 | `VAPI_PRIVATE_KEY` is unused; `.env.example` says `VAPI_PUBLIC_KEY` while `.env.local` uses `NEXT_PUBLIC_VAPI_PUBLIC_KEY`. | env files | Step 2 |
| P3 | 3 password accounts and 3 unverified users look like leftover test accounts. | Neon Auth | Step 2 (you confirm) |
| P3 | Automated tests don't cover interviews, recruiting or live rooms, and they create accounts on the live database. | `e2e/` | Steps 2, 11 |

## 3. Reference (PrepSensei)

The live site (prepsensei-six.vercel.app) shows only sign-in and sign-up; every other path redirects to sign-in. Its source is public (github.com/gnandeep22/PrepSensei, last commit 2026-11-08), so the comparison below uses the public pages plus that code. Nothing beyond those two sources is assumed.

| Area | PrepSensei | INT-IQ | Decision |
|---|---|---|---|
| Sign-in | Email and password with OTP check, plus Face ID sign-in (face-api.js descriptors) and 3-angle face enrollment | Email one-time code and Google, role locked on the server | Keep INT-IQ: no passwords to leak or reset. Face ID is not copied: a browser face match can be fooled with a photo, and face templates are sensitive biometric data under India's DPDP Act 2023. |
| Role choice | "I am a" Candidate or Recruiter at sign-up | Chosen before sign-in or on `/welcome`, locked | Equivalent. |
| Mock interviews | Technical, behavioral, HR; browser speech in and out; time-driven sessions; Gemini quota tracking | Same rounds, real-time Vapi voice with adaptive Gemini follow-ups, probing of weak answers, reports with better answers, delivery and camera coaching | Keep INT-IQ's engine. Borrow time-driven sessions (step 5) and usage tracking (rate limits, step 2). |
| Proctoring | Face presence, multiple faces, gaze, impersonation flags, plus facial expression (emotion) analysis | Face presence, tab switches, pastes; counts only | Keep presence-style signals; add a multiple-faces count. Emotion analysis is not copied: the brief forbids judging people from appearance or emotion. |
| Resume | PDF and Word parsing, ATS score, CV tailor for a job | PDF and text, summary, skills, projects, strengths, gaps | Step 4 adds Word files, ATS checks, job-specific matching and tailoring tips. |
| Prep planning | Skill-gap analyzer and a fixed 4-week study plan with a checklist | None | Step 8's career agent goes further: goal, weekly roadmap, daily tasks, verified progress, replanning. |
| Jobs | External listings (JSearch on RapidAPI, indianapi.in, freejobalert pages) with match scores | Internal jobs only | Internal jobs first, plus Adzuna (step 8) and match scores (step 4). |
| Recruiter tools | AI job description creator, applicant pipeline, assessments with grading and plagiarism checks, hiring decisions with email | Jobs, applicants, AI and live invitations, reports, live room with Copilot | Steps 3, 4, 5 and 9 add the JD creator, pipeline board, match evidence, coding assessments and notifications. |
| Shortlisting | Agent ranks applicants and labels everyone below the top N "reject" | None | Step 9's recruiter agent explains matches with evidence and proposes actions; rejections and shortlists wait for the recruiter, and names are removed before AI comparison. |
| Look | "Liquid glass", coral gradient, Inter | Lamp room, ink and amber, Geist | Keep INT-IQ's. |

## 4. Free APIs (from public-apis, checked live 2026-11-11)

| API | Use in INT-IQ | Key | Check | Step |
|---|---|---|---|---|
| Codeforces | Career agent assigns DSA problems by topic and rating, then verifies solved ones from the user's submissions | None for public methods | Works | 8 |
| Judge0 CE | Runs code in DSA rounds and coding assessments | None on the public instance (rate-limited); free RapidAPI key for reliability | Ran Python code | 5 |
| Adzuna | Real job openings in India, after internal jobs | Free app id and key (you sign up at developer.adzuna.com) | Endpoint exists, needs key | 8 |
| GitHub REST | Evidence from a candidate's public repos for resume claims and job matching (only when the candidate adds their username) | Optional free token for 5,000 requests per hour | Works | 4 |
| Kickbox Open / MailCheck.ai | Flags disposable and free-mail domains when a recruiter signs up | None | Works | 2 |
| RDAP (rdap.org) | Domain registration date, and whether a company domain exists at all | None | Works | 2 |
| Wikidata | Public record of a company whose official website is the given domain | None | Works | 2 |
| gstinapi.in | Indian GST number: legal name and active status | Free key, 75 lookups (optional) | Docs checked | 2 |
| Stack Exchange | Practice questions for weak topics | None (300 requests per day) | Works | 8 |

Not used: Wandbox (failed during the test), Open Skills (offline), RemoteOK and Arbeitnow (remote and European jobs; RemoteOK requires backlinks), Jooble (bot check blocked the test), Disify (moved).

All external calls run on the server, with timeouts, cached where possible, and the app keeps working if one is down.

## 5. Design for the new parts

### Agent runtime (shared by the career and recruiter agents)

- One loop on the server: Gemini with tool calling (AI SDK), a step limit, time limit and per-user daily quota.
- Tools are typed server functions that only touch the signed-in user's data. Each returns a result the agent must check before it reports success (for example, after creating tasks it reads them back).
- Consequential actions need a human click. Applying to a job, sending an invitation, shortlisting, rejecting or making an offer create a pending action; nothing happens until the user approves it.
- Everything is logged: `agent_runs` and `agent_steps` (tool, input, output, verification), shown to the user as "what the agent did and why".
- Memory across sessions lives in the database: the goal, the plan, task history, assessment and interview results, and `agent_memories` (facts with their source).
- Replanning is event-driven: interview finished, assessment graded, task overdue or verified, resume changed.
- Fairness: matching and ranking use job-relevant evidence only. Names, emails, photos, age, gender and similar fields are stripped before any AI comparison. AI never decides hiring outcomes.

### New tables (added in the step that needs them)

| Table | Step |
|---|---|
| `profiles` recruiter status columns, `rate_limits` | 2 |
| `notifications` | 3 |
| `resume_analyses` (history), `job_matches` (score parts with evidence) | 4 |
| interview type, difficulty and duration columns; new rubric fields in reports | 5 |
| `career_goals`, `roadmap_milestones`, `agent_tasks`, `skill_assessments` (or adopt `assessments`), `agent_runs`, `agent_steps`, `agent_memories`, `agent_actions` | 8 |
| `hiring_goals` (reuses the agent tables) | 9 |

Existing rows stay valid: new report fields are optional, and old reports render as before.

## 6. Steps

Each step ends with type checks, lint, a build, the e2e suite, a short "changed files" list in this file, and a commit by you.

### Step 2: Auth and role security
- Fix the role-conflict redirect.
- Recruiter approval: new recruiters start as pending (they can draft jobs, but can't publish, see applicants or invite) until an admin approves them on `/admin/recruiters`; admins come from an `ADMIN_EMAILS` server variable; existing recruiters are approved automatically; the admin sees a disposable or free-mail warning (Kickbox).
- Close password sign-up on the live branch and run the e2e tests on a separate Neon test branch.
- Google account chooser, if Neon Auth's Google provider accepts it.
- Lock integrity data after completion; allow the voice transcript endpoint only for local voice testing.
- Per-user rate limits on AI and voice routes (Postgres-backed).
- Security headers, prompt-injection guards, PDF page and time limits, transactions.
- Done when: new tests cover pending-recruiter limits, admin approval, the role-conflict page, locked integrity, rate limits and blocked transcript writes.

### Step 3: Workflow gaps
- Pipeline board per job (columns by status), candidate application timeline, notifications with a bell (invited, interview done, status changed), cleanup of dead code.
- A deterministic fake AI model for tests, so job, apply, invite, interview and report flows get e2e tests.

### Step 4: Resume intelligence
- Structured analysis: education, experience and internships, projects with stack, skills by category, achievements, missing information, ATS checks, role suitability with evidence, recommendations. Never invents anything.
- Job-specific match (skills, experience, projects, missing items, each with evidence), history of analyses, optional GitHub evidence.

### Step 5: Mock interview engine
- Types: technical, HR, behavioral, DSA (reasoning out loud, plus a code editor run through Judge0), role-specific (from a job description).
- Difficulty and duration settings; rubric: technical correctness, problem solving, communication, clarity, depth.
- Progress over time per skill and per rubric dimension.

### Step 6: Human-to-human interviews
- TURN servers from environment variables, interview timer, presence indicator (face detection shows "in view", never proof of honesty), reconnect handling, signal cleanup.

### Step 7: Recruiter Copilot
- Running summary of answers, topics needing clarification, suggested questions per required skill, a structured scorecard with evidence. Never decides.

### Step 8: Career agent
- Goal intake ("SDE at Amazon in six months") to a structured goal.
- Tools: analyze resume, generate and grade skill assessments, build a weekly roadmap, create daily tasks, assign and verify Codeforces problems, prepare mock interviews, read reports, find internal and Adzuna jobs, update progress.
- Pages: goal overview, roadmap, today's tasks, agent activity, readiness score, job recommendations.

### Step 9: Recruiter agent
- Hiring goal ("three junior backend developers this month") to tracked progress.
- Organizes applications, explains matches, lists pending recruiter actions, drafts interview plans, summarizes evaluations, recommends the next action.
- Shortlisting, rejection, invitations and offers always wait for the recruiter's approval.

### Step 10: Goal tracking, memory, replanning
- Event-driven reviews, memory with sources, weekly summaries, readiness trend.

### Step 11: Testing and release
- Full e2e suite on the test branch, live smoke tests for Gemini, Vapi and the external APIs, a security pass, and a deployment checklist (Vercel variables, migrations, auth settings).

## 7. What only you can do

| When | What |
|---|---|
| Step 2 | Set `ADMIN_EMAILS` in `.env.local` and on Vercel. Confirm deleting leftover test accounts. |
| Step 5 | Optional: free RapidAPI key for Judge0 (more reliable than the public instance). |
| Step 6 | A TURN server account (for example Metered or Cloudflare Realtime) for live video on strict networks. |
| Step 8 | Free Adzuna app id and key. Optional GitHub token. |
| Every step | Commit, push, and run `vercel deploy --prod`. |

---

## 8. Step log

### Step 2: auth and role security (2026-11-11)

What changed:
- Recruiter approval: `recruiter_profiles` table (migration 0007; the 4 recruiters that already existed start approved), verification card on `/recruiter`, admin page `/admin/recruiters` with Kickbox email signals, admin link with a waiting count. Applicant data, application updates, invitations, recruiter reports and live rooms check approval inside the queries (`lib/recruiting.ts`, `lib/live-interviews.ts`).
- Admins come from `ADMIN_EMAILS` and need a verified email (`lib/admin.ts`).
- Password sign-up is off on the live branch (`neon neon-auth config email-password update --disable-sign-up true`). New users still sign up with an email code or Google: checked on the test branch, where a code was issued for a brand-new address while password sign-up was refused.
- Tests run on the Neon branch `e2e-tests` (`.env.test.local`, port 3100, `npm run db:migrate:test`). The setup creates a student and a recruiter, and the test admin approves the recruiter through the real admin API.
- Fixed: role-conflict redirect, integrity data locked after an interview ends, the voice transcript endpoint only works for local voice testing, rate limits (`lib/rate-limit.ts`, `rate_limits` table), security headers, prompt-injection guards (`lib/ai/untrusted.ts`), PDF limits (15 pages, 15 s), transactions for invitations and completions, dead code removed.
- New tests: `e2e/security.spec.ts` (role conflict, recruiter approval, admin-only page, locked integrity, blocked transcript writes, rate limits, headers). Full suite: 54 passed, 14 skipped.

Files: `lib/{admin,email-check,recruiters,rate-limit}.ts`, `lib/ai/untrusted.ts`, `app/(app)/admin/recruiters/page.tsx`, `app/api/admin/recruiters/[id]`, `app/api/recruiter/verification`, `components/admin/recruiter-review.tsx`, `components/recruiting/recruiter-verification.tsx`, `drizzle/0007_*`, `e2e/{db.ts,security.spec.ts}`, plus edits to the API routes, `lib/{api,session,vapi,recruiting,interviews,live-interviews,db/schema}.ts`, `lib/ai/{interviewer,copilot}.ts`, the sidebar, `next.config.ts`, `playwright.config.ts` and the e2e setup.

Limits found:
- Neon Auth's managed Google sign-in drops `prompt=select_account`, so the app can't force Google's account chooser. Google still shows it when several accounts are signed in.
- The test branch is a copy of production, so it holds copies of real users. Test screenshots in `e2e/.results` (git-ignored) can show them.
- The live branch allows localhost sign-ins (needed while local development uses live data). Revisit in step 11.

Left for you: run `npm run db:migrate` before deploying, set `ADMIN_EMAILS` locally and on Vercel, and optionally review leftover test accounts in the Neon console (3 password logins, 3 unverified users).

### Step 2 addition: company verification (2026-11-11)

- Recruiters now send full company details (name, website, industry, size, headquarters, company LinkedIn, GST number, about) and their own (job title, LinkedIn, note). Companies live in a shared `companies` table, one row per domain (migration 0008).
- `lib/company-check.ts` checks the company: DNS, the live website and its title (fetched with SSRF protection: public addresses only, pinned DNS, at most 3 redirects, 300 KB, 5 s), domain age (RDAP), mail servers, the name on the site, a Wikidata record and the GST number (check digit offline; registry lookup with `GSTIN_API_KEY`).
- `lib/recruiter-assessment.ts` turns that into a verdict. A company that doesn't exist is turned away at once. A strong match (an established company plus a verified sign-in email on its own domain) is approved automatically, but never after an admin declined. Everything else waits for the admin, who sees the checks next to the company profile. Recruiters see the same checks and a tip.
- Tests: fake company and bad GST number turned away; automatic approval for a verified work email at example.com. Full suite: 56 passed, 16 skipped.

