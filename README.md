# Bahar — School Management System

Bahar (بهار, "spring") is a comprehensive, multi-tenant school management
system built for Iranian schools: students, teachers, classes, grades,
attendance, finance, certificates, messaging and a public website for every
school — in one install.

> The product UI is Persian-first (RTL, Jalali calendar). This README is in
> English so the codebase is easy to evaluate and contribute to.

## Features

- **People & structure** — schools (tenants), users with role-based access
  (super admin, admin, manager, deputy, teacher, student, parent, custodian),
  students with a 360° profile, parents, classes, subjects, teaching
  assignments and timetables.
- **Admissions** — a full enrolment pipeline for website leads (new →
  contacted → tour → waitlist → admitted → enrolled) with one-click
  conversion of an admitted applicant into a real student account.
- **Daily operations** — attendance (students and staff), grades and monthly
  report cards, assignments with targeted delivery, submission receipts and
  exemptions, school events with iCal export, leaves, meetings and tasks.
- **Teaching** — question bank, online quizzes with auto-grading, lesson
  plans with a planned-vs-taught coverage dashboard, substitute-teacher
  planner, and a school library with loans and overdue tracking.
- **Exams & reports** — in-person exam operations (deterministic shuffled
  seating across rooms, invigilators, printable admit cards), descriptive
  (qualitative) report cards for elementary grades, a report-comment bank
  with rule-based auto-drafts, and printable student ID cards.
- **Students & families** — behavior records, badges and houses, wellbeing
  check-ins and risk scoring, seating charts, transport routes with daily
  boarding checklists, gate passes, preschool daily reports with an
  authorized-pickup registry, a health card and clinic visit log with
  instant parent notification, forms & consent collection, after-school
  clubs with capacity and waitlists, a cashless canteen wallet with
  parent top-ups and daily spending limits, a weekly meal plan, an
  auto-assembled digital portfolio of every achievement, and alumni
  records.
- **Communication** — announcements with audience targeting and read
  receipts, direct messages, notifications, an SMS panel, and
  credential/announcement delivery through the **Shad** messenger gateway
  (with an internal simulated mode), plus a Telegram bot.
- **Finance & HR** — student fees with overdue sweeps, staff payroll with
  printable payslips, and full data portability (imports, Excel/CSV exports
  for students, staff, grades, attendance and fees, complete backup/restore).
- **Year lifecycle** — academic-year rollover: promote classes to the next
  year or graduate them into alumni records, in one transaction.
- **Certificates** — designed certificate templates with public QR
  verification.
- **Public school site** — every school gets a public page with 16 templates
  across 10 layout families (each with several color palettes) and lead
  capture; internal announcements stay private unless they are addressed to
  everyone.
- **Printing** — a global print/PDF framework: every panel page prints
  clean A4 output with an official header (school, section, print date),
  repeating table headers and unbroken cards, plus dedicated print sheets
  where they matter — report cards, exam papers with a separate answer
  key, admit cards, payslips, certificates and student ID cards.
- **Platform** — a network (EMIS) rollup dashboard for platform admins,
  per-school country profiles (calendar system, grading scale — 20 / 100 /
  GPA / letter — currency label and week start, applied to grade exports),
  country packs and language packs, a blog/CMS, media library, scheduled
  reports, a full audit log, and one-click backup/restore.
- **Engagement & guidance** — a school TV board (kiosk mode: announcements,
  events, birthdays, meals and the house league champion, auto-rotating), a
  wall of fame with a live house league, an academic-guidance engine
  (transparent weighted stream recommendations for counsellors, students and
  parents), a student study planner with habit streaks, and an auto-assembled
  digital yearbook — all printable.
- **Physical health & capabilities** — every student has a physical-health
  profile (sports participation status: full / limited / exempt with an
  exact restriction note, asthma, heart condition, seizures, diabetes,
  mobility, vision and hearing notes, regular medications, blood type,
  allergies and a review date). The flags surface where they matter:
  the attendance sheet shows a health alert next to the student's name,
  and a school-wide restrictions roster gives PE teachers the full
  picture before class.
