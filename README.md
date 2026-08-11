# Ethers — Light Build

Same 6 modules as the original spec, but stripped down to run with almost nothing:

**What's different from the full spec:**
- ❌ No Postgres / Prisma / Supabase → ✅ plain JSON files in `/data` (auto-created on first run)
- ❌ No NextAuth → ✅ a small signed-cookie session (`lib/auth.ts`), employees live in `data/employees.json`
- ❌ No Playwright / browser automation / Redis queue → ✅ Gemini's built-in Google Search grounding does the "look up competitor prices" and "read our public listing" jobs directly (Module 5 & 6). Less pixel-perfect than a screenshot pipeline, but zero infra.
- ❌ No `@react-pdf/renderer` PDF export → ✅ simple CSV export (fast, no extra deps). Add PDF back later if you need it.
- Everything else — the 6 modules, shared MenuItem model, "AI-gathered/estimated" disclaimers, AI badges — works the same as the original spec.

## Setup

```bash
cd ethers-app
npm install
cp .env.example .env
```

Fill in `.env`:
- `GEMINI_API_KEY` — from Google AI Studio
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — your first login (seeds `data/employees.json` on first run)
- `SESSION_SECRET` — any long random string (`openssl rand -hex 32`)

```bash
npm run dev
```

Open `http://localhost:3000` → redirects to `/login`.

## Adding more team logins

Edit `data/employees.json` after first run and add more entries:
```json
{ "email": "staff@ethers.local", "password": "...", "role": "staff", "name": "Riya" }
```
(Passwords are stored plain here for simplicity since this never leaves your internal network — swap in bcrypt hashing before exposing it more broadly.)

## Deploying

Works on plain Vercel/any Node host since there's no Playwright/Chromium requirement. Just make sure the `data/` and `public/uploads/` folders are on **persistent** disk — on serverless platforms with ephemeral filesystems (like default Vercel), swap `lib/db.ts` for a tiny hosted KV/DB later if you need writes to survive redeploys. For a single small VM or Railway/Render app, the JSON files just work as-is.

## Folder map
```
app/            routes (login, dashboard/<module>, api/*)
lib/db.ts       JSON-file storage — swap this one file for a real DB later
lib/auth.ts     cookie session — swap for NextAuth later if you need SSO
lib/ai/gemini.ts   the only file that talks to Gemini
```
