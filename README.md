# 🎓 AI Student Advisor

A sophisticated AI guide that helps students choose majors, explore careers, and find universities. Built with Next.js 14 (App Router), Supabase, and Claude (Anthropic).

Design inspired by **"The Intelligent Surface"** — an editorial dark-mode experience with glassmorphism, tonal depth, and intentional asymmetry.

---

## Table of Contents

1. [Tech Stack](#-tech-stack)
2. [Local Setup](#-local-setup)
3. [Supabase Setup](#-supabase-setup)
4. [Anthropic (Claude) Setup](#-anthropic-claude-setup)
5. [Environment Variables](#-environment-variables)
6. [Deploy to Vercel](#-deploy-to-vercel)
7. [Cloudflare Setup](#-cloudflare-setup)
8. [Project Structure](#-project-structure)
9. [Security Notes](#-security-notes)
10. [Final Checklist](#-final-checklist)

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS (custom design tokens from `DESIGN.md`) |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (email + password) |
| AI | Anthropic Claude via `@anthropic-ai/sdk` |
| Hosting | Vercel |
| CDN / Security | Cloudflare |

---

## 🚀 Local Setup

Prerequisites: **Node.js ≥ 18.17** and **npm** (or pnpm / yarn).

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template
cp .env.example .env.local

# 3. Fill in Supabase + Anthropic keys (see sections below)

# 4. Start the dev server
npm run dev
```

Visit http://localhost:3000 — you should be redirected to `/login`.

---

## 🗄️ Supabase Setup

### Step 1 — Create a project

1. Go to <https://supabase.com> → **New project**.
2. Pick a name (e.g. `ai-student-advisor`), region closest to your users, and a strong database password.
3. Wait ~2 minutes for provisioning.

### Step 2 — Copy your credentials

1. **Project Settings → Data API → Project URL** → paste into `NEXT_PUBLIC_SUPABASE_URL`.
2. **Project Settings → API Keys → anon public** → paste into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

> ✅ The `anon` key is safe to expose. Row Level Security (enabled by the schema below) is what keeps each user's data isolated.

### Step 3 — Run the schema

1. Open **SQL Editor** (left sidebar) → click **+ New query**.
2. Open `supabase/schema.sql` in this repo, copy **the entire file**, paste it into the SQL editor.
3. Click **Run** (or `Cmd/Ctrl + Enter`).
4. You should see "Success. No rows returned." — that means all tables, policies, and triggers were created.

This single file sets up:

- `profiles` — extends `auth.users` (interests, skills, countries, grades)
- `chat_sessions` + `chat_messages` — conversation history
- `recommendations` — saved AI suggestions (majors / careers / universities)
- **RLS policies** so users only ever see their own rows
- A trigger that auto-creates a `profiles` row on signup

### Step 4 — Configure Auth

1. **Authentication → Providers → Email** → make sure it's **Enabled**.
2. **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000` (change to your production URL later).
   - **Redirect URLs:** add `http://localhost:3000/auth/callback` and your production `https://yourdomain.com/auth/callback`.
3. (Optional) **Authentication → Email Templates** → tweak the confirmation email to match your brand.

### Step 5 — Verify

Create a test account via the app's `/signup` page. Then in Supabase:

```sql
select id, email, full_name from public.profiles;
```

You should see your test user — auto-inserted by the trigger.

---

## 🤖 Anthropic (Claude) Setup

1. Go to <https://console.anthropic.com> and sign in (or create an account).
2. **Settings → API Keys → Create Key** — name it something like `ai-student-advisor-prod`.
3. Copy the key (starts with `sk-ant-api03-...`) and paste into `ANTHROPIC_API_KEY` in `.env.local`.
4. **Add billing** (Settings → Billing) if you haven't — Claude needs a positive balance.

> ⚠️ **Never** put `ANTHROPIC_API_KEY` in a `NEXT_PUBLIC_*` variable or expose it to the browser. It is only read by `app/api/chat/route.ts`, which runs server-side.

### (Optional) Change the model

Default: `claude-3-5-sonnet-latest`. To use a different model, set `ANTHROPIC_MODEL` in your env.

---

## 🔑 Environment Variables

| Variable | Where to get it | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys | ✅ Yes (protected by RLS) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → Settings → API Keys | ❌ **Server only** |
| `ANTHROPIC_MODEL` | Optional override | ❌ Server only |
| `NEXT_PUBLIC_SITE_URL` | Your public URL | ✅ Yes |

---

## ▲ Deploy to Vercel

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USER/ai-student-advisor.git
git push -u origin main
```

### Step 2 — Import on Vercel

1. Go to <https://vercel.com/new> → **Import** your GitHub repo.
2. Framework preset: **Next.js** (auto-detected).
3. Build command / output: leave defaults.
4. **Environment Variables** — add all four from the table above (copy-paste from your `.env.local`). Set the scope to **Production, Preview, and Development**.
5. Click **Deploy**.

### Step 3 — Update Supabase redirect URLs

Once deployed, grab the Vercel URL (e.g. `ai-student-advisor.vercel.app`) and go back to **Supabase → Authentication → URL Configuration**:

- Set **Site URL** to `https://ai-student-advisor.vercel.app`.
- Add `https://ai-student-advisor.vercel.app/auth/callback` to **Redirect URLs**.

Redeploy on Vercel if you change env vars.

---

## 🛡️ Cloudflare Setup

This section is optional but recommended for production — adds WAF, DDoS protection, and a custom domain.

### Step 1 — Add your domain

1. Sign in at <https://dash.cloudflare.com> → **Add site** → enter your domain (e.g. `studentadvisor.app`).
2. Pick the **Free** plan (it's enough for this app).
3. Cloudflare will scan your existing DNS records — leave them as-is for now.
4. At your domain registrar (GoDaddy, Namecheap, etc.), **change nameservers** to the two Cloudflare nameservers shown. Propagation: 5 min – 24 hrs.

### Step 2 — Point DNS to Vercel

In Cloudflare **DNS → Records**, add:

| Type | Name | Value | Proxy |
|---|---|---|---|
| `A` | `@` | `76.76.21.21` | 🟠 Proxied |
| `CNAME` | `www` | `cname.vercel-dns.com` | 🟠 Proxied |

Then in **Vercel → Project → Settings → Domains**, add `yourdomain.com` and `www.yourdomain.com`. Vercel will verify the DNS.

### Step 3 — SSL / TLS

1. **SSL/TLS → Overview** → set encryption mode to **Full (Strict)**.
2. **SSL/TLS → Edge Certificates** → enable **Always Use HTTPS** and **Automatic HTTPS Rewrites**.

### Step 4 — Enable security features

1. **Security → WAF** → the **Cloudflare Managed Ruleset** is on by default on the free plan — good.
2. **Security → DDoS** → automatic on free tier, no action needed.
3. **Security → Bots → Bot Fight Mode** → turn **ON**.
4. **Security → Settings → Security Level** → set to **Medium** (or **High** for tighter filtering).
5. **Security → Settings → Challenge Passage** → `30 minutes`.

### Step 5 — Performance

1. **Speed → Optimization → Auto Minify** → enable JS, CSS, HTML.
2. **Caching → Configuration → Browser Cache TTL** → `4 hours` or `Respect Existing Headers`.

### Step 6 — Update site URL everywhere

Back in Supabase → Auth → URL Configuration, swap the Vercel URL for `https://yourdomain.com` (and its `/auth/callback`). Also update `NEXT_PUBLIC_SITE_URL` in Vercel.

---

## 🗂️ Project Structure

```
ai-student-advisor/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (app)/                    # protected — requires auth
│   │   ├── layout.tsx            # TopNav + Sidebar shell
│   │   ├── dashboard/
│   │   │   ├── page.tsx          # "Hi, I'm your Smart Advisor" hero
│   │   │   └── DashboardPromptBox.tsx
│   │   ├── chat/
│   │   │   ├── page.tsx
│   │   │   └── ChatClient.tsx    # streaming chat UI
│   │   ├── profile/
│   │   │   ├── page.tsx
│   │   │   └── ProfileForm.tsx   # chip editor for interests/skills/countries
│   │   ├── recommendations/
│   │   │   └── page.tsx
│   │   └── history/
│   │       └── page.tsx
│   ├── api/
│   │   └── chat/route.ts         # Claude streaming + Supabase persistence
│   ├── auth/callback/route.ts    # email confirmation handler
│   ├── globals.css               # design tokens + component classes
│   ├── layout.tsx                # fonts (Manrope + Inter) + root shell
│   └── page.tsx                  # redirect based on auth
├── components/
│   ├── TopNav.tsx
│   ├── Sidebar.tsx
│   ├── SuggestionChip.tsx
│   └── AdvisorCard.tsx
├── lib/
│   └── supabase/
│       ├── client.ts             # browser client
│       ├── server.ts             # RSC / route handler client
│       └── middleware.ts         # session refresh for middleware
├── supabase/
│   └── schema.sql                # tables + RLS + triggers
├── middleware.ts                 # route protection
├── tailwind.config.ts            # DESIGN.md tokens pinned exactly
├── next.config.js
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 🔒 Security Notes

- **`ANTHROPIC_API_KEY` is server-only.** It's read exclusively by `app/api/chat/route.ts` (runs on Vercel's Node.js runtime) — never imported into a client component.
- **Row Level Security is mandatory.** Every table has `enable row level security` plus policies scoped to `auth.uid() = user_id`. A user cannot read or write another user's data even if they tamper with the anon key.
- **Middleware enforces auth.** `middleware.ts` redirects unauthenticated users away from `/dashboard`, `/chat`, `/profile`, `/recommendations`, `/history`.
- **Cloudflare** (if enabled) adds a WAF, DDoS shielding, bot filtering, and TLS termination in front of Vercel.
- **No secrets in git.** `.env.local` is gitignored; use Vercel's Environment Variables UI for production.

---

## ✅ Final Checklist

### Supabase
- [ ] Project created
- [ ] `supabase/schema.sql` pasted and run successfully
- [ ] Email provider enabled in Auth → Providers
- [ ] Site URL + redirect URLs configured (local + production)
- [ ] Test user created → verified that `public.profiles` has a matching row

### Environment
- [ ] `.env.local` created from `.env.example`
- [ ] `NEXT_PUBLIC_SUPABASE_URL` filled
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` filled
- [ ] `ANTHROPIC_API_KEY` filled
- [ ] `npm run dev` starts without errors

### Auth & Chat
- [ ] Sign up flow works → email received (if confirmation enabled)
- [ ] Login redirects to `/dashboard`
- [ ] Logging out returns you to `/login`
- [ ] Sending a chat message streams a reply from Claude
- [ ] Chat appears in `/history` after sending

### Deployment (Vercel)
- [ ] Repo pushed to GitHub
- [ ] Vercel project imported
- [ ] All 4 env vars added in Vercel Settings
- [ ] First deploy succeeded
- [ ] Production domain added to Supabase redirect URLs

### Cloudflare (optional)
- [ ] Domain nameservers pointing to Cloudflare
- [ ] DNS A / CNAME records pointing to Vercel (proxied)
- [ ] SSL mode set to Full (Strict)
- [ ] Always Use HTTPS enabled
- [ ] Bot Fight Mode enabled
- [ ] WAF Managed Ruleset active
- [ ] Domain added to Vercel project
- [ ] `NEXT_PUBLIC_SITE_URL` updated to custom domain

### UI completion
- [ ] Fonts load (Manrope + Inter visible on dashboard)
- [ ] Material Symbols icons appear in sidebar
- [ ] Gradient CTA button renders (sidebar "New Conversation")
- [ ] Glass panels blur the background behind them
- [ ] No harsh 1px borders anywhere (design rule)
- [ ] Chat input glows on focus
- [ ] Mobile: sidebar collapses, layout stays readable

---

## 📜 Design System

This app implements the **"Intelligent Surface"** design system from the supplied `DESIGN.md`. Key rules enforced in code:

- **Surface hierarchy** via tonal layering, never borders.
- **Glassmorphism** recipe: `rgba(20, 36, 73, 0.6)` + `backdrop-filter: blur(20px)`.
- **Primary CTAs** use the 135° gradient `#9093ff → #6063ee`.
- **24px vertical rhythm** between list items (no dividers).
- **Manrope** for headlines, **Inter** for body.
- **Tertiary cyan** (`#7bd0ff`) reserved as the "highlighter" for key AI insights.

All tokens live in `tailwind.config.ts` and `app/globals.css`.

---

Built with care. Now go help some students find their path. 🎓