- **Data management** — records entered anywhere in the app can be
  deleted again: every module exposes a scoped, role-gated delete (single
  records, plus bulk clears such as a whole day's attendance sheet), and
  list screens carry matching delete actions with confirmation.
- **Security** — password login with captcha and lockout, TOTP two-factor,
  one-time codes, and **Passkeys (WebAuthn)** for passwordless sign-in,
  managed per user from the profile.
- **Clients** — responsive web app and PWA, plus optional Android (WebView)
  and Windows (Electron) shells under `scripts/`.

## Tech stack

- Next.js 16 (App Router, standalone output) + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui (Radix), framer-motion, recharts
- Prisma 6 + SQLite
- Cookie sessions signed with HMAC (scrypt password hashing), optional
  TOTP two-factor and email/SMS one-time login codes
- Bun or Node.js runtime

## Quick start

```bash
bun install

cp .env.example .env        # then set SESSION_SECRET (see below)

bunx prisma generate
bunx prisma db push         # creates db/custom.db from the schema
bun scripts/seed.ts         # optional sample data (development only)

bun run dev                 # http://localhost:3000
```

Production (self-hosted):

```bash
bun run build               # next build + standalone bundle
bun run start               # serves the standalone server
```

A sample `Caddyfile` for reverse proxying is included.

## Configuration

| Variable         | Purpose                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`   | Prisma datasource, e.g. `file:./db/custom.db`                           |
| `SESSION_SECRET` | **Required in production.** Signs session cookies, captcha, OTP and 2FA tokens. Use a long random value and keep it out of git. If unset on a self-hosted install, a random secret is generated once and stored in `db/session-secret.txt` (git-ignored). |
| `SEED_DEMO`      | Set to `1` to let the seed script assign the public demo password to the two demo accounts. Never enable in production. |

Platform settings (site title, OTP providers, Telegram bot, Shad gateway,
demo mode, …) live in the database and are managed from the super-admin
settings screen. Demo accounts are **disabled by default** and have no
default password.

## Security notes

- Never commit `.env`, `db/*.db`, `db/backups/*` or `db/uploads/*` — the
  shipped `.gitignore` already excludes them. The database contains password
  hashes and personal data of students and staff.
- Backups produced by the app strip plaintext temp passwords and
  second-factor secrets; password hashes are kept so users can still sign
  in after a restore.
- Temp passwords are one-time delivery secrets (sent via Shad) and are
  cleared from the database on first successful sign-in or password change.
- Found a vulnerability? Please open a private report instead of a public
  issue.

## Project layout

```
src/app          pages and API routes (App Router)
src/components   UI components
src/lib          auth, backup, scheduler, shad/telegram gateways, i18n, …
prisma           schema (105 models) and seed
scripts          seed/dev helpers, Python Shad gateway, Android & Windows shells
docs             design language and internal notes
```

## License

MIT — see [LICENSE](LICENSE).

## Deployment

Bahar is platform-neutral: it runs on any Node.js host (VPS, shared
hosting with Node support, Docker, a local machine) as a standalone
server backed by a plain SQLite file, and the same codebase also runs
on Cloudflare Workers with a D1 database — the driver is chosen at
runtime from the environment, nothing is Workers-only. A demo
deployment runs on Cloudflare Workers (via OpenNext) with a D1
database; uploaded files and backups are stored as BLOBs in D1 there,
and on the filesystem elsewhere. The demo deployment builds
automatically from the `main` branch.

**Build note:** the Workers demo build is
`npx prisma generate && node scripts/patch-prisma-client-exports.mjs && npx next build && npx opennextjs-cloudflare build --skipNextBuild`.
The Prisma client is generated with the standard `prisma-client-js`
generator into `node_modules/.prisma/client` and imported as
`@prisma/client`, so the bundlers externalize it instead of compiling the
large generated client into the app graph (compiling it from source made
production builds run out of memory, exit 137). The patch script reorders
the generated client's export conditions so the `workerd` entry wins in
the Workers bundle — its Node entry loads the query-compiler Wasm from
disk and compiles it dynamically, which Workers forbids. Interactive
Prisma transactions (`db.$transaction(async tx => ...)`) are not
supported by the D1 adapter — the data layer therefore uses sequential
writes or the batch form (`db.$transaction([...])`) only.
