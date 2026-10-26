# Bahar — School Management System

Bahar (بهار, "spring") is a comprehensive, multi-tenant school management
system built for Iranian schools: students, teachers, classes, grades,
attendance, finance, certificates, messaging and a public website for every
school — in one install.

> The product UI is Persian-first (RTL, Jalali calendar). This README is in
> English so the codebase is easy to evaluate and contribute to.

## Features

- **People & structure** — schools (tenants), users with role-based access
  (super admin, admin, manager, deputy, teacher, student, parent), students
  with a 360° profile, parents, classes, subjects, teaching assignments and
  timetables.
- **Daily operations** — attendance, grades and monthly report cards,
  assignments, school events, leaves, meetings and tasks.
- **Communication** — announcements with audience targeting, direct
  messages, notifications, and credential/announcement delivery through the
  **Shad** messenger gateway (with an internal simulated mode), plus a
  Telegram bot.
- **Finance** — student fees, overdue sweeps and payment tracking.
- **Certificates** — designed certificate templates with public QR
  verification.
- **Public school site** — every school gets a public page (10 templates)
  with lead capture; internal announcements stay private unless they are
  addressed to everyone.
- **Platform** — country packs and language packs, a blog/CMS, question
  bank, media library, behavior records, badges and houses, wellbeing
  check-ins and risk scoring, scheduled reports, full audit log, and
  one-click backup/restore.
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
prisma           schema (68 models) and seed
scripts          seed/dev helpers, Python Shad gateway, Android & Windows shells
docs             design language and internal notes
```

## License

MIT — see [LICENSE](LICENSE).
