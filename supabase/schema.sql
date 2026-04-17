-- ═══════════════════════════════════════════════════════════════════════
--   AI Student Advisor — Database Schema
--   Paste this ENTIRE file into: Supabase Dashboard → SQL Editor → New Query
--   Then click "Run" (or press Cmd/Ctrl + Enter).
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. PROFILES ───────────────────────────────────────────────────────
--   One row per user, extends auth.users. Created automatically on signup
--   via the trigger at the bottom of this file.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  education_level text,           -- e.g. 'high_school', 'undergraduate'
  interests text[] default '{}',  -- e.g. {'technology','biology','design'}
  skills text[] default '{}',
  preferred_countries text[] default '{}',
  grades jsonb default '{}'::jsonb,  -- flexible shape: { "math": 92, "gpa": 3.8 }
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── 2. CHAT SESSIONS ──────────────────────────────────────────────────
--   A conversation thread. Each user can have many.
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_user_id_idx
  on public.chat_sessions(user_id, updated_at desc);

-- ─── 3. CHAT MESSAGES ──────────────────────────────────────────────────
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_idx
  on public.chat_messages(session_id, created_at asc);

-- ─── 4. RECOMMENDATIONS ────────────────────────────────────────────────
--   Saved AI-generated suggestions (majors, careers, universities).
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.chat_sessions(id) on delete set null,
  kind text not null check (kind in ('major', 'career', 'university')),
  title text not null,
  summary text,
  details jsonb default '{}'::jsonb,  -- free-form: reasons, fit-score, links…
  is_saved boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists recommendations_user_idx
  on public.recommendations(user_id, created_at desc);
create index if not exists recommendations_kind_idx
  on public.recommendations(user_id, kind);

-- ═══════════════════════════════════════════════════════════════════════
--   ROW LEVEL SECURITY
--   Every table gets RLS + policies so users ONLY see their own data.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.profiles          enable row level security;
alter table public.chat_sessions     enable row level security;
alter table public.chat_messages     enable row level security;
alter table public.recommendations   enable row level security;

-- ─── profiles policies ───
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- ─── chat_sessions policies ───
drop policy if exists "chat_sessions_select_own" on public.chat_sessions;
create policy "chat_sessions_select_own" on public.chat_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "chat_sessions_insert_own" on public.chat_sessions;
create policy "chat_sessions_insert_own" on public.chat_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "chat_sessions_update_own" on public.chat_sessions;
create policy "chat_sessions_update_own" on public.chat_sessions
  for update using (auth.uid() = user_id);

drop policy if exists "chat_sessions_delete_own" on public.chat_sessions;
create policy "chat_sessions_delete_own" on public.chat_sessions
  for delete using (auth.uid() = user_id);

-- ─── chat_messages policies ───
drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages
  for select using (auth.uid() = user_id);

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own" on public.chat_messages
  for insert with check (auth.uid() = user_id);

drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_delete_own" on public.chat_messages
  for delete using (auth.uid() = user_id);

-- ─── recommendations policies ───
drop policy if exists "recs_select_own" on public.recommendations;
create policy "recs_select_own" on public.recommendations
  for select using (auth.uid() = user_id);

drop policy if exists "recs_insert_own" on public.recommendations;
create policy "recs_insert_own" on public.recommendations
  for insert with check (auth.uid() = user_id);

drop policy if exists "recs_update_own" on public.recommendations;
create policy "recs_update_own" on public.recommendations
  for update using (auth.uid() = user_id);

drop policy if exists "recs_delete_own" on public.recommendations;
create policy "recs_delete_own" on public.recommendations
  for delete using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════
--   AUTO-CREATE PROFILE ON SIGNUP
--   This trigger fires whenever a new row is added to auth.users,
--   inserting a matching row into public.profiles.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════
--   UPDATED_AT AUTO-TOUCH
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists sessions_touch_updated_at on public.chat_sessions;
create trigger sessions_touch_updated_at
  before update on public.chat_sessions
  for each row execute function public.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
--   DONE. Verify with:
--     select * from public.profiles limit 1;
--   After you create a test user, a profile row should appear automatically.
-- ═══════════════════════════════════════════════════════════════════════
